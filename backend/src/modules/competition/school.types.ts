/**
 * Types for the `School` CRUD surface (BLD-052, decided 2026-10-15).
 *
 * A `School` belongs to exactly one competition (`@@unique([competitionId, name])`)
 * and is referenced by `Participant` and `Team`. These types describe what the
 * controller can read, create, rename and delete — nothing else is editable:
 * `competitionId` is fixed by the URL and `sequence` is derived at creation.
 */

/** One school row as the controller's setup panel reads it. */
export interface SchoolView {
  id: string;
  name: string;
  sequence: number;
  /** How many participants still point at this school — the deletion guard's figure. */
  participantCount: number;
  /** How many teams still point at this school — the guard's other figure. */
  teamCount: number;
}

export interface CreateSchoolInput {
  name: string;
}

export interface UpdateSchoolInput {
  /** Rename only. Nothing else about a school is user-editable. */
  name: string;
}
