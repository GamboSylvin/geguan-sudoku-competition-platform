import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { CompetitionApiError, copyCompetition } from "../competition/competitionApi";
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
 *
 * Unit 15 adds two row actions: the school leaderboard, and "copy this competition".
 * The copy is server-side deep (categories, round settings, scoring configuration,
 * question sets/questions, judge assignments — and nothing else), so the row lands
 * on the new competition's setup screen, where it still has to be published again
 * after a fresh participant import.
 */
const POLL_INTERVAL_MS = 3000;

export function ControllerPickerPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  const [competitions, setCompetitions] = useState<CompetitionSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The competition being copied, so its button can disable and show progress. */
  const [copyingId, setCopyingId] = useState<string | null>(null);

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

  /**
   * Copy a competition and open the copy's setup screen. The copy is unpublished
   * (`CREATED`) by design, so the setup screen is where it has to go next.
   */
  async function onCopy(competitionId: string): Promise<void> {
    if (copyingId) return;
    setCopyingId(competitionId);
    setError(null);
    try {
      const copy = await copyCompetition(competitionId);
      navigate(`/controller/competitions/${encodeURIComponent(copy.id)}/setup`);
    } catch (e) {
      setError(t("controller.copyFailed"));
      const expired =
        (e instanceof CompetitionApiError || e instanceof ControllerApiError) &&
        e.status === 401;
      if (expired) {
        clearSession();
        navigate("/login", { replace: true });
      }
    } finally {
      setCopyingId(null);
    }
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
              <div className="flex gap-2">
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/setup`}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                >
                  {t("controller.pickSetup")}
                </Link>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/school-ranking`}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                >
                  {t("controller.pickSchoolRanking")}
                </Link>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
                  disabled={copyingId !== null}
                  onClick={() => void onCopy(c.id)}
                >
                  {copyingId === c.id ? t("controller.copying") : t("controller.pickCopy")}
                </button>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/results`}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                >
                  {t("controller.pickResults")}
                </Link>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/live`}
                  className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
                >
                  {t("controller.pickOpen")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
