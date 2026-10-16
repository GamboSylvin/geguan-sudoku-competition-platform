import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

/**
 * BLD-050's hard delete (decided 2026-10-15). The point of this suite is that the
 * delete is *total*: it seeds one row into every table the delete repository claims
 * to clear, deletes, then asserts each of those tables is empty for that competition
 * and that nothing outside it was touched.
 *
 * Two assertions carry the design intent rather than just the mechanics:
 * - the `Judge` row survives (the judge list is reusable across competitions, Unit 06)
 *   while its assignment to *this* competition does not;
 * - a stored file is unlinked from disk as well as losing its row.
 *
 * Runs against the real database, like every other backend suite here.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it-del-controller-${suffix}`,
  judge: `it-del-judge-${suffix}`,
};

/** Competitions created here, so `afterAll` can clean up whatever a test left behind. */
const createdCompetitionIds: string[] = [];
/** Judges created here, deleted by name afterwards. */
const createdJudgeNames: string[] = [];

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

function authed(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

/** A competition with both categories, created through the service. */
async function makeCompetition(name: string) {
  const competition = await competitionService.createCompetition({
    name,
    categories: [
      { code: "U8", name: "Under 8" },
      { code: "U12", name: "Under 12" },
    ],
  });
  createdCompetitionIds.push(competition.id);
  return competition;
}

/**
 * Seed one row into every table `competition-delete.repository.ts` clears, so the
 * "everything is gone" assertion below is a real assertion rather than a formality
 * over tables that were already empty.
 */
async function seedEverything(competitionId: string) {
  const competition = await prisma.competition.findUniqueOrThrow({
    where: { id: competitionId },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const category = competition.categories[0]!;
  const individualRounds = (
    competition.stages.find((stage) => stage.type === "INDIVIDUAL")?.rounds ?? []
  );
  const teamRounds = (
    competition.stages.find((stage) => stage.type === "TEAM")?.rounds ?? []
  );
  const round = individualRounds[0]!;
  const teamRound = teamRounds[0]!;

  const school = await prisma.school.create({
    data: { competitionId, name: `School ${suffix}`, sequence: 1 },
  });
  const team = await prisma.team.create({
    data: { competitionId, categoryId: category.id, schoolId: school.id, name: `Team ${suffix}`, sequence: 1 },
  });
  const participant = await prisma.participant.create({
    data: {
      competitionId,
      categoryId: category.id,
      schoolId: school.id,
      teamId: team.id,
      name: `P ${suffix}`,
      participantNumber: 1,
      sequence: 1,
    },
  });

  // A player account, with a device, both scoped through the participant.
  const playerAccount = await prisma.account.create({
    data: {
      username: `it-del-player-${suffix}`,
      role: "PLAYER",
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
      participantId: participant.id,
    },
  });
  const device = await prisma.device.create({
    data: { accountId: playerAccount.id, deviceLabel: "tablet" },
  });

  const questionSet = await prisma.questionSet.create({
    data: { competitionId, categoryId: category.id, name: `Set ${suffix}` },
  });
  const question = await prisma.question.create({
    data: {
      questionSetId: questionSet.id,
      roundId: round.id,
      sequence: 1,
      points: 10,
      gridRows: 4,
      gridColumns: 4,
      regions: [[0, 1, 4, 5]],
      startingGrid: [[0]],
      solution: [[1]],
    },
  });

  const participation = await prisma.roundParticipation.create({
    data: {
      roundId: round.id,
      participantId: participant.id,
      categoryId: category.id,
      state: "SUBMITTED",
    },
  });
  const attempt = await prisma.attempt.create({
    data: {
      roundParticipationId: participation.id,
      attemptNumber: 1,
      submissionType: "MANUAL",
      score: 10,
      totalScore: 10,
    },
  });
  await prisma.answer.create({
    data: {
      attemptId: attempt.id,
      questionId: question.id,
      submittedGrid: [[1]],
      correct: true,
      pointsAwarded: 10,
    },
  });
  await prisma.individualRoundResult.create({
    data: {
      roundId: round.id,
      participantId: participant.id,
      categoryId: category.id,
      attemptId: attempt.id,
      score: 10,
      totalScore: 10,
      submissionType: "MANUAL",
    },
  });
  await prisma.teamRoundResult.create({
    data: {
      roundId: teamRound.id,
      teamId: team.id,
      categoryId: category.id,
      correctCount: 1,
      score: 10,
    },
  });
  await prisma.teamRotationState.create({
    data: { roundId: teamRound.id, teamId: team.id },
  });
  await prisma.teamPartitionState.create({
    data: { roundId: teamRound.id, teamId: team.id },
  });

  await prisma.rankingSnapshot.create({
    data: {
      competitionId,
      stageId: competition.stages[0]!.id,
      categoryId: category.id,
      scope: "INDIVIDUAL",
      payload: { rows: [] },
    },
  });
  await prisma.scoreCorrection.create({
    data: {
      competitionId,
      targetType: "PARTICIPANT",
      targetId: participant.id,
      roundId: round.id,
      oldScore: "10",
      newScore: "20",
      reason: "test correction",
    },
  });
  await prisma.auditLog.create({
    data: { competitionId, action: "test.audit", targetType: "COMPETITION", targetId: competitionId },
  });

  // A judge assignment: the assignment must go, the judge itself must not.
  const judgeName = `Judge ${suffix}`;
  createdJudgeNames.push(judgeName);
  const judge = await prisma.judge.create({ data: { name: judgeName } });
  await prisma.competitionJudgeAssignment.create({
    data: { competitionId, judgeId: judge.id, fromParticipantNumber: 1, toParticipantNumber: 1 },
  });

  // A real file on disk plus the two rows pointing at it. `ImportBatch.file` is
  // `onDelete: Restrict`, so this pair also proves the delete orders them correctly.
  const dir = await mkdtemp(join(tmpdir(), `sudoku-delete-${suffix}-`));
  const filePath = join(dir, "roster.xlsx");
  await writeFile(filePath, "not really an xlsx, but the delete does not parse it");

  const storedFile = await prisma.storedFile.create({
    data: {
      competitionId,
      kind: "PARTICIPANT_EXCEL",
      path: filePath,
      originalName: "roster.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 10,
      checksum: "test-checksum",
    },
  });
  await prisma.importBatch.create({
    data: {
      competitionId,
      kind: "PARTICIPANT_EXCEL",
      fileId: storedFile.id,
      status: "COMMITTED",
    },
  });
  await prisma.purgeSchedule.create({
    data: {
      competitionId,
      purgeAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      scope: { all: true },
    },
  });

  return {
    judge,
    judgeName,
    filePath,
    school,
    team,
    participant,
    playerAccount,
    device,
    questionSet,
    question,
    participation,
    attempt,
    round,
    teamRound,
    category,
    storedFile,
  };
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
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.judge.deleteMany({ where: { name: { in: createdJudgeNames } } });
  await prisma.account.deleteMany({
    where: { username: { in: [...Object.values(users), `it-del-player-${suffix}`] } },
  });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("DELETE /api/competitions/:id (BLD-050)", () => {
  it("removes every row scoped to the competition and unlinks its file", async () => {
    const competition = await makeCompetition(`ToDelete ${suffix}`);
    const seeded = await seedEverything(competition.id);

    // The file really is on disk before the delete, so the unlink assertion means
    // something rather than passing because the file never existed.
    await expect(readFile(seeded.filePath)).resolves.toBeTruthy();

    const res = await authed(request(app).delete(`/api/competitions/${competition.id}`)).send();
    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    // The competition and its whole structure are gone.
    expect(await prisma.competition.count({ where: { id: competition.id } })).toBe(0);
    expect(await prisma.competitionCategory.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.stage.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.round.count({ where: { stage: { competitionId: competition.id } } })).toBe(0);
    expect(
      await prisma.roundSettings.count({ where: { round: { stage: { competitionId: competition.id } } } }),
    ).toBe(0);
    expect(
      await prisma.scoringConfiguration.count({ where: { competitionId: competition.id } }),
    ).toBe(0);
    // The two 1:1 state rows cascade from the competition and are gone with it.
    expect(
      await prisma.competitionRuntimeState.count({ where: { competitionId: competition.id } }),
    ).toBe(0);
    expect(
      await prisma.bigScreenDisplayState.count({ where: { competitionId: competition.id } }),
    ).toBe(0);

    // Questions and their sets.
    expect(await prisma.questionSet.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(
      await prisma.question.count({ where: { questionSet: { competitionId: competition.id } } }),
    ).toBe(0);

    // People, their logins and their devices.
    expect(await prisma.school.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.team.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.participant.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.account.count({ where: { id: seeded.playerAccount.id } })).toBe(0);
    expect(await prisma.device.count({ where: { id: seeded.device.id } })).toBe(0);

    // Play and results.
    expect(
      await prisma.roundParticipation.count({ where: { round: { stage: { competitionId: competition.id } } } }),
    ).toBe(0);
    expect(await prisma.attempt.count({ where: { id: seeded.attempt.id } })).toBe(0);
    expect(await prisma.answer.count({ where: { attemptId: seeded.attempt.id } })).toBe(0);
    expect(
      await prisma.individualRoundResult.count({ where: { round: { stage: { competitionId: competition.id } } } }),
    ).toBe(0);
    expect(
      await prisma.teamRoundResult.count({ where: { round: { stage: { competitionId: competition.id } } } }),
    ).toBe(0);
    expect(
      await prisma.teamRotationState.count({ where: { round: { stage: { competitionId: competition.id } } } }),
    ).toBe(0);
    expect(
      await prisma.teamPartitionState.count({ where: { round: { stage: { competitionId: competition.id } } } }),
    ).toBe(0);
    expect(await prisma.rankingSnapshot.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.scoreCorrection.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { competitionId: competition.id } })).toBe(0);

    // Files and import batches: both rows gone, and the file off disk.
    expect(await prisma.importBatch.count({ where: { competitionId: competition.id } })).toBe(0);
    expect(await prisma.storedFile.count({ where: { competitionId: competition.id } })).toBe(0);
    await expect(readFile(seeded.filePath)).rejects.toThrow();
    expect(await prisma.purgeSchedule.count({ where: { competitionId: competition.id } })).toBe(0);

    // The judge assignment is gone but the judge itself survives: the judge list is
    // reusable across competitions and outlives any one of them (Unit 06).
    expect(
      await prisma.competitionJudgeAssignment.count({ where: { competitionId: competition.id } }),
    ).toBe(0);
    const judge = await prisma.judge.findUnique({ where: { id: seeded.judge.id } });
    expect(judge).not.toBeNull();
    expect(judge?.name).toBe(seeded.judgeName);
  });

  it("reports what it really removed, so the logged counts cannot read zero", async () => {
    // Regression guard. The HTTP suite above asserts every table ends up empty, which
    // it also would if a cascade quietly did the work before the explicit delete ran —
    // and then the per-table counts the service logs would say `0` for rows that did
    // exist, which is exactly the lie those counts exist to avoid. This one checks the
    // numbers instead, through the service, for the three cascade-prone chains:
    // Attempt -> Answer / IndividualRoundResult, and Participant -> Account -> Device.
    const competition = await makeCompetition(`Counts ${suffix}`);
    const seeded = await seedEverything(competition.id);

    const counts = await competitionService.deleteCompetition(competition.id);

    expect(counts.answers).toBe(1);
    expect(counts.attempts).toBe(1);
    expect(counts.individualRoundResults).toBe(1);
    expect(counts.teamRoundResults).toBe(1);
    expect(counts.roundParticipations).toBe(1);
    expect(counts.participants).toBe(1);
    expect(counts.accounts).toBe(1);
    expect(counts.devices).toBe(1);
    // The two rows this suite cares most about: the assignment counted, the judge not.
    expect(counts.judgeAssignments).toBe(1);
    expect(await prisma.judge.findUnique({ where: { id: seeded.judge.id } })).not.toBeNull();
    expect(counts.storedFiles).toBe(1);
    expect(counts.importBatches).toBe(1);
    expect(counts.competitions).toBe(1);
  });

  it("is allowed at any status — a published competition deletes just the same", async () => {
    // BLD-050 has deliberately no status gate: a day produces many throwaway
    // competitions and waiting out the 15-day purge for each is not workable.
    const competition = await makeCompetition(`PublishedThenDeleted ${suffix}`);
    await prisma.school.create({
      data: { competitionId: competition.id, name: `School ${suffix} b`, sequence: 1 },
    });
    // Publish needs participants, questions and judge ranges; the point here is only
    // the status, so the readiness data is seeded the same way the Unit 03 suite does.
    const categories = competition.categories;
    const individualRoundIds = (
      competition.stages.find((stage) => stage.type === "INDIVIDUAL")?.rounds ?? []
    ).map((round) => round.id);
    const judgeName = `Judge ${suffix} b`;
    createdJudgeNames.push(judgeName);
    const judge = await prisma.judge.create({ data: { name: judgeName } });

    let number = 0;
    for (const category of categories) {
      const school = await prisma.school.findFirstOrThrow({
        where: { competitionId: competition.id, sequence: 1 },
      });
      number += 1;
      await prisma.participant.create({
        data: {
          competitionId: competition.id,
          categoryId: category.id,
          schoolId: school.id,
          name: `P ${category.code} ${suffix} b`,
          participantNumber: number,
          sequence: number,
        },
      });
      const set = await prisma.questionSet.create({
        data: { competitionId: competition.id, categoryId: category.id, name: `Set ${category.code} ${suffix} b` },
      });
      for (const [roundIndex, roundId] of individualRoundIds.entries()) {
        for (let i = 0; i < 6; i += 1) {
          await prisma.question.create({
            data: {
              questionSetId: set.id,
              roundId,
              sequence: roundIndex * 6 + i + 1,
              points: 10,
              gridRows: 4,
              gridColumns: 4,
              regions: [[0, 1, 4, 5]],
              startingGrid: [[0]],
              solution: [[1]],
            },
          });
        }
      }
    }
    await prisma.competitionJudgeAssignment.create({
      data: { competitionId: competition.id, judgeId: judge.id, fromParticipantNumber: 1, toParticipantNumber: number },
    });
    await competitionService.publishCompetition(competition.id);
    const published = await prisma.competition.findUniqueOrThrow({ where: { id: competition.id } });
    expect(published.status).toBe("WAITING");

    const res = await authed(request(app).delete(`/api/competitions/${competition.id}`)).send();
    expect(res.status).toBe(204);
    expect(await prisma.competition.count({ where: { id: competition.id } })).toBe(0);
  });

  it("404s on an unknown id", async () => {
    const res = await authed(request(app).delete("/api/competitions/does-not-exist")).send();
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("competition.notFound");
  });

  it("refuses a judge session", async () => {
    const competition = await makeCompetition(`JudgeBlocked ${suffix}`);
    const res = await request(app)
      .delete(`/api/competitions/${competition.id}`)
      .set("x-session-token", judgeToken)
      .set("x-device-id", judgeDevice)
      .send();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("competition.forbidden");
    // Nothing was deleted.
    expect(await prisma.competition.count({ where: { id: competition.id } })).toBe(1);
  });

  it("refuses a request with no session", async () => {
    const competition = await makeCompetition(`NoSession ${suffix}`);
    const res = await request(app).delete(`/api/competitions/${competition.id}`).send();
    expect(res.status).toBe(401);
    expect(await prisma.competition.count({ where: { id: competition.id } })).toBe(1);
  });
});
