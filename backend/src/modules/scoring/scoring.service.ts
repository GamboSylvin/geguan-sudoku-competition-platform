/**
 * The Scoring module's domain rules and public interface (Unit 08). Other
 * modules call this service, never the repository (invariant 4).
 *
 * What lives here:
 *   - **Answer check** (BLD-010): a simple deep-equality between the submitted
 *     grid and `Question.solution`. No per-variant rule checker; we rely on the
 *     confirmed unique solution (U-90).
 *   - **All-or-nothing scoring** (SCR-001): a wrong or blank cell scores 0 for
 *     that puzzle; a fully correct puzzle scores its `Question.points`. A
 *     puzzle with no submitted grid is blank by definition (spec Context,
 *     "Time expiry").
 *   - **Early-finish bonus** (SCR-008–SCR-011): `earlyBonusRate × floor(minutes
 *     early)`, capped by `earlyBonusCap` when set. Earned only when *all* of:
 *     the submission is `MANUAL`, the round is an Individual-stage round, the
 *     submission arrived strictly before the round's deadline, and every
 *     puzzle in the round is correct. Otherwise 0.
 *   - **Round finalization**: writes the `Attempt` row, the per-puzzle `Answer`
 *     rows, and the settled `IndividualRoundResult`. RoundParticipation state
 *     transitions are the Gameplay module's job; this module is invoked once
 *     per (participation, attempt) finalize.
 *
 * Nothing here is team-stage aware (Units 13/14 build that, with different
 * rules). Nothing here reveals a score to the student — the response is
 * assembled by the Gameplay module's controller and contains no score fields
 * (SUB-007/BLD-029).
 */
import { roundTimerService } from "../round/round-timer.service";
import * as repository from "./scoring.repository";
import type {
  FinalizeAttemptInput,
  FinalizeAttemptResult,
  ScoredAnswerInput,
} from "./scoring.types";

/**
 * Compare a submitted grid against the puzzle's stored solution. Pure equality
 * (BLD-010): the two arrays must have the same length and match in every cell.
 * A null in the submitted grid never matches a non-null in the solution, so a
 * blank cell is wrong by construction.
 */
export function gridsEqual(
  submitted: (number | null)[],
  solution: (number | null)[],
): boolean {
  if (submitted.length !== solution.length) return false;
  for (let i = 0; i < solution.length; i += 1) {
    if (submitted[i] !== solution[i]) return false;
  }
  return true;
}

/**
 * Decide whether one scored attempt earns the early-finish bonus, and if so,
 * how much (SCR-008–SCR-011). Pure function — the whole rule, in one place.
 *
 * Eligible when ALL of:
 *   - the submission is `MANUAL` (not `TIMEOUT`, `AUTO` or `CONTROLLER_END`),
 *   - the round is an Individual-stage round,
 *   - the submission arrived strictly before the round's deadline, and
 *   - every puzzle in the round is correct.
 *
 * Amount: `earlyBonusRate × floor(minutes early)`, capped at `earlyBonusCap`
 * when set (SCR-009 — empty cap means no cap).
 */
export function computeEarlyBonus(input: {
  submissionType: FinalizeAttemptInput["submissionType"];
  isIndividualStage: boolean;
  submittedAtMs: number;
  roundStartedAtMs: number;
  durationSeconds: number;
  earlyBonusRate: number;
  earlyBonusCap: number | null;
  allCorrect: boolean;
}): number {
  if (input.submissionType !== "MANUAL") return 0;
  if (!input.isIndividualStage) return 0;
  if (!input.allCorrect) return 0;

  const deadlineMs = input.roundStartedAtMs + input.durationSeconds * 1000;
  const earlyMs = deadlineMs - input.submittedAtMs;
  if (earlyMs <= 0) return 0;

  const wholeMinutesEarly = Math.floor(earlyMs / 60_000);
  if (wholeMinutesEarly <= 0) return 0;

  const raw = wholeMinutesEarly * input.earlyBonusRate;
  if (input.earlyBonusCap != null && input.earlyBonusCap >= 0) {
    return Math.min(raw, input.earlyBonusCap);
  }
  return raw;
}

