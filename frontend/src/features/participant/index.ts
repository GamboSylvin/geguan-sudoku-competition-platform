/**
 * participant feature folder. Unit 04 builds the controller's participant import (one
 * `.xlsx` per competition, atomic), the roster with its individual/team event flags, the
 * single-row add/edit/deactivate actions, and the printable credential slips — all
 * mounted on the competition setup screen Unit 03 already built, beside the question
 * panel it mirrors.
 *
 * **No team formation lives here.** Team building is deferred out of Unit 04 (spec §8
 * Q10, U-102): the `团队赛` flag is stored and counted, `teamId` stays null.
 */
export { ParticipantPanel } from "./ParticipantPanel";
export {
  importParticipantFile,
  fetchParticipants,
  addParticipant,
  editParticipant,
  deactivateParticipant,
  downloadCredentials,
  importFailuresFrom,
  ParticipantApiError,
} from "./participantApi";
export type {
  ParticipantView,
  ParticipantListView,
  ParticipantCounts,
  TeamFlaggedCount,
  ImportWarningView,
  IssuedCredentialView,
  ParticipantImportResultView,
  ParticipantEditResultView,
  ImportFailureView,
} from "./participantApi";
export type { ParticipantPanelCategory } from "./ParticipantPanel";
