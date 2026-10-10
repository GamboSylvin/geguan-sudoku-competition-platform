import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import {
  createCorrection,
  downloadExport,
  fetchResults,
  listCorrections,
  ResultsApiError,
  type CorrectionHistoryRow,
  type RankingRow,
  type ResultsRowView,
  type ResultsView,
} from "./resultsApi";

/**
 * The controller's results screen (Unit 12, spec Detail 5): the per-category
 * scores with Unit 09's rank beside every row, the category leaderboards, the
 * correction form (mandatory reason — RES-003), the correction history, the
 * `.xlsx` export button, and the purge-date notice ("this competition's data will
 * be purged on …"). There is deliberately **no** manual purge control: the purge
 * is schedule-driven on the server only (spec Security Considerations).
 *
 * The screen reads; it never computes a rank (invariant 8's spirit — the ranking
 * comes from the server, which owns it). A rejection is shown as its own
 * localizable message, and a cancelled competition's gate surfaces here as the
 * `results_competitionCancelled` message instead of any numbers.
 */

/** The correction target the form was opened for, if any. */
interface CorrectionTarget {
  roundId: string;
  roundName: string;
  participantId: string;
  participantName: string;
  participantNumber: number;
  currentScore: number | null;
}

function formatSeconds(total: number | null): string {
  if (total === null) return "—";
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The purge/finish date as a short locale string; the notice shows the day, not the tick. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function ResultsPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [results, setResults] = useState<ResultsView | null>(null);
  const [corrections, setCorrections] = useState<CorrectionHistoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const [newScore, setNewScore] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const competitionId = id ?? null;

  /**
   * Turn a rejection into a message the controller can act on. Every results code
   * has an entry in both catalogues, keyed with dots turned into underscores; an
   * unexpected code falls back to the generic message and still prints the raw
   * code, so nothing is ever silent (the Unit 11 dashboard's pattern).
   */
  const messageFor = useCallback(
    (e: unknown): string => {
      if (e instanceof ResultsApiError) {
        const known = `results.errors.${e.code.replace(/\./g, "_")}`;
        const translated = t(known);
        if (translated !== known) return translated;
        return `${t("results.genericError")} (${e.code})`;
      }
      return t("results.genericError");
    },
    [t],
  );

  const handleUnauthorized = useCallback(
    (e: unknown): boolean => {
      if (e instanceof ResultsApiError && e.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return true;
      }
      return false;
    },
    [navigate],
  );

  /**
   * Read the results, and the correction history beside them. The history read is
   * best-effort: a cancelled competition rejects it (the gate), and the screen
   * still shows the rejection message from the results read itself.
   */
  const refresh = useCallback(async () => {
    if (!competitionId) return;
    try {
      const view = await fetchResults(competitionId);
      setResults(view);
      setLoadError(null);
      try {
        const history = await listCorrections(competitionId);
        setCorrections(history.corrections);
      } catch {
        // The results read already succeeded, so keep the history simply empty.
        setCorrections([]);
      }
    } catch (e) {
      if (handleUnauthorized(e)) return;
      setResults(null);
      setLoadError(messageFor(e));
    }
  }, [competitionId, handleUnauthorized, messageFor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCorrection(row: ResultsRowView, roundName: string): void {
    setTarget({
      roundId: row.roundId,
      roundName,
      participantId: row.participantId,
      participantName: row.participantName,
      participantNumber: row.participantNumber,
      currentScore: row.totalScore,
    });
    setNewScore(row.totalScore === null ? "" : String(row.totalScore));
    setReason("");
    setActionError(null);
    setActionNotice(null);
  }

  async function onSubmitCorrection(): Promise<void> {
    if (!competitionId || !target) return;
    const score = Number(newScore);
    if (!Number.isInteger(score) || score < 0) {
      setActionError(t("results.invalidScore"));
      return;
    }
    if (reason.trim() === "") {
      setActionError(t("results.errors.results_reasonRequired"));
      return;
    }
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await createCorrection(competitionId, {
        targetType: "PARTICIPANT",
        targetId: target.participantId,
        roundId: target.roundId,
        newScore: score,
        reason: reason.trim(),
      });
      setTarget(null);
      setActionNotice(t("results.corrected"));
      await refresh();
    } catch (e) {
      if (!handleUnauthorized(e)) setActionError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function onExport(): Promise<void> {
    if (!competitionId) return;
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const fileName = await downloadExport(competitionId);
      setActionNotice(`${t("results.exportDone")} (${fileName})`);
    } catch (e) {
      if (!handleUnauthorized(e)) setActionError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  const cancelled = results?.status === "CANCELLED";

  function rankingOf(categoryId: string): RankingRow[] {
    return results?.rankings[categoryId] ?? [];
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6 text-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {results ? results.name : t("results.title")}
          </h1>
          {results && (
            <p className="text-sm text-slate-600">
              {t(`controller.status.${results.status}`)}
              {results.finishedEarly && ` — ${t("results.finishedEarly")}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/controller/competitions/${encodeURIComponent(competitionId ?? "")}/live`}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            {t("results.backToLive")}
          </Link>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            onClick={() => void refresh()}
          >
            {t("results.refresh")}
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            disabled={busy || !results || cancelled}
            onClick={() => void onExport()}
          >
            {t("results.export")}
          </button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      )}
      {actionNotice && (
        <p role="status" className="text-sm text-green-700">
          {actionNotice}
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}

      {!results && !loadError && (
        <p className="text-sm text-slate-600">{t("common.loading")}</p>
      )}

      {/* The purge notice (spec Detail 5): informational only — the purge runs on
          the server's schedule and has no control here. */}
      {results?.purge && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {results.purge.status === "EXECUTED"
            ? `${t("results.purgeExecuted")} ${formatDate(results.purge.executedAt ?? results.purge.purgeAt)}`
            : `${t("results.purgeNotice")} ${formatDate(results.purge.purgeAt)}`}
        </p>
      )}

      {results &&
        results.categories.map((category) => (
          <section
            key={category.categoryId}
            className="rounded-md border border-slate-200 bg-white p-4"
          >
            <h2 className="mb-3 text-lg font-semibold">
              {category.code} — {category.name}
            </h2>

            {/* The category leaderboard: Unit 09's ranking, shown beside the detail
                so the two never disagree — both come from the same read. */}
            <h3 className="mb-1 text-sm font-medium text-slate-700">
              {t("results.rankingTitle")}
            </h3>
            {rankingOf(category.categoryId).length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">{t("results.rankingEmpty")}</p>
            ) : (
              <table className="mb-4 min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">{t("results.colRank")}</th>
                    <th className="px-2 py-1 text-left font-medium">{t("results.colName")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("results.colScore")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("results.colTime")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankingOf(category.categoryId).map((row) => (
                    <tr key={row.participantId}>
                      <td className="px-2 py-1">{row.rank}</td>
                      <td className="px-2 py-1">{row.participantName}</td>
                      <td className="px-2 py-1 text-right">{row.score}</td>
                      <td className="px-2 py-1 text-right">
                        {formatSeconds(row.completionTimeSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {category.stages.map((stage) => (
              <div key={stage.stageId} className="mb-4">
                <h3 className="mb-1 text-sm font-medium text-slate-700">
                  {t(`controller.stageType.${stage.type}`)} — {stage.name}
                </h3>
                {stage.rounds.map((round) => (
                  <div key={round.roundId} className="mb-3">
                    <p className="mb-1 text-xs text-slate-500">
                      {round.name} ({t(`controller.roundStatus.${round.status}`)})
                    </p>
                    {round.rows.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("results.rowsEmpty")}</p>
                    ) : (
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium">{t("results.colNumber")}</th>
                            <th className="px-2 py-1 text-left font-medium">{t("results.colName")}</th>
                            <th className="px-2 py-1 text-right font-medium">{t("results.colRank")}</th>
                            <th className="px-2 py-1 text-right font-medium">{t("results.colRawScore")}</th>
                            <th className="px-2 py-1 text-right font-medium">{t("results.colBonus")}</th>
                            <th className="px-2 py-1 text-right font-medium">{t("results.colTotal")}</th>
                            <th className="px-2 py-1 text-right font-medium">{t("results.colTime")}</th>
                            <th className="px-2 py-1 text-left font-medium">{t("results.colSubmission")}</th>
                            <th className="px-2 py-1 text-right font-medium">{t("results.colActions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {round.rows.map((row) => (
                            <tr key={`${round.roundId}:${row.participantId}`}>
                              <td className="px-2 py-1">{row.participantNumber}</td>
                              <td className="px-2 py-1">{row.participantName}</td>
                              <td className="px-2 py-1 text-right">
                                {row.rank === null ? "—" : row.rank}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {row.score === null ? "—" : row.score}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {row.bonus === null ? "—" : row.bonus}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {row.totalScore === null ? "—" : row.totalScore}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {formatSeconds(row.completionTimeSeconds)}
                              </td>
                              <td className="px-2 py-1">
                                {row.submissionType
                                  ? t(`results.submissionType.${row.submissionType}`)
                                  : "—"}
                              </td>
                              <td className="px-2 py-1 text-right">
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
                                  disabled={busy || cancelled}
                                  onClick={() => openCorrection(row, round.name)}
                                >
                                  {t("results.correct")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}

      {/* The correction history (RES-003's change log), newest first. */}
      {results && !cancelled && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">{t("results.historyTitle")}</h2>
          {corrections.length === 0 ? (
            <p className="text-sm text-slate-500">{t("results.historyEmpty")}</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">{t("results.historyWhen")}</th>
                  <th className="px-2 py-1 text-left font-medium">{t("results.historyChange")}</th>
                  <th className="px-2 py-1 text-left font-medium">{t("results.historyReason")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corrections.map((c) => (
                  <tr key={c.id}>
                    <td className="px-2 py-1">{formatDate(c.correctedAt)}</td>
                    <td className="px-2 py-1">
                      {c.oldScore} → {c.newScore}
                    </td>
                    <td className="px-2 py-1">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* The correction form, in a dialog: the reason is mandatory and the dialog
          says so, so a blank submit is refused here and again by the server. */}
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => (busy ? undefined : setTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-md bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">{t("results.correctTitle")}</h2>
            <p className="mb-3 text-sm text-slate-600">
              {target.participantName} (#{target.participantNumber}) — {target.roundName}
            </p>
            <p className="mb-3 text-sm text-slate-600">
              {t("results.correctCurrent")}:{" "}
              {target.currentScore === null ? "—" : target.currentScore}
            </p>
            <label className="mb-1 block text-sm font-medium" htmlFor="correction-score">
              {t("results.correctNewScore")}
            </label>
            <input
              id="correction-score"
              type="number"
              min={0}
              step={1}
              className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={newScore}
              onChange={(e) => setNewScore(e.target.value)}
            />
            <label className="mb-1 block text-sm font-medium" htmlFor="correction-reason">
              {t("results.correctReason")}
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="mb-3 text-xs text-slate-500">{t("results.correctReasonHint")}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                {t("results.correctCancel")}
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => void onSubmitCorrection()}
              >
                {t("results.correctSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
