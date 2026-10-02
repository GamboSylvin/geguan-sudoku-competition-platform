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
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Log in through the role's own endpoint. Throws on any rejection. */
export async function login(
  role: RoleSlug,
  username: string,
  password: string,
): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/api/auth/${role}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("invalidCredentials");
  }
  const session = (await response.json()) as Session;
  saveSession(session);
  return session;
}

/** End the session on the server, then clear it locally. */
export async function logout(): Promise<void> {
  const session = loadSession();
  if (session) {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "x-session-token": session.token },
    }).catch(() => undefined);
  }
  clearSession();
}

/** The landing route a role goes to after login. */
export function landingPath(role: Role): string {
  return `/${ROLE_SLUGS[role]}`;
}
