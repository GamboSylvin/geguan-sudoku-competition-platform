import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import {
  fetchJudgeStudents,
  restartStudent,
  type JudgeStudentView,
  JudgeApiError,
} from "./judgeApi";
import { useNavigate } from "react-router-dom";

/**
 * The judge's supervision dashboard (Unit 10). Lists every participant inside
 * the calling judge's assigned range(s) with their connection status, round
 * participation state, left-page count, restart count, and the round's
 * remaining time. A Restart button per row triggers the single-student restart
 * (archives the current attempt, blanks the grid, keeps the shared timer).
 *
 * Polling, not realtime: the spec does not ask for a live push, and a 3-second
 * poll on a judge's tablet is well within the event's scale (~300 tablets, a
 * handful of judges). A realtime upgrade is a later unit's call.
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

export function JudgeDashboardPage() {
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
      const result = await fetchJudgeStudents();
      setStudents(result.students);
      setError(null);
    } catch (e) {
      setError(t("judge.genericError"));
      if (e instanceof JudgeApiError && e.status === 401) {
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

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 p-6 text-slate-800">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("judge.supervision.title")}</h1>
          <p className="text-sm text-slate-600">{t("judge.supervision.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            onClick={() => void refresh()}
          >
            {t("judge.supervision.refresh")}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            onClick={onLogout}
          >
            {t("auth.logout")}
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p role="status" className="mb-3 text-sm text-green-700">
          {actionSuccess}
        </p>
      )}

      {!students && !error && <p className="text-sm text-slate-600">{t("common.loading")}</p>}

      {students && students.length === 0 && (
        <p className="text-sm text-slate-600">{t("judge.supervision.empty")}</p>
      )}

      {students && students.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnNumber")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnName")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnCategory")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnConnected")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnState")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnLeftPage")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnRestarts")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.timeLeft")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const canRestart = s.roundStatus === "ACTIVE" || s.roundStatus === "PAUSED";
                return (
                  <tr key={s.participantId}>
                    <td className="px-3 py-2">{s.participantNumber}</td>
                    <td className="px-3 py-2">{s.participantName}</td>
                    <td className="px-3 py-2">{s.categoryName}</td>
                    <td className="px-3 py-2">
                      {s.connected
                        ? t("judge.supervision.connectedYes")
                        : t("judge.supervision.connectedNo")}
                    </td>
                    <td className="px-3 py-2">{t(stateKey(s.participationState))}</td>
                    <td className="px-3 py-2">{s.leftAnswerPageCount}</td>
                    <td className="px-3 py-2">{s.attemptCount}</td>
                    <td className="px-3 py-2">
                      {s.remainingSeconds !== null ? formatSeconds(s.remainingSeconds) : t(roundStatusKey(s.roundStatus))}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!canRestart || restartingFor === s.participantId}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmingFor(null)}
        >
          <div
            className="w-full max-w-md rounded-md bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">
              {t("judge.supervision.restartConfirmTitle")}
            </h2>
            <p className="mb-1 text-sm text-slate-700">
              #{confirmingFor.participantNumber} — {confirmingFor.participantName}
            </p>
            <p className="mb-4 text-sm text-slate-600">
              {t("judge.supervision.restartConfirmBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                onClick={() => setConfirmingFor(null)}
                disabled={restartingFor !== null}
              >
                {t("judge.supervision.restartConfirmCancel")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void onConfirmRestart()}
                disabled={restartingFor !== null}
              >
                {t("judge.supervision.restartConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
