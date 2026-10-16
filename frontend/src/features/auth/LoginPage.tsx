import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { login, landingPath, type RoleSlug } from "./session";

/**
 * The login page (Unit 02, frontend `auth` feature, decided flow ARCH-030).
 *
 * A single page: an explicit role picker (player, judge, controller); picking a role
 * reveals that role's username/password fields. No competition-selection screen —
 * the competition link identifies the competition (a later unit passes it through).
 * On success it stores the session and redirects to the role's placeholder landing
 * route; on failure it shows one generic rejection (AUTH-002).
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
  const [role, setRole] = useState<RoleSlug | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!role) return;
    setError(null);
    setBusy(true);
    try {
      const session = await login(role, username, password);
      navigate(landingPath(session.role));
    } catch {
      // One generic message, never saying which part was wrong (AUTH-002).
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
