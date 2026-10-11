/**
 * The Team stage's rotation relay (Unit 13). The round's domain rules live here;
 * `team-rotation.repository` holds only storage access (invariant 4).
 *
 * What this implements, in the spec's own order:
 *   1. **Initial deal** — at round start, draw `teamQuestionCount` questions from
 *      each team's category pool (**not** filtered by `roundId`, which is
 *      Individual-stage-only, BLD-040), deal one per active member, the rest into
 *      the refill queue.
 *   2. **Timed rotation** — every `rotationPeriodSeconds` each member's question,
 *      *with its partly filled grid*, moves to the next member. Questions rotate,
 *      not seats (TEM-002/TEM-004/SUB-006). Server-authoritative: the deadline
 *      decides, the tick loop is display cadence only (invariant 3).
 *   3. **Submit and immediate check** — a member may submit at any time; the
 *      server first verifies the tablet still holds that question (409 + refresh
 *      otherwise), then evaluates it with Unit 08's `gridsEqual` (all-or-nothing,
 *      BLD-010). Correct → score, remove from circulation, refill. Incorrect → no
 *      change, the question keeps rotating.
 *   4. **Round end** — every question correctly answered, or the optional
 *      `teamTotalTimeSeconds`, whichever first. Settles `TeamRoundResult`.
 *   5. **Auto-advance** — once every team's result is settled, the Round module's
 *      preparation-start logic runs for the Team stage's round 2 (Unit 14's build).
 *
 * **No early-finish bonus, ever** (spec Acceptance Criterion 7): nothing here calls
 * `computeEarlyBonus`. Scoring is the flat `correctCount × teamPointsPerQuestion`
 * (SCR-007/SCR-015) — a team round never reads `Question.points`.
 *
 * **No schema change:** `TeamRotationState` (the durable mirror of the Redis
 * working state) and `TeamRoundResult` (the settled value) already exist from
 * Unit 1.
 */
import { setTimeout as scheduleTimeout, clearTimeout } from "node:timers";
import { logger } from "../../infra";
import { now, nowMs } from "../../shared/clock";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { scoringService } from "../scoring/scoring.service";
import { roundTimerService } from "../round/round-timer.service";
import * as roundRepository from "../round/round.repository";
import * as repository from "./team-rotation.repository";
import type { WorkingGrid } from "./gameplay.types";
import type {
  RotationDealPayload,
  RotationEndedPayload,
  RotationQuestion,
  RotationRotatedPayload,
  RotationState,
  RotationSubmitInput,
  RotationSubmitResult,
  RotationTabletState,
  TabletHold,
} from "./team-rotation.types";
import type { RoundEndedEvent } from "../round/round.types";

/** Display cadence of the rotation tick loop. Not authoritative — the deadline is. */
const TICK_MS = 250;

/** In-memory handle to the scheduled wakeup for one running rotation round. */
const scheduledWakeups = new Map<string, NodeJS.Timeout>();

// ---------------------------------------------------------------------------
// Push hooks (the realtime gateway installs these; no Socket.io import here)
// ---------------------------------------------------------------------------

/** Who a rotation push is addressed to: one tablet of one team of one competition. */
export interface RotationPushTarget {
  competitionId: string;
  teamId: string;
  participantId: string;
}

type DealHook = (target: RotationPushTarget, payload: RotationDealPayload) => void;
type RotatedHook = (target: RotationPushTarget, payload: RotationRotatedPayload) => void;
type EndedHook = (target: RotationPushTarget, payload: RotationEndedPayload) => void;

let dealHook: DealHook | null = null;
let rotatedHook: RotatedHook | null = null;
let endedHook: EndedHook | null = null;

export function installRotationHooks(hooks: {
  onDeal: DealHook;
  onRotated: RotatedHook;
  onEnded: EndedHook;
}): void {
  dealHook = hooks.onDeal;
  rotatedHook = hooks.onRotated;
  endedHook = hooks.onEnded;
}

// ---------------------------------------------------------------------------
// The one flagged interpretation, isolated so it can be flipped (spec Notes)
// ---------------------------------------------------------------------------

