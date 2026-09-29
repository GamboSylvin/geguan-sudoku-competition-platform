import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectPrisma, disconnectPrisma, ensureStorageRoot, logger } from "./infra";
import { connectRedis, disconnectRedis } from "./infra/redis";
import { createRealtimeGateway } from "./realtime";

/**
 * Entry point (BLD-020): load config, connect infra, start HTTP + WebSocket.
 * Config is loaded (and validated) at import time by `config/env`; a missing
 * variable fails fast there.
 */
async function main(): Promise<void> {
  await ensureStorageRoot();
  await connectPrisma();
  await connectRedis();

  const app = createApp();
  const httpServer = createServer(app);
  const io = createRealtimeGateway(httpServer);

  httpServer.listen(env.BACKEND_PORT, () => {
    logger.info("backend listening", {
      port: env.BACKEND_PORT,
      env: env.NODE_ENV,
      health: `/api/health`,
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("shutting down", { signal });
    io.close();
    httpServer.close();
    await disconnectRedis();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("failed to start", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
