import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { rankingService } from "../src/modules/ranking";
import { bigScreenService } from "../src/modules/big-screen";

/**
 * Unit 09 integration tests: individual ranking and big-screen ranking.
 *
 * Covers the acceptance criteria from
 * `specs/09-individual-ranking-and-big-screen-ranking.md`:
 *   1. A finalized Individual-round result updates its category's provisional
 *      ranking immediately, without waiting for other participants.
 *   2. Once every participant in a category has finished both Individual rounds,
 *      the category's final ranking is computed and stored
 *      (`RankingSnapshot`, `isFinal = true`).
 *   3. Two participants with an equal cumulative score are ordered by SCR-020's
 *      tie-break (the lower summed submission time ranks ahead); an equal score with
 *      an equal summed time is a genuine tie and shares a rank.
 *   5. Categories are never mixed in a single ranking or leaderboard.
 *   7. A big-screen connection with an invalid or stale link token is rejected.
 *   Controller-only read (ROL-002): a player session gets 403 on the ranking
 *   read; SUB-007/BLD-029 (no score/rank to a player session) is preserved.
 *
 * Criterion 4 (the timed rotation cycle) is covered by the big-screen service's
 * unit-level wiring and the gateway hook installation in `app.ts`; driving a
 * 180-second wall-clock timer through a test would be slow and flaky, so the
 * rotation's *content* (what a tick pushes) is exercised through
 * `registerConnection`'s immediate first tick instead.
 *
 * Question data is hand-transcribed (BLD-026) — Unit 05's import pipeline is
 * not built yet. The puzzle is the same 4x4 grid Unit 08's tests use.
 */

const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it9-controller-${suffix}`,
  playerA: `it9-player-a-${suffix}`,
  playerB: `it9-player-b-${suffix}`,
  playerC: `it9-player-c-${suffix}`,
  playerD: `it9-player-d-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";

const createdCompetitionIds: string[] = [];
const createdJudgeIds: string[] = [];
const createdAccountUsernames: string[] = [];

// The same tiny 4x4 puzzle Unit 08's tests use: five given cells, one known
// solution. Ranking only cares about (submitted === solution), so one puzzle
// is enough.
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

/** How long to wait for a fire-and-forget ranking recompute to land. */
const HOOK_SETTLE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SeededCompetition {
  competitionId: string;
  stageId: string;
  roundId: string;
  round2Id: string;
  categoryId: string;
  questionId: string;
  question2Id: string;
  participantId: string;
}

