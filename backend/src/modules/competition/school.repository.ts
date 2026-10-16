/**
 * Prisma access for the `School` CRUD surface (BLD-052). No domain rule lives here —
 * `school.service.ts` carries them (invariant 4). Each function is a thin Prisma
 * wrapper.
 *
 * Placed in `modules/competition/` rather than a new module folder, the same way
 * `competition-copy.repository.ts` and `competition-delete.repository.ts` are: a
 * school is setup data attached to a competition, part of the structure the
 * competition module owns, not a module of its own.
 */
import type { Prisma, School } from "@prisma/client";
import { prisma } from "../../infra";

/**
 * A school with the counts that decide whether it can be deleted. Grouped here so
 * the list read and the guard's read say the same thing.
 */
export const SCHOOL_WITH_COUNTS_INCLUDE = {
  _count: { select: { participants: true, teams: true } },
} satisfies Prisma.SchoolInclude;

export type SchoolWithCounts = Prisma.SchoolGetPayload<{
  include: typeof SCHOOL_WITH_COUNTS_INCLUDE;
}>;

/**
 * Does the URL's competition even exist, so a school endpoint can answer
 * `competition.notFound` rather than an empty list. (The same trivial query exists in
 * `competition-delete.repository.ts` for the hard delete; each repository keeps its
 * own wrapper rather than reaching into its neighbour's.)
 */
export function competitionExists(id: string): Promise<boolean> {
  return prisma.competition
    .findUnique({ where: { id }, select: { id: true } })
    .then((row) => row !== null);
}

export function listSchools(competitionId: string): Promise<SchoolWithCounts[]> {
  return prisma.school.findMany({
    where: { competitionId },
    orderBy: [{ sequence: "asc" }, { name: "asc" }],
    include: SCHOOL_WITH_COUNTS_INCLUDE,
  });
}

export function findSchoolById(competitionId: string, schoolId: string): Promise<School | null> {
  return prisma.school.findFirst({ where: { id: schoolId, competitionId } });
}

/** A name already held by a school of the same competition (U(competitionId, name)). */
export function findSchoolByName(competitionId: string, name: string): Promise<School | null> {
  return prisma.school.findUnique({ where: { competitionId_name: { competitionId, name } } });
}

/** This competition's next free sequence number, to rank the new school last. */
export function nextSequence(competitionId: string): Promise<number> {
  return prisma.school
    .aggregate({ where: { competitionId }, _max: { sequence: true } })
    .then((row) => (row._max.sequence ?? 0) + 1);
}

export function createSchool(
  competitionId: string,
  data: { name: string; sequence: number },
): Promise<School> {
  return prisma.school.create({ data: { competitionId, ...data } });
}

export function renameSchool(schoolId: string, name: string): Promise<School> {
  return prisma.school.update({ where: { id: schoolId }, data: { name } });
}

export function deleteSchool(schoolId: string): Promise<School> {
  return prisma.school.delete({ where: { id: schoolId } });
}

/** The rows that would block a delete, read before attempting one. */
export function countReferences(
  schoolId: string,
): Promise<{ participants: number; teams: number }> {
  return Promise.all([
    prisma.participant.count({ where: { schoolId } }),
    prisma.team.count({ where: { schoolId } }),
  ]).then(([participants, teams]) => ({ participants, teams }));
}
