import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { roundTimerService } from "../src/modules/round";

/**
 * Unit 07 integration tests: the dev-only internal trigger that starts stage 1
 * round 1's preparation (spec step 7), the preparation countdown locking at the
 * configured value (RND-002/004), the participant-scoped autosave (accepts the
 * player's own grid while ACTIVE; rejects everything else), and the reconnect
 * state read. They run against the real database and Redis the CI provisions;
 * everything created here is removed afterwards.
 *
 * The timer service is exercised directly (`roundTimerService.pause`,
 * `roundTimerService.resume`, `roundTimerService.remaining`) — those functions
 * are the narrow public surface Unit 11 will call (spec Implementation Detail 3).
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it7-controller-${suffix}`,
  judge: `it7-judge-${suffix}`,
  playerA: `it7-player-a-${suffix}`,
  playerB: `it7-player-b-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";
let playerAToken = "";
let playerADevice = "";
let playerBToken = "";
let playerBDevice = "";

const createdCompetitionIds: string[] = [];
const createdJudgeIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdSchoolIds: string[] = [];

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
}

function login(role: "controller" | "judge" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

/**
 * A published (WAITING) competition with one participant and one question on
 * stage 1 round 1 — the minimum the dev trigger and the gameplay endpoints
 * need. Scratch data, same pattern as Unit 03's tests.
 *
 * `options`:
 *   - `seedParticipation` (default true) — hand-seed the `RoundParticipation`
 *     row, the way the pre-fix tests had to because nothing created it. The
 *     regression tests below pass **false** so the round has to create it
 *     itself through the real timer path.
 *   - `preparationSeconds` / `durationSeconds` — shorten the two timers so a
 *     test can watch a whole round start *and* end in a couple of seconds.
 */
