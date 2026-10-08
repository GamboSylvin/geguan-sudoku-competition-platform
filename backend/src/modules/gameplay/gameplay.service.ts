/**
 * The Gameplay module's domain rules and public interface (Unit 07 — autosave
 * and reconnect; Unit 08 — manual submit and the round-ended auto-submit).
 * Other modules call this service, never the repository (invariant 4).
 *
 * Owns: the player's working grid for every puzzle of the active round (in
 * Redis, BLD-007), the autosave write path, the reconnect path, and the
 * manual/auto submission path that closes a `RoundParticipation` and asks the
 * Scoring module to write the score rows.
 *
 * Two hard rules this module enforces:
 *   - **Participant scoping.** A player reads and writes only their own grid
 *     (spec Security Considerations). Every entry point resolves the caller's
 *     `participantId` from the session and rejects the request when the caller
 *     is not a participant in the round.
 *   - **Active-round gating.** Autosave is accepted only while the round is
 *     `ACTIVE`. After the timer reaches zero the round flips to `FINISHED` and
 *     further writes are rejected (spec Error Cases). Autosave never triggers
 *     scoring (invariant 7); scoring is invoked only from this module's
 *     `submit` and `handleRoundEnded` paths.
 *
 * Question delivery at round start does **not** live here. The Round module
 * fetches the questions at countdown zero (BLD-006) and the realtime gateway
 * pushes them via `round:started`; this module's `getState` re-reads them for
 * the reconnect path only.
 */
import { prisma } from "../../infra";
import { logger } from "../../infra";
import { now, nowMs } from "../../shared/clock";
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../shared/errors";
import { translate } from "../../shared/i18n";
import * as roundRepository from "../round/round.repository";
import { roundTimerService } from "../round/round-timer.service";
import { scoringService } from "../scoring/scoring.service";
import * as repository from "./gameplay.repository";
import type {
  AutosaveInput,
  GameplayStatePayload,
  SubmitResult,
  WorkingGrid,
} from "./gameplay.types";
import type { RoundEndedEvent } from "../round/round.types";
import type { IndividualResultFinalizedEvent } from "../ranking/ranking.types";

/**
 * Whoever needs to know one participant's Individual-round result was finalized
 * (the Ranking module, Unit 09) installs this hook. Installed once at startup;
 * keeps this module free of any import from ranking (invariant 4, no cycles). The
 * signal carries only identifiers — the subscriber re-reads the durable results.
 */
type IndividualResultFinalizedHook = (event: IndividualResultFinalizedEvent) => void;
let individualResultFinalizedHook: IndividualResultFinalizedHook | null = null;

export function installIndividualResultFinalizedHook(
  hook: IndividualResultFinalizedHook,
): void {
  individualResultFinalizedHook = hook;
}

/**
 * Load the caller's participation row for a round and reject when the caller is
 * not a participant. The participation row is the single source of truth for
 * "is this account a participant in this round" (data-model, "Access rules").
 */
async function requireParticipation(roundId: string, participantId: string) {
  const participation = await prisma.roundParticipation.findUnique({
    where: { roundId_participantId: { roundId, participantId } },
  });
  if (!participation) {
    throw new ForbiddenError(translate("en", "gameplay.notAParticipant"), {
      code: "gameplay.notAParticipant",
    });
  }
  return participation;
}

/**
 * Load the round and reject when it is not currently accepting gameplay
 * (autosave). Only an `ACTIVE` round accepts writes; `FINISHED` and everything
 * before `ACTIVE` reject (spec Error Cases: writes after the timer hits zero
 * are refused; Unit 08 acts on the last saved state).
 */
async function requireActiveRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, status: true, stageId: true },
  });
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }
  if (round.status !== "ACTIVE") {
    throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
      code: "gameplay.notActive",
    });
  }
  return round;
}

/**
 * Reject when the question does not belong to this round. Autosave for a
 * question in another round is an error, not a silent no-op (spec Error Cases).
 */
async function requireQuestionInRound(roundId: string, questionId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, roundId },
    select: { id: true },
  });
  if (!question) {
    throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
      code: "gameplay.notActive",
      details: { reason: "questionNotInRound" },
    });
  }
}

