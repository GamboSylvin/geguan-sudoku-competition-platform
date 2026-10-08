/**
 * Prisma access for the Round module (Unit 07). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface). Every function here is a thin wrapper over Prisma.
 *
 * The runtime working state (the in-flight timer, the paused remaining seconds)
 * lives in Redis per BLD-007 and is accessed through `round-timer.store.ts`, not
 * here. Only durable round/stage/competition state changes go through this file.
 */
import type { Competition, CompetitionRuntimeState, Round, RoundStatus, Stage, StageStatus } from "@prisma/client";
import { prisma } from "../../infra";

/** A round with the rows the timer needs to do its job, in one shape. */
export const ROUND_WITH_CONTEXT_INCLUDE = {
  settings: true,
  stage: {
    select: {
      id: true,
      competitionId: true,
      type: true,
      sequence: true,
      status: true,
    },
  },
} as const;

export type RoundWithContext = import("@prisma/client").Prisma.RoundGetPayload<{
  include: typeof ROUND_WITH_CONTEXT_INCLUDE;
}>;

export function findRoundWithContext(roundId: string): Promise<RoundWithContext | null> {
  return prisma.round.findUnique({
    where: { id: roundId },
    include: ROUND_WITH_CONTEXT_INCLUDE,
  });
}

/** A competition with the structure the internal trigger reads. */
export const COMPETITION_WITH_STRUCTURE_INCLUDE = {
  stages: {
    orderBy: { sequence: "asc" as const },
    include: {
      rounds: {
        orderBy: { sequence: "asc" as const },
        include: { settings: true },
      },
    },
  },
} as const;

export type CompetitionWithStructure = import("@prisma/client").Prisma.CompetitionGetPayload<{
  include: typeof COMPETITION_WITH_STRUCTURE_INCLUDE;
}>;

export function findCompetitionWithStructure(
  competitionId: string,
): Promise<CompetitionWithStructure | null> {
  return prisma.competition.findUnique({
    where: { id: competitionId },
    include: COMPETITION_WITH_STRUCTURE_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// State transitions (durable, per BLD-007)
// ---------------------------------------------------------------------------

export function setRoundStatus(
  roundId: string,
  status: RoundStatus,
  timestamps: { startedAt?: Date; endedAt?: Date; earlyEnded?: boolean } = {},
): Promise<Round> {
  return prisma.round.update({
    where: { id: roundId },
    data: { status, ...timestamps },
  });
}

export function setStageStatus(
  stageId: string,
  status: StageStatus,
  timestamps: { startedAt?: Date; endedAt?: Date } = {},
): Promise<Stage> {
  return prisma.stage.update({
    where: { id: stageId },
    data: { status, ...timestamps },
  });
}

export function setCompetitionStatus(
  competitionId: string,
  status: Competition["status"],
  timestamps: { startedAt?: Date; finishedAt?: Date; cancelledAt?: Date } = {},
): Promise<Competition> {
  return prisma.competition.update({
    where: { id: competitionId },
    data: { status, ...timestamps },
  });
}

// ---------------------------------------------------------------------------
// CompetitionRuntimeState — the durable echo of where the competition is
// ---------------------------------------------------------------------------

export interface UpsertRuntimeStateInput {
  competitionId: string;
  currentStageId: string | null;
  currentRoundId: string | null;
  phase: string;
  pausedAt?: Date | null;
  remainingSecondsAtPause?: number | null;
}

export function upsertRuntimeState(input: UpsertRuntimeStateInput): Promise<CompetitionRuntimeState> {
  return prisma.competitionRuntimeState.upsert({
    where: { competitionId: input.competitionId },
    create: {
      competitionId: input.competitionId,
      currentStageId: input.currentStageId,
      currentRoundId: input.currentRoundId,
      phase: input.phase,
      pausedAt: input.pausedAt ?? null,
      remainingSecondsAtPause: input.remainingSecondsAtPause ?? null,
    },
    update: {
      currentStageId: input.currentStageId,
      currentRoundId: input.currentRoundId,
      phase: input.phase,
      pausedAt: input.pausedAt ?? null,
      remainingSecondsAtPause: input.remainingSecondsAtPause ?? null,
    },
  });
}

export function findRuntimeState(
  competitionId: string,
): Promise<CompetitionRuntimeState | null> {
  return prisma.competitionRuntimeState.findUnique({ where: { competitionId } });
}

// ---------------------------------------------------------------------------
// Questions for a round (fetched at the round's start, not before — BLD-006)
// ---------------------------------------------------------------------------

export interface RoundQuestionRow {
  id: string;
  sequence: number;
  type: "STANDARD" | "VARIANT";
  gridRows: number;
  gridColumns: number;
  regions: unknown;
  startingGrid: unknown;
  points: number;
}

/**
 * Read the round's questions, *without* the solution column — the solution is
 * server-side only (BLD-010). One question set per category supplies the round,
 * so a round's questions span several question sets; we only need the rows
 * themselves, scoped by roundId.
 */
export function listRoundQuestions(roundId: string): Promise<RoundQuestionRow[]> {
  return prisma.question.findMany({
    where: { roundId },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      type: true,
      gridRows: true,
      gridColumns: true,
      regions: true,
      startingGrid: true,
      points: true,
    },
  });
}