async function makePublishedCompetition(
  name: string,
  options: {
    seedParticipation?: boolean;
    preparationSeconds?: number;
    durationSeconds?: number;
  } = {},
) {
  const { seedParticipation = true, preparationSeconds, durationSeconds } = options;
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

  const school = await prisma.school.create({
    data: { competitionId: competition.id, name: `School ${suffix}`, sequence: 1 },
  });
  createdSchoolIds.push(school.id);

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
  createdParticipantIds.push(participant.id);

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });
  // A 4x4 puzzle with 16 cells, a few of them given. Publish readiness (spec
  // Unit 03) demands a question on *both* Individual rounds, so seed round 2
  // too — only round 1's is ever exercised by these tests.
  const round2 = individualStage.rounds.find((r) => r.sequence === 2)!;
  const startingGrid: (number | null)[] = [
    1, null, null, 4,
    null, null, null, null,
    null, null, null, null,
    4, null, null, 1,
  ];
  // Publish readiness requires a complete selection of 6 assigned questions per
  // Individual round (BLD-040), so seed the full 6 for each round.
  for (const round of [round1, round2]) {
    for (let sequence = 1; sequence <= 6; sequence += 1) {
      await prisma.question.create({
        data: {
          questionSetId: questionSet.id,
          roundId: round.id,
          sequence,
          points: 10,
          gridRows: 4,
          gridColumns: 4,
          regions: [[0, 1, 4, 5]],
          startingGrid,
          solution: startingGrid.map((v) => v ?? 1),
        },
      });
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

  // Shorten the round's timers when the test asks for it, so the real
  // preparation-zero and round-end transitions happen inside the test.
  if (preparationSeconds !== undefined || durationSeconds !== undefined) {
    const current = await prisma.roundSettings.findUnique({ where: { roundId: round1.id } });
    await prisma.roundSettings.upsert({
      where: { roundId: round1.id },
      create: {
        roundId: round1.id,
        durationSeconds: durationSeconds ?? current?.durationSeconds ?? 1200,
        preparationSeconds: preparationSeconds ?? current?.preparationSeconds ?? 60,
      },
      update: {
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        ...(preparationSeconds !== undefined ? { preparationSeconds } : {}),
      },
    });
  }

  await competitionService.publishCompetition(competition.id);

  if (seedParticipation) {
    // The pre-fix pattern: the round never created a participation row, so the
    // test had to seed the one its player would be scoped to. The regression
    // tests below deliberately omit this.
    await prisma.roundParticipation.create({
      data: {
        roundId: round1.id,
        participantId: participant.id,
        categoryId: category.id,
      },
    });
  }

  return {
    competitionId: competition.id,
    participantId: participant.id,
    categoryId: category.id,
    roundId: round1.id,
    stageId: individualStage.id,
  };
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  await createAccount(users.judge, "JUDGE");

  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;
});

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  // Judges created here have no linked account row, but delete defensively in
  // the same order judge.test.ts / judge-supervision.test.ts use, so a future
  // judge-with-account seed does not re-introduce the leak.
  await prisma.account.deleteMany({ where: { judgeId: { in: createdJudgeIds } } });
  await prisma.judge.deleteMany({ where: { id: { in: createdJudgeIds } } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  // Player accounts created dynamically inside individual tests.
  await prisma.account.deleteMany({ where: { username: { startsWith: "it7-player-" } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

function authedController(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

describe("dev-only internal trigger (spec step 7)", () => {
  it("starts stage 1 round 1's preparation for a WAITING competition and locks the countdown", async () => {
    const ctx = await makePublishedCompetition(`Round ${suffix}`);

    const res = await authedController(
      request(app).post("/api/rounds/dev/start-stage1-round1"),
    ).send({ competitionId: ctx.competitionId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PREPARATION");
    expect(res.body.roundId).toBe(ctx.roundId);
    expect(res.body.preparationSeconds).toBe(60);

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("PREPARATION");
    const stage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.stageId } });
    expect(stage.status).toBe("PREPARATION");
    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("PREPARATION");

    const runtime = await prisma.competitionRuntimeState.findUnique({
      where: { competitionId: ctx.competitionId },
    });
    expect(runtime?.phase).toBe("PREPARATION");
    expect(runtime?.currentRoundId).toBe(ctx.roundId);
  });

  it("rejects a competition that is not WAITING", async () => {
    const ctx = await makePublishedCompetition(`Twice ${suffix}`);
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    const res = await authedController(
      request(app).post("/api/rounds/dev/start-stage1-round1"),
    ).send({ competitionId: ctx.competitionId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("round.competitionNotWaiting");
  });

  it("rejects a non-controller session", async () => {
    const judgeLogin = await login("judge", users.judge);
    const res = await request(app)
      .post("/api/rounds/dev/start-stage1-round1")
      .set("x-session-token", judgeLogin.body.token)
      .set("x-device-id", judgeLogin.body.deviceId)
      .send({ competitionId: "anything" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("round.forbidden");
  });

  it("rejects an unauthenticated call", async () => {
    const res = await request(app)
      .post("/api/rounds/dev/start-stage1-round1")
      .send({ competitionId: "anything" });
    expect(res.status).toBe(401);
  });
});

describe("autosave (spec Implementation Detail 4, Error Cases)", () => {
  it("accepts the participant's own grid while the round is ACTIVE", async () => {
    const ctx = await makePublishedCompetition(`Autosave ${suffix}`);

    // Wire a player account to the participant, then log in.
    await createAccount(users.playerA, "PLAYER", ctx.participantId);
    const loginRes = await login("player", users.playerA);
    playerAToken = loginRes.body.token;
    playerADevice = loginRes.body.deviceId;

    // Trigger the round, then move it to ACTIVE directly (skipping the 60s
    // preparation wait — the timer's transition is covered by the timer tests).
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });

    const grid: (number | null)[] = [
      1, 2, 3, 4,
      null, null, null, null,
      null, null, null, null,
      4, null, null, 1,
    ];
    const res = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerAToken)
      .set("x-device-id", playerADevice)
      .send({ questionId: (await prisma.question.findFirstOrThrow({ where: { roundId: ctx.roundId } })).id, grid });
    expect(res.status).toBe(200);
    expect(typeof res.body.savedAtMs).toBe("number");
  });

  it("rejects autosave for a round that is not ACTIVE", async () => {
    const ctx = await makePublishedCompetition(`NotActive ${suffix}`);
    await createAccount(users.playerB, "PLAYER", ctx.participantId);
    const loginRes = await login("player", users.playerB);
    playerBToken = loginRes.body.token;
    playerBDevice = loginRes.body.deviceId;

    // The round is still WAITING — no trigger fired.
    const question = await prisma.question.findFirstOrThrow({ where: { roundId: ctx.roundId } });
    const res = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", playerBToken)
      .set("x-device-id", playerBDevice)
      .send({ questionId: question.id, grid: [1, 2, 3, 4] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("gameplay.notActive");
  });

  it("rejects autosave from a session that is not a participant in the round", async () => {
    const ctx = await makePublishedCompetition(`NotAParticipant ${suffix}`);
    // The controller is authenticated but is not a participant.
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });
    const question = await prisma.question.findFirstOrThrow({ where: { roundId: ctx.roundId } });
    const res = await authedController(
      request(app).post(`/api/gameplay/${ctx.roundId}/autosave`),
    ).send({ questionId: question.id, grid: [1, 2, 3, 4] });
    expect(res.status).toBe(401); // requireParticipant rejects non-PLAYER roles
  });
});

describe("reconnect state read (spec Implementation Detail 5)", () => {
  it("returns the round's questions, the saved grid, and the timer snapshot", async () => {
    const ctx = await makePublishedCompetition(`Reconnect ${suffix}`);
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: ctx.participantId },
    });
    const username = `it7-player-r-${suffix}`;
    await createAccount(username, "PLAYER", participant.id);
    const loginRes = await login("player", username);

    // Start the round and flip it ACTIVE, then autosave a grid.
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });
    const question = await prisma.question.findFirstOrThrow({
      where: { roundId: ctx.roundId },
      orderBy: { sequence: "asc" },
    });
    const grid: (number | null)[] = [1, 2, 3, 4, null, null, null, null, null, null, null, null, 4, 3, 2, 1];
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", loginRes.body.token)
      .set("x-device-id", loginRes.body.deviceId)
      .send({ questionId: question.id, grid });

    const state = await request(app)
      .get(`/api/gameplay/${ctx.roundId}/state`)
      .set("x-session-token", loginRes.body.token)
      .set("x-device-id", loginRes.body.deviceId);
    expect(state.status).toBe(200);
    expect(state.body.roundId).toBe(ctx.roundId);
    expect(state.body.status).toBe("ACTIVE");
    // A complete Individual round carries its full selection of 6 questions (BLD-040),
    // ordered by sequence, so the autosaved one is first.
    expect(state.body.questions).toHaveLength(6);
    expect(state.body.questions[0].id).toBe(question.id);
    expect(state.body.questions[0].solution).toBeUndefined(); // never sent (BLD-010)
    const saved = (state.body.savedGrids as { questionId: string; grid: (number | null)[] }[]).find(
      (s) => s.questionId === question.id,
    );
    expect(saved?.grid).toEqual(grid);
  });
});

describe("timer service pause/resume (spec Implementation Detail 3)", () => {
  it("pause preserves the remaining; resume schedules a 3-2-1 and continues from the same point", async () => {
    const ctx = await makePublishedCompetition(`PauseResume ${suffix}`);
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });

    const before = await roundTimerService.remaining(ctx.roundId);
    expect(before).not.toBeNull();
    expect(before!.status).toBe("PREPARATION");

    const paused = await roundTimerService.pause(ctx.roundId);
    expect(paused.status).toBe("PAUSED");
    const pausedRemaining = paused.remainingSeconds;
    expect(pausedRemaining).toBeGreaterThan(0);

    // Resuming emits the 3-2-1 and returns the pre-pause remaining; the deadline
    // only starts moving after the countdown (RND-001).
    const resumed = await roundTimerService.resume(ctx.roundId);
    expect(resumed.status).toBe("PREPARATION");
    expect(resumed.remainingSeconds).toBe(pausedRemaining);

    // The deadline was pushed forward by RESUME_COUNTDOWN_SECONDS (3s for the
    // 3-2-1), so a fresh read returns pausedRemaining + 3, minus any elapsed ms.
    // Allow a 1s race window either side.
    const after = await roundTimerService.remaining(ctx.roundId);
    expect(after!.remainingSeconds).toBeGreaterThanOrEqual(pausedRemaining + 2);
    expect(after!.remainingSeconds).toBeLessThanOrEqual(pausedRemaining + 3);
  }, 10000);

  it("pause is idempotent on an already-paused round", async () => {
    const ctx = await makePublishedCompetition(`PauseTwice ${suffix}`);
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    const first = await roundTimerService.pause(ctx.roundId);
    const second = await roundTimerService.pause(ctx.roundId);
    expect(second.status).toBe("PAUSED");
    expect(second.remainingSeconds).toBe(first.remainingSeconds);
  }, 10000);
});

