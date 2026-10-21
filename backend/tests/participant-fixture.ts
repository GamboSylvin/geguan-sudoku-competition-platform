/**
 * Hand-made fixtures for Unit 04's tests (participant import).
 *
 * No real populated file exists and none is coming: `context/samples/选手信息.xlsx`
 * is an empty template (one header row, zero data rows). This file therefore builds
 * a valid `.xlsx` workbook by hand, exactly as `question-fixture.ts` does for
 * Unit 05: a minimal OPC archive (`[Content_Types].xml`, a workbook, one
 * sheet, one shared-string table), with no dependency at all — the same shape that
 * `participant-xlsx.ts` reads with `node:zlib`.
 *
 * The headers are the real file's, in its real order. Two points matter for
 * the tests:
 * - a cell written as a **number** (`<v>1</v>`) and the same one written as a
 *   **shared string** (`t="s"`) must give the parser the same text — hence the
 *   `number` vs `string` in `FixtureRow`;
 * - `年龄`, `省`, `市`, `区（县）`, `备注` and `选手编号` are present but are never
 *   read (`participant-parse.ts`'s `COLUMNS`), which the tests verify by filling them in.
 */
import { deflateRawSync } from "node:zlib";

/** The real file's headers, in their real order. */
export const FIXTURE_HEADERS = [
  "比赛名称",
  "选手编号",
  "姓名",
  "年龄",
  "省",
  "市",
  "区（县）",
  "学校名称",
  "组别",
  "个人赛",
  "团队赛",
  "备注",
] as const;

export type FixtureHeader = (typeof FIXTURE_HEADERS)[number];

/**
 * A data row. Only the keys supplied are written; `null` (or a missing key) leaves the
 * cell out of the sheet, which is how Excel represents an empty cell — the shape an
 * "unfilled" flag must take.
 *
 * A `number` produces a numeric cell, a `string` a shared string: that is how a test
 * forces both representations of the same value.
 */
export type FixtureRow = Partial<Record<FixtureHeader, string | number | null>>;

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

/** Writes a deflate zip archive from a list of text files. */
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
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
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
  end.writeUInt32LE(0x06054b50, 0);
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
 * The sheet's XML. A string goes through the shared-string table (as Excel does); a
 * number is written as a plain `<v>` cell. A `null` value emits no cell at all.
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

/** Builds a complete, readable `.xlsx` participant workbook. */
export function buildParticipantWorkbook(
  rows: FixtureRow[],
  headers: readonly string[] = FIXTURE_HEADERS,
): Buffer {
  const sheetRows: (string | number | null)[][] = [
    [...headers],
    ...rows.map((row) => headers.map((header) => row[header as FixtureHeader] ?? null)),
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

const BOUNDARY = "----unit04participantfixture";

/**
 * Wraps a workbook in the `multipart/form-data` body the endpoint expects, and returns
 * the body's bytes plus the boundary to hand the controller.
 */
export function buildUploadBody(
  bytes: Buffer,
  filename = "选手信息.xlsx",
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
// Realistic rows
// ---------------------------------------------------------------------------

/**
 * The text of the real file's L2 cell. The row carrying it has none of the five
 * columns that are actually used filled in: that is exactly the case `isNoteRow` skips
 * with a warning rather than an error.
 */
export const FIXTURE_NOTE_TEXT = "个人赛团队赛参加填写1，未参加空白或者是2";

/** The competition name written in the file, when it matches the competition. */
export function validRow(overrides: Partial<FixtureRow> = {}, competitionName = ""): FixtureRow {
  return {
    比赛名称: competitionName,
    选手编号: 901, // ignored (PAR-012): a pre-filled number the system never reads
    姓名: "张三",
    年龄: 9,
    省: "浙江省",
    市: "杭州市",
    "区（县）": "拱墅区",
    学校名称: "卖鱼桥小学",
    组别: "一二年级组",
    个人赛: "1",
    团队赛: null, // empty cell = does not take part
    备注: FIXTURE_NOTE_TEXT,
    ...overrides,
  };
}

/** A row where none of the five columns that are used is filled in: the note row. */
export function noteRow(noteText = FIXTURE_NOTE_TEXT): FixtureRow {
  return { 备注: noteText };
}
