import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import {
  fetchJudgeStudents,
  restartStudent,
  type JudgeStudentView,
  JudgeApiError,
} from "./judgeApi";

/**
 * The student-status/restart panel (Unit 10), reusable by both roles that may see
 * it: a judge (no `competitionId` — the server scopes the list to that judge's own
 * range) and the controller (a `competitionId` — judge-equivalent access to the
 * whole competition, Unit 11 spec Detail 6). Both reach the *same* backend code
 * path; only the scope differs, which is why this is one component and not two.
 *
 * Polling, not realtime: the spec does not ask for a live push, and a 3-second poll
 * on a judge's tablet or the controller's desk is well within the event's scale
 * (~300 tablets, a handful of judges, one controller). A realtime upgrade is a
 * later unit's call.
 *
 * Visuel : ambiance B « clair, sobre, cartes blanches » (BLD-054, révise U-66).
 * Ce panneau est rendu dans deux écrans B (le tableau de bord du juge et le
 * poste de pilotage en direct), donc il garde exactement les mêmes recettes
 * dans les deux cas : un seul style par rôle visuel.
 */
const POLL_INTERVAL_MS = 3000;

function formatSeconds(total: number | null): string {
  if (total === null) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stateKey(state: JudgeStudentView["participationState"]): string {
  if (state === null) return "judge.supervision.stateNone";
  switch (state) {
    case "WAITING":
      return "judge.supervision.stateWaiting";
    case "ACTIVE":
      return "judge.supervision.stateActive";
    case "SUBMITTED":
      return "judge.supervision.stateSubmitted";
    case "AUTO_SUBMITTED":
      return "judge.supervision.stateAutoSubmitted";
    case "RESTARTED":
      return "judge.supervision.stateRestarted";
  }
}

function roundStatusKey(status: JudgeStudentView["roundStatus"]): string {
  if (status === null) return "judge.supervision.noRound";
  switch (status) {
    case "WAITING":
      return "judge.supervision.roundWaiting";
    case "PREPARATION":
      return "judge.supervision.roundPreparation";
    case "ACTIVE":
      return "judge.supervision.roundActive";
    case "PAUSED":
      return "judge.supervision.roundPaused";
    case "FINISHED":
      return "judge.supervision.roundFinished";
  }
}

export interface StudentsSupervisionPanelProps {
  /** Omitted for a judge session; set for the controller's competition-wide view. */
  competitionId?: string;
  /** The judge's own header reads "Your students"; the controller's is inline. */
  showHeader?: boolean;
}

export function StudentsSupervisionPanel({
  competitionId,
  showHeader = false,
}: StudentsSupervisionPanelProps) {
  const { t } = useLocale();
  const navigate = useNavigate();

  const [students, setStudents] = useState<JudgeStudentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingFor, setConfirmingFor] = useState<JudgeStudentView | null>(null);
  const [restartingFor, setRestartingFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchJudgeStudents(competitionId);
      setStudents(result.students);
      setError(null);
    } catch (e) {
      setError(t("judge.genericError"));
      if (e instanceof JudgeApiError && e.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
      }
    }
  }, [competitionId, navigate, t]);

  useEffect(() => {
    void refresh();
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [refresh]);

  async function onConfirmRestart(): Promise<void> {
    if (!confirmingFor) return;
    setRestartingFor(confirmingFor.participantId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await restartStudent(confirmingFor.participantId);
      setActionSuccess(t("judge.supervision.restartSuccess"));
      setConfirmingFor(null);
      await refresh();
    } catch (e) {
      setActionError(t("judge.supervision.restartError"));
      if (e instanceof JudgeApiError && e.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
      }
    } finally {
      setRestartingFor(null);
    }
  }

  return (
    <section className="text-gray-900">
      {showHeader && (
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t("judge.supervision.title")}</h1>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">{t("judge.supervision.subtitle")}</p>
          </div>
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
            onClick={() => void refresh()}
          >
            {t("judge.supervision.refresh")}
          </button>
        </header>
      )}

      {!showHeader && (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">{t("controller.studentsTitle")}</h2>
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
            onClick={() => void refresh()}
          >
            {t("judge.supervision.refresh")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p role="status" className="mb-3 rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-700 sm:text-sm">
          {actionSuccess}
        </p>
      )}

      {!students && !error && <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>}

      {students && students.length === 0 && (
        <p className="text-xs text-gray-500 sm:text-sm">
          {showHeader
            ? t("judge.supervision.empty")
            : t("controller.studentsEmpty")}
        </p>
      )}

      {students && students.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnNumber")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnName")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnCategory")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnConnected")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnState")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnLeftPage")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnRestarts")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.timeLeft")}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 sm:text-sm">{t("judge.supervision.columnActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => {
                const canRestart = s.roundStatus === "ACTIVE" || s.roundStatus === "PAUSED";
                return (
                  <tr key={s.participantId} className="text-gray-700 transition-colors hover:bg-gray-50">
                    <td className="px-3 py-2 tabular-nums">{s.participantNumber}</td>
                    <td className="px-3 py-2">{s.participantName}</td>
                    <td className="px-3 py-2">{s.categoryName}</td>
                    <td className="px-3 py-2">
                      {s.connected
                        ? t("judge.supervision.connectedYes")
                        : t("judge.supervision.connectedNo")}
                    </td>
                    <td className="px-3 py-2">{t(stateKey(s.participationState))}</td>
                    <td className="px-3 py-2 tabular-nums">{s.leftAnswerPageCount}</td>
                    <td className="px-3 py-2 tabular-nums">{s.attemptCount}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {s.remainingSeconds !== null ? formatSeconds(s.remainingSeconds) : t(roundStatusKey(s.roundStatus))}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!canRestart || restartingFor === s.participantId}
                        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setConfirmingFor(s)}
                      >
                        {t("judge.supervision.restart")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmingFor && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmingFor(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              {t("judge.supervision.restartConfirmTitle")}
            </h2>
            <p className="mb-1 text-xs font-medium text-gray-900 sm:text-sm">
              #{confirmingFor.participantNumber} — {confirmingFor.participantName}
            </p>
            <p className="mb-4 text-xs text-gray-700 sm:text-sm">
              {t("judge.supervision.restartConfirmBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-4 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                onClick={() => setConfirmingFor(null)}
                disabled={restartingFor !== null}
              >
                {t("judge.supervision.restartConfirmCancel")}
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                onClick={() => void onConfirmRestart()}
                disabled={restartingFor !== null}
              >
                {t("judge.supervision.restartConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
