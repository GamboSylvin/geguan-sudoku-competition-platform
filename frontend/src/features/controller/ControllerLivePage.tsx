import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { StudentsSupervisionPanel } from "../judge/StudentsSupervisionPanel";
import {
  cancelCompetition,
  ControllerApiError,
  endRoundEarly,
  fetchBigScreenMode,
  fetchCompetition,
  finishEarly,
  pauseCompetition,
  resetRematch,
  resumeCompetition,
  setBigScreenMode,
  startStage,
  type BigScreenDisplayView,
  type LiveCompetitionView,
  type LiveRoundView,
  type LiveStageView,
  type ResetRematchScope,
  type TimerSnapshotView,
} from "./controllerApi";

/**
 * The controller's live-command dashboard (Unit 11, spec Detail 10): a start-stage
 * button enabled only when the state allows it, a pause/resume toggle, a per-round
 * "end early" action, a "finish early" action behind an explicit cannot-be-undone
 * confirmation, a reset/rematch panel with a scope picker, judge-equivalent
 * student-status and restart access (the same panel Unit 10 built for judges),
 * big-screen mode controls, and a "cancel" action behind an explicit warning that
 * no results will ever be released.
 *
 * Every button's enabled state is derived from server-read status, never from a
 * client-side guess about what phase the event is in — the server is the only
 * authority on the sequence (invariant 3 in spirit), and a command it rejects is
 * shown as its own localizable message rather than silently swallowed.
 *
 * Polling, not realtime: the dashboard reads the competition structure and the
 * big-screen mode every few seconds. The screen is one client on one desk, so this
 * is far cheaper than a push channel and needs no new event contract.
 */
const POLL_INTERVAL_MS = 3000;

/** Which confirmation dialog is open, if any. */
type PendingAction =
  | { kind: "finishEarly" }
  | { kind: "cancel" }
  | { kind: "endRoundEarly"; round: LiveRoundView; stage: LiveStageView }
  | { kind: "resetRematch" }
  | null;