/**
 * Autosave the player's working grid for one question. Called roughly twice per
 * second while the player edits (spec Implementation Detail 4). Never calls
 * into scoring (invariant 7).
 */
async function autosave(
  roundId: string,
  participantId: string,
  input: AutosaveInput,
): Promise<{ savedAtMs: number }> {
  await requireActiveRound(roundId);
  await requireParticipation(roundId, participantId);
  await requireQuestionInRound(roundId, input.questionId);

  const savedAtMs = nowMs();
  await repository.saveGrid(roundId, participantId, input.questionId, input.grid, savedAtMs);
  return { savedAtMs };
}

/**
 * The reconnect path (spec Implementation Detail 5). Returns the round's
 * questions, the player's saved grids for the round, and the server-authoritative
 * timer snapshot — enough for the client to render exactly the state the player
 * left. A player with no participation in the round is rejected; a participant
 * with no live round yet gets an empty grid list and a null timer.
 */
async function getState(
  roundId: string,
  participantId: string,
): Promise<GameplayStatePayload> {
  const participation = await requireParticipation(roundId, participantId);

  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }

  const questionRows = await roundRepository.listRoundQuestions(roundId);
  const questions = questionRows.map((q) => ({
    id: q.id,
    sequence: q.sequence,
    type: q.type,
    gridRows: q.gridRows,
    gridColumns: q.gridColumns,
    regions: q.regions,
    startingGrid: q.startingGrid,
    points: q.points,
  }));

  const savedGrids = await repository.listGridsForRound(roundId, participantId);

  const timer = await roundTimerService.remaining(roundId);

  return {
    roundId: round.id,
    competitionId: round.stage.competitionId,
    stageId: round.stageId,
    status: round.status,
    questions,
    savedGrids,
    timer: timer
      ? { remainingSeconds: timer.remainingSeconds, totalSeconds: timer.totalSeconds }
      : null,
    participationState: participation.state,
  };
}

/**
 * The round-start hook the realtime gateway installs. The Round module calls it
 * after the questions have been fetched and the round timer has started; this
 * module's only job at round start is to be a stable place to hang that hook.
 * The actual push lives in the realtime layer (no Socket.io import here, per
 * the module-first boundary).
 */
export type { RoundStartedPayload } from "../round/round.types";

// ---------------------------------------------------------------------------
// Submission (Unit 08)
// ---------------------------------------------------------------------------

/**
 * Read the round with everything scoring needs — the settings (for the bonus
 * configuration and duration), the stage (for Individual/Team), and the
 * questions *with* their solutions (BLD-010). The solution is read here, on
 * the server, only for scoring; it is never serialised to a client payload.
 */
async function loadRoundForScoring(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      settings: true,
      stage: { select: { id: true, competitionId: true, type: true, sequence: true } },
      questions: { orderBy: { sequence: "asc" } },
    },
  });
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }
  return round;
}

/**
 * Close one participation: write the attempt + answers + settled round result
 * via the Scoring module, then point `RoundParticipation.currentAttemptId` at
 * the new attempt and flip the state to `SUBMITTED` (manual) or
 * `AUTO_SUBMITTED` (anything else). Returns the scoring result so the caller
 * can decide what (not) to send back to the client.
 *
 * Idempotent on a repeated call (PL-009): if the participation is already
 * `SUBMITTED` or `AUTO_SUBMITTED`, the existing attempt is returned as-is and
 * no new rows are written. The scoring service's own idempotency is a second
 * layer underneath this one.
 */
