/**
 * A minimal `.xlsx` **writer** with no third-party dependency (Unit 12, spec Detail
 * 3 — the export must produce an `.xlsx`; code-standards says prefer built-ins and
 * ask before adding a major dependency).
 *
 * This is the inverse of Unit 5's `question-xlsx.ts`, which *reads* an `.xlsx`
 * using only Node's `zlib` and `Buffer`. Same judgment applies here: an `.xlsx` is an
 * OPC zip of a handful of small XML parts, and Node can build one with
 * `deflateRawSync` plus a CRC-32 table. Adding `xlsx`/`exceljs` for one writer would
 * pull a large dependency into a two-day build for no functional gain.
 *
 * Deliberately minimal, and that is a real limit, not an oversight:
 *   - one workbook, any number of sheets,
 *   - cells are numbers or inline strings only (no formulas, no dates, no styles,
 *     no merged cells, no column widths),
 *   - strings are escaped for XML; control characters XML forbids are dropped.
 *
 * Inline strings (`t="inlineStr"`) rather than a shared-string table: it keeps the
 * writer to one pass and needs no second part file. Any reader — Excel, LibreOffice,
 * Unit 5's own parser — handles both.
 */
import { deflateRawSync } from "node:zlib";

/** The workbook's MIME type, recorded on the `StoredFile` row. */
export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A cell is either a number or a string. `null`/`undefined` means "leave it blank". */
export type XlsxCell = string | number | null | undefined;

export interface XlsxSheet {
  /** The sheet's tab name. Truncated to Excel's 31-character limit. */
  name: string;
  /** Rows of cells. A ragged sheet is fine — each row is written as it comes. */
  rows: XlsxCell[][];
}

// ---------------------------------------------------------------------------
// CRC-32 (the zip local header and central directory both carry it)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

/**
 * Escape the five XML-significant characters. The XML spec also forbids most control
 * characters outright, so those are dropped rather than escaped — a grid value should
 * never contain one, and emitting an illegal character would make the whole part
 * unparseable. Tab and newline are legal in XML text, so they are kept.
 */
function escapeXml(value: string): string {
  // The XML spec forbids most control characters outright, so this pass strips them;
  // tab and newline stay because they are legal in XML text.
  // eslint-disable-next-line no-control-regex
  const withoutControls = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  return withoutControls
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The spreadsheet column label for a zero-based index (0 → `A`, 25 → `Z`, 26 → `AA`).
 * Mirrors the reader's `columnIndexFromReference`, so the two agree.
 */
function columnLabel(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/**
 * Excel forbids these in a sheet name and caps it at 31 characters. A generated
 * sheet name is always ASCII and short in practice, but the sanitiser keeps a
 * category name containing a colon from producing an unopenable workbook.
 */
function sanitiseSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, "-").trim();
  const base = cleaned.length > 0 ? cleaned : "Sheet";
  return base.slice(0, 31);
}

function renderCell(reference: string, cell: XlsxCell): string {
  if (cell === null || cell === undefined || cell === "") {
    return "";
  }
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return "";
    return `<c r="${reference}"><v>${cell}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
}

function renderSheet(sheet: XlsxSheet): string {
  const rows = sheet.rows
    .map((cells, rowIndex) => {
      const rendered = cells
        .map((cell, cellIndex) =>
          renderCell(`${columnLabel(cellIndex)}${rowIndex + 1}`, cell),
        )
        .join("");
      // An entirely blank row still has to exist, or the rows below it shift up.
      return `<row r="${rowIndex + 1}">${rendered}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

function renderWorkbook(sheets: XlsxSheet[]): string {
  const entries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sanitiseSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${entries}</sheets></workbook>`;
}

function renderWorkbookRelationships(sheetCount: number): string {
  const entries = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`;

function contentTypesFor(sheetCount: number): string {
  const overrides = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `${CONTENT_TYPES.slice(0, -8)}${overrides}</Types>`;
}

const ROOT_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

// ---------------------------------------------------------------------------
// The zip container
// ---------------------------------------------------------------------------

interface ZipPart {
  name: string;
  contents: Buffer;
}

/**
 * Build the zip. Every part is deflated (method 8, the same one Unit 5's reader
 * inflates) and gets a local file header; the central directory and the
 * end-of-central-directory record follow, with absolute offsets from the start of
 * the archive. No data descriptor, no zip64 — the exports here are a few hundred
 * kilobytes at most.
 */
function buildZip(parts: ZipPart[]): Buffer {
  const chunks: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const part of parts) {
    const nameBuffer = Buffer.from(part.name, "utf8");
    const compressed = deflateRawSync(part.contents);
    const checksum = crc32(part.contents);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0x21, 12); // mod date: an arbitrary valid DOS date
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(part.contents.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    chunks.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression method
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0x21, 14); // mod date
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(part.contents.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42); // local header offset
    centralEntries.push(Buffer.concat([centralHeader, nameBuffer]));

    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralEntries);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // disk with the central directory
  endRecord.writeUInt16LE(parts.length, 8);
  endRecord.writeUInt16LE(parts.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...chunks, centralDirectory, endRecord]);
}

// ---------------------------------------------------------------------------
// The public writer
// ---------------------------------------------------------------------------

/**
 * Build an `.xlsx` workbook from a list of sheets. An empty sheet list is an error
 * the caller should avoid; a single empty sheet is written instead, because a
 * workbook with no sheet part is not openable.
 */
export function writeXlsx(sheets: XlsxSheet[]): Buffer {
  const resolved = sheets.length > 0 ? sheets : [{ name: "Sheet1", rows: [] }];

  const parts: ZipPart[] = [
    { name: "[Content_Types].xml", contents: Buffer.from(contentTypesFor(resolved.length), "utf8") },
    { name: "_rels/.rels", contents: Buffer.from(ROOT_RELATIONSHIPS, "utf8") },
    { name: "xl/workbook.xml", contents: Buffer.from(renderWorkbook(resolved), "utf8") },
    {
      name: "xl/_rels/workbook.xml.rels",
      contents: Buffer.from(renderWorkbookRelationships(resolved.length), "utf8"),
    },
  ];

  resolved.forEach((sheet, index) => {
    parts.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      contents: Buffer.from(renderSheet(sheet), "utf8"),
    });
  });

  return buildZip(parts);
}

/**
 * Render a grid as the compact string the export puts in one cell — a flat
 * comma-joined, row-major list of the submitted cells (`1,2,,4`), an empty slot
 * for a cell left blank. The export is a human-readable results pack, so this keeps
 * the answer legible in a single cell rather than nesting it. Kept here because it is
 * part of the workbook's cell vocabulary, not of the results domain.
 */
export function gridToCellText(grid: unknown): string {
  if (!Array.isArray(grid)) return "";
  return grid.map((cell) => (cell === null || cell === undefined ? "" : String(cell))).join(",");
}
