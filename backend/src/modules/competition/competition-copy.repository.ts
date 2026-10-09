/**
 * Prisma access for the Competition module's copy operation (Unit 15, CMP-100 /
 * CA-004, resolves U-10). No domain rule lives here; `competition-copy.service.ts`
 * decides what is copied. Kept in its own file so Unit 03's repository stays
 * untouched.
 *
 * The whole copy runs inside ONE transaction (spec 15, Implementation Notes): a
 * partially copied competition — questions copied but judges not — would be a
 * confusing state to debug or clean up.
 */
import type { Prisma, QuestionType } from "@prisma/client";
import { prisma } from "../../infra";
import {
  COMPETITION_STRUCTURE_INCLUDE,
  type CompetitionWithStructure,
} from "./competition.repository";

/** Everything a copy reads from the source: the structure, the questions, the judges. */
export interface CopySource {
  competition: CompetitionWithStructure;
  questionSets: {
    id: string;
    categoryId: string;
    name: string;
    questions: {
      id: string;
      roundId: string | null;
      sequence: number;
      type: QuestionType;
      gridRows: number;
      gridColumns: number;
      regions: Prisma.JsonValue;
      startingGrid: Prisma.JsonValue;
      solution: Prisma.JsonValue;
      points: number;
    }[];
  }[];
  judgeAssignments: {
    judgeId: string;
    fromParticipantNumber: number;
    toParticipantNumber: number;
  }[];
}

/**
 * Read the source competition with everything a copy carries. Questions come with
 * their sets so the set→category and question→round links can be re-pointed at the
 * new rows.
 */
export async function readCopySource(sourceCompetitionId: string): Promise<CopySource | null> {
  const competition = await prisma.competition.findUnique({
    where: { id: sourceCompetitionId },
    include: COMPETITION_STRUCTURE_INCLUDE,
  });
  if (!competition) return null;

  const [questionSets, judgeAssignments] = await Promise.all([
    prisma.questionSet.findMany({
      where: { competitionId: sourceCompetitionId },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        questions: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            roundId: true,
            sequence: true,
            type: true,
            gridRows: true,
            gridColumns: true,
            regions: true,
            startingGrid: true,
            solution: true,
            points: true,
          },
        },
      },
    }),
    prisma.competitionJudgeAssignment.findMany({
      where: { competitionId: sourceCompetitionId },
      orderBy: { fromParticipantNumber: "asc" },
      select: {
        judgeId: true,
        fromParticipantNumber: true,
        toParticipantNumber: true,
      },
    }),
  ]);

  return { competition, questionSets, judgeAssignments };
}

/**
 * Write the copy. Every new row is scoped to the new competition, so nothing is
 * shared with the source: the categories, the stage/round/settings structure with
 * the source's own customized values, the scoring configuration, the question
 * sets and their questions, and the judge assignments (same `Judge` entities,
 * same ranges as a starting point).
 *
 * Deliberately absent — a copy never carries player data or results: `School`,
 * `Team`, `Participant`, player `Account`, `Attempt`, `Answer`,
 * `IndividualRoundResult`, `TeamRoundResult`, `ScoreCorrection`,
 * `RankingSnapshot`, `StoredFile`, `ImportBatch`. `QuestionSet.sourceFileId` is
 * left null for the same reason (the stored file belongs to the source).
 */