async function finalizeParticipation(input: {
  roundId: string;
  participantId: string;
  submissionType: "MANUAL" | "TIMEOUT" | "CONTROLLER_END" | "AUTO";
  submittedAtMs: number;
}): Promise<{
  participationId: string;
  attemptId: string;
  submissionType: "MANUAL" | "TIMEOUT" | "CONTROLLER_END" | "AUTO";
  /** True when this call actually wrote a new attempt; false on a no-op. */
  wroteNewAttempt: boolean;
}> {
  const participation = await requireParticipation(input.roundId, input.participantId);

  if (participation.state === "SUBMITTED" || participation.state === "AUTO_SUBMITTED") {
    // PL-009: a repeated submission never changes the result. Return the
    // existing attempt's id without re-scoring.
    return {
      participationId: participation.id,
      attemptId: participation.currentAttemptId ?? "",
      submissionType: input.submissionType,
      wroteNewAttempt: false,
    };
  }

  const round = await loadRoundForScoring(input.roundId);
  const settings = round.settings;
  const durationSeconds = settings?.durationSeconds ?? 0;
  const earlyBonusRate = settings?.earlyBonusRate ?? 3;
  const earlyBonusCap = settings?.earlyBonusCap ?? null;
  const isIndividualStage = round.stage.type === "INDIVIDUAL";
  const roundStartedAtMs = round.startedAt ? round.startedAt.getTime() : input.submittedAtMs;

  const savedGrids = await repository.listGridsForRound(input.roundId, input.participantId);
  const gridsByQuestionId = new Map<string, (number | null)[]>();
  for (const entry of savedGrids) {
    gridsByQuestionId.set(entry.questionId, entry.grid);
  }

  const scored = await scoringService.finalizeAttempt({
    roundParticipationId: participation.id,
    roundId: input.roundId,
    participantId: input.participantId,
    categoryId: participation.categoryId,
    submissionType: input.submissionType,
    submittedAtMs: input.submittedAtMs,
    roundStartedAtMs,
    durationSeconds,
    earlyBonusRate,
    earlyBonusCap,
    isIndividualStage,
    questions: round.questions.map((q) => ({
      id: q.id,
      points: q.points,
      solution: Array.isArray(q.solution) ? (q.solution as (number | null)[]) : [],
    })),
    gridsByQuestionId,
  });

  const newState = input.submissionType === "MANUAL" ? "SUBMITTED" : "AUTO_SUBMITTED";
  await prisma.roundParticipation.update({
    where: { id: participation.id },
    data: {
      state: newState,
      currentAttemptId: scored.attemptId,
      attemptCount: { increment: 1 },
    },
  });

  // Notify the Ranking module (Unit 09) that a fresh Individual-round result is
  // durable, so the category's provisional ranking recomputes immediately (U-58).
  // Only a real finalize fires the signal — a PL-009 no-op (wroteNewAttempt false)
  // writes nothing and stays silent. Team-stage results are a later unit's build,
  // so the signal fires only for the Individual stage this unit ranks.
  if (scored.individualRoundResultId !== "" && isIndividualStage) {
    individualResultFinalizedHook?.({
      competitionId: round.stage.competitionId,
      stageId: round.stageId,
      roundId: input.roundId,
      participantId: input.participantId,
      categoryId: participation.categoryId,
    });
  }

  return {
    participationId: participation.id,
    attemptId: scored.attemptId,
    submissionType: input.submissionType,
    wroteNewAttempt: scored.individualRoundResultId !== "",
  };
}

/**
 * Player-facing manual submit (spec Implementation Detail 1). Closes the
 * caller's `RoundParticipation` for the round and scores it.
 *
 * Two subtleties, both per spec:
 *   - **Late submit (SUB-003):** if the server-authoritative timer has already
 *     reached zero, the submission is recorded as `TIMEOUT`, not `MANUAL` —
 *     same outcome as if the timer-expiry path had run. The response is
 *     indistinguishable from a successful manual submit.
 *   - **Repeated submit (PL-009):** if the participation is already closed,
 *     the call is a no-op that returns the same `{ accepted: true }` shape.
 *
 * A submit on a round that has not started yet is a 422: there is nothing to
 * submit, and this is a real error the client should see (unlike a late
 * submit, which silently degrades to TIMEOUT).
 */
