/**
 * Public types for the Question module (Unit 05).
 *
 * A question file is a *pool*: every row becomes a `Question` with `roundId = null`
 * (BLD-040), and a separate manual controller step assigns exactly 6 of them to each
 * Individual round. Nothing here is an ORM type — the module's internals stay behind
 * its barrel (invariant 4).
 */

/** One raw data row of the question Excel, as text, keyed by the column header. */
export type RawQuestionRow = Record<string, string>;

/** The variant families whose regions are the ordinary box partition (BLD-045). */
export type VariantFamily =
  | "STANDARD"
  | "DIAGONAL"
  | "SIZE_COMPARISON"
  | "FORTRESS"
  | "ANTI_KNIGHT";

/**
 * One parsed, validated question, ready to be written. The two grids are row-major
 * matrices; a `0` in `startingGrid` means the cell is blank for the player to fill.
 */
export interface ParsedQuestion {
  instructions: string;
  variantLabel: string;
  variantFamily: VariantFamily;
  points: number;
  gridRows: number;
  gridColumns: number;
  regions: number[][];
  startingGrid: number[][];
  solution: number[][];
}

/** A row-level rejection reason, returned in the 422's `details.failures` list. */
export interface QuestionImportFailure {
  /** 1-based data-row number as it appears in Excel (the header is row 1). */
  row: number;
  /** The failing column header, when the failure is about one specific column. */
  column?: string;
  /** The i18n key naming the problem; the client localizes it. */
  code: string;
  message: string;
}

/** The whole-file parse result: either every row parsed, or the named failures. */
export type ParseFileResult =
  | { ok: true; variantLabel: string; questions: ParsedQuestion[] }
  | { ok: false; failures: QuestionImportFailure[] };

/**
 * Reads the uploaded `.xlsx` bytes into raw text rows. Kept as a seam so the choice of
 * Excel library (an undecided dependency, see `progress-tracker.md`'s Known Issues) is
 * confined to one small adapter and the parsing rules above stay testable without it.
 */
export type QuestionFileReader = (
  buffer: Buffer,
) => Promise<{ variantLabel: string; rows: RawQuestionRow[] }>;

export interface QuestionSetSummaryView {
  id: string;
  name: string;
  questionCount: number;
  assignedCounts: { roundId: string; count: number }[];
}

export interface PoolQuestionView {
  id: string;
  sequence: number;
  variantLabel: string;
  gridRows: number;
  gridColumns: number;
  points: number;
  roundId: string | null;
}

/** The pool listing, grouped by `QuestionSet` (BLD-044: several sets per category). */
export interface PoolGroupView {
  questionSet: QuestionSetSummaryView;
  questions: PoolQuestionView[];
}

export interface PoolView {
  categoryId: string;
  groups: PoolGroupView[];
}

export interface ImportResultView {
  questionSetId: string;
  variantLabel: string;
  questionCount: number;
}

export interface SelectionResultView {
  roundId: string;
  questionIds: string[];
}
