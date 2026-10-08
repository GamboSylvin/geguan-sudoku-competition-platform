/**
 * results feature folder. Unit 12 builds the controller's results screen: the
 * per-category scores with Unit 09's rank beside every row, the category
 * leaderboards, the correction form with its mandatory reason (RES-003), the
 * correction history, the `.xlsx` export download and the informational purge-date
 * notice. The purge itself is schedule-driven on the server and has no control here.
 */
export { ResultsPage } from "./ResultsPage";
export {
  fetchResults,
  listCorrections,
  createCorrection,
  downloadExport,
  ResultsApiError,
} from "./resultsApi";
export type {
  ResultsView,
  ResultsCategoryView,
  ResultsStageView,
  ResultsRoundView,
  ResultsRowView,
  RankingRow,
  PurgeScheduleView,
  CorrectionResultView,
  CorrectionHistoryRow,
} from "./resultsApi";
