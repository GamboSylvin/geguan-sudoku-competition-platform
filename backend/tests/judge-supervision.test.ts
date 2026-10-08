import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { roundTimerService } from "../src/modules/round";

/**
 * Unit 10 integration tests: the judge's supervision view (status rows scoped
 * strictly to the judge's own assigned range) and the single-student restart
 * (archives the current attempt, blanks the grid, keeps the round's shared
 * timer unchanged, increments the restart-visible attemptCount). The judge
 * has no other powers (U-55). Unit 11's Detail 6 adds one exception: a
 * CONTROLLER session reaches these same endpoints with no range restriction,
 * because the controller drives the whole event. The tests below assert both
 * sides of that — the controller's wider view, and that every other role is
 * still refused.
 *
 * They run against the real database and Redis the CI provisions; everything
 * created here is removed afterwards. Round status is driven through the
 * dev-only trigger and direct Prisma updates — same pattern as Unit 07's
 * round.test.ts — because Unit 10 does not own the lifecycle commands.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it10-controller-${suffix}`,
  player: `it10-player-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";
let playerToken = "";
let playerDevice = "";

const createdCompetitionIds: string[] = [];
const createdJudgeIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdSchoolIds: string[] = [];

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
}

function login(role: "controller" | "judge" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

function authedController(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

/**
 * A published (WAITING) competition with two participants — one inside the
 * judge's range and one outside — and one 4x4 question on stage 1 round 1.
 * Participation rows are seeded directly (Unit 04 owns the real import).
 */
async function makeCompetitionWithTwoParticipants(name: string, judgeRange: { from: number; to: number }) {
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
  createdSchoolIds.push(school.id);

  // The in-range participant (#1) and the out-of-range participant (#99).
  const inRange = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `In Range ${suffix}`,
      participantNumber: judgeRange.from,
      sequence: 1,
    },
  });
  const outOfRange = await prisma.participant.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Out Of Range ${suffix}`,
      participantNumber: 99,
      sequence: 2,
    },
  });
  createdParticipantIds.push(inRange.id, outOfRange.id);

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });
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

  // The judge under test is assigned [judgeRange.from, judgeRange.to] — does not
  // cover #99. A second judge covers the rest so the publish-readiness check
  // ("every active participant number is inside some judge's range") passes.
  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix} ${name}` } });
  createdJudgeIds.push(judge.id);
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: judge.id,
      fromParticipantNumber: judgeRange.from,
      toParticipantNumber: judgeRange.to,
    },
  });
  const other = await prisma.judge.create({ data: { name: `Other ${suffix} ${name}` } });
  createdJudgeIds.push(other.id);
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: other.id,
      fromParticipantNumber: judgeRange.to + 1,
      toParticipantNumber: 1000,
    },
  });

  await competitionService.publishCompetition(competition.id);

  await prisma.roundParticipation.create({
    data: { roundId: round1.id, participantId: inRange.id, categoryId: category.id },
  });
  await prisma.roundParticipation.create({
    data: { roundId: round1.id, participantId: outOfRange.id, categoryId: category.id },
  });

  return {
    competitionId: competition.id,
    judgeId: judge.id,
    inRangeParticipantId: inRange.id,
    outOfRangeParticipantId: outOfRange.id,
    roundId: round1.id,
  };
}