interface SeededMultiCategory {
  competitionId: string;
  stageId: string;
  categoryAId: string;
  categoryBId: string;
  participantAId: string;
  participantBId: string;
}

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
  participantId?: string,
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
      participantId: participantId ?? null,
    },
  });
  createdAccountUsernames.push(username);
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

  const participant = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Player ${suffix}`,
      participantNumber: 1,
      sequence: 1,
    },
  });

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });

  let questionId = "";
  let question2Id = "";
  // Publish readiness requires a complete selection of 6 assigned questions per
  // Individual round (BLD-040); `questionId`/`question2Id` point at sequence 1 of
  // each round, which is the one the gameplay calls below use.
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
      if (sequence !== 1) continue;
      if (round.id === round1.id) questionId = q.id;
      if (round.id === round2.id) question2Id = q.id;
    }
  }

  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  createdJudgeIds.push(judge.id);
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: judge.id,
      fromParticipantNumber: 1,
      toParticipantNumber: 1,
    },
  });

  await competitionService.publishCompetition(competition.id);

  await prisma.roundParticipation.create({
    data: {
      roundId: round1.id,
      participantId: participant.id,
      categoryId: category.id,
      state: "ACTIVE",
    },
  });

  return {
    competitionId: competition.id,
    stageId: individualStage.id,
    roundId: round1.id,
    round2Id: round2.id,
    categoryId: category.id,
    questionId,
    question2Id,
    participantId: participant.id,
  };
}

/**
 * A two-category competition with one participant in each, used to prove a
 * category's ranking never includes the other category's participants
 * (EVT-002). No rounds are started and no results are finalized — the ranking
 * is read directly. Publishing (and its four readiness conditions) is not
 * needed for this check, so the competition stays in DRAFT.
 */
async function seedTwoCategoryCompetition(name: string): Promise<SeededMultiCategory> {
  const competition = await competitionService.createCompetition({
    name,
    categories: [
      { code: "U8", name: "Under 8" },
      { code: "U10", name: "Under 10" },
    ],
  });
  createdCompetitionIds.push(competition.id);

  const full = await prisma.competition.findUniqueOrThrow({
    where: { id: competition.id },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const categoryA = full.categories.find((c) => c.code === "U8")!;
  const categoryB = full.categories.find((c) => c.code === "U10")!;
  const individualStage = full.stages.find((s) => s.type === "INDIVIDUAL")!;

  const school = await prisma.school.create({
    data: { competitionId: competition.id, name: `School ${suffix}`, sequence: 1 },
  });

  const participantA = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: categoryA.id,
      schoolId: school.id,
      name: `PlayerA ${suffix}`,
      participantNumber: 1,
      sequence: 1,
    },
  });
  const participantB = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: categoryB.id,
      schoolId: school.id,
      name: `PlayerB ${suffix}`,
      participantNumber: 2,
      sequence: 2,
    },
  });

  return {
    competitionId: competition.id,
    stageId: individualStage.id,
    categoryAId: categoryA.id,
    categoryBId: categoryB.id,
    participantAId: participantA.id,
    participantBId: participantB.id,
  };
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;
});

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  // A `Judge` row is not owned by any competition (only its assignment is), so
  // deleting the competition leaves it behind — remove it explicitly, in the
  // same order judge.test.ts / judge-supervision.test.ts use.
  await prisma.account.deleteMany({ where: { judgeId: { in: createdJudgeIds } } });
  await prisma.judge.deleteMany({ where: { id: { in: createdJudgeIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("pure ranking rules (no I/O)", () => {
  it("breakTie ranks the lower summed submission time ahead (SCR-020)", () => {
    const slower = {
      rank: 0,
      participantId: "p-a",
      participantName: "A",
      score: 42,
      completionTimeSeconds: 600,
    };
    const faster = {
      rank: 0,
      participantId: "p-b",
      participantName: "B",
      score: 42,
      completionTimeSeconds: 500,
    };
    expect(rankingService.breakTie(faster, slower)).toBeLessThan(0);
    expect(rankingService.breakTie(slower, faster)).toBeGreaterThan(0);
  });

  it("breakTie reports a genuine tie (0) when the summed times are equal too", () => {
    const a = { rank: 0, participantId: "p-a", participantName: "A", score: 42, completionTimeSeconds: 600 };
    const b = { rank: 0, participantId: "p-b", participantName: "B", score: 42, completionTimeSeconds: 600 };
    expect(rankingService.breakTie(a, b)).toBe(0);
    expect(rankingService.breakTie(b, a)).toBe(0);
  });
});

describe("provisional update per finalized result (acceptance criterion 1)", () => {
  it("a manual submit recomputes the category ranking immediately (provisional)", async () => {
    const ctx = await seedCompetition(`Provisional ${suffix}`);
    const playerLogin = await loginPlayer(users.playerA, ctx.participantId);

    // Mark the round ACTIVE so a manual submit records as MANUAL (the timer
    // itself is not needed for this test — submit() reads the round status).
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: SOLUTION });

    const submitRes = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.accepted).toBe(true);

    // The ranking recompute is fire-and-forget from the submission path; give
    // it a moment to land (well under the 2-second target, U-58).
    await sleep(HOOK_SETTLE_MS);

    // The provisional snapshot exists: the participant finished only round 1
    // of 2, so the ranking is not final yet.
    const snapshot = await prisma.rankingSnapshot.findFirst({
      where: { competitionId: ctx.competitionId, categoryId: ctx.categoryId, scope: "INDIVIDUAL" },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.isFinal).toBe(false);

    // The controller read recomputes from the same durable results.
    const read = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/categories/${ctx.categoryId}/ranking`),
    );
    expect(read.status).toBe(200);
    expect(read.body.isFinal).toBe(false);
    expect(read.body.rows).toHaveLength(1);
    expect(read.body.rows[0].participantId).toBe(ctx.participantId);
    expect(read.body.rows[0].rank).toBe(1);
    expect(read.body.rows[0].score).toBeGreaterThanOrEqual(10); // 10 points (+ bonus if any)
  }, 15000);
});

