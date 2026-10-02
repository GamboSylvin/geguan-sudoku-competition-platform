/**
 * The domain rules of the Identity module and its public interface (Unit 02).
 * Other modules call this service, never the repository (invariant 4).
 *
 * What lives here: verifying a username/password, issuing a session that lasts a
 * fixed window from login (AUTH-001), enforcing one active device per account
 * (PAR-005), and resolving a session token back to the caller. Later units call
 * `authenticate` from their routes and WebSocket handlers; that is the boundary.
 */
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { now } from "../../shared/clock";
import { UnauthorizedError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import * as repository from "./identity.repository";
import {
  DEVICE_TAKEN_OVER,
  INVALID_CREDENTIALS,
  SESSION_INVALID,
  type AuthenticatedAccount,
  type DeviceInfo,
  type LoginInput,
  type LoginResult,
  type Role,
} from "./identity.types";

/** Cost factor for the adaptive hash. A normal engineering choice, not a decision. */
const BCRYPT_COST = 10;

/**
 * A fixed hash used only to keep the time of a rejected login close to an accepted
 * one, so response timing does not reveal whether the username exists.
 */
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", BCRYPT_COST);

function rejection(key: string, code: string): UnauthorizedError {
  // The message is the English catalogue text; the code is the i18n key so the
  // client can show the message in its own language (ARCH-026).
  return new UnauthorizedError(translate("en", key), { code });
}

function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

// ---------------------------------------------------------------------------
// Password and credential helpers (used here and by later units' seed/import)
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A short, human-typeable random password (BLD-003 / BLD-037). Uses an unambiguous
 * alphabet so it survives being printed on a credential slip.
 */
export function generatePassword(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * A system-generated username (BLD-037): a slug of the person's name (or a fallback
 * prefix) plus a short random suffix so two people never collide.
 */
export function generateUsername(base: string, fallbackPrefix = "user"): string {
  const slug = base
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const prefix = slug.length > 0 ? slug : fallbackPrefix;
  const suffix = randomBytes(3).toString("hex");
  return `${prefix}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  role: Role,
  input: LoginInput,
  device: DeviceInfo,
): Promise<LoginResult> {
  const account = await repository.findAccountByUsernameAndRole(
    input.username,
    role,
  );

  // Always run a compare so a missing account and a wrong password take a similar
  // time, then collapse every failure into one generic rejection (AUTH-002).
  const passwordMatches = await verifyPassword(
    input.password,
    account?.passwordHash ?? DUMMY_HASH,
  );

  if (!account || !account.isActive || !passwordMatches) {
    throw rejection(INVALID_CREDENTIALS, INVALID_CREDENTIALS);
  }

  const token = randomUUID();
  const deviceRow = await repository.createDevice({
    accountId: account.id,
    deviceLabel: device.deviceLabel,
    userAgent: device.userAgent,
  });

  // One active device per account: the newest login takes over (PAR-005).
  await repository.deactivateDevicesExcept(account.id, deviceRow.id);

  const sessionExpiresAt = new Date(
    now().getTime() + secondsToMs(env.SESSION_TTL_HOURS * 3600),
  );

  await repository.setSession({
    accountId: account.id,
    sessionToken: token,
    sessionExpiresAt,
    activeDeviceId: deviceRow.id,
    lastLoginAt: now(),
  });

  return {
    token,
    role,
    accountId: account.id,
    deviceId: deviceRow.id,
    sessionExpiresAt: sessionExpiresAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Session check (the auth middleware's backing function)
// ---------------------------------------------------------------------------

/**
 * Resolve a session token to the caller, or throw. Rejects when the token is
 * missing/unknown, when the account is deactivated, when the session is past its
 * expiry, or when the request comes from a device that is not the active one.
 */
export async function authenticate(
  token: string | null | undefined,
  deviceId: string | null | undefined,
): Promise<AuthenticatedAccount> {
  if (!token) {
    throw rejection(SESSION_INVALID, SESSION_INVALID);
  }

  const account = await repository.findSessionAccount(token);
  if (!account || !account.isActive) {
    throw rejection(SESSION_INVALID, SESSION_INVALID);
  }

  if (
    account.sessionExpiresAt &&
    account.sessionExpiresAt.getTime() <= now().getTime()
  ) {
    throw rejection(SESSION_INVALID, SESSION_INVALID);
  }

  // The newest login owns the account; any other device is rejected (PAR-005).
  if (!deviceId || deviceId !== account.activeDeviceId) {
    throw rejection(DEVICE_TAKEN_OVER, DEVICE_TAKEN_OVER);
  }

  const resolvedDeviceId = deviceId;
  await repository.touchDevice(resolvedDeviceId).catch(() => undefined);

  return {
    accountId: account.id,
    role: account.role,
    deviceId: resolvedDeviceId,
    participantId: account.participantId,
    judgeId: account.judgeId,
  };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/** End the session. The Device row stays, so the next login has something to replace. */
export async function logout(token: string | null | undefined): Promise<void> {
  const account = token ? await repository.findSessionAccount(token) : null;
  if (!account) {
    throw rejection(SESSION_INVALID, SESSION_INVALID);
  }
  await repository.clearSession(account.id);
}

export const identityService = {
  login,
  authenticate,
  logout,
  hashPassword,
  verifyPassword,
  generatePassword,
  generateUsername,
};
