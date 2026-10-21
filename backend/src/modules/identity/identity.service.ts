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
import { logger } from "../../infra";
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

// ---------------------------------------------------------------------------
// Player presence (F2/F3, 2026-10-21)
// ---------------------------------------------------------------------------

/**
 * A player logged in or out. The judge screen is told immediately, instead of finding
 * out at its next three-second poll.
 *
 * One hook, installed by the gateway at startup, exactly like `round.service.ts`'s
 * `installRoundStartedHook` — so this module keeps importing nothing from realtime
 * (invariant 4, and no cycle: the gateway already imports `identityService` to
 * authenticate its handshakes).
 *
 * It is about **players** only. A judge or a controller account has no `Participant`
 * row, so there is no student to announce, and their logins are not interesting to
 * anyone on the supervision panel.
 */
export interface PlayerPresenceFact {
  participantId: string;
  competitionId: string;
  kind: "CONNECTED" | "DISCONNECTED";
}

type PresenceHook = (fact: PlayerPresenceFact) => void | Promise<void>;
let presenceHook: PresenceHook | null = null;

export function installPresenceHook(hook: PresenceHook): void {
  presenceHook = hook;
}

/** Announce a presence change, and never let a dead socket break a login or a logout. */
async function announcePresence(fact: PlayerPresenceFact): Promise<void> {
  if (presenceHook === null) return;
  try {
    await presenceHook(fact);
  } catch (error) {
    logger.warn("identity: presence hook failed", {
      participantId: fact.participantId,
      kind: fact.kind,
      error,
    });
  }
}

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

  // An account arriving through `/enter?token=…` names its competition with the token
  // (ARCH-030). The credentials still decide *who* is logging in — the token decides
  // *which competition*, and the two must agree: a player of competition A cannot use
  // competition B's link, and neither can a judge who was never assigned to it. The
  // mismatch is folded into the same generic rejection so the response never reveals
  // which half was wrong (AUTH-002).
  //
  // One token now serves both roles (hole D, 2026-10-20): `Competition.entryLinkToken`
  // is per competition, so the link printed once at publish is the one a student and the
  // one a judge both open, and the role is picked on the login screen. A judge may
  // belong to several competitions, so this is membership of a set, not an equality. A
  // CONTROLLER is deliberately exempt: they are not scoped to one competition at all
  // (ROL-004), so a token sent by one is ignored rather than turned into a rejection.
  const scopedRole = role === "PLAYER" || role === "JUDGE";
  let scopedCompetitionId: string | null = null;
  if (scopedRole && input.entryLinkToken !== undefined && input.entryLinkToken !== "") {
    const linkedCompetitionId = await repository.findCompetitionIdByEntryLinkToken(
      input.entryLinkToken,
    );
    const accountCompetitionIds = await repository.findAccountCompetitionIds(account.id);
    if (linkedCompetitionId === null || !accountCompetitionIds.includes(linkedCompetitionId)) {
      throw rejection(INVALID_CREDENTIALS, INVALID_CREDENTIALS);
    }
    // Keep the answer for the whole session (F1, 2026-10-21). The check above proves
    // this account belongs to that competition; the link is the only thing that says
    // *which* of them this session is about. Throwing it away is what made a judge
    // assigned to five competitions see all five, whichever link they came through.
    scopedCompetitionId = linkedCompetitionId;
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

  // Written after the session row exists, with the session's own lifetime, so a scope
  // can never outlive the token it belongs to. A re-login through a different link
  // issues a different token and therefore its own scope — the old one expires with
  // the old session rather than being inherited.
  if (scopedCompetitionId !== null) {
    await repository
      .setSessionScope(token, scopedCompetitionId, env.SESSION_TTL_HOURS * 3600)
      .catch(() => undefined);
  }

  // F2/F3: the judge screen learns about this player right now. Read from the account's
  // own participant row rather than from the entry link, so a login that came through no
  // link still announces — and so the competition named is the one the participant
  // belongs to, not whichever token happened to be in the URL.
  const presenceTarget = await repository
    .findPlayerPresenceTarget(account.id)
    .catch(() => null);
  if (presenceTarget !== null) {
    await announcePresence({ ...presenceTarget, kind: "CONNECTED" });
  }

  return {
    token,
    role,
    accountId: account.id,
    deviceId: deviceRow.id,
    sessionExpiresAt: sessionExpiresAt.toISOString(),
    competitionId: scopedCompetitionId,
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

  // Read the scope server-side, keyed by this very token, so a caller cannot widen its
  // own view by naming another competition. A Redis miss degrades to null, which is the
  // pre-F1 behaviour (see every assignment) rather than a locked-out judge.
  const competitionId = await repository.getSessionScope(token).catch(() => null);

  return {
    accountId: account.id,
    role: account.role,
    deviceId: resolvedDeviceId,
    participantId: account.participantId,
    categoryId: account.categoryId,
    judgeId: account.judgeId,
    competitionId,
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
  // Drop the scope with the session, so a token that no longer authenticates also
  // names no competition. Best-effort: the TTL would expire it anyway.
  if (token) await repository.clearSessionScope(token).catch(() => undefined);

  // F2/F3: the mirror of login's announcement. This is what makes the judge's
  // `connected` column stop lying in the other direction — a student who left the room
  // is no longer shown as present until somebody happens to notice.
  const presenceTarget = account.participantId
    ? await repository.findPlayerPresenceTarget(account.id).catch(() => null)
    : null;
  if (presenceTarget !== null) {
    await announcePresence({ ...presenceTarget, kind: "DISCONNECTED" });
  }
}

/**
 * GET /api/auth/entry-link/:token — the public name of the competition a link leads to.
 *
 * Hole D (2026-10-20): one link now serves students and judges, so the login screen has
 * to say *which* event it is opening before anybody has signed in. That is the only thing
 * this answers. It is public by design and deliberately narrow — a token no competition
 * carries returns null, and the caller answers 404, so this route cannot be used to probe
 * anything but names.
 */
export async function entryLinkCompetitionName(
  entryLinkToken: string,
): Promise<string | null> {
  return repository.findCompetitionNameByEntryLinkToken(entryLinkToken);
}

export const identityService = {
  login,
  authenticate,
  logout,
  hashPassword,
  verifyPassword,
  generatePassword,
  generateUsername,
  entryLinkCompetitionName,
  installPresenceHook,
  findParticipantPresence: repository.findParticipantPresence,
};
