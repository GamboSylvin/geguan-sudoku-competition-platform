import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { roundTimerService } from "../src/modules/round";
import { gameplayService, teamRotationService } from "../src/modules/gameplay";
import * as rotationRepository from "../src/modules/gameplay/team-rotation.repository";
import type { RotationState } from "../src/modules/gameplay";

/**
 * Unit 13 integration tests: the Team stage's rotation relay.
 *
 * Covers the eight acceptance criteria from
 * `specs/13-team-stage-rotation-relay.md`:
 *   1. A 4-member team is dealt 4 of the round's questions, one per member.
 *   2. Every `rotationPeriodSeconds` the question *and its partial grid* move to
 *      the next member; members never move.
 *   3. A correct submit scores `teamPointsPerQuestion` immediately, removes the
 *      question from circulation, and refills from the queue.
 *   4. An incorrect submit changes nothing and leaves the question circulating.
 *   5. The round ends once every question is correctly answered, or the optional
 *      total time elapses, whichever first; score = correctCount × points.
 *   6. A submit for a question the tablet no longer holds is rejected (409) and
 *      the client is refreshed with what is held now.
 *   7. No early-finish bonus is computed under any circumstance.
 *   8. CI runs lint, typecheck, tests and build (covered by the suite running).
 *
 * `Team`/`Participant`/`Question` rows are seeded directly, the same precedent
 * Units 03, 06, 08 and 10 set for data whose real import unit isn't built yet
 * (Unit 04 is still gated on U-01; Unit 05's importer is not exercised here).
 * The seeded pool still satisfies publish readiness: exactly 6 assigned
 * questions per Individual round, one active participant per category, and a
 * judge range covering every participant number.
 *
 * The rotation period is never waited out (the default is 60s and the seed uses
 * 3600s so no background tick can move a question mid-test). A test instead moves
 * the round's own deadline into the past and waits for the wakeup chain to act —
 * the deadline is still the server's (invariant 3) and the tick is only display
 * cadence.
 */

const app = createApp();
const PASSWORD = "test-pass-13";
const suffix = Math.random().toString(36).slice(2, 8);

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
const PARTIAL_GRID: (number | null)[] = [
  1, 2, null, 4,
  null, null, null, null,
  null, null, null, null,
  4, null, null, 1,
];

const TEAM_SIZE = 4;
/** Enough pool for a 6-question draw per team, so the refill queue is non-empty. */
const POOL_SIZE = 8;
const DRAW_COUNT = 6;

const createdCompetitionIds: string[] = [];
const createdAccountUsernames: string[] = [];

interface SeededTeamCompetition {
  competitionId: string;
  categoryId: string;
  teamStageId: string;
  teamRound1Id: string;
  teamRound2Id: string;
  individualStageId: string;
  teamId: string;
  participantIds: string[];
}

