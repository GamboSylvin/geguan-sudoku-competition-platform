import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import {
  blockingCompetitionsFrom,
  createJudge,
  destroyJudge,
  listJudgeAssignmentsForController,
  listJudges,
  reactivateJudge,
  removeJudge,
  type CreatedJudgeView,
  type JudgeAssignmentWithNameView,
  type JudgeSummaryView,
} from "./judgeApi";

/**
 * The controller's judge-management screen (Unit 06): create a judge, see the
 * one-time credentials for the slip export, list every judge, deactivate a judge (with
 * the ROL-010 guard naming the blocking competition) and reactivate one by mistake
 * deactivated (report §4a).
 *
 * §4a: deactivation never deleted a row, yet the button read "Remove" — it announced a
 * destruction that did not happen, and left a deactivated judge with no action at all.
 * The label now says what the server does, and both directions are offered.
 *
 * 2026-10-26, two additions from a real test:
 *
 * - A **permanent** Delete, next to Deactivate and not a replacement for it. The server
 *   takes it at any time and destroys the judge row, its accounts and every range it
 *   holds, so the guard moves here: the dialog names each category of data being lost and
 *   lists every competition the judge is assigned to before the button is armed. Mirrors
 *   BLD-050's competition delete, minus the retyped-name field — a judge row is small
 *   enough that listing what goes is the warning, and the row action is not one click away
 *   from a mistake the way a whole competition's is.
 *
 * - List usability. Hundreds of leftover rows made the list unusable ("there wasn't even a
 *   search menu on it"). Search by name, a three-position status filter defaulting to
 *   Active, a visible count, and paging at 50 rows — all client-side over the one existing
 *   `GET /api/judges`, because the list is small enough that a server-side query would only
 *   add a round trip. No new dependency.
 *
 * Visual: mood B, "light, sober, white cards" (BLD-054, revising U-66).
 * Recipe: RAPPORT-CSS-sudoku_arena.md §4.B, mapping in context/ui-context.md,
 * "Visual design system".
 */

/** Rows shown per page of the judge list. */
const PAGE_SIZE = 50;

type StatusFilter = "active" | "inactive" | "all";

