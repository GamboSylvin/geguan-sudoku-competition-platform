import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { roundTimerService } from "../src/modules/round";
import { gameplayService } from "../src/modules/gameplay";

/**
 * Unit 11 integration tests: the controller's live command surface.
 *
 * Covers the ten acceptance criteria from
 * `context/specs/11-controller-live-commands.md`:
 *   1. Starting a stage begins round 1's preparation for every category at once.
 *   2. A global pause freezes the exact remaining time; resume continues from it.
 *   3. Ending a round early auto-submits with no bonus and cannot be undone.
 *   4. Finishing early marks the competition FINISHED with finishedEarly = true.
 *   5. Reset/rematch at all four scopes archives and grants the FULL duration;
 *      rejected on a FINISHED or CANCELLED competition.
 *   6. The controller restarts any participant with no range restriction.
 *   7. Cancel is terminal from any point before FINISHED; nothing runs after it.
 *   8. A natural finish of the last stage sets FINISHED with finishedEarly = false.
 *   9. A non-controller session cannot invoke any command this unit adds.
 *  10. Lint, typecheck, tests and build pass in CI (covered by this suite running).
 *
 * Every command goes through HTTP, because "a non-controller session cannot invoke
 * any command" (criterion 9) is a route-level rule, not a service-level one.
 *
 * Round durations: `buildStructure` gives Individual round 1 120 s. Tests that
 * need a *live* timer without waiting out a 60 s preparation countdown flip the
 * round to ACTIVE and start the timer directly — the same shortcut
 * `scoring.test.ts` uses.
 */

const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it11-controller-${suffix}`,
  judge: `it11-judge-${suffix}`,
  player: `it11-player-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";
/**
 * One judge row for the whole suite, created in `beforeAll` and reused by every
 * seeded competition (each seeds an assignment for participant numbers 1–1). The
 * judge account is bound to this row, so its range is the same across tests.
 */
let sharedJudgeId = "";

const createdCompetitionIds: string[] = [];
const createdAccountUsernames: string[] = [];

const GRID_SIZE = 4;
const STARTING_GRID: (number | null)[] = [
  1, null, null, 4,
  null, null, null, null,
  null, null, null, null,
  4, null, null, 1,
];
const SOLUTION: (number | null)[] = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];

interface SeededCompetition {
  competitionId: string;
  stageId: string;
  teamStageId: string;
  roundId: string;
  round2Id: string;
  teamRound2Id: string;
  categoryId: string;
  schoolId: string;
  questionId: string;
  participantId: string;
}

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
  participantId?: string,
  judgeId?: string,
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
      participantId: participantId ?? null,
      judgeId: judgeId ?? null,
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

function authed(req: request.Test, token: string, device: string): request.Test {
  return req.set("x-session-token", token).set("x-device-id", device);
}

