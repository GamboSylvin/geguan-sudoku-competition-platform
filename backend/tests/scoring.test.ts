import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { roundTimerService } from "../src/modules/round";
import { gameplayService } from "../src/modules/gameplay";
import { scoringService } from "../src/modules/scoring";
import { orchestratorService } from "../src/modules/orchestrator";

/**
 * Unit 08 integration tests: submission, answer check and scoring.
 *
 * Covers the eight acceptance criteria from `specs/08-submission-answer-check-and-scoring.md`:
 *   1. Manual submit, all correct, before expiry → early-finish bonus included.
 *   2. Manual submit with a wrong or blank puzzle → 0 for that puzzle, no bonus.
 *   3. Round timer expiry auto-submits every still-active participant with TIMEOUT, no bonus.
 *   4. A manual submit arriving after expiry is recorded as TIMEOUT with no distinct message.
 *   5. A repeated submit is a no-op (PL-009) — the result never changes.
 *   6. When every participant's result is finalized, the next round's preparation begins.
 *   7. A player session cannot submit on behalf of another participant.
 *   8. CI runs lint, typecheck, tests and build (covered by the test suite running at all).
 *
 * Question data is hand-transcribed (BLD-026) — Unit 05's import pipeline is not
 * built yet. The puzzle here is a 4x4 grid with a known unique solution; the
 * "correct" grid in each test equals `SOLUTION`.
 */

const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it8-controller-${suffix}`,
  playerA: `it8-player-a-${suffix}`,
  playerB: `it8-player-b-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";

const createdCompetitionIds: string[] = [];
const createdJudgeIds: string[] = [];
const createdAccountUsernames: string[] = [];

// A tiny 4x4 puzzle with a known solution. Five cells are given; the player
// fills the rest. Distinct solutions per test would be overkill — the scoring
// logic only cares about (submitted === solution).
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
  1, 9, 9, 4, // wrong cells (9s are out of range for a 4x4 but they're still "wrong")
  9, 9, 9, 9,
  9, 9, 9, 9,
  4, 9, 9, 1,
];