async function submit(
  roundId: string,
  participantId: string,
): Promise<SubmitResult> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, status: true },
  });
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }
  if (round.status === "WAITING" || round.status === "PREPARATION") {
    throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
      code: "gameplay.notActive",
    });
  }

  // Decide the submissionType from the server-authoritative timer (SUB-003).
  // A round that is no longer ACTIVE on the timer is recorded as TIMEOUT even
  // if the database status hasn't caught up — the timer is the authority.
  const snapshot = await roundTimerService.remaining(roundId);
  const timerExpired = !snapshot || snapshot.status === "FINISHED" || snapshot.remainingSeconds <= 0;
  const submissionType = timerExpired || round.status === "FINISHED" ? "TIMEOUT" : "MANUAL";

  const result = await finalizeParticipation({
    roundId,
    participantId,
    submissionType,
    submittedAtMs: nowMs(),
  });

  return { accepted: true, submissionType: result.submissionType };
}

/**
 * The round-ended listener (spec Implementation Detail 2a and step 5). Wired
 * from `app.ts` to `roundTimerService.onRoundEnded`. For every `ACTIVE`
 * participation in the round, auto-submit with `TIMEOUT`, then — once every
 * participation in the round is finalized — call back into the Round module
 * to advance to the next round's preparation, completing Unit 07's CS-022
 * sequence. After the stage's last round, the stage is marked FINISHED; no
 * auto-start of the next stage (RND-006, Unit 11's command).
 *
 * Never throws: a single failed participant's scoring is logged and skipped,
 * so one bad row cannot strand the whole round.
 */
