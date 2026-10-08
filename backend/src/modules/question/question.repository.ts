/**
 * Prisma access for the Question module (Unit 05). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface).
 *
 * The import write is one `prisma.$transaction`: a successful file commits its
 * `StoredFile`, `ImportBatch` and every `Question` of the new `QuestionSet` together,
 * and a rejected file commits nothing (spec Implementation Detail 1, data-model.md's
 * `ImportBatch`: "Validation is atomic"). The original file row is written even on a
 * rejected import, since BLD-039 keeps the uploaded file for audit either way — the
 * `ImportBatch.status` is what records `REJECTED`.
 */
import { prisma } from "../../infra";
import type { ParsedQuestion } from "./question.types";

// ---------------------------------------------------------------------------
// Scope checks (a category must belong to the competition in the URL)
// ---------------------------------------------------------------------------

export interface CategoryScopeRow {
  id: string;
  competitionId: string;
  name: string;
}

export function findCategoryScope(categoryId: string): Promise<CategoryScopeRow | null> {
  return prisma.competitionCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, competitionId: true, name: true },
  });
}

export interface RoundScopeRow {
  id: string;
  status: string;
  stageType: string;
  competitionId: string;
}

/**
 * A round with the two facts the selection rules need: its competition (to scope the
 * URL) and its stage type (only an Individual round ever holds a `roundId`, BLD-040).
 */
export function findRoundScope(roundId: string): Promise<RoundScopeRow | null> {
  return prisma.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      status: true,
      stage: { select: { type: true, competitionId: true } },
    },
  }).then((row) =>
    row === null
      ? null
      : {
          id: row.id,
          status: row.status,
          stageType: row.stage.type,
          competitionId: row.stage.competitionId,
        },
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface StoredFileInput {
  competitionId: string;
  kind: "QUESTION_EXCEL";
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedByAccountId: string | null;
}

export interface ImportBatchInput {
  competitionId: string;
  fileId: string;
  status: "VALIDATED" | "REJECTED" | "COMMITTED";
  errors: unknown;
}

/**
 * Persist one uploaded file, its `ImportBatch`, and — when the import succeeded — the
 * new `QuestionSet` with one `Question` per parsed row. Everything is in a single
 * transaction, so a rejected file leaves no half-written pool behind.
 *
 * Returns the created `QuestionSet`'s id, or `null` when `questions` is empty (a
 * rejected import, where only the file and its batch row are written).
 */
export async function writeImport(params: {
  file: StoredFileInput;
  questionSet: { name: string; categoryId: string; competitionId: string } | null;
  questions: ParsedQuestion[];
  batch: Omit<ImportBatchInput, "fileId">;
}): Promise<{ fileId: string; batchId: string; questionSetId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const file = await tx.storedFile.create({ data: params.file });

    let questionSetId: string | null = null;
    if (params.questionSet !== null) {
      const created = await tx.questionSet.create({
        data: {
          competitionId: params.questionSet.competitionId,
          categoryId: params.questionSet.categoryId,
          name: params.questionSet.name,
          sourceFileId: file.id,
        },
      });
      questionSetId = created.id;

      await tx.question.createMany({
        data: params.questions.map((question, index) => ({
          questionSetId: created.id,
          // `roundId` stays null: an imported question is in the pool, not in a round
          // (BLD-040). The controller's selection step assigns it later.
          roundId: null,
          sequence: index + 1,
          // Every supported variant is a rule-added puzzle on an ordinary box
          // partition; the sub-types are OPEN (schema comment), so the generic kind
          // is what gets written rather than a guess.
          type: question.variantFamily === "STANDARD" ? "STANDARD" : "VARIANT",
          gridRows: question.gridRows,
          gridColumns: question.gridColumns,
          regions: question.regions,
          startingGrid: question.startingGrid,
          solution: question.solution,
          points: question.points,
        })),
      });
    }

    const batch = await tx.importBatch.create({
      data: {
        competitionId: params.batch.competitionId,
        kind: "QUESTION_EXCEL",
        fileId: file.id,
        status: params.batch.status,
        errors: params.batch.errors as object,
      },
    });

    return { fileId: file.id, batchId: batch.id, questionSetId };
  });
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

export interface PoolQuestionSetRow {
  id: string;
  name: string;
  questions: {
    id: string;
    sequence: number;
    gridRows: number;
    gridColumns: number;
    points: number;
    roundId: string | null;
  }[];
}

/** Every `QuestionSet` of one category with its questions, in upload order. */
export function listCategoryPool(categoryId: string): Promise<PoolQuestionSetRow[]> {
  return prisma.questionSet.findMany({
    where: { categoryId },
    // Upload order: `QuestionSet` carries no timestamp of its own, so its source
    // file's is what sequences the pool. A set without a file (only a seed script
    // creates one) sorts first.
    orderBy: [{ sourceFile: { uploadedAt: "asc" } }, { id: "asc" }],
    include: {
      questions: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          gridRows: true,
          gridColumns: true,
          points: true,
          roundId: true,
        },
      },
    },
  }) as unknown as Promise<PoolQuestionSetRow[]>;
}

/** The variant label lives on the set, but the questions themselves carry it nowhere. */
export function listPoolQuestionsByIds(
  categoryId: string,
  questionIds: string[],
): Promise<{ id: string; roundId: string | null }[]> {
  return prisma.question.findMany({
    where: { id: { in: questionIds }, questionSet: { categoryId } },
    select: { id: true, roundId: true },
  });
}

// ---------------------------------------------------------------------------
// Round selection
// ---------------------------------------------------------------------------

/**
 * Point the 6 chosen questions at the round and return every other question of that
 * round to the pool (spec Detail 5: re-selecting replaces the previous 6).
 */
export async function applyRoundSelection(
  categoryId: string,
  roundId: string,
  questionIds: string[],
): Promise<void> {
  await prisma.$transaction([
    prisma.question.updateMany({
      where: { roundId, questionSet: { categoryId }, id: { notIn: questionIds } },
      data: { roundId: null },
    }),
    ...questionIds.map((id, index) =>
      prisma.question.update({ where: { id }, data: { roundId, sequence: index + 1 } }),
    ),
  ]);
}
