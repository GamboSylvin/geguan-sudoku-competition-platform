/**
 * The gameplay feature (Unit 07, extended by Unit 13). Owns the two round screens:
 * the Individual stage's `ActiveRoundScreen` (six of the player's own puzzles,
 * autosave, no correctness feedback) and the Team stage's `RotationRoundScreen`
 * (one borrowed question that rotates in, immediate checking, no autosave).
 *
 * Hard rules these screens enforce:
 *   - **Landscape only** (UI-001/PAR-006): a "please rotate your device" gate
 *     appears when the tablet is held upright.
 *   - **The Individual stage shows no live correctness feedback** (spec Free
 *     movement): the player never sees whether a cell is correct while playing.
 *     The rotation round does — its submit is checked on the spot, and its score is
 *     a shared flat value the whole team watches (SCR-007/SCR-015), not a hidden
 *     per-player result.
 *   - **Autosave, never scoring**: every Individual edit is debounced into a `POST
 *     /api/gameplay/:roundId/autosave` roughly twice a second (spec
 *     Implementation Detail 4); autosave never triggers scoring (invariant 7). The
 *     rotation round has no autosave at all — a grid is sent only on submit,
 *     because its next owner is a different tablet.
 *   - **The server owns the timer** (invariant 3): the visible countdowns are
 *     cosmetic and re-anchor on every server push.
 */
export { ActiveRoundScreen } from "./ActiveRoundScreen";
export { RotationRoundScreen } from "./RotationRoundScreen";
export type {
  RotationViewState,
  RotationHold,
  RotationEndedResult,
} from "./RotationRoundScreen";
