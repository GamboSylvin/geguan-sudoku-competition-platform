import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../infra/logger";
import { now } from "../shared/clock";
import { identityService } from "../modules/identity";
import { roundService, roundTimerService } from "../modules/round";
import type {
  PreparationTickPayload,
  RoundPausedPayload,
  RoundResumedPayload,
  RoundStartedPayload,
  TimerSyncPayload,
} from "../modules/round";
import {
  REALTIME_NAMESPACES,
  ROUND_EVENTS,
  SYSTEM_EVENTS,
  type SystemConnectedPayload,
} from "./events";

/**
 * The WebSocket gateway (Socket.io). Real-time commands and state travel over
 * WebSocket (ARCH-022); the contract is still a "Working Position" (ARCH-023).
 * Unit 01 wired the gateway and one system event; Unit 02 adds the connection-time
 * authentication check, reusing the same session check as HTTP (`identityService`).
 * Unit 07 subscribes the gateway to the round service's lifecycle and tick
 * listeners, broadcasting each to the player namespace (BLD-033's in-process
 * events inside the competition/game-execution subsystem).
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

  // ---------------------------------------------------------------------------
  // Round lifecycle broadcasts (Unit 07)
  //
  // Each listener subscribes to the round service and fans out to the player
  // namespace. Nothing here holds a domain rule; translation only. Round events
  // go to every connected player — the per-player scoping (which grid is whose)
  // is enforced by the gameplay HTTP routes, not by the realtime fan-out, which
  // carries only round-wide state (the questions are identical for every player
  // in a round, BLD-006; the timer is identical, invariant 3).
  // ---------------------------------------------------------------------------

  const playerNamespace = io.of(REALTIME_NAMESPACES.player);

  roundTimerService.onTick((state, remainingSeconds) => {
    const payload: PreparationTickPayload = {
      roundId: state.roundId,
      stageId: state.stageId,
      competitionId: state.competitionId,
      remainingSeconds,
      totalSeconds: state.totalSeconds,
    };
    // Preparation and round ticks share the same event; the client tells them
    // apart by `state.status` (PREPARATION vs ACTIVE) in the timer-sync it
    // already holds, and by which totalSeconds the payload carries.
    playerNamespace.emit(ROUND_EVENTS.preparationTick, payload);
  });

  roundTimerService.onStart((state) => {
    const payload: TimerSyncPayload = {
      roundId: state.roundId,
      competitionId: state.competitionId,
      status: state.status,
      mode: state.mode,
      remainingSeconds: state.totalSeconds,
      totalSeconds: state.totalSeconds,
    };
    playerNamespace.emit(ROUND_EVENTS.timerSync, payload);
  });

  roundTimerService.onPause((state) => {
    const payload: RoundPausedPayload = {
      roundId: state.roundId,
      competitionId: state.competitionId,
      pausedRemainingSeconds: state.pausedRemainingSeconds ?? 0,
    };
    playerNamespace.emit(ROUND_EVENTS.paused, payload);
  });

  roundTimerService.onResume((state, resumesAtMs) => {
    const payload: RoundResumedPayload = {
      roundId: state.roundId,
      competitionId: state.competitionId,
      resumesAtMs,
      resumeCountdownSeconds: 3,
      pausedRemainingSeconds: state.pausedRemainingSeconds ?? 0,
    };
    playerNamespace.emit(ROUND_EVENTS.resumed, payload);
  });

  // The round-started push carries the questions (BLD-006). The Round module
  // fires this hook once it has flipped the durable state and started the
  // round timer; the gateway's only job is to put it on the wire.
  roundService.installRoundStartedHook((payload: RoundStartedPayload) => {
    playerNamespace.emit(ROUND_EVENTS.started, payload);
  });

  return io;
}