/**
 * What happens to a question after an **incorrect** submit. Nothing in the decided
 * rules says, so this unit treats it as unchanged: **the question stays in
 * circulation and keeps rotating**, available for a later teammate to answer
 * correctly (spec Context, "A resolved interpretation, flagged because it isn't
 * spelled out explicitly"). This is the only place that encodes it — flipping the
 * rule to "discard the question" means changing this function and the one branch
 * in `submitRotation` that reads it, nothing else.
 */
export function keepIncorrectSubmitInCirculation(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** A team round is the rotation relay only for its first round; round 2 is Unit 14. */
export function isRotationRound(stageType: string, roundSequence: number): boolean {
  return stageType === "TEAM" && roundSequence === 1;
}

/**
 * Fisher–Yates with a bounded draw. Deliberately a plain in-memory shuffle: the
 * pool is small (tens of questions per category) and the draw happens once per
 * team per round.
 */
function drawQuestions<T>(pool: T[], count: number): T[] {
  const items = [...pool];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items.slice(0, Math.max(0, count));
}

function blankGridFor(question: RotationQuestion): WorkingGrid {
  return new Array<null>(question.gridRows * question.gridColumns).fill(null);
}

function toDealPayload(state: RotationState, hold: TabletHold): RotationDealPayload {
  return {
    roundId: state.roundId,
    competitionId: state.competitionId,
    stageId: state.stageId,
    teamId: state.teamId,
    participantId: hold.participantId,
    hold: hold.question ? { question: hold.question, grid: hold.grid } : null,
    totalQuestionCount: state.totalQuestionCount,
    correctCount: state.correctCount,
    teamScore: state.correctCount * state.pointsPerQuestion,
    nextRotationAtMs: state.nextRotationAtMs,
    rotationPeriodSeconds: state.rotationPeriodSeconds,
    totalTimeDeadlineMs: state.totalTimeDeadlineMs,
  };
}

function targetOf(state: RotationState, participantId: string): RotationPushTarget {
  return { competitionId: state.competitionId, teamId: state.teamId, participantId };
}

function pushDeal(state: RotationState, hold: TabletHold): void {
  dealHook?.(targetOf(state, hold.participantId), toDealPayload(state, hold));
}

function pushRotated(
  state: RotationState,
  hold: TabletHold,
  reason: RotationRotatedPayload["reason"],
): void {
  rotatedHook?.(targetOf(state, hold.participantId), {
    ...toDealPayload(state, hold),
    reason,
  });
}

function pushEnded(state: RotationState, payload: RotationEndedPayload): void {
  if (!endedHook) return;
  for (const hold of state.holds) {
    endedHook(targetOf(state, hold.participantId), payload);
  }
}

/** The durable mirror is bookkeeping only: never let it cost a team its round. */
async function mirrorSafely(state: RotationState): Promise<void> {
  try {
    await repository.mirrorRotationState(state);
  } catch (error) {
    logger.error("team rotation: failed to mirror the rotation state", {
      roundId: state.roundId,
      teamId: state.teamId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Resolve the caller to an active team member of this competition. Scoping the
 * submit to the authenticated player's own team membership is what stops a member
 * submitting on behalf of a teammate (spec Security Considerations).
 */
async function resolveMembership(
  competitionId: string,
  participantId: string,
): Promise<{ teamId: string; categoryId: string }> {
  const found = await repository.findTeamForParticipant(competitionId, participantId);
  if (!found) {
    throw new NotFoundError(translate("en", "rotation.notATeamMember"), {
      code: "rotation.notATeamMember",
    });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Round start: the initial deal (spec Detail 1)
// ---------------------------------------------------------------------------

/**
 * Deal one team's round: draw the questions, hand one to each active member, and
 * put the rest in the refill queue. Idempotent — a team that already has working
 * state for this round keeps it, so a repeated start (a retry after a partial
 * failure) cannot re-deal and orphan a member's progress.
 */
async function dealTeam(input: {
  roundId: string;
  competitionId: string;
  stageId: string;
  team: repository.RotationTeamRow;
  questionCount: number;
  pointsPerQuestion: number;
  rotationPeriodSeconds: number;
  totalTimeSeconds: number | null;
  startedAtMs: number;
}): Promise<RotationState> {
  const existing = await repository.loadRotationState(input.roundId, input.team.teamId);
  if (existing) return existing;

  const pool = await repository.listCategoryPool(input.competitionId, input.team.categoryId);
  const drawn = drawQuestions(pool, input.questionCount);

  const members = input.team.members;
  const holds: TabletHold[] = members.map((member, index) => {
    const entry = drawn[index];
    return {
      participantId: member.participantId,
      question: entry ? entry.question : null,
      grid: entry ? blankGridFor(entry.question) : [],
    };
  });

  const state: RotationState = {
    roundId: input.roundId,
    competitionId: input.competitionId,
    stageId: input.stageId,
    teamId: input.team.teamId,
    categoryId: input.team.categoryId,
    memberOrder: members.map((m) => m.participantId),
    holds,
    refillQueue: drawn.slice(members.length).map((d) => d.question),
    correctCount: 0,
    totalQuestionCount: drawn.length,
    rotationIndex: 0,
    lastRotationAtMs: null,
    nextRotationAtMs: input.startedAtMs + input.rotationPeriodSeconds * 1000,
    startedAtMs: input.startedAtMs,
    pointsPerQuestion: input.pointsPerQuestion,
    rotationPeriodSeconds: input.rotationPeriodSeconds,
    totalTimeDeadlineMs:
      input.totalTimeSeconds === null ? null : input.startedAtMs + input.totalTimeSeconds * 1000,
    finished: false,
  };

  await repository.saveRotationState(state);
  await mirrorSafely(state);

  if (drawn.length === 0) {
    // No questions at all in this category's pool: there is nothing to answer, so
    // the team's round is over the moment it began. Settle it at zero rather than
    // leaving tablets spinning on an empty hold forever.
    logger.warn("team rotation: a category pool is empty; settling the team at zero", {
      roundId: input.roundId,
      teamId: input.team.teamId,
      categoryId: input.team.categoryId,
    });
    await endTeam(state, "ALL_CORRECT");
    return { ...state, finished: true };
  }

  for (const hold of state.holds) {
    pushDeal(state, hold);
  }
  return state;
}

/**
 * Round start for the Team stage's rotation round. Called by the Round module at
 * countdown zero, in place of Unit 07's Individual-stage "fetch all 6 puzzles"
 * step (spec Context: "This unit's round-start step replaces…").
 *
 * The round's own Unit 07 clock keeps running — it stays the authority for
 * pause/resume and for the controller's end-early command (invariant 3). When the
 * optional `teamTotalTimeSeconds` is set it *is* the round's duration, so the
 * time-limit end condition and the existing timer are the same deadline rather
 * than two clocks that could disagree.
 */
export async function startRotationRound(input: {
  roundId: string;
  competitionId: string;
  stageId: string;
  settings: {
    teamPointsPerQuestion: number;
    rotationPeriodSeconds: number;
    teamQuestionCount: number;
    teamTotalTimeSeconds: number | null;
  };
}): Promise<void> {
  const startedAtMs = nowMs();
  const teams = await repository.listTeamsWithActiveMembers(input.competitionId);

  if (teams.length === 0) {
    logger.warn("team rotation: no team with active members; nothing to deal", {
      roundId: input.roundId,
      competitionId: input.competitionId,
    });
    return;
  }

  for (const team of teams) {
    try {
      await dealTeam({
        roundId: input.roundId,
        competitionId: input.competitionId,
        stageId: input.stageId,
        team,
        questionCount: input.settings.teamQuestionCount,
        pointsPerQuestion: input.settings.teamPointsPerQuestion,
        rotationPeriodSeconds: input.settings.rotationPeriodSeconds,
        totalTimeSeconds: input.settings.teamTotalTimeSeconds,
        startedAtMs,
      });
    } catch (error) {
      // One team's failed deal must not strand the whole round; log and continue.
      logger.error("team rotation: failed to deal a team", {
        roundId: input.roundId,
        teamId: team.teamId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // A round where every team was settled by an empty pool is already over.
  await maybeEndRound(input.roundId);
  scheduleWakeup(input.roundId);
}

// ---------------------------------------------------------------------------
// The rotation tick loop (spec Detail 2)
// ---------------------------------------------------------------------------

function cancelWakeup(roundId: string): void {
  const existing = scheduledWakeups.get(roundId);
  if (existing) {
    clearTimeout(existing);
    scheduledWakeups.delete(roundId);
  }
}

function scheduleWakeup(roundId: string): void {
  cancelWakeup(roundId);
  const handle = scheduleTimeout(() => {
    scheduledWakeups.delete(roundId);
    void tick(roundId).catch((error: unknown) => {
      logger.error("team rotation: tick failed", {
        roundId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, TICK_MS);
  // A display-cadence timer must never hold the process open.
  handle.unref?.();
  scheduledWakeups.set(roundId, handle);
}

/**
 * One tick: rotate and time-limit whatever is due, then re-arm. A tick is never the
 * authority — it reads the deadlines and acts on whatever is due, so a delayed or
 * skipped tick only changes the display cadence (invariant 3). The round's status
 * comes from the Unit 07 timer's own Redis state, not a database read per tick.
 */
async function tick(roundId: string): Promise<void> {
  const timer = await roundTimerService.remaining(roundId);
  if (!timer || timer.status === "FINISHED") return;

  const states = await repository.listRotationStates(roundId);
  if (states.length === 0) return;

  // While the round is paused the rotation clock stops with it (SCR-011): re-arm
  // so it picks up again on resume, and move nothing.
  if (timer.status === "PAUSED") {
    scheduleWakeup(roundId);
    return;
  }

  const at = nowMs();
  for (const state of states) {
    if (state.finished) continue;
    try {
      if (state.totalTimeDeadlineMs !== null && at >= state.totalTimeDeadlineMs) {
        await endTeam(state, "TIME_LIMIT");
        continue;
      }
      if (at >= state.nextRotationAtMs) {
        await rotateTeam(state);
      }
    } catch (error) {
      logger.error("team rotation: a team's tick failed", {
        roundId,
        teamId: state.teamId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ended = await maybeEndRound(roundId);
  if (!ended) scheduleWakeup(roundId);
}

/**
 * Move every member's question — with its partly filled grid — to the next member
 * in the fixed rotation order. The members never move (TEM-002): the grid travels
 * with the question, so the next member inherits exactly what was typed.
 */
export async function rotateTeam(state: RotationState): Promise<RotationState> {
  const count = state.memberOrder.length;
  const rotatedAtMs = nowMs();

  const holds: TabletHold[] =
    count < 2
      ? // A one-member team has nobody to rotate to: only the deadline advances, so
        // the round can still end on its total time.
        state.holds.map((h) => ({ ...h }))
      : state.holds.map((hold, index) => {
          // The member at `index` keeps their seat and receives the previous
          // member's question and grid.
          const from = state.holds[(index - 1 + count) % count]!;
          return { participantId: hold.participantId, question: from.question, grid: from.grid };
        });

  const updated: RotationState = {
    ...state,
    holds,
    rotationIndex: state.rotationIndex + 1,
    lastRotationAtMs: rotatedAtMs,
    nextRotationAtMs: rotatedAtMs + state.rotationPeriodSeconds * 1000,
  };
  await repository.saveRotationState(updated);
  await mirrorSafely(updated);

  if (count >= 2) {
    for (const hold of updated.holds) {
      pushRotated(updated, hold, "ROTATION");
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Submit and immediate check (spec Detail 3)
// ---------------------------------------------------------------------------

/**
 * A member submits the question their tablet currently holds. The server checks
 * the hold first and scores second: the client never asserts which question it
 * holds (spec Security Considerations) — the server-held `holds` is the only
 * source.
 *
 * Rejections: 404 the round does not exist; 404 the caller is not an active member
 * of a team on this competition; 422 the round is not a rotation round that is
 * currently active; 409 the tablet no longer holds that question (it rotated away
 * between the player's tap and this request) — the client is refreshed with
 * whatever is held now; 409 the team's round has already ended.
 */
export async function submitRotation(
  roundId: string,
  participantId: string,
  input: RotationSubmitInput,
): Promise<RotationSubmitResult> {
  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }
  if (!isRotationRound(round.stage.type, round.sequence)) {
    throw new UnprocessableEntityError(translate("en", "rotation.notARotationRound"), {
      code: "rotation.notARotationRound",
    });
  }
  // A round that is no longer ACTIVE is a round that ended — its own queue
  // emptied, its total time elapsed, or the controller ended it early. All three
  // are the same thing to a tablet mid-answer, and the answer is a 409 so the
  // client stops working and refreshes, never the generic "not active" 422.
  if (round.status !== "ACTIVE") {
    throw new ConflictError(translate("en", "rotation.roundEnded"), {
      code: "rotation.roundEnded",
    });
  }

  const membership = await resolveMembership(round.stage.competitionId, participantId);
  const state = await repository.loadRotationState(roundId, membership.teamId);
  if (!state) {
    throw new UnprocessableEntityError(translate("en", "rotation.rotationNotStarted"), {
      code: "rotation.rotationNotStarted",
    });
  }
  if (state.finished) {
    throw new ConflictError(translate("en", "rotation.roundEnded"), {
      code: "rotation.roundEnded",
    });
  }

  const holdIndex = state.holds.findIndex((h) => h.participantId === participantId);
  const hold = holdIndex >= 0 ? state.holds[holdIndex]! : null;

  // The stale-hold race (spec Context): a submit arriving as the rotation fires.
  // Reject, and refresh the client with whatever the tablet holds now.
  if (!hold || hold.question?.id !== input.questionId) {
    if (hold) pushRotated(state, hold, "STALE_HOLD");
    throw new ConflictError(translate("en", "rotation.staleHold"), {
      code: "rotation.staleHold",
      details: { currentQuestionId: hold?.question?.id ?? null },
    });
  }

  // The answer check reuses Unit 08's evaluation (all-or-nothing, BLD-010). The
  // solution is read here, server-side, only for this comparison.
  const pool = await repository.listCategoryPool(state.competitionId, state.categoryId);
  const solution = pool.find((entry) => entry.question.id === input.questionId)?.solution ?? [];
  const correct = scoringService.gridsEqual(input.grid, solution);

  if (!correct) {
    if (!keepIncorrectSubmitInCirculation()) {
      // Not the rule this unit implements; kept so flipping the interpretation
      // above has an obvious place to land.
      return {
        correct: false,
        correctCount: state.correctCount,
        teamScore: state.correctCount * state.pointsPerQuestion,
        roundEnded: false,
      };
    }
    // No score change; the question stays in `holds` and rotates on at the next
    // tick. The submitted grid becomes the tablet's working grid, so the member —
    // or whoever inherits the question — sees the attempt that was just made.
    const updated: RotationState = {
      ...state,
      holds: state.holds.map((h, i) => (i === holdIndex ? { ...h, grid: input.grid } : h)),
    };
    await repository.saveRotationState(updated);
    await mirrorSafely(updated);
    return {
      correct: false,
      correctCount: updated.correctCount,
      teamScore: updated.correctCount * updated.pointsPerQuestion,
      roundEnded: false,
    };
  }

  // Correct: award the flat per-question value, remove the question from
  // circulation, and refill this tablet from the queue if one remains. A queue
  // that is empty leaves the tablet in the "nothing to work on right now" state.
  const refill = state.refillQueue[0] ?? null;
  const updated: RotationState = {
    ...state,
    correctCount: state.correctCount + 1,
    refillQueue: state.refillQueue.slice(1),
    holds: state.holds.map((h, i) =>
      i === holdIndex
        ? {
            participantId: h.participantId,
            question: refill,
            grid: refill ? blankGridFor(refill) : [],
          }
        : h,
    ),
  };
  await repository.saveRotationState(updated);
  await mirrorSafely(updated);
  pushRotated(updated, updated.holds[holdIndex]!, "REFILL");

  // The queue is empty means every one of the round's questions has been correctly
  // answered (spec Context, "End condition").
  const allCorrect =
    updated.correctCount >= updated.totalQuestionCount && updated.refillQueue.length === 0;
  let roundEnded = false;
  if (allCorrect) {
    // Detail 4: `completionTimeSeconds` is set only when the round ended by
    // queue-empty, which is exactly this branch.
    await endTeam(updated, "ALL_CORRECT");
    roundEnded = await maybeEndRound(roundId);
  }

  return {
    correct: true,
    correctCount: updated.correctCount,
    teamScore: updated.correctCount * updated.pointsPerQuestion,
    roundEnded,
  };
}

// ---------------------------------------------------------------------------
// Round end (spec Detail 4)
// ---------------------------------------------------------------------------

/**
 * Settle one team's `TeamRoundResult` and push `rotation:ended` to its tablets.
 * Idempotent: the repository's find-then-create is the only thing standing between
 * a late tick and a duplicate result row (`TeamRoundResult` has no unique
 * constraint on (roundId, teamId)).
 */
async function endTeam(state: RotationState, reason: "ALL_CORRECT" | "TIME_LIMIT"): Promise<void> {
  if (state.finished) return;

  const completionTimeSeconds =
    reason === "ALL_CORRECT"
      ? Math.max(0, Math.round((nowMs() - state.startedAtMs) / 1000))
      : null;
  // The flat team score. Never `Question.points`, never an early bonus.
  const score = state.correctCount * state.pointsPerQuestion;

  await repository.finalizeTeamRoundResult({
    roundId: state.roundId,
    teamId: state.teamId,
    categoryId: state.categoryId,
    correctCount: state.correctCount,
    score,
    completionTimeSeconds,
  });

  const finished: RotationState = { ...state, finished: true };
  await repository.saveRotationState(finished);
  await mirrorSafely(finished);

  pushEnded(finished, {
    roundId: state.roundId,
    competitionId: state.competitionId,
    stageId: state.stageId,
    teamId: state.teamId,
    reason,
    correctCount: state.correctCount,
    score,
    completionTimeSeconds,
  });
}

/**
 * When every team has a settled result, the round itself is over: flip the durable
 * state, stop the Unit 07 clock without marking it an early end, and hand the
 * advance to the Gameplay module's chain (Detail 5). Returns true when this call
 * ended it.
 *
 * `roundTimerService.stopRoundEarly` is deliberately **not** used here: it writes
 * `Round.earlyEnded`, which is the controller's end-round-early flag (§7.4) and
 * would mislabel a round that finished on its own. The timer state is dropped and
 * the round marked FINISHED directly instead — the same transition the deadline
 * tick performs.
 */
async function maybeEndRound(roundId: string): Promise<boolean> {
  const states = await repository.listRotationStates(roundId);
  if (states.length === 0) return false;
  if (states.some((s) => !s.finished)) return false;

  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round || round.status === "FINISHED") return false;

  cancelWakeup(roundId);
  await roundTimerService.releaseTimer(roundId);
  await roundRepository.setRoundStatus(roundId, "FINISHED", { endedAt: now() });
  await roundRepository.upsertRuntimeState({
    competitionId: round.stage.competitionId,
    currentStageId: round.stageId,
    currentRoundId: roundId,
    phase: "ROUND_FINISHED",
  });

  // The Gameplay module owns the advance chain (Unit 08's CS-022 path, extended
  // here for the Team stage by Detail 5). It imports this file, so the callback is
  // installed as a hook rather than imported — no cycle (invariant 4).
  await rotationRoundEndedHook?.({
    roundId,
    stageId: round.stageId,
    competitionId: round.stage.competitionId,
    endedAtMs: nowMs(),
  });

  await repository.deleteRotationStates(roundId);
  return true;
}

/**
 * Installed by `gameplay.service` at module load: what to do once a rotation round
 * has ended on its own (advance to the Team stage's round 2). Keeps this file free
 * of an import from `gameplay.service`, which imports this one.
 */
type RotationRoundEndedHook = (event: RoundEndedEvent) => Promise<void>;
let rotationRoundEndedHook: RotationRoundEndedHook | null = null;
export function installRotationRoundEndedHook(hook: RotationRoundEndedHook): void {
  rotationRoundEndedHook = hook;
}

/**
 * The timer-expiry / controller-end path for a team round, reached from
 * `gameplay.service.handleRoundEnded`. Whatever was already correctly answered
 * counts; an in-progress or wrong attempt contributes nothing (spec Context, "End
 * condition"). Never throws: one team's failure is logged and the round still
 * advances, so a single bad row cannot strand the competition.
 */
export async function handleRotationRoundEnded(event: RoundEndedEvent): Promise<void> {
  cancelWakeup(event.roundId);
  const states = await repository.listRotationStates(event.roundId);

  for (const state of states) {
    if (state.finished) continue;
    try {
      await endTeam(state, "TIME_LIMIT");
    } catch (error) {
      logger.error("team rotation: failed to settle a team at the round's end", {
        roundId: event.roundId,
        teamId: state.teamId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // `maybeEndRound` refuses to advance while the round row is already FINISHED,
  // which is exactly the case here — the timer path that emitted this event marked
  // it. Drive the advance directly so the Team stage still moves on (Detail 5).
  const advanced = await maybeEndRound(event.roundId);
  if (!advanced) {
    await rotationRoundEndedHook?.(event);
  }
  await repository.deleteRotationStates(event.roundId);
}

// ---------------------------------------------------------------------------
// Reconnect
// ---------------------------------------------------------------------------

/**
 * What one tablet reads on reconnect. The Individual stage's
 * `GET /api/gameplay/:roundId/state` cannot serve a team round — its questions come
 * from `Question.roundId`, which a team round never sets (BLD-040) — so this is the
 * rotation round's own read.
 */
export async function getTabletState(
  roundId: string,
  participantId: string,
): Promise<RotationTabletState> {
  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }

  const membership = await resolveMembership(round.stage.competitionId, participantId);
  const state = await repository.loadRotationState(roundId, membership.teamId);
  const result = await repository.findTeamRoundResult(roundId, membership.teamId);

  const toEndedPayload = (
    correctCount: number,
    score: number,
    completionTimeSeconds: number | null,
  ): RotationEndedPayload => ({
    roundId,
    competitionId: round.stage.competitionId,
    stageId: round.stageId,
    teamId: membership.teamId,
    // `completionTimeSeconds` is written only for a queue-empty end (Detail 4), so
    // its presence is what distinguishes the two reasons after the fact.
    reason: completionTimeSeconds === null ? "TIME_LIMIT" : "ALL_CORRECT",
    correctCount,
    score,
    completionTimeSeconds,
  });

  if (!state) {
    if (!result) {
      throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
        code: "gameplay.notActive",
        details: { reason: "rotationNotStarted" },
      });
    }
    // The round is over and the working state is gone: the settled result is all a
    // reconnecting tablet needs.
    return {
      roundId,
      competitionId: round.stage.competitionId,
      stageId: round.stageId,
      teamId: membership.teamId,
      participantId,
      status: "FINISHED",
      hold: null,
      totalQuestionCount: 0,
      correctCount: result.correctCount,
      teamScore: result.score,
      nextRotationAtMs: 0,
      rotationPeriodSeconds: 0,
      totalTimeDeadlineMs: null,
      result: toEndedPayload(
        result.correctCount,
        result.score,
        result.completionTimeSeconds,
      ),
    };
  }

  const hold = state.holds.find((h) => h.participantId === participantId) ?? null;
  return {
    roundId,
    competitionId: state.competitionId,
    stageId: state.stageId,
    teamId: state.teamId,
    participantId,
    status: state.finished || round.status === "FINISHED" ? "FINISHED" : "ACTIVE",
    hold: hold?.question ? { question: hold.question, grid: hold.grid } : null,
    totalQuestionCount: state.totalQuestionCount,
    correctCount: state.correctCount,
    teamScore: state.correctCount * state.pointsPerQuestion,
    nextRotationAtMs: state.nextRotationAtMs,
    rotationPeriodSeconds: state.rotationPeriodSeconds,
    totalTimeDeadlineMs: state.totalTimeDeadlineMs,
    result: result
      ? toEndedPayload(result.correctCount, result.score, result.completionTimeSeconds)
      : null,
  };
}

export const teamRotationService = {
  isRotationRound,
  keepIncorrectSubmitInCirculation,
  startRotationRound,
  rotateTeam,
  submitRotation,
  getTabletState,
  handleRotationRoundEnded,
  installRotationHooks,
  installRotationRoundEndedHook,
  /**
   * One rotation tick, exposed for the tests. Not part of the module's public
   * surface for other modules — the tick is driven by this file's own wakeup
   * chain. A test calls it instead of waiting out a real 60-second period.
   */
  tickForTest: tick,
};
