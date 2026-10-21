/**
 * Unit 11's sequence commands (spec Implementation Details 1–4): start a stage,
 * global pause/resume, end a round early, finish the competition early.
 *
 * This module owns the *decisions* — is this competition open, is this stage next,
 * is there anything to pause — and delegates every state change to the module that
 * owns that state: the Round module's timer for pause/resume/stop, the Gameplay
 * module for the auto-submit-and-score chain, the BigScreen module for what the
 * screens show. Nothing here touches Prisma directly except through
 * `orchestrator.repository` (invariant 4).
 *
 * **Finding (spec wording vs. as-built schema, flagged for sign-off):** the spec
 * says a start/pause command acts on "every category at once". `Stage` rows are
 * per-*competition*, not per-category — `competition.service.buildStructure`
 * creates exactly one INDIVIDUAL and one TEAM stage that every category runs
 * against in parallel. So "for every category" is structurally automatic: there is
 * one stage row, one round 1, one countdown, and one active round per competition
 * (Redis `round:active:<competitionId>` holds a single roundId). No per-category
 * loop exists to write, and the spec forbids a schema change. The command surface
 * and the acceptance criteria are satisfied either way.
 */
import { now } from "../../shared/clock";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { bigScreenService } from "../big-screen";
import { gameplayService } from "../gameplay";
import { roundService } from "../round";
import * as repository from "./orchestrator.repository";
import {
  ORCHESTRATOR_COMPETITION_CLOSED,
  ORCHESTRATOR_NOTHING_TO_PAUSE,
  ORCHESTRATOR_NOTHING_TO_RESUME,
  ORCHESTRATOR_ROUND_NOT_FOUND,
  ORCHESTRATOR_ROUND_NOT_IN_COMPETITION,
  ORCHESTRATOR_ROUND_NOT_RUNNING,
  type EndRoundEarlyResult,
  type FinishEarlyResult,
} from "./orchestrator.types";

/**
 * Reject a command that arrived after the competition reached a terminal state.
 * Used by every command in this unit (spec Error Cases: "Any command on a
 * `CANCELLED` competition (other than read access): rejected"). Returns the row it
 * loaded so the caller does not read it twice.
 */
export async function requireOpenCompetition(competitionId: string) {
  const competition = await repository.findCompetition(competitionId);
  if (!competition) {
    throw new NotFoundError(translate("en", "competition.notFound"), {
      code: "competition.notFound",
    });
  }
  if (competition.status === "FINISHED" || competition.status === "CANCELLED") {
    throw new ConflictError(translate("en", ORCHESTRATOR_COMPETITION_CLOSED), {
      code: ORCHESTRATOR_COMPETITION_CLOSED,
      details: { status: competition.status },
    });
  }
  return competition;
}

/**
 * Start a stage (spec Detail 1). Delegates to the Round module's preparation
 * start, which already holds the `WAITING`-and-in-sequence rules; this wrapper adds
 * the competition-level check the Round module deliberately does not make (a stage
 * may be started from `WAITING` *and* from `STAGE_FINISHED`/`ROUND_FINISHED` — the
 * point of the command is that the next stage never starts by itself, RND-006).
 */
async function startStage(competitionId: string, stageId: string) {
  await requireOpenCompetition(competitionId);
  const started = await roundService.startStagePreparation(competitionId, stageId);
  // The screens leave FINAL/PAUSED on their own when the next stage begins.
  await bigScreenService.setMode({ competitionId, mode: "RANKING" });
  return started;
}

/**
 * Global pause (spec Detail 2). Freezes the competition's one running timer at its
 * exact remaining value; `CompetitionRuntimeState.pausedAt` /
 * `remainingSecondsAtPause` are written by the timer service itself, so the
 * bookkeeping stays in one place. Idempotent at the timer level, but a competition
 * with no running timer is rejected — "nothing to pause" is the spec's named error.
 */
async function pauseCompetition(competitionId: string) {
  await requireOpenCompetition(competitionId);
  const snapshot = await roundService.pause(competitionId).catch((error) => {
    // The Round module reports "no active timer" as a 404; the spec reports this
    // command's rejection as its own code, so translate it here rather than
    // leaking a round-module code to the controller's dashboard.
    if ((error as { code?: string }).code === "round.noActiveTimer") {
      throw new ConflictError(translate("en", ORCHESTRATOR_NOTHING_TO_PAUSE), {
        code: ORCHESTRATOR_NOTHING_TO_PAUSE,
      });
    }
    throw error;
  });
  await bigScreenService.setMode({ competitionId, mode: "PAUSED" });
  return snapshot;
}

/**
 * Global resume (spec Detail 2). The Round module plays "3, 2, 1, Start" and only
 * moves the deadline after that countdown, so the countdown consumes neither round
 * nor preparation time (RND-001).
 */
async function resumeCompetition(competitionId: string) {
  await requireOpenCompetition(competitionId);
  const snapshot = await roundService.resume(competitionId).catch((error) => {
    if ((error as { code?: string }).code === "round.noActiveTimer") {
      throw new ConflictError(translate("en", ORCHESTRATOR_NOTHING_TO_RESUME), {
        code: ORCHESTRATOR_NOTHING_TO_RESUME,
      });
    }
    throw error;
  });
  await bigScreenService.setMode({ competitionId, mode: "RANKING" });
  return snapshot;
}

