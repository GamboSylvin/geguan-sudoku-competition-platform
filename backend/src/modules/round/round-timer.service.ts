/**
 * The server-authoritative round timer (Unit 07). Owns the countdown clocks for
 * preparation and the round itself; the only places Unit 11 (and reconnect, and
 * restart recovery) need to look are `pause()`, `resume()` and `remaining()`.
 *
 * Two stores, two jobs (BLD-007):
 *   - Durable state transitions (Round.status, Stage.status, Competition.status,
 *     CompetitionRuntimeState) go through `round.repository` to PostgreSQL.
 *   - The in-flight countdown (the deadline, the paused remaining) lives in Redis
 *     with persistence on, so a server restart recovers the paused state. The
 *     Redis client is the shared `infra/redis` one.
 *
 * The tick loop is in-process and Node-scheduled (`setTimeout`). It is *not* the
 * source of truth — the deadline epoch-ms is — so a delayed or skipped tick
 * changes the client's display cadence, never the round's actual end. The
 * deadline is the authority (invariant 3).
 *
 * `setTimeout` delays above 2^31-1 ms overflow Node; round durations here are
 * minutes, so this is not a concern in practice.
 */
import { setTimeout as scheduleTimeout, clearTimeout } from "node:timers";
import { prisma, redis, logger } from "../../infra";
import { now, nowMs, secondsUntil } from "../../shared/clock";
import { NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import * as repository from "./round.repository";
import type {
  CompetitionPhase,
  RoundEndedEvent,
  TimerSnapshot,
  TimerState,
} from "./round.types";

/** How long the resume "3, 2, 1, Start" lasts (RND-001). */
export const RESUME_COUNTDOWN_SECONDS = 3;

/** Redis key prefix for the per-round timer blob. */
const TIMER_KEY_PREFIX = "round:timer:";
/** Redis key prefix for "which round is currently active on this competition". */
const ACTIVE_KEY_PREFIX = "round:active:";

/** Subscribers for the "round ended" signal (Unit 08 attaches here). */
type RoundEndedListener = (event: RoundEndedEvent) => void | Promise<void>;
const roundEndedListeners = new Set<RoundEndedListener>();

/**
 * Subscribers for tick payloads — the realtime gateway subscribes and pushes to
 * clients. Subscriptions are synchronous and *not* Redis-backed (BLD-033 allows
 * in-process events inside the competition/game-execution subsystem).
 */
export type TickListener = (state: TimerState, remainingSeconds: number) => void;
const tickListeners = new Set<TickListener>();

/** Subscribers for the resume transition (the "3, 2, 1, Start"). */
export type ResumeListener = (state: TimerState, resumesAtMs: number) => void;
const resumeListeners = new Set<ResumeListener>();

/** Subscribers for the pause transition. */
export type PauseListener = (state: TimerState) => void;
const pauseListeners = new Set<PauseListener>();

/** Subscribers for the round-start transition. */
export type StartListener = (state: TimerState) => void;
const startListeners = new Set<StartListener>();

/** In-memory handle to the scheduled wakeup for one running round. */
const scheduledWakeups = new Map<string, NodeJS.Timeout>();

function timerKey(roundId: string): string {
  return `${TIMER_KEY_PREFIX}${roundId}`;
}
function activeKey(competitionId: string): string {
  return `${ACTIVE_KEY_PREFIX}${competitionId}`;
}

// ---------------------------------------------------------------------------
// Persistence of the in-flight timer (Redis, BLD-007)
// ---------------------------------------------------------------------------

async function saveTimerState(state: TimerState): Promise<void> {
  await redis.set(timerKey(state.roundId), JSON.stringify(state));
}

async function loadTimerState(roundId: string): Promise<TimerState | null> {
  const raw = await redis.get(timerKey(roundId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TimerState;
  } catch {
    logger.warn("round timer: corrupt Redis blob ignored", { roundId });
    return null;
  }
}

async function deleteTimerState(roundId: string): Promise<void> {
  await redis.del(timerKey(roundId));
}

async function setActiveRound(competitionId: string, roundId: string): Promise<void> {
  await redis.set(activeKey(competitionId), roundId);
}

/** The competition's currently running (or paused) round, if any. */
export async function getActiveRoundId(competitionId: string): Promise<string | null> {
  return redis.get(activeKey(competitionId));
}

async function clearActiveRound(competitionId: string, roundId: string): Promise<void> {
  const current = await redis.get(activeKey(competitionId));
  if (current === roundId) {
    await redis.del(activeKey(competitionId));
  }
}

// ---------------------------------------------------------------------------
// Pub/sub (in-process; Unit 08 / the realtime gateway subscribe from here)
// ---------------------------------------------------------------------------

export function onRoundEnded(listener: RoundEndedListener): () => void {
  roundEndedListeners.add(listener);
  return () => roundEndedListeners.delete(listener);
}
export function onTick(listener: TickListener): () => void {
  tickListeners.add(listener);
  return () => tickListeners.delete(listener);
}
export function onResume(listener: ResumeListener): () => void {
  resumeListeners.add(listener);
  return () => resumeListeners.delete(listener);
}
export function onPause(listener: PauseListener): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}
export function onStart(listener: StartListener): () => void {
  startListeners.add(listener);
  return () => startListeners.delete(listener);
}

async function emitRoundEnded(event: RoundEndedEvent): Promise<void> {
  for (const listener of roundEndedListeners) {
    try {
      await listener(event);
    } catch (error) {
      logger.error("round timer: a round-ended listener threw", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function emitTick(state: TimerState, remainingSeconds: number): void {
  for (const listener of tickListeners) {
    try {
      listener(state, remainingSeconds);
    } catch (error) {
      logger.error("round timer: a tick listener threw", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
function emitResume(state: TimerState, resumesAtMs: number): void {
  for (const listener of resumeListeners) {
    try {
      listener(state, resumesAtMs);
    } catch (error) {
      logger.error("round timer: a resume listener threw", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
function emitPause(state: TimerState): void {
  for (const listener of pauseListeners) {
    try {
      listener(state);
    } catch (error) {
      logger.error("round timer: a pause listener threw", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
function emitStart(state: TimerState): void {
  for (const listener of startListeners) {
    try {
      listener(state);
    } catch (error) {
      logger.error("round timer: a start listener threw", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// The schedule loop
// ---------------------------------------------------------------------------

/**
 * Schedule a wakeup at the state's deadline. Each tick emits a tick to listeners
 * and either re-arms (still time left) or completes the round (deadline reached).
 * A tick that's late (event-loop delay) just sees a smaller remaining — the
 * deadline in Redis is what decides when the round ends.
 */
function scheduleWakeup(state: TimerState): void {
  cancelWakeup(state.roundId);

  const tickMs = 250; // display cadence; not authoritative
  const delay = Math.max(0, Math.min(state.deadlineMs - nowMs(), tickMs));
  const handle = scheduleTimeout(async () => {
    scheduledWakeups.delete(state.roundId);
    try {
      await tick(state.roundId);
    } catch (error) {
      logger.error("round timer: tick failed", {
        roundId: state.roundId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, delay);
  scheduledWakeups.set(state.roundId, handle);
}

function cancelWakeup(roundId: string): void {
  const existing = scheduledWakeups.get(roundId);
  if (existing) {
    clearTimeout(existing);
    scheduledWakeups.delete(roundId);
  }
}

/**
 * One tick: read the latest state, decide whether to emit a tick, complete the
 * round, or do nothing (paused or already-ended). Never throws.
 */
async function tick(roundId: string): Promise<void> {
  const state = await loadTimerState(roundId);
  if (!state) return;
  if (state.status === "PAUSED") return; // nothing scheduled while paused
  if (state.status === "FINISHED") return;

  const remaining = secondsUntil(state.deadlineMs);
  if (remaining > 0) {
    emitTick(state, remaining);
    scheduleWakeup(state);
    return;
  }

  // Deadline reached: complete this phase.
  await completePhase(state);
}

/**
 * Transition out of the current phase at deadline. For `preparation` → start
 * the round (this module's service does the question fetch; see `startActivePhaseFromTimer`
 * below). For `round` → mark the round FINISHED and emit the round-ended signal.
 *
 * This function is what `round.service` plugs its "start the active phase" hook
 * into, so the question-fetch and the `round:started` broadcast happen exactly
 * once, exactly at the deadline, on the server.
 *
 * `options.earlyEnded` is set only by Unit 11's "end a round early" command,
 * which reaches the same transition deliberately instead of at the deadline
 * (SUB-004). It writes the `Round.earlyEnded` flag the schema has always carried
 * and nothing else ever sets.
 */
async function completePhase(
  state: TimerState,
  options: { earlyEnded?: boolean } = {},
): Promise<void> {
  if (state.mode === "preparation") {
    const hook = startActivePhaseHook;
    if (!hook) {
      logger.error("round timer: no start-active hook installed", { roundId: state.roundId });
      return;
    }
    await hook(state);
    return;
  }
  // mode === "round": the round ends here. Scoring and the next round's
  // preparation are Unit 08's job (invariant 7); this unit only emits the signal.
  await repository.setRoundStatus(state.roundId, "FINISHED", {
    endedAt: now(),
    earlyEnded: state.mode === "round" && Boolean(options.earlyEnded),
  });
  await repository.upsertRuntimeState({
    competitionId: state.competitionId,
    currentStageId: state.stageId,
    currentRoundId: state.roundId,
    phase: "ROUND_FINISHED" satisfies CompetitionPhase,
  });
  await deleteTimerState(state.roundId);
  await clearActiveRound(state.competitionId, state.roundId);
  const endedState: TimerState = { ...state, status: "FINISHED" };
  emitTick(endedState, 0);
  await emitRoundEnded({
    roundId: state.roundId,
    stageId: state.stageId,
    competitionId: state.competitionId,
    endedAtMs: nowMs(),
  });
}

/** Hook the round.service installs: called when preparation reaches zero. */
type StartActivePhaseHook = (state: TimerState) => Promise<void>;
let startActivePhaseHook: StartActivePhaseHook | null = null;
export function installStartActivePhaseHook(hook: StartActivePhaseHook): void {
  startActivePhaseHook = hook;
}

// ---------------------------------------------------------------------------
// Public interface (narrow, stable — Unit 11 depends on this exact surface)
// ---------------------------------------------------------------------------

/**
 * Begin the preparation countdown for a round. Called by `round.service` after
 * the durable state has been moved to `PREPARATION`. Returns the snapshot the
 * caller broadcasts to clients.
 */
export async function startPreparationTimer(
  roundId: string,
  competitionId: string,
  stageId: string,
  preparationSeconds: number,
): Promise<TimerSnapshot> {
  const deadlineMs = nowMs() + preparationSeconds * 1000;
  const state: TimerState = {
    roundId,
    competitionId,
    stageId,
    mode: "preparation",
    status: "PREPARATION",
    deadlineMs,
    totalSeconds: preparationSeconds,
    pausedRemainingSeconds: null,
  };
  await saveTimerState(state);
  await setActiveRound(competitionId, roundId);
  scheduleWakeup(state);
  return {
    roundId,
    status: state.status,
    remainingSeconds: preparationSeconds,
    totalSeconds: preparationSeconds,
  };
}

/**
 * Begin the round-active timer. Called by `round.service` after the durable
 * state has been moved to `ACTIVE` and the questions have been fetched.
 */
export async function startRoundTimer(
  roundId: string,
  competitionId: string,
  stageId: string,
  durationSeconds: number,
): Promise<TimerSnapshot> {
  const deadlineMs = nowMs() + durationSeconds * 1000;
  const state: TimerState = {
    roundId,
    competitionId,
    stageId,
    mode: "round",
    status: "ACTIVE",
    deadlineMs,
    totalSeconds: durationSeconds,
    pausedRemainingSeconds: null,
  };
  await saveTimerState(state);
  await setActiveRound(competitionId, roundId);
  scheduleWakeup(state);
  emitStart(state);
  return {
    roundId,
    status: state.status,
    remainingSeconds: durationSeconds,
    totalSeconds: durationSeconds,
  };
}

/**
 * Grant a round its full duration again (Unit 11's reset/rematch, ROL-005 /
 * resolves U-13). This is the timer half of a rematch and is deliberately
 * separate from `startRoundTimer`: an already-running round keeps its mode,
 * status and question set — only the deadline moves back to `now + full
 * duration`, and any pause is cleared so the round is running again. Returns
 * null when the round has no live timer (nothing running to rematch).
 *
 * The durable `Round.status` and `RoundParticipation` writes are the caller's
 * job: the timer owns only the clock (invariant 3 — the server clock/deadline is
 * the timer authority, nothing else may set a deadline).
 */
export async function restartRoundTimerFullDuration(
  roundId: string,
  durationSeconds: number,
): Promise<TimerSnapshot | null> {
  const state = await loadTimerState(roundId);
  if (!state || state.status === "FINISHED") return null;
  if (state.mode !== "round") return null;

  const restarted: TimerState = {
    ...state,
    status: "ACTIVE",
    deadlineMs: nowMs() + durationSeconds * 1000,
    totalSeconds: durationSeconds,
    pausedRemainingSeconds: null,
  };
  await saveTimerState(restarted);
  await setActiveRound(restarted.competitionId, roundId);
  scheduleWakeup(restarted);
  emitStart(restarted);

  return {
    roundId,
    status: restarted.status,
    remainingSeconds: durationSeconds,
    totalSeconds: durationSeconds,
  };
}

/**
 * Pause whichever phase is currently running. Idempotent on an already-paused
 * round. Rejects a round with no running timer.
 */
export async function pause(roundId: string): Promise<TimerSnapshot> {
  const state = await loadTimerState(roundId);
  if (!state) {
    throw new NotFoundError(translate("en", "round.noActiveTimer"), {
      code: "round.noActiveTimer",
    });
  }
  if (state.status === "PAUSED") {
    const pausedRemaining = state.pausedRemainingSeconds ?? secondsUntil(state.deadlineMs);
    return {
      roundId,
      status: state.status,
      remainingSeconds: pausedRemaining,
      totalSeconds: state.totalSeconds,
    };
  }
  if (state.status === "FINISHED") {
    return { roundId, status: state.status, remainingSeconds: 0, totalSeconds: state.totalSeconds };
  }

  const remaining = secondsUntil(state.deadlineMs);
  const paused: TimerState = {
    ...state,
    status: "PAUSED",
    pausedRemainingSeconds: remaining,
  };
  await saveTimerState(paused);
  cancelWakeup(roundId);

  await repository.setRoundStatus(roundId, "PAUSED");
  await repository.upsertRuntimeState({
    competitionId: state.competitionId,
    currentStageId: state.stageId,
    currentRoundId: roundId,
    phase: "PAUSED" satisfies CompetitionPhase,
    pausedAt: now(),
    remainingSecondsAtPause: remaining,
  });

  emitPause(paused);
  return {
    roundId,
    status: paused.status,
    remainingSeconds: remaining,
    totalSeconds: state.totalSeconds,
  };
}

/**
 * Resume a paused round: plays "3, 2, 1, Start" (RESUME_COUNTDOWN_SECONDS) and
 * then continues from exactly the preserved remaining. Idempotent on a running
 * round; rejects a round with no running timer.
 *
 * During the 3-2-1 window the round's stored status stays `PAUSED` and the
 * deadline has not moved; only once the countdown expires does the deadline
 * shift forward by the countdown length and the round go back to its mode's
 * status. RND-001: the 3-2-1 uses neither round time nor preparation time.
 */
export async function resume(roundId: string): Promise<TimerSnapshot> {
  const state = await loadTimerState(roundId);
  if (!state) {
    throw new NotFoundError(translate("en", "round.noActiveTimer"), {
      code: "round.noActiveTimer",
    });
  }
  if (state.status !== "PAUSED") {
    const remaining = secondsUntil(state.deadlineMs);
    return { roundId, status: state.status, remainingSeconds: remaining, totalSeconds: state.totalSeconds };
  }

  const pausedRemaining = state.pausedRemainingSeconds ?? 0;
  const resumesAtMs = nowMs() + RESUME_COUNTDOWN_SECONDS * 1000;
  const newDeadlineMs = resumesAtMs + pausedRemaining * 1000;
  const newStatus = state.mode === "preparation" ? "PREPARATION" : "ACTIVE";

  const resumed: TimerState = {
    ...state,
    status: newStatus,
    deadlineMs: newDeadlineMs,
    pausedRemainingSeconds: null,
  };
  await saveTimerState(resumed);

  await repository.setRoundStatus(roundId, newStatus);
  await repository.upsertRuntimeState({
    competitionId: state.competitionId,
    currentStageId: state.stageId,
    currentRoundId: roundId,
    phase: (newStatus === "PREPARATION" ? "PREPARATION" : "ROUND_ACTIVE") satisfies CompetitionPhase,
    pausedAt: null,
    remainingSecondsAtPause: null,
  });

  emitResume(resumed, resumesAtMs);

  // Wake up after the 3-2-1 has fully played and the countdown is running.
  cancelWakeup(roundId);
  const handle = scheduleTimeout(async () => {
    scheduledWakeups.delete(roundId);
    try {
      await tick(roundId);
    } catch (error) {
      logger.error("round timer: resume tick failed", {
        roundId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, RESUME_COUNTDOWN_SECONDS * 1000);
  scheduledWakeups.set(roundId, handle);

  return {
    roundId,
    status: resumed.status,
    remainingSeconds: pausedRemaining,
    totalSeconds: state.totalSeconds,
  };
}

/**
 * End the running round's phase immediately, before its deadline (Unit 11's "end
 * a round early", SUB-004). It performs exactly the same transition the deadline
 * tick would have — `completePhase` is the single place that ends a round — with
 * the one addition that `Round.earlyEnded` is set, and with the wakeup cancelled
 * first so the deadline tick cannot fire a second time.
 *
 * The deadline authority stays on the server (invariant 3): this function is a
 * command, not a client-supplied time. It is idempotent — a round with no live
 * timer returns null and the caller reports "nothing to end".
 *
 * Only a round-mode timer can be ended early. A preparation countdown is not a
 * round in progress; ending it would start the active phase instead, which is
 * the opposite of the command's meaning.
 */
export async function stopRoundEarly(roundId: string): Promise<TimerSnapshot | null> {
  const state = await loadTimerState(roundId);
  if (!state) return null;
  if (state.status === "FINISHED") return null;
  if (state.mode !== "round") return null;

  cancelWakeup(roundId);
  await completePhase(state, { earlyEnded: true });

  return { roundId, status: "FINISHED", remainingSeconds: 0, totalSeconds: state.totalSeconds };
}

/**
 * Abandon a running preparation countdown (Unit 11's "finish the competition
 * early" / "cancel", RND-007 / ROL-009). The round never entered its active
 * phase, so there is nothing to score: the timer state is dropped, the round
 * goes back to `WAITING` and the competition's active-round slot is released.
 * Returns false when no preparation countdown was running.
 */
export async function cancelPreparation(roundId: string): Promise<boolean> {
  const state = await loadTimerState(roundId);
  if (!state || state.status === "FINISHED" || state.mode !== "preparation") return false;

  cancelWakeup(roundId);
  await deleteTimerState(roundId);
  await clearActiveRound(state.competitionId, roundId);
  await repository.setRoundStatus(roundId, "WAITING");
  return true;
}

/**
 * The authoritative remaining seconds for a round. Zero if the round is not
 * running. Safe to call any time, including after the round has finished.
 */
export async function remaining(roundId: string): Promise<TimerSnapshot | null> {
  const state = await loadTimerState(roundId);
  if (!state) return null;
  const remainingSeconds =
    state.status === "PAUSED"
      ? state.pausedRemainingSeconds ?? 0
      : state.status === "FINISHED"
        ? 0
        : secondsUntil(state.deadlineMs);
  return {
    roundId,
    status: state.status,
    remainingSeconds,
    totalSeconds: state.totalSeconds,
  };
}

/**
 * Restart-recovery entry point (BLD-007): on boot, look at every competition's
 * runtime state and re-arm any paused or in-flight timers. After a restart the
 * competition comes back PAUSED (the actual resume/replay choice is Unit 11's);
 * this function only re-arms what's recoverable.
 *
 * For the MVP we do not try to resume in-flight (non-paused) deadlines across a
 * server restart: the spec's recovery semantic is "comes back paused". Any
 * timer found in a non-paused state is treated as if a pause happened at the
 * restart moment, which matches that semantic.
 */
export async function recoverAfterRestart(): Promise<void> {
  // Find runtime states that point at a current round in a recoverable status.
  const runtimes = await listRuntimeStatesNeedingRecovery();
  for (const rt of runtimes) {
    if (!rt.currentRoundId) continue;
    const state = await loadTimerState(rt.currentRoundId);
    if (!state) continue;
    if (state.status === "FINISHED") continue;
    if (state.status === "PAUSED") continue; // already what we want
    // Mark paused with whatever is left; do not reschedule a wakeup.
    const remainingSeconds = secondsUntil(state.deadlineMs);
    const paused: TimerState = {
      ...state,
      status: "PAUSED",
      pausedRemainingSeconds: remainingSeconds,
    };
    await saveTimerState(paused);
    await repository.setRoundStatus(rt.currentRoundId, "PAUSED");
    await repository.upsertRuntimeState({
      competitionId: rt.competitionId,
      currentStageId: rt.currentStageId,
      currentRoundId: rt.currentRoundId,
      phase: "PAUSED",
      pausedAt: now(),
      remainingSecondsAtPause: remainingSeconds,
    });
    logger.info("round timer: recovered as paused after restart", {
      roundId: rt.currentRoundId,
      competitionId: rt.competitionId,
      remainingSeconds,
    });
  }
}

// ---------------------------------------------------------------------------
// Restart recovery
// ---------------------------------------------------------------------------

async function listRuntimeStatesNeedingRecovery() {
  return prisma.competitionRuntimeState.findMany({
    where: {
      currentRoundId: { not: null },
      phase: { in: ["PREPARATION", "ROUND_ACTIVE"] },
    },
  });
}

export const roundTimerService = {
  startPreparationTimer,
  startRoundTimer,
  stopRoundEarly,
  cancelPreparation,
  restartRoundTimerFullDuration,
  pause,
  resume,
  remaining,
  getActiveRoundId,
  onRoundEnded,
  onTick,
  onResume,
  onPause,
  onStart,
  installStartActivePhaseHook,
  recoverAfterRestart,
};
