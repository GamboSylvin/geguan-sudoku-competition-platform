/**
 * Prisma access for the Ranking module's school scope (Unit 15). No domain rule
 * lives here; `school-ranking.service.ts` holds them (invariant 4). Kept in its
 * own file rather than folded into `ranking.repository.ts` so the two units'
 * reads stay independent.
 *
 * The two snapshot functions below differ from Unit 9's on purpose: they are
 * hardcoded to `scope: "SCHOOL"` and take **no** `stageId`, because a school
 * total spans both stages and the column is nullable in the schema.
 */
import type { RankingSnapshot } from "@prisma/client";
import { prisma } from "../../infra";
import type { SchoolRankingSnapshotPayload } from "./school-ranking.types";

/**
 * The TEAM stage of a competition with its rounds in sequence order. Round
 * sequence 1 is the rotation relay (Unit 13), sequence 2 the partition
 * collaboration (Unit 14) — `TeamRoundResult` carries no rotation/partition
 * discriminator of its own, so the round's sequence is the only thing that
 * distinguishes the two team scores.
 */
export function findTeamStageWithRounds(competitionId: string) {
  return prisma.stage.findFirst({
    where: { competitionId, type: "TEAM" },
    orderBy: { sequence: "asc" },
    include: {
      rounds: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true } },
    },
  });
}

/** The competition's scoring configuration, which holds `schoolCoefficient`. */
export function findScoringConfiguration(competitionId: string) {
  return prisma.scoringConfiguration.findUnique({
    where: { competitionId },
    select: { schoolCoefficient: true },
  });
}

/** Every school of a competition, in file order. */
export function listSchools(competitionId: string) {
  return prisma.school.findMany({
    where: { competitionId },
    select: { id: true, name: true },
    orderBy: { sequence: "asc" },
  });
}

/**
 * Every active participant of a category, with their school. This is the set the
 * individual half of the formula sums over — **all** of the school's players in
 * the category, whether or not they are on that school's team (SCR-018).
 */
export function listActiveCategoryParticipantsWithSchool(categoryId: string) {
  return prisma.participant.findMany({
    where: { categoryId, active: true },
    select: { id: true, schoolId: true },
  });
}

/**
 * The team→school mapping for a category, so a team result can be attributed to
 * the school that owns it. Exactly one team per school per category (SCR-004).
 */
export function listTeamsInCategory(categoryId: string) {
  return prisma.team.findMany({
    where: { categoryId },
    select: { id: true, schoolId: true },
  });
}

/**
 * The team round results for a set of rounds, scoped to one category. One row per
 * (team, round) that has been finalized.
 */
export function listTeamResultsForRounds(roundIds: string[], categoryId: string) {
  return prisma.teamRoundResult.findMany({
    where: { roundId: { in: roundIds }, categoryId },
    select: { teamId: true, roundId: true, score: true },
  });
}

/**
 * Replace a category's current SCHOOL-scope snapshot. Same delete-then-create
 * shape as Unit 09's individual snapshot: the "current" row has no natural unique
 * key and the payload is replaced wholesale, so the two writes run in one
 * transaction and a reader never sees a gap.
 */
export async function replaceCurrentSchoolSnapshot(input: {
  competitionId: string;
  categoryId: string;
  isFinal: boolean;
  payload: SchoolRankingSnapshotPayload;
}): Promise<RankingSnapshot> {
  return prisma.$transaction(async (tx) => {
    await tx.rankingSnapshot.deleteMany({
      where: {
        competitionId: input.competitionId,
        categoryId: input.categoryId,
        scope: "SCHOOL",
      },
    });
    return tx.rankingSnapshot.create({
      data: {
        competitionId: input.competitionId,
        stageId: null,
        categoryId: input.categoryId,
        scope: "SCHOOL",
        isFinal: input.isFinal,
        payload: input.payload as object,
      },
    });
  });
}

/** The current SCHOOL-scope snapshot for a category, or null if none yet. */
export function findCurrentSchoolSnapshot(
  competitionId: string,
  categoryId: string,
): Promise<RankingSnapshot | null> {
  return prisma.rankingSnapshot.findFirst({
    where: { competitionId, categoryId, scope: "SCHOOL" },
    orderBy: { computedAt: "desc" },
  });
}
