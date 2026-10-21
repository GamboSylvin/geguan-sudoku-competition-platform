/**
 * Reads the uploaded participant `.xlsx` into raw text rows (Unit 04).
 *
 * **Zero dependencies**, for the same reason `question-xlsx.ts` is: `code-standards.md`'s
 * Dependencies section says to prefer built-in solutions and to ask before adding a
 * package, and no project document ever decided on an Excel library. An `.xlsx` is an OPC
 * zip; the central directory points at `xl/worksheets/sheet1.xml` (the cells) and
 * `xl/sharedStrings.xml` (the text table), both small flat XML read directly here.
 *
 * **Why this is a copy rather than an import of `question/question-xlsx.ts`.** The spec's
 * §4.2 first proposed importing that file's reader directly, and named the copy as the
 * fallback if a cross-module import is not allowed — it is not: `question/index.ts` exports
 * only the service, the router and the types, with the comment that it is "the only way
 * another module reaches this one (invariant 4)". Reaching past that barrel to import
 * `question-xlsx.ts` would break the boundary the tree is built on, and the alternative —
 * lifting both files into `shared/xlsx/` — was withdrawn for the same reason: it would move
 * a file Unit 05's 170-test suite imports, disturbing verified code a day before the event.
 * So this file stands alone, and the project owner's "independent module" requirement
 * (2026-10-11) is what it delivers. `question-multipart.ts`'s `readUploadedFile` is copied
 * for the same reason (see `participant-multipart.ts`): it too lives outside the barrel.
 *
 * Only what Unit 04 needs is supported: the first worksheet, shared strings, inline
 * strings and numeric cells. No formula is evaluated and no image is opened.
 */
import { inflateRawSync } from "node:zlib";
import type { RawParticipantRow } from "./participant.types";

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

interface ZipEntry {
  name: string;
  compressedSize: number;
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
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
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

/** An uploaded-file problem: the client's fault, so a 422, never a 500. */
export class ParticipantFileError extends Error {
  public readonly code: string;
  public readonly details: unknown;

  constructor(code: string, details?: unknown) {
    super(code);
    this.name = "ParticipantFileError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Read the first worksheet of an `.xlsx` into its rows as text, keyed by header.
 *
 * The header is matched **by text, not by column position** (spec §4.2), so a reordered or
 * padded file still imports. Columns whose header is blank are dropped, and an entirely
 * unexpected extra column is carried through and simply never read (U-40's working
 * position, acceptance criterion 5).
 *
 * Throws `ParticipantFileError` when the bytes aren't a readable workbook or the sheet has
 * no rows at all. A *missing required header* and *zero data rows* are reported by the
 * parser instead, as row-named failures, because the spec's V1 and V2 both want the caller
 * to see them in the same `details.failures` list as every other problem.
 */
export async function readParticipantWorkbook(
  buffer: Buffer,
): Promise<{ headers: string[]; rows: RawParticipantRow[] }> {
  let entries: ZipEntry[];
  try {
    entries = readZipEntries(buffer);
  } catch {
    throw new ParticipantFileError("participant.import.notAnExcelFile");
  }

  const sheetEntry =
    entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml") ??
    entries.find((entry) => /^xl\/worksheets\/.+\.xml$/.test(entry.name));
  if (!sheetEntry) {
    throw new ParticipantFileError("participant.import.notAnExcelFile");
  }

  const sharedEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  let sharedStrings: string[] = [];
  let sheetXml: string;
  try {
    sharedStrings = sharedEntry ? readSharedStrings(readEntryText(buffer, sharedEntry)) : [];
    sheetXml = readEntryText(buffer, sheetEntry);
  } catch {
    throw new ParticipantFileError("participant.import.notAnExcelFile");
  }

  const cells = readSheetCells(sheetXml, sharedStrings);
  const byRow = new Map<number, Map<number, string>>();
  for (const cell of cells) {
    const row = byRow.get(cell.row) ?? new Map<number, string>();
    row.set(cell.column, cell.value);
    byRow.set(cell.row, row);
  }
  const rowNumbers = [...byRow.keys()].sort((a, b) => a - b);
  if (rowNumbers.length === 0) {
    throw new ParticipantFileError("participant.import.notAnExcelFile");
  }

  // Row 1 is the header. A blank header cell means "this column has no name", so it is
  // skipped rather than becoming a `""` key that would collide with another blank one.
  const headerRow = byRow.get(rowNumbers[0]!)!;
  const headersByColumn = new Map<number, string>();
  for (const [column, header] of headerRow) {
    if (header.trim() !== "") headersByColumn.set(column, header.trim());
  }
  const headers = [...headersByColumn.values()];

  const rows: RawParticipantRow[] = [];
  for (const rowNumber of rowNumbers.slice(1)) {
    const cellsInRow = byRow.get(rowNumber)!;
    const row: RawParticipantRow = {};
    for (const [column, header] of headersByColumn) {
      row[header] = cellsInRow.get(column) ?? "";
    }
    // A wholly empty trailing row is padding, not a participant; skip it rather than
    // rejecting the whole file over a stray blank line in Excel. The real sample file
    // has one such row — its L2 note lives in an otherwise empty row.
    if (Object.values(row).every((value) => value.trim() === "")) continue;
    rows.push(row);
  }

  return { headers, rows };
}