/**
 * A published, WAITING competition with one category, one school, two participants
 * and a complete 6-question Individual round 1 — enough for every command in this
 * unit to have something to act on.
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
  const teamStage = full.stages.find((s) => s.type === "TEAM")!;
  const round1 = individualStage.rounds.find((r) => r.sequence === 1)!;
  const round2 = individualStage.rounds.find((r) => r.sequence === 2)!;
  const teamRound2 = teamStage.rounds.find((r) => r.sequence === 2)!;

  const school = await prisma.school.create({
    data: { competitionId: competition.id, name: `School ${suffix}`, sequence: 1 },
  });

  const participantA = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Player A ${suffix}`,
      participantNumber: 1,
      sequence: 1,
    },
  });
  const participantB = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Player B ${suffix}`,
      participantNumber: 2,
      sequence: 2,
    },
  });

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });

  let questionId = "";
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

  // Criterion 6's "no range restriction" is only a meaningful claim if a range
  // exists for the controller to skip: the suite's judge account is bound to the
  // shared judge row, which is assigned participant numbers 1–1 only. Publish
  // readiness (condition 4) needs every participant number covered, so a second,
  // account-less judge row covers number 2 without widening the first one.
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: sharedJudgeId,
      fromParticipantNumber: 1,
      toParticipantNumber: 1,
    },
  });
  const coveringJudge = await prisma.judge.create({
    data: { name: `Judge Cover ${suffix}` },
  });
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: coveringJudge.id,
      fromParticipantNumber: 2,
      toParticipantNumber: 2,
    },
  });

  await competitionService.publishCompetition(competition.id);

  for (const participant of [participantA, participantB]) {
    await prisma.roundParticipation.create({
      data: {
        roundId: round1.id,
        participantId: participant.id,
        categoryId: category.id,
        state: "ACTIVE",
      },
    });
  }

  return {
    competitionId: competition.id,
    stageId: individualStage.id,
    teamStageId: teamStage.id,
    roundId: round1.id,
    round2Id: round2.id,
    teamRound2Id: teamRound2.id,
    categoryId: category.id,
    schoolId: school.id,
    questionId,
    participantId: participantA.id,
  };
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  const judgeRow = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  sharedJudgeId = judgeRow.id;
  await createAccount(users.judge, "JUDGE", undefined, sharedJudgeId);

  expect(controllerToken).toBeTruthy();
}, 20000);

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

function ctl(req: request.Test): request.Test {
  return authed(req, controllerToken, controllerDevice);
}

/** Force a seeded competition into a live, timed round-1 active phase. */
async function forceRoundActive(ctx: SeededCompetition, durationSeconds = 1200): Promise<void> {
  await prisma.competition.update({
    where: { id: ctx.competitionId },
    data: { status: "ROUND_ACTIVE", startedAt: new Date() },
  });
  await prisma.stage.update({ where: { id: ctx.stageId }, data: { status: "ACTIVE" } });
  await prisma.round.update({
    where: { id: ctx.roundId },
    data: { status: "ACTIVE", startedAt: new Date() },
  });
  await prisma.competitionRuntimeState.upsert({
    where: { competitionId: ctx.competitionId },
    create: {
      competitionId: ctx.competitionId,
      currentStageId: ctx.stageId,
      currentRoundId: ctx.roundId,
      phase: "ROUND_ACTIVE",
    },
    update: {
      currentStageId: ctx.stageId,
      currentRoundId: ctx.roundId,
      phase: "ROUND_ACTIVE",
    },
  });
  await roundTimerService.startRoundTimer(
    ctx.roundId,
    ctx.competitionId,
    ctx.stageId,
    durationSeconds,
  );
}

// ---------------------------------------------------------------------------
// Criterion 1 — start a stage
// ---------------------------------------------------------------------------

describe("start a stage (acceptance criterion 1)", () => {
  it("begins round 1's preparation and sets the screens back to RANKING", async () => {
    const ctx = await seedCompetition(`StartStage ${suffix}`);

    const res = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.stageId}/start`),
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PREPARATION");
    expect(res.body.roundId).toBe(ctx.roundId);
    expect(res.body.preparationSeconds).toBe(60);

    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("PREPARATION");
    expect(competition.startedAt).not.toBeNull();

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("PREPARATION");

    // The screens show the ranking again (Detail 9: a new stage leaves FINAL/PAUSED).
    const mode = await ctl(request(app).get(`/api/competitions/${ctx.competitionId}/big-screen/mode`));
    expect(mode.body.mode).toBe("RANKING");

    // Leave nothing ticking for the rest of the suite.
    await roundTimerService.cancelPreparation(ctx.roundId);
  }, 15000);

  it("rejects a stage that is not WAITING, and one that is out of sequence", async () => {
    const ctx = await seedCompetition(`StartTwice ${suffix}`);
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.stageId}/start`));

    const again = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.stageId}/start`),
    );
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("orchestrator.stageNotWaiting");

    // The Team stage is sequence 2; its stage 1 has not finished (RND-06).
    const outOfSequence = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.teamStageId}/start`),
    );
    expect(outOfSequence.status).toBe(409);
    expect(outOfSequence.body.error.code).toBe("orchestrator.stageOutOfSequence");

    await roundTimerService.cancelPreparation(ctx.roundId);
  }, 15000);
});

