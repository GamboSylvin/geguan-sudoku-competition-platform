/**
 * Types for the Competition module (Unit 03 — competition setup and lifecycle).
 *
 * The module owns: the competition's creation and metadata, the fixed
 * stage/round structure, the status machine, publish, and the structure lock.
 * Later units extend this (Units 04/05/06 each add a publish readiness condition;
 * Units 07+ add the runtime commands).
 */
import type {
  CompetitionStatus,
  RoundSettings,
  StageType,
} from "@prisma/client";

/** One category the controller creates with the competition (e.g. code `U8`, name `Under 8`). */
export interface CategoryInput {
  code: string;
  name: string;
}

export interface CreateCompetitionInput {
  name: string;
  description?: string | null;
  categories: CategoryInput[];
}

/**
 * A partial set of round-settings edits. Every field is optional; only the fields
 * present are changed. Whole numbers only, times/counts above zero (SCR-012).
 */
export type RoundSettingsPatch = Partial<
  Pick<
    RoundSettings,
    | "durationSeconds"
    | "preparationSeconds"
    | "earlyBonusRate"
    | "earlyBonusCap"
    | "teamPointsPerQuestion"
    | "rotationPeriodSeconds"
    | "teamQuestionCount"
    | "teamTotalTimeSeconds"
    | "individualTotalWarning"
    | "partitionPuzzleCount"
    | "partitionTotalTimeSeconds"
    | "partitionPointsPerPuzzle"
  >
>;

export interface UpdateCompetitionInput {
  name?: string;
  description?: string | null;
  /** Full replacement of the category list — pre-publish only. */
  categories?: CategoryInput[];
  /** Edits keyed by round id. Allowed before publish and, per the existing rule, after. */
  roundSettings?: Record<string, RoundSettingsPatch>;
}

/**
 * The four publish readiness conditions (Unit 03 spec, Context). Each has a stable
 * `key` (the i18n message key the controller sees) and a human `message`. Later
 * units plug their own condition into the same list without revisiting this one.
 */
export type ReadinessConditionKey =
  | "competition.readiness.categoryRequired"
  | "competition.readiness.participantsRequired"
  | "competition.readiness.questionsRequired"
  | "competition.readiness.judgeRangesRequired";

export interface ReadinessCondition {
  key: ReadinessConditionKey;
  message: string;
}

export interface ReadinessResult {
  ready: boolean;
  /** Every unmet condition, not just the first — the controller sees all gaps at once. */
  unmet: ReadinessCondition[];
}

/** What a successful publish returns: the two links plus the new status. */
export interface PublishResult {
  id: string;
  status: CompetitionStatus;
  publishedAt: string | null;
  entryLinkToken: string;
  bigScreenLinkToken: string;
}

/** The default per-round duration in seconds (spec Context, decided 2026-10-02). */
export const DEFAULT_DURATION_SECONDS = {
  INDIVIDUAL_ROUND_1: 1200,
  INDIVIDUAL_ROUND_2: 1800,
  TEAM_ROUND_1: 1800,
  TEAM_ROUND_2: 1800,
} as const;

/** The two stages every competition gets, in order (CS-010). */
export const STAGE_SEQUENCE: readonly StageType[] = ["INDIVIDUAL", "TEAM"];

/**
 * The `durationSeconds` for a given stage type and round sequence (1-based). The
 * schema requires the field with no default, so creation must supply it.
 */
export function defaultDurationSeconds(
  stageType: StageType,
  roundSequence: number,
): number {
  if (stageType === "INDIVIDUAL") {
    return roundSequence === 1
      ? DEFAULT_DURATION_SECONDS.INDIVIDUAL_ROUND_1
      : DEFAULT_DURATION_SECONDS.INDIVIDUAL_ROUND_2;
  }
  return roundSequence === 1
    ? DEFAULT_DURATION_SECONDS.TEAM_ROUND_1
    : DEFAULT_DURATION_SECONDS.TEAM_ROUND_2;
}

/** Statuses at which the structure is locked (anything past `CREATED`). */
export function isStructureLocked(status: CompetitionStatus): boolean {
  return status !== "CREATED";
}
