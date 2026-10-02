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
 * route; on failure it shows one generic rejection (AUTH-002). The visual design is
 * deliberately deferred (U-66): this is a functional, minimally-styled form.
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-slate-800">
      <h1 className="text-2xl font-semibold">{t("auth.title")}</h1>

      <div className="flex gap-2" role="group" aria-label={t("auth.chooseRole")}>
        {ROLES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={role === candidate}
            className={`rounded-md border px-4 py-2 text-sm ${
              role === candidate
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 bg-white hover:bg-slate-100"
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
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={onSubmit}
          aria-label={t(`auth.role.${role}`)}
        >
          <label className="flex flex-col gap-1 text-sm">
            {t("auth.username")}
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("auth.password")}
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          >
            {t("auth.submit")}
          </button>
        </form>
      )}
    </main>
  );
}