// ---------------------------------------------------------------------------
// Regression: the round creates and activates its own RoundParticipation rows
// ---------------------------------------------------------------------------

/**
 * Poll `predicate` until it returns truthy or the timeout expires, and return
 * the truthy value (or throw). The round's transitions are driven by the real
 * 250 ms timer tick, never by a test flipping a status by hand, so this is how
 * the test waits for them.
 */
async function waitFor<T>(
  label: string,
  predicate: () => Promise<T | null>,
  timeoutMs = 15000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${label} (last: ${JSON.stringify(last)})`);
}

/**
 * The regression test this bug shipped without. Every other suite in this repo
 * hand-seeds a `RoundParticipation` row before touching gameplay, which is
 * exactly why all of them stayed green while the real flow 403'd for every
 * participant. Nothing here is seeded: the round has to create the row itself,
 * through the real preparation-zero timer hook.
 */
describe("RoundParticipation is created by the round itself (regression, 2026-10-08)", () => {
  it("opens an ACTIVE participation row for every participant at countdown zero, with no seeding", async () => {
    const ctx = await makePublishedCompetition(`NoSeedActive ${suffix}`, {
      seedParticipation: false,
      preparationSeconds: 1,
      durationSeconds: 60,
    });

    // Before the trigger: nothing exists (the schema default WAITING is not
    // what makes a round playable — the row must exist at all).
    const before = await prisma.roundParticipation.count({ where: { roundId: ctx.roundId } });
    expect(before).toBe(0);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });

    const row = await waitFor("an ACTIVE participation row", async () =>
      prisma.roundParticipation.findUnique({
        where: { roundId_participantId: { roundId: ctx.roundId, participantId: ctx.participantId } },
      }),
    );
    expect(row.state).toBe("ACTIVE");
    expect(row.categoryId).toBe(ctx.categoryId);

    // The round really did go ACTIVE through the timer, not through a test write.
    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("ACTIVE");
  }, 20000);

  it("lets a real participant autosave and reconnect with no manually seeded row", async () => {
    const ctx = await makePublishedCompetition(`NoSeedGameplay ${suffix}`, {
      seedParticipation: false,
      preparationSeconds: 1,
      durationSeconds: 60,
    });
    const username = `it7-player-noseed-${suffix}`;
    await createAccount(username, "PLAYER", ctx.participantId);
    const loginRes = await login("player", username);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await waitFor("an ACTIVE participation row", () =>
      prisma.roundParticipation.findUnique({
        where: { roundId_participantId: { roundId: ctx.roundId, participantId: ctx.participantId } },
      }),
    );

    const question = await prisma.question.findFirstOrThrow({
      where: { roundId: ctx.roundId },
      orderBy: { sequence: "asc" },
    });
    const grid: (number | null)[] = [
      1, 2, 3, 4,
      null, null, null, null,
      null, null, null, null,
      4, 3, 2, 1,
    ];

    // The call that used to 403 `gameplay.notAParticipant`.
    const autosave = await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", loginRes.body.token)
      .set("x-device-id", loginRes.body.deviceId)
      .send({ questionId: question.id, grid });
    expect(autosave.status).toBe(200);

    // Reconnect (a page refresh mid-round) reads the same state back.
    const state = await request(app)
      .get(`/api/gameplay/${ctx.roundId}/state`)
      .set("x-session-token", loginRes.body.token)
      .set("x-device-id", loginRes.body.deviceId);
    expect(state.status).toBe(200);
    expect(state.body.status).toBe("ACTIVE");
    const saved = (state.body.savedGrids as { questionId: string; grid: (number | null)[] }[]).find(
      (s) => s.questionId === question.id,
    );
    expect(saved?.grid).toEqual(grid);
  }, 20000);

  it("auto-submits a participant who never submits, once the round's timer expires", async () => {
    const ctx = await makePublishedCompetition(`NoSeedTimeout ${suffix}`, {
      seedParticipation: false,
      preparationSeconds: 1,
      durationSeconds: 2,
    });
    const username = `it7-player-timeout-${suffix}`;
    await createAccount(username, "PLAYER", ctx.participantId);
    const loginRes = await login("player", username);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await waitFor("an ACTIVE participation row", () =>
      prisma.roundParticipation.findUnique({
        where: { roundId_participantId: { roundId: ctx.roundId, participantId: ctx.participantId } },
      }),
    );

    // Save a partial grid, then submit nothing at all.
    const question = await prisma.question.findFirstOrThrow({
      where: { roundId: ctx.roundId },
      orderBy: { sequence: "asc" },
    });
    await request(app)
      .post(`/api/gameplay/${ctx.roundId}/autosave`)
      .set("x-session-token", loginRes.body.token)
      .set("x-device-id", loginRes.body.deviceId)
      .send({
        questionId: question.id,
        grid: [1, 2, 3, 4, null, null, null, null, null, null, null, null, 4, 3, 2, 1],
      });

    // Unit 08's round-ended sweep looks only for `state: "ACTIVE"` rows — the
    // exact half of the bug that would have stayed silent even with creation
    // fixed. It must find this participant and close them as AUTO_SUBMITTED.
    const closed = await waitFor("the timeout auto-submit", async () => {
      const row = await prisma.roundParticipation.findUnique({
        where: {
          roundId_participantId: { roundId: ctx.roundId, participantId: ctx.participantId },
        },
      });
      return row && row.state === "AUTO_SUBMITTED" ? row : null;
    });

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { roundParticipationId: closed.id, isArchived: false },
    });
    expect(attempt.submissionType).toBe("TIMEOUT");

    const result = await prisma.individualRoundResult.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(result.attemptId).toBe(attempt.id);

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("FINISHED");
  }, 25000);
});