interface SeededCompetition {
  competitionId: string;
  stageId: string;
  roundId: string;
  round2Id: string;
  categoryId: string;
  questionId: string;
  participantId: string;
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
  // Publish readiness requires a complete selection of 6 assigned questions per
  // Individual round (BLD-040); `questionId` is sequence 1 of round 1.
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
      if (sequence === 1 && round.id === round1.id) questionId = q.id;
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
      state: "ACTIVE", // tests act as if the round started while the player was present
    },
  });

  return {
    competitionId: competition.id,
    stageId: individualStage.id,
    roundId: round1.id,
    round2Id: round2.id,
    categoryId: category.id,
    questionId,
    participantId: participant.id,
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

/**
 * Release the round timers at the end of EACH test, not only in the global `afterAll`
 * — the same fix as `team-partition.test.ts`'s.
 *
 * Why: this file starts 1200 s timers in nine places (one of them 1 s, expiring on its
 * own). Until a timer is released, its tick loop re-arms every 250 ms
 * (`round-timer.service.ts`'s `scheduleWakeup`) and each tick does a `redis.get`.
 * Without a per-test cleanup, the timers of all the previous tests stay alive and
 * accumulate until the end of the file, saturating the event loop and the Redis
 * connection — the intra-file leak already fixed at the *inter*-suite level
 * (2026-10-12) and then in `team-partition.test.ts` (2026-10-14).
 *
 * `releaseTimer` is idempotent (returns false when no Redis state is left), so
 * releasing a timer already released — by this `afterEach`, or by a test that ends its
 * own round — has no side effect. The `afterAll` stays as a safety net.
 */
afterEach(async () => {
  const rounds = await prisma.round.findMany({
    where: { stage: { competitionId: { in: createdCompetitionIds } } },
    select: { id: true },
  });
  for (const round of rounds) {
    await roundTimerService.releaseTimer(round.id).catch(() => undefined);
  }
});

function authedController(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

async function loginPlayer(username: string, participantId: string) {
  await createAccount(username, "PLAYER", participantId);
  return login("player", username);
}

describe("pure scoring rules (no I/O)", () => {
  it("gridsEqual: identical grids match; differing grids do not", () => {
    expect(scoringService.gridsEqual(SOLUTION, SOLUTION)).toBe(true);
    expect(scoringService.gridsEqual(WRONG_GRID, SOLUTION)).toBe(false);
    expect(scoringService.gridsEqual([1, 2], SOLUTION)).toBe(false); // length mismatch
    expect(scoringService.gridsEqual([], SOLUTION)).toBe(false); // blank
  });

  it("computeEarlyBonus: 3 points per whole minute early, no cap by default", () => {
    const base = {
      isIndividualStage: true,
      roundStartedAtMs: 1_000_000,
      durationSeconds: 1200, // 20 minutes
      earlyBonusRate: 3,
      earlyBonusCap: null,
      allCorrect: true,
    };
    // 5 minutes 30 seconds early → 5 whole minutes × 3 = 15
    const submittedAtMs = base.roundStartedAtMs + (1200 - 330) * 1000;
    expect(
      scoringService.computeEarlyBonus({ ...base, submissionType: "MANUAL", submittedAtMs }),
    ).toBe(15);
  });

  it("computeEarlyBonus: zero when any condition fails", () => {
    const base = {
      isIndividualStage: true,
      roundStartedAtMs: 1_000_000,
      durationSeconds: 1200,
      earlyBonusRate: 3,
      earlyBonusCap: null,
      submittedAtMs: 1_000_000 + 60_000,
      allCorrect: true,
    };
    expect(
      scoringService.computeEarlyBonus({ ...base, submissionType: "TIMEOUT" }),
    ).toBe(0);
    expect(
      scoringService.computeEarlyBonus({ ...base, submissionType: "MANUAL", isIndividualStage: false }),
    ).toBe(0);
    expect(
      scoringService.computeEarlyBonus({ ...base, submissionType: "MANUAL", allCorrect: false }),
    ).toBe(0);
    // After expiry
    expect(
      scoringService.computeEarlyBonus({
        ...base,
        submissionType: "MANUAL",
        submittedAtMs: 1_000_000 + 1_300_000,
      }),
    ).toBe(0);
    // Less than a whole minute early
    expect(
      scoringService.computeEarlyBonus({
        ...base,
        submissionType: "MANUAL",
        submittedAtMs: 1_000_000 + (1200 - 30) * 1000,
      }),
    ).toBe(0);
  });

  it("computeEarlyBonus: respects the cap when one is set", () => {
    const result = scoringService.computeEarlyBonus({
      submissionType: "MANUAL",
      isIndividualStage: true,
      roundStartedAtMs: 1_000_000,
      durationSeconds: 1200,
      earlyBonusRate: 10,
      earlyBonusCap: 12,
      allCorrect: true,
      submittedAtMs: 1_000_000 + (1200 - 600) * 1000, // 10 minutes early → would be 100, capped to 12
    });
    expect(result).toBe(12);
  });
});

describe("manual submit (acceptance criteria 1, 2, 5)", () => {
  it("a manual submit with the correct grid earns the early-finish bonus", async () => {
    const ctx = await seedCompetition(`ManualOK ${suffix}`);
    const playerLogin = await loginPlayer(users.playerA, ctx.participantId);

    // Start the round so the timer is live.
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    // Skip the 60s preparation: write the round ACTIVE directly and start the
    // round timer at 1200s so there is plenty of "minutes early" to count.
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    // The round carries a complete selection of 6 questions (BLD-040), and the
    // early-finish bonus is earned only when *every* puzzle is correct
    // (SCR-008–SCR-011), so autosave the solution for all of them.
    const questions = await prisma.question.findMany({
      where: { roundId: ctx.roundId },
      orderBy: { sequence: "asc" },
    });
    for (const question of questions) {
      await request(app)
        .post(`/api/gameplay/${ctx.roundId}/autosave`)
        .set("x-session-token", playerLogin.body.token)
        .set("x-device-id", playerLogin.body.deviceId)
        .send({ questionId: question.id, grid: SOLUTION });
    }

    const submitRes = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.accepted).toBe(true);
    expect(submitRes.body.submissionType).toBe("MANUAL");

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(participation.state).toBe("SUBMITTED");
    expect(participation.currentAttemptId).not.toBeNull();

    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
      include: { answers: true },
    });
    expect(attempt.submissionType).toBe("MANUAL");
    expect(attempt.score).toBe(60); // the round's full selection: 6 puzzles × 10 points
    expect(attempt.bonus).toBeGreaterThan(0); // ~20 minutes early × the configured rate
    expect(attempt.totalScore).toBe(attempt.score + attempt.bonus);
    expect(attempt.answers).toHaveLength(6);
    expect(attempt.answers.every((a) => a.correct)).toBe(true);
    expect(attempt.answers[0]!.pointsAwarded).toBe(10);

    const result = await prisma.individualRoundResult.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(result.totalScore).toBe(attempt.totalScore);
    expect(result.submissionType).toBe("MANUAL");
  }, 15000);

  it("a manual submit with a wrong puzzle scores 0 for that puzzle and earns no bonus", async () => {
    const ctx = await seedCompetition(`ManualWrong ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerA}-w`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: WRONG_GRID });

    const submitRes = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(submitRes.status).toBe(200);

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
    });
    expect(attempt.score).toBe(0);
    expect(attempt.bonus).toBe(0);
    expect(attempt.totalScore).toBe(0);
  }, 15000);

  it("a manual submit with no autosaved grid at all scores 0 (blank by default)", async () => {
    const ctx = await seedCompetition(`ManualBlank ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerA}-b`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    // No autosave — the player never touched the puzzle.
    const submitRes = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(submitRes.status).toBe(200);

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
      include: { answers: true },
    });
    expect(attempt.score).toBe(0);
    expect(attempt.bonus).toBe(0);
    // Every question in the round's selection gets an Answer row, blank ones included.
    expect(attempt.answers).toHaveLength(6);
    expect(attempt.answers.every((a) => a.correct === false)).toBe(true);
  }, 15000);

  it("a repeated submit is a no-op (PL-009): the result never changes", async () => {
    const ctx = await seedCompetition(`ManualTwice ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerA}-t`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: SOLUTION });

    const first = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(first.status).toBe(200);

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    const firstAttemptId = participation.currentAttemptId;
    const firstAttempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: firstAttemptId! },
    });

    // Now corrupt the grid and submit again: the second submit must not
    // overwrite the first attempt's score.
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: WRONG_GRID });
    const second = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(second.status).toBe(200);
    expect(second.body.accepted).toBe(true);

    const afterAttempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: firstAttemptId! },
    });
    expect(afterAttempt.totalScore).toBe(firstAttempt.totalScore);
    expect(afterAttempt.submissionType).toBe("MANUAL");

    // No new attempt row was created for this participation.
    const attempts = await prisma.attempt.findMany({
      where: { roundParticipationId: participation.id },
    });
    expect(attempts).toHaveLength(1);
  }, 15000);
});

