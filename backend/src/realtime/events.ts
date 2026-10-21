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
 * Team partition collaboration events (Unit 14, 齐心协力, spec API Contract). Like
 * the rotation round these are **per-tablet**: each member owns a different row-band
 * of the shared puzzle, so the gateway addresses them by room. The client never sends
 * these. Payloads are defined in `modules/gameplay/team-partition.types`.
 *   - `partition:deal` — the initial deal at round start.
 *   - `partition:puzzle-solved` — the combined grid reached a fully correct state and
 *     the team moved to the next puzzle with the same band split. Carries `reason:
 *     "PUZZLE_SOLVED"`; it is the same payload shape as the deal, so one client
 *     handler covers both.
 *   - `partition:round-ended` — this team's round is settled.
 */
export const PARTITION_EVENTS = {
  deal: "partition:deal",
  puzzleSolved: "partition:puzzle-solved",
  roundEnded: "partition:round-ended",
} as const;

/**
 * The per-tablet room name. One player socket, one room — the smallest possible
 * audience for a payload that carries that member's own question and grid.
 */
export function tabletRoom(participantId: string): string {
  return `tablet:${participantId}`;
}

/**
 * The per-category room name. Every player socket joins the room of its own
 * category at connect time.
 *
 * This exists because a `Round` is shared by every category of a competition while
 * each category's questions are its own, so the `round:started` push — which carries
 * the question content — cannot go to the whole player namespace without handing one
 * category's puzzles to another's players. Routing by this room is what keeps that
 * content server-side until the recipient is entitled to it; filtering on the client
 * would not, because the questions would still have crossed the wire.
 */
export function categoryRoom(categoryId: string): string {
  return `category:${categoryId}`;
}

/**
 * Judge and controller events (F3, 2026-10-21).
 *
 * The judge namespace existed in `REALTIME_NAMESPACES` and was never used: no socket
 * ever joined it, so the judge screen had no push to listen to and the supervision
 * panel fell back to a three-second poll. A judge therefore learned that a student
 * had connected — or that the round had started — only at the next poll, and often not
 * at all, because the row it was watching was one of a dozen.
 *
 * These are the three pushes that replace that:
 *   - `judge:student-connected` / `judge:student-disconnected` — a player of the
 *     judge's competition logged in or logged out. Carries the participant, never the
 *     session token or the device id.
 *   - `judge:round-started` — the competition's round began. Deliberately **not**
 *     `ROUND_EVENTS.started`: that payload carries the questions (BLD-06), and a judge
 *     is not entitled to another category's puzzles. This one names the round and its
 *     duration and stops there.
 */
export const JUDGE_EVENTS = {
  studentConnected: "judge:student-connected",
  studentDisconnected: "judge:student-disconnected",
  roundStarted: "judge:round-started",
} as const;

/**
 * The per-competition room, on the judge and controller namespaces.
 *
 * A judge socket joins the room of the competition its session entered through, so a
 * presence push about competition B never reaches a judge sitting in competition A's
 * room. The room name is the competition id itself, matching the big-screen namespace's
 * existing convention; it is a different namespace, so the two cannot collide.
 */
export function competitionRoom(competitionId: string): string {
  return competitionId;
}
export interface SystemConnectedPayload {
  /** ISO timestamp from the single server clock (the server owns time). */
  serverTime: string;
}

/**
 * A player of the judge's competition logged in or out (F3). Fields only a judge is
 * already entitled to see about a student in its own range: the number the range is
 * expressed in, the name, and the category. No token, no device id, no attempt data.
 */
export interface JudgePresencePayload {
  competitionId: string;
  participantId: string;
  participantNumber: number;
  participantName: string;
  /** ISO timestamp of the change, from the server clock. */
  at: string;
}

/**
 * The judge's round-started push (F3): the same fact `ROUND_EVENTS.started` tells a
 * player, minus everything that would hand the judge another category's questions.
 */
export interface JudgeRoundStartedPayload {
  competitionId: string;
  roundId: string;
  stageId: string;
  /**
   * Which of the round's two beginnings this is. `PREPARATION` is the countdown —
   * every tablet left the waiting screen; `ACTIVE` is the moment the puzzles are on
   * screen and answering counts. They are seconds apart and both are worth a judge
   * looking up, so they share one event name rather than being two hooks.
   *
   * There is deliberately **no `categoryId` here**: this push fires once per round,
   * while the player's `ROUND_EVENTS.started` fires once per category. A `Round` is
   * shared by every category of a competition, so naming one category here would be a
   * made-up fact.
   */
  phase: "PREPARATION" | "ACTIVE";
  durationSeconds: number;
  /** ISO timestamp from the server clock. */
  at: string;
}
