/**
 * question feature folder. Unit 05 builds the controller's question-import screen, the
 * category pool grouped by variant/`QuestionSet`, and the round-selection step — one
 * collapsible block per round, all four of them, each with the count that round itself
 * uses (BLD-040, revised 2026-10-19). All of it is mounted on the competition setup
 * screen Unit 03 already built.
 */
export { QuestionPanel } from "./QuestionPanel";
export {
  importQuestionFile,
  fetchQuestionPool,
  selectRoundQuestions,
  importFailuresFrom,
  QuestionApiError,
} from "./questionApi";
export type {
  QuestionSetSummaryView,
  PoolQuestionView,
  PoolGroupView,
  PoolView,
  ImportResultView,
  SelectionResultView,
  ImportFailureView,
} from "./questionApi";
export type { QuestionPanelCategory, QuestionPanelRound } from "./QuestionPanel";
