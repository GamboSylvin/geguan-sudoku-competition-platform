/**
 * The domain rules of the Participant module and its public interface (Unit 04).
 * Other modules call this service, never the repository (invariant 4).
 *
 * What lives here: importing one competition's participant `.xlsx` into `School`,
 * `Participant` and `PLAYER` `Account` rows; listing them; the individual add/edit/
 * deactivate of PAR-003; and the credential-slip export of PAR-02.
 *
 * Rules worth stating, because each one is a decision rather than an obvious step:
 * - **The import is atomic.** Every row must parse; one bad row rejects the whole file and
 *   names the row (spec §4.3). The uploaded file is still stored and its `ImportBatch`
 *   written with `status = REJECTED`, so the rejection is auditable (BLD-039) without
 *   leaving a half-filled roster behind.
 * - **Nothing here creates a team.** `团队赛` is parsed and stored, and that is all — team
 *   formation is deferred out of this unit (spec §8 Q10), because the random-team proposal
 *   contradicts SCR-004 [C] and is logged for the stakeholder as U-102.
 * - **A plaintext password exists only in this module's return values and in the slips
 *   file.** It is never stored, and no later endpoint returns it (spec §4.4 step 4). That
 *   is why the slips are written *during* the import that generated the passwords.
 * - **Individual edits are allowed at any time; a whole-file import is not** (**[C]
 *   PAR-009**): once the competition leaves `CREATED`, `importParticipantFile` refuses with
 *   409 and only the single-row endpoints remain.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { competitionFilePath, ensureStorageRoot } from "../../infra";
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { identityService } from "../identity";
import { readUploadedFile } from "./participant-multipart";
import { XLSX_MIME_TYPE, writeXlsx } from "../results";
import { identityKey, parseParticipantFile } from "./participant-parse";
import { ParticipantFileError, readParticipantWorkbook } from "./participant-xlsx";
import * as repository from "./participant.repository";
import type {
  IssuedCredential,
  ParticipantEditResultView,
  ParticipantImportFailure,
  ParticipantImportResultView,
  ParticipantImportWarning,
  ParticipantListView,
  ParsedParticipant,
} from "./participant.types";

/** 20 MB, the same guard the question import uses — the real files are kilobytes. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * PAR-009's cutoff: a whole-file import is allowed only while the competition is still
 * `CREATED`. Every status past it (including `CANCELLED` and `FINISHED`) refuses.
 */
const IMPORT_ALLOWED_STATUSES = new Set(["CREATED"]);

/**
 * The username scheme of spec §8 Q7 — "things that are easy to write for people". `p` plus
 * the participant's own number, so the slip and the login visibly agree and a child never
 * has to read a slug off a page. `identityService.generateUsername` is deliberately not
 * used: it slugs a Chinese name to `""` and falls back to `user-4f9a2c`, which is exactly
 * what Q7 rejects.
 */
const USERNAME_PREFIX = "p";

function notFoundError(): NotFoundError {
  return new NotFoundError(translate("en", "participant.notFound"), {
    code: "participant.notFound",
  });
}

/**
 * A malformed request. `AppError` rather than `ValidationError`, whose code is hard-coded
 * to `VALIDATION_ERROR` and so could not be localized by the client — every rejection here
 * needs its own code.
 */
function badRequest(code: string): AppError {
  return new AppError(translate("en", code), { statusCode: 400, code });
}

function importFailure(
  code: string,
  failures: ParticipantImportFailure[],
): UnprocessableEntityError {
  return new UnprocessableEntityError(translate("en", code), {
    code,
    details: { failures },
  });
}

/** One uploaded file, as the controller hands it to the service. */
export interface UploadedParticipantFile {
  body: Buffer;
  boundary: string;
}

/**
 * The deterministic per-competition suffix that makes `p1` globally unique.
 *
 * `Account.username` is `@unique` with **no competition scope**, so a bare `p1` collides
 * the moment a second competition exists — and a collision inside the commit transaction
 * is an atomic whole-file reject on event day (spec §8 Q7). The suffix is derived from the
 * competition's own id rather than random, so a re-import produces the same usernames and
 * §4.5's "unchanged participants keep their credentials" still holds. Padded to four
 * characters so it never degenerates to `p1-`, which would collide across competitions.
 */
