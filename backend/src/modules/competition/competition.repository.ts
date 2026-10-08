/**
 * Prisma access for the Competition module (Unit 03). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface). Every function here is a thin wrapper over Prisma.
 */
import type { Competition, Prisma, StageType } from "@prisma/client";
import { prisma } from "../../infra";
import type { RoundSettingsPatch } from "./competition.types";

/**
 * The shape every read of a competition uses: its categories, its stages with their
 * rounds and each round's settings, and its scoring configuration. Kept in one place
 * so a create and a read return the same structure.
 */
export const COMPETITION_STRUCTURE_INCLUDE = {
  categories: { orderBy: { sequence: "asc" } },
  stages: {
    orderBy: { sequence: "asc" },
    include: {
      rounds: {
        orderBy: { sequence: "asc" },
        include: { settings: true },
      },
    },
  },
  scoringConfiguration: true,
} satisfies Prisma.CompetitionInclude;

export type CompetitionWithStructure = Prisma.CompetitionGetPayload<{
  include: typeof COMPETITION_STRUCTURE_INCLUDE;
}>;

export function findCompetitionById(
  id: string,
): Promise<CompetitionWithStructure | null> {
  return prisma.competition.findUnique({
    where: { id },
    include: COMPETITION_STRUCTURE_INCLUDE,
  });
}

/**
 * The dashboard's competition picker (Unit 11, spec Detail 10). Newest first, and only
 * the few columns a list row needs — the full structure is a separate read.
 */
export function listCompetitions(): Promise<
  {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    publishedAt: Date | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }[]
> {
  return prisma.competition.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Creation (the structure is computed by the service; this only writes it)
// ---------------------------------------------------------------------------

export interface CategoryStructureInput {
  code: string;
  name: string;
  sequence: number;
}

export interface RoundStructureInput {
  sequence: number;
  name: string;
  durationSeconds: number;
}

export interface StageStructureInput {
  type: StageType;
  sequence: number;
  rounds: RoundStructureInput[];
}

export interface CreateCompetitionData {
  name: string;
  description: string | null;
  categories: CategoryStructureInput[];
  stages: StageStructureInput[];
}

/**
 * Create the competition, its categories, its 1:1 scoring configuration (schema
 * defaults: coefficient 0.6, ranking cycle 180s) and the fixed stage/round structure
 * with each round's settings — all in one nested write, so a failure creates nothing.
 * The two link tokens come from the schema's `@default(uuid())`, so they exist from
 * this moment.
 */
export function createCompetition(
  data: CreateCompetitionData,
): Promise<CompetitionWithStructure> {
  return prisma.competition.create({
    data: {
      name: data.name,
      description: data.description,
      scoringConfiguration: { create: {} },
      categories: { create: data.categories },
      stages: {
        create: data.stages.map((stage) => ({
          type: stage.type,
          sequence: stage.sequence,
          rounds: {
            create: stage.rounds.map((round) => ({
              sequence: round.sequence,
              name: round.name,
              settings: { create: { durationSeconds: round.durationSeconds } },
            })),
          },
        })),
      },
    },
    include: COMPETITION_STRUCTURE_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export function updateCompetitionMeta(
  id: string,
  data: { name?: string; description?: string | null },
): Promise<Competition> {
  return prisma.competition.update({ where: { id }, data });
}

export interface CategoryChangePlan {
  create: CategoryStructureInput[];
  update: { id: string; name: string; sequence: number }[];
  deleteIds: string[];
}

/** Apply a category add/remove/reorder plan atomically. */
export function applyCategoryChanges(
  competitionId: string,
  plan: CategoryChangePlan,
): Promise<unknown> {
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  if (plan.deleteIds.length > 0) {
    operations.push(
      prisma.competitionCategory.deleteMany({ where: { id: { in: plan.deleteIds } } }),
    );
  }
  for (const change of plan.update) {
    operations.push(
      prisma.competitionCategory.update({
        where: { id: change.id },
        data: { name: change.name, sequence: change.sequence },
      }),
    );
  }
  if (plan.create.length > 0) {
    operations.push(
      prisma.competitionCategory.createMany({
        data: plan.create.map((category) => ({ ...category, competitionId })),
      }),
    );
  }
  return prisma.$transaction(operations);
}

/** Load a round with the competition it belongs to, to scope a settings edit. */
export function findRoundWithCompetition(roundId: string): Promise<
  | (Prisma.RoundGetPayload<{ include: { settings: true } }> & {
      stage: { competitionId: string };
    })
  | null
> {
  return prisma.round.findUnique({
    where: { id: roundId },
    include: { settings: true, stage: { select: { competitionId: true } } },
  });
}

export function updateRoundSettings(
  roundId: string,
  data: RoundSettingsPatch,
): Promise<unknown> {
  return prisma.roundSettings.update({ where: { roundId }, data });
}

// ---------------------------------------------------------------------------
// Publish readiness data (raw facts; the service applies the rules)
// ---------------------------------------------------------------------------

export function listActiveParticipantCategoryIds(
  competitionId: string,
): Promise<{ categoryId: string }[]> {
  return prisma.participant.findMany({
    where: { competitionId, active: true },
    select: { categoryId: true },
  });
}

/**
 * Count the questions a category has *assigned* to each round, for the publish
 * readiness check. Since `Question.roundId` became nullable (BLD-040 — an imported
 * question sits in the category's pool with `roundId = null` until the controller's
 * manual round-selection step, Unit 05), an unassigned question no longer implies any
 * round is covered. This counts only rows with `roundId` set, grouped per round, so the
 * service can require a complete selection per Individual round rather than a mere
 * non-empty join.
 */
export function countCategoryQuestionsPerRound(
  categoryId: string,
): Promise<{ roundId: string; count: number }[]> {
  return prisma.question.groupBy({
    by: ["roundId"],
    where: { questionSet: { categoryId }, roundId: { not: null } },
    _count: { _all: true },
  }).then((rows) =>
    // groupBy returns `roundId: string | null`; the `not: null` filter guarantees a
    // value, so the cast is safe and keeps the return type honest for the service.
    rows.map((row) => ({
      roundId: row.roundId as string,
      count: row._count._all,
    })),
  );
}

export function listActiveParticipantNumbers(
  competitionId: string,
): Promise<{ participantNumber: number }[]> {
  return prisma.participant.findMany({
    where: { competitionId, active: true },
    select: { participantNumber: true },
  });
}

export function listJudgeRanges(
  competitionId: string,
): Promise<{ fromParticipantNumber: number; toParticipantNumber: number }[]> {
  return prisma.competitionJudgeAssignment.findMany({
    where: { competitionId },
    select: { fromParticipantNumber: true, toParticipantNumber: true },
  });
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Move the competition through `PUBLISHED` to its steady `WAITING` state and record
 * the publish time, in one transaction. The two link tokens already exist (created
 * with the row), so nothing else is written.
 */
export function markPublished(id: string, publishedAt: Date): Promise<Competition> {
  return prisma.$transaction(async (tx) => {
    await tx.competition.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt },
    });
    return tx.competition.update({
      where: { id },
      data: { status: "WAITING" },
    });
  });
}
