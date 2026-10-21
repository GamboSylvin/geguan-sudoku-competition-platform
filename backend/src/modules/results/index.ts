/**
 * The Results module (Unit 12). Owns: the controller's results view, the score
 * correction (RES-003), the `.xlsx` export (U-08) and the 15-day retention purge
 * (RES-004).
 *
 * The barrel exposes the public interface (invariant 4):
 *   - `resultsService`: the results read, the correction write, the export
 *     generation and read-back, and the purge-schedule creation the finish and
 *     cancel paths call.
 *   - `purgeService`: the scheduled deletion. It exports `startPurgeScheduler` (wired
 *     from `app.ts`) and `runDuePurges` (used by the tests). **Nothing here is an
 *     endpoint** — the purge has no HTTP surface by design.
 *   - `resultsRouter`: the three controller-only endpoints, mounted under
 *     `/api/competitions/:id` in `routes.ts`.
 *   - `writeXlsx`: the zero-dependency `.xlsx` writer, exported because the export's
 *     shape is part of this module's contract and a test asserts on the bytes it
 *     produces.
 */
export { resultsService } from "./results.service";
export { purgeService } from "./purge.service";
export { resultsRouter } from "./results.controller";
export { writeXlsx, XLSX_MIME_TYPE, gridToCellText } from "./results-xlsx";
// Values, not types: callers write `RESULTS_AUDIT_ACTIONS.correction` etc.
export { RESULTS_AUDIT_ACTIONS, PURGE_RETENTION_DAYS } from "./results.types";
export type * from "./results.types";
