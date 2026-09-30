import { Router } from "express";
import { prisma, redis } from "./infra";
import { logger } from "./infra/logger";

/**
 * The health check (Unit 01 acceptance criterion 2). It reports the database and
 * Redis connection status and reports a failed connection instead of returning
 * healthy. It is not a domain module: it lives next to `routes.ts` because it
 * exists for the deployment and the CI, not for a feature.
 */
export const healthRouter = Router();

type DependencyStatus = "up" | "down";

interface HealthReport {
  status: "ok" | "error";
  uptimeSeconds: number;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

async function checkDatabase(): Promise<DependencyStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "up";
  } catch (error) {
    logger.error("health: database check failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return "down";
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  try {
    const reply = await redis.ping();
    return reply === "PONG" ? "up" : "down";
  } catch (error) {
    logger.error("health: redis check failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return "down";
  }
}

healthRouter.get("/health", async (_req, res) => {
  const [database, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const healthy = database === "up" && redisStatus === "up";
  const report: HealthReport = {
    status: healthy ? "ok" : "error",
    uptimeSeconds: Math.round(process.uptime()),
    dependencies: { database, redis: redisStatus },
  };

  // 503 when a dependency is down, so a probe never reports healthy wrongly.
  res.status(healthy ? 200 : 503).json(report);
});
