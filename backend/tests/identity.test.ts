import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";

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
