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
