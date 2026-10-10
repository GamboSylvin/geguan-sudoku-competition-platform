import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { resultsService, purgeService, PURGE_RETENTION_DAYS, writeXlsx, gridToCellText, XLSX_MIME_TYPE } from "../src/modules/results";

/**
 * Unit 12 integration tests: results, corrections, export and the purge.
 *
 * Covers every acceptance criterion in
 * `specs/12-results-corrections-export-and-purge.md`:
 *   1. The results view lists each participant's score, bonus, total, completion
 *      time and current rank, per category and stage.
 *   2. A correction requires a reason, writes `ScoreCorrection` **and** `AuditLog`,
 *      and immediately recalculates the affected category's ranking (Unit 09).
 *   3. The export produces an `.xlsx` carrying scores, ranks and the answer per
 *      question, stored as a `StoredFile` with `kind = EXPORT`.
 *   4. Once `purgeAt` (= end + 15 days) has passed the listed data is permanently
 *      deleted while setup, questions and judges remain; a second run is a no-op.
 *   5. Results, correction and export are all rejected for a `CANCELLED`
 *      competition (ROL-009, U-31 — the gate Unit 11 deferred to this unit).
 *   6. A non-controller is rejected on all three (ROL-02).
 *   7. lint / typecheck / tests / build pass (BLD-002) — that gate is the CI run
 *      itself, not something a Jest case can assert.
 *
 * The purge's *scheduling* is exercised through the real hooks; the *deletion* is
 * driven by `purgeService.runDuePurges(now)` with an explicit clock rather than by
 * waiting 15 days.
 */

const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it12-controller-${suffix}`,
  playerA: `it12-player-a-${suffix}`,
  playerB: `it12-player-b-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";
let controllerAccountId = "";

const createdCompetitionIds: string[] = [];
const createdAccountUsernames: string[] = [];

const GRID_SIZE = 4;
const STARTING_GRID: (number | null)[] = [
  1, null, null, 4,
  null, null, null, null,
  null, null, null, null,
  4, null, null, 1,
];
const SOLUTION: (number | null)[] = [
  1, 2, 3, 4,
  3, 4, 1, 2,
  2, 1, 4, 3,
  4, 3, 2, 1,
];
const WRONG_GRID: (number | null)[] = [
  1, 9, 9, 4,
  9, 9, 9, 9,
  9, 9, 9, 9,
  4, 9, 9, 1,
];

interface SeededCompetition {
  competitionId: string;
  individualStageId: string;
  round1Id: string;
  round2Id: string;
  categoryId: string;
  questionIds: string[];
  schoolId: string;
  participantIds: string[];
}

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
  participantId?: string,
): Promise<string> {
  const account = await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
      participantId: participantId ?? null,
    },
  });
  createdAccountUsernames.push(username);
  return account.id;
}

function login(role: "controller" | "judge" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

async function loginPlayer(username: string, participantId: string) {
  await createAccount(username, "PLAYER", participantId);
  return login("player", username);
}

function authedController(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

/**
 * A published competition with one category, two participants, and a full set of 6
 * questions on each Individual round (publish readiness requires it). No results are
 * fabricated here — the caller does that through `fabricateResult` so each test
 * controls the scores.
 */
async function seedCompetition(name: string): Promise<SeededCompetition> {
  const competition = await competitionService.createCompetition({
    name,
    categories: [{ code: "U8", name: "Under 8" }],
  });
  createdCompetitionIds.push(competition.id);

  const full = await prisma.competition.findUniqueOrThrow({
    where: { id: competition.id },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const category = full.categories[0]!;
  const individualStage = full.stages.find((s) => s.type === "INDIVIDUAL")!;
  const round1 = individualStage.rounds.find((r) => r.sequence === 1)!;
  const round2 = individualStage.rounds.find((r) => r.sequence === 2)!;

  const school = await prisma.school.create({
    data: { competitionId: competition.id, name: `School ${suffix}`, sequence: 1 },
  });

  const participantIds: string[] = [];
  for (const number of [1, 2]) {
    const participant = await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        schoolId: school.id,
        name: `Player ${number} ${suffix}`,
        participantNumber: number,
        sequence: number,
      },
    });
    participantIds.push(participant.id);
  }

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });

  const questionIds: string[] = [];
  for (const round of [round1, round2]) {
    for (let sequence = 1; sequence <= 6; sequence += 1) {
      const q = await prisma.question.create({
        data: {
          questionSetId: questionSet.id,
          roundId: round.id,
          sequence,
          points: 10,
          gridRows: GRID_SIZE,
          gridColumns: GRID_SIZE,
          regions: [[0, 1, 4, 5]],
          startingGrid: STARTING_GRID,
          solution: SOLUTION,
        },
      });
      questionIds.push(q.id);
    }
  }

  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: judge.id,
      fromParticipantNumber: 1,
      toParticipantNumber: 2,
    },
  });

  await competitionService.publishCompetition(competition.id);

  return {
    competitionId: competition.id,
    individualStageId: individualStage.id,
    round1Id: round1.id,
    round2Id: round2.id,
    categoryId: category.id,
    questionIds,
    schoolId: school.id,
    participantIds,
  };
}

