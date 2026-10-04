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

export interface SystemConnectedPayload {
  /** ISO timestamp from the single server clock (the server owns time). */
  serverTime: string;
}
