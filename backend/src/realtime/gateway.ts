import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../infra/logger";
import { now } from "../shared/clock";
import { identityService } from "../modules/identity";
import {
  REALTIME_NAMESPACES,
  SYSTEM_EVENTS,
  type SystemConnectedPayload,
} from "./events";

/**
 * The WebSocket gateway (Socket.io). Real-time commands and state travel over
 * WebSocket (ARCH-022); the contract is still a "Working Position" (ARCH-023).
 * Unit 01 wired the gateway and one system event; Unit 02 adds the connection-time
 * authentication check, reusing the same session check as HTTP (`identityService`).
 * No round or gameplay events exist yet — those belong to later units.
 */
export function createRealtimeGateway(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN },
  });

  // Authenticate the handshake with the same session token as HTTP: the client
  // passes `{ token, deviceId }` in `socket.handshake.auth`. A rejected handshake
  // never reaches a namespace handler.
  io.use(async (socket, next) => {
    try {
      const { token, deviceId } = socket.handshake.auth as {
        token?: string;
        deviceId?: string;
      };
      socket.data.auth = await identityService.authenticate(token, deviceId);
      next();
    } catch (error) {
      logger.warn("realtime: handshake rejected", {
        message: error instanceof Error ? error.message : String(error),
      });
      next(new Error("unauthorized"));
    }
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
