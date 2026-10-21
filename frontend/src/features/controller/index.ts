/**
 * controller feature folder. Unit 11 builds the controller's live-command
 * dashboard: the competition picker that opens it, and the dashboard itself
 * (stage start, pause/resume, end-round-early, finish-early, reset/rematch, cancel,
 * big-screen mode) with the shared student-status panel embedded from the judge
 * feature.
 */
export { ControllerPickerPage } from "./ControllerPickerPage";
export { ControllerLivePage } from "./ControllerLivePage";
export {
  listCompetitions,
  fetchCompetition,
  startStage,
  pauseCompetition,
  resumeCompetition,
  endRoundEarly,
  finishEarly,
  resetRematch,
  cancelCompetition,
  setBigScreenMode,
  fetchBigScreenMode,
  ControllerApiError,
} from "./controllerApi";
export type {
  CompetitionSummaryView,
  LiveCompetitionView,
  LiveStageView,
  LiveRoundView,
  LiveCategoryView,
  RoundSettingsSummaryView,
  StartStageResultView,
  TimerSnapshotView,
  EndRoundEarlyResultView,
  FinishEarlyResultView,
  ResetRematchScope,
  ResetRematchResultView,
  CancelResultView,
  BigScreenModeCommand,
  BigScreenModeView,
  BigScreenDisplayView,
} from "./controllerApi";
