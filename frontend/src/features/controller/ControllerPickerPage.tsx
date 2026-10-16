import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { CompetitionApiError, copyCompetition, deleteCompetition } from "../competition/competitionApi";
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
 *
 * BLD-050 adds the third row action: a permanent delete. The server accepts it at any
 * status and destroys everything, so the guard lives here — a dialog that names each
 * category of data being lost and refuses to arm its button until the competition's
 * own name is retyped exactly.
 */
const POLL_INTERVAL_MS = 3000;

export function ControllerPickerPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  const [competitions, setCompetitions] = useState<CompetitionSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The competition being copied, so its button can disable and show progress. */
  const [copyingId, setCopyingId] = useState<string | null>(null);
  /**
   * The competition the hard-delete dialog is open for (BLD-050). The dialog is the
   * only guard: the delete is permanent and available at any status, so it names every
   * category of data being destroyed and stays disabled until the controller retypes
   * the competition's own name. `null` closes it.
   */
  const [deleting, setDeleting] = useState<CompetitionSummaryView | null>(null);
  /** What the controller has typed into the delete confirmation field. */
  const [typedName, setTypedName] = useState("");
  /** True while the DELETE request is in flight, so it can't be sent twice. */
  const [deleteInFlight, setDeleteInFlight] = useState(false);

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

  /** Open the hard-delete dialog for one competition, with a fresh, empty typed name. */
  function openDeleteDialog(competition: CompetitionSummaryView): void {
    setDeleting(competition);
    setTypedName("");
    setError(null);
  }

  function closeDeleteDialog(): void {
    if (deleteInFlight) return;
    setDeleting(null);
    setTypedName("");
  }

  /**
   * Send the DELETE and, on success, re-read the list so the row disappears. The
   * caller stays on this page — there is nothing left to navigate to once the
   * competition itself no longer exists.
   */
  async function onDelete(): Promise<void> {
    if (!deleting || deleteInFlight) return;
    // Exact match after trimming; case matters. Deliberately unforgiving — this is
    // the last thing standing between a click and permanent data loss.
    if (typedName.trim() !== deleting.name) return;

    const id = deleting.id;
    setDeleteInFlight(true);
    try {
      await deleteCompetition(id);
      setDeleting(null);
      setTypedName("");
      await refresh();
    } catch (e) {
      setError(t("controller.deleteFailed"));
      const expired =
        (e instanceof CompetitionApiError || e instanceof ControllerApiError) &&
        e.status === 401;
      if (expired) {
        clearSession();
        navigate("/login", { replace: true });
      }
    } finally {
      setDeleteInFlight(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 p-4 text-gray-900 sm:p-6">
      {/* Mood B header banner: indigo→purple gradient (§3.2/2 of the report).
          The buttons that live in it are the "glass" buttons of §3.6. */}
      <div className="mb-4 -mx-4 -mt-4 flex flex-col gap-3 bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-4 text-white shadow-lg sm:-mx-6 sm:-mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">{t("controller.pickTitle")}</h1>
          <p className="text-xs text-purple-200 sm:text-sm">{t("controller.pickSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/controller/competition/new"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
          >
            {t("controller.pickCreate")}
          </Link>
          <Link
            to="/controller/judges"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
          >
            {t("controller.pickManageJudges")}
          </Link>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
            onClick={() => void refresh()}
          >
            {t("controller.refresh")}
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
            onClick={() => void onLogout()}
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      {!competitions && !error && (
        <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
      )}

      {competitions && competitions.length === 0 && (
        <p className="py-20 text-center text-xs text-gray-500 sm:text-sm">{t("controller.pickEmpty")}</p>
      )}

      {competitions && competitions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {competitions.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow transition-colors hover:border-gray-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t(`controller.status.${c.status}`)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/setup`}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                >
                  {t("controller.pickSetup")}
                </Link>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/school-ranking`}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                >
                  {t("controller.pickSchoolRanking")}
                </Link>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  disabled={copyingId !== null}
                  onClick={() => void onCopy(c.id)}
                >
                  {copyingId === c.id ? t("controller.copying") : t("controller.pickCopy")}
                </button>
                <button
                  type="button"
                  className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  disabled={deleting !== null}
                  onClick={() => openDeleteDialog(c)}
                >
                  {t("controller.pickDelete")}
                </button>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/results`}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                >
                  {t("controller.pickResults")}
                </Link>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(c.id)}/live`}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 sm:text-sm"
                >
                  {t("controller.pickOpen")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-competition-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDeleteDialog}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-competition-title" className="mb-4 text-lg font-semibold text-red-700">
              {t("controller.deleteTitle")}
            </h2>
            <p className="mb-2 text-xs text-gray-800 sm:text-sm">{t("controller.deleteWarning")}</p>
            <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-gray-700 sm:text-sm">
              <li>{t("controller.deleteListStructure")}</li>
              <li>{t("controller.deleteListQuestions")}</li>
              <li>{t("controller.deleteListJudges")}</li>
              <li>{t("controller.deleteListPeople")}</li>
              <li>{t("controller.deleteListAccounts")}</li>
              <li>{t("controller.deleteListResults")}</li>
              <li>{t("controller.deleteListFiles")}</li>
            </ul>
            <p className="mb-1 text-xs text-gray-700 sm:text-sm">
              {t("controller.deleteTypeHint")}{" "}
              <span className="font-semibold text-gray-900">{deleting.name}</span>
            </p>
            <label className="mb-1 block text-xs font-medium text-gray-600 sm:text-sm" htmlFor="delete-name-input">
              {t("controller.deleteTypeLabel")}
            </label>
            <input
              id="delete-name-input"
              className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={typedName}
              disabled={deleteInFlight}
              onChange={(e) => setTypedName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-4 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                onClick={closeDeleteDialog}
                disabled={deleteInFlight}
              >
                {t("controller.deleteCancel")}
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                disabled={deleteInFlight || typedName.trim() !== deleting.name}
                onClick={() => void onDelete()}
              >
                {deleteInFlight ? t("controller.deleting") : t("controller.deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
