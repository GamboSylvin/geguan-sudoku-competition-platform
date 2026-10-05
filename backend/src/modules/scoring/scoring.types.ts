/**
 * Types for the Scoring module (Unit 08 — submission, answer check, scoring).
 *
 * The module owns: comparing a submitted grid to a `Question`'s stored solution
 * (simple deep-equality, BLD-010, relying on the confirmed unique solution U-90),
 * all-or-nothing per-puzzle scoring (SCR-001), the early-finish bonus
 * (SCR-008–SCR-011), and the write-out of `Attempt` / `Answer` /
 * `IndividualRoundResult`. It does not own ranking (Unit 09), corrections
 * (Unit 12) or team-stage scoring (Units 13/14).
 */
import type { SubmissionType } from "@prisma/client";

/**
 * One puzzle's contribution to an attempt: which question, what was submitted,
 * whether it matched the solution, and how many points that earned.
 */
export interface ScoredAnswerInput {
  questionId: string;
  /** The submitted working grid (or the blank grid when the player never touched it). */
  submittedGrid: (number | null)[];
  correct: boolean;
  pointsAwarded: number;
}

/**
 * The inputs the scoring service needs to finalize one participant's attempt at
 * a round. The round-side bookkeeping (RoundParticipation state) is the
 * Gameplay module's job; this module computes and persists the score rows.
 */
export interface FinalizeAttemptInput {
  roundParticipationId: string;
  roundId: string;
  participantId: string;
  categoryId: string;
  submissionType: SubmissionType;
  /**
   * Server-clock epoch ms at which this submission is recorded. The caller
   * passes the same clock the round timer uses; the scoring service never
   * trusts a client-supplied timestamp (invariant 3).
   */
  submittedAtMs: number;
  /**
   * Server-clock epoch ms at which the round became ACTIVE. Used to compute
   * `completionTimeSeconds` and the early-finish bonus window.
   */
  roundStartedAtMs: number;
  /**
   * The whole seconds the round was given (`RoundSettings.durationSeconds`).
   * Used together with `roundStartedAtMs` to derive the round's deadline.
   */
  durationSeconds: number;
  /**
   * Early-finish bonus configuration. `earlyBonusRate` is points per whole
   * minute early (default 3, SCR-008); `earlyBonusCap` (optional) caps the
   * bonus (SCR-009 — empty means no cap).
   */
  earlyBonusRate: number;
  earlyBonusCap: number | null;
  /** True when this is an Individual-stage round; false for the Team stage. */
  isIndividualStage: boolean;
  /**
   * Every puzzle in the round with its solution and points. The scoring service
   * iterates this list and matches it against `gridsByQuestionId` to produce
   * the per-question scored answers. A puzzle with no submitted grid is
   * treated as blank and scores 0 (spec Context, "Time expiry").
   */
  questions: {
    id: string;
    points: number;
    solution: (number | null)[];
  }[];
  /**
   * The player's latest autosaved grid per question, keyed by question id.
   * Missing entries mean "never touched" and score 0.
   */
  gridsByQuestionId: Map<string, (number | null)[]>;
}

/** What the scoring service hands back after a successful finalize. */
export interface FinalizeAttemptResult {
  attemptId: string;
  individualRoundResultId: string;
  score: number;
  bonus: number;
  totalScore: number;
  submissionType: SubmissionType;
  submittedAtMs: number;
}
