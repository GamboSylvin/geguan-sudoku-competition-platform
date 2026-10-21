/**
 * judge feature folder. Unit 06 builds the controller's judge-management screen,
 * the range-assignment panel (mounted on the competition setup screen), and the
 * judge's minimal landing confirming their assignment. Unit 10 adds the judge's
 * supervision dashboard (status view + single-student restart).
 */
export { JudgeManagementPage } from "./JudgeManagementPage";
export { JudgeLandingPage } from "./JudgeLandingPage";
export { JudgeDashboardPage } from "./JudgeDashboardPage";
export { JudgeRangeAssignmentPanel } from "./JudgeRangeAssignmentPanel";
export {
  createJudge,
  listJudges,
  removeJudge,
  assignJudgeRange,
  unassignJudge,
  fetchJudgeMe,
  fetchJudgeStudents,
  restartStudent,
  blockingCompetitionsFrom,
  JudgeApiError,
} from "./judgeApi";
export type {
  JudgeSummaryView,
  CreatedJudgeView,
  JudgeAssignmentView,
  JudgeMeView,
  JudgeStudentView,
  ParticipationStateView,
  RoundStatusView,
  RestartStudentResultView,
} from "./judgeApi";