// ---------------------------------------------------------------------------
// Criterion 2 — global pause / resume
// ---------------------------------------------------------------------------

describe("global pause and resume (acceptance criterion 2)", () => {
  it("freezes the exact remaining time and continues from precisely there", async () => {
    const ctx = await seedCompetition(`PauseResume ${suffix}`);
    await forceRoundActive(ctx, 1200);

    const paused = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/pause`));
    expect(paused.status).toBe(200);
    expect(paused.body.status).toBe("PAUSED");
    const frozen = paused.body.remainingSeconds as number;
    expect(frozen).toBeGreaterThan(0);
    expect(frozen).toBeLessThanOrEqual(1200);

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("PAUSED");

    const runtime = await prisma.competitionRuntimeState.findUniqueOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(runtime.pausedAt).not.toBeNull();
    expect(runtime.remainingSecondsAtPause).toBe(frozen);

    // The screens show PAUSED while the event is frozen (Detail 9).
    const mode = await ctl(request(app).get(`/api/competitions/${ctx.competitionId}/big-screen/mode`));
    expect(mode.body.mode).toBe("PAUSED");

    // Time passes while paused; the frozen value must not move.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const still = await roundTimerService.remaining(ctx.roundId);
    expect(still?.remainingSeconds).toBe(frozen);

    const resumed = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/resume`));
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe("ACTIVE");
    // Resume continues from where it stopped (the 3-2-1 countdown consumes no
    // round time, RND-001), so the reported remaining is the frozen value.
    expect(resumed.body.remainingSeconds).toBe(frozen);

    const cleared = await prisma.competitionRuntimeState.findUniqueOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(cleared.pausedAt).toBeNull();
    expect(cleared.remainingSecondsAtPause).toBeNull();

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);

  it("rejects pause and resume when nothing is running", async () => {
    const ctx = await seedCompetition(`NothingToPause ${suffix}`);

    const paused = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/pause`));
    expect(paused.status).toBe(409);
    expect(paused.body.error.code).toBe("orchestrator.nothingToPause");

    const resumed = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/resume`));
    expect(resumed.status).toBe(409);
    expect(resumed.body.error.code).toBe("orchestrator.nothingToResume");
  }, 15000);
});

// ---------------------------------------------------------------------------
// Criterion 3 — end a round early
// ---------------------------------------------------------------------------

describe("end a round early (acceptance criterion 3)", () => {
  it("auto-submits every still-active participant with CONTROLLER_END and no bonus", async () => {
    const ctx = await seedCompetition(`EndEarly ${suffix}`);
    await forceRoundActive(ctx, 1200);

    const res = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/rounds/${ctx.roundId}/end-early`),
    );
    expect(res.status).toBe(200);
    expect(res.body.alreadyFinished).toBe(false);
    expect(res.body.closedCount).toBe(2);

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("FINISHED");
    expect(round.earlyEnded).toBe(true); // SUB-004: cannot be undone
    expect(round.endedAt).not.toBeNull();

    const participations = await prisma.roundParticipation.findMany({
      where: { roundId: ctx.roundId },
    });
    for (const participation of participations) {
      expect(participation.state).toBe("AUTO_SUBMITTED");
      const attempt = await prisma.attempt.findUniqueOrThrow({
        where: { id: participation.currentAttemptId! },
      });
      expect(attempt.submissionType).toBe("CONTROLLER_END");
      expect(attempt.bonus).toBe(0); // no early bonus, by construction
    }

    // Unit 08's advance chain still runs: round 2 goes to preparation.
    const round2 = await prisma.round.findUniqueOrThrow({ where: { id: ctx.round2Id } });
    expect(round2.status).toBe("PREPARATION");
    await roundTimerService.cancelPreparation(ctx.round2Id);
  }, 20000);

  it("a second call is a no-op, not an undo", async () => {
    const ctx = await seedCompetition(`EndEarlyTwice ${suffix}`);
    await forceRoundActive(ctx, 1200);
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/rounds/${ctx.roundId}/end-early`));

    const again = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/rounds/${ctx.roundId}/end-early`),
    );
    expect(again.status).toBe(200);
    expect(again.body.alreadyFinished).toBe(true);
    expect(again.body.closedCount).toBe(0);

    await roundTimerService.cancelPreparation(ctx.round2Id);
  }, 20000);

  it("rejects ending a round that never started", async () => {
    const ctx = await seedCompetition(`EndWaiting ${suffix}`);
    const res = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/rounds/${ctx.round2Id}/end-early`),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("orchestrator.roundNotRunning");
  }, 15000);

  it("rejects a round that belongs to another competition", async () => {
    const a = await seedCompetition(`CrossA ${suffix}`);
    const b = await seedCompetition(`CrossB ${suffix}`);
    const res = await ctl(
      request(app).post(`/api/competitions/${a.competitionId}/rounds/${b.roundId}/end-early`),
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("orchestrator.roundNotInCompetition");
  }, 15000);
});

