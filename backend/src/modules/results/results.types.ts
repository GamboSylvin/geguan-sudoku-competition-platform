/**
 * The Results module's shared vocabulary (Unit 12): the error codes every
 * rejection carries, the shapes the controller's results screen reads, and the
 * audit actions the correction and the export log.
 *
 * Error codes are module-scoped constants (the pattern Units 08–11 use) so a code
 * is never a bare string at a throw site, and each one has a message in **both**
 * i18n catalogues.
 */
import type { RankingRow } from "../ranking/ranking.types";

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Not a controller session (ROL-002). All three endpoints are controller-only. */
export const RESULTS_FORBIDDEN = "results.forbidden";
/** The competition id in the path does not exist. */
export const RESULTS_NOT_FOUND = "results.competitionNotFound";
/**
 * The competition was cancelled (ROL-009). Results, correction and export are all
 * rejected for it — this is the gate Unit 11 explicitly deferred to this unit.
 */
export const RESULTS_CANCELLED = "results.competitionCancelled";
/** A correction with no reason, or a blank one (RES-003: the reason is mandatory). */
export const RESULTS_REASON_REQUIRED = "results.reasonRequired";
/**
 * A correction whose `targetType` is not `PARTICIPANT`. `TEAM`/`SCHOOL` exist in the
 * schema but nothing produces a team or school result until Units 13/14/15, so
 * there is nothing to correct yet — a rejection, not a gap (spec Error Cases).
 */
export const RESULTS_UNSUPPORTED_TARGET = "results.unsupportedTargetType";
/** The round result being corrected does not exist for that (round, participant). */
export const RESULTS_RESULT_NOT_FOUND = "results.resultNotFound";
/** The round being corrected is not one of this competition's rounds. */
export const RESULTS_ROUND_NOT_FOUND = "results.roundNotFound";
/** `newScore` is not a non-negative whole number. */
export const RESULTS_INVALID_SCORE = "results.invalidScore";

// ---------------------------------------------------------------------------
// Audit actions
// ---------------------------------------------------------------------------

export const RESULTS_AUDIT_ACTIONS = {
  /** A score correction was written (RES-003). */
  correction: "results.correction.create",
  /** An export file was produced (U-08). */
  export: "results.export.create",
} as const;

export type ResultsAuditAction =
  (typeof RESULTS_AUDIT_ACTIONS)[keyof typeof RESULTS_AUDIT_ACTIONS];

// ---------------------------------------------------------------------------
// The results view (spec Detail 1, acceptance criterion 1)
// ---------------------------------------------------------------------------

/**
 * One participant's result in one round: the raw score, the early-finish bonus, the
 * total, how long the round took them, how it was submitted, and — because the
 * screen shows the leaderboard next to the detail — their **current rank** in the
 * category. The rank is Unit 09's, read through its own recompute-on-read service,
 * never computed here (invariant 8's spirit, and the spec's "reuse Unit 09").
 */
export interface ResultsRowView {
  participantId: string;
  participantName: string;
  participantNumber: number;
  roundId: string;
  score: number | null;
  bonus: number | null;
  totalScore: number | null;
  completionTimeSeconds: number | null;
  submissionType: string | null;
  submittedAt: string | null;
  /** The participant's current category rank, or null when they are not ranked yet. */
  rank: number | null;
}

export interface ResultsRoundView {
  roundId: string;
  sequence: number;
  name: string;
  status: string;
  rows: ResultsRowView[];
}

export interface ResultsStageView {
  stageId: string;
  type: "INDIVIDUAL" | "TEAM";
  sequence: number;
  status: string;
  name: string;
  rounds: ResultsRoundView[];
}

export interface ResultsCategoryView {
  categoryId: string;
  code: string;
  name: string;
  sequence: number;
  stages: ResultsStageView[];
}

/**
 * What `GET /api/competitions/:id/results` returns. `ranking` is the same
 * category-level leaderboard the big screen shows, included so the results screen
 * and the export do not each have to call the ranking endpoint.
 */
export interface ResultsView {
  competitionId: string;
  name: string;
  status: string;
  /** True when the controller ended the competition early (RND-007). */
  finishedEarly: boolean;
  finishedAt: string | null;
  cancelledAt: string | null;
  categories: ResultsCategoryView[];
  /** The current Individual ranking per category id, newest rank first. */
  rankings: Record<string, RankingRow[]>;
  /** The competition's purge schedule, so the screen can show the purge date. */
  purge: PurgeScheduleView | null;
}

// ---------------------------------------------------------------------------
// The correction (spec Detail 2, RES-003)
// ---------------------------------------------------------------------------

export interface CorrectionInput {
  targetType: string;
  targetId: string;
  roundId: string;
  /** The corrected total score for the round. A non-negative whole number. */
  newScore: number;
  /** Mandatory. Trimmed and required to be non-empty. */
  reason: string;
}

export interface CorrectionResultView {
  correctionId: string;
  competitionId: string;
  targetType: string;
  targetId: string;
  roundId: string | null;
  /** Both stored as strings — `ScoreCorrection`'s columns are `String` (schema). */
  oldScore: string;
  newScore: string;
  reason: string;
  correctedAt: string;
  /** The recalculated category ranking, so the screen updates without a second read. */
  ranking: RankingRow[] | null;
}

// ---------------------------------------------------------------------------
// The export (spec Detail 3, U-08)
// ---------------------------------------------------------------------------

export interface ExportResultView {
  competitionId: string;
  storedFileId: string;
  fileName: string;
  sizeBytes: number;
  checksum: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// The purge schedule (spec Detail 4, RES-004)
// ---------------------------------------------------------------------------

/** How many days after a competition ends its student data is deleted (RES-004). */
export const PURGE_RETENTION_DAYS = 15;

export type PurgeScheduleStatus = "SCHEDULED" | "EXECUTED";

export interface PurgeScheduleView {
  competitionId: string;
  purgeAt: string;
  status: PurgeScheduleStatus;
  executedAt: string | null;
}

/** What one purge run deleted. Returned by the job; never exposed over HTTP. */
export interface PurgeResultView {
  competitionId: string;
  purgeAt: string;
  executedAt: string;
  deleted: {
    answers: number;
    attempts: number;
    individualResults: number;
    teamResults: number;
    rankingSnapshots: number;
    scoreCorrections: number;
    auditLogs: number;
    devices: number;
    accounts: number;
    participants: number;
    storedFiles: number;
  };
}
