/**
 * judge feature folder. Unit 06 builds the controller's judge-management screen,
 * the range-assignment panel (mounted on the competition setup screen), and the
 * judge's minimal landing confirming their assignment. The supervision dashboard
 * (status, restart) is Unit 10.
 */
export { JudgeManagementPage } from "./JudgeManagementPage";
export { JudgeLandingPage } from "./JudgeLandingPage";
export { JudgeRangeAssignmentPanel } from "./JudgeRangeAssignmentPanel";
export {
  createJudge,
  listJudges,
  removeJudge,
  assignJudgeRange,
  unassignJudge,
  fetchJudgeMe,
  blockingCompetitionsFrom,
  JudgeApiError,
} from "./judgeApi";
export type {
  JudgeSummaryView,
  CreatedJudgeView,
  JudgeAssignmentView,
  JudgeMeView,
} from "./judgeApi";
