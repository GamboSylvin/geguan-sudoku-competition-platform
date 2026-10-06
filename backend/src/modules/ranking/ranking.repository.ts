/**
 * Prisma access for the Ranking module (Unit 09). No domain rule lives here; the
 * service holds the rules (invariant 4). Every function is a thin wrapper over
 * Prisma. Reads Unit 08's `IndividualRoundResult` rows; writes `RankingSnapshot`.
 */
import type { RankingSnapshot } from "@prisma/client";
import { prisma } from "../../infra";
import type { RankingSnapshotPayload } from "./ranking.types";

/**
 * The Individual stage of a competition with its two rounds. Used to know which
 * rounds count toward a category's cumulative score and how many rounds a
 * participant must finish before the ranking is final.
 */
export function findIndividualStageWithRounds(competitionId: string) {
  return prisma.stage.findFirst({
    where: { competitionId, type: "INDIVIDUAL" },
    orderBy: { sequence: "asc" },
    include: {
      rounds: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true } },
    },
  });
}

/**
 * Every active participant in a category. The ranking lists participants, so the
 * read includes the display name the big screen shows. Only active participants
 * are ranked (a removed participant drops out of the leaderboard).
 */
export function listActiveCategoryParticipants(categoryId: string) {
  return prisma.participant.findMany({
    where: { categoryId, active: true },
    select: { id: true, name: true },
    orderBy: { participantNumber: "asc" },
  });
}

/**
 * The finalized Individual-round results for a set of rounds, scoped to one
 * category. This is the raw material for a category's cumulative ranking: one row
 * per (participant, round) that has been finalized.
 */
export function listFinalizedResultsForRounds(roundIds: string[], categoryId: string) {
  return prisma.individualRoundResult.findMany({
    where: { roundId: { in: roundIds }, categoryId },
    select: {
      participantId: true,
      roundId: true,
      totalScore: true,
      completionTimeSeconds: true,
    },
  });
}

/**
 * Replace a category's current Individual-scope snapshot. There is at most one
 * "current" snapshot per (competition, stage, category, scope); a recompute
 * overwrites it. We delete-then-create rather than update because the snapshot
 * has no natural unique key for the "current" row and the payload is replaced
 * wholesale. The two writes run in one transaction so a reader never sees a gap.
 */
export async function replaceCurrentSnapshot(input: {
  competitionId: string;
  stageId: string;
  categoryId: string;
  isFinal: boolean;
  payload: RankingSnapshotPayload;
}): Promise<RankingSnapshot> {
  return prisma.$transaction(async (tx) => {
    await tx.rankingSnapshot.deleteMany({
      where: {
        competitionId: input.competitionId,
        stageId: input.stageId,
        categoryId: input.categoryId,
        scope: "INDIVIDUAL",
      },
    });
    return tx.rankingSnapshot.create({
      data: {
        competitionId: input.competitionId,
        stageId: input.stageId,
        categoryId: input.categoryId,
        scope: "INDIVIDUAL",
        isFinal: input.isFinal,
        payload: input.payload as object,
      },
    });
  });
}

/**
 * The current Individual-scope snapshot for a category, or null when nothing has
 * been computed yet (a category with zero finalized results is not an error).
 */
export function findCurrentSnapshot(
  competitionId: string,
  stageId: string,
  categoryId: string,
): Promise<RankingSnapshot | null> {
  return prisma.rankingSnapshot.findFirst({
    where: { competitionId, stageId, categoryId, scope: "INDIVIDUAL" },
    orderBy: { computedAt: "desc" },
  });
}
