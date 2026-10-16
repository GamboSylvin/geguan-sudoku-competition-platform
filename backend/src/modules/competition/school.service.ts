/**
 * The domain rules for the `School` CRUD surface (BLD-052, decided 2026-10-15) and
 * its public interface.
 *
 * What lives here: listing a competition's schools with the counts that say whether
 * a delete is possible, adding one, renaming it, and deleting it — the last one
 * guarded exactly the way `judge.service.ts`'s ROL-010 guard is: read the rows that
 * would be orphaned first, and if any exist, refuse with a 409 that says why, rather
 * than deleting and letting the database reject the statement.
 *
 * Two decisions worth stating:
 * - A school has no status and no lock. Renaming stays possible after publish,
 *   because a typo in a school name is often found late and a rename changes no
 *   result: rankings are computed from ids, not names.
 * - `sequence` is not user-editable. A new school ranks after every existing one;
 *   reordering the school list is not part of this decision.
 */
import { ConflictError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import * as repository from "./school.repository";
import type {
  CreateSchoolInput,
  SchoolView,
  UpdateSchoolInput,
} from "./school.types";

function schoolNotFound(): NotFoundError {
  return new NotFoundError(translate("en", "school.notFound"), {
    code: "school.notFound",
  });
}

function competitionNotFound(): NotFoundError {
  return new NotFoundError(translate("en", "competition.notFound"), {
    code: "competition.notFound",
  });
}

function toView(row: repository.SchoolWithCounts): SchoolView {
  return {
    id: row.id,
    name: row.name,
    sequence: row.sequence,
    participantCount: row._count.participants,
    teamCount: row._count.teams,
  };
}

/**
 * A name already held by another school of the same competition. Signalled with its
 * own code rather than left to the database's unique index, so the controller can
 * say what's blocking it.
 */
function nameTaken(): ConflictError {
  return new ConflictError(translate("en", "school.nameTaken"), {
    code: "school.nameTaken",
  });
}

/** The deletion guard's refusal: the school still has people or a team. */
function stillReferenced(participants: number, teams: number): ConflictError {
  const code = participants > 0 ? "school.hasParticipants" : "school.hasTeam";
  return new ConflictError(translate("en", code), {
    code,
    details: { participants, teams },
  });
}

export async function listSchools(competitionId: string): Promise<SchoolView[]> {
  if (!(await repository.competitionExists(competitionId))) {
    throw competitionNotFound();
  }
  return (await repository.listSchools(competitionId)).map(toView);
}

export async function createSchool(
  competitionId: string,
  input: CreateSchoolInput,
): Promise<SchoolView> {
  if (!(await repository.competitionExists(competitionId))) {
    throw competitionNotFound();
  }
  const name = input.name.trim();
  if (await repository.findSchoolByName(competitionId, name)) {
    throw nameTaken();
  }
  const sequence = await repository.nextSequence(competitionId);
  const created = await repository.createSchool(competitionId, { name, sequence });
  return {
    id: created.id,
    name: created.name,
    sequence: created.sequence,
    participantCount: 0,
    teamCount: 0,
  };
}

/** Rename only — `competitionId` comes from the URL and `sequence` is not editable. */
export async function updateSchool(
  competitionId: string,
  schoolId: string,
  input: UpdateSchoolInput,
): Promise<SchoolView> {
  const school = await repository.findSchoolById(competitionId, schoolId);
  if (!school) {
    throw schoolNotFound();
  }
  const name = input.name.trim();
  if (name !== school.name) {
    const clash = await repository.findSchoolByName(competitionId, name);
    if (clash && clash.id !== schoolId) {
      throw nameTaken();
    }
  }
  const renamed = await repository.renameSchool(schoolId, name);
  const counts = await repository.countReferences(schoolId);
  return {
    id: renamed.id,
    name: renamed.name,
    sequence: renamed.sequence,
    participantCount: counts.participants,
    teamCount: counts.teams,
  };
}

/**
 * Delete a school. Refused with a 409 while a `Participant` or a `Team` still points
 * at it: a participant whose school silently vanished would drop out of the school
 * ranking with nobody having decided that. Emptying the school first is the
 * controller's job.
 */
export async function deleteSchool(competitionId: string, schoolId: string): Promise<void> {
  const school = await repository.findSchoolById(competitionId, schoolId);
  if (!school) {
    throw schoolNotFound();
  }

  const counts = await repository.countReferences(schoolId);
  if (counts.participants > 0 || counts.teams > 0) {
    throw stillReferenced(counts.participants, counts.teams);
  }

  await repository.deleteSchool(schoolId);
}

export const schoolService = {
  listSchools,
  createSchool,
  updateSchool,
  deleteSchool,
};
