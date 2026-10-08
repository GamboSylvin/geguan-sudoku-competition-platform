/**
 * The Round module's domain rules and public interface (Unit 07 — round runtime
 * and autosave). Other modules call this service, never the repository
 * (invariant 4).
 *
 * What lives here:
 *   - `startStage1Round1Preparation` — the internal dev-only trigger that starts
 *     stage 1's first round's preparation for a WAITING competition (spec step 7;
 *     Unit 11 replaces it with the real controller command surface).
 *   - The preparation → active transition: at the countdown's zero the questions
 *     are fetched (BLD-006 — never preloaded), the competition/stage/round flip
 *     to ACTIVE, and the round timer starts. Reached only through the timer
 *     service's installed hook, so the timer never imports this module (no cycle).
 *   - `pause()` / `resume()` / `remaining()` — the narrow surface Unit 11 will
 *     call. They wrap the timer service so the durable-state bookkeeping that
 *     accompanies the timer stays in one place.
 *
 * What does not live here: scoring, submissions, any controller-facing command
 * (Units 08 and 11).
 */
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../shared/errors";
import { logger } from "../../infra";
import { now } from "../../shared/clock";
import { translate } from "../../shared/i18n";
import * as repository from "./round.repository";
import {
  installStartActivePhaseHook,
  pause as pauseTimer,
  remaining as timerRemaining,
  resume as resumeTimer,
  startPreparationTimer,
  startRoundTimer,
  stopRoundEarly,
  cancelPreparation,
  restartRoundTimerFullDuration,
  getActiveRoundId,
} from "./round-timer.service";
import {
  ORCHESTRATOR_COMPETITION_CLOSED,
  ORCHESTRATOR_STAGE_NOT_FOUND,
  ORCHESTRATOR_STAGE_NOT_WAITING,
  ORCHESTRATOR_STAGE_OUT_OF_SEQUENCE,
} from "../orchestrator/orchestrator.types";
import type {
  RoundQuestionPayload,
  RoundStartedPayload,
  StartedPreparationResult,
  TimerSnapshot,
  TimerState,
} from "./round.types";

/**
 * Whoever needs to know a round started (the realtime gateway, via the Gameplay
 * module) installs this hook. Installed once at startup; keeps this module free
 * of any import from gameplay or realtime (invariant 4, no cycles).
 */
type RoundStartedHook = (payload: RoundStartedPayload) => void;
let roundStartedHook: RoundStartedHook | null = null;

export function installRoundStartedHook(hook: RoundStartedHook): void {
  roundStartedHook = hook;
}

// ---------------------------------------------------------------------------
// The dev-only internal trigger (spec step 7)
// ---------------------------------------------------------------------------

/**
 * Start a named stage's first round's preparation. **Unit 11's real command**
 * (`POST /api/competitions/:id/stages/:stageId/start`) — the dev-only trigger
 * below is a thin special case of it and stays for the tests that use it.
 *
 * Because `Stage` rows are per-competition and every category runs against the
 * same two stages, starting a stage here *is* starting it "for every category at
 * once" (spec Context, "Start a stage"): there is one `Stage` row, one round 1,
 * one preparation countdown, and the participants of every category join it.
 *
 * Rejections: 404 no such competition; 404 the stage is not this competition's;
 * 409 the competition is in a terminal state (`FINISHED`/`CANCELLED`); 409 the
 * stage is not `WAITING` (already started, or already active — spec Error Cases);
 * 409 a previous stage has not finished (out of sequence); 409 another round is
 * already running; 422 the stage has no round 1.
 */