/**
 * Write a finalized Individual-round result the way Unit 08 does, without running a
 * round: a participation, one attempt, and the result row that points at it. The
 * answers are written too, so the export has per-question grids to show.
 */
async function fabricateResult(input: {
  ctx: SeededCompetition;
  roundId: string;
  participantId: string;
  score: number;
  bonus?: number;
  completionTimeSeconds: number;
  /** How many of the round's 6 questions were answered correctly. */
  correctCount?: number;
}): Promise<{ attemptId: string; resultId: string }> {
  const { ctx, roundId, participantId } = input;
  const bonus = input.bonus ?? 0;
  const correctCount = input.correctCount ?? 0;

  const questions = await prisma.question.findMany({
    where: { roundId },
    orderBy: { sequence: "asc" },
  });

  const participation = await prisma.roundParticipation.create({
    data: {
      roundId,
      participantId,
      categoryId: ctx.categoryId,
      state: "SUBMITTED",
    },
  });

  const attempt = await prisma.attempt.create({
    data: {
      roundParticipationId: participation.id,
      attemptNumber: 1,
      submissionType: "MANUAL",
      submittedAt: new Date(),
      score: input.score,
      bonus,
      totalScore: input.score + bonus,
      completionTimeSeconds: input.completionTimeSeconds,
    },
  });

  await prisma.roundParticipation.update({
    where: { id: participation.id },
    data: { currentAttemptId: attempt.id },
  });

  // The first `correctCount` questions are correct grids; the rest are wrong. One
  // question is left unanswered so the export's empty-cell path is exercised too.
  for (let index = 0; index < questions.length - 1; index += 1) {
    const question = questions[index]!;
    const correct = index < correctCount;
    await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        submittedGrid: correct ? SOLUTION : WRONG_GRID,
        correct,
        pointsAwarded: correct ? question.points : 0,
      },
    });
  }

  const result = await prisma.individualRoundResult.create({
    data: {
      roundId,
      participantId,
      categoryId: ctx.categoryId,
      attemptId: attempt.id,
      score: input.score,
      bonus,
      totalScore: input.score + bonus,
      submissionType: "MANUAL",
      submittedAt: new Date(),
      completionTimeSeconds: input.completionTimeSeconds,
    },
  });

  return { attemptId: attempt.id, resultId: result.id };
}

/**
 * Mark a competition finished (or cancelled) the way Unit 11's command paths do,
 * writing only the fields the retention rule reads.
 */
async function endCompetition(
  competitionId: string,
  status: "FINISHED" | "CANCELLED",
  endedAt: Date,
): Promise<void> {
  await prisma.competition.update({
    where: { id: competitionId },
    data:
      status === "FINISHED"
        ? { status, finishedAt: endedAt }
        : { status, cancelledAt: endedAt },
  });
}

beforeAll(async () => {
  controllerAccountId = await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;
});

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

// ---------------------------------------------------------------------------
// Criterion 1 — the results view
// ---------------------------------------------------------------------------

describe("the results view (criterion 1)", () => {
  it("lists score, bonus, total, completion time and current rank per category and stage", async () => {
    const ctx = await seedCompetition(`Results ${suffix}`);
    const [playerA, playerB] = ctx.participantIds as [string, string];

    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 50, bonus: 5, completionTimeSeconds: 600, correctCount: 5,
    });
    await fabricateResult({
      ctx, roundId: ctx.round2Id, participantId: playerA,
      score: 40, bonus: 0, completionTimeSeconds: 500, correctCount: 4,
    });
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerB,
      score: 60, bonus: 0, completionTimeSeconds: 700, correctCount: 6,
    });
    await fabricateResult({
      ctx, roundId: ctx.round2Id, participantId: playerB,
      score: 60, bonus: 0, completionTimeSeconds: 650, correctCount: 6,
    });

    const res = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/results`),
    );
    expect(res.status).toBe(200);
    expect(res.body.competitionId).toBe(ctx.competitionId);

    const [category] = res.body.categories as { categoryId: string; code: string; stages: unknown[] }[];
    expect(category!.code).toBe("U8");
    expect(category!.categoryId).toBe(ctx.categoryId);

    // Both stages are present, the Individual one carrying the rounds with results.
    const stages = res.body.categories[0].stages as {
      stageId: string;
      type: string;
      rounds: { roundId: string; rows: Record<string, unknown>[] }[];
    }[];
    expect(stages.map((s) => s.type).sort()).toEqual(["INDIVIDUAL", "TEAM"]);

    const individual = stages.find((s) => s.type === "INDIVIDUAL")!;
    expect(individual.rounds).toHaveLength(2);

    const round1 = individual.rounds.find((r) => r.roundId === ctx.round1Id)!;
    const rowA = round1.rows.find((r) => r.participantId === playerA)!;
    expect(rowA.score).toBe(50);
    expect(rowA.bonus).toBe(5);
    expect(rowA.totalScore).toBe(55);
    expect(rowA.completionTimeSeconds).toBe(600);
    expect(rowA.submissionType).toBe("MANUAL");
    // B scored 60 on both rounds (120 cumulative) against A's 95, so B ranks first.
    expect(rowA.rank).toBe(2);

    const rowB = round1.rows.find((r) => r.participantId === playerB)!;
    expect(rowB.totalScore).toBe(60);
    expect(rowB.rank).toBe(1);

    // The rank the screen shows is Unit 09's category leaderboard, not a recompute.
    expect(res.body.rankings[ctx.categoryId]).toHaveLength(2);
    expect(res.body.rankings[ctx.categoryId][0]).toMatchObject({
      participantId: playerB,
      rank: 1,
      score: 120,
    });
  }, 30000);

  it("shows the structure with empty rows for a competition that has no results yet", async () => {
    const ctx = await seedCompetition(`ResultsEmpty ${suffix}`);
    const res = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/results`),
    );
    expect(res.status).toBe(200);
    const individual = res.body.categories[0].stages.find(
      (s: { type: string }) => s.type === "INDIVIDUAL",
    );
    for (const round of individual.rounds) {
      expect(round.rows).toHaveLength(2);
      for (const row of round.rows) {
        expect(row.totalScore).toBeNull();
        // No score yet, but Unit 09 still ranks the whole category (participants with no
        // finalized result sit at score 0), so the current rank is always a number.
        expect(typeof row.rank).toBe("number");
      }
    }
  }, 20000);

  it("404s for a competition that does not exist", async () => {
    const res = await authedController(
      request(app).get(`/api/competitions/does-not-exist/results`),
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("results.competitionNotFound");
  }, 15000);
});