function competitionSuffix(competitionId: string): string {
  const hex = competitionId.replace(/[^0-9a-f]/gi, "").slice(0, 4).toLowerCase();
  return hex.padEnd(4, "0");
}

function candidateUsernames(
  participantNumber: number,
  competitionId: string,
): { plain: string; suffixed: string } {
  return {
    plain: `${USERNAME_PREFIX}${participantNumber}`,
    suffixed: `${USERNAME_PREFIX}${participantNumber}-${competitionSuffix(competitionId)}`,
  };
}

/** The player-facing link printed on every slip. Blank when no public base is configured. */
function entryLink(token: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return base === "" ? "" : `${base}/player?token=${encodeURIComponent(token)}`;
}

/**
 * A named seam for the one reading of spec §4.5 this unit takes that its own text does not
 * state cleanly.
 *
 * §4.5 says a row matching on `姓名 + 学校名称 + 组别` "keeps its account", and that a row
 * matching on that key "but whose other used fields changed is treated as an identity
 * change … old participation removed, a new participant created, new credentials issued".
 * Since the identity key *is* name + school + category, the only "other used fields" a
 * re-import can change are the two event flags (`选手编号` is ignored, PAR-012). Taken
 * literally, correcting a student's `团队赛` cell would deactivate them and create a
 * second row for the same person — orphaning any result already written for the first.
 *
 * So this unit reads a flag change as **a correction to the same person, applied in
 * place**: the row, its number and its account are kept, and only the flags are updated.
 * The replacement half of §4.5 still applies where it belongs — to the individual edit
 * path, where a *name* change means a different student is standing in (`editParticipant`
 * below issues new credentials for exactly that case, PAR-03).
 *
 * Flagged for the project owner rather than silently chosen: recorded as Unit 04's
 * Finding in `context/progress-tracker.md`'s Known Issues.
 */
function flagChangeIsAnUpdateNotAReplacement(): boolean {
  return true;
}

/** The identity of a row as the database knows it: name + school + **category id**. */
function existingKey(name: string, schoolName: string, categoryId: string): string {
  return identityKey(name, schoolName, categoryId);
}

/**
 * Import one `.xlsx` for one competition.
 *
 * Returns the committed result — counts, warnings and the freshly issued credentials — or
 * throws:
 * - 404 when the competition doesn't exist;
 * - 409 when the competition is past `CREATED` (**[C] PAR-009**, V9);
 * - 400 when the request carries no file or the body is too large;
 * - 422 when the file isn't a readable workbook or any row fails validation (V1–V8).
 */
