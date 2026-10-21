/**
 * Prisma access for the Round module (Unit 07). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface). Every function here is a thin wrapper over Prisma.
 *
 * The runtime working state (the in-flight timer, the paused remaining seconds)
 * lives in Redis per BLD-007 and is accessed through `round-timer.store.ts`, not
 * here. Only durable round/stage/competition state changes go through this file.
 */
import type {
  Competition,
  CompetitionRuntimeState,
  Round,
  RoundParticipation,
  RoundStatus,
  Stage,
  StageStatus,
} from "@prisma/client";
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
// RoundParticipation — created and activated when a round goes ACTIVE
// ---------------------------------------------------------------------------

/**
 * Every still-active participant of a competition, across **every** category.
 * `Stage`/`Round` rows are per-competition (Unit 03's structure), not per
 * category, so one round is shared by every category's participants and there is
 * nothing to iterate category by category.
 *
 * **Filtered on `individualEvent: true`** (Unit 04, spec §8 Q3). This read feeds only
 * `openParticipationsForRound`, which opens the Individual round's field — and the
 * participant file's `个人赛` column says who is in it. Without the filter a student
 * who is in the team event only would be dealt a puzzle, and Unit 08's round-ended
 * auto-submit sweep would write them a zero `IndividualRoundResult`, putting them in
 * the individual ranking they never entered. A **Team**-stage round must not use this
 * function: it would exclude the team-only players, who are exactly its field.
 */
export function listActiveParticipants(
  competitionId: string,
): Promise<{ id: string; categoryId: string }[]> {
  return prisma.participant.findMany({
    where: { competitionId, active: true, individualEvent: true },
    select: { id: true, categoryId: true },
  });
}

/**
 * Open a participant's row for a round, in state `ACTIVE`. An **upsert**, not a
 * blind `create`: if a row already exists — pre-created as `WAITING` by a future
 * import step, or left behind by the orchestrator's restart — it is activated
 * rather than failing the schema's `@@unique([roundId, participantId])`. No
 * `Attempt` is created here; `Attempt` rows are written only at finalize
 * (`scoring.repository.ts`), and autosave works through Redis alone.
 */
export function upsertActiveParticipation(input: {
  roundId: string;
  participantId: string;
  categoryId: string;
}): Promise<RoundParticipation> {
  return prisma.roundParticipation.upsert({
    where: {
      roundId_participantId: {
        roundId: input.roundId,
        participantId: input.participantId,
      },
    },
    create: {
      roundId: input.roundId,
      participantId: input.participantId,
      categoryId: input.categoryId,
      state: "ACTIVE",
    },
    update: { state: "ACTIVE" },
  });
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
 * server-side only (BLD-010).
 *
 * `categoryId` is what keeps one category's questions away from another's. A
 * `Round` row is shared by every category of the competition (`Stage`/`Round` are
 * per-competition, not per-category) and each category's controller assigns its
 * own 6 questions onto that **same** `roundId`, so a competition with *n*
 * categories has *6n* `Question` rows pointing at one `roundId`: filtering by
 * `roundId` alone hands every category's questions to whoever asks. The filter
 * joins `Question.questionSetId → QuestionSet.categoryId`, which is always
 * defined (`QuestionSet.categoryId` is non-nullable — BLD-028).
 *
 * Passing `categoryId: null` deliberately disables the filter. No caller does that
 * today; the parameter is optional only so the Team-round paths (which never set
 * `Question.roundId` at all — BLD-040 — and so find nothing either way) stay
 * unchanged.
 */
export function listRoundQuestions(
  roundId: string,
  categoryId?: string | null,
): Promise<RoundQuestionRow[]> {
  return prisma.question.findMany({
    where: {
      roundId,
      ...(categoryId ? { questionSet: { categoryId } } : {}),
    },
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

/**
 * The competition's categories, in the order the controller set them up. Needed at
 * round start because the round-started push is built **once per category** — each
 * category's players receive their own 6 questions and nobody else's. Read through
 * the shared Prisma client rather than through the Competition module's barrel:
 * this module does not own the row, and reaching for data it does not own directly
 * is the pattern the rest of the codebase uses (it avoids an import cycle between
 * Round and Competition).
 */
export function listCompetitionCategories(
  competitionId: string,
): Promise<{ id: string; name: string; code: string }[]> {
  return prisma.competitionCategory.findMany({
    where: { competitionId },
    orderBy: { sequence: "asc" },
    select: { id: true, name: true, code: true },
  });
}
