/**
 * Pure parsing and validation of one question Excel's rows (Unit 05).
 *
 * No I/O, no ORM, no dependency of any kind: this file turns the raw text cells of a
 * question file into fully validated `ParsedQuestion` values, or into the named
 * row-level failures that reject the whole file atomically (spec Implementation
 * Detail 1). Reading the `.xlsx` bytes into `RawQuestionRow[]` happens elsewhere, so
 * the parser is testable on its own and unaffected by the upload mechanism.
 *
 * **No image is read and no OCR runs anywhere here** (BLD-047): the given cells come
 * from a plain text column in the same array-with-gaps format as the existing answer
 * column.
 */
import { translate } from "../../shared/i18n";
import type {
  ParsedQuestion,
  ParseFileResult,
  QuestionImportFailure,
  RawQuestionRow,
  VariantFamily,
} from "./question.types";

/**
 * The column headers of the real files (`context/samples/`). `*数独底图` is the
 * base-grid picture — deliberately never read (BLD-047); `题目配图`/`题目音频` are
 * ignored too (BLD-042).
 */
export const COLUMNS = {
  instructions: "题目",
  variant: "*类目",
  points: "*分数",
  gridWidth: "*水平长度",
  gridHeight: "*垂直长度",
  answer: "*正确答案",
  given: "*给定数字",
} as const;

/**
 * `*给定数字`'s exact header is still to be confirmed with the real organizer
 * (BLD-047: "working position, exact header to be confirmed"), so accept the
 * plausible spellings rather than failing a real file over a bracket.
 */
const GIVEN_HEADER_CANDIDATES = ["*给定数字", "给定数字", "*给定数", "给定数"];

/**
 * The variant families whose regions are the ordinary box partition, computable from
 * the dimensions alone (BLD-045). The irregular ("不规则") variant's region shapes are
 * genuinely custom per puzzle and are rejected outright — never guessed.
 */
const VARIANT_KEYWORDS: readonly { keyword: string; family: VariantFamily }[] = [
  { keyword: "对角线", family: "DIAGONAL" },
  { keyword: "大小", family: "SIZE_COMPARISON" },
  { keyword: "堡垒", family: "FORTRESS" },
  { keyword: "无马", family: "ANTI_KNIGHT" },
  { keyword: "标准", family: "STANDARD" },
];

/** Recognized-but-unsupported variants, checked before the supported keywords. */
const IRREGULAR_KEYWORDS = ["不规则", "异形"] as const;

export function classifyVariant(label: string): VariantFamily | "IRREGULAR" | "UNKNOWN" {
  if (IRREGULAR_KEYWORDS.some((keyword) => label.includes(keyword))) {
    return "IRREGULAR";
  }
  const match = VARIANT_KEYWORDS.find((entry) => label.includes(entry.keyword));
  return match ? match.family : "UNKNOWN";
}

/**
 * The ordinary N×N box partition, as a list of regions where each region holds its
 * cells' row-major indices — the same shape the seed data and every existing test use.
 *
 * The box size is the factor pair of the grid side closest to square (4×4 → 2×2,
 * 6×6 → 2 rows × 3 cols, 9×9 → 3×3). Returns `null` when the dimensions can't form a
 * box partition at all, which the caller reports as an unparseable grid.
 */
export function computeBoxRegions(
  gridRows: number,
  gridColumns: number,
): number[][] | null {
  if (!Number.isInteger(gridRows) || !Number.isInteger(gridColumns)) return null;
  if (gridRows !== gridColumns || gridRows < 4) return null;

  const side = gridRows;
  let boxRows = 0;
  let boxColumns = 0;
  for (let rows = 1; rows <= side; rows += 1) {
    if (side % rows !== 0) continue;
    const columns = side / rows;
    if (rows > columns) break; // past square; the pair below was the closest
    boxRows = rows;
    boxColumns = columns;
  }
  if (boxRows === 0 || boxColumns === 0) return null;

  const regions: number[][] = [];
  for (let bandRow = 0; bandRow < side; bandRow += boxRows) {
    for (let bandColumn = 0; bandColumn < side; bandColumn += boxColumns) {
      const cells: number[] = [];
      for (let row = bandRow; row < bandRow + boxRows; row += 1) {
        for (let column = bandColumn; column < bandColumn + boxColumns; column += 1) {
          cells.push(row * side + column);
        }
      }
      regions.push(cells);
    }
  }
  return regions;
}

