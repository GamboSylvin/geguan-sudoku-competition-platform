/**
 * The judge-list and range-assignment domain rules (Unit 06). The Identity module
 * owns judges, their accounts and their competition ranges (architecture, System
 * boundaries — "judge range assignment" lives in Participant / Identity).
 *
 * What lives here: creating a judge with its one-time credentials (BLD-037, same
 * pattern participants will later use), listing, removal with the ROL-010 guard,
 * assigning/editing/unassigning a judge's range on a competition (BLD-008 —
 * editable at any time, no cutoff), and the authority-scoping check later units
 * call (the single exported enforcement point, spec 06 Implementation Notes).
 */
import { ConflictError, NotFoundError } from "../../shared/errors";
import { now } from "../../shared/clock";
import { translate } from "../../shared/i18n";
import * as repository from "./identity.repository";
import {
  generatePassword,
  generateUsername,
  hashPassword,
} from "./identity.service";
import {
  JUDGE_ASSIGNMENT_NOT_FOUND,
  JUDGE_HAS_ACTIVE_ASSIGNMENT,
  JUDGE_NOT_FOUND,
  type AssignJudgeRangeInput,
  type BlockingAssignment,
  type CreateJudgeInput,
  type CreatedJudge,
  type JudgeAssignment,
  type JudgeSummary,
} from "./identity.types";

function toSummary(judge: {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
}): JudgeSummary {
  return {
    id: judge.id,
    name: judge.name,
    active: judge.active,
    createdAt: judge.createdAt.toISOString(),
  };
}

function toAssignment(assignment: {
  id: string;
  competitionId: string;
  judgeId: string;
  fromParticipantNumber: number;
  toParticipantNumber: number;
  assignedAt: Date;
  assignedByAccountId: string | null;
}): JudgeAssignment {
  return {
    id: assignment.id,
    competitionId: assignment.competitionId,
    judgeId: assignment.judgeId,
    fromParticipantNumber: assignment.fromParticipantNumber,
    toParticipantNumber: assignment.toParticipantNumber,
    assignedAt: assignment.assignedAt.toISOString(),
    assignedByAccountId: assignment.assignedByAccountId,
  };
}

function notFoundError(): NotFoundError {
  return new NotFoundError(translate("en", JUDGE_NOT_FOUND), {
    code: JUDGE_NOT_FOUND,
  });
}

function assignmentNotFoundError(): NotFoundError {
  return new NotFoundError(translate("en", JUDGE_ASSIGNMENT_NOT_FOUND), {
    code: JUDGE_ASSIGNMENT_NOT_FOUND,
  });
}

// ---------------------------------------------------------------------------
// Judge list
// ---------------------------------------------------------------------------

/**
 * Create a judge and its login account, returning the one-time credentials.
 * The username is a slug of the name plus a random suffix (BLD-037); the password
 * is the unambiguous random alphabet the credential-slip export will print.
 */
export async function createJudge(input: CreateJudgeInput): Promise<CreatedJudge> {
  const username = generateUsername(input.name, "judge");
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const judge = await repository.createJudgeWithAccount({
    name: input.name,
    username,
    passwordHash,
  });
  return { ...toSummary(judge), username, password };
}

/** List every judge, active and inactive together (spec 06, Implementation Details 1). */
export async function listJudges(): Promise<JudgeSummary[]> {
  const judges = await repository.listJudges();
  return judges.map(toSummary);
}

/**
 * Remove (deactivate) a judge. ROL-010: blocked while the judge has an assignment to
 * a competition that is not FINISHED or CANCELLED — the rejection names every
 * blocking competition so the controller can reassign its range first.
 */
export async function removeJudge(judgeId: string): Promise<JudgeSummary> {
  const judge = await repository.findJudgeById(judgeId);
  if (!judge) {
    throw notFoundError();
  }

  const blocking = await repository.listBlockingAssignments(judgeId);
  if (blocking.length > 0) {
    const competitions: BlockingAssignment[] = blocking.map((row) => ({
      competitionId: row.competition.id,
      competitionName: row.competition.name,
    }));
    throw new ConflictError(translate("en", JUDGE_HAS_ACTIVE_ASSIGNMENT), {
      code: JUDGE_HAS_ACTIVE_ASSIGNMENT,
      details: { competitions },
    });
  }

  const deactivated = await repository.deactivateJudge(judgeId);
  return toSummary(deactivated);
}

// ---------------------------------------------------------------------------
// Range assignment
// ---------------------------------------------------------------------------

/**
 * Assign a judge a participant-number range on a competition, or edit the existing
 * one (U(competitionId, judgeId): one assignment per judge per competition).
 * Editable at any time during the event — no preparation cutoff (BLD-008).
 * `assignedByAccountId` records which controller made the change.
 */
export async function assignJudgeRange(
  competitionId: string,
  input: AssignJudgeRangeInput,
  assignedByAccountId: string | null,
): Promise<JudgeAssignment> {
  const judge = await repository.findJudgeById(input.judgeId);
  if (!judge) {
    throw notFoundError();
  }
  const competition = await repository.findCompetitionName(competitionId);
  if (!competition) {
    throw new NotFoundError(translate("en", "competition.notFound"), {
      code: "competition.notFound",
    });
  }

  const assignment = await repository.upsertAssignment({
    competitionId,
    judgeId: input.judgeId,
    fromParticipantNumber: input.fromParticipantNumber,
    toParticipantNumber: input.toParticipantNumber,
    assignedAt: now(),
    assignedByAccountId,
  });
  return toAssignment(assignment);
}

/** Remove a judge's assignment from a competition (frees the judge for removal). */
export async function unassignJudge(
  competitionId: string,
  assignmentId: string,
): Promise<void> {
  const assignment = await repository.findAssignmentById(assignmentId);
  if (!assignment || assignment.competitionId !== competitionId) {
    throw assignmentNotFoundError();
  }
  await repository.deleteAssignment(assignmentId);
}

// ---------------------------------------------------------------------------
// Authority scoping (the single enforcement point Unit 10 and later units call)
// ---------------------------------------------------------------------------

/**
 * Whether the judge is assigned to the competition with a range that covers the
 * target participant number. Never trust a judge session to self-report its scope:
 * every judge-facing endpoint calls this (spec 06, Security Considerations).
 */
export async function isJudgeAuthorizedForParticipant(
  judgeId: string,
  competitionId: string,
  participantNumber: number,
): Promise<boolean> {
  const assignment = await repository.findAssignmentForJudge(judgeId, competitionId);
  if (!assignment) {
    return false;
  }
  return (
    participantNumber >= assignment.fromParticipantNumber &&
    participantNumber <= assignment.toParticipantNumber
  );
}

/**
 * The judge's current assignments (the minimal landing confirms "assigned to
 * competition X, participants #Y–#Z" — or none).
 */
export async function listJudgeAssignments(judgeId: string): Promise<
  (JudgeAssignment & { competitionName: string })[]
> {
  const rows = await repository.listAssignmentsForJudge(judgeId);
  return rows.map((row) => ({ ...toAssignment(row), competitionName: row.competition.name }));
}

export const judgeService = {
  createJudge,
  listJudges,
  removeJudge,
  assignJudgeRange,
  unassignJudge,
  isJudgeAuthorizedForParticipant,
  listJudgeAssignments,
};
