/**
 * Fixtures maison pour les tests de l'Unit 04 (import des participants).
 *
 * Aucun fichier réel rempli n'existe et aucun n'arrivera : `context/samples/选手信息.xlsx`
 * est un modèle vide (une ligne d'en-tête, zéro ligne de données). Ce fichier construit
 * donc un classeur `.xlsx` valide à la main, exactement comme `question-fixture.ts` le fait
 * pour l'Unit 05 : une archive OPC minimale (`[Content_Types].xml`, un classeur, une
 * feuille, une table de chaînes partagées), sans aucune dépendance — la même forme que
 * `participant-xlsx.ts` lit avec `node:zlib`.
 *
 * Les en-têtes sont ceux du vrai fichier, dans son ordre réel. Deux points comptent pour
 * les tests :
 * - une cellule écrite comme **nombre** (`<v>1</v>`) et la même écrite comme **chaîne
 *   partagée** (`t="s"`) doivent donner le même texte au parser — d'où le `number` vs
 *   `string` dans `FixtureRow` ;
 * - `年龄`, `省`, `市`, `区（县）`, `备注` et `选手编号` sont présentes mais ne sont jamais
 *   lues (`participant-parse.ts`'s `COLUMNS`), ce que les tests vérifient en les remplissant.
 */
import { deflateRawSync } from "node:zlib";

/** Les en-têtes du vrai fichier, dans leur ordre réel. */
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
 * Une ligne de données. Seules les clés fournies sont écrites ; `null` (ou une clé
 * absente) laisse la cellule hors de la feuille, ce qui est la façon dont Excel
 * représente une cellule vide — la forme que doit prendre un drapeau « non renseigné ».
 *
 * Un `number` produit une cellule numérique, une `string` une chaîne partagée : c'est
 * ainsi qu'un test force les deux représentations d'une même valeur.
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

/** Écrit une archive zip deflate à partir d'une liste de fichiers texte. */
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
 * Le XML d'une feuille. Une chaîne passe par la table des chaînes partagées (comme le
 * fait Excel) ; un nombre est écrit comme une simple cellule `<v>`. Une valeur `null`
 * n'émet aucune cellule.
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

/** Construit un classeur `.xlsx` de participants complet et lisible. */
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
 * Enveloppe un classeur dans le corps `multipart/form-data` que l'endpoint attend, et
 * renvoie les octets du corps plus la boundary à indiquer au contrôleur.
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
// Lignes réalistes
// ---------------------------------------------------------------------------

/**
 * La note de la cellule L2 du vrai fichier. La ligne qui la porte n'a aucune des cinq
 * colonnes utilisées renseignée : c'est exactement le cas que `isNoteRow` saute en
 * avertissement plutôt qu'en erreur.
 */
export const FIXTURE_NOTE_TEXT = "个人赛团队赛参加填写1，未参加空白或者是2";

/** Le nom de compétition écrit dans le fichier, quand il correspond à la compétition. */
export function validRow(overrides: Partial<FixtureRow> = {}, competitionName = ""): FixtureRow {
  return {
    比赛名称: competitionName,
    选手编号: 901, // ignoré (PAR-012) : un nombre pré-rempli que le système ne lit jamais
    姓名: "张三",
    年龄: 9,
    省: "浙江省",
    市: "杭州市",
    "区（县）": "拱墅区",
    学校名称: "卖鱼桥小学",
    组别: "一二年级组",
    个人赛: "1",
    团队赛: null, // cellule vide = ne participe pas
    备注: FIXTURE_NOTE_TEXT,
    ...overrides,
  };
}

/** Une ligne dont aucune des cinq colonnes utilisées n'est renseignée : la ligne de note. */
export function noteRow(noteText = FIXTURE_NOTE_TEXT): FixtureRow {
  return { 备注: noteText };
}
