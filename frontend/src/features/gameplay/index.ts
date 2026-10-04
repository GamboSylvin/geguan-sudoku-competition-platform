/**
 * The gameplay feature (Unit 07). Owns the active-round screen: the Sudoku
 * grid, the 6-puzzle navigation, the number pad, and the autosave wiring.
 *
 * Hard rules this screen enforces:
 *   - **Landscape only** (UI-001/PAR-006): a "please rotate your device" gate
 *     appears when the tablet is held upright.
 *   - **No live correctness feedback** (spec Free movement): the player never
 *     sees whether a cell is correct while playing.
 *   - **Autosave, never scoring**: every edit is debounced into a `POST
 *     /api/gameplay/:roundId/autosave` roughly twice a second (spec
 *     Implementation Detail 4); autosave never triggers scoring (invariant 7).
 *   - **The server owns the timer** (invariant 3): the visible countdown is
 *     cosmetic and re-anchors on every server push.
 */
export { ActiveRoundScreen } from "./ActiveRoundScreen";