export async function writeCopy(input: {
  source: CopySource;
  name: string;
}): Promise<string> {
  const { source } = input;

  return prisma.$transaction(async (tx) => {
    const created = await tx.competition.create({
      data: {
        name: input.name,
        description: source.competition.description,
        // `CREATED` is the schema default; stated here because acceptance
        // criterion 3 is about exactly this.
        status: "CREATED",
        copiedFromCompetitionId: source.competition.id,
        scoringConfiguration: source.competition.scoringConfiguration
          ? {
              create: {
                schoolCoefficient: source.competition.scoringConfiguration.schoolCoefficient,
                rankingCycleSeconds: source.competition.scoringConfiguration.rankingCycleSeconds,
              },
            }
          : { create: {} },
      },
      select: { id: true },
    });
    const newCompetitionId = created.id;

    // old category id -> new category id
    const categoryIds = new Map<string, string>();
    for (const category of source.competition.categories) {
      const newCategory = await tx.competitionCategory.create({
        data: {
          competitionId: newCompetitionId,
          code: category.code,
          name: category.name,
          sequence: category.sequence,
        },
        select: { id: true },
      });
      categoryIds.set(category.id, newCategory.id);
    }

    // old round id -> new round id, so a question's round assignment follows.
    const roundIds = new Map<string, string>();
    for (const stage of source.competition.stages) {
      const newStage = await tx.stage.create({
        data: {
          competitionId: newCompetitionId,
          type: stage.type,
          sequence: stage.sequence,
        },
        select: { id: true },
      });
      for (const round of stage.rounds) {
        const settings = round.settings;
        const newRound = await tx.round.create({
          data: {
            stageId: newStage.id,
            sequence: round.sequence,
            name: round.name,
            settings: settings
              ? {
                  create: {
                    // Every value is the source's own, not a schema default —
                    // that is the whole point of a copy (spec 15, detail 3).
                    durationSeconds: settings.durationSeconds,
                    preparationSeconds: settings.preparationSeconds,
                    earlyBonusRate: settings.earlyBonusRate,
                    earlyBonusCap: settings.earlyBonusCap,
                    teamPointsPerQuestion: settings.teamPointsPerQuestion,
                    rotationPeriodSeconds: settings.rotationPeriodSeconds,
                    teamQuestionCount: settings.teamQuestionCount,
                    teamTotalTimeSeconds: settings.teamTotalTimeSeconds,
                    individualTotalWarning: settings.individualTotalWarning,
                    partitionPuzzleCount: settings.partitionPuzzleCount,
                    partitionTotalTimeSeconds: settings.partitionTotalTimeSeconds,
                    partitionPointsPerPuzzle: settings.partitionPointsPerPuzzle,
                  },
                }
              : undefined,
          },
          select: { id: true },
        });
        roundIds.set(round.id, newRound.id);
      }
    }

    for (const set of source.questionSets) {
      const newCategoryId = categoryIds.get(set.categoryId);
      if (!newCategoryId) continue; // a set whose category was not copied cannot be copied
      const newSet = await tx.questionSet.create({
        data: {
          competitionId: newCompetitionId,
          categoryId: newCategoryId,
          name: set.name,
          // sourceFileId intentionally null: the stored file is not copied.
        },
        select: { id: true },
      });
      for (const question of set.questions) {
        await tx.question.create({
          data: {
            questionSetId: newSet.id,
            roundId: question.roundId ? (roundIds.get(question.roundId) ?? null) : null,
            sequence: question.sequence,
            type: question.type,
            gridRows: question.gridRows,
            gridColumns: question.gridColumns,
            regions: question.regions as Prisma.InputJsonValue,
            startingGrid: question.startingGrid as Prisma.InputJsonValue,
            solution: question.solution as Prisma.InputJsonValue,
            points: question.points,
          },
        });
      }
    }

    for (const assignment of source.judgeAssignments) {
      await tx.competitionJudgeAssignment.create({
        data: {
          competitionId: newCompetitionId,
          judgeId: assignment.judgeId,
          fromParticipantNumber: assignment.fromParticipantNumber,
          toParticipantNumber: assignment.toParticipantNumber,
          // assignedByAccountId left null: the copy has not been assigned by anyone yet.
        },
      });
    }

    return newCompetitionId;
  });
}

/** Re-read the finished copy in the same shape create/update/publish return. */
export function readCompetitionWithStructure(id: string): Promise<CompetitionWithStructure | null> {
  return prisma.competition.findUnique({
    where: { id },
    include: COMPETITION_STRUCTURE_INCLUDE,
  });
}
