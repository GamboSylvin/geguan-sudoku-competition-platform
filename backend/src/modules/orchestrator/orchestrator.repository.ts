/**
 * The Orchestrator module. Owns: the sequence — start stage, preparation, start
 * and end round, next round, next stage, finish — and the reset/rematch/replay
 * mechanic (ROL-005).
 *
 * Prisma access. No domain rule lives here; the service holds the rules
 * (invariant 4 — a module's internals are reachable only through its public
 * interface).
 */
import type { Attempt, Prisma, RoundParticipation } from "@prisma/client";
import { prisma } from "../../infra";
import type { OrchestratorAuditAction } from "./orchestrator.types";

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

// ---------------------------------------------------------------------------
// Unit 11's command reads
// ---------------------------------------------------------------------------

/** The competition row a command validates against, with the fields it reads. */
export function findCompetition(competitionId: string) {
  return prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      cancelledAt: true,
      finishedEarly: true,
    },
  });
}

/** A round with the stage it belongs to and the duration its rematch grants. */
export function findRoundForCommand(roundId: string) {
  return prisma.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      sequence: true,
      status: true,
      earlyEnded: true,
      settings: { select: { durationSeconds: true } },
      stage: { select: { id: true, competitionId: true, type: true, sequence: true } },
    },
  });
}

/** Every round of a competition, ordered stage-first (the EVENT scope's list). */
export function listRoundsForCompetition(competitionId: string) {
  return prisma.round.findMany({
    where: { stage: { competitionId } },
    orderBy: [{ stage: { sequence: "asc" } }, { sequence: "asc" }],
    select: {
      id: true,
      status: true,
      settings: { select: { durationSeconds: true } },
      stage: { select: { id: true, type: true, sequence: true } },
    },
  });
}

/** The participations a rematch restarts — those still open, or already closed. */
export function listParticipations(roundId: string, participantIds?: string[]) {
  return prisma.roundParticipation.findMany({
    where: {
      roundId,
      ...(participantIds ? { participantId: { in: participantIds } } : {}),
    },
    select: { id: true, participantId: true, state: true, currentAttemptId: true },
  });
}

/** A team and its members, for the TEAM scope of a rematch (Units 13/14 run it). */
export function findTeamForCommand(teamId: string, competitionId: string) {
  return prisma.team.findFirst({
    where: { id: teamId, competitionId },
    select: { id: true, categoryId: true, participants: { select: { id: true } } },
  });
}

// ---------------------------------------------------------------------------
// Unit 11's command writes
// ---------------------------------------------------------------------------

/**
 * End a round the controller stopped while it was still in PREPARATION: there is
 * no live round timer for the timer service to transition, so the same durable end
 * state it would have written is written here (`FINISHED`, `endedAt`, and the
 * `earlyEnded` flag an early end cannot be undone without — SUB-004).
 */
export async function markRoundEarlyEnded(roundId: string, endedAt: Date): Promise<void> {
  await prisma.round.update({
    where: { id: roundId },
    data: { status: "FINISHED", endedAt, earlyEnded: true },
  });
}

/**
 * The RND-007 "finished early" mark: `FINISHED` plus `finishedEarly = true`, from
 * whichever stage or round the competition was in. Written after the round-closure
 * chain has run, so it overrides the natural finish's `finishedEarly = false` if
 * that chain happened to complete the competition on the way.
 */
export async function markCompetitionFinishedEarly(
  competitionId: string,
  finishedAt: Date,
): Promise<void> {
  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "FINISHED", finishedEarly: true, finishedAt },
  });
}

/**
 * The ROL-09 cancel: a terminal state of its own, distinct from `FINISHED`. No
 * score is computed from this point on and Unit 12 must treat a cancelled
 * competition as having nothing to show.
 */
export async function markCompetitionCancelled(
  competitionId: string,
  cancelledAt: Date,
): Promise<void> {
  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "CANCELLED", cancelledAt },
  });
}

/**
 * One AuditLog row per controller command (spec Security Considerations: every
 * command is traceable). The write is best-effort — a command that already
 * changed state is never rolled back because its log row failed; the failure is
 * logged instead, so the trace is the only thing lost.
 */
export async function writeAuditLog(entry: {
  competitionId?: string | null;
  actorAccountId?: string | null;
  action: OrchestratorAuditAction;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      competitionId: entry.competitionId ?? null,
      actorAccountId: entry.actorAccountId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      payload: (entry.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