// ---------------------------------------------------------------------------
// Criterion 4 — finish the competition early
// ---------------------------------------------------------------------------

describe("finish early (acceptance criterion 4)", () => {
  it("marks the competition FINISHED with finishedEarly = true and leaves no timer", async () => {
    const ctx = await seedCompetition(`FinishEarly ${suffix}`);
    await forceRoundActive(ctx, 1200);

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/finish-early`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINISHED");
    expect(res.body.finishedEarly).toBe(true);
    expect(res.body.closedCount).toBe(2);

    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("FINISHED");
    expect(competition.finishedEarly).toBe(true);
    expect(competition.finishedAt).not.toBeNull();

    // No live timer, no active round: the event is over.
    expect(await roundTimerService.getActiveRoundId(ctx.competitionId)).toBeNull();
    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("FINISHED");

    // The screens show the final ranking (Detail 9).
    const mode = await ctl(request(app).get(`/api/competitions/${ctx.competitionId}/big-screen/mode`));
    expect(mode.body.mode).toBe("FINAL");

    // Unplayed parts score nothing: round 2 has no results at all.
    const round2Results = await prisma.individualRoundResult.count({
      where: { roundId: ctx.round2Id },
    });
    expect(round2Results).toBe(0);
  }, 20000);

  it("finishes early from a preparation countdown too, and no further command runs", async () => {
    const ctx = await seedCompetition(`FinishEarlyPrep ${suffix}`);
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.stageId}/start`));

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/finish-early`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINISHED");

    // The countdown was abandoned and the round closed early (the finish-early
    // path runs endRoundEarly on whatever round is in flight, preparation
    // included), so it never enters its active phase but is durably ended.
    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.roundId } });
    expect(round.status).toBe("FINISHED");
    expect(round.earlyEnded).toBe(true);
    expect(await roundTimerService.getActiveRoundId(ctx.competitionId)).toBeNull();

    const start = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.stageId}/start`),
    );
    expect(start.status).toBe(409);
    expect(start.body.error.code).toBe("orchestrator.competitionClosed");
  }, 20000);
});

// ---------------------------------------------------------------------------
// Criterion 5 — reset / rematch at the four scopes
// ---------------------------------------------------------------------------

