import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { questionService } from "../src/modules/question";
import { readQuestionWorkbook } from "../src/modules/question/question-xlsx";
import {
  FIXTURE_ANSWER_TEXT,
  FIXTURE_GIVEN_TEXT,
  FIXTURE_HEADERS,
  FIXTURE_REGIONS,
  FIXTURE_SOLUTION,
  FIXTURE_STARTING_GRID,
  buildQuestionWorkbook,
  buildUploadBody,
  validRow,
} from "./question-fixture";
import type { FixtureRow } from "./question-fixture";

/**
 * Unit 05 integration tests: importing one category's question workbook, the pool
 * listing, and the controller's manual round-selection step.
 *
 * Covered: AC 1 (a valid file creates one `QuestionSet` plus one `Question` per row
 * with a correctly reconstructed grid), AC 2 (a non-complementary row rejects the
 * whole file and names the row), AC 3 (an irregular variant is rejected outright),
 * AC 4 (one category holds several sets in one pool), AC 5 (selecting exactly 6
 * satisfies Unit 03's publish-readiness check), AC 6 (a selection changes until the
 * round's preparation begins, then 409), AC 7 (a non-controller session is refused
 * on all three endpoints).
 *
 * Not covered here: the finished look of the frontend screens (UI-008 defers visual
 * design), and the real sample workbooks — the spec's Implementation Notes allow a
 * small hand-made fixture instead, which `tests/question-fixture.ts` builds.
 *
 * AC 8 (CI green) is the pipeline's own concern.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it5-controller-${suffix}`,
  judge: `it5-judge-${suffix}`,
};

const createdCompetitionIds: string[] = [];
let controllerToken = "";
let controllerDevice = "";
let judgeToken = "";
let judgeDevice = "";

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE",
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
    },
  });
}

function login(role: "controller" | "judge", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

/**
 * A competition with one category, created through the service so it carries the real
 * fixed 2x2 structure. One category is enough: readiness condition 3 checks every
 * category, and a single one keeps the tests about questions rather than about
 * seeding two pools.
 */
async function makeCompetition(name: string) {
  const competition = await competitionService.createCompetition({
    name,
    categories: [{ code: "U8", name: "Under 8" }],
  });
  createdCompetitionIds.push(competition.id);
  const category = competition.categories[0]!;
  const individualRoundIds = competition.stages
    .find((stage) => stage.type === "INDIVIDUAL")!
    .rounds.map((round) => round.id);
  const teamRoundIds = competition.stages
    .find((stage) => stage.type === "TEAM")!
    .rounds.map((round) => round.id);
  return {
    id: competition.id,
    categoryId: category.id,
    individualRoundIds,
    teamRoundIds,
  };
}

function authed(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

function importUrl(competitionId: string, categoryId: string): string {
  return `/api/competitions/${competitionId}/categories/${categoryId}/questions/import`;
}

function poolUrl(competitionId: string, categoryId: string): string {
  return `/api/competitions/${competitionId}/categories/${categoryId}/questions/pool`;
}

function selectionUrl(
  competitionId: string,
  categoryId: string,
  roundId: string,
): string {
  return `/api/competitions/${competitionId}/categories/${categoryId}/rounds/${roundId}/select-questions`;
}

/** POST one workbook as the multipart file part the endpoint expects. */
function upload(
  competitionId: string,
  categoryId: string,
  workbook: Buffer,
  filename = "questions.xlsx",
): request.Test {
  const { body, boundary } = buildUploadBody(workbook, filename);
  return authed(request(app).post(importUrl(competitionId, categoryId)))
    .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
    .send(body);
}

/** A file of N valid rows, so a selection of exactly 6 has somewhere to come from. */
function workbookOf(count: number): Buffer {
  return buildQuestionWorkbook(Array.from({ length: count }, () => validRow()));
}

/**
 * Import a workbook of `count` valid questions and return the ids the pool holds, in
 * `sequence` order. The common setup of most tests below.
 */
async function importQuestions(competitionId: string, categoryId: string, count: number) {
  const res = await upload(competitionId, categoryId, workbookOf(count));
  expect(res.status).toBe(200);
  const questions = await prisma.question.findMany({
    where: { questionSet: { categoryId } },
    orderBy: { sequence: "asc" },
    select: { id: true, sequence: true, roundId: true },
  });
  return { importResponse: res.body, questions };
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  await createAccount(users.judge, "JUDGE");

  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  const judge = await login("judge", users.judge);
  judgeToken = judge.body.token;
  judgeDevice = judge.body.deviceId;
});