async function handleRoundEnded(event: RoundEndedEvent): Promise<void> {
  const participations = await prisma.roundParticipation.findMany({
    where: { roundId: event.roundId, state: "ACTIVE" },
    select: { participantId: true },
  });

  const submittedAtMs = event.endedAtMs;
  for (const p of participations) {
    try {
      await finalizeParticipation({
        roundId: event.roundId,
        participantId: p.participantId,
        submissionType: "TIMEOUT",
        submittedAtMs,
      });
    } catch (error) {
      logger.error("gameplay.handleRoundEnded: failed to auto-submit a participant", {
        roundId: event.roundId,
        participantId: p.participantId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Now check whether every participation is closed. If yes, advance the
  // competition (Unit 07's CS-022, completed here per invariant 7).
  const stillOpen = await prisma.roundParticipation.count({
    where: {
      roundId: event.roundId,
      state: { in: ["WAITING", "ACTIVE"] },
    },
  });
  if (stillOpen > 0) {
    logger.info("gameplay.handleRoundEnded: round not fully finalized yet", {
      roundId: event.roundId,
      stillOpen,
    });
    return;
  }

  await advanceAfterRoundFinalized(event.roundId, event.stageId, event.competitionId);
}

/**
 * Who needs to know the whole competition has finished (the BigScreen module,
 * Unit 11, switches the display to `FINAL`; a results view would subscribe too)
 * installs this hook. Both finish paths — the automatic one below (Detail 8) and
 * the controller's "finish early" — go through `notifyCompetitionFinished`, so
 * there is exactly one place that announces "this competition is done" (spec
 * Implementation Notes). Installed once at startup; keeps this module free of
 * any import from big-screen (invariant 4, no cycles).
 */
export interface CompetitionFinishedEvent {
  competitionId: string;
  /** True only for RND-007's early finish; false for the natural finish. */
  finishedEarly: boolean;
}

type CompetitionFinishedHook = (event: CompetitionFinishedEvent) => void | Promise<void>;
let competitionFinishedHook: CompetitionFinishedHook | null = null;

export function installCompetitionFinishedHook(hook: CompetitionFinishedHook): void {
  competitionFinishedHook = hook;
}

/** Fire the "competition is done" signal. Never throws. */
export async function notifyCompetitionFinished(
  event: CompetitionFinishedEvent,
): Promise<void> {
  if (!competitionFinishedHook) return;
  try {
    await competitionFinishedHook(event);
  } catch (error) {
    logger.error("gameplay: a competition-finished listener threw", {
      competitionId: event.competitionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Unit 11's extension of Unit 08's per-stage check (spec Implementation Detail
 * 8). Called from `advanceAfterRoundFinalized` when the stage that just finished
 * is the competition's last one by `sequence`.
 *
 * **Finding (Unit 11, spec wording vs. as-built schema):** the spec says "once a
 * category's last stage finishes, and every category has reached that point".
 * `Stage` rows are per-*competition*, not per-category (`Stage` has no
 * `categoryId`; `competition.service.buildStructure` creates exactly one
 * INDIVIDUAL and one TEAM stage that every category runs against in parallel).
 * So "every category has reached that point" is not a separate condition to
 * check — it is the same single row. This implementation marks the competition
 * `FINISHED` when the last stage by sequence finishes, which is the spec's
 * intent and cannot be satisfied differently without changing the schema, which
 * the spec forbids ("No schema change").
 */
async function markCompetitionFinishedNaturally(competitionId: string): Promise<void> {
  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "FINISHED", finishedEarly: false, finishedAt: now() },
  });
  await notifyCompetitionFinished({ competitionId, finishedEarly: false });
}

/**
 * Pick the round that follows `roundId` inside its stage (sequence + 1), or
 * null when this was the stage's last round. Only Individual-stage rounds
 * advance automatically; Team-stage advance is Unit 11's surface.
 */
async function findNextRoundInStage(stageId: string, afterSequence: number) {
  return prisma.round.findFirst({
    where: { stageId, sequence: { gt: afterSequence } },
    orderBy: { sequence: "asc" },
    include: { settings: true },
  });
}

/**
 * Mark a stage finished, then apply the whole-competition finish check (Detail 8).
 * The competition only finishes when this was its last stage by `sequence`; and a
 * competition already in a terminal state (`FINISHED`/`CANCELLED`) is left alone,
 * so a late-arriving round-ended signal can never resurrect or re-cancel it.
 */
async function finishStageAndMaybeCompetition(
  stageId: string,
  competitionId: string,
  roundId: string,
): Promise<void> {
  await prisma.stage.update({
    where: { id: stageId },
    data: { status: "FINISHED", endedAt: now() },
  });

  const [competition, lastStage] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: { status: true },
    }),
    prisma.stage.findFirst({
      where: { competitionId },
      orderBy: { sequence: "desc" },
      select: { id: true, sequence: true },
    }),
  ]);

  const isLastStage = lastStage !== null && lastStage.id === stageId;

  if (competition?.status === "CANCELLED" || competition?.status === "FINISHED") {
    await roundRepository.upsertRuntimeState({
      competitionId,
      currentStageId: stageId,
      currentRoundId: roundId,
      phase: "STAGE_FINISHED",
    });
    return;
  }

  if (isLastStage) {
    await markCompetitionFinishedNaturally(competitionId);
    await roundRepository.upsertRuntimeState({
      competitionId,
      currentStageId: stageId,
      currentRoundId: roundId,
      phase: "FINISHED",
    });
    return;
  }

  // Not the last stage: the next one waits for the controller's start command
  // (RND-006 — a stage never starts by itself).
  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "STAGE_FINISHED" },
  });
  await roundRepository.upsertRuntimeState({
    competitionId,
    currentStageId: stageId,
    currentRoundId: roundId,
    phase: "STAGE_FINISHED",
  });
}

/**
 * The auto-advance step (spec Implementation Detail 5). Either kicks off the
 * next round's preparation, or — when this was the stage's last round — marks
 * the stage finished and, from Unit 11 on, the competition finished too when it
 * was the last stage (Detail 8). No auto-start of the next stage (RND-006).
 */
async function advanceAfterRoundFinalized(
  roundId: string,
  stageId: string,
  competitionId: string,
): Promise<void> {
  const finished = await prisma.round.findUnique({
    where: { id: roundId },
    select: { sequence: true, stage: { select: { type: true } } },
  });
  if (!finished) return;

  // Only the Individual stage auto-advances between rounds (CS-022). The Team
  // stage's transition is a Unit 13/14 build, gated by Unit 11's commands.
  if (finished.stage.type !== "INDIVIDUAL") {
    await finishStageAndMaybeCompetition(stageId, competitionId, roundId);
    return;
  }

  const next = await findNextRoundInStage(stageId, finished.sequence);
  if (!next) {
    await finishStageAndMaybeCompetition(stageId, competitionId, roundId);
    return;
  }

  const preparationSeconds = next.settings?.preparationSeconds ?? 60;
  const startedAt = now();
  await prisma.round.update({
    where: { id: next.id },
    data: { status: "PREPARATION", startedAt },
  });
  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "PREPARATION" },
  });
  await roundRepository.upsertRuntimeState({
    competitionId,
    currentStageId: stageId,
    currentRoundId: next.id,
    phase: "PREPARATION",
  });

  // Hand off to the Round module's timer service — the same path the dev
  // trigger uses. The round-started hook fires when the countdown reaches
  // zero, completing the loop this unit exists to close.
  await roundTimerService.startPreparationTimer(
    next.id,
    competitionId,
    stageId,
    preparationSeconds,
  );
}

