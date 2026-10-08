/**
 * The Orchestrator module. Owns: the sequence — start stage, preparation, start
 * and end round, next round, next stage, finish — and the reset/rematch/replay
 * mechanic (ROL-005).
 *
 * Unit 10 builds the single-student case of the archive-and-restart operation:
 * one judge restarts one student's running round, archiving the earlier attempt
 * (never deleting it) and giving the student a blank grid on the round's shared,
 * unchanged remaining time. Unit 11 will call the same public function at a wider
 * scope (whole round or whole competition) — parameterizing it by participant
 * list keeps the rule in exactly one place.
 */

/** Error codes used across the orchestrator module. */
export const ORCHESTRATOR_ROUND_NOT_RUNNING = "orchestrator.roundNotRunning";
export const ORCHESTRATOR_PARTICIPANT_NOT_FOUND =
  "orchestrator.participantNotFound";

// Unit 11's command surface. Each code has an entry in both `shared/i18n/en.ts`
// and `shared/i18n/zh.ts` (code-standards.md: every rejection is localizable).
export const ORCHESTRATOR_FORBIDDEN = "orchestrator.forbidden";
/** A competition that is FINISHED or CANCELLED accepts no further command. */
export const ORCHESTRATOR_COMPETITION_CLOSED = "orchestrator.competitionClosed";
export const ORCHESTRATOR_STAGE_NOT_FOUND = "orchestrator.stageNotFound";
/** "Start a stage that's already active": the stage left WAITING already. */
export const ORCHESTRATOR_STAGE_NOT_WAITING = "orchestrator.stageNotWaiting";
/** "or out of sequence": an earlier stage has not finished yet. */
export const ORCHESTRATOR_STAGE_OUT_OF_SEQUENCE = "orchestrator.stageOutOfSequence";
export const ORCHESTRATOR_ROUND_NOT_FOUND = "orchestrator.roundNotFound";
export const ORCHESTRATOR_ROUND_NOT_IN_COMPETITION =
  "orchestrator.roundNotInCompetition";
/** Pause/resume with no active round to act on (spec Error Cases). */
export const ORCHESTRATOR_NOTHING_TO_PAUSE = "orchestrator.nothingToPause";
export const ORCHESTRATOR_NOTHING_TO_RESUME = "orchestrator.nothingToResume";
/** Reset/rematch on a FINISHED or CANCELLED competition. */
export const ORCHESTRATOR_RESET_NOT_ALLOWED = "orchestrator.resetNotAllowed";
export const ORCHESTRATOR_TEAM_NOT_FOUND = "orchestrator.teamNotFound";
export const ORCHESTRATOR_BIG_SCREEN_FORBIDDEN = "orchestrator.bigScreenForbidden";

/** The four scopes of the reset/rematch command (ROL-005). */
export const RESET_REMATCH_SCOPES = ["EVENT", "ROUND", "PARTICIPANT", "TEAM"] as const;
export type ResetRematchScope = (typeof RESET_REMATCH_SCOPES)[number];

/** The big-screen modes this unit can set (BSC-002). PLAYER_CLOSEUP/TEAM_SPLIT are out of scope. */
export const BIG_SCREEN_MODES = ["RANKING", "PAUSED", "FINAL"] as const;
export type BigScreenModeCommand = (typeof BIG_SCREEN_MODES)[number];

export interface StartStageInput {
  competitionId: string;
  stageId: string;
}

export interface EndRoundEarlyInput {
  competitionId: string;
  roundId: string;
}

export interface EndRoundEarlyResult {
  roundId: string;
  /** How many participations this command actually closed and scored. */
  closedCount: number;
  /** True when the round was already over when the command arrived (a no-op). */
  alreadyFinished: boolean;
}

export interface FinishEarlyResult {
  competitionId: string;
  status: "FINISHED";
  finishedEarly: true;
  /** How many participations the still-running round's closure scored. */
  closedCount: number;
}

export interface ResetRematchInput {
  competitionId: string;
  scope: ResetRematchScope;
  /** The round, participant or team id the scope points at; null for EVENT. */
  roundId?: string | null;
  participantId?: string | null;
  teamId?: string | null;
}

export interface ResetRematchResult {
  scope: ResetRematchScope;
  /** Every round whose timer was given the full duration again. */
  roundIds: string[];
  /** How many attempts were archived and restarted. */
  restartedCount: number;
  /** The full duration granted, in seconds. */
  grantedSeconds: number;
}

export interface CancelResult {
  competitionId: string;
  status: "CANCELLED";
  cancelledAt: Date;
}

export interface SetBigScreenModeInput {
  competitionId: string;
  mode: BigScreenModeCommand;
  /** The category to show when `mode` is RANKING and rotation is off. */
  targetId?: string | null;
  /** Automatic category rotation (BSC-02, Unit 09's cycle). */
  rotationEnabled?: boolean | null;
}

/** The big screen's display state, as stored and as pushed to clients. */
export interface BigScreenDisplayView {
  competitionId: string;
  mode: BigScreenModeCommand | "PLAYER_CLOSEUP" | "TEAM_SPLIT";
  targetId: string | null;
  rotationEnabled: boolean;
}

/** One AuditLog row this module writes (spec Security Considerations). */
export const ORCHESTRATOR_AUDIT_ACTIONS = {
  startStage: "orchestrator.stage.start",
  pause: "orchestrator.pause",
  resume: "orchestrator.resume",
  endRoundEarly: "orchestrator.round.endEarly",
  finishEarly: "orchestrator.competition.finishEarly",
  resetRematch: "orchestrator.resetRematch",
  restartParticipant: "orchestrator.participant.restart",
  cancel: "orchestrator.competition.cancel",
  setBigScreenMode: "orchestrator.bigScreen.setMode",
} as const;
export type OrchestratorAuditAction =
  (typeof ORCHESTRATOR_AUDIT_ACTIONS)[keyof typeof ORCHESTRATOR_AUDIT_ACTIONS];

export interface RestartOneParticipantInput {
  /** The round to restart the participant on. */
  roundId: string;
  /** The participant being restarted. */
  participantId: string;
}

export interface RestartOneParticipantResult {
  participationId: string;
  /** The attempt id that was archived (the "before" state). */
  archivedAttemptId: string | null;
  /** The fresh attempt id the participant is now working on. */
  newAttemptId: string;
  /** The visible restart count after this restart. */
  attemptCount: number;
  /** The server-authoritative remaining seconds on the round's shared timer. */
  remainingSeconds: number;
  /** Total seconds the round was started with. */
  totalSeconds: number;
}
