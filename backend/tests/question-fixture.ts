/**
 * Hand-made fixtures for Unit 05's tests.
 *
 * The spec's Implementation Notes allow Unit 05's own tests to use "a small, fully
 * hand-made fixture file" instead of the real sample workbooks, so this builds one
 * from scratch: a minimal but valid OPC zip (`[Content_Types].xml`, a workbook, one
 * worksheet, a shared-string table) with no dependency, mirroring how
 * `question-xlsx.ts` itself reads the file with `node:zlib`.
 *
 * The column headers match the real files (`context/samples/`), including `题目配图`,
 * `题目音频` and `*数独底图`, which are present and deliberately never read
 * (BLD-042, BLD-047).
 */
import { deflateRawSync } from "node:zlib";

/** The real files' headers, in their real order. */
export const FIXTURE_HEADERS = [
  "题目",
  "题目配图",
  "题目音频",
  "*类目",
  "*分数",
  "*数独底图",
  "*水平长度",
  "*垂直长度",
  "*正确答案",
  "*给定数字",
] as const;

/**
 * One data row. Only the listed keys are written; `null` (or an omitted key) leaves
 * the cell out of the sheet entirely, which is how Excel represents an empty cell and
 * is what a missing `*给定数字` column has to look like in a test.
 */
export type FixtureRow = Partial<Record<(typeof FIXTURE_HEADERS)[number], string | number | null>>;

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipFile {
  name: string;
  content: string;
}

/** Write a deflate-compressed zip archive from a list of text files. */
function buildZip(files: ZipFile[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.content, "utf8");
    const compressed = deflateRawSync(raw);
    const checksum = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLabel(index: number): string {
  let label = "";
  let remaining = index + 1;
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return label;
}

/**
 * Build one worksheet's XML. Text goes through the shared-string table (as Excel
 * does); a number is written as a plain `<v>` cell. A `null` value emits no cell.
 *
 * `xml:space="preserve"` is what keeps the newlines inside a grid text intact.
 */
function buildSheet(rows: (string | number | null)[][]): { xml: string; shared: string } {
  const strings: string[] = [];
  const indexByValue = new Map<string, number>();
  const sharedIndex = (value: string): number => {
    const existing = indexByValue.get(value);
    if (existing !== undefined) return existing;
    const created = strings.length;
    strings.push(value);
    indexByValue.set(value, created);
    return created;
  };

  const rowXml: string[] = [];
  rows.forEach((cells, rowIndex) => {
    const cellXml = cells
      .map((value, columnIndex) => {
        if (value === null) return "";
        const reference = `${columnLabel(columnIndex)}${rowIndex + 1}`;
        if (typeof value === "number") {
          return `<c r="${reference}"><v>${value}</v></c>`;
        }
        return `<c r="${reference}" t="s"><v>${sharedIndex(value)}</v></c>`;
      })
      .join("");
    rowXml.push(`<row r="${rowIndex + 1}">${cellXml}</row>`);
  });

  const sharedXml = strings
    .map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`)
    .join("");

  return {
    xml:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${rowXml.join("")}</sheetData></worksheet>`,
    shared:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
      ` count="${strings.length}" uniqueCount="${strings.length}">${sharedXml}</sst>`,
  };
}

/** Build a complete, readable question `.xlsx` from a header row and data rows. */
export function buildQuestionWorkbook(
  rows: FixtureRow[],
  headers: readonly string[] = FIXTURE_HEADERS,
): Buffer {
  const sheetRows: (string | number | null)[][] = [
    [...headers],
    ...rows.map((row) => headers.map((header) => row[header as keyof FixtureRow] ?? null)),
  ];
  const { xml, shared } = buildSheet(sheetRows);

  return buildZip([
    {
      name: "[Content_Types].xml",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    { name: "xl/sharedStrings.xml", content: shared },
    { name: "xl/worksheets/sheet1.xml", content: xml },
  ]);
}

const BOUNDARY = "----unit05questionfixture";

/**
 * Wrap one workbook in the `multipart/form-data` body the import endpoint expects,
 * returning the body bytes and the boundary the controller must be told about.
 */
export function buildUploadBody(
  bytes: Buffer,
  filename = "questions.xlsx",
): { body: Buffer; boundary: string } {
  const head = Buffer.from(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n` +
      `\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`, "utf8");
  return { body: Buffer.concat([head, bytes, tail]), boundary: BOUNDARY };
}

// ---------------------------------------------------------------------------
// A real 4x4 puzzle, written the way the real files write it
// ---------------------------------------------------------------------------

/**
 * The 4x4 solution every fixture row uses, so the expected `startingGrid` and
 * `solution` can be written out longhand and compared cell by cell:
 *
 *   1 2 3 4
 *   3 4 1 2
 *   2 1 4 3
 *   4 3 2 1
 */
export const FIXTURE_SOLUTION: number[][] = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

/** `0` is a blank the player fills; the given cells match the solution above. */
export const FIXTURE_STARTING_GRID: number[][] = [
  [1, 0, 0, 4],
  [0, 4, 0, 0],
  [0, 0, 4, 0],
  [4, 0, 0, 1],
];

/** 4x4 boxes, as row-major indices — the shape the seed data and other tests use. */
export const FIXTURE_REGIONS: number[][] = [
  [0, 1, 4, 5],
  [2, 3, 6, 7],
  [8, 9, 12, 13],
  [10, 11, 14, 15],
];

/** The given-cells text column: a value only where the answer column has a gap. */
export const FIXTURE_GIVEN_TEXT = "[1,,,4],\n[,4,,],\n[,,4,],\n[4,,,1]";

/** The answer text column: the complement of `FIXTURE_GIVEN_TEXT`. */
export const FIXTURE_ANSWER_TEXT = "[,2,3,],\n[3,,1,2],\n[2,1,,3],\n[,3,2,]";

/**
 * One fully valid row. `variantLabel` defaults to a supported standard variant, so
 * tests that only need "another valid question" can vary just the label or points.
 */
export function validRow(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    题目: "Fill the grid",
    题目配图: "",
    题目音频: "",
    "*类目": "四宫标准数独",
    "*分数": 5,
    "*数独底图": '=DISPIMG("ID_FIXTURE",1)',
    "*水平长度": 4,
    "*垂直长度": 4,
    "*正确答案": FIXTURE_ANSWER_TEXT,
    "*给定数字": FIXTURE_GIVEN_TEXT,
    ...overrides,
  };
}
