/**
 * Public types for the Participant module (Unit 04).
 *
 * The unit is the only supported path from a real student spreadsheet to a publishable
 * competition: it creates the `School` rows, the `Participant` rows, one `PLAYER`
 * `Account` each, and the printable credential slips. **It creates no `Team` row** — team
 * formation is deferred out of this unit (spec §8 Q10) — so `teamId` stays null and the
 * `团队赛` flag is stored for whatever unit builds teams later.
 *
 * Nothing here is an ORM type: the module's internals stay behind its barrel (invariant 4).
 */

/** One raw data row of the participant Excel, as text, keyed by the column header. */
export type RawParticipantRow = Record<string, string>;

/**
 * One parsed, validated participant row, ready to be written.
 *
 * `individualEvent`/`teamEvent` come from the file's own rule, written in its cell L2:
 * `个人赛团队赛参加填写1，未参加空白或者是2` — `1` = taking part, blank or `2` = not
 * (spec §2, §8 Q3).
 */
export interface ParsedParticipant {
  /** The 1-based data-row number as it appears in Excel (the header is row 1). */
  rowNumber: number;
  name: string;
  schoolName: string;
  /** The `组别` text as written; resolved to a `CompetitionCategory` id at commit. */
  categoryLabel: string;
  individualEvent: boolean;
  teamEvent: boolean;
}

/** A row-level rejection reason, returned in the 422's `details.failures` list. */
export interface ParticipantImportFailure {
  /** 1-based data-row number as it appears in Excel; `0` for a whole-file problem. */
  row: number;
  /** The failing column header, when the failure is about one specific column. */
  column?: string;
  /** The i18n key naming the problem; the client localizes it. */
  code: string;
  message: string;
}

/** One warning that does **not** reject the file (spec §8 Q1: warn, do not reject). */
export interface ParticipantImportWarning {
  row: number;
  code: string;
  message: string;
}

/** The whole-file parse result: either every row parsed, or the named failures. */
export type ParseParticipantFileResult =
  | { ok: true; participants: ParsedParticipant[]; warnings: ParticipantImportWarning[] }
  | { ok: false; failures: ParticipantImportFailure[] };

/**
 * Reads the uploaded `.xlsx` bytes into raw text rows. Kept as a seam for the same reason
 * `question.types.ts` keeps one: the Excel-reading choice is confined to one small adapter
 * and the parsing rules stay testable without it.
 */
export type ParticipantFileReader = (
  buffer: Buffer,
) => Promise<{ rows: RawParticipantRow[] }>;

/** One participant as the controller's list screen shows it. Never a password. */
export interface ParticipantView {
  id: string;
  participantNumber: number;
  name: string;
  active: boolean;
  individualEvent: boolean;
  teamEvent: boolean;
  categoryId: string;
  categoryName: string;
  schoolId: string;
  schoolName: string;
  teamId: string | null;
  username: string | null;
}

/** The list, with the counts the import result and the setup screen both need. */
export interface ParticipantListView {
  competitionId: string;
  participants: ParticipantView[];
  counts: {
    total: number;
    active: number;
    individualEvent: number;
    teamEvent: number;
    /** `团队赛`=1 rows per school+category — the data a later team step needs (V7). */
    teamFlaggedBySchool: { schoolId: string; schoolName: string; categoryId: string; categoryName: string; count: number }[];
  };
}

/**
 * One freshly issued credential. Returned **once**, by the import that created it and by
 * the edit that replaced a student; the plaintext password is never stored and no later
 * endpoint returns it (spec §4.4 step 4). The slips export is the only retrieval path.
 */
export interface IssuedCredential {
  participantId: string;
  participantNumber: number;
  name: string;
  schoolName: string;
  categoryName: string;
  username: string;
  password: string;
}

export interface ParticipantImportResultView {
  batchId: string;
  fileId: string;
  status: "COMMITTED" | "REJECTED";
  created: number;
  kept: number;
  replaced: number;
  deactivated: number;
  warnings: ParticipantImportWarning[];
  /** Only populated for a committed import: the newly issued credentials. */
  credentials: IssuedCredential[];
}

export interface ParticipantEditResultView {
  participant: ParticipantView;
  /** Non-null only when the edit replaced a student and issued new credentials. */
  credential: IssuedCredential | null;
}