async function startStagePreparation(
  competitionId: string,
  stageId: string,
): Promise<StartedPreparationResult> {
  const competition = await repository.findCompetitionWithStructure(competitionId);
  if (!competition) {
    throw new NotFoundError(translate("en", "competition.notFound"), {
      code: "competition.notFound",
    });
  }
  if (competition.status === "CANCELLED" || competition.status === "FINISHED") {
    throw new ConflictError(translate("en", "orchestrator.competitionClosed"), {
      code: ORCHESTRATOR_COMPETITION_CLOSED,
      details: { status: competition.status },
    });
  }

  const stage = competition.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new NotFoundError(translate("en", "orchestrator.stageNotFound"), {
      code: ORCHESTRATOR_STAGE_NOT_FOUND,
    });
  }
  if (stage.status !== "WAITING") {
    // "Start a stage that's already active, or out of sequence: rejected."
    throw new ConflictError(translate("en", "orchestrator.stageNotWaiting"), {
      code: ORCHESTRATOR_STAGE_NOT_WAITING,
      details: { status: stage.status },
    });
  }

  // Out of sequence: every earlier stage must already be finished (RND-006 — a
  // stage never starts by itself, and the controller may not skip one).
  const earlierUnfinished = competition.stages.filter(
    (s) => s.sequence < stage.sequence && s.status !== "FINISHED",
  );
  if (earlierUnfinished.length > 0) {
    throw new ConflictError(translate("en", "orchestrator.stageOutOfSequence"), {
      code: ORCHESTRATOR_STAGE_OUT_OF_SEQUENCE,
      details: { status: earlierUnfinished[0]?.status ?? "WAITING" },
    });
  }

  const round = stage.rounds.find((r) => r.sequence === 1);
  if (!round) {
    throw new UnprocessableEntityError(translate("en", "round.roundMissing"), {
      code: "round.roundMissing",
    });
  }

  const alreadyActive = await getActiveRoundId(competitionId);
  if (alreadyActive) {
    throw new ConflictError(translate("en", "round.alreadyActive"), {
      code: "round.alreadyActive",
    });
  }

  // The preparation length is locked the moment preparation starts (RND-002/004):
  // it is read once, here, and never re-read for this round.
  const preparationSeconds = round.settings?.preparationSeconds ?? 60;
  const startedAt = now();
  // Only the very first stage start opens the competition (Competition.startedAt
  // is the event's real start, not a per-stage one).
  const firstStart = competition.startedAt === null;

  await repository.setCompetitionStatus(competitionId, "PREPARATION", {
    ...(firstStart ? { startedAt } : {}),
  });
  await repository.setStageStatus(stage.id, "PREPARATION", { startedAt });
  await repository.setRoundStatus(round.id, "PREPARATION", { startedAt });
  await repository.upsertRuntimeState({
    competitionId,
    currentStageId: stage.id,
    currentRoundId: round.id,
    phase: "PREPARATION",
  });

  await startPreparationTimer(round.id, competitionId, stage.id, preparationSeconds);

  return {
    competitionId,
    stageId: stage.id,
    roundId: round.id,
    status: "PREPARATION",
    preparationSeconds,
  };
}

/**
 * Start stage 1 round 1's preparation for a WAITING competition. Dev-only: the
 * HTTP route refuses to run in production and requires a controller session.
 * Kept as the narrow form Unit 11's `startStagePreparation` generalizes.
 */
async function startStage1Round1Preparation(
  competitionId: string,
): Promise<StartedPreparationResult> {
  const competition = await repository.findCompetitionWithStructure(competitionId);
  if (!competition) {
    throw new NotFoundError(translate("en", "competition.notFound"), {
      code: "competition.notFound",
    });
  }
  if (competition.status !== "WAITING") {
    throw new ConflictError(translate("en", "round.competitionNotWaiting"), {
      code: "round.competitionNotWaiting",
    });
  }

  const stage = competition.stages.find((s) => s.type === "INDIVIDUAL" && s.sequence === 1);
  if (!stage) {
    throw new UnprocessableEntityError(translate("en", "round.stageMissing"), {
      code: "round.stageMissing",
    });
  }
  return startStagePreparation(competitionId, stage.id);
}

// ---------------------------------------------------------------------------
// Preparation → active transition (reached via the timer's installed hook)
// ---------------------------------------------------------------------------

/**
 * Called by the timer service when a preparation countdown reaches zero. Fetches
 * the round's questions — only now, never earlier (BLD-006) — flips the durable
 * state to ACTIVE, starts the round timer, and notifies the installed
 * round-started hook (which pushes the questions to the clients).
 */
async function startActivePhaseFromTimer(state: TimerState): Promise<void> {
  try {
    const round = await repository.findRoundWithContext(state.roundId);
    if (!round || round.stage.competitionId !== state.competitionId) {
      logger.error("round.startActive: round context mismatch", {
        roundId: state.roundId,
        competitionId: state.competitionId,
      });
      return;
    }

    const questionRows = await repository.listRoundQuestions(state.roundId);
    const questions: RoundQuestionPayload[] = questionRows.map((q) => ({
      id: q.id,
      sequence: q.sequence,
      type: q.type,
      gridRows: q.gridRows,
      gridColumns: q.gridColumns,
      regions: q.regions,
      startingGrid: q.startingGrid,
      points: q.points,
    }));

    const durationSeconds = round.settings?.durationSeconds ?? 0;
    const startedAt = now();

    await repository.setCompetitionStatus(state.competitionId, "ROUND_ACTIVE");
    await repository.setStageStatus(state.stageId, "ACTIVE");
    await repository.setRoundStatus(state.roundId, "ACTIVE", { startedAt });
    await repository.upsertRuntimeState({
      competitionId: state.competitionId,
      currentStageId: state.stageId,
      currentRoundId: state.roundId,
      phase: "ROUND_ACTIVE",
    });

    await startRoundTimer(state.roundId, state.competitionId, state.stageId, durationSeconds);

    roundStartedHook?.({
      roundId: state.roundId,
      stageId: state.stageId,
      competitionId: state.competitionId,
      durationSeconds,
      questions,
    });
  } catch (error) {
    logger.error("round.startActive: failed to start the active phase", {
      roundId: state.roundId,
      competitionId: state.competitionId,
      error,
    });
  }
}

