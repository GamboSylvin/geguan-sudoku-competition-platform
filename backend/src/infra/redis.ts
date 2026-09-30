import Redis from "ioredis";
import { env } from "../config/env";

/**
 * Redis holds runtime state — the working grids, connection and device state,
 * the round runtime state and the big-screen display state (BLD-007). Persistence
 * is turned on in `docker-compose.yml`. Durable results never live only here.
 */
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

export async function connectRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    return;
  }
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === "end") {
    return;
  }
  if (redis.status === "ready") {
    // Graceful close: flush pending commands, then end the connection.
    await redis.quit();
    return;
  }
  // Never came up (or is reconnecting): `quit()` would schedule a reconnect
  // timer and leak a handle. Capture the socket, `disconnect()` to cancel the
  // retries, then destroy the socket so ioredis clears its disconnect timer.
  const stream = redis.stream;
  redis.disconnect();
  stream?.destroy();
}
