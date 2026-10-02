/**
 * competition feature folder (Unit 03). The controller's competition-creation and
 * publish screen, plus the API client it talks to. Participant and question import
 * (Units 04-05) and the later lifecycle screens arrive in later units.
 */
export { CompetitionSetupPage } from "./CompetitionSetupPage";
export {
  createCompetition,
  updateCompetition,
  publishCompetition,
  unmetConditionsFrom,
  CompetitionApiError,
} from "./competitionApi";
export type {
  CategoryInput,
  CategoryView,
  CompetitionView,
  PublishResultView,
  ReadinessCondition,
  RoundSettingsView,
  RoundView,
  StageView,
} from "./competitionApi";