// Installed at module load: the timer's preparation-zero path lands here. The
// timer never imports this module, so there is no import cycle.
installStartActivePhaseHook((state) => startActivePhaseFromTimer(state));

// ---------------------------------------------------------------------------
// The narrow pause/resume/remaining surface Unit 11 will call
// ---------------------------------------------------------------------------

/**
 * Pause the competition's running timer (preparation or round). Idempotent:
 * pausing an already-paused round returns the current snapshot. 404 if the
 * competition has no active round timer.
 */
async function pause(competitionId: string): Promise<TimerSnapshot> {
  const roundId = await getActiveRoundId(competitionId);
  if (!roundId) {
    throw new NotFoundError(translate("en", "round.noActiveTimer"), {
      code: "round.noActiveTimer",
    });
  }
  return pauseTimer(roundId);
}

/**
 * Resume a paused timer. Plays "3, 2, 1, Start" first (RND-001): the deadline
 * only moves after the countdown, so the countdown uses neither round nor
 * preparation time. Resuming a timer that is not paused returns the current
 * snapshot; 404 if the competition has no active round timer.
 */
async function resume(competitionId: string): Promise<TimerSnapshot> {
  const roundId = await getActiveRoundId(competitionId);
  if (!roundId) {
    throw new NotFoundError(translate("en", "round.noActiveTimer"), {
      code: "round.noActiveTimer",
    });
  }
  return resumeTimer(roundId);
}

/**
 * The competition's current timer snapshot, or null when no round timer is
 * running. The remaining seconds are always computed from the server clock
 * (invariant 3).
 */
async function remaining(competitionId: string): Promise<TimerSnapshot | null> {
  const roundId = await getActiveRoundId(competitionId);
  if (!roundId) {
    return null;
  }
  return timerRemaining(roundId);
}

/** The round id currently in flight for a competition, or null. */
function getActiveRoundForCompetition(competitionId: string): Promise<string | null> {
  return getActiveRoundId(competitionId);
}

/**
 * End the competition's currently-running round before its deadline (Unit 11's
 * "end a round early", SUB-004). Thin wrapper over the timer service's stop, so
 * the durable-state bookkeeping stays in one place; the caller (the Orchestrator)
 * then drives Unit 08's auto-submit and advance chain. Returns null when nothing
 * is running — the command is a no-op in that case, not an error, because the
 * round may have ended on its own between the controller's click and this call.
 */
async function stopRoundEarlyForCompetition(
  competitionId: string,
): Promise<TimerSnapshot | null> {
  const roundId = await getActiveRoundId(competitionId);
  if (!roundId) return null;
  return stopRoundEarly(roundId);
}

/**
 * Abandon a running preparation countdown (Unit 11's finish-early / cancel).
 * Returns false when no preparation was running.
 */
async function cancelPreparationForCompetition(
  competitionId: string,
): Promise<boolean> {
  const roundId = await getActiveRoundId(competitionId);
  if (!roundId) return false;
  return cancelPreparation(roundId);
}

/**
 * Give a running round its full duration again (Unit 11's reset/rematch,
 * ROL-005 / resolves U-13 — a rematch grants **full** round time, not remaining).
 * Returns null when the round has no live timer.
 */
async function grantFullRoundDuration(
  roundId: string,
  durationSeconds: number,
): Promise<TimerSnapshot | null> {
  return restartRoundTimerFullDuration(roundId, durationSeconds);
}

export const roundService = {
  startStage1Round1Preparation,
  startStagePreparation,
  installRoundStartedHook,
  pause,
  resume,
  remaining,
  getActiveRoundForCompetition,
  stopRoundEarlyForCompetition,
  cancelPreparationForCompetition,
  grantFullRoundDuration,
};
