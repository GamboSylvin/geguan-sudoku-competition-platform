/**
 * The Gameplay module (Unit 07 — autosave, reconnection, and the working-grid
 * restore). Owns: the player's current grid for every puzzle of the active
 * round, the autosave write path, and the reconnect path.
 *
 * The barrel exposes the public interface (invariant 4):
 *   - `gameplayService`: `autosave` (the write path), `getState` (the reconnect
 *     path), and from Unit 08 the submit / round-ended / advance surface. Unit 11's
 *     Orchestrator also calls `closeAllActiveParticipations` (end a round early)
 *     and `advanceAfterRoundFinalized`, so Unit 08's scoring-and-advance chain is
 *     reused rather than duplicated.
 *   - `installCompetitionFinishedHook`: who needs to know the whole competition
 *     finished (Unit 11's big-screen `FINAL` mode). Both finish paths fire it.
 *   - `gameplayRouter`: HTTP routes — `POST /:roundId/autosave` and
 *     `GET /:roundId/state`.
 */
export {
  gameplayService,
  installIndividualResultFinalizedHook,
  installCompetitionFinishedHook,
  type CompetitionFinishedEvent,
} from "./gameplay.service";
export { gameplayRouter } from "./gameplay.controller";
export type * from "./gameplay.types";
