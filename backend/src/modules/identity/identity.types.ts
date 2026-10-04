/**
 * Types for the Identity module (Unit 02 — authentication and accounts).
 *
 * The module owns: players, teams, player/judge/controller accounts, participant
 * membership, competition-specific access, and one active device per account.
 */
import type { AccountRole } from "@prisma/client";

export type Role = AccountRole;

/** The three roles that can log in, in the order the role picker shows them. */
export const LOGIN_ROLES: readonly Role[] = ["PLAYER", "JUDGE", "CONTROLLER"];

export interface LoginInput {
  username: string;
  password: string;
}

/** What a successful login returns to the client. */
export interface LoginResult {
  token: string;
  role: Role;
  accountId: string;
  /** The device id issued for this login; sent back on later requests and the handshake. */
  deviceId: string;
  /** ISO timestamp of when the session ends (login + SESSION_TTL_HOURS). */
  sessionExpiresAt: string;
}

/** The authenticated caller resolved from a session token by the auth middleware. */
export interface AuthenticatedAccount {
  accountId: string;
  role: Role;
  /** The account's current device row, for the one-active-device check. */
  deviceId: string;
  participantId: string | null;
  judgeId: string | null;
}

/** The identity of the requesting device, taken from the request/handshake. */
export interface DeviceInfo {
  deviceLabel?: string | null;
  userAgent?: string | null;
}

/** Raised for every rejected login (wrong password, unknown user, inactive account). */
export const INVALID_CREDENTIALS = "auth.invalidCredentials";
/** Raised when a session token is missing, unknown, or past its expiry. */
export const SESSION_INVALID = "auth.sessionExpired";
/** Raised when the request comes from a device that is not the active one. */
export const DEVICE_TAKEN_OVER = "auth.deviceTakenOver";

// ---------------------------------------------------------------------------
// Judges and ranges (Unit 06)
// ---------------------------------------------------------------------------

/** Raised when a judge id does not resolve to a real judge. */
export const JUDGE_NOT_FOUND = "judge.notFound";
/** Raised when a judge-assignment id does not resolve on the given competition. */
export const JUDGE_ASSIGNMENT_NOT_FOUND = "judge.assignmentNotFound";
/** Raised when a judge is removed while assigned to an unfinished competition. */
export const JUDGE_HAS_ACTIVE_ASSIGNMENT = "judge.hasActiveAssignment";
/** Raised when a non-controller session touches judge management (ROL-002). */
export const JUDGE_FORBIDDEN = "judge.forbidden";

/** The judge row as the list screen shows it (credentials are never re-shown). */
export interface JudgeSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

/** What a successful judge creation returns: the judge plus its one-time credentials. */
export interface CreatedJudge extends JudgeSummary {
  username: string;
  password: string;
}

/** One judge's assignment on one competition. */
export interface JudgeAssignment {
  id: string;
  competitionId: string;
  judgeId: string;
  fromParticipantNumber: number;
  toParticipantNumber: number;
  assignedAt: string;
  assignedByAccountId: string | null;
}

export interface CreateJudgeInput {
  name: string;
}

export interface AssignJudgeRangeInput {
  judgeId: string;
  fromParticipantNumber: number;
  toParticipantNumber: number;
}

/** The unfinished competitions that block a judge's removal (ROL-010). */
export interface BlockingAssignment {
  competitionId: string;
  competitionName: string;
}