afterAll(async () => {
  // Deleting the competition cascades away its categories, stages, rounds, question
  // sets, questions, stored files and import batches.
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("import a supported-variant file (AC 1)", () => {
  it("creates one question set and one question per row, with the reconstructed grids", async () => {
    const { id, categoryId } = await makeCompetition(`Import ${suffix}`);

    const res = await upload(id, categoryId, workbookOf(2), "四宫标准数独.xlsx");

    expect(res.status).toBe(200);
    expect(res.body.variantLabel).toBe("四宫标准数独");
    expect(res.body.questionCount).toBe(2);
    expect(typeof res.body.questionSetId).toBe("string");

    const questionSet = await prisma.questionSet.findUniqueOrThrow({
      where: { id: res.body.questionSetId },
      include: { questions: { orderBy: { sequence: "asc" } } },
    });
    // One set per imported file, named by the variant label from `*类目` (BLD-044).
    expect(questionSet.name).toBe("四宫标准数独");
    expect(questionSet.categoryId).toBe(categoryId);
    expect(questionSet.competitionId).toBe(id);
    expect(questionSet.sourceFileId).not.toBeNull();
    expect(questionSet.questions).toHaveLength(2);

    const question = questionSet.questions[0]!;
    // An imported question sits in the pool, not in a round, until the controller
    // selects it (BLD-040).
    expect(question.roundId).toBeNull();
    expect(question.sequence).toBe(1);
    expect(question.points).toBe(5);
    expect(question.gridRows).toBe(4);
    expect(question.gridColumns).toBe(4);
    expect(question.regions).toEqual(FIXTURE_REGIONS);
    // The two text columns merged: the given cells where the answer column has a gap,
    // and every position filled in the solution (BLD-047, spec Detail 3).
    expect(question.startingGrid).toEqual(FIXTURE_STARTING_GRID);
    expect(question.solution).toEqual(FIXTURE_SOLUTION);
    expect(questionSet.questions[1]!.sequence).toBe(2);

    // The original file is kept and its batch is COMMITTED (BLD-039, spec Detail 1).
    const file = await prisma.storedFile.findUniqueOrThrow({
      where: { id: questionSet.sourceFileId! },
    });
    expect(file.kind).toBe("QUESTION_EXCEL");
    expect(file.originalName).toBe("四宫标准数独.xlsx");
    expect(file.sizeBytes).toBeGreaterThan(0);
    expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);

    const batch = await prisma.importBatch.findFirstOrThrow({
      where: { competitionId: id, kind: "QUESTION_EXCEL" },
    });
    expect(batch.status).toBe("COMMITTED");
    expect(batch.fileId).toBe(file.id);
    expect(batch.errors).toBeNull();
  });

  it("reads back the same workbook it was given (the fixture is a real .xlsx)", async () => {
    const buffer = workbookOf(1);
    const { variantLabel, rows } = await readQuestionWorkbook(buffer);
    expect(variantLabel).toBe("四宫标准数独");
    expect(rows).toHaveLength(1);
    expect(rows[0]!["*正确答案"]).toBe(FIXTURE_ANSWER_TEXT);
    expect(rows[0]!["*给定数字"]).toBe(FIXTURE_GIVEN_TEXT);
  });
});

describe("atomic row validation (AC 2, AC 3)", () => {
  it("rejects the whole file when one row's given cells and answers overlap, naming the row", async () => {
    const { id, categoryId } = await makeCompetition(`Overlap ${suffix}`);

    const rows: FixtureRow[] = [
      validRow(),
      // Row 3 of the sheet: both columns claim the same cell.
      validRow({ "*给定数字": "[1,2,,4],\n[,4,,],\n[,,4,],\n[4,,,1]" }),
    ];
    const res = await upload(id, categoryId, buildQuestionWorkbook(rows));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("question.import.gridsNotComplementary");
    const failures = res.body.error.details.failures as { row: number; code: string }[];
    expect(failures).toHaveLength(1);
    expect(failures[0]!.row).toBe(3);
    expect(failures[0]!.code).toBe("question.import.gridsNotComplementary");

    // Nothing is committed, but the rejection is auditable: the file is kept and the
    // batch is REJECTED with the row-level errors (BLD-039, spec Detail 1).
    expect(await prisma.questionSet.count({ where: { categoryId } })).toBe(0);
    expect(await prisma.question.count({ where: { questionSet: { categoryId } } })).toBe(0);
    const batch = await prisma.importBatch.findFirstOrThrow({
      where: { competitionId: id, kind: "QUESTION_EXCEL" },
      include: { file: true },
    });
    expect(batch.status).toBe("REJECTED");
    expect(batch.file.kind).toBe("QUESTION_EXCEL");
    // The batch records the same row-level list the API returned, so the rejection can
    // be audited after the fact (BLD-039).
    expect(batch.errors).toEqual(failures);
  });

  it("rejects a row whose two columns leave a cell covered by neither", async () => {
    const { id, categoryId } = await makeCompetition(`Gap ${suffix}`);

    // The given column is well-formed, but its first row now has a gap where the
    // answer column has one too, so the two no longer cover the grid exactly once.
    const res = await upload(
      id,
      categoryId,
      buildQuestionWorkbook([
        validRow({ "*给定数字": "[,4,,],\n[,4,,],\n[,,4,],\n[4,,,1]" }),
      ]),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("question.import.gridsNotComplementary");
  });

  it("rejects a given-cells grid that isn't the shape of its dimensions", async () => {
    const { id, categoryId } = await makeCompetition(`BadGrid ${suffix}`);

    const res = await upload(
      id,
      categoryId,
      buildQuestionWorkbook([validRow({ "*给定数字": "[1,,4],\n[,4,,],\n[,,4,],\n[4,,,1]" })]),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("question.import.invalidGivenGrid");
  });

  it("rejects an irregular-variant file outright (AC 3)", async () => {
    const { id, categoryId } = await makeCompetition(`Irregular ${suffix}`);

    // BLD-045: irregular region shapes aren't extractable from the file format, so
    // the variant is refused rather than silently treated as a standard grid.
    const res = await upload(
      id,
      categoryId,
      buildQuestionWorkbook([validRow({ "*类目": "六宫不规则数独" })]),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("question.import.irregularVariantUnsupported");
    const failures = res.body.error.details.failures as { row: number; message: string }[];
    expect(failures[0]!.row).toBe(2);
    expect(failures[0]!.message).toContain("不规则");
    expect(await prisma.questionSet.count({ where: { categoryId } })).toBe(0);
  });

  it("rejects a file with no given-cells column", async () => {
    const { id, categoryId } = await makeCompetition(`NoGiven ${suffix}`);

    const headers = FIXTURE_HEADERS.filter((header) => header !== "*给定数字");
    const res = await upload(
      id,
      categoryId,
      buildQuestionWorkbook([{ ...validRow(), "*给定数字": null }], headers),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("question.import.givenColumnMissing");
  });

  it("rejects bytes that aren't a readable .xlsx", async () => {
    const { id, categoryId } = await makeCompetition(`NotExcel ${suffix}`);

    const res = await upload(id, categoryId, Buffer.from("this is not a workbook"));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("question.import.notAnExcelFile");
    expect(await prisma.storedFile.count({ where: { competitionId: id } })).toBe(0);
  });

  it("rejects a request carrying no file part", async () => {
    const { id, categoryId } = await makeCompetition(`NoFile ${suffix}`);

    const res = await authed(request(app).post(importUrl(id, categoryId))).send({
      questionIds: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("question.import.noFile");
  });

  it("rejects an import for a category of another competition", async () => {
    const first = await makeCompetition(`ScopeA ${suffix}`);
    const second = await makeCompetition(`ScopeB ${suffix}`);

    const res = await upload(second.id, first.categoryId, workbookOf(1));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("question.notFound");
  });
});

describe("the pool (AC 4)", () => {
  it("lists every imported set of one category, grouped by variant", async () => {
    const { id, categoryId } = await makeCompetition(`Pool ${suffix}`);

    const first = await upload(id, categoryId, workbookOf(2));
    expect(first.status).toBe(200);
    const second = await upload(
      id,
      categoryId,
      buildQuestionWorkbook([
        validRow({ "*类目": "四宫对角线数独", "*分数": 8 }),
      ]),
      "四宫对角线数独.xlsx",
    );
    expect(second.status).toBe(200);

    const res = await authed(request(app).get(poolUrl(id, categoryId)));

    expect(res.status).toBe(200);
    expect(res.body.categoryId).toBe(categoryId);
    expect(res.body.groups).toHaveLength(2);

    const names = res.body.groups.map((group: { questionSet: { name: string } }) =>
      group.questionSet.name,
    );
    expect(names).toEqual(["四宫标准数独", "四宫对角线数独"]);

    const standard = res.body.groups[0]!;
    expect(standard.questionSet.questionCount).toBe(2);
    expect(standard.questionSet.assignedCounts).toEqual([]);
    expect(standard.questions).toHaveLength(2);
    expect(standard.questions[0]).toEqual({
      id: standard.questions[0]!.id,
      sequence: 1,
      variantLabel: "四宫标准数独",
      gridRows: 4,
      gridColumns: 4,
      points: 5,
      roundId: null,
    });

    const diagonal = res.body.groups[1]!;
    expect(diagonal.questions[0]!.points).toBe(8);

    // A pool question carries no solution to the client — it is the answer key.
    expect(JSON.stringify(res.body)).not.toContain("solution");
  });

  it("404s for a category that isn't in this competition", async () => {
    const first = await makeCompetition(`PoolScopeA ${suffix}`);
    const second = await makeCompetition(`PoolScopeB ${suffix}`);

    const res = await authed(request(app).get(poolUrl(second.id, first.categoryId)));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("question.notFound");
  });
});

describe("selecting a round's six questions (AC 5, AC 6)", () => {
  it("assigns exactly 6 and replaces a previous selection", async () => {
    const { id, categoryId, individualRoundIds } = await makeCompetition(`Select ${suffix}`);
    const { questions } = await importQuestions(id, categoryId, 9);
    const roundId = individualRoundIds[0]!;
    const firstSix = questions.slice(0, 6).map((question) => question.id);
    const otherSix = questions.slice(3, 9).map((question) => question.id);

    const res = await authed(
      request(app).post(selectionUrl(id, categoryId, roundId)),
    ).send({ questionIds: firstSix });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ roundId, questionIds: firstSix });

    const assigned = await prisma.question.findMany({
      where: { roundId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true },
    });
    expect(assigned.map((question) => question.id)).toEqual(firstSix);
    expect(assigned.map((question) => question.sequence)).toEqual([1, 2, 3, 4, 5, 6]);

    // Re-selecting before preparation replaces the previous 6: the dropped questions
    // go back to the pool with `roundId = null` (spec Detail 5, BLD-40).
    const replaced = await authed(
      request(app).post(selectionUrl(id, categoryId, roundId)),
    ).send({ questionIds: otherSix });
    expect(replaced.status).toBe(200);

    const after = await prisma.question.findMany({
      where: { questionSet: { categoryId } },
      select: { id: true, roundId: true },
    });
    const assignedIds = after
      .filter((question) => question.roundId === roundId)
      .map((question) => question.id);
    expect(assignedIds.sort()).toEqual([...otherSix].sort());
    expect(after.filter((question) => question.roundId === null)).toHaveLength(3);
  });

  it("is recognized as complete by Unit 03's publish-readiness check (AC 5)", async () => {
    const { id, categoryId, individualRoundIds } = await makeCompetition(`Ready ${suffix}`);
    const { questions } = await importQuestions(id, categoryId, 12);

    // Before any selection the pool questions don't cover a round, so the condition
    // is unmet.
    const before = await competitionService.checkPublishReadiness(id);
    expect(before.unmet.map((condition) => condition.key)).toContain(
      "competition.readiness.questionsRequired",
    );

    const ids = questions.map((question) => question.id);
    for (const [index, roundId] of individualRoundIds.entries()) {
      const res = await authed(
        request(app).post(selectionUrl(id, categoryId, roundId)),
      ).send({ questionIds: ids.slice(index * 6, index * 6 + 6) });
      expect(res.status).toBe(200);
    }

    const after = await competitionService.checkPublishReadiness(id);
    expect(after.unmet.map((condition) => condition.key)).not.toContain(
      "competition.readiness.questionsRequired",
    );
    // Participants and judge ranges are still missing — this test is about questions.
    expect(after.ready).toBe(false);
    expect(after.unmet.map((condition) => condition.key)).toContain(
      "competition.readiness.participantsRequired",
    );
  });

  it("refuses the change once that round's preparation has begun (AC 6)", async () => {
    const { id, categoryId, individualRoundIds } = await makeCompetition(`Locked ${suffix}`);
    const { questions } = await importQuestions(id, categoryId, 6);
    const roundId = individualRoundIds[0]!;
    const ids = questions.map((question) => question.id);

    // Accepted while the round is WAITING.
    const before = await authed(
      request(app).post(selectionUrl(id, categoryId, roundId)),
    ).send({ questionIds: ids });
    expect(before.status).toBe(200);

    // The cutoff is the round's status, the same one `RoundSettings` uses
    // (RND-002/RND-004); Unit 07 flips it when preparation starts.
    await prisma.round.update({ where: { id: roundId }, data: { status: "PREPARATION" } });

    const after = await authed(
      request(app).post(selectionUrl(id, categoryId, roundId)),
    ).send({ questionIds: [...ids].reverse() });
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe("question.selection.locked");

    // The selection is unchanged.
    const assigned = await prisma.question.findMany({
      where: { roundId },
      orderBy: { sequence: "asc" },
      select: { id: true },
    });
    expect(assigned.map((question) => question.id)).toEqual(ids);
  });

  it("rejects a selection that isn't exactly 6, repeats an id, or leaves the pool", async () => {
    const { id, categoryId, individualRoundIds } = await makeCompetition(`BadSelect ${suffix}`);
    const { questions } = await importQuestions(id, categoryId, 7);
    const roundId = individualRoundIds[0]!;
    const ids = questions.map((question) => question.id);

    // A wrong-shaped body is a 400 from the route's own schema before the service is
    // reached, so it carries the generic validation code.
    for (const questionIds of [ids.slice(0, 5), ids]) {
      const res = await authed(
        request(app).post(selectionUrl(id, categoryId, roundId)),
      ).send({ questionIds });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    // The service owns the rule and re-checks it, since other callers exist (BLD-040).
    await expect(
      questionService.selectRoundQuestions({
        competitionId: id,
        categoryId,
        roundId,
        questionIds: ids, // 7 of them
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "question.selection.invalidCount" });

    const duplicated = await authed(
      request(app).post(selectionUrl(id, categoryId, roundId)),
    ).send({ questionIds: [ids[0]!, ids[0]!, ...ids.slice(1, 5)] });
    expect(duplicated.status).toBe(400);
    expect(duplicated.body.error.code).toBe("question.selection.duplicateIds");

    const foreign = await authed(
      request(app).post(selectionUrl(id, categoryId, roundId)),
    ).send({ questionIds: [...ids.slice(0, 5), "not-a-question-of-this-pool"] });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe("question.selection.notInPool");

    expect(await prisma.question.count({ where: { roundId } })).toBe(0);
  });

  it("refuses a Team round, which never holds a selection (BLD-040)", async () => {
    const { id, categoryId, teamRoundIds } = await makeCompetition(`TeamRound ${suffix}`);
    const { questions } = await importQuestions(id, categoryId, 6);

    const res = await authed(
      request(app).post(selectionUrl(id, categoryId, teamRoundIds[0]!)),
    ).send({ questionIds: questions.map((question) => question.id) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("question.selection.notIndividualRound");
  });
});

describe("controller-only access (AC 7)", () => {
  it("refuses a judge session on all three endpoints", async () => {
    const { id, categoryId, individualRoundIds } = await makeCompetition(`Forbidden ${suffix}`);
    const asJudge = (req: request.Test) =>
      req.set("x-session-token", judgeToken).set("x-device-id", judgeDevice);

    const { body, boundary } = buildUploadBody(workbookOf(1));
    const imported = await asJudge(request(app).post(importUrl(id, categoryId)))
      .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
      .send(body);
    expect(imported.status).toBe(403);
    expect(imported.body.error.code).toBe("question.forbidden");

    const pool = await asJudge(request(app).get(poolUrl(id, categoryId)));
    expect(pool.status).toBe(403);
    expect(pool.body.error.code).toBe("question.forbidden");

    const selection = await asJudge(
      request(app).post(selectionUrl(id, categoryId, individualRoundIds[0]!)),
    ).send({ questionIds: ["a", "b", "c", "d", "e", "f"] });
    expect(selection.status).toBe(403);
    expect(selection.body.error.code).toBe("question.forbidden");

    // Nothing was written by the refused import.
    expect(await prisma.storedFile.count({ where: { competitionId: id } })).toBe(0);
  });

  it("refuses a request with no session", async () => {
    const { id, categoryId } = await makeCompetition(`Anonymous ${suffix}`);

    const res = await request(app).get(poolUrl(id, categoryId));

    expect(res.status).toBe(401);
  });
});
