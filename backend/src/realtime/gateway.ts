import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../infra/logger";
import { now } from "../shared/clock";
import { identityService } from "../modules/identity";
import { bigScreenService } from "../modules/big-screen";
import type { BigScreenModePayload, BigScreenRankingPayload } from "../modules/big-screen";
import { roundService, roundTimerService } from "../modules/round";
import type {
  PreparationTickPayload,
  RoundPausedPayload,
  RoundResumedPayload,
  RoundStartedPayload,
  TimerSyncPayload,
} from "../modules/round";
import {
  BIG_SCREEN_EVENTS,
  RANKING_EVENTS,
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
 * Unit 09 gates the big-screen namespace by the `bigScreenLinkToken` instead of a
 * session (the big screen has no login, BSC-001) and pushes `ranking:update` to it.
 */
export function createRealtimeGateway(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN },
  });

  // Authenticate the handshake. Every namespace except the big screen uses the
  // session-token check (`identityService`, same as HTTP). The big screen has no
  // login (BSC-001): its only credential is the unguessable `bigScreenLinkToken`,
  // which the big-screen service resolves to a competition. The namespace is read
  // from `socket.nsp.name` because the auth middleware runs per-namespace.
  const sessionNamespaces = new Set<string>([
    REALTIME_NAMESPACES.player,
    REALTIME_NAMESPACES.judge,
    REALTIME_NAMESPACES.controller,
  ]);

  for (const namespace of Object.values(REALTIME_NAMESPACES)) {
    const nsp = io.of(namespace);

    nsp.use(async (socket, next) => {
      try {
        if (sessionNamespaces.has(namespace)) {
          const { token, deviceId } = socket.handshake.auth as {
            token?: string;
            deviceId?: string;
          };
          socket.data.auth = await identityService.authenticate(token, deviceId);
        } else {
          // Big screen: token-only authentication, no session.
          const { token } = socket.handshake.auth as { token?: string };
          socket.data.bigScreen = await bigScreenService.authenticateBigScreen(token);
        }
        next();
      } catch (error) {
        logger.warn("realtime: handshake rejected", {
          namespace,
          message: error instanceof Error ? error.message : String(error),
        });
        next(new Error("unauthorized"));
      }
    });

    nsp.on("connection", (socket) => {
      logger.info("realtime: client connected", { namespace, socketId: socket.id });

      // Track big-screen connections so the rotation timer runs only while at
      // least one big screen is watching, and stops when the last one drops.
      if (namespace === REALTIME_NAMESPACES.bigScreen) {
        const competitionId = socket.data.bigScreen?.competitionId as string | undefined;
        if (competitionId) {
          socket.join(competitionId);
          // Unit 11: a screen that connects mid-command must not sit on the default
          // display. Send the controller's current mode to this socket alone, then
          // let the rotation timer handle the leaderboards.
          void bigScreenService.getMode(competitionId).then((mode) => {
            socket.emit(BIG_SCREEN_EVENTS.mode, mode);
          });
          void bigScreenService.registerConnection(competitionId);
          socket.on("disconnect", () => {
            bigScreenService.unregisterConnection(competitionId);
          });
        }
      }

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

  // ---------------------------------------------------------------------------
  // Big-screen ranking pushes (Unit 09)
  //
  // The big-screen service decides which category to show and when; the gateway
  // only puts the already-ranked payload on the wire to that competition's room
  // (invariant 8 — no computation here).
  // ---------------------------------------------------------------------------
  const bigScreenNamespace = io.of(REALTIME_NAMESPACES.bigScreen);
  bigScreenService.installBigScreenPushHook((payload: BigScreenRankingPayload) => {
    bigScreenNamespace.to(payload.competitionId).emit(RANKING_EVENTS.update, payload);
  });
  // Unit 11: what the screens show is the controller's, not the rotation's, so a
  // mode change goes on the wire to that competition's room immediately.
  bigScreenService.installBigScreenModeHook((payload: BigScreenModePayload) => {
    bigScreenNamespace.to(payload.competitionId).emit(BIG_SCREEN_EVENTS.mode, payload);
  });

  return io;
}
