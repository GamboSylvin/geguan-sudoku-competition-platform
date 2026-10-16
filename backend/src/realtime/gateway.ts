import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../infra/logger";
import { now } from "../shared/clock";
import { identityService } from "../modules/identity";
import { bigScreenService } from "../modules/big-screen";
import type { BigScreenModePayload, BigScreenRankingPayload } from "../modules/big-screen";
import { roundService, roundTimerService } from "../modules/round";
import { installRotationHooks, installPartitionHooks } from "../modules/gameplay";
import type {
  PreparationTickPayload,
  RoundPausedPayload,
  RoundResumedPayload,
  RoundStartedPayload,
  TimerSyncPayload,
} from "../modules/round";
import {
  BIG_SCREEN_EVENTS,
  categoryRoom,
  PARTITION_EVENTS,
  RANKING_EVENTS,
  REALTIME_NAMESPACES,
  ROTATION_EVENTS,
  ROUND_EVENTS,
  SYSTEM_EVENTS,
  tabletRoom,
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

      // Unit 13: a player socket joins its own per-tablet room so the rotation
      // pushes (which carry that member's own question and grid) reach exactly one
      // tablet instead of every connected player. The participant id comes from the
      // authenticated handshake, never from the client.
      if (namespace === REALTIME_NAMESPACES.player) {
        const participantId = socket.data.auth?.participantId as string | null | undefined;
        if (participantId) socket.join(tabletRoom(participantId));
        // Also its category's room, which the round-started push is routed to. Resolved
        // from the authenticated handshake like the participant id — never from the
        // client, and read at authenticate time so no extra lookup happens here (this
        // module holds no Prisma import: translation only).
        const categoryId = socket.data.auth?.categoryId as string | null | undefined;
        if (categoryId) socket.join(categoryRoom(categoryId));
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
  // namespace. Nothing here holds a domain rule; translation only.
  //
  // The timer events (preparation-tick, timer-sync, paused, resumed) go to every
  // connected player: they carry only round-wide timing, which is identical for all
  // of them (invariant 3), so there is nothing to scope and nothing to leak.
  //
  // `round:started` is the exception and is room-scoped, not namespace-wide. It is
  // the one round event that carries question content, and a `Round` is shared by
  // every category of a competition while each category has its own questions — so a
  // namespace-wide push hands every player every category's puzzles. The round
  // service therefore fires the hook once per category and each payload is emitted
  // to that category's room alone. Per-player scoping of *grids* stays on the
  // gameplay HTTP routes, as before.
  // ---------------------------------------------------------------------------

  const playerNamespace = io.of(REALTIME_NAMESPACES.player);

  roundTimerService.onTick((state, remainingSeconds) => {
    const payload: PreparationTickPayload = {
      roundId: state.roundId,
      stageId: state.stageId,
      competitionId: state.competitionId,
      status: state.status,
      remainingSeconds,
      totalSeconds: state.totalSeconds,
    };
    // Preparation and round ticks share the same event, so the payload carries
    // `status` and the client reads that rather than guessing from its own screen.
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
  // fires this hook once it has flipped the durable state and started the round
  // timer — once per category, each payload carrying that category's own questions;
  // the gateway's only job is to put each one on the wire to its own room.
  roundService.installRoundStartedHook((payload: RoundStartedPayload) => {
    playerNamespace.to(categoryRoom(payload.categoryId)).emit(ROUND_EVENTS.started, payload);
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

  // ---------------------------------------------------------------------------
  // Team rotation relay pushes (Unit 13)
  //
  // The rotation service decides what a tablet holds and when it moves; the
  // gateway's only job is to put the already-built payload on the wire to that one
  // tablet's room (invariant 8 — no computation here). `installRotationHooks`
  // assigns rather than accumulates, so a repeated `createRealtimeGateway` in
  // tests cannot double-emit.
  // ---------------------------------------------------------------------------
  installRotationHooks({
    onDeal: (target, payload) => {
      playerNamespace.to(tabletRoom(target.participantId)).emit(ROTATION_EVENTS.deal, payload);
    },
    onRotated: (target, payload) => {
      playerNamespace.to(tabletRoom(target.participantId)).emit(ROTATION_EVENTS.rotated, payload);
    },
    onEnded: (target, payload) => {
      playerNamespace.to(tabletRoom(target.participantId)).emit(ROTATION_EVENTS.ended, payload);
    },
  });

  // ---------------------------------------------------------------------------
  // Team partition collaboration pushes (Unit 14, 齐心协力)
  //
  // Same split as the rotation round: the service builds the payload, the gateway
  // only puts it on the wire to that one tablet's room. The round's two deal-shaped
  // pushes (`partition:deal` and `partition:puzzle-solved`) are one hook, because the
  // spec gives them one payload type — `reason` is the only difference — so the event
  // name is chosen from it here rather than the service carrying two hooks.
  // ---------------------------------------------------------------------------
  installPartitionHooks({
    onDeal: (target, payload) => {
      const room = playerNamespace.to(tabletRoom(target.participantId));
      if (payload.reason === "PUZZLE_SOLVED") room.emit(PARTITION_EVENTS.puzzleSolved, payload);
      else room.emit(PARTITION_EVENTS.deal, payload);
    },
    onEnded: (target, payload) => {
      playerNamespace.to(tabletRoom(target.participantId)).emit(PARTITION_EVENTS.roundEnded, payload);
    },
  });

  return io;
}
