/**
 * question feature folder. Unit 05 builds the controller's question-import screen, the
 * category pool grouped by variant/`QuestionSet`, and the round-selection step (exactly
 * 6 questions per Individual round, BLD-040), all mounted on the competition setup
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