export async function importParticipantFile(params: {
  competitionId: string;
  upload: UploadedParticipantFile;
  uploadedByAccountId: string | null;
}): Promise<ParticipantImportResultView> {
  const { competitionId, upload, uploadedByAccountId } = params;

  const competition = await repository.findCompetition(competitionId);
  if (!competition) {
    throw notFoundError();
  }
  if (!IMPORT_ALLOWED_STATUSES.has(competition.status)) {
    throw new ConflictError(translate("en", "participant.import.notAllowedAfterPublish"), {
      code: "participant.import.notAllowedAfterPublish",
    });
  }

  if (upload.body.length > MAX_UPLOAD_BYTES) {
    throw badRequest("participant.import.noFile");
  }

  let file: { filename: string; mimeType: string; bytes: Buffer } | null;
  try {
    // `readUploadedFile` is exported from the question module's barrel-adjacent file and is
    // generic (it knows nothing about questions), so it is imported rather than copied.
    file = readUploadedFile(upload.body, upload.boundary);
  } catch {
    throw badRequest("participant.import.noFile");
  }
  if (!file) {
    throw badRequest("participant.import.noFile");
  }

  const categories = await repository.listCategories(competitionId);

  // Reading the workbook and parsing its rows are separated so a malformed file and a
  // malformed row report differently: the former is "not an Excel file", the latter names
  // the row.
  let headers: string[];
  let rawRows: Record<string, string>[];
  try {
    ({ headers, rows: rawRows } = await readParticipantWorkbook(file.bytes));
  } catch (error) {
    if (error instanceof ParticipantFileError) {
      throw importFailure(error.code, [
        { row: 0, code: error.code, message: translate("en", error.code) },
      ]);
    }
    throw error;
  }

  const parsed = parseParticipantFile(headers, rawRows, {
    competitionName: competition.name,
    categories,
  });

  const fileId = randomUUID();
  await ensureStorageRoot();
  const path = competitionFilePath({
    competitionId,
    kind: "PARTICIPANT_EXCEL",
    fileId,
    originalName: file.filename,
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.bytes);

  const storedFile: repository.StoredFileInput = {
    competitionId,
    kind: "PARTICIPANT_EXCEL",
    path,
    originalName: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.bytes.length,
    checksum: createHash("sha256").update(file.bytes).digest("hex"),
    uploadedByAccountId,
  };

  if (!parsed.ok) {
    // The file and its REJECTED batch are still written: the organizer needs the original
    // on disk to see what went wrong (BLD-039), and nothing else is committed. The throw
    // below is the response — the batch exists only as an audit trail.
    await repository.writeImport({
      file: storedFile,
      batch: { competitionId, status: "REJECTED", errors: parsed.failures },
      schools: [],
      create: [],
      update: [],
      deactivateIds: [],
    });
    throw importFailure(parsed.failures[0]!.code, parsed.failures);
  }

  const committed = await commitParsedParticipants({
    competitionId,
    participants: parsed.participants,
    file: storedFile,
  });

  // The slips are written here, while the plaintext passwords still exist. This is the
  // only moment they can be captured; no later call can regenerate them (spec §4.7).
  await writeCredentialSlips({
    competitionId,
    credentials: committed.credentials,
    uploadedByAccountId,
    link: entryLink(competition.entryLinkToken),
  });

  return {
    batchId: committed.batchId,
    fileId: committed.fileId,
    status: "COMMITTED",
    created: committed.created,
    kept: committed.kept,
    replaced: committed.replaced,
    deactivated: committed.deactivated,
    warnings: parsed.warnings,
    credentials: committed.credentials,
  };
}

/** One create row plus the plaintext password that goes with it, before it is hashed. */
interface PendingCreate {
  row: repository.ParticipantCreateInput;
  password: string;
  schoolName: string;
  categoryName: string;
}

/**
 * Turn parsed rows into the repository's create/update/deactivate lists and commit them
 * with the file and batch row, all in the repository's single transaction.
 *
 * Matching is on spec §4.5's identity key (name + school + category), against **every**
 * existing row including inactive ones, so a re-import that brings a removed student back
 * reuses the row instead of creating a second one for the same person. Numbers are never
 * reused or re-shuffled: kept participants keep theirs, and new ones take the next free.
 */
async function commitParsedParticipants(params: {
  competitionId: string;
  participants: ParsedParticipant[];
  file: repository.StoredFileInput;
}): Promise<{
  fileId: string;
  batchId: string;
  created: number;
  kept: number;
  replaced: number;
  deactivated: number;
  credentials: IssuedCredential[];
}> {
  const { competitionId, participants, file } = params;

  const categories = await repository.listCategories(competitionId);
  const categoryByName = new Map<string, string>();
  const categoryByCode = new Map<string, string>();
  for (const category of categories) {
    categoryByName.set(category.name.trim(), category.id);
    categoryByCode.set(category.code.trim(), category.id);
  }

  // Schools in first-appearance order in the file, `sequence` = that order index
  // (spec §4.4 step 1). Upserted in the transaction, so a re-import keeps existing rows.
  const schoolSequence = new Map<string, number>();
  for (const row of participants) {
    if (!schoolSequence.has(row.schoolName)) {
      schoolSequence.set(row.schoolName, schoolSequence.size + 1);
    }
  }

  const existing = await repository.listExistingParticipants(competitionId);
  const existingByKey = new Map<string, repository.ExistingParticipantRow>();
  for (const row of existing) {
    existingByKey.set(existingKey(row.name, row.schoolName, row.categoryId), row);
  }

  const numbering = await repository.nextNumbering(competitionId);
  let nextNumber = numbering.maxParticipantNumber;
  let nextSequence = numbering.maxSequence;

  const matchedExistingIds = new Set<string>();
  const pending: PendingCreate[] = [];
  const update: repository.ParticipantUpdateInput[] = [];
  /** Passwords for an update-path row that had no account, keyed by its index in `update`. */
  const updatePasswords = new Map<number, string>();
  let kept = 0;

  for (const row of participants) {
    const categoryId =
      categoryByName.get(row.categoryLabel) ?? categoryByCode.get(row.categoryLabel);
    if (categoryId === undefined) {
      // Unreachable: `parseParticipantFile` (V4) already rejected any label that does not
      // resolve. Thrown rather than asserted, because a wrong category id here would write
      // a participant into the wrong round.
      throw badRequest("participant.import.unknownCategory");
    }

    const match = existingByKey.get(existingKey(row.name, row.schoolName, categoryId));

    if (match === undefined) {
      // New in this file: the next free number, and a fresh `PLAYER` account.
      nextNumber += 1;
      nextSequence += 1;
      const password = identityService.generatePassword();
      pending.push({
        row: {
          name: row.name,
          categoryId,
          schoolName: row.schoolName,
          participantNumber: nextNumber,
          sequence: nextSequence,
          individualEvent: row.individualEvent,
          teamEvent: row.teamEvent,
          username: "",
          passwordHash: "",
        },
        password,
        schoolName: row.schoolName,
        categoryName: row.categoryLabel,
      });
      continue;
    }

    matchedExistingIds.add(match.id);
    const changed =
      !match.active ||
      match.individualEvent !== row.individualEvent ||
      match.teamEvent !== row.teamEvent;

    if (!changed) {
      // Kept: same row, same number, same account, same credentials — nothing to write.
      kept += 1;
      continue;
    }

    if (flagChangeIsAnUpdateNotAReplacement()) {
      // Same person, corrected data: update in place and keep the account. A re-import
      // also re-activates a participant the previous file omitted.
      const index = update.length;
      let account: { username: string; passwordHash: string } | null = null;
      if (match.accountId === null) {
        // Only when the row somehow has no account is one issued; an existing account is
        // never replaced here, so its already-printed slip stays valid.
        const password = identityService.generatePassword();
        account = { username: "", passwordHash: "" };
        updatePasswords.set(index, password);
      }
      update.push({
        id: match.id,
        name: row.name,
        categoryId,
        schoolId: match.schoolId,
        individualEvent: row.individualEvent,
        teamEvent: row.teamEvent,
        active: true,
        account,
      });
      // Counted as kept: it is the same row, the same number and the same account, so the
      // slip already printed for it is still valid.
      kept += 1;
      continue;
    }

    // The literal reading of §4.5, retained as the alternative branch: deactivate the old
    // row and create a new one with new credentials.
    update.push({
      id: match.id,
      name: match.name,
      categoryId: match.categoryId,
      schoolId: match.schoolId,
      individualEvent: match.individualEvent,
      teamEvent: match.teamEvent,
      active: false,
    });
    nextNumber += 1;
    nextSequence += 1;
    const password = identityService.generatePassword();
    pending.push({
      row: {
        name: row.name,
        categoryId,
        schoolName: row.schoolName,
        participantNumber: nextNumber,
        sequence: nextSequence,
        individualEvent: row.individualEvent,
        teamEvent: row.teamEvent,
        username: "",
        passwordHash: "",
      },
      password,
      schoolName: row.schoolName,
      categoryName: row.categoryLabel,
    });
  }

  /** Rows the new file does not mention leave the active set (spec §4.5). */
  const deactivateIds = existing
    .filter((row) => row.active && !matchedExistingIds.has(row.id))
    .map((row) => row.id);

  // Usernames: `p<number>` where free, `p<number>-<suffix>` where taken (spec §8 Q7).
  // Resolved **before** the transaction, because a collision inside it would be an atomic
  // whole-file reject — and the suffixed form is checked too, so a stale collision cannot
  // slip through on the fallback.
  const allCandidates = [
    ...pending.map((entry) => candidateUsernames(entry.row.participantNumber, competitionId)),
    ...update.map((row, index) =>
      updatePasswords.has(index)
        ? candidateUsernames(
            existing.find((entry) => entry.id === row.id)?.participantNumber ?? 0,
            competitionId,
          )
        : null,
    ),
  ].filter((entry): entry is { plain: string; suffixed: string } => entry !== null);
  const taken = await repository.findTakenUsernames(
    allCandidates.flatMap((entry) => [entry.plain, entry.suffixed]),
  );

  const create: repository.ParticipantCreateInput[] = [];
  const credentials: IssuedCredential[] = [];
  for (const entry of pending) {
    const { plain, suffixed } = candidateUsernames(entry.row.participantNumber, competitionId);
    const username = !taken.has(plain) ? plain : suffixed;
    taken.add(username);
    const passwordHash = await identityService.hashPassword(entry.password);
    create.push({ ...entry.row, username, passwordHash });
    credentials.push({
      participantId: "", // filled from the transaction's generated ids, below
      participantNumber: entry.row.participantNumber,
      name: entry.row.name,
      schoolName: entry.schoolName,
      categoryName: entry.categoryName,
      username,
      password: entry.password,
    });
  }

  for (const [index, password] of updatePasswords) {
    const row = update[index]!;
    const number = existing.find((entry) => entry.id === row.id)?.participantNumber ?? 0;
    const { plain, suffixed } = candidateUsernames(number, competitionId);
    const username = !taken.has(plain) ? plain : suffixed;
    taken.add(username);
    row.account = { username, passwordHash: await identityService.hashPassword(password) };
  }

  const written = await repository.writeImport({
    file,
    batch: { competitionId, status: "COMMITTED", errors: null },
    schools: [...schoolSequence.entries()].map(([name, sequence]) => ({ name, sequence })),
    create,
    update,
    deactivateIds,
  });

  // The generated ids come back in the same order as `create`, so each credential is
  // paired with the participant it belongs to without a second read.
  written.createdParticipants.forEach((participant, index) => {
    const credential = credentials[index];
    if (credential) credential.participantId = participant.id;
  });

  const replaced = update.filter((row) => row.active === false).length;
  return {
    fileId: written.fileId,
    batchId: written.batchId,
    created: create.length,
    kept,
    replaced,
    deactivated: deactivateIds.length,
    credentials,
  };
}

/**
 * List one competition's participants, with the counts the setup screen and the import
 * result both need. Never returns a password (acceptance criterion 6).
 */
export async function listParticipants(
  competitionId: string,
  filter: { active?: boolean; categoryId?: string } = {},
): Promise<ParticipantListView> {
  const competition = await repository.findCompetition(competitionId);
  if (!competition) {
    throw notFoundError();
  }

  const rows = await repository.listParticipants(competitionId, filter);
  const teamFlagged = new Map<
    string,
    ParticipantListView["counts"]["teamFlaggedBySchool"][number]
  >();
  for (const row of rows) {
    if (!row.teamEvent || !row.active) continue;
    const key = `${row.schoolId}:${row.categoryId}`;
    const entry = teamFlagged.get(key);
    if (entry) {
      entry.count += 1;
      continue;
    }
    teamFlagged.set(key, {
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      count: 1,
    });
  }

  return {
    competitionId,
    participants: rows.map((row) => ({
      id: row.id,
      participantNumber: row.participantNumber,
      name: row.name,
      active: row.active,
      individualEvent: row.individualEvent,
      teamEvent: row.teamEvent,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      teamId: row.teamId,
      username: row.username,
    })),
    counts: {
      total: rows.length,
      active: rows.filter((row) => row.active).length,
      // The two counts the Individual round actually depends on (spec §8 Q3): a
      // participant with `individualEvent = false` is never dealt into an Individual
      // round, so this number is the round's real field.
      individualEvent: rows.filter((row) => row.active && row.individualEvent).length,
      teamEvent: rows.filter((row) => row.active && row.teamEvent).length,
      teamFlaggedBySchool: [...teamFlagged.values()].sort(
        (a, b) =>
          a.schoolName.localeCompare(b.schoolName) || a.categoryName.localeCompare(b.categoryName),
      ),
    },
  };
}

const SLIP_HEADERS = [
  "participant.slips.number",
  "participant.slips.name",
  "participant.slips.school",
  "participant.slips.category",
  "participant.slips.username",
  "participant.slips.password",
  "participant.slips.entryLink",
] as const;

function slipHeaderRow(withLink: boolean): string[] {
  return (withLink ? SLIP_HEADERS : SLIP_HEADERS.slice(0, SLIP_HEADERS.length - 1)).map((key) =>
    translate("en", key),
  );
}

/**
 * Write the printable credential slips (spec §4.7, PAR-002).
 *
 * `.xlsx`, reusing the Results module's zero-dependency writer (spec §8 Q8) — the only
 * format in the tree that already works, and it prints. Contains one row per newly issued
 * credential: number, name, school, category, username, password, and the entry link the
 * publish step generates.
 *
 * **This is the only place a plaintext password is ever written down**, and the file is
 * controller-only. Called during the import that generated the passwords, because after
 * that they are gone for good. Returns null when there is nothing new to print, so a
 * re-import of an unchanged file does not overwrite the slips that are already in hand.
 */
async function writeCredentialSlips(params: {
  competitionId: string;
  credentials: IssuedCredential[];
  uploadedByAccountId: string | null;
  link: string;
}): Promise<{ fileId: string; path: string; originalName: string; bytes: Buffer } | null> {
  if (params.credentials.length === 0) return null;

  const withLink = params.link !== "";
  const rows = params.credentials.map((credential) => {
    const base = [
      credential.participantNumber,
      credential.name,
      credential.schoolName,
      credential.categoryName,
      credential.username,
      credential.password,
    ];
    return withLink ? [...base, params.link] : base;
  });

  const bytes = writeXlsx([
    { name: "credentials", rows: [slipHeaderRow(withLink), ...rows] },
  ]);

  const fileId = randomUUID();
  const originalName = `participant-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await ensureStorageRoot();
  const path = competitionFilePath({
    competitionId: params.competitionId,
    kind: "CREDENTIAL_SLIPS",
    fileId,
    originalName,
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  await repository.writeSlipsFile({
    competitionId: params.competitionId,
    path,
    originalName,
    mimeType: XLSX_MIME_TYPE,
    sizeBytes: bytes.length,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    uploadedByAccountId: params.uploadedByAccountId,
  });

  return { fileId, path, originalName, bytes };
}

/**
 * `GET …/participants/credentials` — the stored slips file, or a password-less roster when
 * no import has run since the passwords existed.
 *
 * A password cannot be regenerated: it was never stored. So this endpoint returns the
 * file the import wrote while the passwords were still in hand. If there is none (the
 * competition was seeded by hand, or the storage was cleared), it writes a roster with the
 * username column filled and the password column blank rather than inventing credentials
 * that would not work — and the filename says which one it is.
 */
export async function exportCredentials(params: {
  competitionId: string;
  uploadedByAccountId: string | null;
}): Promise<{ bytes: Buffer; originalName: string; mimeType: string }> {
  const competition = await repository.findCompetition(params.competitionId);
  if (!competition) {
    throw notFoundError();
  }

  const stored = await repository.findLatestSlipsFile(params.competitionId);
  if (stored) {
    try {
      const bytes = await readFile(stored.path);
      return { bytes, originalName: stored.originalName, mimeType: stored.mimeType };
    } catch {
      // The row exists but the file is gone (storage cleared, volume not mounted). Fall
      // through to the password-less roster rather than 500-ing on a missing export.
    }
  }

  const rows = await repository.listCredentialRows(params.competitionId);
  if (rows.length === 0) {
    throw new NotFoundError(translate("en", "participant.credentials.none"), {
      code: "participant.credentials.none",
    });
  }

  const bytes = writeXlsx([
    {
      name: "credentials",
      rows: [
        slipHeaderRow(false),
        ...rows.map((row) => [
          row.participantNumber,
          row.name,
          row.schoolName,
          row.categoryName,
          row.username ?? "",
          // Blank by design: the password was never stored, so nothing can print it.
          "",
        ]),
      ],
    },
  ]);

  const originalName = `participant-roster-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { bytes, originalName, mimeType: XLSX_MIME_TYPE };
}

/** The fields `PATCH` accepts (spec §4.6). All optional; an empty body is a no-op. */
export interface ParticipantEdit {
  name?: string;
  categoryId?: string;
  schoolId?: string;
  schoolName?: string;
  teamId?: string | null;
  participantNumber?: number;
  active?: boolean;
  individualEvent?: boolean;
  teamEvent?: boolean;
}

/** The subset of `ParticipantEdit` the repository writes, minus the resolved school. */
type ParticipantEditData = Parameters<typeof repository.applyParticipantEdit>[0]["data"];

/**
 * Edit one participant (**[C] PAR-003**: allowed at any time, before, during and after the
 * competition — this is the endpoint that survives PAR-009's import cutoff).
 *
 * A **name change issues new credentials**, because a different name means a different
 * student is standing in, and the old student's password must stop working. The response
 * returns the new plaintext password **once**. Every other field is a plain update.
 *
 * Throws 404 when the participant isn't in this competition, 400 when the category or
 * school doesn't exist, 409 when a `participantNumber` collides with the schema's
 * `@@unique([competitionId, participantNumber])`.
 */
export async function editParticipant(params: {
  competitionId: string;
  participantId: string;
  edit: ParticipantEdit;
}): Promise<ParticipantEditResultView> {
  const { competitionId, participantId, edit } = params;

  const participant = await repository.findParticipant(participantId);
  if (!participant || participant.competitionId !== competitionId) {
    throw notFoundError();
  }

  const categories = await repository.listCategories(competitionId);
  if (edit.categoryId !== undefined && !categories.some((c) => c.id === edit.categoryId)) {
    throw badRequest("participant.edit.unknownCategory");
  }

  let schoolId = edit.schoolId;
  if (edit.schoolName !== undefined && edit.schoolName.trim() !== "") {
    // A hand-edit may name a school the file never mentioned, so it is created on demand.
    schoolId = (await repository.ensureSchool(competitionId, edit.schoolName.trim())).id;
  }
  if (schoolId !== undefined && schoolId !== null) {
    const schools = await repository.listSchools(competitionId);
    if (!schools.some((school) => school.id === schoolId)) {
      throw badRequest("participant.edit.unknownSchool");
    }
  }

  const nextNumber = edit.participantNumber;
  if (nextNumber !== undefined && nextNumber !== participant.participantNumber) {
    const taken = await repository.listParticipants(competitionId);
    if (taken.some((row) => row.participantNumber === nextNumber)) {
      throw new ConflictError(translate("en", "participant.edit.numberTaken"), {
        code: "participant.edit.numberTaken",
      });
    }
  }

  const data: ParticipantEditData = {};
  if (edit.name !== undefined && edit.name.trim() !== "") data.name = edit.name.trim();
  if (edit.categoryId !== undefined) data.categoryId = edit.categoryId;
  if (schoolId !== undefined) data.schoolId = schoolId;
  // Editing `teamId` is how a team changes: there is no separate team-management screen
  // ([C] PAR-007, resolves U-41). This unit writes no team, so the field is only ever set
  // by hand or by whatever unit builds team formation later.
  if (edit.teamId !== undefined) data.teamId = edit.teamId;
  if (nextNumber !== undefined) data.participantNumber = nextNumber;
  if (edit.active !== undefined) data.active = edit.active;
  if (edit.individualEvent !== undefined) data.individualEvent = edit.individualEvent;
  if (edit.teamEvent !== undefined) data.teamEvent = edit.teamEvent;

  // A name change replaces the student, so it replaces the credentials (PAR-003).
  const replaced = data.name !== undefined && data.name !== participant.name;

  let credential: IssuedCredential | null = null;
  if (replaced) {
    const number = data.participantNumber ?? participant.participantNumber;
    const { plain, suffixed } = candidateUsernames(number, competitionId);
    const taken = await repository.findTakenUsernames([plain]);
    const username = taken.has(plain) ? suffixed : plain;
    const password = identityService.generatePassword();
    await repository.applyParticipantEdit({
      participantId,
      data,
      credential: {
        username,
        passwordHash: await identityService.hashPassword(password),
        oldAccountId: participant.accountId,
      },
    });
    credential = {
      participantId,
      participantNumber: number,
      name: data.name!,
      schoolName: participant.schoolName,
      categoryName: participant.categoryName,
      username,
      password,
    };
  } else {
    await repository.applyParticipantEdit({ participantId, data, credential: null });
  }

  const updated = await repository.findParticipant(participantId);
  if (!updated) {
    throw notFoundError();
  }
  return {
    participant: {
      id: updated.id,
      participantNumber: updated.participantNumber,
      name: updated.name,
      active: updated.active,
      individualEvent: updated.individualEvent,
      teamEvent: updated.teamEvent,
      categoryId: updated.categoryId,
      categoryName: updated.categoryName,
      schoolId: updated.schoolId,
      schoolName: updated.schoolName,
      teamId: updated.teamId,
      username: updated.username,
    },
    credential,
  };
}

/**
 * Add one participant individually (**[C] PAR-003**), with a fresh `PLAYER` account and
 * credentials returned once. Takes the next free number, per §4.5's no-renumbering rule.
 */
export async function addParticipant(params: {
  competitionId: string;
  name: string;
  categoryId: string;
  schoolName: string;
  individualEvent: boolean;
  teamEvent: boolean;
}): Promise<ParticipantEditResultView> {
  const { competitionId } = params;

  const competition = await repository.findCompetition(competitionId);
  if (!competition) {
    throw notFoundError();
  }
  const name = params.name.trim();
  const schoolName = params.schoolName.trim();
  if (name === "") throw badRequest("participant.add.nameRequired");
  if (schoolName === "") throw badRequest("participant.add.schoolRequired");

  const categories = await repository.listCategories(competitionId);
  const category = categories.find((entry) => entry.id === params.categoryId);
  if (!category) {
    throw badRequest("participant.add.unknownCategory");
  }

  const key = existingKey(name, schoolName, params.categoryId);
  const existing = await repository.listExistingParticipants(competitionId);
  if (existing.some((row) => existingKey(row.name, row.schoolName, row.categoryId) === key)) {
    throw new ConflictError(translate("en", "participant.add.duplicate"), {
      code: "participant.add.duplicate",
    });
  }

  const school = await repository.ensureSchool(competitionId, schoolName);
  const numbering = await repository.nextNumbering(competitionId);
  const participantNumber = numbering.maxParticipantNumber + 1;
  const sequence = numbering.maxSequence + 1;

  const { plain, suffixed } = candidateUsernames(participantNumber, competitionId);
  const taken = await repository.findTakenUsernames([plain, suffixed]);
  const username = !taken.has(plain) ? plain : suffixed;
  const password = identityService.generatePassword();

  const { participantId } = await repository.createParticipant({
    competitionId,
    categoryId: params.categoryId,
    schoolId: school.id,
    name,
    participantNumber,
    sequence,
    individualEvent: params.individualEvent,
    teamEvent: params.teamEvent,
    username,
    passwordHash: await identityService.hashPassword(password),
  });

  const credential: IssuedCredential = {
    participantId,
    participantNumber,
    name,
    schoolName,
    categoryName: category.name,
    username,
    password,
  };
  await writeCredentialSlips({
    competitionId,
    credentials: [credential],
    uploadedByAccountId: null,
    link: entryLink(competition.entryLinkToken),
  });

  return {
    participant: {
      id: participantId,
      participantNumber,
      name,
      active: true,
      individualEvent: params.individualEvent,
      teamEvent: params.teamEvent,
      categoryId: params.categoryId,
      categoryName: category.name,
      schoolId: school.id,
      schoolName,
      teamId: null,
      username,
    },
    credential,
  };
}

/**
 * Remove a participant from the active set. `DELETE` never hard-deletes (spec §4.1):
 * result rows already written keep their foreign key, and the account is deactivated so
 * the login stops working.
 */
export async function deactivateParticipant(
  competitionId: string,
  participantId: string,
): Promise<void> {
  const participant = await repository.findParticipant(participantId);
  if (!participant || participant.competitionId !== competitionId) {
    throw notFoundError();
  }
  await repository.deactivateParticipant(participantId);
}

export const participantService = {
  importParticipantFile,
  listParticipants,
  editParticipant,
  addParticipant,
  deactivateParticipant,
  exportCredentials,
};

export type { ParticipantImportWarning, ParticipantListView };
