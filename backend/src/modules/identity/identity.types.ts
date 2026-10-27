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
  /**
   * The competition's entry-link token, supplied by a player who arrived through
   * `/player?token=…` (ARCH-030: the competition link *identifies the competition* —
   * there is no competition-selection screen). Optional and only meaningful for a
   * `PLAYER` login: it scopes the login to that competition, it does not replace the
   * username and password.
   *
   * Deliberately not a credential on its own. Whether a bare token should be enough to
   * get in is an open project-owner decision (report §9d scope note / Annex B item 8:
   * a token in a query string is copyable and can leak through browser history and server
   * logs). Until that is decided, the printed credentials are still required, which is
   * also the safest reading — and it makes a wrong or foreign token a rejection rather
   * than a way into someone else's competition.
   */
  entryLinkToken?: string;
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
  /**
   * The competition the entry link named, when the login came through one (ARCH-030;
   * F1, 2026-10-21). Null for a controller — never scoped to one competition
   * (ROL-004) — and for a login with no link. The client may display it; it is never
   * what authorizes anything, because the server holds the same value against the
   * session token and re-checks the assignment on every scoped request.
   */
  competitionId: string | null;
}

/** The authenticated caller resolved from a session token by the auth middleware. */
export interface AuthenticatedAccount {
  accountId: string;
  role: Role;
  /** The account's current device row, for the one-active-device check. */
  deviceId: string;
  participantId: string | null;
  /**
   * The participant's category, when the caller is a player. Resolved at
   * authenticate time (the same place `participantId` is) so the realtime gateway can
   * join the socket to a category-scoped room without a second lookup — a round's
   * questions are per-category, and the round-started push is routed to each
   * category's room so no player ever receives another category's content. Null for
   * a judge or controller (they have no `participantId`).
   */
  categoryId: string | null;
  judgeId: string | null;
  /**
   * The competition this session entered through, or null when it did not come from an
   * entry link. Read server-side from the session's own scope, never from the client,
   * so a caller cannot widen its own view by naming another competition. The judge
   * routes use it to answer with one assignment instead of all of them (F1), and the
   * gateway uses it to join the judge's socket to that competition's room (F3).
   */
  competitionId: string | null;
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

/**
 * What reactivating a judge returns (report §4a): the judge back in its summary shape
 * plus the username its account already carries. The password is deliberately absent —
 * it was shown once at creation and is never re-shown, so the screen reminds the
 * controller of the username only.
 */
export interface ReactivatedJudge extends JudgeSummary {
  username: string | null;
}

/**
 * One row of the competition's range list (report §4c) — the controller-side read of
 * who supervises which slice of which competition. Carries the judge's display name and
 * the username of whoever recorded the range, so the panel does not have to join
 * anything itself.
 */
export interface CompetitionJudgeAssignmentView extends JudgeAssignment {
  judgeName: string;
  judgeActive: boolean;
  assignedByUsername: string | null;
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

/**
 * What a permanent deletion destroyed (2026-10-26). One row per range the judge held,
 * with its competition's name, so the screen can report exactly what went instead of
 * answering a bare 204 to an operation that is not reversible.
 */
export interface DestroyedJudge {
  id: string;
  name: string;
  competitions: {
    competitionId: string;
    competitionName: string;
    fromParticipantNumber: number;
    toParticipantNumber: number;
  }[];
  assignmentsDeleted: number;
  accountsDeleted: number;
}
