import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession, loadSession, type Role } from "./session";

/**
 * The per-role placeholder landing route (Unit 02). The real competition / player /
 * judge / controller screens do not exist until later units; this proves the login
 * reached the right role's home and offers a logout action that returns to the role
 * picker (the login page).
 */
export function RoleHomePage({ role }: { role: Role }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = loadSession();

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-800">
      <h1 className="text-2xl font-semibold">
        {t(`auth.landing.${role.toLowerCase()}`)}
      </h1>
      <p className="text-slate-600">{t("auth.landing.subtitle")}</p>
      {session && (
        <p className="text-xs text-slate-400">
          {t("auth.landing.signedInAs")} {session.accountId}
        </p>
      )}
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={onLogout}
      >
        {t("auth.logout")}
      </button>
    </main>
  );
}