/**
 * Close every still-open `RoundParticipation` in one round (Unit 11's "end a
 * round early", SUB-004). The scoring outcome differs from the timer-expiry path
 * only in the `submissionType`: `CONTROLLER_END` earns no early bonus, because
 * `computeEarlyBonus` pays the bonus for a `MANUAL` submit only — so "no bonus"
 * needs no change in the Scoring module at all.
 *
 * Never throws for one participant: a failed finalize is logged and skipped, the
 * same way `handleRoundEnded` behaves, so one bad row cannot strand the command.
 * Returns how many participations this call actually finalized.
 */
async function closeAllActiveParticipations(input: {
  roundId: string;
  submissionType: "CONTROLLER_END" | "TIMEOUT";
  submittedAtMs: number;
}): Promise<{ finalizedCount: number }> {
  const participations = await prisma.roundParticipation.findMany({
    where: { roundId: input.roundId, state: { in: ["WAITING", "ACTIVE"] } },
    select: { participantId: true },
  });

  let finalizedCount = 0;
  for (const participation of participations) {
    try {
      const result = await finalizeParticipation({
        roundId: input.roundId,
        participantId: participation.participantId,
        submissionType: input.submissionType,
        submittedAtMs: input.submittedAtMs,
      });
      if (result.wroteNewAttempt) finalizedCount += 1;
    } catch (error) {
      logger.error("gameplay.closeAllActiveParticipations: failed to close a participant", {
        roundId: input.roundId,
        participantId: participation.participantId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { finalizedCount };
}

/**
 * Record that the player navigated away from the answer page during an active
 * round (Unit 10, "leftAnswerPageCount"). The counter is information-only —
 * no penalty, no effect on scoring (PAR-005).
 *
 * Accepted only while the round is `ACTIVE`; a signal arriving at any other
 * time (preparation, paused, finished) is a silent no-op so the client does not
 * have to time the event perfectly. The client is trusted for the *signal* (we
 * cannot observe page visibility server-side) but never for the *value* — the
 * count is owned and incremented server-side, never overwritten from the wire.
 *
 * Idempotency is the caller's problem: a client that double-fires the event
 * will see the counter go up by two. The gameplay client debounces at the
 * source.
 */
async function recordLeftAnswerPage(
  roundId: string,
  participantId: string,
): Promise<{ leftAnswerPageCount: number }> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, status: true },
  });
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }

  const participation = await requireParticipation(roundId, participantId);

  if (round.status !== "ACTIVE") {
    // Not an error — the client cannot perfectly time the visibility event.
    return { leftAnswerPageCount: participation.leftAnswerPageCount };
  }

  const updated = await prisma.roundParticipation.update({
    where: { id: participation.id },
    data: { leftAnswerPageCount: { increment: 1 } },
    select: { leftAnswerPageCount: true },
  });
  return { leftAnswerPageCount: updated.leftAnswerPageCount };
}

export const gameplayService = {
  autosave,
  getState,
  submit,
  handleRoundEnded,
  recordLeftAnswerPage,
  // Unit 11's command surface: the Orchestrator closes a round early through
  // these two, so the auto-submit/scoring path and the finalize-and-advance
  // chain stay in exactly one place (spec Context, "End a round early" — reuse
  // Unit 08's path, do not duplicate it).
  closeAllActiveParticipations,
  advanceAfterRoundFinalized,
  notifyCompetitionFinished,
};

export type { WorkingGrid };
