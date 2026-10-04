/**
 * The player feature (Unit 07). Owns the player's screens for the round runtime:
 * the competition room (waiting), the preparation screen (rules + countdown),
 * and the rotate-device gate (UI-001/PAR-006 — the answer screen is landscape
 * only). The active-round screen lives in `features/gameplay`.
 *
 * The player page is the single entry point for a player session: it connects
 * the realtime socket, subscribes to the round lifecycle events, and renders
 * the right screen for the round's current state. The client is never trusted
 * for time or state (invariant 3): every countdown is cosmetic, and the
 * server-authoritative remaining time comes from the realtime pushes and the
 * reconnect `GET /api/gameplay/:roundId/state` call.
 */
export { PlayerPage } from "./PlayerPage";
