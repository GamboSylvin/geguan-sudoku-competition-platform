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

/**
 * Team rotation relay events (Unit 13, spec API Contract). Unlike every other
 * player push these are **per-tablet**, not namespace-wide: each member of a team
 * holds a different question, so the gateway addresses them by room (the room a
 * player socket joins on connect is their own participant id). The client never
 * sends these. Payloads are defined in
 * `modules/gameplay/team-rotation.types`.
 *   - `rotation:deal` — the initial deal at round start.
 *   - `rotation:rotated` — a timed rotation, a correct submit's refill, a rejected
 *     stale-hold submit, or a reconnect refresh. Carries `reason`.
 *   - `rotation:ended` — this team's round is settled.
 */
export const ROTATION_EVENTS = {
  deal: "rotation:deal",
  rotated: "rotation:rotated",
  ended: "rotation:ended",
} as const;

/**
 * The per-tablet room name. One player socket, one room — the smallest possible
 * audience for a payload that carries that member's own question and grid.
 */
export function tabletRoom(participantId: string): string {
  return `tablet:${participantId}`;
}

export interface SystemConnectedPayload {
  /** ISO timestamp from the single server clock (the server owns time). */
  serverTime: string;
}
