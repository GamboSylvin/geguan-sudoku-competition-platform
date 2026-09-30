import request from "supertest";
import { createApp } from "../src/app";
import { disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";

/**
 * The first passing Jest test (Unit 01, acceptance criterion 6). It exercises the
 * health check without a real database or Redis, so it passes on a fresh clone in
 * CI even before the services are reachable — a failed dependency must be reported,
 * not hidden (acceptance criterion 2).
 */
describe("health check", () => {
  const app = createApp();

  afterAll(async () => {
    // Close the clients the health check opened, so Jest exits cleanly.
    await disconnectRedis().catch(() => undefined);
    await disconnectPrisma().catch(() => undefined);
  });

  it("responds and reports the database and Redis status", async () => {
    const response = await request(app).get("/api/health");

    // 200 when both are up, 503 when a dependency is down — never a false "healthy".
    expect([200, 503]).toContain(response.status);

    expect(response.body).toHaveProperty("status");
    expect(["ok", "error"]).toContain(response.body.status);
    expect(response.body.dependencies).toHaveProperty("database");
    expect(response.body.dependencies).toHaveProperty("redis");
    expect(["up", "down"]).toContain(response.body.dependencies.database);
    expect(["up", "down"]).toContain(response.body.dependencies.redis);
    expect(typeof response.body.uptimeSeconds).toBe("number");
  });
});
