import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { StudentsSupervisionPanel } from "./StudentsSupervisionPanel";

/**
 * The judge's supervision dashboard (Unit 10). The table, its polling and the
 * restart confirmation live in `StudentsSupervisionPanel`, which Unit 11 reuses on
 * the controller's live-command dashboard (judge-equivalent student-status access,
 * spec Detail 6). This page adds only what is the judge's own: the page header and
 * the logout action.
 */
export function JudgeDashboardPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 p-6 text-slate-800">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          onClick={onLogout}
        >
          {t("auth.logout")}
        </button>
      </div>
      <StudentsSupervisionPanel showHeader />
    </main>
  );
}
