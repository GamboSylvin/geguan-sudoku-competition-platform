import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../infra/logger";
import { now } from "../shared/clock";
import {
  REALTIME_NAMESPACES,
  SYSTEM_EVENTS,
  type SystemConnectedPayload,
} from "./events";

/**
 * The WebSocket gateway (Socket.io). Real-time commands and state travel over
 * WebSocket (ARCH-022); the contract is still a "Working Position" (ARCH-023).
 * Unit 01 wires the gateway and one system event only — no module handler yet.
 * Each later unit adds a handler under `realtime/handlers/`.
 */
export function createRealtimeGateway(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN },
  });

  for (const namespace of Object.values(REALTIME_NAMESPACES)) {
    const nsp = io.of(namespace);
    nsp.on("connection", (socket) => {
      logger.info("realtime: client connected", { namespace, socketId: socket.id });

      const payload: SystemConnectedPayload = { serverTime: now().toISOString() };
      socket.emit(SYSTEM_EVENTS.connected, payload);

      socket.on(SYSTEM_EVENTS.ping, () => {
        socket.emit(SYSTEM_EVENTS.pong, { serverTime: now().toISOString() });
      });

      socket.on("disconnect", (reason) => {
        logger.info("realtime: client disconnected", { namespace, socketId: socket.id, reason });
      });
    });
  }

  return io;
}