/**
 * Score one participant's round. Builds the per-puzzle `Answer` inputs,
 * computes the round score and bonus, and persists the `Attempt`, the
 * `Answer`s and the `IndividualRoundResult`.
 *
 * Idempotent on a repeated call for the same participation: if the
 * participation already has a current (non-archived) attempt, that attempt is
 * returned as-is and no new rows are written (PL-009 — a repeated submission
 * never changes the result).
 */
async function finalizeAttempt(
  input: FinalizeAttemptInput,
): Promise<FinalizeAttemptResult> {
  const existing = await repository.findCurrentAttempt(input.roundParticipationId);
  if (existing) {
    return {
      attemptId: existing.id,
      // The caller writes the result row only when this call actually created
      // the attempt. Signal "no-op" by returning the existing attempt's id
      // with an empty individualRoundResultId; the caller checks for it.
      individualRoundResultId: "",
      score: existing.score,
      bonus: existing.bonus,
      totalScore: existing.totalScore,
      submissionType: existing.submissionType,
      submittedAtMs: existing.submittedAt.getTime(),
    };
  }

  const answers: ScoredAnswerInput[] = input.questions.map((q) => {
    const submitted = input.gridsByQuestionId.get(q.id) ?? [];
    const correct = gridsEqual(submitted, q.solution);
    return {
      questionId: q.id,
      submittedGrid: submitted,
      correct,
      pointsAwarded: correct ? q.points : 0,
    };
  });

  const score = answers.reduce((sum, a) => sum + a.pointsAwarded, 0);
  const allCorrect = answers.every((a) => a.correct);
  const bonus = computeEarlyBonus({
    submissionType: input.submissionType,
    isIndividualStage: input.isIndividualStage,
    submittedAtMs: input.submittedAtMs,
    roundStartedAtMs: input.roundStartedAtMs,
    durationSeconds: input.durationSeconds,
    earlyBonusRate: input.earlyBonusRate,
    earlyBonusCap: input.earlyBonusCap,
    allCorrect,
  });
  const totalScore = score + bonus;

  const completionTimeSeconds = Math.max(
    0,
    Math.floor((input.submittedAtMs - input.roundStartedAtMs) / 1000),
  );

  const attemptNumber = await repository.nextAttemptNumber(input.roundParticipationId);
  const { attemptId } = await repository.createFinalizedAttempt({
    roundParticipationId: input.roundParticipationId,
    attemptNumber,
    submissionType: input.submissionType,
    submittedAt: new Date(input.submittedAtMs),
    score,
    bonus,
    totalScore,
    completionTimeSeconds,
    answers,
  });

  const { individualRoundResultId } = await repository.createIndividualRoundResult({
    roundId: input.roundId,
    participantId: input.participantId,
    categoryId: input.categoryId,
    attemptId,
    score,
    bonus,
    totalScore,
    submissionType: input.submissionType,
    submittedAt: new Date(input.submittedAtMs),
    completionTimeSeconds,
  });

  return {
    attemptId,
    individualRoundResultId,
    score,
    bonus,
    totalScore,
    submissionType: input.submissionType,
    submittedAtMs: input.submittedAtMs,
  };
}

/**
 * The remaining seconds the server-authoritative timer reports for a round, or
 * 0 when the round has no live timer (already ended). The manual submit path
 * uses this to decide "manual before expiry" vs. "manual after expiry"
 * (SUB-003): a request that arrives after the timer reached zero is recorded
 * as `TIMEOUT`, not `MANUAL`.
 */
async function getRemainingSeconds(roundId: string): Promise<number> {
  const snapshot = await roundTimerService.remaining(roundId);
  if (!snapshot) return 0;
  if (snapshot.status === "FINISHED") return 0;
  return snapshot.remainingSeconds;
}

export const scoringService = {
  gridsEqual,
  computeEarlyBonus,
  finalizeAttempt,
  getRemainingSeconds,
};