function formatSeconds(total: number | null): string {
  if (total === null) return "—";
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ControllerLivePage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [competition, setCompetition] = useState<LiveCompetitionView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bigScreen, setBigScreen] = useState<BigScreenDisplayView | null>(null);
  const [timer, setTimer] = useState<TimerSnapshotView | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Reset/rematch panel state. A scope needs a target id for three of its four
  // values, and the only targets this dashboard can name are the ones it can read:
  // rounds from the structure, participants from the supervision panel, teams from
  // the structure's categories. Team ids are not exposed by any read in this unit,
  // so the TEAM scope is offered only where a team id is typed by the controller.
  const [scope, setScope] = useState<ResetRematchScope>("ROUND");
  const [targetRoundId, setTargetRoundId] = useState("");
  const [targetParticipantId, setTargetParticipantId] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");

  const competitionId = id ?? null;

  // Derived state, read from the server's statuses only. Everything below is a
  // mirror of the rule the server enforces, so a button is disabled instead of
  // producing a rejection on click; the server stays the authority either way.
  const status = competition?.status ?? null;
  const closed = status === "FINISHED" || status === "CANCELLED";
  const stages = competition?.stages ?? [];

  /** The one round currently in flight, if any (one active round per competition). */
  const runningRound = stages
    .flatMap((stage) => stage.rounds.map((round) => ({ stage, round })))
    .find(
      ({ round }) =>
        round.status === "PREPARATION" ||
        round.status === "ACTIVE" ||
        round.status === "PAUSED",
    );

  /** A pause needs something running; the server says so with `nothingToPause`. */
  const canPauseNow = !closed && Boolean(runningRound);
  /** Round status, not the last snapshot, is what says whether we are paused. */
  const pausedNow = runningRound?.round.status === "PAUSED";

  /**
   * A stage may be started only while it is still WAITING and every earlier stage
   * has finished (RND-006: advancing past a stage's last round stays a human
   * action, and the sequence is fixed).
   */
  function canStartStage(stage: LiveStageView): boolean {
    if (closed || stage.status !== "WAITING") return false;
    return stages
      .filter((s) => s.sequence < stage.sequence)
      .every((s) => s.status === "FINISHED");
  }

  function canEndRound(round: LiveRoundView): boolean {
    return (
      !closed &&
      (round.status === "PREPARATION" ||
        round.status === "ACTIVE" ||
        round.status === "PAUSED")
    );
  }

  const handleUnauthorized = useCallback(
    (e: unknown): boolean => {
      if (e instanceof ControllerApiError && e.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return true;
      }
      return false;
    },
    [navigate],
  );

  /**
   * Turn a rejection into a message the controller can act on. Every orchestrator
   * code has an entry in both catalogues, so the code is the lookup key; anything
   * unexpected falls back to the generic error and still shows the raw code, so a
   * new backend rejection is visible rather than invisible.
   */
  const messageFor = useCallback(
    (e: unknown): string => {
      if (e instanceof ControllerApiError) {
        const known = `controller.errors.${e.code.replace(/\./g, "_")}`;
        const translated = t(known);
        // `t` returns the key itself when the catalogue has no entry.
        if (translated !== known) return translated;
        return `${t("controller.genericError")} (${e.code})`;
      }
      return t("controller.genericError");
    },
    [t],
  );

  const refresh = useCallback(async () => {
    if (!competitionId) return;
    try {
      const [next, mode] = await Promise.all([
        fetchCompetition(competitionId),
        fetchBigScreenMode(competitionId),
      ]);
      setCompetition(next);
      setBigScreen(mode);
      setLoadError(null);
    } catch (e) {
      if (handleUnauthorized(e)) return;
      setLoadError(t("controller.loadError"));
    }
  }, [competitionId, handleUnauthorized, t]);

  useEffect(() => {
    void refresh();
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [refresh]);

  /** Run one command, then re-read the state so the buttons re-enable correctly. */
  async function run(labelKey: string, action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await action();
      setActionNotice(t(labelKey));
      setPending(null);
      await refresh();
    } catch (e) {
      if (handleUnauthorized(e)) return;
      setActionError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStartStage(stage: LiveStageView): Promise<void> {
    if (!competitionId) return;
    await run("controller.stageStarted", async () => {
      const result = await startStage(competitionId, stage.id);
      setTimer(null);
      return result;
    });
  }

  async function onPauseResume(): Promise<void> {
    if (!competitionId || !canPauseNow) return;
    await run(pausedNow ? "controller.resumed" : "controller.paused", async () => {
      const snapshot = pausedNow
        ? await resumeCompetition(competitionId)
        : await pauseCompetition(competitionId);
      setTimer(snapshot);
      return snapshot;
    });
  }

  /**
   * The dashboard has no live timer push of its own, so it reads the remaining time
   * off whichever command last returned a snapshot, and off the students panel's
   * per-row `remainingSeconds` (the same server value). This keeps the display
   * honest without inventing a countdown the client is not allowed to own
   * (invariant 3).
   */
  async function onEndRoundEarly(round: LiveRoundView): Promise<void> {
    if (!competitionId) return;
    await run("controller.roundEnded", () => endRoundEarly(competitionId, round.id));
  }

  async function onFinishEarly(): Promise<void> {
    if (!competitionId) return;
    await run("controller.finishedEarly", async () => {
      const result = await finishEarly(competitionId);
      setTimer(null);
      return result;
    });
  }

  async function onResetRematch(): Promise<void> {
    if (!competitionId) return;
    const input =
      scope === "EVENT"
        ? { scope }
        : scope === "ROUND"
          ? { scope, roundId: targetRoundId || null }
          : scope === "PARTICIPANT"
            ? { scope, participantId: targetParticipantId || null }
            : { scope, teamId: targetTeamId || null };
    await run("controller.resetDone", () => resetRematch(competitionId, input));
  }

  async function onCancel(): Promise<void> {
    if (!competitionId) return;
    await run("controller.cancelled", async () => {
      const result = await cancelCompetition(competitionId);
      setTimer(null);
      return result;
    });
  }

  async function onSetBigScreenMode(mode: "RANKING" | "PAUSED" | "FINAL"): Promise<void> {
    if (!competitionId) return;
    await run("controller.bigScreenUpdated", async () => {
      const result = await setBigScreenMode(competitionId, { mode });
      setBigScreen(result);
      return result;
    });
  }

  async function onToggleRotation(): Promise<void> {
    if (!competitionId || !bigScreen) return;
    await run("controller.bigScreenUpdated", async () => {
      const result = await setBigScreenMode(competitionId, {
        mode: "RANKING",
        rotationEnabled: !bigScreen.rotationEnabled,
      });
      setBigScreen(result);
      return result;
    });
  }

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  if (!competitionId) {
    return (
      <main className="flex min-h-screen flex-col bg-slate-50 p-6 text-slate-800">
        <p className="text-sm text-red-600">{t("controller.noCompetition")}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6 text-slate-800">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("controller.title")}</h1>
          <p className="text-sm text-slate-600">
            {competition ? competition.name : t("common.loading")}
            {status ? ` · ${t(`controller.status.${status}`)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
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
            onClick={onLogout}
          >
            {t("auth.logout")}
          </button>
        </div>
      </header>

      {loadError && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}
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

      {/* Sequence control: start a stage, pause/resume the shared timer. */}
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">{t("controller.sequenceTitle")}</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              disabled={!canStartStage(stage) || busy}
              className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void onStartStage(stage)}
            >
              {t("controller.startStage")} · {t(`controller.stageType.${stage.type}`)} {stage.sequence}
            </button>
          ))}
          <button
            type="button"
            disabled={!canPauseNow || busy}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onPauseResume()}
          >
            {pausedNow ? t("controller.resume") : t("controller.pause")}
          </button>
        </div>
        {/*
          The snapshot is what the last pause/resume returned; it is shown as a
          point-in-time value, never counted down here. The server clock is the only
          timer authority (invariant 3), and the live per-student remaining time is
          in the supervision panel below, which the server re-computes on each read.
        */}
        {timer && (
          <p className="text-sm text-slate-600">
            {t("controller.timeLeft")}: {formatSeconds(timer.remainingSeconds)} /{" "}
            {formatSeconds(timer.totalSeconds)}
          </p>
        )}
        {!timer && runningRound && (
          <p className="text-sm text-slate-500">{t("controller.timerHint")}</p>
        )}
      </section>

      {/* Per-round actions. */}
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">{t("controller.roundsTitle")}</h2>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("controller.columnStage")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("controller.columnRound")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("controller.columnStatus")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("controller.columnDuration")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("judge.supervision.columnActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stages.flatMap((stage) =>
              stage.rounds.map((round) => (
                <tr key={round.id}>
                  <td className="px-3 py-2">
                    {t(`controller.stageType.${stage.type}`)} {stage.sequence}
                  </td>
                  <td className="px-3 py-2">{round.name}</td>
                  <td className="px-3 py-2">{t(`controller.roundStatus.${round.status}`)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {round.settings ? formatSeconds(round.settings.durationSeconds) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={!canEndRound(round) || busy}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setPending({ kind: "endRoundEarly", round, stage })}
                    >
                      {t("controller.endEarly")}
                    </button>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </section>

      {/* Reset / rematch (ROL-005) with its scope picker. */}
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">{t("controller.resetTitle")}</h2>
        <p className="mb-3 text-sm text-slate-600">{t("controller.resetHint")}</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-sm" htmlFor="reset-scope">
            {t("controller.resetScope")}
          </label>
          <select
            id="reset-scope"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={scope}
            disabled={closed || busy}
            onChange={(e) => setScope(e.target.value as ResetRematchScope)}
          >
            <option value="EVENT">{t("controller.scope.EVENT")}</option>
            <option value="ROUND">{t("controller.scope.ROUND")}</option>
            <option value="PARTICIPANT">{t("controller.scope.PARTICIPANT")}</option>
            <option value="TEAM">{t("controller.scope.TEAM")}</option>
          </select>

          {scope === "ROUND" && (
            <select
              aria-label={t("controller.resetTargetRound")}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={targetRoundId}
              disabled={closed || busy}
              onChange={(e) => setTargetRoundId(e.target.value)}
            >
              <option value="">{t("controller.resetTargetRound")}</option>
              {stages.flatMap((stage) =>
                stage.rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {t(`controller.stageType.${stage.type}`)} {stage.sequence} · {round.name}
                  </option>
                )),
              )}
            </select>
          )}

          {scope === "PARTICIPANT" && (
            <input
              aria-label={t("controller.resetTargetParticipant")}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              placeholder={t("controller.resetTargetParticipant")}
              value={targetParticipantId}
              disabled={closed || busy}
              onChange={(e) => setTargetParticipantId(e.target.value)}
            />
          )}

          {scope === "TEAM" && (
            <input
              aria-label={t("controller.resetTargetTeam")}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              placeholder={t("controller.resetTargetTeam")}
              value={targetTeamId}
              disabled={closed || busy}
              onChange={(e) => setTargetTeamId(e.target.value)}
            />
          )}

          <button
            type="button"
            disabled={closed || busy}
            className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPending({ kind: "resetRematch" })}
          >
            {t("controller.resetGo")}
          </button>
        </div>
      </section>

      {/* Big-screen display control (BSC-002). */}
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">{t("controller.bigScreenTitle")}</h2>
        <p className="mb-3 text-sm text-slate-600">
          {bigScreen
            ? `${t("controller.bigScreenMode")}: ${t(`controller.bigScreenModeName.${bigScreen.mode}`)} · ${
                bigScreen.rotationEnabled
                  ? t("controller.rotationOn")
                  : t("controller.rotationOff")
              }`
            : t("common.loading")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={closed || busy || bigScreen?.mode === "RANKING"}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onSetBigScreenMode("RANKING")}
          >
            {t("controller.bigScreenModeName.RANKING")}
          </button>
          <button
            type="button"
            disabled={closed || busy || bigScreen?.mode === "PAUSED"}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onSetBigScreenMode("PAUSED")}
          >
            {t("controller.bigScreenModeName.PAUSED")}
          </button>
          <button
            type="button"
            disabled={closed || busy || bigScreen?.mode === "FINAL"}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onSetBigScreenMode("FINAL")}
          >
            {t("controller.bigScreenModeName.FINAL")}
          </button>
          <button
            type="button"
            disabled={closed || busy || !bigScreen}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onToggleRotation()}
          >
            {bigScreen?.rotationEnabled
              ? t("controller.rotationDisable")
              : t("controller.rotationEnable")}
          </button>
        </div>
      </section>

      {/* Judge-equivalent student status and restart (spec Detail 6). */}
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <StudentsSupervisionPanel competitionId={competitionId} />
      </section>

      {/* Destructive, terminal actions. */}
      <section className="rounded-md border border-red-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-red-700">
          {t("controller.dangerTitle")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={closed || busy}
            className="rounded-md border border-amber-400 px-3 py-1 text-sm text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPending({ kind: "finishEarly" })}
          >
            {t("controller.finishEarly")}
          </button>
          <button
            type="button"
            disabled={closed || busy}
            className="rounded-md border border-red-400 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPending({ kind: "cancel" })}
          >
            {t("controller.cancel")}
          </button>
        </div>
        {closed && <p className="mt-2 text-sm text-slate-500">{t("controller.closedNote")}</p>}
      </section>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => (busy ? undefined : setPending(null))}
        >
          <div
            className="w-full max-w-md rounded-md bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">
              {pending.kind === "finishEarly" && t("controller.finishEarlyTitle")}
              {pending.kind === "cancel" && t("controller.cancelTitle")}
              {pending.kind === "endRoundEarly" && t("controller.endEarlyTitle")}
              {pending.kind === "resetRematch" && t("controller.resetConfirmTitle")}
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              {pending.kind === "finishEarly" && t("controller.finishEarlyBody")}
              {pending.kind === "cancel" && t("controller.cancelBody")}
              {pending.kind === "endRoundEarly" &&
                `${pending.round.name} — ${t("controller.endEarlyBody")}`}
              {pending.kind === "resetRematch" && t("controller.resetConfirmBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                onClick={() => setPending(null)}
                disabled={busy}
              >
                {t("controller.confirmCancel")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  if (pending.kind === "finishEarly") void onFinishEarly();
                  else if (pending.kind === "cancel") void onCancel();
                  else if (pending.kind === "endRoundEarly") void onEndRoundEarly(pending.round);
                  else void onResetRematch();
                }}
              >
                {t("controller.confirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