/** One cell of an array-with-gaps grid: `null` means the column has no value there. */
type SparseGrid = (number | null)[][];

/**
 * Parse an array-with-gaps grid — the format both text columns use:
 * rows separated by newlines, each row a bracketed comma-separated list where an
 * empty slot means "this column does not cover that cell".
 *
 * Returns `null` when the text isn't a well-formed grid of the expected size. A row
 * may carry a trailing comma (`[4,,1,,,3],`), which is ignored.
 */
export function parseSparseGrid(
  raw: string,
  gridRows: number,
  gridColumns: number,
): SparseGrid | null {
  const rowTexts = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (rowTexts.length !== gridRows) return null;

  const grid: SparseGrid = [];
  for (const rowText of rowTexts) {
    let body = rowText;
    // Tolerate the trailing comma the real files put between rows.
    if (body.endsWith(",")) body = body.slice(0, -1).trim();
    if (!body.startsWith("[") || !body.endsWith("]")) return null;

    const cells = body.slice(1, -1).split(",");
    if (cells.length !== gridColumns) return null;

    const row: (number | null)[] = [];
    for (const cell of cells) {
      const text = cell.trim();
      if (text === "") {
        row.push(null);
        continue;
      }
      if (!/^\d+$/.test(text)) return null;
      const value = Number(text);
      if (value < 1 || value > gridColumns) return null; // digits are 1..N
      row.push(value);
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Merge the two complementary text columns into `startingGrid` and `solution`
 * (BLD-047, spec Implementation Detail 3).
 *
 * The given-cells column has gaps exactly where the answer column has values, and vice
 * versa; together they must cover the whole grid with no overlap. `startingGrid` holds
 * the given values and `0` elsewhere (a blank the player fills); `solution` is every
 * position filled. Any disagreement returns `null` — the row fails validation rather
 * than one source being silently trusted over the other.
 */
export function mergeGrids(
  given: SparseGrid,
  answer: SparseGrid,
): { startingGrid: number[][]; solution: number[][] } | null {
  const gridRows = given.length;
  const gridColumns = given[0]?.length ?? 0;
  if (answer.length !== gridRows) return null;
  if (answer.some((row) => row.length !== gridColumns)) return null;

  const startingGrid: number[][] = [];
  const solution: number[][] = [];

  for (let row = 0; row < gridRows; row += 1) {
    const startingRow: number[] = [];
    const solutionRow: number[] = [];
    for (let column = 0; column < gridColumns; column += 1) {
      const givenValue = given[row]![column] ?? null;
      const answerValue = answer[row]![column] ?? null;

      // Overlap: both columns claim the cell.
      if (givenValue !== null && answerValue !== null) return null;
      // Gap: neither column covers the cell, so the solution would be incomplete.
      if (givenValue === null && answerValue === null) return null;

      if (givenValue !== null) {
        startingRow.push(givenValue);
        solutionRow.push(givenValue);
      } else {
        startingRow.push(0); // blank for the player
        solutionRow.push(answerValue!);
      }
    }
    startingGrid.push(startingRow);
    solution.push(solutionRow);
  }

  return { startingGrid, solution };
}

function readGivenHeader(row: RawQuestionRow): string | null {
  for (const candidate of GIVEN_HEADER_CANDIDATES) {
    if (candidate in row) return candidate;
  }
  return null;
}

function readDimension(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value > 0 ? value : null;
}

function readPoints(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 ? value : null; // SCR-014: a whole number >= 1
}

/**
 * Parse and validate every data row of one file. All rows must succeed: the first
 * failure list rejects the entire import (atomic, spec Detail 1), so the caller gets
 * every problem at once rather than fixing one row per upload.
 *
 * `fallbackVariantLabel` is the file's variant name when a row's `*类目` cell is empty.
 */
export function parseQuestionFile(
  rows: RawQuestionRow[],
  fallbackVariantLabel: string,
): ParseFileResult {
  const failures: QuestionImportFailure[] = [];
  const questions: ParsedQuestion[] = [];
  const variantLabels = new Set<string>();

  rows.forEach((row, index) => {
    // 1-based data-row number as the controller sees it in Excel: the header is row 1.
    const rowNumber = index + 2;
    const fail = (code: string, column?: string): void => {
      failures.push({
        row: rowNumber,
        column,
        code,
        message: translate("en", code),
      });
    };

    const variantLabel = (row[COLUMNS.variant] ?? fallbackVariantLabel).trim();
    if (variantLabel === "") {
      fail("question.import.variantRequired", COLUMNS.variant);
      return;
    }

    const family = classifyVariant(variantLabel);
    if (family === "IRREGULAR") {
      // BLD-045: out of scope, and rejected outright rather than silently skipped.
      fail("question.import.irregularVariantUnsupported", COLUMNS.variant);
      return;
    }
    if (family === "UNKNOWN") {
      fail("question.import.unknownVariant", COLUMNS.variant);
      return;
    }

    const points = readPoints(row[COLUMNS.points]);
    if (points === null) {
      fail("question.import.invalidPoints", COLUMNS.points);
      return;
    }

    const gridColumns = readDimension(row[COLUMNS.gridWidth]);
    if (gridColumns === null) {
      fail("question.import.invalidGridWidth", COLUMNS.gridWidth);
      return;
    }
    const gridRows = readDimension(row[COLUMNS.gridHeight]);
    if (gridRows === null) {
      fail("question.import.invalidGridHeight", COLUMNS.gridHeight);
      return;
    }

    const regions = computeBoxRegions(gridRows, gridColumns);
    if (regions === null) {
      fail("question.import.unsupportedGridShape", COLUMNS.gridWidth);
      return;
    }

    const givenHeader = readGivenHeader(row);
    if (givenHeader === null) {
      fail("question.import.givenColumnMissing", COLUMNS.given);
      return;
    }
    const given = parseSparseGrid(row[givenHeader] ?? "", gridRows, gridColumns);
    if (given === null) {
      fail("question.import.invalidGivenGrid", givenHeader);
      return;
    }
    const answer = parseSparseGrid(row[COLUMNS.answer] ?? "", gridRows, gridColumns);
    if (answer === null) {
      fail("question.import.invalidAnswerGrid", COLUMNS.answer);
      return;
    }

    const merged = mergeGrids(given, answer);
    if (merged === null) {
      fail("question.import.gridsNotComplementary", COLUMNS.given);
      return;
    }

    variantLabels.add(variantLabel);
    questions.push({
      instructions: (row[COLUMNS.instructions] ?? "").trim(),
      variantLabel,
      variantFamily: family,
      points,
      gridRows,
      gridColumns,
      regions,
      startingGrid: merged.startingGrid,
      solution: merged.solution,
    });
  });

  if (failures.length > 0) return { ok: false, failures };

  // One `QuestionSet` per imported file, named by its variant label (BLD-044). A file
  // mixing several labels would need several sets, which no document describes.
  if (variantLabels.size > 1) {
    failures.push({
      row: 0,
      code: "question.import.mixedVariants",
      message: translate("en", "question.import.mixedVariants"),
    });
    return { ok: false, failures };
  }

  return {
    ok: true,
    variantLabel: [...variantLabels][0] ?? fallbackVariantLabel,
    questions,
  };
}