describe("submit rejection cases (acceptance criterion 7)", () => {
  it("rejects a submit from a non-participant (the controller is not a player)", async () => {
    const ctx = await seedCompetition(`NotParticipant ${suffix}`);
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });

    const res = await authedController(
      request(app).post(`/api/gameplay/${ctx.roundId}/submit`),
    );
    expect(res.status).toBe(401); // requireParticipant rejects non-PLAYER roles
  });

  it("rejects a submit on a round that has not started", async () => {
    const ctx = await seedCompetition(`NotStarted ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerB}-ns`, ctx.participantId);
    const res = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("gameplay.notActive");
  });
});

describe("round-ended auto-submit (acceptance criteria 3, 4, 6)", () => {
  it("auto-submits every ACTIVE participation with TIMEOUT and finalizes the round", async () => {
    const ctx = await seedCompetition(`AutoSubmit ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerB}-auto`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    // Player autosaves a partially-correct grid.
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: WRONG_GRID });

    // Drive the round-ended path directly (the timer's own deadline test lives
    // in round.test.ts; here we exercise the listener wiring).
    await gameplayService.handleRoundEnded({
      roundId: ctx.roundId,
      stageId: ctx.stageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(participation.state).toBe("AUTO_SUBMITTED");

    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
    });
    expect(attempt.submissionType).toBe("TIMEOUT");
    expect(attempt.bonus).toBe(0);
    expect(attempt.score).toBe(0);

    // Every ACTIVE participation was finalized → the next round's preparation
    // begins automatically (acceptance criterion 6).
    const round2 = await prisma.round.findUniqueOrThrow({ where: { id: ctx.round2Id } });
    expect(round2.status).toBe("PREPARATION");
    const stage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.stageId } });
    expect(stage.status).not.toBe("FINISHED"); // stage still has round 2 to play
  }, 15000);

  it("when the round is the stage's last, the stage is marked FINISHED and no next round starts", async () => {
    const ctx = await seedCompetition(`LastRound ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerB}-last`, ctx.participantId);

    // Drive the round-ended path on round 2 (the stage's last) directly. The
    // participation row only exists for round 1, so create one for round 2.
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
    await roundTimerService.startRoundTimer(ctx.round2Id, ctx.competitionId, ctx.stageId, 1200);

    // Autosave nothing; let the timeout pick up the blank state.
    await gameplayService.handleRoundEnded({
      roundId: ctx.round2Id,
      stageId: ctx.stageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const stage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.stageId } });
    expect(stage.status).toBe("FINISHED");
    expect(stage.endedAt).not.toBeNull();

    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("STAGE_FINISHED");

    // The runtime state must not have been advanced to a non-existent round 3.
    const runtime = await prisma.competitionRuntimeState.findUniqueOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(runtime.phase).toBe("STAGE_FINISHED");

    // The round-2 participation was auto-submitted.
    const r2Participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.round2Id, participantId: ctx.participantId },
    });
    expect(r2Participation.state).toBe("AUTO_SUBMITTED");
    expect(playerLogin.body.token).toBeTruthy();
  }, 15000);

  it("a manual submit arriving after the timer expired is recorded as TIMEOUT (SUB-003)", async () => {
    const ctx = await seedCompetition(`LateSubmit ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerB}-late`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    // Start the timer with a 1-second duration, then wait past the deadline.
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1);

    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: SOLUTION });

    // Wait for the deadline to pass. The timer's tick will fire and emit
    // round-ended; the listener will also try to auto-submit. We drive submit
    // after that window — it must be a no-op if the auto-submit already ran,
    // or a TIMEOUT-recorded submit if it hasn't. Either way the recorded
    // submissionType must be TIMEOUT (or the no-op path returns the prior
    // submission's shape), never MANUAL.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const res = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
    });
    expect(attempt.submissionType).toBe("TIMEOUT");
    expect(attempt.bonus).toBe(0);
  }, 15000);
});

