/**
 * WebSocket event-name constants and payload types. The API/WebSocket contract is
 * still a "Working Position" and not final (ARCH-023), so only the envelope exists
 * here; each unit adds its own events. Handlers translate between client messages
 * and module services and hold no domain rule (architecture.md, "Backend folder
 * structure").
 */
export const REALTIME_NAMESPACES = {
  player: "/player",
  judge: "/judge",
  controller: "/controller",
  bigScreen: "/big-screen",
} as const;

export type RealtimeNamespace =
  (typeof REALTIME_NAMESPACES)[keyof typeof REALTIME_NAMESPACES];

/** The one event every connection can use in Unit 01: a server time sync. */
export const SYSTEM_EVENTS = {
  connected: "system:connected",
  ping: "system:ping",
  pong: "system:pong",
} as const;

/**
 * Round events (Unit 07). The server pushes these to the player namespace; the
 * client never sends them. Payloads are defined in `modules/round/round.types`.
 */
export const ROUND_EVENTS = {
  preparationTick: "round:preparation-tick",
  started: "round:started",
  timerSync: "round:timer-sync",
  paused: "round:paused",
  resumed: "round:resumed",
} as const;

/**
 * Ranking events (Unit 09). The server pushes `ranking:update` to the big-screen
 * namespace on each rotation tick and on each fresh result; the big screen renders
 * exactly what it receives and never computes a rank (invariant 8). The client
 * never sends these.
 */
export const RANKING_EVENTS = {
  update: "ranking:update",
} as const;

/**
 * Big-screen display-control events (Unit 11, BSC-002). The server pushes
 * `bigScreen:mode` to the competition's big-screen room whenever the controller
 * changes what the screens show, so a connected screen reacts immediately instead
 * of waiting for the next rotation tick. The client never sends these.
 */
export const BIG_SCREEN_EVENTS = {
  mode: "bigScreen:mode",
} as const;

export interface SystemConnectedPayload {
  /** ISO timestamp from the single server clock (the server owns time). */
  serverTime: string;
}
