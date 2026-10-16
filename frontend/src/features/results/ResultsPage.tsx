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
 *
 * Visuel : ambiance B « clair, sobre, cartes blanches » (BLD-054, révise U-66).
 * Écran de lecture uniquement côté pilotage, donc tout est en cartes blanches sur
 * `bg-gray-50`, avec le bandeau dégradé indigo→violet (§3.2/2) pour l'en-tête.
 * Les colonnes de rang, de score et de temps portent `tabular-nums` : ce sont des
 * chiffres comparés d'une ligne à l'autre (§3.5).
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
    <main className="flex min-h-screen flex-col gap-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      {/* Bandeau d'en-tête de l'ambiance B (§3.2/2) : le div existait déjà, il porte
          maintenant le dégradé et les trois actions deviennent des boutons « verre »
          (§3.6), exactement comme sur le poste de pilotage — un seul style par rôle. */}
      <div className="-mx-4 -mt-4 flex flex-col gap-3 bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-4 text-white shadow-lg sm:-mx-6 sm:-mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">
            {results ? results.name : t("results.title")}
          </h1>
          {results && (
            <p className="text-xs text-purple-200 sm:text-sm">
              {t(`controller.status.${results.status}`)}
              {results.finishedEarly && ` — ${t("results.finishedEarly")}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/controller/competitions/${encodeURIComponent(competitionId ?? "")}/live`}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
          >
            {t("results.backToLive")}
          </Link>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
            onClick={() => void refresh()}
          >
            {t("results.refresh")}
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            disabled={busy || !results || cancelled}
            onClick={() => void onExport()}
          >
            {t("results.export")}
          </button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {actionError}
        </p>
      )}
      {actionNotice && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-700 sm:text-sm">
          {actionNotice}
        </p>
      )}
      {loadError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {loadError}
        </p>
      )}

      {!results && !loadError && (
        <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
      )}

      {/* The purge notice (spec Detail 5): informational only — the purge runs on
          the server's schedule and has no control here. */}
      {results?.purge && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 sm:text-sm">
          {results.purge.status === "EXECUTED"
            ? `${t("results.purgeExecuted")} ${formatDate(results.purge.executedAt ?? results.purge.purgeAt)}`
            : `${t("results.purgeNotice")} ${formatDate(results.purge.purgeAt)}`}
        </p>
      )}

      {results &&
        results.categories.map((category) => (
          <section
            key={category.categoryId}
            className="rounded-xl bg-white p-4 shadow sm:p-6"
          >
            <h2 className="mb-3 text-base font-bold text-gray-900 sm:text-lg">
              {category.code} — {category.name}
            </h2>

            {/* The category leaderboard: Unit 09's ranking, shown beside the detail
                so the two never disagree — both come from the same read. */}
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
              {t("results.rankingTitle")}
            </h3>
            {rankingOf(category.categoryId).length === 0 ? (
              <p className="mb-4 text-xs text-gray-500 sm:text-sm">{t("results.rankingEmpty")}</p>
            ) : (
              <table className="mb-4 min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colRank")}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colName")}</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colScore")}</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colTime")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rankingOf(category.categoryId).map((row) => (
                    <tr key={row.participantId} className="text-gray-700 transition-colors hover:bg-gray-50">
                      <td className="px-3 py-2 tabular-nums">{row.rank}</td>
                      <td className="px-3 py-2">{row.participantName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.score}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatSeconds(row.completionTimeSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {category.stages.map((stage) => (
              <div key={stage.stageId} className="mb-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
                  {t(`controller.stageType.${stage.type}`)} — {stage.name}
                </h3>
                {stage.rounds.map((round) => (
                  <div key={round.roundId} className="mb-3">
                    <p className="mb-1 text-xs text-gray-500">
                      {round.name} ({t(`controller.roundStatus.${round.status}`)})
                    </p>
                    {round.rows.length === 0 ? (
                      <p className="text-xs text-gray-500 sm:text-sm">{t("results.rowsEmpty")}</p>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colNumber")}</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colName")}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colRank")}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colRawScore")}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colBonus")}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colTotal")}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colTime")}</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colSubmission")}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 sm:text-sm">{t("results.colActions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {round.rows.map((row) => (
                            <tr key={`${round.roundId}:${row.participantId}`} className="text-gray-700 transition-colors hover:bg-gray-50">
                              <td className="px-3 py-2 tabular-nums">{row.participantNumber}</td>
                              <td className="px-3 py-2">{row.participantName}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.rank === null ? "—" : row.rank}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.score === null ? "—" : row.score}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.bonus === null ? "—" : row.bonus}
                              </td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-900">
                                {row.totalScore === null ? "—" : row.totalScore}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {formatSeconds(row.completionTimeSeconds)}
                              </td>
                              <td className="px-3 py-2">
                                {row.submissionType
                                  ? t(`results.submissionType.${row.submissionType}`)
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
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
        <section className="rounded-xl bg-white p-4 shadow sm:p-6">
          <h2 className="mb-2 text-base font-bold text-gray-900 sm:text-lg">{t("results.historyTitle")}</h2>
          {corrections.length === 0 ? (
            <p className="text-xs text-gray-500 sm:text-sm">{t("results.historyEmpty")}</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.historyWhen")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.historyChange")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("results.historyReason")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {corrections.map((c) => (
                  <tr key={c.id} className="text-gray-700 transition-colors hover:bg-gray-50">
                    <td className="px-3 py-2">{formatDate(c.correctedAt)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {c.oldScore} → {c.newScore}
                    </td>
                    <td className="px-3 py-2">{c.reason}</td>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => (busy ? undefined : setTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold text-gray-900">{t("results.correctTitle")}</h2>
            <p className="mb-3 text-xs font-medium text-gray-900 sm:text-sm">
              {target.participantName} (#{target.participantNumber}) — {target.roundName}
            </p>
            <p className="mb-3 text-xs text-gray-700 sm:text-sm">
              {t("results.correctCurrent")}:{" "}
              <span className="font-mono tabular-nums">
                {target.currentScore === null ? "—" : target.currentScore}
              </span>
            </p>
            <label className="mb-1 block text-xs font-medium text-gray-700 sm:text-sm" htmlFor="correction-score">
              {t("results.correctNewScore")}
            </label>
            <input
              id="correction-score"
              type="number"
              min={0}
              step={1}
              className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={newScore}
              onChange={(e) => setNewScore(e.target.value)}
            />
            <label className="mb-1 block text-xs font-medium text-gray-700 sm:text-sm" htmlFor="correction-reason">
              {t("results.correctReason")}
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="mb-3 text-xs text-gray-500">{t("results.correctReasonHint")}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-4 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                {t("results.correctCancel")}
              </button>
              <button
                type="button"
                className="rounded bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
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
