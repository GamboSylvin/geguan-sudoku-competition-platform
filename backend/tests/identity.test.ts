import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

/**
 * Unit 02 integration tests: the three role logins, the generic rejection, the
 * one-active-device takeover, the fixed 24-hour session (no idle expiry), logout,
 * and the WebSocket handshake check. They run against the real database the CI
 * provisions (migrations are applied before the tests), so they exercise the whole
 * stack, not a mock. Accounts are created with a random suffix and removed after.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const usernames = {
  controller: `it-controller-${suffix}`,
  judge: `it-judge-${suffix}`,
  player: `it-player-${suffix}`,
  inactive: `it-inactive-${suffix}`,
};

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
  isActive = true,
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive,
      passwordHash: await identityService.hashPassword(PASSWORD),
    },
  });
}

function login(role: "controller" | "judge" | "player", username: string, password = PASSWORD) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password });
}

beforeAll(async () => {
  await createAccount(usernames.controller, "CONTROLLER");
  await createAccount(usernames.judge, "JUDGE");
  await createAccount(usernames.player, "PLAYER");
  await createAccount(usernames.inactive, "PLAYER", false);
});

afterAll(async () => {
  await prisma.account.deleteMany({
    where: { username: { in: Object.values(usernames) } },
  });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("login", () => {
  it("logs in a controller, a judge and a player, each with its own endpoint", async () => {
    for (const role of ["controller", "judge", "player"] as const) {
      const res = await login(role, usernames[role]);
      expect(res.status).toBe(200);
      expect(res.body.role).toBe(role.toUpperCase());
      expect(typeof res.body.token).toBe("string");
      expect(typeof res.body.deviceId).toBe("string");
      expect(res.body.accountId).toBeTruthy();
    }
  });

  it("sets sessionExpiresAt to login time + 24 hours (AUTH-001)", async () => {
    const before = Date.now();
    const res = await login("player", usernames.player);
    const expires = new Date(res.body.sessionExpiresAt).getTime();
    const hours = (expires - before) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });

  it("rejects a wrong password with one generic message (AUTH-002)", async () => {
    const res = await login("player", usernames.player, "definitely-wrong");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("auth.invalidCredentials");
  });

  it("rejects a deactivated account the same way as a wrong password", async () => {
    const res = await login("player", usernames.inactive);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("auth.invalidCredentials");
  });

  it("does not let a player username through the controller endpoint", async () => {
    const res = await login("controller", usernames.player);
    expect(res.status).toBe(401);
  });
});

describe("login scoped by the entry-link token (report §9c, ARCH-030)", () => {
  const scopedUsernames = {
    playerA: `it-tok-player-a-${suffix}`,
    playerB: `it-tok-player-b-${suffix}`,
  };
  const createdCompetitionIds: string[] = [];
  const createdParticipantIds: string[] = [];
  const createdSchoolIds: string[] = [];

  /** A competition with one participant whose account is `username`. */
  async function makeCompetitionWithPlayer(username: string): Promise<string> {
    const competition = await competitionService.createCompetition({
      name: `Token cup ${username}`,
      categories: [{ code: "U8", name: "Under 8" }],
    });
    createdCompetitionIds.push(competition.id);

    const full = await prisma.competition.findUniqueOrThrow({
      where: { id: competition.id },
      include: { categories: true },
    });
    const school = await prisma.school.create({
      data: { competitionId: competition.id, name: `School ${username}`, sequence: 1 },
    });
    createdSchoolIds.push(school.id);

    const participant = await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: full.categories[0]!.id,
        schoolId: school.id,
        name: `Player ${username}`,
        participantNumber: 1,
        sequence: 1,
      },
    });
    createdParticipantIds.push(participant.id);

    await prisma.account.create({
      data: {
        username,
        role: "PLAYER",
        isActive: true,
        passwordHash: await identityService.hashPassword(PASSWORD),
        participantId: participant.id,
      },
    });

    return competition.entryLinkToken;
  }

  function loginWithToken(username: string, entryLinkToken: string) {
    return request(app)
      .post("/api/auth/player/login")
      .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
      .send({ username, password: PASSWORD, entryLinkToken });
  }

  beforeAll(async () => {
    await makeCompetitionWithPlayer(scopedUsernames.playerA);
    await makeCompetitionWithPlayer(scopedUsernames.playerB);
  });

  afterAll(async () => {
    await prisma.account.deleteMany({
      where: { username: { in: Object.values(scopedUsernames) } },
    });
    await prisma.participant.deleteMany({ where: { id: { in: createdParticipantIds } } });
    await prisma.school.deleteMany({ where: { id: { in: createdSchoolIds } } });
    await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  });

  it("accepts the token of the competition the player belongs to", async () => {
    const tokenA = await prisma.competition.findFirstOrThrow({
      where: { name: `Token cup ${scopedUsernames.playerA}` },
    });
    const response = await loginWithToken(scopedUsernames.playerA, tokenA.entryLinkToken);
    expect(response.status).toBe(200);
    expect(response.body.role).toBe("PLAYER");
  });

  it("rejects another competition's token with the same generic message (AUTH-002)", async () => {
    const tokenB = await prisma.competition.findFirstOrThrow({
      where: { name: `Token cup ${scopedUsernames.playerB}` },
    });
    const response = await loginWithToken(scopedUsernames.playerA, tokenB.entryLinkToken);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("auth.invalidCredentials");
  });

  it("rejects a token no competition carries", async () => {
    const response = await loginWithToken(scopedUsernames.playerA, "not-a-real-token");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("auth.invalidCredentials");
  });

  it("logs in normally when no token is sent (the slip-less path still works)", async () => {
    const response = await login("player", scopedUsernames.playerA);
    expect(response.status).toBe(200);
  });
});