async function createAccount(
  username: string,
  role: "CONTROLLER" | "PLAYER",
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

function loginPlayer(username: string) {
  return request(app)
    .post("/api/auth/player/login")
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

async function seedTeamCompetition(name: string): Promise<SeededTeamCompetition> {
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
  const teamStage = full.stages.find((s) => s.type === "TEAM")!;
  const teamRound1 = teamStage.rounds.find((r) => r.sequence === 1)!;
  const teamRound2 = teamStage.rounds.find((r) => r.sequence === 2)!;

  const school = await prisma.school.create({
    data: { competitionId: competition.id, name: `School ${suffix}`, sequence: 1 },
  });
  const team = await prisma.team.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Team ${suffix}`,
      sequence: 1,
    },
  });

  const participantIds: string[] = [];
  for (let index = 0; index < TEAM_SIZE; index += 1) {
    const participant = await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        schoolId: school.id,
        teamId: team.id,
        name: `Member ${index + 1} ${suffix}`,
        participantNumber: index + 1,
        sequence: index + 1,
      },
    });
    participantIds.push(participant.id);
  }

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });

  // Publish readiness: exactly 6 assigned questions per Individual round.
  for (const round of individualStage.rounds) {
    for (let sequence = 1; sequence <= 6; sequence += 1) {
      await prisma.question.create({
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
    }
  }
  // The team pool: `roundId` null (BLD-040 — a team round never sets it).
  for (let sequence = 1; sequence <= POOL_SIZE; sequence += 1) {
    await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        roundId: null,
        sequence: 100 + sequence,
        points: 10,
        gridRows: GRID_SIZE,
        gridColumns: GRID_SIZE,
        regions: [[0, 1, 4, 5]],
        startingGrid: STARTING_GRID,
        solution: SOLUTION,
      },
    });
  }

  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: judge.id,
      fromParticipantNumber: 1,
      toParticipantNumber: TEAM_SIZE,
    },
  });

  // The team round's own settings: a short period so the tests are quick, and a
  // long duration so the Unit 07 clock never pre-empts the rotation end.
  await prisma.roundSettings.update({
    where: { roundId: teamRound1.id },
    data: {
      durationSeconds: 1200,
      preparationSeconds: 60,
      teamPointsPerQuestion: 10,
      // Long by default: only the two timed-rotation tests below override this to
      // 1s. A short period everywhere else lets the background tick rotate a
      // question away (or back again) mid-test — a race, not a behaviour.
      rotationPeriodSeconds: 3600,
      teamQuestionCount: DRAW_COUNT,
      teamTotalTimeSeconds: null,
    },
  });
  await prisma.roundSettings.update({
    where: { roundId: teamRound2.id },
    data: { durationSeconds: 1200, preparationSeconds: 60 },
  });

  await competitionService.publishCompetition(competition.id);

  return {
    competitionId: competition.id,
    categoryId: category.id,
    teamStageId: teamStage.id,
    teamRound1Id: teamRound1.id,
    teamRound2Id: teamRound2.id,
    individualStageId: individualStage.id,
    teamId: team.id,
    participantIds,
  };
}

/** Put the team round into the state `startActivePhaseFromTimer` would have. */
async function startTeamRound(
  ctx: SeededTeamCompetition,
  overrides: {
    teamTotalTimeSeconds?: number | null;
    rotationPeriodSeconds?: number;
  } = {},
): Promise<void> {
  if (overrides.teamTotalTimeSeconds !== undefined) {
    await prisma.roundSettings.update({
      where: { roundId: ctx.teamRound1Id },
      data: { teamTotalTimeSeconds: overrides.teamTotalTimeSeconds },
    });
  }
  if (overrides.rotationPeriodSeconds !== undefined) {
    await prisma.roundSettings.update({
      where: { roundId: ctx.teamRound1Id },
      data: { rotationPeriodSeconds: overrides.rotationPeriodSeconds },
    });
  }

  await prisma.competition.update({
    where: { id: ctx.competitionId },
    data: { status: "ROUND_ACTIVE" },
  });
  await prisma.stage.update({
    where: { id: ctx.teamStageId },
    data: { status: "ACTIVE" },
  });
  await prisma.round.update({
    where: { id: ctx.teamRound1Id },
    data: { status: "ACTIVE", startedAt: new Date() },
  });
  await roundTimerService.startRoundTimer(
    ctx.teamRound1Id,
    ctx.competitionId,
    ctx.teamStageId,
    1200,
  );

  const settings = await prisma.roundSettings.findUniqueOrThrow({
    where: { roundId: ctx.teamRound1Id },
  });
  await teamRotationService.startRotationRound({
    roundId: ctx.teamRound1Id,
    competitionId: ctx.competitionId,
    stageId: ctx.teamStageId,
    settings: {
      teamPointsPerQuestion: settings.teamPointsPerQuestion,
      rotationPeriodSeconds: settings.rotationPeriodSeconds,
      teamQuestionCount: settings.teamQuestionCount,
      teamTotalTimeSeconds: settings.teamTotalTimeSeconds,
    },
  });
}

async function loadState(roundId: string, teamId: string): Promise<RotationState> {
  const state = await rotationRepository.loadRotationState(roundId, teamId);
  if (!state) throw new Error("no rotation state");
  return state;
}

/**
 * Wait for the round's own wakeup chain to act on a deadline a test moved into the
 * past. The tick loop is display cadence only — it reads the deadlines and acts on
 * whatever is due (invariant 3) — so this waits for the real chain instead of
 * ticking by hand: a manual tick could land on either side of a background one and
 * double-rotate.
 */
async function waitForRotation(
  roundId: string,
  teamId: string,
  rotationIndex: number,
  timeoutMs = 5000,
): Promise<RotationState> {
  const deadline = Date.now() + timeoutMs;
  let state = await loadState(roundId, teamId);
  while (state.rotationIndex <= rotationIndex) {
    if (Date.now() > deadline) return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
    state = await loadState(roundId, teamId);
  }
  return state;
}

/** Same idea, for the optional total time: wait for the settled `TeamRoundResult`. */
async function waitForTeamResult(
  roundId: string,
  teamId: string,
  timeoutMs = 5000,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await prisma.teamRoundResult.findFirst({ where: { roundId, teamId } });
    if (result) return result;
    if (Date.now() > deadline) throw new Error("waitForTeamResult: timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Log in all four members; returns one authed request helper per member. */
async function loginTeam(ctx: SeededTeamCompetition, label: string) {
  const sessions = [];
  for (let index = 0; index < ctx.participantIds.length; index += 1) {
    const username = `it13-${label}-${index}-${suffix}`;
    await createAccount(username, "PLAYER", ctx.participantIds[index]!);
    const login = await loginPlayer(username);
    sessions.push({
      participantId: ctx.participantIds[index]!,
      token: login.body.token as string,
      deviceId: login.body.deviceId as string,
    });
  }
  return sessions;
}

function submitRotation(
  session: { token: string; deviceId: string },
  roundId: string,
  questionId: string,
  grid: (number | null)[],
) {
  return request(app)
    .post(`/api/gameplay/rotation/${roundId}/submit`)
    .set("x-session-token", session.token)
    .set("x-device-id", session.deviceId)
    .send({ questionId, grid });
}

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("pure rotation rules (no I/O)", () => {
  it("isRotationRound: only the Team stage's round 1", () => {
    expect(teamRotationService.isRotationRound("TEAM", 1)).toBe(true);
    expect(teamRotationService.isRotationRound("TEAM", 2)).toBe(false);
    expect(teamRotationService.isRotationRound("INDIVIDUAL", 1)).toBe(false);
  });

  it("the flagged interpretation is isolated in one function (spec Notes)", () => {
    expect(teamRotationService.keepIncorrectSubmitInCirculation()).toBe(true);
  });

  it("rotateTeam moves each member's question and grid one seat along", async () => {
    const state: RotationState = {
      roundId: "pure-round",
      competitionId: "pure-competition",
      stageId: "pure-stage",
      teamId: "pure-team",
      categoryId: "pure-category",
      memberOrder: ["a", "b", "c"],
      holds: [
        { participantId: "a", question: null, grid: [1, 2, 3] },
        { participantId: "b", question: null, grid: [4, 5, 6] },
        { participantId: "c", question: null, grid: [7, 8, 9] },
      ],
      refillQueue: [],
      correctCount: 0,
      totalQuestionCount: 3,
      rotationIndex: 0,
      lastRotationAtMs: null,
      nextRotationAtMs: 0,
      startedAtMs: 0,
      pointsPerQuestion: 10,
      rotationPeriodSeconds: 60,
      totalTimeDeadlineMs: null,
      finished: false,
    };

    const rotated = await teamRotationService.rotateTeam(state);

    // Members keep their seats; the previous member's grid arrives (TEM-02).
    expect(rotated.holds.map((h) => h.participantId)).toEqual(["a", "b", "c"]);
    expect(rotated.holds.map((h) => h.grid)).toEqual([[7, 8, 9], [1, 2, 3], [4, 5, 6]]);
    expect(rotated.rotationIndex).toBe(1);
    expect(rotated.lastRotationAtMs).not.toBeNull();
  });
});

describe("initial deal (acceptance criterion 1)", () => {
  it("deals one question per member and queues the rest", async () => {
    const ctx = await seedTeamCompetition(`Deal ${suffix}`);
    await startTeamRound(ctx);

    const state = await loadState(ctx.teamRound1Id, ctx.teamId);
    expect(state.memberOrder).toEqual(ctx.participantIds);
    expect(state.holds).toHaveLength(TEAM_SIZE);
    for (const hold of state.holds) {
      expect(hold.question).not.toBeNull();
      // A blank working grid the member fills in — never the solution.
      expect(hold.grid).toEqual(new Array<null>(GRID_SIZE * GRID_SIZE).fill(null));
    }
    expect(state.refillQueue).toHaveLength(DRAW_COUNT - TEAM_SIZE);
    expect(state.totalQuestionCount).toBe(DRAW_COUNT);
    expect(state.correctCount).toBe(0);

    // Every dealt question comes from the category's pool — which is the whole
    // `QuestionSet` content, **not** filtered by `roundId` (spec Detail 1,
    // BLD-040): `roundId` is the Individual stage's manual-assignment column and a
    // team round never sets it, so filtering on it would find nothing at all.
    const dealtIds = [...state.holds.map((h) => h.question!.id), ...state.refillQueue.map((q) => q.id)];
    const inCategoryPool = await prisma.question.findMany({
      where: { id: { in: dealtIds }, questionSet: { competitionId: ctx.competitionId, categoryId: ctx.categoryId } },
      select: { id: true },
    });
    expect(inCategoryPool).toHaveLength(dealtIds.length);
    // No duplicate question is dealt twice.
    expect(new Set(dealtIds).size).toBe(dealtIds.length);

    // The durable mirror was written too.
    const mirror = await prisma.teamRotationState.findUniqueOrThrow({
      where: { roundId_teamId: { roundId: ctx.teamRound1Id, teamId: ctx.teamId } },
    });
    expect(mirror.rotationIndex).toBe(0);
  });

  it("is idempotent — a repeated start cannot re-deal", async () => {
    const ctx = await seedTeamCompetition(`DealTwice ${suffix}`);
    await startTeamRound(ctx);
    const before = await loadState(ctx.teamRound1Id, ctx.teamId);
    const dealtIds = before.holds.map((h) => h.question!.id);

    const settings = await prisma.roundSettings.findUniqueOrThrow({
      where: { roundId: ctx.teamRound1Id },
    });
    await teamRotationService.startRotationRound({
      roundId: ctx.teamRound1Id,
      competitionId: ctx.competitionId,
      stageId: ctx.teamStageId,
      settings: {
        teamPointsPerQuestion: settings.teamPointsPerQuestion,
        rotationPeriodSeconds: settings.rotationPeriodSeconds,
        teamQuestionCount: settings.teamQuestionCount,
        teamTotalTimeSeconds: settings.teamTotalTimeSeconds,
      },
    });

    const after = await loadState(ctx.teamRound1Id, ctx.teamId);
    expect(after.holds.map((h) => h.question!.id)).toEqual(dealtIds);
  });
});

describe("timed rotation (acceptance criterion 2)", () => {
  it("moves the question and the partial grid to the next member", async () => {
    const ctx = await seedTeamCompetition(`Rotate ${suffix}`);
    const sessions = await loginTeam(ctx, "rotate");
    await startTeamRound(ctx);

    // Member 1 types into their grid before the rotation. The rotation deadline is
    // moved into the past rather than waited out: a tick reads deadlines and acts
    // on whatever is due (invariant 3), so this drives the real code path without
    // leaving the test open to the background wakeup racing it.
    const before = await loadState(ctx.teamRound1Id, ctx.teamId);
    const heldByFirst = before.holds[0]!.question!.id;
    // Due already, so the round's own wakeup chain rotates it. Waiting for the
    // real chain (rather than ticking by hand) keeps the test off a race with it:
    // a manual tick could land on either side of a background one and double-rotate.
    await rotationRepository.saveRotationState({
      ...before,
      holds: before.holds.map((h, i) => (i === 0 ? { ...h, grid: PARTIAL_GRID } : h)),
      nextRotationAtMs: Date.now() - 1000,
    });

    const after = await waitForRotation(ctx.teamRound1Id, ctx.teamId, before.rotationIndex);
    expect(after.rotationIndex).toBe(before.rotationIndex + 1);
    // The member stays at their own seat…
    expect(after.holds.map((h) => h.participantId)).toEqual(ctx.participantIds);
    // …and receives the previous member's question together with its grid.
    const receiver = after.holds[1]!;
    expect(receiver.question!.id).toBe(heldByFirst);
    expect(receiver.grid).toEqual(PARTIAL_GRID);
    expect(after.lastRotationAtMs).not.toBeNull();

    // The reconnect read agrees with the working state.
    const stateRes = await request(app)
      .get(`/api/gameplay/rotation/${ctx.teamRound1Id}/state`)
      .set("x-session-token", sessions[1]!.token)
      .set("x-device-id", sessions[1]!.deviceId);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.hold.question.id).toBe(heldByFirst);
    expect(stateRes.body.hold.grid).toEqual(PARTIAL_GRID);
    expect(stateRes.body.status).toBe("ACTIVE");
  });

  it("does not rotate while the round is paused", async () => {
    const ctx = await seedTeamCompetition(`Paused ${suffix}`);
    await startTeamRound(ctx);
    const before = await loadState(ctx.teamRound1Id, ctx.teamId);

    await roundTimerService.pause(ctx.teamRound1Id);
    // Due already — so the only thing that can stop the rotation is the pause.
    // Set after the pause, so the background tick cannot get in first.
    await rotationRepository.saveRotationState({ ...before, nextRotationAtMs: Date.now() - 1000 });
    await teamRotationService.tickForTest(ctx.teamRound1Id);

    const after = await loadState(ctx.teamRound1Id, ctx.teamId);
    expect(after.rotationIndex).toBe(before.rotationIndex);
    await roundTimerService.resume(ctx.teamRound1Id);
  });
});

describe("submit and immediate check (acceptance criteria 3, 4)", () => {
  it("a correct submit scores the flat value and refills from the queue", async () => {
    const ctx = await seedTeamCompetition(`Correct ${suffix}`);
    const sessions = await loginTeam(ctx, "correct");
    await startTeamRound(ctx);

    const before = await loadState(ctx.teamRound1Id, ctx.teamId);
    const session = sessions[0]!;
    const held = before.holds[0]!.question!.id;
    const queued = before.refillQueue[0]!.id;

    const res = await submitRotation(session, ctx.teamRound1Id, held, SOLUTION);
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.correctCount).toBe(1);
    expect(res.body.teamScore).toBe(10); // 1 × teamPointsPerQuestion
    expect(res.body.roundEnded).toBe(false);

    const after = await loadState(ctx.teamRound1Id, ctx.teamId);
    expect(after.correctCount).toBe(1);
    // The answered question left circulation; the tablet was refilled from the queue.
    const allIds = [...after.holds.map((h) => h.question?.id), ...after.refillQueue.map((q) => q.id)];
    expect(allIds).not.toContain(held);
    expect(after.holds[0]!.question!.id).toBe(queued);
    expect(after.refillQueue).toHaveLength(before.refillQueue.length - 1);

    // The settled result is not written yet — the round is still running.
    const results = await prisma.teamRoundResult.findMany({
      where: { roundId: ctx.teamRound1Id },
    });
    expect(results).toHaveLength(0);
  });

  it("an incorrect submit changes no score and leaves the question circulating", async () => {
    const ctx = await seedTeamCompetition(`Incorrect ${suffix}`);
    const sessions = await loginTeam(ctx, "incorrect");
    await startTeamRound(ctx);

    const before = await loadState(ctx.teamRound1Id, ctx.teamId);
    const held = before.holds[2]!.question!.id;

    const res = await submitRotation(sessions[2]!, ctx.teamRound1Id, held, WRONG_GRID);
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
    expect(res.body.correctCount).toBe(0);
    expect(res.body.teamScore).toBe(0);

    const after = await loadState(ctx.teamRound1Id, ctx.teamId);
    expect(after.correctCount).toBe(0);
    // Still held by the same member, available to the next teammate after a rotation.
    expect(after.holds[2]!.question!.id).toBe(held);
    expect(after.refillQueue).toHaveLength(before.refillQueue.length);
    // The attempt is visible to whoever inherits it.
    expect(after.holds[2]!.grid).toEqual(WRONG_GRID);
  });

  it("the last correct submit ends the round and settles the score", async () => {
    const ctx = await seedTeamCompetition(`Finish ${suffix}`);
    const sessions = await loginTeam(ctx, "finish");
    await startTeamRound(ctx);

    let lastBody: { roundEnded: boolean } = { roundEnded: false };
    for (let index = 0; index < DRAW_COUNT; index += 1) {
      const state = await loadState(ctx.teamRound1Id, ctx.teamId);
      const holder = state.holds.findIndex((h) => h.question !== null);
      expect(holder).toBeGreaterThanOrEqual(0);
      const res = await submitRotation(
        sessions[holder]!,
        ctx.teamRound1Id,
        state.holds[holder]!.question!.id,
        SOLUTION,
      );
      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      lastBody = res.body as { roundEnded: boolean };
    }

    expect(lastBody.roundEnded).toBe(true);

    const result = await prisma.teamRoundResult.findFirstOrThrow({
      where: { roundId: ctx.teamRound1Id, teamId: ctx.teamId },
    });
    expect(result.correctCount).toBe(DRAW_COUNT);
    expect(result.score).toBe(DRAW_COUNT * 10);
    // Set only when the round ended by queue-empty (Detail 4).
    expect(result.completionTimeSeconds).not.toBeNull();

    // Exactly one row per team — the code-side idempotency the schema cannot enforce.
    const all = await prisma.teamRoundResult.findMany({
      where: { roundId: ctx.teamRound1Id, teamId: ctx.teamId },
    });
    expect(all).toHaveLength(1);

    // The round itself is over, and not marked as an early end.
    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.teamRound1Id } });
    expect(round.status).toBe("FINISHED");
    expect(round.earlyEnded).toBe(false);
  });

  it("a submit after the round ended is rejected", async () => {
    const ctx = await seedTeamCompetition(`AfterEnd ${suffix}`);
    const sessions = await loginTeam(ctx, "afterend");
    await startTeamRound(ctx);

    for (let index = 0; index < DRAW_COUNT; index += 1) {
      const state = await loadState(ctx.teamRound1Id, ctx.teamId);
      const holder = state.holds.findIndex((h) => h.question !== null);
      await submitRotation(
        sessions[holder]!,
        ctx.teamRound1Id,
        state.holds[holder]!.question!.id,
        SOLUTION,
      );
    }

    const late = await submitRotation(sessions[0]!, ctx.teamRound1Id, "any-question", SOLUTION);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("rotation.roundEnded");
  });
});

describe("the stale-hold race (acceptance criterion 6)", () => {
  it("rejects a submit for a question that has rotated away, with 409", async () => {
    const ctx = await seedTeamCompetition(`Stale ${suffix}`);
    const sessions = await loginTeam(ctx, "stale");
    await startTeamRound(ctx);

    const before = await loadState(ctx.teamRound1Id, ctx.teamId);
    const rotatedAway = before.holds[0]!.question!.id;

    // The rotation moves member 1's question to member 2 before the submit lands.
    await teamRotationService.rotateTeam(before);

    const res = await submitRotation(sessions[0]!, ctx.teamRound1Id, rotatedAway, SOLUTION);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("rotation.staleHold");

    // The member simply sees whatever has rotated in instead.
    const stateRes = await request(app)
      .get(`/api/gameplay/rotation/${ctx.teamRound1Id}/state`)
      .set("x-session-token", sessions[0]!.token)
      .set("x-device-id", sessions[0]!.deviceId);
    expect(stateRes.status).toBe(200);
    const nowHeld = stateRes.body.hold.question.id as string;
    expect(nowHeld).not.toBe(rotatedAway);
    expect(stateRes.body.hold.question.id).toBe(before.holds[TEAM_SIZE - 1]!.question!.id);

    // The team scored nothing from the rejected submit.
    const after = await loadState(ctx.teamRound1Id, ctx.teamId);
    expect(after.correctCount).toBe(0);
  });
});

describe("membership and round scoping (spec Error Cases, Security)", () => {
  it("rejects a submit from a participant who is not on a team", async () => {
    const ctx = await seedTeamCompetition(`NoTeam ${suffix}`);
    await startTeamRound(ctx);

    const outsider = await prisma.participant.create({
      data: {
        competitionId: ctx.competitionId,
        categoryId: ctx.categoryId,
        schoolId: (await prisma.school.findFirstOrThrow({ where: { competitionId: ctx.competitionId } })).id,
        teamId: null,
        name: `Outsider ${suffix}`,
        participantNumber: 99,
        sequence: 99,
      },
    });
    const username = `it13-outsider-${suffix}`;
    await createAccount(username, "PLAYER", outsider.id);
    const login = await loginPlayer(username);

    const res = await request(app)
      .post(`/api/gameplay/rotation/${ctx.teamRound1Id}/submit`)
      .set("x-session-token", login.body.token)
      .set("x-device-id", login.body.deviceId)
      .send({ questionId: "anything", grid: SOLUTION });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("rotation.notATeamMember");
  });

  it("rejects a submit against an Individual-stage round", async () => {
    const ctx = await seedTeamCompetition(`WrongRound ${suffix}`);
    await startTeamRound(ctx);
    const sessions = await loginTeam(ctx, "wronground");

    const individualRound = await prisma.round.findFirstOrThrow({
      where: { stageId: ctx.individualStageId, sequence: 1 },
    });
    const res = await submitRotation(sessions[0]!, individualRound.id, "anything", SOLUTION);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("rotation.notARotationRound");
  });

  it("rejects a submit with no player session", async () => {
    const ctx = await seedTeamCompetition(`NoAuth ${suffix}`);
    await startTeamRound(ctx);

    const res = await request(app)
      .post(`/api/gameplay/rotation/${ctx.teamRound1Id}/submit`)
      .send({ questionId: "anything", grid: SOLUTION });
    expect(res.status).toBe(401);
  });
});

describe("the optional total time (acceptance criterion 5)", () => {
  it("ends the round with only what was already correct", async () => {
    const ctx = await seedTeamCompetition(`TimeLimit ${suffix}`);
    const sessions = await loginTeam(ctx, "timelimit");
    await startTeamRound(ctx, { teamTotalTimeSeconds: 1, rotationPeriodSeconds: 60 });

    // One correct answer before the deadline; the rest stay in progress.
    const state = await loadState(ctx.teamRound1Id, ctx.teamId);
    const holder = state.holds.findIndex((h) => h.question !== null);
    const res = await submitRotation(
      sessions[holder]!,
      ctx.teamRound1Id,
      state.holds[holder]!.question!.id,
      SOLUTION,
    );
    expect(res.body.correct).toBe(true);
    expect(res.body.roundEnded).toBe(false);

    const result = await waitForTeamResult(ctx.teamRound1Id, ctx.teamId);
    expect(result.correctCount).toBe(1);
    expect(result.score).toBe(10);
    // Not set — the round ended by the time limit, not by queue-empty (Detail 4).
    expect(result.completionTimeSeconds).toBeNull();

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.teamRound1Id } });
    expect(round.status).toBe("FINISHED");
    expect(round.earlyEnded).toBe(false);
  });

  it("the timer-expiry path settles every unfinished team (handleRotationRoundEnded)", async () => {
    const ctx = await seedTeamCompetition(`TimerExpiry ${suffix}`);
    await startTeamRound(ctx);

    await prisma.round.update({
      where: { id: ctx.teamRound1Id },
      data: { status: "FINISHED", endedAt: new Date() },
    });
    await gameplayService.handleRoundEnded({
      roundId: ctx.teamRound1Id,
      stageId: ctx.teamStageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const result = await prisma.teamRoundResult.findFirstOrThrow({
      where: { roundId: ctx.teamRound1Id, teamId: ctx.teamId },
    });
    expect(result.correctCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.completionTimeSeconds).toBeNull();

    // A team round never produces an individual result (invariant 7).
    const individual = await prisma.individualRoundResult.findMany({
      where: { roundId: ctx.teamRound1Id },
    });
    expect(individual).toHaveLength(0);
  });
});

describe("auto-advance to the Team stage's round 2 (acceptance criterion 5, Detail 5)", () => {
  it("starts round 2's preparation once every team result is settled", async () => {
    const ctx = await seedTeamCompetition(`Advance ${suffix}`);
    const sessions = await loginTeam(ctx, "advance");
    await startTeamRound(ctx);

    for (let index = 0; index < DRAW_COUNT; index += 1) {
      const state = await loadState(ctx.teamRound1Id, ctx.teamId);
      const holder = state.holds.findIndex((h) => h.question !== null);
      await submitRotation(
        sessions[holder]!,
        ctx.teamRound1Id,
        state.holds[holder]!.question!.id,
        SOLUTION,
      );
    }

    const round2 = await prisma.round.findUniqueOrThrow({ where: { id: ctx.teamRound2Id } });
    expect(round2.status).toBe("PREPARATION");
    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("PREPARATION");
    const runtime = await prisma.competitionRuntimeState.findUniqueOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(runtime.currentRoundId).toBe(ctx.teamRound2Id);
    expect(runtime.phase).toBe("PREPARATION");
    // The stage did not finish — round 2 follows it.
    const stage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.teamStageId } });
    expect(stage.status).toBe("ACTIVE");
  });
});

describe("no early-finish bonus (acceptance criterion 7)", () => {
  it("a round finished well inside its duration still scores the flat value", async () => {
    const ctx = await seedTeamCompetition(`NoBonus ${suffix}`);
    const sessions = await loginTeam(ctx, "nobonus");
    await startTeamRound(ctx);

    for (let index = 0; index < DRAW_COUNT; index += 1) {
      const state = await loadState(ctx.teamRound1Id, ctx.teamId);
      const holder = state.holds.findIndex((h) => h.question !== null);
      await submitRotation(
        sessions[holder]!,
        ctx.teamRound1Id,
        state.holds[holder]!.question!.id,
        SOLUTION,
      );
    }

    const result = await prisma.teamRoundResult.findFirstOrThrow({
      where: { roundId: ctx.teamRound1Id, teamId: ctx.teamId },
    });
    // The round lasted well under a minute of its 120-second duration: an
    // early-finish bonus would have added to this. It is exactly correctCount × 10.
    expect(result.score).toBe(result.correctCount * 10);
    expect(result.score).toBe(DRAW_COUNT * 10);
  });
});