// ---------------------------------------------------------------------------
// Criterion 2 — the score correction
// ---------------------------------------------------------------------------

describe("the score correction (criterion 2)", () => {
  it("writes ScoreCorrection and AuditLog and recalculates the ranking", async () => {
    const ctx = await seedCompetition(`Correction ${suffix}`);
    const [playerA, playerB] = ctx.participantIds as [string, string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerB,
      score: 20, bonus: 0, completionTimeSeconds: 400, correctCount: 2,
    });

    const res = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 90,
      reason: "One grid was marked wrong against the stored solution.",
    });

    expect(res.status).toBe(201);
    expect(res.body.oldScore).toBe("10");
    expect(res.body.newScore).toBe("90");
    expect(res.body.reason).toBe("One grid was marked wrong against the stored solution.");

    // The correction row itself.
    const correction = await prisma.scoreCorrection.findUniqueOrThrow({
      where: { id: res.body.correctionId },
    });
    expect(correction.targetType).toBe("PARTICIPANT");
    expect(correction.targetId).toBe(playerA);
    expect(correction.roundId).toBe(ctx.round1Id);
    expect(correction.correctedByAccountId).toBe(controllerAccountId);

    // The audit row (RES-003's "the change is logged").
    const audit = await prisma.auditLog.findFirst({
      where: { competitionId: ctx.competitionId, action: "results.correction.create" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorAccountId).toBe(controllerAccountId);
    expect(audit!.payload).toMatchObject({ participantId: playerA, oldScore: 10, newScore: 90 });

    // The underlying result and its attempt were amended.
    const result = await prisma.individualRoundResult.findFirstOrThrow({
      where: { roundId: ctx.round1Id, participantId: playerA },
    });
    expect(result.totalScore).toBe(90);
    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: result.attemptId } });
    expect(attempt.totalScore).toBe(90);

    // The ranking recalculated immediately: A (90) now outranks B (20).
    expect(res.body.ranking).toHaveLength(2);
    expect(res.body.ranking[0]).toMatchObject({ participantId: playerA, rank: 1, score: 90 });
    expect(res.body.ranking[1]).toMatchObject({ participantId: playerB, rank: 2, score: 20 });

    // And the results view shows the same corrected number.
    const view = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/results`),
    );
    expect(view.status).toBe(200);
    const individual = view.body.categories[0].stages.find(
      (s: { type: string }) => s.type === "INDIVIDUAL",
    );
    const rowA = individual.rounds[0].rows.find(
      (r: { participantId: string }) => r.participantId === playerA,
    );
    expect(rowA.totalScore).toBe(90);
    expect(rowA.rank).toBe(1);
  }, 30000);

  it("rejects a correction with no reason (400)", async () => {
    const ctx = await seedCompetition(`NoReason ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });

    const missing = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 20,
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("results.reasonRequired");

    const whitespace = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 20,
      reason: "   ",
    });
    expect(whitespace.status).toBe(400);
    expect(whitespace.body.error.code).toBe("results.reasonRequired");

    const untouched = await prisma.individualRoundResult.findFirstOrThrow({
      where: { roundId: ctx.round1Id, participantId: playerA },
    });
    expect(untouched.totalScore).toBe(10);
    const corrections = await prisma.scoreCorrection.count({
      where: { competitionId: ctx.competitionId },
    });
    expect(corrections).toBe(0);
  }, 30000);

  it("rejects a TEAM or SCHOOL target (400) — not a gap, the spec's Error Cases", async () => {
    const ctx = await seedCompetition(`TeamTarget ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });

    for (const targetType of ["TEAM", "SCHOOL"]) {
      const res = await authedController(
        request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
      ).send({
        targetType,
        targetId: "whatever",
        roundId: ctx.round1Id,
        newScore: 30,
        reason: "A team correction that cannot exist yet.",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("results.unsupportedTargetType");
    }
    const corrections = await prisma.scoreCorrection.count({
      where: { competitionId: ctx.competitionId },
    });
    expect(corrections).toBe(0);
  }, 30000);

  it("rejects a negative or fractional score (400)", async () => {
    const ctx = await seedCompetition(`BadScore ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });

    const negative = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: -1,
      reason: "Negative.",
    });
    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe("results.invalidScore");

    const fractional = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 12.5,
      reason: "Fractional.",
    });
    expect(fractional.status).toBe(400);
    expect(fractional.body.error.code).toBe("results.invalidScore");
  }, 30000);

  it("rejects a participant with no result in that round (422)", async () => {
    const ctx = await seedCompetition(`NoResult ${suffix}`);
    const [, playerB] = ctx.participantIds as [string, string];

    const res = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerB,
      roundId: ctx.round1Id,
      newScore: 30,
      reason: "There is nothing to correct.",
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("results.resultNotFound");
  }, 3000);

  it("rejects a round that belongs to another competition (404)", async () => {
    const ctx = await seedCompetition(`ForeignRound ${suffix}`);
    const other = await seedCompetition(`OtherCompetition ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });

    const res = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: other.round1Id,
      newScore: 30,
      reason: "Wrong competition's round.",
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("results.roundNotFound");
  }, 30000);

  it("lists the correction history beside the results", async () => {
    const ctx = await seedCompetition(`History ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });

    await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 40,
      reason: "First correction.",
    });
    await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 70,
      reason: "Second correction.",
    });

    const res = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/corrections`),
    );
    expect(res.status).toBe(200);
    expect(res.body.competitionId).toBe(ctx.competitionId);
    expect(res.body.corrections).toHaveLength(2);
    // The change log is newest first (the repository's documented order).
    expect(res.body.corrections.map((c: { reason: string }) => c.reason)).toEqual([
      "Second correction.",
      "First correction.",
    ]);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Criterion 3 — the export
// ---------------------------------------------------------------------------

describe("the export (criterion 3)", () => {
  it("streams an .xlsx and records it as a StoredFile with kind EXPORT", async () => {
    const ctx = await seedCompetition(`Export ${suffix}`);
    const [playerA, playerB] = ctx.participantIds as [string, string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 50, bonus: 5, completionTimeSeconds: 600, correctCount: 5,
    });
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerB,
      score: 30, bonus: 0, completionTimeSeconds: 500, correctCount: 3,
    });

    const res = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/export`).buffer().parse(
        (r, callback) => {
          const chunks: Buffer[] = [];
          r.on("data", (chunk: Buffer) => chunks.push(chunk));
          r.on("end", () => callback(null, Buffer.concat(chunks)));
        },
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain(XLSX_MIME_TYPE);
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="results-.*\.xlsx"$/);

    const body = res.body as Buffer;
    expect(body.length).toBeGreaterThan(0);
    expect(Number(res.headers["content-length"])).toBe(body.length);
    // A zip's local-file-header signature, then the OPC content-types part name.
    expect(body.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(body.includes(Buffer.from("[Content_Types].xml"))).toBe(true);

    const stored = await prisma.storedFile.findFirstOrThrow({
      where: { competitionId: ctx.competitionId, kind: "EXPORT" },
    });
    expect(stored.sizeBytes).toBe(body.length);
    expect(stored.mimeType).toBe(XLSX_MIME_TYPE);
    expect(stored.originalName).toMatch(/^results-.*\.xlsx$/);
    expect(stored.checksum).toMatch(/^[0-9a-f]{64}$/);

    const audit = await prisma.auditLog.findFirst({
      where: { competitionId: ctx.competitionId, action: "results.export.create" },
    });
    expect(audit).not.toBeNull();

    // The file really is on disk and re-downloadable by its id.
    const again = await authedController(
      request(app)
        .get(`/api/competitions/${ctx.competitionId}/export`)
        .query({ fileId: stored.id })
        .buffer()
        .parse((r, callback) => {
          const chunks: Buffer[] = [];
          r.on("data", (chunk: Buffer) => chunks.push(chunk));
          r.on("end", () => callback(null, Buffer.concat(chunks)));
        }),
    );
    expect(again.status).toBe(200);
    expect((again.body as Buffer).equals(body)).toBe(true);
  }, 30000);

  it("reflects a correction in a fresh export", async () => {
    const ctx = await seedCompetition(`ExportCorrected ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });

    const first = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/export`).buffer().parse(
        (r, callback) => {
          const chunks: Buffer[] = [];
          r.on("data", (chunk: Buffer) => chunks.push(chunk));
          r.on("end", () => callback(null, Buffer.concat(chunks)));
        },
      ),
    );
    expect(first.status).toBe(200);

    await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 99,
      reason: "Stored solution was wrong.",
    });

    const second = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/export`).buffer().parse(
        (r, callback) => {
          const chunks: Buffer[] = [];
          r.on("data", (chunk: Buffer) => chunks.push(chunk));
          r.on("end", () => callback(null, Buffer.concat(chunks)));
        },
      ),
    );
    expect(second.status).toBe(200);
    expect((second.body as Buffer).equals(first.body as Buffer)).toBe(false);

    const count = await prisma.storedFile.count({
      where: { competitionId: ctx.competitionId, kind: "EXPORT" },
    });
    expect(count).toBe(2);
  }, 30000);
});

// ---------------------------------------------------------------------------
// The writer itself: a zip the reader can open, with the required contents
// ---------------------------------------------------------------------------

describe("the zero-dependency .xlsx writer", () => {
  it("writes an OPC zip whose sheets inflate back to the cells that went in", async () => {
    const { inflateRawSync } = await import("node:zlib");
    const bytes = writeXlsx([
      { name: "Scores U8", rows: [["Rank", "Name"], [1, "Player <1>"], [2, null]] },
      { name: "Answers U8", rows: [["R1Q1"], ["1,2,3,4,3,4,1,2,2,1,4,3,4,3,2,1"]] },
    ]);

    expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");

    // Walk the local file headers, inflating each part — the same traversal Unit 05's
    // reader performs, which is what makes this a real round-trip check.
    const parts = new Map<string, string>();
    let offset = 0;
    while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
      const method = bytes.readUInt16LE(offset + 8);
      const compressedSize = bytes.readUInt32LE(offset + 18);
      const nameLength = bytes.readUInt16LE(offset + 26);
      const extraLength = bytes.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
      const dataStart = nameStart + nameLength + extraLength;
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      parts.set(name, method === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8"));
      offset = dataStart + compressedSize;
    }

    expect(parts.has("[Content_Types].xml")).toBe(true);
    expect(parts.has("_rels/.rels")).toBe(true);
    expect(parts.has("xl/workbook.xml")).toBe(true);
    expect(parts.has("xl/_rels/workbook.xml.rels")).toBe(true);
    expect(parts.has("xl/worksheets/sheet1.xml")).toBe(true);
    expect(parts.has("xl/worksheets/sheet2.xml")).toBe(true);

    // The content-types part must close properly (the off-by-one this guards against
    // would chop the final Override's closing slash).
    const contentTypes = parts.get("[Content_Types].xml")!;
    expect(contentTypes.endsWith("</Types>")).toBe(true);
    expect(contentTypes).toContain("/xl/worksheets/sheet2.xml");
    expect(contentTypes).not.toContain("//>");

    const workbook = parts.get("xl/workbook.xml")!;
    expect(workbook).toContain('name="Scores U8"');
    expect(workbook).toContain('name="Answers U8"');

    const sheet1 = parts.get("xl/worksheets/sheet1.xml")!;
    expect(sheet1).toContain("<v>1</v>");
    expect(sheet1).toContain("Player &lt;1&gt;");
    expect(sheet1.endsWith("</worksheet>")).toBe(true);
  }, 20000);

  it("gridToCellText renders a grid as a comma-joined row-major list", () => {
    expect(gridToCellText(SOLUTION)).toBe("1,2,3,4,3,4,1,2,2,1,4,3,4,3,2,1");
    expect(gridToCellText(WRONG_GRID)).toBe("1,9,9,4,9,9,9,9,9,9,9,9,4,9,9,1");
    expect(gridToCellText([1, null, 3])).toBe("1,,3");
    expect(gridToCellText(null)).toBe("");
    expect(gridToCellText("not a grid")).toBe("");
  });

  it("sanitises a sheet name that Excel would reject", async () => {
    const { inflateRawSync } = await import("node:zlib");
    const bytes = writeXlsx([{ name: "A/Very:Long*Name?[That]Overflows", rows: [["x"]] }]);
    let offset = 0;
    let workbookXml = "";
    while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
      const method = bytes.readUInt16LE(offset + 8);
      const compressedSize = bytes.readUInt32LE(offset + 18);
      const nameLength = bytes.readUInt16LE(offset + 26);
      const extraLength = bytes.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
      const dataStart = nameStart + nameLength + extraLength;
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      const text = method === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8");
      if (name === "xl/workbook.xml") workbookXml = text;
      offset = dataStart + compressedSize;
    }
    const match = /name="([^"]*)"/.exec(workbookXml);
    expect(match).not.toBeNull();
    const sheetName = match![1]!;
    expect(sheetName.length).toBeLessThanOrEqual(31);
    expect(sheetName).not.toMatch(/[\\/?*[\]:]/);
  });
});

// ---------------------------------------------------------------------------
// Criterion 4 — the purge
// ---------------------------------------------------------------------------

describe("the 15-day purge (criterion 4)", () => {
  it("computes purgeAt as the end plus 15 days, from finishedAt or cancelledAt", () => {
    const finished = new Date("2026-10-08T09:00:00.000Z");
    const expected = new Date("2026-10-23T09:00:00.000Z");
    expect(PURGE_RETENTION_DAYS).toBe(15);
    expect(resultsService.computePurgeAt(finished).toISOString()).toBe(expected.toISOString());
  });

  it("deletes every student-identifying row and keeps setup, questions and judges", async () => {
    const ctx = await seedCompetition(`Purge ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    const { attemptId } = await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 50, bonus: 5, completionTimeSeconds: 600, correctCount: 5,
    });

    // A student account and its device, the way Unit 02/04 produce them.
    const studentUsername = `it12-student-${suffix}`;
    const studentAccountId = await createAccount(studentUsername, "PLAYER", playerA);
    const device = await prisma.device.create({
      data: { accountId: studentAccountId, deviceLabel: "Tablet 1" },
    });

    // A question-Excel StoredFile (kept) and a participant-Excel one (deleted), plus
    // the ImportBatch that restricts the latter's deletion.
    const questionFile = await prisma.storedFile.create({
      data: {
        competitionId: ctx.competitionId,
        kind: "QUESTION_EXCEL",
        path: `/tmp/${suffix}-questions.xlsx`,
        originalName: "questions.xlsx",
        mimeType: XLSX_MIME_TYPE,
        sizeBytes: 10,
        checksum: "a".repeat(64),
      },
    });
    const participantFile = await prisma.storedFile.create({
      data: {
        competitionId: ctx.competitionId,
        kind: "PARTICIPANT_EXCEL",
        path: `/tmp/${suffix}-participants.xlsx`,
        originalName: "participants.xlsx",
        mimeType: XLSX_MIME_TYPE,
        sizeBytes: 10,
        checksum: "b".repeat(64),
      },
    });
    await prisma.importBatch.create({
      data: {
        competitionId: ctx.competitionId,
        kind: "PARTICIPANT_EXCEL",
        fileId: participantFile.id,
        status: "COMMITTED",
      },
    });

    // A judge account with a competition assignment — both must survive.
    const judge = await prisma.judge.findFirstOrThrow({
      where: { assignments: { some: { competitionId: ctx.competitionId } } },
    });
    const judgeUsername = `it12-judge-${suffix}`;
    const judgeAccount = await prisma.account.create({
      data: {
        username: judgeUsername,
        role: "JUDGE",
        isActive: true,
        judgeId: judge.id,
        passwordHash: await identityService.hashPassword(PASSWORD),
      },
    });
    createdAccountUsernames.push(judgeUsername);

    const correction = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 45,
      reason: "Corrected before the purge.",
    });
    expect(correction.status).toBe(201);

    const endedAt = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);
    await endCompetition(ctx.competitionId, "FINISHED", endedAt);

    // The results read creates the schedule (that is how the screen gets its date).
    const view = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/results`),
    );
    expect(view.status).toBe(200);
    expect(view.body.purge).not.toBeNull();
    expect(view.body.purge.status).toBe("SCHEDULED");
    expect(new Date(view.body.purge.purgeAt as string).getTime()).toBe(
      endedAt.getTime() + PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const purged = await purgeService.runDuePurges(new Date());
    expect(purged.map((p) => p.competitionId)).toContain(ctx.competitionId);
    const run = purged.find((p) => p.competitionId === ctx.competitionId)!;
    expect(run.deleted.answers).toBeGreaterThan(0);
    expect(run.deleted.attempts).toBe(1);
    expect(run.deleted.individualResults).toBe(1);
    expect(run.deleted.scoreCorrections).toBe(1);
    expect(run.deleted.auditLogs).toBeGreaterThan(0);
    expect(run.deleted.participants).toBe(2);
    expect(run.deleted.accounts).toBe(1);
    expect(run.deleted.devices).toBe(1);
    expect(run.deleted.storedFiles).toBe(1);

    // --- gone ---
    expect(await prisma.answer.count({ where: { attemptId } })).toBe(0);
    expect(await prisma.attempt.count({ where: { id: attemptId } })).toBe(0);
    expect(
      await prisma.individualRoundResult.count({
        where: { round: { stage: { competitionId: ctx.competitionId } } },
      }),
    ).toBe(0);
    expect(
      await prisma.roundParticipation.count({
        where: { round: { stage: { competitionId: ctx.competitionId } } },
      }),
    ).toBe(0);
    expect(await prisma.scoreCorrection.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
    expect(await prisma.rankingSnapshot.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
    expect(await prisma.participant.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
    expect(await prisma.account.count({ where: { id: studentAccountId } })).toBe(0);
    expect(await prisma.device.count({ where: { id: device.id } })).toBe(0);
    expect(await prisma.storedFile.count({ where: { id: participantFile.id } })).toBe(0);
    expect(
      await prisma.importBatch.count({ where: { competitionId: ctx.competitionId } }),
    ).toBe(0);

    // --- kept ---
    expect(await prisma.competition.count({ where: { id: ctx.competitionId } })).toBe(1);
    expect(await prisma.stage.count({ where: { competitionId: ctx.competitionId } })).toBe(2);
    expect(await prisma.round.count({ where: { stage: { competitionId: ctx.competitionId } } })).toBe(4);
    expect(
      await prisma.roundSettings.count({
        where: { round: { stage: { competitionId: ctx.competitionId } } },
      }),
    ).toBe(4);
    expect(await prisma.scoringConfiguration.count({ where: { competitionId: ctx.competitionId } })).toBe(1);
    expect(await prisma.questionSet.count({ where: { competitionId: ctx.competitionId } })).toBe(1);
    expect(await prisma.question.count({ where: { roundId: ctx.round1Id } })).toBe(6);
    expect(await prisma.storedFile.count({ where: { id: questionFile.id } })).toBe(1);
    expect(await prisma.judge.count({ where: { id: judge.id } })).toBe(1);
    expect(await prisma.account.count({ where: { id: judgeAccount.id } })).toBe(1);
    expect(
      await prisma.competitionJudgeAssignment.count({ where: { competitionId: ctx.competitionId } }),
    ).toBe(1);

    // --- the schedule is marked EXECUTED, and a second run is a no-op ---
    const schedule = await prisma.purgeSchedule.findFirstOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(schedule.status).toBe("EXECUTED");
    expect(schedule.executedAt).not.toBeNull();

    const secondRun = await purgeService.runDuePurges(new Date());
    expect(secondRun.find((p) => p.competitionId === ctx.competitionId)).toBeUndefined();
    expect(await prisma.competition.count({ where: { id: ctx.competitionId } })).toBe(1);
  }, 60000);

  it("leaves a competition that has not reached its date untouched", async () => {
    const ctx = await seedCompetition(`PurgeEarly ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });
    await endCompetition(ctx.competitionId, "FINISHED", new Date());

    const schedule = await resultsService.ensurePurgeScheduled(ctx.competitionId);
    expect(schedule).not.toBeNull();
    expect(schedule!.status).toBe("SCHEDULED");

    await purgeService.runDuePurges(new Date());

    expect(await prisma.participant.count({ where: { competitionId: ctx.competitionId } })).toBe(2);
    expect(
      await prisma.individualRoundResult.count({
        where: { round: { stage: { competitionId: ctx.competitionId } } },
      }),
    ).toBe(1);
    const after = await prisma.purgeSchedule.findFirstOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(after.status).toBe("SCHEDULED");
    expect(after.executedAt).toBeNull();
  }, 30000);

  it("never purges a competition that is still running, even with a stray due schedule", async () => {
    const ctx = await seedCompetition(`PurgeRunning ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });
    // A schedule in the past, but the competition is only PUBLISHED.
    await prisma.purgeSchedule.create({
      data: {
        competitionId: ctx.competitionId,
        purgeAt: new Date(Date.now() - 60_000),
        scope: {},
        status: "SCHEDULED",
      },
    });

    const result = await purgeService.purgeOne(ctx.competitionId, new Date());
    expect(result).toBeNull();
    expect(await prisma.participant.count({ where: { competitionId: ctx.competitionId } })).toBe(2);
    const schedule = await prisma.purgeSchedule.findFirstOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(schedule.status).toBe("SCHEDULED");
  }, 30000);

  it("back-fills the schedule for a competition that ended before this unit existed", async () => {
    const ctx = await seedCompetition(`PurgeBackfill ${suffix}`);
    const cancelledAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    await endCompetition(ctx.competitionId, "CANCELLED", cancelledAt);
    expect(await prisma.purgeSchedule.count({ where: { competitionId: ctx.competitionId } })).toBe(0);

    // The tick's back-fill is the only thing that can create this schedule: no hook
    // fired, because the competition was marked cancelled directly.
    await purgeService.runDuePurges(new Date(cancelledAt.getTime() + 60_000));

    const schedule = await prisma.purgeSchedule.findFirstOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(schedule.status).toBe("SCHEDULED");
    expect(schedule.purgeAt.getTime()).toBe(
      cancelledAt.getTime() + PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    // And once the date passes, the cancelled competition is purged too.
    await purgeService.runDuePurges(new Date());
    const after = await prisma.purgeSchedule.findFirstOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(after.status).toBe("EXECUTED");
    expect(await prisma.participant.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
  }, 30000);

  it("exposes no purge endpoint (the spec's Security Considerations)", async () => {
    const ctx = await seedCompetition(`NoEndpoint ${suffix}`);
    const post = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/purge`),
    );
    expect([404, 405]).toContain(post.status);
    const del = await authedController(
      request(app).delete(`/api/competitions/${ctx.competitionId}/purge`),
    );
    expect([404, 405]).toContain(del.status);
    expect(await prisma.participant.count({ where: { competitionId: ctx.competitionId } })).toBe(2);
  }, 2000);
});

