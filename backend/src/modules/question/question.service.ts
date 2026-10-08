/**
 * The domain rules of the Question module and its public interface (Unit 05).
 * Other modules call this service, never the repository (invariant 4).
 *
 * What lives here: importing one category's `.xlsx` file into a pool of `Question`
 * rows, listing that pool grouped by `QuestionSet`, and the controller's manual
 * round-selection step that assigns exactly 6 pool questions to an Individual round.
 *
 * Three rules worth stating:
 * - **The import is atomic.** Every row must parse; one bad row rejects the whole
 *   file and names the row and the problem (spec Detail 1). The uploaded file is
 *   still stored and its `ImportBatch` written with `status = REJECTED`, so the
 *   rejection is auditable (BLD-039) without leaving a half-filled pool behind.
 * - **No image is read and no OCR runs** (BLD-047): the given cells come from a
 *   plain text column, complementary to `*正确答案`.
 * - **Only an Individual round holds a selection** (BLD-040). Team rounds draw from
 *   the pool directly — the rotation round at random, the partition round by index —
 *   so neither is ever given a `roundId`.
 */
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { competitionFilePath, ensureStorageRoot } from "../../infra";
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { parseQuestionFile } from "./question-parse";
import { readUploadedFile } from "./question-multipart";
import { QuestionFileError, readQuestionWorkbook } from "./question-xlsx";
import * as repository from "./question.repository";
import type {
  ImportResultView,
  PoolView,
  QuestionImportFailure,
  SelectionResultView,
} from "./question.types";

/** An Individual round uses exactly 6 questions (competition-rules.md §2, BLD-040). */
export const ROUND_QUESTION_COUNT = 6;

/** The round statuses past which a selection can no longer change (RND-002/RND-004). */
const LOCKED_ROUND_STATUSES = new Set(["PREPARATION", "ACTIVE", "PAUSED", "FINISHED"]);

/** 20 MB: the real files are tens of kilobytes, so this is a guard, not a limit. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function notFoundError(): NotFoundError {
  return new NotFoundError(translate("en", "question.notFound"), {
    code: "question.notFound",
  });
}

/**
 * A malformed request (no file, a wrong-shaped selection). `AppError` is used rather
 * than `ValidationError` because the latter hard-codes `VALIDATION_ERROR` as its code,
 * and the client localizes by code — every rejection here needs its own.
 */
function badRequest(code: string): AppError {
  return new AppError(translate("en", code), { statusCode: 400, code });
}

function importFailure(code: string, failures: QuestionImportFailure[]): UnprocessableEntityError {
  return new UnprocessableEntityError(translate("en", code), {
    code,
    details: { failures },
  });
}

/** One uploaded file, as the controller hands it to the service. */
export interface UploadedQuestionFile {
  body: Buffer;
  boundary: string;
}

/**
 * Import one `.xlsx` for one category.
 *
 * Returns the created `QuestionSet`'s summary, or throws:
 * - 404 when the category isn't in this competition (spec Error Cases);
 * - 400 when the request carries no file or the body is too large;
 * - 422 when the file isn't a readable workbook or any row fails validation.
 */
