/**
 * The Gameplay module (Unit 07 — autosave, reconnection, and the working-grid
 * restore; Unit 8 — submit/scoring/advance; Unit 13 — the Team stage's rotation
 * relay; Unit 14 — the Team stage's partition collaboration, 齐心协力). Owns: the
 * player's current grid for every puzzle of the active round, the autosave write
 * path, the reconnect path, the team rotation queue and tablet holds (TEM-004), and
 * the partition round's row-band split with its combined-grid check (TEM-005).
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
 *   - `teamPartitionService`: Unit 14's partition round — the deal and band split at
 *     round start (`startPartitionRound`, called by the Round module through the same
 *     hook), the per-member band autosave (`autosaveBand`) and reconnect read
 *     (`getTabletState`) behind the HTTP routes, and the timer-expiry settle
 *     (`handlePartitionRoundEnded`). There is deliberately no submit: the combined
 *     grid is evaluated inside the autosave.
 *   - `installCompetitionFinishedHook`: who needs to know the whole competition
 *     finished (Unit 11's big-screen `FINAL` mode). Both finish paths fire it.
 *   - `gameplayRouter`: HTTP routes — `POST /:roundId/autosave`,
 *     `GET /:roundId/state`, `POST /:roundId/submit`, `POST /:roundId/left-page`,
 *     Unit 13's `POST /rotation/:roundId/submit`, `GET /rotation/:roundId/state`,
 *     and Unit 14's `POST /partition/:roundId/autosave`,
 *     `GET /partition/:roundId/state`.
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
} from "./team-rotation.service";
export {
  teamPartitionService,
  installPartitionHooks,
  type PartitionPushTarget,
} from "./team-partition.service";
export { gameplayRouter } from "./gameplay.controller";
export type * from "./gameplay.types";
export type * from "./team-rotation.types";
export type * from "./team-partition.types";
