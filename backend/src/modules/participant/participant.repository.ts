/**
 * Prisma access for the Participant module (Unit 04). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only through
 * its public interface).
 *
 * The import write is one `prisma.$transaction`, in the same shape as
 * `question.repository.ts`'s `writeImport`: a successful file commits its `StoredFile`,
 * its `ImportBatch` and every `School`/`Participant`/`Account` row together, and a
 * rejected file commits nothing but still writes the uploaded file and a `REJECTED` batch
 * so the rejection is auditable (BLD-039, spec §4.3).
 *
 * **No `Team` row is ever written here** and `teamId` is always left null — team formation
 * is deferred out of this unit (spec §8 Q10), and `Team.@@unique([competitionId,
 * categoryId, schoolId])` cannot represent the cross-school random teams that proposal
 * describes, which is the conflict logged as U-102.
 */
import { prisma } from "../../infra";
import type { ParsedParticipant } from "./participant.types";

// ---------------------------------------------------------------------------
// Scope and readiness reads
// ---------------------------------------------------------------------------

export interface CompetitionScopeRow {
  id: string;
  name: string;
  status: string;
  entryLinkToken: string;
}

export function findCompetition(competitionId: string): Promise<CompetitionScopeRow | null> {
  return prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, name: true, status: true, entryLinkToken: true },
  });
}

