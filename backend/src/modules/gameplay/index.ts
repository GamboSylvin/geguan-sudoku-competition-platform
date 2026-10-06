/**
 * The Gameplay module (Unit 07 — autosave, reconnection, and the working-grid
 * restore). Owns: the player's current grid for every puzzle of the active
 * round, the autosave write path, and the reconnect path.
 *
 * The barrel exposes the public interface (invariant 4):
 *   - `gameplayService`: `autosave` (the write path) and `getState` (the
 *     reconnect path). Question delivery at round start is the Round module's
 *     job (BLD-006); this module only re-reads the questions on reconnect.
 *   - `gameplayRouter`: HTTP routes — `POST /:roundId/autosave` and
 *     `GET /:roundId/state`.
 */
export { gameplayService, installIndividualResultFinalizedHook } from "./gameplay.service";
export { gameplayRouter } from "./gameplay.controller";
export type * from "./gameplay.types";