/** Log in as the named judge and return the session token/device pair. */
async function loginAsJudge(judgeId: string): Promise<{ token: string; deviceId: string }> {
  const username = `it10-judge-${judgeId.slice(0, 6)}-${suffix}`;
  await createAccount(username, "JUDGE", undefined, judgeId);
  const res = await login("judge", username);
  return { token: res.body.token as string, deviceId: res.body.deviceId as string };
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  // A player proves the judge endpoints still reject every role except the two
  // the spec allows (judge, and controller since Unit 11 Detail 6).
  await createAccount(users.player, "PLAYER");
  const player = await login("player", users.player);
  playerToken = player.body.token;
  playerDevice = player.body.deviceId;
});

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { judgeId: { in: createdJudgeIds } } });
  await prisma.judge.deleteMany({ where: { id: { in: createdJudgeIds } } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  // Judge accounts created dynamically inside tests
  await prisma.account.deleteMany({ where: { username: { startsWith: `it10-judge-` } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("status view (AC 1, 2, 6)", () => {
  it("returns status rows only for participants inside the judge's assigned range", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`Status ${suffix}`, { from: 1, to: 10 });
    const judge = await loginAsJudge(ctx.judgeId);

    const res = await request(app)
      .get("/api/judge/students")
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId);
    expect(res.status).toBe(200);

    const students = res.body.students as {
      participantId: string;
      participantNumber: number;
      participantName: string;
      connected: boolean;
      leftAnswerPageCount: number;
      attemptCount: number;
    }[];
    // Only the in-range participant shows up; #99 is never read.
    expect(students).toHaveLength(1);
    expect(students[0]!.participantId).toBe(ctx.inRangeParticipantId);
    expect(students[0]!.participantNumber).toBe(1);
    expect(students[0]!.connected).toBe(false); // no device logged in
    expect(students[0]!.leftAnswerPageCount).toBe(0);
    expect(students[0]!.attemptCount).toBe(0);
  });

  it("returns an empty list for a judge with no assignments", async () => {
    // A judge with no assignment anywhere.
    const lonely = await prisma.judge.create({ data: { name: `Lonely ${suffix}` } });
    createdJudgeIds.push(lonely.id);
    const judge = await loginAsJudge(lonely.id);

    const res = await request(app)
      .get("/api/judge/students")
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId);
    expect(res.status).toBe(200);
    expect(res.body.students).toEqual([]);
  });

  // Unit 11 spec Detail 6 reverses Unit 10's judge-only rule for this one role:
  // the controller drives the event and must see every student, not just one
  // judge's range. It names the competition instead, because it has no range.
  it("gives a controller session every student in the competition, not one judge's range (Unit 11 Detail 6)", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`Controller status ${suffix}`, {
      from: 1,
      to: 10,
    });

    const res = await authedController(
      request(app).get(`/api/judge/students?competitionId=${ctx.competitionId}`),
    );
    expect(res.status).toBe(200);

    const ids = (res.body.students as { participantId: string }[]).map((s) => s.participantId);
    // Both participants are visible: the out-of-range one a judge would never see.
    expect(ids).toContain(ctx.inRangeParticipantId);
    expect(ids).toContain(ctx.outOfRangeParticipantId);
  });

  it("rejects a controller session that names no competition, because there is nothing to scope to", async () => {
    const res = await authedController(request(app).get("/api/judge/students"));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("competition.notFound");
  });

  it("still rejects a session that is neither judge nor controller (U-55)", async () => {
    const playerRes = await request(app)
      .get("/api/judge/students")
      .set("x-session-token", playerToken)
      .set("x-device-id", playerDevice);
    expect(playerRes.status).toBe(403);
    expect(playerRes.body.error.code).toBe("judgeSupervision.forbidden");
  });

  it("rejects an unauthenticated call", async () => {
    const res = await request(app).get("/api/judge/students");
    expect(res.status).toBe(401);
  });
});

