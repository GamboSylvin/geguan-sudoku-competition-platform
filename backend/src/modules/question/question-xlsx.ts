/**
 * Reads the uploaded question `.xlsx` into raw text rows (Unit 05).
 *
 * **Zero dependencies.** `code-standards.md`'s Dependencies section says to prefer
 * built-in solutions, and the choice of Excel library was never decided by any project
 * document — so rather than add a package on a guess, this reads the file with Node's
 * own `zlib`. An `.xlsx` is an OPC zip: the central directory points at
 * `xl/worksheets/sheet1.xml` (the cells) and `xl/sharedStrings.xml` (the text table).
 * Both are small, flat XML that the parser below reads directly.
 *
 * Only what Unit 05 needs is supported: the first worksheet, shared strings and inline
 * strings, and numeric cells. No formulas are evaluated (`*数独底图`'s `DISPIMG`
 * formula is never read anyway — BLD-047). No image is opened, and no OCR runs.
 */
import { inflateRawSync } from "node:zlib";
import { COLUMNS } from "./question-parse";
import type { RawQuestionRow } from "./question.types";

/** The local-file-header signature, used to walk to each entry's compressed data. */
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The record sits at the end, followed by an optional comment; scan backwards.
  const earliest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);
  if (endOffset < 0) {
    throw new Error("not a zip archive");
  }
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16); // central directory offset

  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntryText(buffer: Buffer, entry: ZipEntry): string {
  if (buffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`corrupt zip entry: ${entry.name}`);
  }
  // The local header repeats the name/extra lengths, which can differ from the central
  // directory's, so the data offset must be computed from the local header itself.
  const nameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return raw.toString("utf8"); // stored
  if (entry.compressionMethod === 8) return inflateRawSync(raw).toString("utf8"); // deflate
  throw new Error(`unsupported zip compression method ${entry.compressionMethod}`);
}

/** Decode the handful of XML entities Excel writes, so `&amp;` reads back as `&`. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

/** Read every `<si>` of the shared-string table into a positional array. */
function readSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const block of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    // An `<si>` can hold several `<r>` runs; concatenate all their `<t>` text.
    let value = "";
    for (const text of block[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
      value += decodeEntities(text[1]!);
    }
    strings.push(value);
  }
  return strings;
}

/** Turn a cell reference such as `AB12` into its 0-based column index. */
function columnIndexFromReference(reference: string): number {
  let index = 0;
  for (const character of reference) {
    if (character < "A" || character > "Z") break;
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

interface SheetCell {
  row: number;
  column: number;
  value: string;
}

function readSheetCells(xml: string, sharedStrings: string[]): SheetCell[] {
  const cells: SheetCell[] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowReference = /r="(\d+)"/.exec(rowMatch[1]!);
    if (!rowReference) continue;
    const rowIndex = Number(rowReference[1]);

    for (const cellMatch of rowMatch[2]!.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1]!;
      const inner = cellMatch[2] ?? "";
      const referenceMatch = /r="([A-Z]+)\d+"/.exec(attributes);
      if (!referenceMatch) continue;

      const type = /t="([^"]+)"/.exec(attributes)?.[1];
      let value = "";
      if (type === "inlineStr") {
        for (const text of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
          value += decodeEntities(text[1]!);
        }
      } else {
        const rawMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        if (rawMatch) {
          value = type === "s" ? (sharedStrings[Number(rawMatch[1])] ?? "") : decodeEntities(rawMatch[1]!);
        }
      }

      cells.push({ row: rowIndex, column: columnIndexFromReference(referenceMatch[1]!), value });
    }
  }
  return cells;
}

/**
 * Read the first worksheet of an `.xlsx` into its rows as text, then map them onto the
 * expected column headers.
 *
 * Returns the header's variant label as a fallback (for a file with one variant and an
 * empty `*类目` cell) plus the data rows. Throws when the file isn't a readable `.xlsx`,
 * has no sheet, or lacks the required headers — the caller turns that into a 422 rather
 * than a 500, since it's the uploaded file's fault.
 */
export async function readQuestionWorkbook(
  buffer: Buffer,
): Promise<{ variantLabel: string; rows: RawQuestionRow[] }> {
  let entries: ZipEntry[];
  try {
    entries = readZipEntries(buffer);
  } catch {
    throw new QuestionFileError("question.import.notAnExcelFile");
  }

  const sheetEntry =
    entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml") ??
    entries.find((entry) => /^xl\/worksheets\/.+\.xml$/.test(entry.name));
  if (!sheetEntry) {
    throw new QuestionFileError("question.import.notAnExcelFile");
  }

  const sharedEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  let sharedStrings: string[] = [];
  let sheetXml: string;
  try {
    sharedStrings = sharedEntry ? readSharedStrings(readEntryText(buffer, sharedEntry)) : [];
    sheetXml = readEntryText(buffer, sheetEntry);
  } catch {
    throw new QuestionFileError("question.import.notAnExcelFile");
  }

  const cells = readSheetCells(sheetXml, sharedStrings);
  const byRow = new Map<number, Map<number, string>>();
  for (const cell of cells) {
    const row = byRow.get(cell.row) ?? new Map<number, string>();
    row.set(cell.column, cell.value);
    byRow.set(cell.row, row);
  }
  const rowNumbers = [...byRow.keys()].sort((a, b) => a - b);
  if (rowNumbers.length < 2) {
    throw new QuestionFileError("question.import.emptyFile");
  }

  // Row 1 is the header; map each column index onto its header text.
  const headerRow = byRow.get(rowNumbers[0]!)!;
  const headersByColumn = new Map<number, string>();
  for (const [column, header] of headerRow) {
    if (header.trim() !== "") headersByColumn.set(column, header.trim());
  }

  const requiredHeaders = [
    COLUMNS.variant,
    COLUMNS.points,
    COLUMNS.gridWidth,
    COLUMNS.gridHeight,
    COLUMNS.answer,
  ];
  const presentHeaders = new Set(headersByColumn.values());
  for (const required of requiredHeaders) {
    if (!presentHeaders.has(required)) {
      throw new QuestionFileError("question.import.missingRequiredColumn", { column: required });
    }
  }

  const rows: RawQuestionRow[] = [];
  for (const rowNumber of rowNumbers.slice(1)) {
    const cellsInRow = byRow.get(rowNumber)!;
    const row: RawQuestionRow = {};
    for (const [column, header] of headersByColumn) {
      row[header] = cellsInRow.get(column) ?? "";
    }
    // A wholly empty trailing row is padding, not a question; skip it rather than
    // rejecting the whole file over a stray blank line in Excel.
    if (Object.values(row).every((value) => value.trim() === "")) continue;
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new QuestionFileError("question.import.emptyFile");
  }

  const variantColumn = [...headersByColumn.entries()].find(
    ([, header]) => header === COLUMNS.variant,
  )?.[0];
  const variantLabel =
    (variantColumn !== undefined ? rows[0]?.[COLUMNS.variant] : "")?.trim() ||
    "questions";

  return { variantLabel, rows };
}

/** An uploaded-file problem: the client's fault, so a 422, never a 500. */
export class QuestionFileError extends Error {
  public readonly code: string;
  public readonly details: unknown;

  constructor(code: string, details?: unknown) {
    super(code);
    this.name = "QuestionFileError";
    this.code = code;
    this.details = details;
  }
}