/**
 * Hole D (2026-10-20): ONE entry link per competition, opened by a student and by a
 * judge alike. The link used to be a player-only mechanism — the server resolved a
 * competition through `participant` alone, so the same address handed to a judge named
 * no competition and was folded into the generic rejection, leaving the judge unable to
 * use the room's own link. These are the judge half of that fix, plus the public name
 * lookup the login screen asks before anybody has signed in.
 */
describe("the one entry link serves a judge too (hole D)", () => {
  const judgeUsername = `it-tok-judge-${suffix}`;
  const createdCompetitionIds: string[] = [];
  const createdJudgeIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  let assignedCompetitionName = "";
  let otherCompetitionName = "";

  /**
   * A bare competition. A judge belongs to one through its `CompetitionJudgeAssignment`
   * row, not through a participant, so nothing else has to be created for these tests.
   */
  async function makeCompetition(name: string): Promise<string> {
    const competition = await competitionService.createCompetition({
      name,
      categories: [{ code: "U8", name: "Under 8" }],
    });
    createdCompetitionIds.push(competition.id);
    return competition.id;
  }

  beforeAll(async () => {
    assignedCompetitionName = `Judge cup ${suffix}`;
    otherCompetitionName = `Other judge cup ${suffix}`;
    const assignedId = await makeCompetition(assignedCompetitionName);
    await makeCompetition(otherCompetitionName);

    const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
    createdJudgeIds.push(judge.id);

    await prisma.account.create({
      data: {
        username: judgeUsername,
        role: "JUDGE",
        isActive: true,
        passwordHash: await identityService.hashPassword(PASSWORD),
        judgeId: judge.id,
      },
    });

    // Assigned to the FIRST competition only; the second one is the mismatch case.
    const assignment = await prisma.competitionJudgeAssignment.create({
      data: {
        competitionId: assignedId,
        judgeId: judge.id,
        fromParticipantNumber: 1,
        toParticipantNumber: 10,
      },
    });
    createdAssignmentIds.push(assignment.id);
  });

  afterAll(async () => {
    await prisma.competitionJudgeAssignment.deleteMany({
      where: { id: { in: createdAssignmentIds } },
    });
    await prisma.account.deleteMany({ where: { username: judgeUsername } });
    await prisma.judge.deleteMany({ where: { id: { in: createdJudgeIds } } });
    await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  });

  /** Log in as a judge with the entry link's token — the same address a student uses. */
  function judgeLoginWithToken(entryLinkToken: string) {
    return request(app)
      .post("/api/auth/judge/login")
      .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
      .send({ username: judgeUsername, password: PASSWORD, entryLinkToken });
  }

  it("accepts the token of a competition the judge was assigned to", async () => {
    const competition = await prisma.competition.findFirstOrThrow({
      where: { name: assignedCompetitionName },
    });
    const response = await judgeLoginWithToken(competition.entryLinkToken);
    expect(response.status).toBe(200);
    expect(response.body.role).toBe("JUDGE");
  });

  it("rejects the token of a competition the judge was not assigned to", async () => {
    const competition = await prisma.competition.findFirstOrThrow({
      where: { name: otherCompetitionName },
    });
    const response = await judgeLoginWithToken(competition.entryLinkToken);
    // The same generic message as a wrong password (AUTH-002): never which half failed.
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("auth.invalidCredentials");
  });

  it("still logs the judge in with no token at all", async () => {
    const response = await login("judge", judgeUsername);
    expect(response.status).toBe(200);
  });

  it("ignores a token sent by a controller instead of rejecting them for it (ROL-004)", async () => {
    // A controller is not scoped to one competition, so there is nothing to agree with.
    const response = await request(app)
      .post("/api/auth/controller/login")
      .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
      .send({
        username: usernames.controller,
        password: PASSWORD,
        entryLinkToken: "not-a-real-token",
      });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe("CONTROLLER");
  });
});