describe("reset and rematch (acceptance criterion 5)", () => {
  it("PARTICIPANT scope archives the prior attempt and grants the FULL duration", async () => {
    const ctx = await seedCompetition(`RematchParticipant ${suffix}`);
    // A 100 s live timer, so "full duration again" is observably different from
    // "remaining time". The rematch grants the round's *configured* duration
    // (buildStructure gives Individual round 1 1200 s), not the 100 s the timer
    // was started with and not whatever remained — that distinction is what
    // ROL-005 / U-13 exists for.
    await forceRoundActive(ctx, 100);

    // Unit 04 owns the import that would normally give a participation its first
    // attempt, so seed one here: archiving "the prior attempt" is only a real
    // claim when one exists. This is the in-flight, unsubmitted attempt a player
    // is working on when the controller resets them.
    const seeded = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    const priorAttempt = await prisma.attempt.create({
      data: {
        roundParticipationId: seeded.id,
        attemptNumber: 1,
        submissionType: "MANUAL",
        submittedAt: new Date(),
      },
    });
    await prisma.roundParticipation.update({
      where: { id: seeded.id },
      data: { currentAttemptId: priorAttempt.id },
    });

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "PARTICIPANT", participantId: ctx.participantId });
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe("PARTICIPANT");
    expect(res.body.roundIds).toEqual([ctx.roundId]);
    expect(res.body.restartedCount).toBe(1);
    expect(res.body.grantedSeconds).toBe(1200); // the round's configured full duration

    const participation = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    // attemptCount counts restarts, not attempts, so the first reset reads 1.
    expect(participation.attemptCount).toBe(1);

    const attempts = await prisma.attempt.findMany({
      where: { roundParticipationId: participation.id },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.id).toBe(priorAttempt.id);
    expect(attempts[0]!.isArchived).toBe(true); // archived, never deleted
    expect(attempts[1]!.isArchived).toBe(false);
    expect(participation.currentAttemptId).toBe(attempts[1]!.id);

    // The other participant in the round was untouched.
    const others = await prisma.roundParticipation.findMany({
      where: { roundId: ctx.roundId, participantId: { not: ctx.participantId } },
    });
    for (const other of others) expect(other.attemptCount).toBe(0);

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);

  it("ROUND scope restarts everyone in the round", async () => {
    const ctx = await seedCompetition(`RematchRound ${suffix}`);
    await forceRoundActive(ctx, 100);

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "ROUND", roundId: ctx.roundId });
    expect(res.status).toBe(200);
    expect(res.body.restartedCount).toBe(2);

    const participations = await prisma.roundParticipation.findMany({
      where: { roundId: ctx.roundId },
    });
    for (const participation of participations) {
      expect(participation.attemptCount).toBe(1);
      expect(participation.state).toBe("ACTIVE");
    }

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);

  it("EVENT scope acts on the round currently in flight", async () => {
    const ctx = await seedCompetition(`RematchEvent ${suffix}`);
    await forceRoundActive(ctx, 100);

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "EVENT" });
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe("EVENT");
    expect(res.body.roundIds).toEqual([ctx.roundId]);
    expect(res.body.restartedCount).toBe(2);

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);

  it("TEAM scope restarts the team's members only", async () => {
    const ctx = await seedCompetition(`RematchTeam ${suffix}`);
    await forceRoundActive(ctx, 100);

    // Team data is Units 13/14's runtime, but the scope itself is built now, so
    // seed the minimum a team needs: the row and its member link.
    const team = await prisma.team.create({
      data: {
        competitionId: ctx.competitionId,
        categoryId: ctx.categoryId,
        schoolId: ctx.schoolId,
        name: `Team ${suffix}`,
        sequence: 1,
      },
    });
    await prisma.participant.update({
      where: { id: ctx.participantId },
      data: { teamId: team.id },
    });

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "TEAM", teamId: team.id });
    expect(res.status).toBe(200);
    expect(res.body.restartedCount).toBe(1);

    const inTeam = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: ctx.participantId },
    });
    expect(inTeam.attemptCount).toBe(1);

    const notInTeam = await prisma.roundParticipation.findMany({
      where: { roundId: ctx.roundId, participantId: { not: ctx.participantId } },
    });
    for (const row of notInTeam) expect(row.attemptCount).toBe(0);

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);

  it("is rejected when no round is running, and on a FINISHED competition", async () => {
    const ctx = await seedCompetition(`RematchRejected ${suffix}`);

    const nothing = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "EVENT" });
    expect(nothing.status).toBe(409);
    expect(nothing.body.error.code).toBe("orchestrator.roundNotRunning");

    await forceRoundActive(ctx, 100);
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/finish-early`));

    const finished = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "EVENT" });
    expect(finished.status).toBe(409);
    expect(finished.body.error.code).toBe("orchestrator.competitionClosed");
  }, 20000);

  it("is rejected on a CANCELLED competition", async () => {
    const ctx = await seedCompetition(`RematchCancelled ${suffix}`);
    await forceRoundActive(ctx, 100);
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/cancel`));

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/reset-rematch`))
      .send({ scope: "EVENT" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("orchestrator.competitionClosed");
  }, 20000);
});

// ---------------------------------------------------------------------------
// Criterion 6 — the controller's judge-equivalent access
// ---------------------------------------------------------------------------

describe("controller supervision access (acceptance criterion 6)", () => {
  it("lists every participant of a competition and restarts one outside any judge range", async () => {
    const ctx = await seedCompetition(`ControllerSupervise ${suffix}`);
    await forceRoundActive(ctx, 1200);

    const listed = await ctl(
      request(app).get(`/api/judge/students?competitionId=${ctx.competitionId}`),
    );
    expect(listed.status).toBe(200);
    expect(listed.body.students).toHaveLength(2);

    // Participant number 2 is outside the seeded judge's range (1–1). The
    // controller reaches it anyway, with no takeover step.
    const outside = await prisma.participant.findFirstOrThrow({
      where: { competitionId: ctx.competitionId, participantNumber: 2 },
    });
    const res = await ctl(
      request(app).post(`/api/judge/students/${outside.id}/restart`),
    );
    expect(res.status).toBe(200);
    expect(res.body.attemptCount).toBe(1);

    const restarted = await prisma.roundParticipation.findFirstOrThrow({
      where: { roundId: ctx.roundId, participantId: outside.id },
    });
    expect(restarted.attemptCount).toBe(1);

    // The restart is auditable under the controller's own action.
    const audit = await prisma.auditLog.findFirst({
      where: {
        competitionId: ctx.competitionId,
        action: "orchestrator.participant.restart",
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.targetId).toBe(outside.id);

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);

  it("a judge still cannot reach a participant outside its range", async () => {
    const ctx = await seedCompetition(`JudgeRange ${suffix}`);
    await forceRoundActive(ctx, 1200);

    const judgeLogin = await login("judge", users.judge);
    const outside = await prisma.participant.findFirstOrThrow({
      where: { competitionId: ctx.competitionId, participantNumber: 2 },
    });
    const res = await authed(
      request(app).post(`/api/judge/students/${outside.id}/restart`),
      judgeLogin.body.token,
      judgeLogin.body.deviceId,
    );
    expect(res.status).toBe(403);

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 20000);
});

// ---------------------------------------------------------------------------
// Criterion 7 — cancel
// ---------------------------------------------------------------------------

describe("cancel (acceptance criterion 7)", () => {
  it("is terminal from WAITING, and from a live round, and blocks every later command", async () => {
    const waiting = await seedCompetition(`CancelWaiting ${suffix}`);
    const res = await ctl(request(app).post(`/api/competitions/${waiting.competitionId}/cancel`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
    expect(res.body.cancelledAt).toBeTruthy();

    const row = await prisma.competition.findUniqueOrThrow({
      where: { id: waiting.competitionId },
    });
    expect(row.status).toBe("CANCELLED");
    expect(row.cancelledAt).not.toBeNull();
    expect(row.finishedAt).toBeNull(); // a distinct terminal state, not FINISHED

    const live = await seedCompetition(`CancelLive ${suffix}`);
    await forceRoundActive(live, 1200);
    const liveRes = await ctl(request(app).post(`/api/competitions/${live.competitionId}/cancel`));
    expect(liveRes.status).toBe(200);
    expect(await roundTimerService.getActiveRoundId(live.competitionId)).toBeNull();

    for (const path of [
      "/pause",
      "/resume",
      "/finish-early",
      "/reset-rematch",
      `/stages/${live.stageId}/start`,
      `/rounds/${live.roundId}/end-early`,
    ]) {
      const blocked = await ctl(request(app).post(`/api/competitions/${live.competitionId}${path}`))
        .send(path === "/reset-rematch" ? { scope: "EVENT" } : {});
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe("orchestrator.competitionClosed");
    }

    // A second cancel is rejected, not silently repeated.
    const twice = await ctl(request(app).post(`/api/competitions/${live.competitionId}/cancel`));
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe("orchestrator.competitionClosed");
  }, 25000);

  it("cannot cancel a competition that already finished", async () => {
    const ctx = await seedCompetition(`CancelFinished ${suffix}`);
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/finish-early`));

    const res = await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/cancel`));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("orchestrator.competitionClosed");
  }, 20000);

  it("404s on an unknown competition", async () => {
    const res = await ctl(request(app).post("/api/competitions/does-not-exist/cancel"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("competition.notFound");
  }, 15000);
});

// ---------------------------------------------------------------------------
// Criterion 8 — the natural finish
// ---------------------------------------------------------------------------

describe("natural finish (acceptance criterion 8)", () => {
  it("the last stage's last round finishing sets FINISHED with finishedEarly = false", async () => {
    const ctx = await seedCompetition(`NaturalFinish ${suffix}`);

    // Drive the last stage's last round to its end. No participations exist for
    // the Team stage yet (Units 13/14), so the round closes with nothing to score
    // and the stage-finish check runs — which is what criterion 8 is about.
    await prisma.round.update({
      where: { id: ctx.teamRound2Id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(
      ctx.teamRound2Id,
      ctx.competitionId,
      ctx.teamStageId,
      1200,
    );
    await gameplayService.handleRoundEnded({
      roundId: ctx.teamRound2Id,
      stageId: ctx.teamStageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const stage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.teamStageId } });
    expect(stage.status).toBe("FINISHED");

    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("FINISHED");
    expect(competition.finishedEarly).toBe(false);
    expect(competition.finishedAt).not.toBeNull();

    const runtime = await prisma.competitionRuntimeState.findUniqueOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(runtime.phase).toBe("FINISHED");

    // Detail 9: the natural finish switches the screens to FINAL by itself.
    const mode = await ctl(request(app).get(`/api/competitions/${ctx.competitionId}/big-screen/mode`));
    expect(mode.body.mode).toBe("FINAL");
  }, 20000);

  it("a non-last stage finishing leaves the competition open for the controller", async () => {
    const ctx = await seedCompetition(`StageFinish ${suffix}`);
    await prisma.round.update({
      where: { id: ctx.round2Id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    await roundTimerService.startRoundTimer(ctx.round2Id, ctx.competitionId, ctx.stageId, 1200);
    await gameplayService.handleRoundEnded({
      roundId: ctx.round2Id,
      stageId: ctx.stageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    // RND-06: the next stage never starts by itself.
    expect(competition.status).toBe("STAGE_FINISHED");
    expect(competition.finishedEarly).toBe(false);

    const teamStage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.teamStageId } });
    expect(teamStage.status).toBe("WAITING");
  }, 20000);
});

// ---------------------------------------------------------------------------
// Big-screen display control (Detail 9, BSC-002)
// ---------------------------------------------------------------------------

describe("big-screen display control", () => {
  it("sets PAUSED, FINAL and a pinned RANKING category, and reads the state back", async () => {
    const ctx = await seedCompetition(`BigScreenMode ${suffix}`);

    const paused = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "PAUSED" });
    expect(paused.status).toBe(200);
    expect(paused.body.mode).toBe("PAUSED");

    const final = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "FINAL" });
    expect(final.body.mode).toBe("FINAL");

    // A pinned category with rotation off; the fields left out keep their value.
    const pinned = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "RANKING", targetId: ctx.categoryId, rotationEnabled: false });
    expect(pinned.body.mode).toBe("RANKING");
    expect(pinned.body.targetId).toBe(ctx.categoryId);
    expect(pinned.body.rotationEnabled).toBe(false);

    const read = await ctl(request(app).get(`/api/competitions/${ctx.competitionId}/big-screen/mode`));
    expect(read.body).toEqual({
      competitionId: ctx.competitionId,
      mode: "RANKING",
      targetId: ctx.categoryId,
      rotationEnabled: false,
    });

    // Changing only the rotation flag leaves the pinned category alone.
    const rotate = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "RANKING", rotationEnabled: true });
    expect(rotate.body.targetId).toBe(ctx.categoryId);
    expect(rotate.body.rotationEnabled).toBe(true);
  }, 20000);

  it("rejects a mode this unit cannot render", async () => {
    const ctx = await seedCompetition(`BigScreenBadMode ${suffix}`);
    const res = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "PLAYER_CLOSEUP" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("bigScreen.invalidMode");

    const nonsense = await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "SOMETHING_ELSE" });
    expect(nonsense.status).toBe(400);
    expect(nonsense.body.error.code).toBe("bigScreen.invalidMode");
  }, 15000);
});

// ---------------------------------------------------------------------------
// Criterion 9 — role enforcement
// ---------------------------------------------------------------------------

describe("role enforcement (acceptance criterion 9)", () => {
  const COMMANDS: Array<[string, string, Record<string, unknown>]> = [
    ["post", "/stages/stage-id/start", {}],
    ["post", "/pause", {}],
    ["post", "/resume", {}],
    ["post", "/rounds/round-id/end-early", {}],
    ["post", "/finish-early", {}],
    ["post", "/reset-rematch", { scope: "EVENT" }],
    ["post", "/cancel", {}],
    ["post", "/big-screen/mode", { mode: "PAUSED" }],
    ["get", "/big-screen/mode", {}],
  ];

  it("rejects every command from an anonymous, player and judge session", async () => {
    const ctx = await seedCompetition(`RoleEnforcement ${suffix}`);
    await forceRoundActive(ctx, 1200);

    const participantAccount = `${users.player}-role`;
    await createAccount(participantAccount, "PLAYER", ctx.participantId);
    const player = await login("player", participantAccount);
    const judge = await login("judge", users.judge);

    for (const [method, path, body] of COMMANDS) {
      const url = `/api/competitions/${ctx.competitionId}${path}`;

      const anonymous = await request(app)[method as "post" | "get"](url).send(body);
      expect(anonymous.status).toBe(401);

      const asPlayer = await authed(
        request(app)[method as "post" | "get"](url),
        player.body.token,
        player.body.deviceId,
      ).send(body);
      expect(asPlayer.status).toBe(403);
      expect(asPlayer.body.error.code).toBe("orchestrator.forbidden");

      const asJudge = await authed(
        request(app)[method as "post" | "get"](url),
        judge.body.token,
        judge.body.deviceId,
      ).send(body);
      expect(asJudge.status).toBe(403);
      expect(asJudge.body.error.code).toBe("orchestrator.forbidden");
    }

    // Nothing above changed the competition's state.
    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("ROUND_ACTIVE");

    await roundTimerService.stopRoundEarly(ctx.roundId);
    await roundTimerService.cancelPreparation(ctx.round2Id);
  }, 25000);

  it("writes one AuditLog row per accepted command (Security Considerations)", async () => {
    const ctx = await seedCompetition(`AuditTrail ${suffix}`);

    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/stages/${ctx.stageId}/start`));
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/pause`));
    await ctl(request(app).post(`/api/competitions/${ctx.competitionId}/resume`));
    await ctl(
      request(app).post(`/api/competitions/${ctx.competitionId}/big-screen/mode`),
    ).send({ mode: "PAUSED" });

    const actions = await prisma.auditLog.findMany({
      where: { competitionId: ctx.competitionId },
      select: { action: true, actorAccountId: true },
      orderBy: { at: "asc" },
    });
    expect(actions.map((a) => a.action)).toEqual([
      "orchestrator.stage.start",
      "orchestrator.pause",
      "orchestrator.resume",
      "orchestrator.bigScreen.setMode",
    ]);
    const controllerAccount = await prisma.account.findUniqueOrThrow({
      where: { username: users.controller },
    });
    for (const row of actions) expect(row.actorAccountId).toBe(controllerAccount.id);

    await roundTimerService.stopRoundEarly(ctx.roundId);
  }, 25000);
});