/**
 * Regression for the "restart + placeholder attempt" bug (the Finding of the
 * `RoundParticipation` fix): a participant restarted mid-round by a judge or by the
 * controller must NOT disappear from the ranking when the round ends without them
 * resubmitting.
 *
 * Before the fix, `archiveAndRestart` created a blank, non-archived `Attempt` row as a
 * placeholder. At the round's auto-submit sweep, `scoring.repository.ts`'s
 * `findCurrentAttempt` (`{ roundParticipationId, isArchived: false }`) found that
 * placeholder, `finalizeAttempt` took it for an already finalized submission (the PL-009
 * no-op) and returned `individualRoundResultId: ""` — so `gameplay.service.ts` never
 * triggered the ranking-refresh hook and no `IndividualRoundResult` row was ever
 * written.
 */
describe("a restarted participant still gets a real result at round end (regression)", () => {
  it("restart with no prior attempt, then round ends → an IndividualRoundResult exists", async () => {
    const ctx = await seedCompetition(`RestartBlank ${suffix}`);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    // Le juge relance le participant ; il ne resoumettra jamais.
    const restarted = await orchestratorService.restartOneParticipant({
      roundId: ctx.roundId,
      participantId: ctx.participantId,
    });
    expect(restarted.attemptCount).toBe(1);

    const afterRestart = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(afterRestart.state).toBe("ACTIVE");
    // Aucun placeholder : pas de tentative courante tant qu'il n'a pas soumis.
    expect(afterRestart.currentAttemptId).toBeNull();
    expect(
      await prisma.attempt.count({
        where: { roundParticipationId: afterRestart.id, isArchived: false },
      }),
    ).toBe(0);

    await gameplayService.handleRoundEnded({
      roundId: ctx.roundId,
      stageId: ctx.stageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(participation.state).toBe("AUTO_SUBMITTED");
    expect(participation.currentAttemptId).not.toBeNull();

    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
      include: { answers: true },
    });
    expect(attempt.isArchived).toBe(false);
    expect(attempt.submissionType).toBe("TIMEOUT");
    // Real values (zero here: no grid), not a placeholder.
    expect(attempt.score).toBe(0);
    expect(attempt.bonus).toBe(0);
    expect(attempt.totalScore).toBe(0);
    expect(attempt.answers).toHaveLength(6);

    // The participant does not fall out of the ranking: the result row exists.
    const result = await prisma.individualRoundResult.findFirst({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(result).not.toBeNull();
    expect(result!.attemptId).toBe(attempt.id);
    expect(result!.totalScore).toBe(0);
    expect(result!.submissionType).toBe("TIMEOUT");
  }, 20000);

  it("restart after a real submit archives it and the round end still writes a result", async () => {
    const ctx = await seedCompetition(`RestartAfterSubmit ${suffix}`);
    const playerLogin = await loginPlayer(`${users.playerB}-rs`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    // A first real submission creates a scored attempt.
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId)
      .send({ questionId: ctx.questionId, grid: SOLUTION });
    const firstSubmit = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(firstSubmit.status).toBe(200);

    // The judge then restarts the participant: their attempt is archived and none
    // is recreated.
    const restarted = await orchestratorService.restartOneParticipant({
      roundId: ctx.roundId,
      participantId: ctx.participantId,
    });
    expect(restarted.archivedAttemptId).not.toBeNull();

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(participation.state).toBe("ACTIVE");
    expect(participation.currentAttemptId).toBeNull();
    expect(
      await prisma.attempt.count({
        where: { roundParticipationId: participation.id, isArchived: false },
      }),
    ).toBe(0);

    // The round ends without a resubmission: the auto-submit must write a new
    // attempt (numbered 2, no gap left by a placeholder) and its
    // `IndividualRoundResult`.
    await gameplayService.handleRoundEnded({
      roundId: ctx.roundId,
      stageId: ctx.stageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const after = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(after.state).toBe("AUTO_SUBMITTED");

    const attempts = await prisma.attempt.findMany({
      where: { roundParticipationId: after.id },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.isArchived).toBe(true);
    expect(attempts[0]!.attemptNumber).toBe(1);
    expect(attempts[1]!.isArchived).toBe(false);
    expect(attempts[1]!.attemptNumber).toBe(2);
    expect(attempts[1]!.submissionType).toBe("TIMEOUT");
    expect(after.currentAttemptId).toBe(attempts[1]!.id);

    const results = await prisma.individualRoundResult.findMany({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(results).toHaveLength(2);
    const timeoutResult = results.find((r) => r.attemptId === attempts[1]!.id);
    expect(timeoutResult).toBeDefined();
    expect(timeoutResult!.submissionType).toBe("TIMEOUT");
    expect(timeoutResult!.bonus).toBe(0);
    expect(timeoutResult!.totalScore).toBe(0);
  }, 20000);
});

/**
 * Cross-category question leakage at scoring time (regression, 2026-10-15, found
 * during the project owner's manual test run — reported live as "Puzzle 1 of 12").
 *
 * `round.repository.ts`'s `listRoundQuestions` and `gameplay.service.ts`'s
 * `loadRoundForScoring` both used to read a round's questions by `roundId` alone.
 * A `Round` is shared by every category of the competition (`Stage`/`Round` are
 * per-competition, not per-category — Unit 11's own build note), so with two
 * categories sharing one round, `loadRoundForScoring` returned **12** questions —
 * the caller's own 6 plus the other category's 6, which the caller never saw and
 * has no saved grid for. Two silent consequences, neither a changed total score
 * but both real: (a) `finalizeAttempt` wrote an `Answer` row for all 12, not 6,
 * six of them `correct: false` with an empty submitted grid, for questions the
 * player was never shown — polluting the export's per-question sheet (Unit 12);
 * (b) `allCorrect = answers.every(a => a.correct)` could then never be true for
 * anyone, because the six foreign, unanswered questions always failed it — so the
 * early-finish bonus (SCR-008–SCR-011) silently dropped to 0 for every manual
 * submit, the instant a competition had more than one category. `round.test.ts`'s
 * "questions never cross a category boundary" regression covers the round-started
 * push and the reconnect/autosave paths; this covers the scoring path those two
 * don't reach.
 */
describe("cross-category question leakage does not poison scoring (regression, 2026-10-15)", () => {
  async function seedTwoCategoryCompetition(name: string): Promise<{
    competitionId: string;
    stageId: string;
    roundId: string;
    participantId: string;
    ownQuestionIds: string[];
    foreignQuestionIds: string[];
  }> {
    const competition = await competitionService.createCompetition({
      name,
      categories: [
        { code: "SA", name: "Scoring A" },
        { code: "SB", name: "Scoring B" },
      ],
    });
    createdCompetitionIds.push(competition.id);

    const full = await prisma.competition.findUniqueOrThrow({
      where: { id: competition.id },
      include: { categories: { orderBy: { sequence: "asc" } }, stages: { include: { rounds: true } } },
    });
    const [categoryA, categoryB] = full.categories;
    const individualStage = full.stages.find((s) => s.type === "INDIVIDUAL")!;
    const round1 = individualStage.rounds.find((r) => r.sequence === 1)!;
    const round2 = individualStage.rounds.find((r) => r.sequence === 2)!;

    const school = await prisma.school.create({
      data: { competitionId: competition.id, name: `ScoringSchool ${suffix}`, sequence: 1 },
    });

    const participant = await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: categoryA!.id,
        schoolId: school.id,
        name: `ScoringPlayer ${suffix}`,
        participantNumber: 1,
        sequence: 1,
      },
    });
    // Publish readiness requires every category to have at least one participant
    // (`competition.readiness.participantsRequired`) — this one is never logged in or
    // scored, it exists only so category B satisfies that condition.
    await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: categoryB!.id,
        schoolId: school.id,
        name: `ScoringPlayerB ${suffix}`,
        participantNumber: 2,
        sequence: 2,
      },
    });

    const ownQuestionIds: string[] = [];
    const foreignQuestionIds: string[] = [];
    for (const category of [categoryA!, categoryB!]) {
      const questionSet = await prisma.questionSet.create({
        data: { competitionId: competition.id, categoryId: category.id, name: `ScoringSet ${category.code} ${suffix}` },
      });
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
          if (round.id === round1.id) {
            if (category.id === categoryA!.id) ownQuestionIds.push(q.id);
            else foreignQuestionIds.push(q.id);
          }
        }
      }
    }

    const judge = await prisma.judge.create({ data: { name: `ScoringJudge ${suffix}` } });
    createdJudgeIds.push(judge.id);
    await prisma.competitionJudgeAssignment.create({
      data: {
        competitionId: competition.id,
        judgeId: judge.id,
        fromParticipantNumber: 1,
        toParticipantNumber: 2,
      },
    });

    await competitionService.publishCompetition(competition.id);

    await prisma.roundParticipation.create({
      data: {
        roundId: round1.id,
        participantId: participant.id,
        categoryId: categoryA!.id,
        state: "ACTIVE",
      },
    });

    return {
      competitionId: competition.id,
      stageId: individualStage.id,
      roundId: round1.id,
      participantId: participant.id,
      ownQuestionIds,
      foreignQuestionIds,
    };
  }

  it("scores only the player's own 6 questions, and the early-finish bonus still pays", async () => {
    const ctx = await seedTwoCategoryCompetition(`ScoringTwoCat ${suffix}`);
    const playerLogin = await loginPlayer(`it8-player-2cat-${suffix}`, ctx.participantId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({
      where: { id: ctx.roundId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.roundId, ctx.competitionId, ctx.stageId, 1200);

    // Autosave only the player's own 6 — exactly what the fixed autosave path
    // accepts (the foreign 6 would now be rejected, covered separately in
    // round.test.ts). Before the fix, `loadRoundForScoring` would still have
    // pulled in the foreign 6 as unanswered-and-wrong at finalize time, even
    // though autosave never touched them.
    for (const questionId of ctx.ownQuestionIds) {
      await request(app)
        .post(`/api/gameplay/${ctx.roundId}/autosave`)
        .set("x-session-token", playerLogin.body.token)
        .set("x-device-id", playerLogin.body.deviceId)
        .send({ questionId, grid: SOLUTION });
    }

    const submitRes = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/submit`)
      .set("x-session-token", playerLogin.body.token)
      .set("x-device-id", playerLogin.body.deviceId);
    expect(submitRes.status).toBe(200);

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: participation.currentAttemptId! },
      include: { answers: true },
    });

    // The bug's signature: 12 `Answer` rows instead of 6, six of them for
    // questions the player never saw.
    expect(attempt.answers).toHaveLength(6);
    expect(attempt.answers.map((a) => a.questionId).sort()).toEqual([...ctx.ownQuestionIds].sort());
    for (const foreignId of ctx.foreignQuestionIds) {
      expect(attempt.answers.some((a) => a.questionId === foreignId)).toBe(false);
    }

    // The bug's other consequence: `allCorrect` poisoned by the foreign
    // category's always-wrong rows, so the early-finish bonus always paid 0.
    expect(attempt.score).toBe(60);
    expect(attempt.bonus).toBeGreaterThan(0);
    expect(attempt.totalScore).toBe(attempt.score + attempt.bonus);
  }, 15000);
});
