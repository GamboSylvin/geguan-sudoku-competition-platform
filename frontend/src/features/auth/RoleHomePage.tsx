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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      {/* Light card of mood B: bg-white rounded-xl shadow (§3.5 of the report) */}
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl bg-white p-6 shadow sm:p-8">
        <h1 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">
          {t(`auth.landing.${role.toLowerCase()}`)}
        </h1>
        <p className="text-center text-xs text-gray-700 sm:text-sm">
          {t("auth.landing.subtitle")}
        </p>
        {session && (
          <p className="text-xs text-gray-400">
            {t("auth.landing.signedInAs")} {session.accountId}
          </p>
        )}
        <button
          type="button"
          className="rounded border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
          onClick={onLogout}
        >
          {t("auth.logout")}
        </button>
      </div>
    </main>
  );
}