export function JudgeManagementPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  const [judges, setJudges] = useState<JudgeSummaryView[] | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedJudgeView | null>(null);
  const [reactivated, setReactivated] = useState<{ name: string; username: string | null } | null>(
    null,
  );
  const [destroyedName, setDestroyedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  /** The list-usability controls (2026-10-26). `Active` is the default: that is what a controller looks for. */
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(0);

  /**
   * The judge the permanent-delete dialog is open for. `null` closes it. The ranges are
   * fetched when the dialog opens rather than carried on the row, so the warning names the
   * live state of the assignments instead of whatever the list happened to hold.
   */
  const [deleting, setDeleting] = useState<JudgeSummaryView | null>(null);
  const [dialogRanges, setDialogRanges] = useState<JudgeAssignmentWithNameView[] | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listJudges()
      .then((result) => {
        if (!cancelled) setJudges(result.judges);
      })
      .catch(() => {
        if (!cancelled) setError(t("judge.genericError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function refresh(): Promise<void> {
    try {
      const result = await listJudges();
      setJudges(result.judges);
    } catch {
      setError(t("judge.genericError"));
    }
  }

  /** The rows the search box and the status filter leave standing, in list order. */
  const filtered = useMemo(() => {
    if (!judges) return [];
    const needle = query.trim().toLowerCase();
    return judges.filter((judge) => {
      if (filter === "active" && !judge.active) return false;
      if (filter === "inactive" && judge.active) return false;
      if (needle && !judge.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [judges, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  /** Deleting the last row of the last page must not leave the list on a page that no longer exists. */
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBlockedBy(null);
    setReactivated(null);
    setDestroyedName(null);
    setBusy(true);
    try {
      const judge = await createJudge({ name: name.trim() });
      setCreated(judge);
      setName("");
      // A new judge is active, so the default filter shows it — but the search box may not.
      setQuery("");
      setPage(0);
      await refresh();
    } catch {
      setError(t("judge.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id: string): Promise<void> {
    setError(null);
    setBlockedBy(null);
    setReactivated(null);
    setCreated(null);
    setDestroyedName(null);
    setBusy(true);
    try {
      await removeJudge(id);
      await refresh();
    } catch (err) {
      const names = blockingCompetitionsFrom(err);
      if (names) {
        setBlockedBy(names);
      } else {
        setError(t("judge.genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  /** §4a: the way back. Keeps the existing username and password hash — see the service. */
  async function onReactivate(judge: JudgeSummaryView): Promise<void> {
    setError(null);
    setBlockedBy(null);
    setCreated(null);
    setReactivated(null);
    setDestroyedName(null);
    setBusy(true);
    try {
      const result = await reactivateJudge(judge.id);
      setReactivated({ name: result.name, username: result.username });
      await refresh();
    } catch {
      setError(t("judge.genericError"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Open the permanent-delete dialog and read the judge's ranges, so the warning can name
   * the competitions whose supervision is about to disappear. A failed read is reported in
   * the dialog and leaves the confirm button disarmed — warning in the abstract is exactly
   * what this dialog exists to avoid.
   */
  const openDeleteDialog = useCallback(
    async function openDeleteDialog(judge: JudgeSummaryView): Promise<void> {
      setDeleting(judge);
      setDialogRanges(null);
      setDialogError(null);
      setError(null);
      try {
        const result = await listJudgeAssignmentsForController(judge.id);
        setDialogRanges(result.assignments);
      } catch {
        setDialogError(t("judge.destroyFailed"));
      }
    },
    [t],
  );

  function closeDeleteDialog(): void {
    if (deleteInFlight) return;
    setDeleting(null);
    setDialogRanges(null);
    setDialogError(null);
  }

  /** The irreversible step. Nothing here re-checks ROL-010 — the dialog is the guard. */
  async function onDestroy(): Promise<void> {
    if (!deleting) return;
    setDeleteInFlight(true);
    setDialogError(null);
    try {
      const result = await destroyJudge(deleting.id);
      setDeleting(null);
      setDialogRanges(null);
      setDestroyedName(result.name);
      setCreated(null);
      setReactivated(null);
      setError(null);
      await refresh();
    } catch {
      setDialogError(t("judge.destroyFailed"));
    } finally {
      setDeleteInFlight(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      {/* Report §7: this page had no back link and no logout at all. */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t("judge.title")}</h1>
        <div className="flex gap-2">
          <Link
            to="/controller"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
          >
            {t("competition.backToList")}
          </Link>
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
            onClick={onLogout}
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>

      <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow sm:p-6" onSubmit={onCreate}>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
          {t("judge.name")}
          <input
            className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {t("judge.create")}
        </button>
      </form>

      {created && (
        <section className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:p-6 sm:text-sm">
          <p className="font-medium text-amber-900">{t("judge.created")}</p>
          <p className="text-gray-700">
            <span className="font-medium">{t("judge.username")}:</span>{" "}
            <code className="rounded bg-white px-1 font-mono text-gray-900">{created.username}</code>
          </p>
          <p className="text-gray-700">
            <span className="font-medium">{t("judge.password")}:</span>{" "}
            <code className="rounded bg-white px-1 font-mono text-gray-900">{created.password}</code>
          </p>
          <p className="text-amber-800">{t("judge.credentialNote")}</p>
        </section>
      )}

      {reactivated && (
        <section className="flex flex-col gap-1 rounded-xl border border-green-200 bg-green-50 p-4 text-xs sm:p-6 sm:text-sm">
          <p className="font-medium text-green-800">
            {t("judge.reactivated")}{" "}
            {reactivated.username && (
              <code className="rounded bg-white px-1 font-mono text-gray-900">
                {reactivated.username}
              </code>
            )}
          </p>
          <p className="text-green-700">{t("judge.reactivatedNote")}</p>
        </section>
      )}

      {destroyedName && (
        <section
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-800 sm:p-6 sm:text-sm"
        >
          {t("judge.destroyed", { name: destroyedName })}
        </section>
      )}

      {blockedBy && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 sm:text-sm"
        >
          <p className="font-medium">{t("judge.deactivateBlocked")}</p>
          <ul className="mt-1 list-disc pl-5">
            {blockedBy.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("judge.list")}</h2>
          {judges && (
            <p className="text-xs text-gray-500 sm:text-sm">
              {t("judge.listCount", { shown: filtered.length, total: judges.length })}
            </p>
          )}
        </div>

        {judges && judges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="judge-search">
              {t("judge.searchPlaceholder")}
            </label>
            <input
              id="judge-search"
              type="search"
              placeholder={t("judge.searchPlaceholder")}
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
            <div className="flex gap-1" role="group">
              {(
                [
                  ["active", t("judge.filterActive")],
                  ["inactive", t("judge.filterInactive")],
                  ["all", t("judge.filterAll")],
                ] as [StatusFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setPage(0);
                  }}
                  className={
                    filter === value
                      ? "rounded border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors sm:text-sm"
                      : "rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!judges ? (
          <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
        ) : judges.length === 0 ? (
          <p className="text-xs text-gray-500 sm:text-sm">—</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-500 sm:text-sm">{t("judge.noMatch")}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {visibleRows.map((judge) => (
                <li
                  key={judge.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs shadow transition-colors hover:border-gray-300 hover:shadow-sm sm:text-sm"
                >
                  <span className="min-w-0 font-medium text-gray-900">
                    {judge.name}{" "}
                    <span className="text-xs text-gray-500">
                      ({judge.active ? t("judge.active") : t("judge.inactive")})
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    {judge.active ? (
                      <button
                        type="button"
                        className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                        onClick={() => onDeactivate(judge.id)}
                        disabled={busy}
                      >
                        {t("judge.deactivate")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                        onClick={() => onReactivate(judge)}
                        disabled={busy}
                      >
                        {t("judge.reactivate")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      onClick={() => void openDeleteDialog(judge)}
                      disabled={busy}
                    >
                      {t("judge.destroy")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                >
                  {t("judge.previousPage")}
                </button>
                <p className="text-xs text-gray-500 sm:text-sm">
                  {t("judge.pageOf", { page: safePage + 1, pages: pageCount })}
                </p>
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                >
                  {t("judge.nextPage")}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {deleting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-judge-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDeleteDialog}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-judge-title" className="mb-4 text-lg font-semibold text-red-700">
              {t("judge.destroyTitle")}
            </h2>
            <p className="mb-2 text-xs text-gray-800 sm:text-sm">{t("judge.destroyWarning")}</p>
            <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-gray-700 sm:text-sm">
              <li>{t("judge.destroyListRow", { name: deleting.name })}</li>
              <li>{t("judge.destroyListAccounts")}</li>
              <li>{t("judge.destroyListRanges")}</li>
            </ul>

            {dialogRanges === null && !dialogError && (
              <p className="mb-3 text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
            )}

            {dialogRanges !== null &&
              (dialogRanges.length === 0 ? (
                <p className="mb-3 text-xs text-gray-600 sm:text-sm">{t("judge.destroyListNoRanges")}</p>
              ) : (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-gray-700 sm:text-sm">
                    {t("judge.destroyRangesTitle")}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-gray-700 sm:text-sm">
                    {dialogRanges.map((range) => (
                      <li key={range.id}>
                        {t("judge.destroyRangeRow", {
                          competition: range.competitionName,
                          from: range.fromParticipantNumber,
                          to: range.toParticipantNumber,
                        })}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-800 sm:text-sm">{t("judge.destroyHintLive")}</p>
                </div>
              ))}

            {dialogError && (
              <p role="alert" className="mb-3 text-xs font-medium text-red-700 sm:text-sm">
                {dialogError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-4 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                onClick={closeDeleteDialog}
                disabled={deleteInFlight}
              >
                {t("judge.destroyCancel")}
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                disabled={deleteInFlight || dialogRanges === null}
                onClick={() => void onDestroy()}
              >
                {deleteInFlight ? t("judge.destroying") : t("judge.destroyConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
