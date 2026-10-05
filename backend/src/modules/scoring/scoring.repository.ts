/**
 * Prisma access for the Scoring module (Unit 08). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface). Every function is a thin wrapper over Prisma.
 *
 * The module's durable footprint is exactly three writes per finalized attempt:
 *   - one `Attempt` row (the full archived record, never deleted — SUB-005/ROL-005),
 *   - one `Answer` row per puzzle in the round (with the per-puzzle outcome),
 *   - one `IndividualRoundResult` row (the settled round score that Unit 09's
 *     ranking reads from).
 *
 * The `RoundParticipation` row itself (state transition to `SUBMITTED` /
 * `AUTO_SUBMITTED`, the `currentAttemptId` pointer, the attempt counter) is the
 * Gameplay module's job — it owns the participation lifecycle.
 */
import type { SubmissionType } from "@prisma/client";
import { prisma } from "../../infra";
import type { ScoredAnswerInput } from "./scoring.types";

export interface CreateFinalizedAttemptInput {
  roundParticipationId: string;
  attemptNumber: number;
  submissionType: SubmissionType;
  submittedAt: Date;
  score: number;
  bonus: number;
  totalScore: number;
  completionTimeSeconds: number;
  answers: ScoredAnswerInput[];
}

/**
 * Persist a finalized attempt and its answers in one transaction. Returns the
 * attempt id so the caller can write the matching `IndividualRoundResult` and
 * point `RoundParticipation.currentAttemptId` at it.
 */
export async function createFinalizedAttempt(
  input: CreateFinalizedAttemptInput,
): Promise<{ attemptId: string }> {
  const attempt = await prisma.attempt.create({
    data: {
      roundParticipationId: input.roundParticipationId,
      attemptNumber: input.attemptNumber,
      submissionType: input.submissionType,
      submittedAt: input.submittedAt,
      score: input.score,
      bonus: input.bonus,
      totalScore: input.totalScore,
      completionTimeSeconds: input.completionTimeSeconds,
      answers: {
        create: input.answers.map((a) => ({
          questionId: a.questionId,
          submittedGrid: a.submittedGrid,
          correct: a.correct,
          pointsAwarded: a.pointsAwarded,
        })),
      },
    },
    select: { id: true },
  });
  return { attemptId: attempt.id };
}

export interface CreateIndividualRoundResultInput {
  roundId: string;
  participantId: string;
  categoryId: string;
  attemptId: string;
  score: number;
  bonus: number;
  totalScore: number;
  submissionType: SubmissionType;
  submittedAt: Date;
  completionTimeSeconds: number;
}

/**
 * Persist the settled round score. `IndividualRoundResult` is what Unit 09's
 * ranking and Unit 12's results/export read from — the `Attempt` row is the
 * archived detail behind it (data-model.md, "Attempt vs RoundResult").
 */
export async function createIndividualRoundResult(
  input: CreateIndividualRoundResultInput,
): Promise<{ individualRoundResultId: string }> {
  const row = await prisma.individualRoundResult.create({
    data: {
      roundId: input.roundId,
      participantId: input.participantId,
      categoryId: input.categoryId,
      attemptId: input.attemptId,
      score: input.score,
      bonus: input.bonus,
      totalScore: input.totalScore,
      submissionType: input.submissionType,
      submittedAt: input.submittedAt,
      completionTimeSeconds: input.completionTimeSeconds,
    },
    select: { id: true },
  });
  return { individualRoundResultId: row.id };
}

/**
 * The next attempt number for a participation. Attempt numbering is per
 * participation and starts at 1; a judge restart (Unit 10) bumps it.
 */
export async function nextAttemptNumber(roundParticipationId: string): Promise<number> {
  const latest = await prisma.attempt.findFirst({
    where: { roundParticipationId },
    orderBy: { attemptNumber: "desc" },
    select: { attemptNumber: true },
  });
  return (latest?.attemptNumber ?? 0) + 1;
}

/**
 * Look up the already-finalized attempt for a participation, if any. The
 * gameplay module uses this to make repeated submits a no-op (PL-009): a second
 * submit for an already-closed round returns the existing result without
 * re-scoring.
 */
export async function findCurrentAttempt(roundParticipationId: string) {
  return prisma.attempt.findFirst({
    where: { roundParticipationId, isArchived: false },
    orderBy: { attemptNumber: "desc" },
  });
}