describe("single-student restart (AC 3, 4, 5)", () => {
  it("archives the current attempt, blanks the grid, keeps the shared timer, and bumps the restart count", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`Restart ${suffix}`, { from: 1, to: 10 });
    const judge = await loginAsJudge(ctx.judgeId);

    // Start the round and flip it ACTIVE.
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });

    // Capture the timer before the restart so we can prove the shared clock
    // was not touched (allowing a small race window for the read itself).
    const timerBefore = await roundTimerService.remaining(ctx.roundId);
    expect(timerBefore).not.toBeNull();

    const res = await request(app)
      .post(`/api/judge/students/${ctx.inRangeParticipantId}/restart`)
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.attemptCount).toBe(1);
    expect(res.body.totalSeconds).toBe(timerBefore!.totalSeconds);
    // The remaining seconds on the shared timer are unaffected (within a 2s
    // race window for the two reads).
    expect(res.body.remainingSeconds).toBeGreaterThanOrEqual(timerBefore!.remainingSeconds - 2);
    expect(res.body.remainingSeconds).toBeLessThanOrEqual(timerBefore!.remainingSeconds + 1);

    // The participation now points at the new active attempt; the old one is archived.
    const participation = await prisma.roundParticipation.findUniqueOrThrow({
      where: {
        roundId_participantId: {
          roundId: ctx.roundId,
          participantId: ctx.inRangeParticipantId,
        },
      },
    });
    expect(participation.attemptCount).toBe(1);
    expect(participation.state).toBe("ACTIVE");
    expect(participation.currentAttemptId).not.toBeNull();

    const attempts = await prisma.attempt.findMany({
      where: { roundParticipationId: participation.id },
      orderBy: { attemptNumber: "asc" },
    });
    // The participation was created without an attempt (Unit 04 owns the import
    // that creates them), so the restart's first attempt is also the first row.
    // It is the current one, not archived.
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.isArchived).toBe(false);
    expect(participation.currentAttemptId).toBe(attempts[0]!.id);

    // The shared round timer row in Redis was NOT reset: it still sits close to
    // the configured duration, not at a fresh full-duration deadline.
    const timerAfter = await roundTimerService.remaining(ctx.roundId);
    expect(timerAfter).not.toBeNull();
    expect(timerAfter!.totalSeconds).toBe(timerBefore!.totalSeconds);
  }, 10000);

  it("rejects a restart for a participant outside the judge's range", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`OutOfRange ${suffix}`, { from: 1, to: 10 });
    const judge = await loginAsJudge(ctx.judgeId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });

    const res = await request(app)
      .post(`/api/judge/students/${ctx.outOfRangeParticipantId}/restart`)
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("judgeSupervision.outOfRange");
  });

  it("rejects a restart when the round is not running", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`NotRunning ${suffix}`, { from: 1, to: 10 });
    const judge = await loginAsJudge(ctx.judgeId);

    // No trigger fired — competition is still WAITING, no current round.
    const res = await request(app)
      .post(`/api/judge/students/${ctx.inRangeParticipantId}/restart`)
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("orchestrator.roundNotRunning");
  });

  it("supports a repeated restart on the same participation", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`Twice ${suffix}`, { from: 1, to: 10 });
    const judge = await loginAsJudge(ctx.judgeId);

    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });

    const first = await request(app)
      .post(`/api/judge/students/${ctx.inRangeParticipantId}/restart`)
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.attemptCount).toBe(1);

    const second = await request(app)
      .post(`/api/judge/students/${ctx.inRangeParticipantId}/restart`)
      .set("x-session-token", judge.token)
      .set("x-device-id", judge.deviceId)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.attemptCount).toBe(2);

    const attempts = await prisma.attempt.findMany({
      where: {
        roundParticipation: {
          roundId: ctx.roundId,
          participantId: ctx.inRangeParticipantId,
        },
      },
      orderBy: { attemptNumber: "asc" },
    });
    // Two attempts total: the first (created by the first restart, archived by
    // the second) and the current one.
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.isArchived).toBe(true);
    expect(attempts[1]!.isArchived).toBe(false);
  });

  // The controller restarts a student no judge can see, on the same code path a
  // judge uses (Unit 11 Detail 6), and the spec's Security Considerations require
  // that takeover to leave its own AuditLog row even though there is no dedicated
  // "takeover" state.
  it("restarts an out-of-range student for a controller session and logs the takeover", async () => {
    const ctx = await makeCompetitionWithTwoParticipants(`Controller restart ${suffix}`, {
      from: 1,
      to: 10,
    });
    await authedController(request(app).post("/api/rounds/dev/start-stage1-round1")).send({
      competitionId: ctx.competitionId,
    });
    await prisma.round.update({ where: { id: ctx.roundId }, data: { status: "ACTIVE" } });

    const res = await authedController(
      request(app).post(`/api/judge/students/${ctx.outOfRangeParticipantId}/restart`),
    ).send({});
    expect(res.status).toBe(200);
    expect(res.body.attemptCount).toBe(1);

    const audit = await prisma.auditLog.findMany({
      where: {
        competitionId: ctx.competitionId,
        action: "orchestrator.participant.restart",
        targetId: ctx.outOfRangeParticipantId,
      },
    });
    expect(audit).toHaveLength(1);
  });

  it("rejects a restart from a session that is neither judge nor controller (U-55)", async () => {
    const res = await request(app)
      .post("/api/judge/students/anything/restart")
      .set("x-session-token", playerToken)
      .set("x-device-id", playerDevice)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("judgeSupervision.forbidden");
  });
});