describe("final ranking on category completion (acceptance criterion 2)", () => {
  it("once every participant finishes both Individual rounds, the stored snapshot is final", async () => {
    const ctx = await seedCompetition(`Final ${suffix}`);
    const playerLogin = await loginPlayer(users.playerB, ctx.participantId);

    // Round 1: ACTIVE, submit correct.
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: SOLUTION });
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    await sleep(HOOK_SETTLE_MS);

    let snapshot = await prisma.rankingSnapshot.findFirst({
      where: { competitionId: ctx.competitionId, categoryId: ctx.categoryId, scope: "INDIVIDUAL" },
    });
    expect(snapshot!.isFinal).toBe(false); // round 2 not finished yet

    // Round 2: the only participant needs a participation row, then submits.
    await prisma.roundParticipation.create({
      data: {
        roundId: ctx.round2Id,
        participantId: ctx.participantId,
        categoryId: ctx.categoryId,
        state: "ACTIVE",
      },
    });
    await prisma.round.update({
      where: { id: ctx.round2Id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await request(app)
      .post(`/api/gameplay/${ctx.round2Id}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.question2Id, grid: SOLUTION });
    await request(app)
      .post(`/api/gameplay/${ctx.round2Id}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    await sleep(HOOK_SETTLE_MS);

    // The category is complete: every active participant has a finalized result
    // for both Individual rounds → the stored snapshot is final.
    snapshot = await prisma.rankingSnapshot.findFirst({
      where: { competitionId: ctx.competitionId, categoryId: ctx.categoryId, scope: "INDIVIDUAL" },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.isFinal).toBe(true);
    expect(snapshot!.stageId).toBe(ctx.stageId);

    const read = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/categories/${ctx.categoryId}/ranking`),
    );
    expect(read.status).toBe(200);
    expect(read.body.isFinal).toBe(true);
  }, 15000);
});

describe("tie handling (acceptance criterion 3, SCR-020)", () => {
  it("equal score + equal summed time shares a rank; a lower summed time ranks strictly ahead", async () => {
    const competition = await competitionService.createCompetition({
      name: `Tie ${suffix}`,
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

    // p1 and p2 finish in 600s per round (genuine tie); p3 finishes in 300s per
    // round — same score, lower summed submission time, so it must rank ahead.
    const specs = [
      { name: `TieOne ${suffix}`, number: 1, completionTimeSeconds: 600 },
      { name: `TieTwo ${suffix}`, number: 2, completionTimeSeconds: 600 },
      { name: `TieFast ${suffix}`, number: 3, completionTimeSeconds: 300 },
    ];
    const participants = [];
    for (const spec of specs) {
      participants.push(
        await prisma.participant.create({
          data: {
            competitionId: competition.id,
            categoryId: category.id,
            schoolId: school.id,
            name: spec.name,
            participantNumber: spec.number,
            sequence: spec.number,
          },
        }),
      );
    }

    // Fabricate equal finalized results directly (an attempt's early bonus is
    // time-dependent, so driving participants to an exactly equal score through the
    // submit path would be flaky). The ranking computation reads IndividualRoundResult
    // rows; equal scores with the chosen submission times are all it needs.
    for (const [index, participant] of participants.entries()) {
      const time = specs[index]!.completionTimeSeconds;
      for (const round of [round1, round2]) {
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
            submittedAt: new Date(),
            score: 10,
            bonus: 0,
            totalScore: 10,
            completionTimeSeconds: time,
          },
        });
        await prisma.roundParticipation.update({
          where: { id: participation.id },
          data: { currentAttemptId: attempt.id },
        });
        await prisma.individualRoundResult.create({
          data: {
            roundId: round.id,
            participantId: participant.id,
            categoryId: category.id,
            attemptId: attempt.id,
            score: 10,
            bonus: 0,
            totalScore: 10,
            submissionType: "MANUAL",
            submittedAt: new Date(),
            completionTimeSeconds: time,
          },
        });
      }
    }

    const ranking = await rankingService.getCategoryRanking(competition.id, category.id);
    expect(ranking).not.toBeNull();
    expect(ranking!.isFinal).toBe(true); // everyone finished both rounds
    expect(ranking!.rows).toHaveLength(3);
    for (const row of ranking!.rows) {
      expect(row.score).toBe(20);
    }

    // The faster participant is alone at rank 1 (summed 600s < 1200s).
    expect(ranking!.rows[0]!.participantId).toBe(participants[2]!.id);
    expect(ranking!.rows[0]!.rank).toBe(1);
    expect(ranking!.rows[0]!.completionTimeSeconds).toBe(600);

    // The two equal-time participants share rank 2 — a genuine tie ("1224").
    const tied = ranking!.rows.slice(1);
    expect(tied.map((row) => row.rank)).toEqual([2, 2]);
    expect(tied.every((row) => row.completionTimeSeconds === 1200)).toBe(true);
    expect(new Set(tied.map((row) => row.participantId))).toEqual(
      new Set([participants[0]!.id, participants[1]!.id]),
    );

    const snapshot = await prisma.rankingSnapshot.findFirst({
      where: { competitionId: competition.id, categoryId: category.id, scope: "INDIVIDUAL" },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.isFinal).toBe(true);
  }, 20000);
});

describe("categories are never mixed (acceptance criterion 5)", () => {
  it("a category's ranking lists only that category's participants (EVT-002)", async () => {
    const ctx = await seedTwoCategoryCompetition(`NoMix ${suffix}`);

    const rankingA = await rankingService.getCategoryRanking(ctx.competitionId, ctx.categoryAId);
    expect(rankingA).not.toBeNull();
    expect(rankingA!.rows).toHaveLength(1);
    expect(rankingA!.rows[0]!.participantId).toBe(ctx.participantAId);

    const rankingB = await rankingService.getCategoryRanking(ctx.competitionId, ctx.categoryBId);
    expect(rankingB).not.toBeNull();
    expect(rankingB!.rows).toHaveLength(1);
    expect(rankingB!.rows[0]!.participantId).toBe(ctx.participantBId);
  }, 15000);
});

describe("controller-only read (ROL-002, SUB-007/BLD-029)", () => {
  it("rejects a player session on the ranking read (403), serves the controller (200)", async () => {
    const ctx = await seedCompetition(`Guard ${suffix}`);
    const playerLogin = await loginPlayer(users.playerC, ctx.participantId);

    const playerRead = await request(app)
      .get(`/api/competitions/${ctx.competitionId}/categories/${ctx.categoryId}/ranking`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(playerRead.status).toBe(403);
    expect(playerRead.body.error.code).toBe("ranking.forbidden");

    const controllerRead = await authedController(
      request(app).get(`/api/competitions/${ctx.competitionId}/categories/${ctx.categoryId}/ranking`),
    );
    expect(controllerRead.status).toBe(200);
  }, 15000);

  it("rejects an unauthenticated read (401)", async () => {
    const ctx = await seedCompetition(`GuardAnon ${suffix}`);
    const res = await request(app).get(
      `/api/competitions/${ctx.competitionId}/categories/${ctx.categoryId}/ranking`,
    );
    expect(res.status).toBe(401);
  }, 15000);
});

describe("big-screen token gating (acceptance criterion 7, BSC-001)", () => {
  it("rejects an invalid or stale link token, resolves a real one", async () => {
    const ctx = await seedCompetition(`BigScreenAuth ${suffix}`);

    // No token at all.
    await expect(bigScreenService.authenticateBigScreen(undefined)).rejects.toMatchObject({
      code: "bigScreen.unauthorized",
    });
    // A token that matches nothing.
    await expect(
      bigScreenService.authenticateBigScreen("not-a-real-token"),
    ).rejects.toMatchObject({ code: "bigScreen.unauthorized" });

    // The competition's real big-screen link token resolves to the competition.
    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
      select: { bigScreenLinkToken: true },
    });
    const resolved = await bigScreenService.authenticateBigScreen(
      competition.bigScreenLinkToken,
    );
    expect(resolved.competitionId).toBe(ctx.competitionId);
  }, 15000);
});

describe("big-screen rotation push (acceptance criterion 4)", () => {
  it("a connecting big screen triggers an immediate push of the server-computed ranking", async () => {
    const ctx = await seedCompetition(`BigScreenPush ${suffix}`);
    const playerLogin = await loginPlayer(users.playerD, ctx.participantId);

    // Finalize one result so the pushed leaderboard has a real row.
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: WRONG_GRID });
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    await sleep(HOOK_SETTLE_MS);

    // Capture what the rotation pushes. The gateway installs the real hook at
    // app startup; this test replaces it temporarily to observe the payload.
    const pushed: {
      competitionId: string;
      categoryId: string;
      isFinal: boolean;
      rows: { participantId: string }[];
    }[] = [];
    bigScreenService.installBigScreenPushHook((payload) => {
      pushed.push(payload);
    });
    try {
      // The first connection starts the rotation and pushes the first category
      // immediately (no waiting a full cycle).
      await bigScreenService.registerConnection(ctx.competitionId);
      await sleep(HOOK_SETTLE_MS);

      expect(pushed.length).toBeGreaterThanOrEqual(1);
      const first = pushed[0]!;
      expect(first.competitionId).toBe(ctx.competitionId);
      expect(first.categoryId).toBe(ctx.categoryId);
      expect(first.isFinal).toBe(false);
      expect(first.rows).toHaveLength(1);
      expect(first.rows[0]!.participantId).toBe(ctx.participantId);
    } finally {
      bigScreenService.unregisterConnection(ctx.competitionId);
      bigScreenService.installBigScreenPushHook(() => undefined);
    }
  }, 15000);
});