describe("GET /api/auth/entry-link/:token (hole D)", () => {
  /**
   * The login screen asks this BEFORE anybody has signed in, so it can say which event
   * the link opens instead of showing an anonymous form. Deliberately name-only: the
   * token is already printed and read out in the room, so the one thing this reveals is
   * the event's own name — no participant, no judge, no category, no round, no question.
   */
  const competitionName = `Public cup ${suffix}`;
  const createdCompetitionIds: string[] = [];
  let entryLinkToken = "";

  beforeAll(async () => {
    const competition = await competitionService.createCompetition({
      name: competitionName,
      categories: [{ code: "U8", name: "Under 8" }],
    });
    createdCompetitionIds.push(competition.id);
    entryLinkToken = competition.entryLinkToken;
  });

  afterAll(async () => {
    await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  });

  it("answers with the competition's name and nothing else", async () => {
    const response = await request(app).get(
      `/api/auth/entry-link/${encodeURIComponent(entryLinkToken)}`,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ competitionName });
  });

  it("404s on a token no competition carries", async () => {
    const response = await request(app).get("/api/auth/entry-link/not-a-real-token");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("auth.entryLinkUnknown");
  });

  it("rejects a blank token rather than matching anything", async () => {
    // `/api/auth/entry-link/` with nothing after the slash does not reach this route at
    // all, so the guard is the schema's `trim().min(1)`: a whitespace-only segment trims
    // to nothing and is a 400 `VALIDATION_ERROR`, not a lookup that finds no competition.
    const response = await request(app).get(
      `/api/auth/entry-link/${encodeURIComponent("   ")}`,
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("one active device per account (PAR-005)", () => {
  it("a second login takes over; the first device's session is then rejected", async () => {
    const first = await login("judge", usernames.judge);
    expect(first.status).toBe(200);

    const second = await login("judge", usernames.judge);
    expect(second.status).toBe(200);
    expect(second.body.deviceId).not.toBe(first.body.deviceId);

    // The first device is silently out: its session no longer resolves.
    await expect(
      identityService.authenticate(first.body.token, first.body.deviceId),
    ).rejects.toThrow();

    // The newest device still works.
    const caller = await identityService.authenticate(
      second.body.token,
      second.body.deviceId,
    );
    expect(caller.role).toBe("JUDGE");
  });
});

describe("session does not expire from inactivity (AUTH-001)", () => {
  it("keeps sessionExpiresAt unchanged across authenticated requests", async () => {
    const res = await login("controller", usernames.controller);
    const accountId = res.body.accountId as string;
    const before = await prisma.account.findUnique({ where: { id: accountId } });

    await identityService.authenticate(res.body.token, res.body.deviceId);
    await identityService.authenticate(res.body.token, res.body.deviceId);

    const after = await prisma.account.findUnique({ where: { id: accountId } });
    expect(after?.sessionExpiresAt?.toISOString()).toBe(
      before?.sessionExpiresAt?.toISOString(),
    );
  });
});

describe("logout", () => {
  it("ends the session; a request with the ended session is rejected", async () => {
    const res = await login("player", usernames.player);
    const { token, deviceId } = res.body;

    const out = await request(app)
      .post("/api/auth/logout")
      .set("x-session-token", token);
    expect(out.status).toBe(200);

    await expect(identityService.authenticate(token, deviceId)).rejects.toThrow();

    const again = await request(app)
      .post("/api/auth/logout")
      .set("x-session-token", token);
    expect(again.status).toBe(401);
  });
});

describe("credential helpers (BLD-003 / BLD-037)", () => {
  it("generates a short, unambiguous password and a unique username", () => {
    const a = identityService.generatePassword(8);
    expect(a).toHaveLength(8);
    expect(a).toMatch(/^[A-HJ-NP-Z2-9]+$/);

    const u1 = identityService.generateUsername("Wang Wei");
    const u2 = identityService.generateUsername("Wang Wei");
    expect(u1).toMatch(/^wang-wei-[0-9a-f]+$/);
    expect(u1).not.toBe(u2);
  });

  it("hashes and verifies a password without storing it in plaintext", async () => {
    const hash = await identityService.hashPassword("s3cret");
    expect(hash).not.toContain("s3cret");
    await expect(identityService.verifyPassword("s3cret", hash)).resolves.toBe(true);
    await expect(identityService.verifyPassword("wrong", hash)).resolves.toBe(false);
  });
});
