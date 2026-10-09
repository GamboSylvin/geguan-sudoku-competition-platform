/**
 * The Gameplay module (Unit 07 — autosave, reconnection, and the working-grid
 * restore; Unit 8 — submit/scoring/advance; Unit 13 — the Team stage's rotation
 * relay). Owns: the player's current grid for every puzzle of the active round,
 * the autosave write path, the reconnect path, and the team rotation queue and
 * tablet holds (TEM-004, architecture.md "System boundaries").
 *
 * The barrel exposes the public interface (invariant 4):
 *   - `gameplayService`: `autosave` (the write path), `getState` (the reconnect
 *     path), and from Unit 08 the submit / round-ended / advance surface. Unit 11's
 *     Orchestrator also calls `closeAllActiveParticipations` (end a round early)
 *     and `advanceAfterRoundFinalized`, so Unit 08's scoring-and-advance chain is
 *     reused rather than duplicated.
 *   - `teamRotationService`: Unit 13's rotation round — the deal at round start
 *     (`startRotationRound`, called by the Round module through its hook), the
 *     per-tablet submit (`submitRotation`) and reconnect read (`getTabletState`)
 *     behind the HTTP routes, and the timer-expiry settle
 *     (`handleRotationRoundEnded`).
 *   - `installCompetitionFinishedHook`: who needs to know the whole competition
 *     finished (Unit 11's big-screen `FINAL` mode). Both finish paths fire it.
 *   - `gameplayRouter`: HTTP routes — `POST /:roundId/autosave`,
 *     `GET /:roundId/state`, `POST /:roundId/submit`, `POST /:roundId/left-page`,
 *     and Unit 13's `POST /rotation/:roundId/submit`,
 *     `GET /rotation/:roundId/state`.
 */
export {
  gameplayService,
  installIndividualResultFinalizedHook,
  installCompetitionFinishedHook,
  type CompetitionFinishedEvent,
} from "./gameplay.service";
export {
  teamRotationService,
  installRotationHooks,
  type RotationPushTarget,
} from "./team-rotation.service";export { gameplayRouter } from "./gameplay.controller";
export type * from "./gameplay.types";
export type * from "./team-rotation.types";
