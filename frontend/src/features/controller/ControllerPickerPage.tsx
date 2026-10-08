import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import {
  ControllerApiError,
  listCompetitions,
  type CompetitionSummaryView,
} from "./controllerApi";

/**
 * The dashboard's entry point (Unit 11, spec Detail 10). There is no global
 * competition-selection screen for players (ARCH-030) — the entry link carries the
 * competition — but the controller has to choose which event to drive, because one
 * installation runs several competitions across a day. This is that choice: a plain
 * list, newest first, each row opening the live dashboard.
 */
const POLL_INTERVAL_MS = 3000;

export function ControllerPickerPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  const [competitions, setCompetitions] = useState<CompetitionSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await listCompetitions();
      setCompetitions(result.competitions);
      setError(null);
    } catch (e) {
      setError(t("controller.loadError"));
      if (e instanceof ControllerApiError && e.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
      }
    }
  }, [navigate, t]);

  useEffect(() => {
    void refresh();
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [refresh]);

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 p-6 text-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("controller.pickTitle")}</h1>
          <p className="text-sm text-slate-600">{t("controller.pickSubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/controller/competition/new"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            {t("controller.pickCreate")}
          </Link>
          <Link
            to="/controller/judges"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            {t("controller.pickManageJudges")}
          </Link>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            onClick={() => void refresh()}
          >
            {t("controller.refresh")}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            onClick={() => void onLogout()}
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {!competitions && !error && (
        <p className="text-sm text-slate-600">{t("common.loading")}</p>
      )}

      {competitions && competitions.length === 0 && (
        <p className="text-sm text-slate-600">{t("controller.pickEmpty")}</p>
      )}

      {competitions && competitions.length > 0 && (
        <ul className="space-y-2">
          {competitions.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {t(`controller.status.${c.status}`)}
                </p>
              </div>
              <Link
                to={`/controller/competitions/${encodeURIComponent(c.id)}/live`}
                className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
              >
                {t("controller.pickOpen")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