// ---------------------------------------------------------------------------
// Criterion 5 — a cancelled competition releases nothing (ROL-009, U-31)
// ---------------------------------------------------------------------------

describe("the cancelled gate (criterion 5, deferred by Unit 11)", () => {
  it("rejects results, corrections and export for a CANCELLED competition", async () => {
    const ctx = await seedCompetition(`Cancelled ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });
    await endCompetition(ctx.competitionId, "CANCELLED", new Date());

    const results = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/results`),
    );
    expect(results.status).toBe(403);
    expect(results.body.error.code).toBe("results.competitionCancelled");

    const corrections = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/corrections`),
    );
    expect(corrections.status).toBe(403);
    expect(corrections.body.error.code).toBe("results.competitionCancelled");

    const correction = await authedController(
      request(app).post(`/api/competitions/${ctx.competitionId}/corrections`),
    ).send({
      targetType: "PARTICIPANT",
      targetId: playerA,
      roundId: ctx.round1Id,
      newScore: 99,
      reason: "Should not land.",
    });
    expect(correction.status).toBe(403);
    expect(correction.body.error.code).toBe("results.competitionCancelled");

    const exported = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/export`),
    );
    expect(exported.status).toBe(403);
    expect(exported.body.error.code).toBe("results.competitionCancelled");

    // Nothing was written behind the gate.
    const result = await prisma.individualRoundResult.findFirstOrThrow({
      where: { roundId: ctx.round1Id, participantId: playerA },
    });
    expect(result.totalScore).toBe(10);
    expect(await prisma.scoreCorrection.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
  }, 30000);

  it("serves results for a competition that finished early", async () => {
    const ctx = await seedCompetition(`FinishedEarly ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    await fabricateResult({
      ctx, roundId: ctx.round1Id, participantId: playerA,
      score: 10, bonus: 0, completionTimeSeconds: 300, correctCount: 1,
    });
    await prisma.competition.update({
      where: { id: ctx.competitionId },
      data: { status: "FINISHED", finishedEarly: true, finishedAt: new Date() },
    });

    const res = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/results`),
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINISHED");
    expect(res.body.finishedEarly).toBe(true);
    expect(res.body.purge).not.toBeNull();
  }, 30000);
});