export function listCategories(
  competitionId: string,
): Promise<{ id: string; name: string; code: string }[]> {
  return prisma.competitionCategory.findMany({
    where: { competitionId },
    select: { id: true, name: true, code: true },
    orderBy: { sequence: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Numbering and username allocation
// ---------------------------------------------------------------------------

/**
 * The highest `participantNumber` and `sequence` already in use, so a re-import's new rows
 * take the next free numbers instead of re-shuffling the kept ones (spec §4.5: renumbering
 * would invalidate already-printed slips). Both are `0` for a competition with no
 * participants yet, so the first generated number is `1`.
 */
export async function nextNumbering(competitionId: string): Promise<{
  maxParticipantNumber: number;
  maxSequence: number;
}> {
  const row = await prisma.participant.aggregate({
    where: { competitionId },
    _max: { participantNumber: true, sequence: true },
  });
  return {
    maxParticipantNumber: row._max.participantNumber ?? 0,
    maxSequence: row._max.sequence ?? 0,
  };
}

/**
 * Which of the candidate usernames are already taken.
 *
 * `Account.username` is `@unique` with **no competition scope** (`schema.prisma`,
 * "Account"), so a bare `p1` collides the moment a second competition exists — and a
 * collision inside the commit transaction would be an atomic whole-file reject on event
 * day. So the free ones are found *before* the transaction and the caller falls back to
 * the deterministic per-competition suffix from spec §8 Q7 for the rest.
 */
export async function findTakenUsernames(candidates: string[]): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const rows = await prisma.account.findMany({
    where: { username: { in: candidates } },
    select: { username: true },
  });
  return new Set(rows.map((row) => row.username));
}

// ---------------------------------------------------------------------------
// The dataset already in the database (re-import matching, spec §4.5)
// ---------------------------------------------------------------------------

export interface ExistingParticipantRow {
  id: string;
  name: string;
  participantNumber: number;
  sequence: number;
  active: boolean;
  individualEvent: boolean;
  teamEvent: boolean;
  categoryId: string;
  schoolId: string;
  schoolName: string;
  categoryName: string;
  accountId: string | null;
  username: string | null;
}

/**
 * Every participant of one competition, active or not, with the school and category names
 * the identity key is built from and the account the credentials belong to. Inactive rows
 * are included on purpose: a re-import that brings a previously removed student back
 * should reuse the row rather than create a second one for the same person.
 */
export async function listExistingParticipants(
  competitionId: string,
): Promise<ExistingParticipantRow[]> {
  const rows = await prisma.participant.findMany({
    where: { competitionId },
    orderBy: { participantNumber: "asc" },
    select: {
      id: true,
      name: true,
      participantNumber: true,
      sequence: true,
      active: true,
      individualEvent: true,
      teamEvent: true,
      categoryId: true,
      schoolId: true,
      school: { select: { name: true } },
      category: { select: { name: true } },
      account: { select: { id: true, username: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    participantNumber: row.participantNumber,
    sequence: row.sequence,
    active: row.active,
    individualEvent: row.individualEvent,
    teamEvent: row.teamEvent,
    categoryId: row.categoryId,
    schoolId: row.schoolId,
    schoolName: row.school.name,
    categoryName: row.category.name,
    accountId: row.account?.id ?? null,
    username: row.account?.username ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface StoredFileInput {
  competitionId: string;
  kind: "PARTICIPANT_EXCEL";
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedByAccountId: string | null;
}

/** A school to create if absent, in first-appearance order in the file. */
export interface SchoolUpsertInput {
  name: string;
  sequence: number;
}

/**
 * A participant to create, with the account already decided by the service.
 *
 * The school is named **by text, not by id**, because the school row may not exist yet: it
 * is created by the same transaction's upsert list, so its id is not knowable before the
 * transaction begins. `schoolName` must appear in that list — the service derives the list
 * from these very rows, so it always does.
 */
export interface ParticipantCreateInput {
  name: string;
  categoryId: string;
  schoolName: string;
  participantNumber: number;
  sequence: number;
  individualEvent: boolean;
  teamEvent: boolean;
  username: string;
  passwordHash: string;
}

/** An existing row to update rather than recreate (an unchanged participant, §4.5). */
export interface ParticipantUpdateInput {
  id: string;
  name: string;
  categoryId: string;
  schoolId: string;
  individualEvent: boolean;
  teamEvent: boolean;
  active: boolean;
  /** Non-null only when the participant's account was missing and one is issued now. */
  account?: { username: string; passwordHash: string } | null;
}

/**
 * Persist one uploaded file, its `ImportBatch`, and — when the import succeeded — the
 * schools, participants and accounts of the new dataset, all in a single transaction so a
 * rejected file leaves nothing half-written behind (spec §4.4).
 *
 * `createdParticipants` comes back with its generated ids, in the same order as the input,
 * so the service can pair each new participant with the plaintext password it is about to
 * return once. Schools are upserted on `@@unique([competitionId, name])` and come back as
 * a name→id map.
 *
 * Returns an empty `createdParticipants` list when the import was rejected.
 */
export async function writeImport(params: {
  file: StoredFileInput;
  batch: { competitionId: string; status: "REJECTED" | "COMMITTED"; errors: unknown };
  schools: SchoolUpsertInput[];
  create: ParticipantCreateInput[];
  update: ParticipantUpdateInput[];
  /** Ids of participants to remove from the active set (absent from the new file). */
  deactivateIds: string[];
}): Promise<{
  fileId: string;
  batchId: string;
  schoolIdsByName: Map<string, string>;
  createdParticipants: { id: string; participantNumber: number; name: string }[];
}> {
  const schoolIdsByName = new Map<string, string>();
  const createdParticipants: { id: string; participantNumber: number; name: string }[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const file = await tx.storedFile.create({ data: params.file });

    for (const school of params.schools) {
      const upserted = await tx.school.upsert({
        where: {
          competitionId_name: { competitionId: params.file.competitionId, name: school.name },
        },
        // `sequence` is not touched on update: a re-import must not reorder the schools
        // the first import established.
        update: {},
        create: {
          competitionId: params.file.competitionId,
          name: school.name,
          sequence: school.sequence,
        },
        select: { id: true },
      });
      schoolIdsByName.set(school.name, upserted.id);
    }

    for (const row of params.create) {
      // The school was upserted above, so its id exists by now. Looking it up here — rather
      // than having the service resolve it before the transaction — is what keeps the
      // school creation and the participant write inside one atomic commit (spec §4.4).
      const schoolId = schoolIdsByName.get(row.schoolName);
      if (schoolId === undefined) {
        throw new Error(`school not upserted for participant row: ${row.schoolName}`);
      }
      const participant = await tx.participant.create({
        data: {
          competitionId: params.file.competitionId,
          categoryId: row.categoryId,
          schoolId,
          // `teamId` deliberately omitted: no team is formed by this unit (spec §8 Q10).
          name: row.name,
          participantNumber: row.participantNumber,
          sequence: row.sequence,
          individualEvent: row.individualEvent,
          teamEvent: row.teamEvent,
        },
        select: { id: true },
      });
      await tx.account.create({
        data: {
          username: row.username,
          passwordHash: row.passwordHash,
          role: "PLAYER",
          participantId: participant.id,
        },
      });
      createdParticipants.push({
        id: participant.id,
        participantNumber: row.participantNumber,
        name: row.name,
      });
    }

    for (const row of params.update) {
      await tx.participant.update({
        where: { id: row.id },
        data: {
          name: row.name,
          categoryId: row.categoryId,
          schoolId: row.schoolId,
          individualEvent: row.individualEvent,
          teamEvent: row.teamEvent,
          active: row.active,
        },
      });
      if (row.account) {
        await tx.account.create({
          data: {
            username: row.account.username,
            passwordHash: row.account.passwordHash,
            role: "PLAYER",
            participantId: row.id,
          },
        });
      }
    }

    if (params.deactivateIds.length > 0) {
      // Never a hard delete: result rows already written keep their foreign key, so the
      // participant leaves the active set and its account is deactivated (spec §4.5).
      await tx.participant.updateMany({
        where: { id: { in: params.deactivateIds } },
        data: { active: false },
      });
      await tx.account.updateMany({
        where: { participantId: { in: params.deactivateIds } },
        data: { isActive: false },
      });
    }

    const batch = await tx.importBatch.create({
      data: {
        competitionId: params.batch.competitionId,
        kind: "PARTICIPANT_EXCEL",
        fileId: file.id,
        status: params.batch.status,
        errors: params.batch.errors as object,
      },
    });

    return { fileId: file.id, batchId: batch.id };
  });

  return { ...result, schoolIdsByName, createdParticipants };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface ParticipantListRow {
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

/** Every participant of one competition, in participant-number order. */
export async function listParticipants(
  competitionId: string,
  filter: { active?: boolean; categoryId?: string } = {},
): Promise<ParticipantListRow[]> {
  const rows = await prisma.participant.findMany({
    where: {
      competitionId,
      ...(filter.active === undefined ? {} : { active: filter.active }),
      ...(filter.categoryId === undefined ? {} : { categoryId: filter.categoryId }),
    },
    orderBy: { participantNumber: "asc" },
    select: {
      id: true,
      participantNumber: true,
      name: true,
      active: true,
      individualEvent: true,
      teamEvent: true,
      categoryId: true,
      category: { select: { name: true } },
      schoolId: true,
      school: { select: { name: true } },
      teamId: true,
      account: { select: { username: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    participantNumber: row.participantNumber,
    name: row.name,
    active: row.active,
    individualEvent: row.individualEvent,
    teamEvent: row.teamEvent,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    schoolId: row.schoolId,
    schoolName: row.school.name,
    teamId: row.teamId,
    username: row.account?.username ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Single-participant reads and edits (PAR-003)
// ---------------------------------------------------------------------------

export interface SingleParticipantRow {
  id: string;
  competitionId: string;
  name: string;
  participantNumber: number;
  active: boolean;
  individualEvent: boolean;
  teamEvent: boolean;
  categoryId: string;
  schoolId: string;
  schoolName: string;
  categoryName: string;
  teamId: string | null;
  accountId: string | null;
  username: string | null;
}

export async function findParticipant(
  participantId: string,
): Promise<SingleParticipantRow | null> {
  const row = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      competitionId: true,
      name: true,
      participantNumber: true,
      active: true,
      individualEvent: true,
      teamEvent: true,
      categoryId: true,
      schoolId: true,
      school: { select: { name: true } },
      category: { select: { name: true } },
      teamId: true,
      account: { select: { id: true, username: true } },
    },
  });
  if (row === null) return null;
  return {
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    participantNumber: row.participantNumber,
    active: row.active,
    individualEvent: row.individualEvent,
    teamEvent: row.teamEvent,
    categoryId: row.categoryId,
    schoolId: row.schoolId,
    schoolName: row.school.name,
    categoryName: row.category.name,
    teamId: row.teamId,
    accountId: row.account?.id ?? null,
    username: row.account?.username ?? null,
  };
}

/**
 * Apply one individual edit. When `credential` is present the participant's account is
 * replaced — old account deactivated and kept (an audit trail of who was here before) and
 * a new `PLAYER` account created against the same participant — so the response can return
 * the new plaintext password once (spec §4.6).
 */
export async function applyParticipantEdit(params: {
  participantId: string;
  data: {
    name?: string;
    categoryId?: string;
    schoolId?: string;
    teamId?: string | null;
    participantNumber?: number;
    active?: boolean;
    individualEvent?: boolean;
    teamEvent?: boolean;
  };
  credential?: { username: string; passwordHash: string; oldAccountId: string | null } | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.participant.update({ where: { id: params.participantId }, data: params.data });
    if (params.credential) {
      if (params.credential.oldAccountId !== null) {
        await tx.account.update({
          where: { id: params.credential.oldAccountId },
          data: { isActive: false, participantId: null },
        });
      }
      await tx.account.create({
        data: {
          username: params.credential.username,
          passwordHash: params.credential.passwordHash,
          role: "PLAYER",
          participantId: params.participantId,
        },
      });
    }
  });
}

export async function createParticipant(params: {
  competitionId: string;
  categoryId: string;
  schoolId: string;
  name: string;
  participantNumber: number;
  sequence: number;
  individualEvent: boolean;
  teamEvent: boolean;
  username: string;
  passwordHash: string;
}): Promise<{ participantId: string }> {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.create({
      data: {
        competitionId: params.competitionId,
        categoryId: params.categoryId,
        schoolId: params.schoolId,
        name: params.name,
        participantNumber: params.participantNumber,
        sequence: params.sequence,
        individualEvent: params.individualEvent,
        teamEvent: params.teamEvent,
      },
      select: { id: true },
    });
    await tx.account.create({
      data: {
        username: params.username,
        passwordHash: params.passwordHash,
        role: "PLAYER",
        participantId: participant.id,
      },
    });
    return { participantId: participant.id };
  });
}

/**
 * Remove a participant from the active set (spec §4.1: `DELETE` deactivates, never
 * hard-deletes) and deactivate its account, in one transaction.
 */
export async function deactivateParticipant(participantId: string): Promise<void> {
  await prisma.$transaction([
    prisma.participant.update({ where: { id: participantId }, data: { active: false } }),
    prisma.account.updateMany({
      where: { participantId },
      data: { isActive: false },
    }),
  ]);
}

/**
 * Look a school up by name within a competition, creating it when absent so an individual
 * edit or add can name a school the file never mentioned (PAR-003).
 */export async function ensureSchool(
  competitionId: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.school.findUnique({
    where: { competitionId_name: { competitionId, name } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const maxSequence = await prisma.school.aggregate({
    where: { competitionId },
    _max: { sequence: true },
  });
  const created = await prisma.school.create({
    data: {
      competitionId,
      name,
      sequence: (maxSequence._max.sequence ?? 0) + 1,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

/**
 * Every school of one competition, so an edit that names a `schoolId` can be checked
 * against the ones that actually exist (an unknown id would otherwise fail as a raw
 * foreign-key violation, which the client cannot localize).
 */
export async function listSchools(
  competitionId: string,
): Promise<{ id: string; name: string; sequence: number }[]> {
  return prisma.school.findMany({
    where: { competitionId },
    orderBy: { sequence: "asc" },
    select: { id: true, name: true, sequence: true },
  });
}

/**
 * The credential rows for the slip export (spec §4.7) — the only read that returns a
 * plaintext password, and the password itself is not here: it was never stored, so the
 * slips can only be produced for participants whose password the caller still holds.
 *
 * That is why the export is written **at import time**, from the freshly generated
 * passwords, and stored as a `CREDENTIAL_SLIPS` file. This read returns what a *later*
 * export can contain: everything but the password, plus the username, so the controller
 * still gets a printable roster after a restart.
 */
export async function listCredentialRows(competitionId: string): Promise<
  {
    participantNumber: number;
    name: string;
    schoolName: string;
    categoryName: string;
    username: string | null;
    active: boolean;
  }[]
> {
  const rows = await prisma.participant.findMany({
    where: { competitionId },
    orderBy: { participantNumber: "asc" },
    select: {
      participantNumber: true,
      name: true,
      active: true,
      school: { select: { name: true } },
      category: { select: { name: true } },
      account: { select: { username: true } },
    },
  });
  return rows.map((row) => ({
    participantNumber: row.participantNumber,
    name: row.name,
    schoolName: row.school.name,
    categoryName: row.category.name,
    username: row.account?.username ?? null,
    active: row.active,
  }));
}

/** The most recent stored credential-slips file, if one has been generated. */
export async function findLatestSlipsFile(
  competitionId: string,
): Promise<{ id: string; path: string; originalName: string; mimeType: string; sizeBytes: number } | null> {
  return prisma.storedFile.findFirst({
    where: { competitionId, kind: "CREDENTIAL_SLIPS" },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, path: true, originalName: true, mimeType: true, sizeBytes: true },
  });
}

/** Record a generated slips file so the export is auditable like every other. */
export async function writeSlipsFile(input: {
  competitionId: string;
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedByAccountId: string | null;
}): Promise<{ id: string }> {
  const created = await prisma.storedFile.create({
    data: { ...input, kind: "CREDENTIAL_SLIPS" },
    select: { id: true },
  });
  return { id: created.id };
}

/** A parsed row, ready for the service to hand to `writeImport`. */
export type { ParsedParticipant };
