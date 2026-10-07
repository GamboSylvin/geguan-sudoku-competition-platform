/**
 * The Orchestrator module. Owns: the sequence — start stage, preparation, start
 * and end round, next round, next stage, finish — and the reset/rematch/replay
 * mechanic (ROL-005).
 *
 * Prisma access. No domain rule lives here; the service holds the rules
 * (invariant 4 — a module's internals are reachable only through its public
 * interface).
 */
import type { Attempt, RoundParticipation } from "@prisma/client";
import { prisma } from "../../infra";

/** Load the participation row (the join of a participant and a round). */
export function findParticipation(
  roundId: string,
  participantId: string,
): Promise<RoundParticipation | null> {
  return prisma.roundParticipation.findUnique({
    where: { roundId_participantId: { roundId, participantId } },
  });
}

/** The current non-archived attempt for a participation, if any. */
export function findCurrentAttempt(
  roundParticipationId: string,
): Promise<Attempt | null> {
  return prisma.attempt.findFirst({
    where: { roundParticipationId, isArchived: false },
    orderBy: { attemptNumber: "desc" },
  });
}

/** The next attempt number for a participation (per-participation, 1-based). */
export async function nextAttemptNumber(roundParticipationId: string): Promise<number> {
  const latest = await prisma.attempt.findFirst({
    where: { roundParticipationId },
    orderBy: { attemptNumber: "desc" },
    select: { attemptNumber: true },
  });
  return (latest?.attemptNumber ?? 0) + 1;
}

export interface ArchiveAndRestartInput {
  participationId: string;
  /** The attempt to mark archived; null when no attempt existed yet. */
  currentAttemptId: string | null;
  /** The new attempt's number (the caller already computed it). */
  newAttemptNumber: number;
  /** Submitted-at timestamp for the archived attempt's replacement row. */
  now: Date;
}

/**
 * The durable half of the restart: mark the current attempt archived (when one
 * exists), create a fresh blank attempt, point the participation at it and bump
 * the restart-visible `attemptCount`. All in one transaction so a crash never
 * leaves a participation with two current attempts or none.
 *
 * The fresh attempt is `isArchived: false` with no answers — the player sees a
 * blank grid (their working grids in Redis are cleared separately by the
 * Gameplay module). Submission fields are placeholder values until the player
 * actually submits (the scoring module overwrites them at finalize).
 */
export async function archiveAndRestart(
  input: ArchiveAndRestartInput,
): Promise<{ newAttemptId: string; attemptCount: number }> {
  return prisma.$transaction(async (tx) => {
    if (input.currentAttemptId) {
      await tx.attempt.update({
        where: { id: input.currentAttemptId },
        data: { isArchived: true },
      });
    }

    const newAttempt = await tx.attempt.create({
      data: {
        roundParticipationId: input.participationId,
        attemptNumber: input.newAttemptNumber,
        // Placeholder until the player submits; the scoring finalize overwrites.
        submissionType: "MANUAL",
        submittedAt: input.now,
      },
      select: { id: true },
    });

    const updated = await tx.roundParticipation.update({
      where: { id: input.participationId },
      data: {
        state: "ACTIVE",
        currentAttemptId: newAttempt.id,
        attemptCount: { increment: 1 },
      },
      select: { attemptCount: true },
    });

    return { newAttemptId: newAttempt.id, attemptCount: updated.attemptCount };
  });
}
