import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";

/**
 * Unit 06 integration tests: the judge list (create with one-time credentials,
 * list, removal with the ROL-010 guard), range assignment (BLD-008 — editable at
 * any time, one assignment per judge per competition), the authority-scoping check
 * Unit 10 will call, and controller-only access (ROL-002). They run against the
 * real database the CI provisions. Everything created here is removed afterwards.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it6-controller-${suffix}`,
  judge: `it6-judge-${suffix}`,
  player: `it6-player-${suffix}`,
};

const createdCompetitionIds: string[] = [];
const createdJudgeIds: string[] = [];
let controllerToken = "";
let controllerDevice = "";
let judgeToken = "";
let judgeDevice = "";

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
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

function login(role: "controller" | "judge" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

async function makeCompetition(name: string) {
  const res = await authed(request(app).post("/api/competitions")).send({
    name,
    categories: [{ code: "U8", name: "Under 8" }],
  });
  createdCompetitionIds.push(res.body.id);
  return res.body as { id: string; name: string };
}

function authed(req: request.Test): request.Test {
  return req
    .set("x-session-token", controllerToken)
    .set("x-device-id", controllerDevice);
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  await createAccount(users.judge, "JUDGE");
  await createAccount(users.player, "PLAYER");

  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  const judge = await login("judge", users.judge);
  judgeToken = judge.body.token;
  judgeDevice = judge.body.deviceId;
});

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { judgeId: { in: createdJudgeIds } } });
  await prisma.judge.deleteMany({ where: { id: { in: createdJudgeIds } } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("create a judge (AC 1)", () => {
  it("creates a judge and returns its one-time credentials", async () => {
    const res = await authed(request(app).post("/api/judges")).send({
      name: `Judge Alice ${suffix}`,
    });
    expect(res.status).toBe(201);
    createdJudgeIds.push(res.body.id);

    expect(res.body.name).toBe(`Judge Alice ${suffix}`);
    expect(res.body.active).toBe(true);
    expect(typeof res.body.username).toBe("string");
    expect(res.body.username.length).toBeGreaterThan(3);
    expect(typeof res.body.password).toBe("string");
    // The random password uses the unambiguous alphabet (no 0/O/1/I).
    expect(res.body.password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);

    // The judge can log in with these credentials through Unit 02's judge endpoint.
    const loginRes = await request(app)
      .post("/api/auth/judge/login")
      .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
      .send({ username: res.body.username, password: res.body.password });
    expect(loginRes.status).toBe(200);
  });

  it("lists judges (active and inactive)", async () => {
    const res = await authed(request(app).get("/api/judges")).send();
    expect(res.status).toBe(200);
    const names = (res.body.judges as { name: string }[]).map((j) => j.name);
    expect(names).toContain(`Judge Alice ${suffix}`);
  });
});

describe("range assignment (AC 2)", () => {
  it("assigns a judge a range on a competition and edits it later", async () => {
    const competition = await makeCompetition(`Ranges ${suffix}`);
    const judgeRes = await authed(request(app).post("/api/judges")).send({
      name: `Judge Bob ${suffix}`,
    });
    createdJudgeIds.push(judgeRes.body.id);

    // Create.
    const assigned = await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: judgeRes.body.id, fromParticipantNumber: 1, toParticipantNumber: 50 });
    expect(assigned.status).toBe(201);
    expect(assigned.body.fromParticipantNumber).toBe(1);
    expect(assigned.body.toParticipantNumber).toBe(50);

    // Re-assigning the same judge edits, not duplicates.
    const edited = await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: judgeRes.body.id, fromParticipantNumber: 10, toParticipantNumber: 80 });
    expect(edited.status).toBe(201);
    expect(edited.body.id).toBe(assigned.body.id);
    expect(edited.body.fromParticipantNumber).toBe(10);
    expect(edited.body.toParticipantNumber).toBe(80);

    const count = await prisma.competitionJudgeAssignment.count({
      where: { competitionId: competition.id, judgeId: judgeRes.body.id },
    });
    expect(count).toBe(1);
  });

  it("rejects a range whose from > to", async () => {
    const competition = await makeCompetition(`BadRange ${suffix}`);
    const judgeRes = await authed(request(app).post("/api/judges")).send({
      name: `Judge Carol ${suffix}`,
    });
    createdJudgeIds.push(judgeRes.body.id);

    const res = await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: judgeRes.body.id, fromParticipantNumber: 50, toParticipantNumber: 10 });
    expect(res.status).toBe(400);
  });
});

describe("judge authority scoping (AC 3)", () => {
  it("the exported check authorizes only inside the judge's range and competition", async () => {
    const competition = await makeCompetition(`Scoped ${suffix}`);
    const otherCompetition = await makeCompetition(`Other ${suffix}`);
    const judgeRes = await authed(request(app).post("/api/judges")).send({
      name: `Judge Dave ${suffix}`,
    });
    createdJudgeIds.push(judgeRes.body.id);

    await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: judgeRes.body.id, fromParticipantNumber: 5, toParticipantNumber: 15 });

    const { judgeService } = await import("../src/modules/identity");
    expect(
      await judgeService.isJudgeAuthorizedForParticipant(judgeRes.body.id, competition.id, 5),
    ).toBe(true);
    expect(
      await judgeService.isJudgeAuthorizedForParticipant(judgeRes.body.id, competition.id, 15),
    ).toBe(true);
    expect(
      await judgeService.isJudgeAuthorizedForParticipant(judgeRes.body.id, competition.id, 4),
    ).toBe(false);
    expect(
      await judgeService.isJudgeAuthorizedForParticipant(judgeRes.body.id, competition.id, 16),
    ).toBe(false);
    expect(
      await judgeService.isJudgeAuthorizedForParticipant(judgeRes.body.id, otherCompetition.id, 10),
    ).toBe(false);
  });

  it("the judge's own landing confirms the assignment", async () => {
    const competition = await makeCompetition(`Landing ${suffix}`);
    const judgeRes = await authed(request(app).post("/api/judges")).send({
      name: `Judge Erin ${suffix}`,
    });
    createdJudgeIds.push(judgeRes.body.id);

    await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: judgeRes.body.id, fromParticipantNumber: 1, toParticipantNumber: 20 });

    // Log in as the new judge and hit /api/judges/me.
    const loginRes = await request(app)
      .post("/api/auth/judge/login")
      .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
      .send({ username: judgeRes.body.username, password: judgeRes.body.password });
    expect(loginRes.status).toBe(200);

    const me = await request(app)
      .get("/api/judges/me")
      .set("x-session-token", loginRes.body.token)
      .set("x-device-id", loginRes.body.deviceId);
    expect(me.status).toBe(200);
    const mine = (me.body.assignments as { competitionId: string; fromParticipantNumber: number; toParticipantNumber: number }[]).find(
      (a) => a.competitionId === competition.id,
    );
    expect(mine).toBeDefined();
    expect(mine?.fromParticipantNumber).toBe(1);
    expect(mine?.toParticipantNumber).toBe(20);
  });
});

describe("removal guard (AC 4)", () => {
  it("blocks removal while assigned to an unfinished competition, then allows it after reassignment", async () => {
    const competition = await makeCompetition(`Guarded ${suffix}`);
    const first = await authed(request(app).post("/api/judges")).send({
      name: `Judge Frank ${suffix}`,
    });
    createdJudgeIds.push(first.body.id);
    const second = await authed(request(app).post("/api/judges")).send({
      name: `Judge Grace ${suffix}`,
    });
    createdJudgeIds.push(second.body.id);

    await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: first.body.id, fromParticipantNumber: 1, toParticipantNumber: 30 });

    const blocked = await authed(
      request(app).delete(`/api/judges/${first.body.id}`),
    ).send();
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("judge.hasActiveAssignment");
    const names = (blocked.body.error.details.competitions as { competitionName: string }[]).map(
      (c) => c.competitionName,
    );
    expect(names).toContain(competition.name);

    // Reassign the range to the second judge: the first judge is no longer on this
    // competition, so removal now succeeds. Unassign the first judge directly.
    const assignments = await prisma.competitionJudgeAssignment.findMany({
      where: { competitionId: competition.id, judgeId: first.body.id },
    });
    for (const a of assignments) {
      await authed(
        request(app).delete(`/api/competitions/${competition.id}/judge-assignments/${a.id}`),
      ).send();
    }

    const ok = await authed(request(app).delete(`/api/judges/${first.body.id}`)).send();
    expect(ok.status).toBe(200);
    expect(ok.body.active).toBe(false);
  });

  it("allows removal when every assignment points to a finished or cancelled competition", async () => {
    const competition = await makeCompetition(`Finished ${suffix}`);
    const judgeRes = await authed(request(app).post("/api/judges")).send({
      name: `Judge Helen ${suffix}`,
    });
    createdJudgeIds.push(judgeRes.body.id);

    await authed(
      request(app).post(`/api/competitions/${competition.id}/judge-assignments`),
    ).send({ judgeId: judgeRes.body.id, fromParticipantNumber: 1, toParticipantNumber: 30 });

    // Mark the competition finished directly — Unit 11 owns the real command path.
    await prisma.competition.update({
      where: { id: competition.id },
      data: { status: "FINISHED" },
    });

    const res = await authed(request(app).delete(`/api/judges/${judgeRes.body.id}`)).send();
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });
});

describe("controller-only access (AC 5)", () => {
  it("refuses a judge session on the judge-management endpoints", async () => {
    const createRes = await request(app)
      .post("/api/judges")
      .set("x-session-token", judgeToken)
      .set("x-device-id", judgeDevice)
      .send({ name: "Nope" });
    expect(createRes.status).toBe(403);
    expect(createRes.body.error.code).toBe("judge.forbidden");

    const listRes = await request(app)
      .get("/api/judges")
      .set("x-session-token", judgeToken)
      .set("x-device-id", judgeDevice);
    expect(listRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete("/api/judges/anything")
      .set("x-session-token", judgeToken)
      .set("x-device-id", judgeDevice);
    expect(deleteRes.status).toBe(403);
  });

  it("refuses an unauthenticated call", async () => {
    const res = await request(app).get("/api/judges");
    expect(res.status).toBe(401);
  });
});