export async function importQuestionFile(params: {
  competitionId: string;
  categoryId: string;
  upload: UploadedQuestionFile;
  uploadedByAccountId: string | null;
}): Promise<ImportResultView> {
  const { competitionId, categoryId, upload, uploadedByAccountId } = params;

  const category = await repository.findCategoryScope(categoryId);
  if (!category || category.competitionId !== competitionId) {
    throw notFoundError();
  }

  if (upload.body.length > MAX_UPLOAD_BYTES) {
    throw badRequest("question.import.notAnExcelFile");
  }

  let file: { filename: string; mimeType: string; bytes: Buffer } | null;
  try {
    file = readUploadedFile(upload.body, upload.boundary);
  } catch {
    throw badRequest("question.import.noFile");
  }
  if (!file) {
    throw badRequest("question.import.noFile");
  }

  // Reading the workbook and parsing its rows are separated so a malformed file and a
  // malformed row report differently: the former is "not an Excel file", the latter
  // names the row.
  let rows;
  let fallbackVariantLabel: string;
  try {
    ({ rows, variantLabel: fallbackVariantLabel } = await readQuestionWorkbook(file.bytes));
  } catch (error) {
    if (error instanceof QuestionFileError) {
      throw importFailure(error.code, [
        { row: 0, code: error.code, message: translate("en", error.code) },
      ]);
    }
    throw error;
  }

  const parsed = parseQuestionFile(rows, fallbackVariantLabel);

  const fileId = randomUUID();
  await ensureStorageRoot();
  const path = competitionFilePath({
    competitionId,
    kind: "QUESTION_EXCEL",
    fileId,
    originalName: file.filename,
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.bytes);

  const base = {
    competitionId,
    kind: "QUESTION_EXCEL" as const,
    path,
    originalName: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.bytes.length,
    checksum: createHash("sha256").update(file.bytes).digest("hex"),
    uploadedByAccountId,
  };

  if (!parsed.ok) {
    // The file and its REJECTED batch are still written: the organizer needs the
    // original on disk to see what went wrong (BLD-039), and nothing is committed.
    await repository.writeImport({
      file: base,
      questionSet: null,
      questions: [],
      batch: { competitionId, status: "REJECTED", errors: parsed.failures },
    });
    throw importFailure(parsed.failures[0]!.code, parsed.failures);
  }

  const written = await repository.writeImport({
    file: base,
    questionSet: {
      name: parsed.variantLabel,
      categoryId,
      competitionId,
    },
    questions: parsed.questions,
    batch: { competitionId, status: "COMMITTED", errors: null },
  });

  return {
    questionSetId: written.questionSetId ?? "",
    variantLabel: parsed.variantLabel,
    questionCount: parsed.questions.length,
  };
}

/** List one category's pool, grouped by `QuestionSet` (BLD-044: several per category). */
export async function listPool(
  competitionId: string,
  categoryId: string,
): Promise<PoolView> {
  const category = await repository.findCategoryScope(categoryId);
  if (!category || category.competitionId !== competitionId) {
    throw notFoundError();
  }

  const sets = await repository.listCategoryPool(categoryId);
  return {
    categoryId,
    groups: sets.map((set) => ({
      questionSet: {
        id: set.id,
        name: set.name,
        questionCount: set.questions.length,
        assignedCounts: countByRound(set.questions.map((q) => q.roundId)),
      },
      questions: set.questions.map((question) => ({
        id: question.id,
        sequence: question.sequence,
        variantLabel: set.name,
        gridRows: question.gridRows,
        gridColumns: question.gridColumns,
        points: question.points,
        roundId: question.roundId,
      })),
    })),
  };
}

/** Group the non-null `roundId`s into per-round counts, for the pool summary. */
function countByRound(roundIds: (string | null)[]): { roundId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const roundId of roundIds) {
    if (roundId === null) continue;
    counts.set(roundId, (counts.get(roundId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ roundId: id, count }));
}

/**
 * Assign exactly 6 pool questions to one Individual round (spec Detail 5).
 *
 * Re-selecting replaces the previous 6 — they revert to `roundId = null`, back in the
 * pool. Rejected with 409 once that round's preparation has begun (the same cutoff
 * `RoundSettings` uses, RND-002/RND-004), with 400 when the ids don't make a valid
 * selection, and with 404 when the round or category isn't in this competition.
 */
export async function selectRoundQuestions(params: {
  competitionId: string;
  categoryId: string;
  roundId: string;
  questionIds: string[];
}): Promise<SelectionResultView> {
  const { competitionId, categoryId, roundId, questionIds } = params;

  const category = await repository.findCategoryScope(categoryId);
  if (!category || category.competitionId !== competitionId) {
    throw notFoundError();
  }
  const round = await repository.findRoundScope(roundId);
  if (!round || round.competitionId !== competitionId) {
    throw notFoundError();
  }

  // A Team round never holds a `roundId` (BLD-040): it draws from the pool itself.
  if (round.stageType !== "INDIVIDUAL") {
    throw badRequest("question.selection.notIndividualRound");
  }
  if (LOCKED_ROUND_STATUSES.has(round.status)) {
    throw new ConflictError(translate("en", "question.selection.locked"), {
      code: "question.selection.locked",
    });
  }

  if (questionIds.length !== ROUND_QUESTION_COUNT) {
    throw badRequest("question.selection.invalidCount");
  }
  if (new Set(questionIds).size !== questionIds.length) {
    throw badRequest("question.selection.duplicateIds");
  }

  const found = await repository.listPoolQuestionsByIds(categoryId, questionIds);
  if (found.length !== questionIds.length) {
    throw badRequest("question.selection.notInPool");
  }

  await repository.applyRoundSelection(categoryId, roundId, questionIds);
  return { roundId, questionIds };
}

export const questionService = {
  importQuestionFile,
  listPool,
  selectRoundQuestions,
  ROUND_QUESTION_COUNT,
};
