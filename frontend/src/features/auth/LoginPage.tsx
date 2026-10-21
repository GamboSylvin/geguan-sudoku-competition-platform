import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { API_BASE_URL } from "@/config/env";
import {
  login,
  landingPath,
  peekEntryRoleHint,
  peekEntryToken,
  takeEntryToken,
  clearEntryRoleHint,
  type RoleSlug,
} from "./session";

/**
 * The login page (Unit 02, frontend `auth` feature, decided flow ARCH-030).
 *
 * A single page: an explicit role picker (player, judge, controller); picking a role
 * reveals that role's username/password fields. No competition-selection screen —
 * the competition link identifies the competition (a later unit passes it through).
 * On success it stores the session and redirects to the role's placeholder landing
 * route; on failure it shows one generic rejection (AUTH-002).
 *
 * **The token is passed through** (report §9c, extended by hole D 2026-10-20): an account
 * that opened `/enter?token=…` — the one link a competition prints, for students **and**
 * judges — has that token remembered in `sessionStorage`, and the login sends it along so
 * the server can check the credentials belong to *that* competition. The competition's own
 * name is then displayed above the picker, so the page is personalised by the link rather
 * than anonymous. Which role is preselected comes from the path that brought the visitor:
 * `/player?token=…` says player, `/enter?token=…` says nothing and the full picker shows.
 * The token never reappears in the URL.
 *
 * Visual: mood A, "glass over gradient" (BLD-054, revising UI-008/U-66).
 * `backdrop-blur-lg` is reserved to this mood and must not appear on a B or C
 * screen. Recipe: RAPPORT-CSS-sudoku_arena.md §4.A, mapping in
 * context/ui-context.md, "Visual design system".
 */
const ROLES: readonly RoleSlug[] = ["player", "judge", "controller"];

export function LoginPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  /** Read once: whether an entry link brought the visitor here. */
  const [entryToken] = useState<string | null>(() => peekEntryToken());
  /** Read once too: only a role-specific link preselects, the unified one does not. */
  const [roleHint] = useState<RoleSlug | null>(() => peekEntryRoleHint());
  const [role, setRole] = useState<RoleSlug | null>(roleHint);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The competition the link named, so this screen says which event is being entered.
   * Null means "no link" or "the server would not say" — both render as the ordinary
   * anonymous login, never as an error, because signing in without a link is normal.
   */
  const [competitionName, setCompetitionName] = useState<string | null>(null);

  /**
   * Preselect the hinted role when one is in play. Kept in an effect rather than only in
   * the initial state so a hint remembered *after* this page mounted (the redirect and the
   * storage write race) still selects it.
   */
  useEffect(() => {
    if (roleHint !== null) {
      setRole(roleHint);
    }
  }, [roleHint]);

  /**
   * Ask the server what the link points at. Public and name-only by design: the token is
   * already in everybody's hands (it is printed and read out in the room), so the only
   * thing this reveals is the event's own name — nothing about participants, judges,
   * questions or scores. A token nobody carries answers 404 and the name stays null.
   */
  useEffect(() => {
    if (entryToken === null) return;
    let cancelled = false;
    fetch(
      `${API_BASE_URL}/api/auth/entry-link/${encodeURIComponent(entryToken)}`,
    )
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((body: { competitionName?: string } | null) => {
        if (!cancelled && body?.competitionName) setCompetitionName(body.competitionName);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [entryToken]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!role) return;
    setError(null);
    setBusy(true);
    try {
      // Sent for a player and for a judge — the two roles the server scopes to one
      // competition (hole D, 2026-10-20). A controller has no single competition to
      // name, so nothing is sent and the server ignores it anyway (ROL-004).
      const scoped = role === "player" || role === "judge";
      // Consumed only on the attempt that succeeds: a rejected login keeps the token so
      // the person can correct their password without re-scanning the link.
      const token = scoped ? (entryToken ?? peekEntryToken()) : null;
      const session = await login(role, username, password, token ?? undefined);
      if (token !== null) takeEntryToken();
      clearEntryRoleHint();
      navigate(landingPath(session.role));
    } catch {
      // One generic message, never saying which part was wrong (AUTH-002). A token that
      // names another competition is rejected the same way.
      setError(t("auth.invalidCredentials"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg sm:p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-white sm:text-3xl">
          {t("auth.title")}
        </h1>

        {/* Hole D (2026-10-20). When the visitor arrived through a competition's own entry
            link, say which competition that is — the one thing a token-holder needs to know
            before typing a password. Absent without a link, and absent when the server would
            not name the token; both render as the ordinary anonymous login, never as an
            error, because signing in with no link is a normal way to arrive. */}
        {competitionName && (
          <p className="mb-3 text-center text-sm font-medium text-purple-100 sm:text-base">
            {t("auth.welcomeTo", { name: competitionName })}
          </p>
        )}

        <div
          className="flex justify-center gap-2"
          role="group"
          aria-label={t("auth.chooseRole")}
        >
          {ROLES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={role === candidate}
              className={`rounded-lg px-3 py-2 text-xs transition-colors sm:px-4 sm:text-sm ${
                role === candidate
                  ? "bg-purple-600 font-semibold text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              onClick={() => {
                setRole(candidate);
                setError(null);
              }}
            >
              {t(`auth.role.${candidate}`)}
            </button>
          ))}
        </div>

        {role && (
          <form
            className="mt-6 flex w-full flex-col gap-3"
            onSubmit={onSubmit}
            aria-label={t(`auth.role.${role}`)}
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-purple-100 sm:text-sm">
              {t("auth.username")}
              <input
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-purple-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 sm:text-base"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-purple-100 sm:text-sm">
              {t("auth.password")}
              <input
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-purple-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 sm:text-base"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <p role="alert" className="text-center text-xs text-red-300 sm:text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {t("auth.submit")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
