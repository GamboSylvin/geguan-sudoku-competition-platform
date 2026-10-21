/**
 * Seeds a competition's questions so its publish-readiness check passes.
 *
 * Shared by the suites that publish a competition only as a precondition for what they
 * actually test (rounding, scoring, judging, ranking, deletion, copying). Before BLD-040
 * was revised (2026-10-19) an Individual round was the only kind holding a selection, so
 * these suites seeded 6 questions per Individual round and stopped there. A Team round
 * now holds its own selection too, and the readiness check requires it, so each of them
 * would fail with `competition.notReady` — for a rule none of them is about.
 *
 * The count is per-round, not a constant: 6 for an Individual round, `teamQuestionCount`
 * for the Team rotation relay (round 1), `partitionPuzzleCount` for the Team partition
 * round (round 2). Read them from the round's own `settings` rather than hard-coding, so
 * a suite that changes them keeps working.
 *
 * `sequence` has no global uniqueness constraint (verified in `schema.prisma`), so it
 * restarts at 1 in every round — which is what the real importer produces per set.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * The grid fields a `Question` row needs, identical for every seeded row. They are JSON
 * columns, so the type is Prisma's own rather than a shape this helper would invent: the
 * suites seed a real 4x4 grid, a 1x1 one, or a mix, and all of them must go through.
 */
export type SeededGrid = {
  gridRows: number;
  gridColumns: number;
  regions: Prisma.InputJsonValue;
  startingGrid: Prisma.InputJsonValue;
  solution: Prisma.InputJsonValue;
};

/**
 * A stage with its rounds, as `include: { stages: { include: { rounds: true } } }`
 * returns it. `settings` is optional because that include does not load the relation:
 * a suite that leaves the counts at their schema defaults does not need it, and one that
 * overrides them must widen its own include to `{ rounds: { include: { settings: true } } }`.
 */
type StageWithRounds = {
  type: string;
  rounds: Array<{
    id: string;
    sequence: number;
    settings?: { teamQuestionCount?: number | null; partitionPuzzleCount?: number | null } | null;
  }>;
};

/** How many questions a round of this kind must hold. */
export function questionsForRound(stage: StageWithRounds, round: StageWithRounds["rounds"][number]): number {
  if (stage.type !== "TEAM") return 6;
  // Round 2 of the Team stage is the partition round (齐心协力); any other is the
  // rotation relay — the same mapping `app.ts` uses at runtime.
  if (round.sequence === 2) return round.settings?.partitionPuzzleCount ?? 3;
  return round.settings?.teamQuestionCount ?? 10;
}

/**
 * Creates every question the readiness check expects, for one category's stages. Returns
 * the created ids in round order, so a caller that needs one specific question can pick
 * it out without a second query.
 */
export async function seedReadinessQuestions(
  prisma: PrismaClient,
  options: {
    questionSetId: string;
    stages: StageWithRounds[];
    grid: SeededGrid;
  },
): Promise<string[]> {
  const { questionSetId, stages, grid } = options;
  const created: string[] = [];

  for (const stage of stages) {
    for (const round of stage.rounds) {
      const count = questionsForRound(stage, round);
      for (let sequence = 1; sequence <= count; sequence += 1) {
        const question = await prisma.question.create({
          data: {
            questionSetId,
            roundId: round.id,
            sequence,
            points: 10,
            gridRows: grid.gridRows,
            gridColumns: grid.gridColumns,
            regions: grid.regions,
            startingGrid: grid.startingGrid,
            solution: grid.solution,
          },
        });
        created.push(question.id);
      }
    }
  }

  return created;
}
