import { API_BASE_URL } from "@/config/env";

/**
 * Session storage and the auth API calls (Unit 02, frontend `auth` feature).
 *
 * The session is held in `localStorage` so closing and reopening the browser keeps
 * the account logged in for the fixed window (AUTH-001). The client is never trusted
 * for its own identity: it only stores the server-issued token and sends it back
 * (code-standards, "the client is never trusted").
 */
export type Role = "PLAYER" | "JUDGE" | "CONTROLLER";
export type RoleSlug = "player" | "judge" | "controller";

export interface Session {
  token: string;
  deviceId: string;
  role: Role;
  accountId: string;
  sessionExpiresAt: string;
  /**
   * The competition the entry link named, when the login came through one (ARCH-030,
   * F1). Null for a controller and for a plain login. Displayed only: the server holds
   * the same value against the token and re-checks it on every scoped request, so this
   * field never authorizes anything.
   */
  competitionId: string | null;
}

const STORAGE_KEY = "sudoku.session";

export const ROLE_SLUGS: Record<Role, RoleSlug> = {
  PLAYER: "player",
  JUDGE: "judge",
  CONTROLLER: "controller",
};

export function loadSession(): Session | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.token || !parsed.deviceId) return null;
    // A session stored before `competitionId` existed has the field missing, not null.
    // Normalizing it here means no caller has to guard against `undefined`.
    return { ...parsed, competitionId: parsed.competitionId ?? null };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/** Ask the server to end the session. Resolves on a successful call, or never rejects. */
async function endSessionOnServer(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { "x-session-token": token },
  }).catch(() => undefined);
}

/**
 * Drop the session — locally **and** on the server.
 *
 * It used to remove the `localStorage` key and nothing else, so `POST /api/auth/logout`
 * was never called from any of the fifteen logout actions in the app (F2, 2026-10-21).
 * The consequence is not cosmetic: the server kept `Account.activeDeviceId` set and the
 * device row active forever, and that pair is exactly what the judge's `connected`
 * column reads. A player who logged in once and closed the tab therefore stayed
 * "connected" for days, and the judge's panel was permanent noise in which the one
 * player who really was there could not be seen.
 *
 * The request is fired, not awaited: every caller navigates away in the same tick, and
 * nobody should be held on a screen because the network was slow. The key is removed
 * first, so a failed request can never leave the browser holding a session the server
 * has already dropped.
 */
export function clearSession(): void {
  const session = loadSession();
  window.localStorage.removeItem(STORAGE_KEY);
  if (session) void endSessionOnServer(session.token);
}

/**
 * Log in through the role's own endpoint. Throws on any rejection.
 *
 * `entryLinkToken` is sent for **any** role that the server scopes to a competition —
 * a player or a judge (hole D, 2026-10-20). The caller decides whether it has one;
 * this function only carries it. A controller's login ignores it server-side (ROL-004).
 */
export async function login(
  role: RoleSlug,
  username: string,
  password: string,
  entryLinkToken?: string,
): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/api/auth/${role}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      entryLinkToken && entryLinkToken !== ""
        ? { username, password, entryLinkToken }
        : { username, password },
    ),
  });
  if (!response.ok) {
    throw new Error("invalidCredentials");
  }
  const session = (await response.json()) as Session;
  saveSession(session);
  return session;
}

/**
 * End the session on the server, then clear it locally. The awaited twin of
 * `clearSession`, for a caller that wants to be sure the server has dropped the
 * session before it moves on; every screen currently uses the synchronous one.
 */
export async function logout(): Promise<void> {
  const session = loadSession();
  if (session) await endSessionOnServer(session.token);
  window.localStorage.removeItem(STORAGE_KEY);
}

/** The landing route a role goes to after login. */
export function landingPath(role: Role): string {
  return `/${ROLE_SLUGS[role]}`;
}

// ---------------------------------------------------------------------------
// The entry-link token carried across the login redirect (report §9c, ARCH-030)
// ---------------------------------------------------------------------------

const ENTRY_TOKEN_KEY = "sudoku.entryToken";

/**
 * Remember the competition an entry link named, so it survives the hop from `/player`
 * to `/login`. Held in `sessionStorage` — per tab, gone when the tab closes, and never
 * in the URL, so the token is not written into the browser history a second time.
 */
export function setEntryToken(token: string): void {
  window.sessionStorage.setItem(ENTRY_TOKEN_KEY, token);
}

/** Read and clear the remembered entry token: it is consumed by exactly one login. */
export function takeEntryToken(): string | null {
  const token = window.sessionStorage.getItem(ENTRY_TOKEN_KEY);
  if (token === null) return null;
  window.sessionStorage.removeItem(ENTRY_TOKEN_KEY);
  return token === "" ? null : token;
}

/** The token as carried through the redirect, without consuming it (used to display). */
export function peekEntryToken(): string | null {
  const token = window.sessionStorage.getItem(ENTRY_TOKEN_KEY);
  return token === null || token === "" ? null : token;
}

// ---------------------------------------------------------------------------
// The role hint on the login page (hole D, 2026-10-20)
// ---------------------------------------------------------------------------

const ENTRY_ROLE_HINT_KEY = "sudoku.entryRoleHint";

/**
 * Which role the login page should preselect, if any. The **unified** `/enter` link
 * serves both students and judges, so it sets no hint and the picker shows the choice.
 * A player-only path (`/player?token=…`) sets `"player"`, saving a tablet one tap.
 * Held in `sessionStorage` for the same reasons as the token: per tab, never in the URL.
 */
export function setEntryRoleHint(role: RoleSlug): void {
  window.sessionStorage.setItem(ENTRY_ROLE_HINT_KEY, role);
}

/** The remembered role hint, or null when the login page should show the full picker. */
export function peekEntryRoleHint(): RoleSlug | null {
  const hint = window.sessionStorage.getItem(ENTRY_ROLE_HINT_KEY);
  return hint === "player" || hint === "judge" || hint === "controller" ? hint : null;
}

/** Clear the role hint. Called by the unified entry link and once a login succeeds. */
export function clearEntryRoleHint(): void {
  window.sessionStorage.removeItem(ENTRY_ROLE_HINT_KEY);
}