// ---------------------------------------------------------------------------
// Criterion 6 — controller-only (ROL-002)
// ---------------------------------------------------------------------------

describe("controller-only access (criterion 6)", () => {
  it("rejects a player session on all three endpoints (403)", async () => {
    const ctx = await seedCompetition(`Guard ${suffix}`);
    const [playerA] = ctx.participantIds as [string];
    const playerLogin = await loginPlayer(users.playerA, playerA);

    const headers = {
      "x-session-token": playerLogin.body.token as string,
      "x-device-id": playerLogin.body.deviceId as string,
    };

    const results = await request(app)
      .get(`/api/competitions/${ctx.competitionId}/results`)
      .set(headers);
    expect(results.status).toBe(403);
    expect(results.body.error.code).toBe("results.forbidden");

    const correction = await request(app)
      .post(`/api/competitions/${ctx.competitionId}/corrections`)
      .set(headers)
      .send({
        targetType: "PARTICIPANT",
        targetId: playerA,
        roundId: ctx.round1Id,
        newScore: 99,
        reason: "A player must not be able to correct a score.",
      });
    expect(correction.status).toBe(403);
    expect(correction.body.error.code).toBe("results.forbidden");

    const exported = await request(app)
      .get(`/api/competitions/${ctx.competitionId}/export`)
      .set(headers);
    expect(exported.status).toBe(403);
    expect(exported.body.error.code).toBe("results.forbidden");

    expect(await prisma.scoreCorrection.count({ where: { competitionId: ctx.competitionId } })).toBe(0);
  }, 30000);

  it("rejects a judge session on all three endpoints (403)", async () => {
    const ctx = await seedCompetition(`GuardJudge ${suffix}`);
    const judge = await prisma.judge.findFirstOrThrow({
      where: { assignments: { some: { competitionId: ctx.competitionId } } },
    });
    const judgeUsername = `it12-guard-judge-${suffix}`;
    await prisma.account.create({
      data: {
        username: judgeUsername,
        role: "JUDGE",
        isActive: true,
        judgeId: judge.id,
        passwordHash: await identityService.hashPassword(PASSWORD),
      },
    });
    createdAccountUsernames.push(judgeUsername);
    const judgeLogin = await login("judge", judgeUsername);

    const headers = {
      "x-session-token": judgeLogin.body.token as string,
      "x-device-id": judgeLogin.body.deviceId as string,
    };

    expect((await request(app).get(`/api/competitions/${ctx.competitionId}/results`).set(headers)).status).toBe(403);
    expect((await request(app).get(`/api/competitions/${ctx.competitionId}/export`).set(headers)).status).toBe(403);
    const correction = await request(app)
      .post(`/api/competitions/${ctx.competitionId}/corrections`)
      .set(headers)
      .send({
        targetType: "PARTICIPANT",
        targetId: ctx.participantIds[0],
        roundId: ctx.round1Id,
        newScore: 5,
        reason: "A judge must not be able to correct a score.",
      });
    expect(correction.status).toBe(403);
  }, 30000);

  it("rejects an unauthenticated request on all three endpoints (401)", async () => {
    const ctx = await seedCompetition(`GuardAnon ${suffix}`);
    expect((await request(app).get(`/api/competitions/${ctx.competitionId}/results`)).status).toBe(401);
    expect((await request(app).get(`/api/competitions/${ctx.competitionId}/export`)).status).toBe(401);
    expect(
      (
        await request(app)
          .post(`/api/competitions/${ctx.competitionId}/corrections`)
          .send({
            targetType: "PARTICIPANT",
            targetId: ctx.participantIds[0],
            roundId: ctx.round1Id,
            newScore: 5,
            reason: "Anonymous.",
          })
      ).status,
    ).toBe(401);
  }, 20000);
});

// ---------------------------------------------------------------------------
// i18n: every results code resolves in both catalogues
// ---------------------------------------------------------------------------

describe("the results i18n keys", () => {
  it("resolves every results code in English and Chinese", async () => {
    const { translate } = await import("../src/shared/i18n");
    const codes = [
      "results.forbidden",
      "results.competitionNotFound",
      "results.competitionCancelled",
      "results.reasonRequired",
      "results.unsupportedTargetType",
      "results.resultNotFound",
      "results.roundNotFound",
      "results.invalidScore",
    ];
    for (const code of codes) {
      const en = translate("en", code);
      const zh = translate("zh", code);
      expect(en).not.toBe(code);
      expect(zh).not.toBe(code);
      expect(en.length).toBeGreaterThan(0);
      expect(zh.length).toBeGreaterThan(0);
      expect(zh).not.toBe(en);
    }
  });
});
