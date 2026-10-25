/**
 * Grid-shape normalisation shared across the gameplay module (I-53, the fix for
 * anomaly A2: every individually/rotation-scored submission read 0 because the
 * stored solution is a matrix but the comparison expected a flat array).
 *
 * Extracted here (option (a) of I-53's three candidates) rather than imported
 * straight from `team-partition.repository.ts`, so the Individual round and the
 * Team rotation round don't reach into the partition feature's own file for an
 * unrelated utility (invariant 4).
 */

/**
 * Flatten a stored grid into a row-major array of length `rows × columns`.
 *
 * Both shapes exist in the database and every caller has to cope with either,
 * because of a format mismatch between what the importer writes and what the
 * gameplay runtime expects:
 *   - the Excel importer writes `startingGrid`/`solution` as row-major **matrices**
 *     (`number[][]`, `0` meaning "blank" — `question-parse.ts`'s `mergeGrids`);
 *   - every automated test seed, and the working-grid type the tablet submits
 *     (`WorkingGrid = (number | null)[]`), treat them as already-flat `number[]`.
 *
 * `0` is normalised to `null` so a blank given-cell and an unfilled cell are the same
 * thing to the answer check, matching how the tablet represents an empty cell. A grid
 * of the wrong total length is returned blank rather than silently mis-shaped — a
 * mis-shaped puzzle can never be solved, and a loud zero is safer than a wrong
 * row-band split or a false "incorrect".
 */
export function flattenStoredGrid(stored: unknown, rows: number, columns: number): (number | null)[] {
  const size = rows * columns;
  const out = new Array<number | null>(size).fill(null);
  if (size <= 0) return out;

  const cells: unknown[] = [];
  if (Array.isArray(stored)) {
    const looksLikeMatrix = stored.length > 0 && Array.isArray(stored[0]);
    if (looksLikeMatrix) {
      for (const row of stored) {
        if (!Array.isArray(row)) return out;
        cells.push(...row);
      }
    } else {
      cells.push(...stored);
    }
  }
  if (cells.length !== size) return out;

  for (let i = 0; i < size; i += 1) {
    const value = cells[i];
    // `0` is the importer's "blank"; anything else non-numeric is treated as blank.
    out[i] = typeof value === "number" && value !== 0 ? value : null;
  }
  return out;
}