/**
 * Close one round before its deadline (spec Detail 3, SUB-004). Cannot be undone:
 * the round's `earlyEnded` flag is written by the timer service's own end
 * transition, and every still-open participation is scored with
 * `submissionType = CONTROLLER_END`, which earns no early bonus because the Scoring
 * module pays the bonus for a `MANUAL` submit only.
 *
 * Order matters. The participations are closed *first*, then the timer is stopped:
 * `stopRoundEarly` fires the round-ended signal, and the Gameplay module's
 * round-ended handler auto-submits whatever is still open with `TIMEOUT`. Closing
 * first means that second pass finds nothing open (PL-009 makes it a no-op) and the
 * bonus-free `CONTROLLER_END` type is the one that sticks.
 */
async function endRoundEarly(
  competitionId: string,
  roundId: string,
): Promise<EndRoundEarlyResult> {
  await requireOpenCompetition(competitionId);

  const round = await repository.findRoundForCommand(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_ROUND_NOT_FOUND), {
      code: ORCHESTRATOR_ROUND_NOT_FOUND,
    });
  }
  if (round.stage.competitionId !== competitionId) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_ROUND_NOT_IN_COMPETITION), {
      code: ORCHESTRATOR_ROUND_NOT_IN_COMPETITION,
    });
  }

  // Already over — the deadline may have passed between the controller's click and
  // this call. Report it as a no-op rather than an error: nothing to undo, nothing
  // to redo.
  if (round.status === "FINISHED") {
    return { roundId, closedCount: 0, alreadyFinished: true };
  }
  // A round that never started has nothing to close, and ending it would silently
  // score every participant 0 — a different command from the one the controller
  // meant. Rejected with the "not running" code Unit 10 already uses.
  if (round.status === "WAITING") {
    throw new ConflictError(translate("en", ORCHESTRATOR_ROUND_NOT_RUNNING), {
      code: ORCHESTRATOR_ROUND_NOT_RUNNING,
      details: { status: round.status },
    });
  }

  const closed = await gameplayService.closeAllActiveParticipations({
    roundId,
    submissionType: "CONTROLLER_END",
    submittedAtMs: Date.now(),
  });

  // Stop the timer: it marks the round FINISHED with `earlyEnded = true`, clears
  // the competition's active round, and fires the round-ended signal that drives
  // Unit 08's normal finalize-and-advance chain (spec Detail 3).
  //
  // Which stop to use depends on the phase, because the competition has exactly
  // one live timer and it is not necessarily this round's: only a round that is
  // ACTIVE/PAUSED *is* that timer. A round still in PREPARATION must be abandoned
  // instead, so stopping it can never stop some other round's timer.
  if (round.status === "ACTIVE" || round.status === "PAUSED") {
    await roundService.stopRoundEarlyForCompetition(competitionId);
  } else {
    // PREPARATION: drop the countdown, write the same durable end state the timer
    // would have written, then run Unit 08's chain by hand so the competition still
    // advances (the signal only fires from the timer's own transition).
    await roundService.cancelPreparationForCompetition(competitionId);
    await repository.markRoundEarlyEnded(roundId, now());
    await gameplayService.advanceAfterRoundFinalized(
      roundId,
      round.stage.id,
      competitionId,
    );
  }

  return { roundId, closedCount: closed.finalizedCount, alreadyFinished: false };
}

/**
 * Finish the whole competition early (spec Detail 4, RND-007). Ends the
 * currently-active round exactly as "end a round early" does, then marks the
 * competition `FINISHED` with `finishedEarly = true` regardless of which stage or
 * round it was in. Unplayed rounds and stages contribute nothing to the totals —
 * they simply have no results, which is the same as counting them as 0.
 *
 * Cannot be resumed (spec Context): the state is terminal, and every later command
 * is rejected by `requireOpenCompetition`.
 *
 * Two orderings matter here:
 *   - The round-ended signal that closing the round fires drives Unit 08's advance
 *     chain, which may start the *next* round's preparation or finish the stage and
 *     the competition naturally. This command overrides both: any preparation the
 *     chain just started is cancelled, so no timer keeps running under a FINISHED
 *     competition, and the natural finish's `finishedEarly = false` is overwritten
 *     with `true` — the visible "finished early" mark is this command's whole
 *     point.
 *   - The screens are set to `FINAL` explicitly, because the natural-finish hook
 *     this path bypasses is what would otherwise do it (spec Detail 9).
 */
async function finishEarly(competitionId: string): Promise<FinishEarlyResult> {
  await requireOpenCompetition(competitionId);

  const activeRoundId = await roundService.getActiveRoundForCompetition(competitionId);
  let closedCount = 0;
  if (activeRoundId) {
    const result = await endRoundEarly(competitionId, activeRoundId);
    closedCount = result.closedCount;
  }

  // The advance chain may have opened the next round's preparation; abandon it so
  // a FINISHED competition has no live timer.
  await roundService.cancelPreparationForCompetition(competitionId);
  await repository.markCompetitionFinishedEarly(competitionId, now());
  // Announce the finish through the Gameplay module's one signal, so every
  // subscriber (Unit 12's results view, the screens) learns about an early finish
  // exactly as it learns about a natural one. The `FINAL` display mode is set
  // explicitly below rather than by the hook, which skips early finishes to avoid
  // writing the mode twice.
  await gameplayService.notifyCompetitionFinished({ competitionId, finishedEarly: true });
  await bigScreenService.setMode({ competitionId, mode: "FINAL" });

  return {
    competitionId,
    status: "FINISHED",
    finishedEarly: true,
    closedCount,
  };
}

export const stageCommandService = {
  requireOpenCompetition,
  startStage,
  pauseCompetition,
  resumeCompetition,
  endRoundEarly,
  finishEarly,
};
