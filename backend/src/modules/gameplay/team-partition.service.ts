/**
 * The Team stage's second round: partition collaboration, 齐心协力 (Unit 14). The
 * round's domain rules live here; `team-partition.repository` holds only storage
 * access (invariant 4).
 *
 * What this implements, in the spec's own order:
 *   1. **Round start, puzzle 1** — compute each team's row-band split (one band per
 *      active member, as equal as possible, **extra rows to the first bands**,
 *      TEM-005) and deal the first puzzle to every member, each with only their own
 *      band editable.
 *   2. **Per-member editing** — the member autosaves their own band; the server
 *      rejects any cell outside it, per cell, not by trusting the client.
 *   3. **Combined-grid check** — after each autosave the server merges every band
 *      over the puzzle's given cells and evaluates the **combined** grid with Unit
 *      08's `gridsEqual` (all-or-nothing, BLD-010). Fully correct → award
 *      `partitionPointsPerPuzzle`, advance to the next puzzle with the **same** band
 *      split. There is no separate "submit" action (spec Context).
 *   4. **Round end** — every puzzle solved, or `partitionTotalTimeSeconds` first.
 *      Settles `TeamRoundResult`.
 *   5. **Stage/competition completion** — once every team's result is settled this
 *      round was the last one, so the advance chain runs Unit 11's whole-competition
 *      finish check. This unit **triggers** that check, it does not re-implement it.
 *
 * **No early-finish bonus, ever** (spec Constraints): nothing here calls
 * `computeEarlyBonus`. The score is the flat `solvedCount × pointsPerPuzzle`, never
 * `Question.points` (mirrors SCR-007/SCR-015's rule for the rotation round).
 */
import { setTimeout as scheduleTimeout, clearTimeout } from "node:timers";
import { logger } from "../../infra";
import { now, nowMs } from "../../shared/clock";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { scoringService } from "../scoring/scoring.service";
import { roundTimerService } from "../round/round-timer.service";
import * as roundRepository from "../round/round.repository";
import * as repository from "./team-partition.repository";
import type { WorkingGrid } from "./gameplay.types";
import type {
  MemberGrid,
  PartitionAutosaveInput,
  PartitionAutosaveResult,
  PartitionDealPayload,
  PartitionEndedPayload,
  PartitionState,
  PartitionTabletState,
  RowBand,
} from "./team-partition.types";
import type { RoundEndedEvent } from "../round/round.types";

/** Display cadence of the tick loop. Not authoritative — the deadline is (invariant 3). */
const TICK_MS = 250;

/** In-memory handle to the scheduled wakeup for one running partition round. */
const scheduledWakeups = new Map<string, NodeJS.Timeout>();

/**
 * When a running partition round was last seen paused, per round. The partition clock
 * stops with the round (SCR-011): the time spent paused is added back onto every
 * unfinished team's `totalTimeDeadlineMs` when the round resumes, so a 30-minute total
 * time is 30 minutes of *playing*, not 30 minutes of wall clock. Without this a pause
 * longer than the remaining total time would settle every team at `TIME_LIMIT` the
 * instant the controller resumed — a score decided by an administrative action, which
 * invariant 7 forbids.
 */
const pausedSince = new Map<string, number>();

// ---------------------------------------------------------------------------
// Push hooks (the realtime gateway installs these; no Socket.io import here)
// ---------------------------------------------------------------------------

/** Who a partition push is addressed to: one tablet of one team of one competition. */
export interface PartitionPushTarget {
  competitionId: string;
  teamId: string;
  participantId: string;
}

type DealHook = (target: PartitionPushTarget, payload: PartitionDealPayload) => void;
type EndedHook = (target: PartitionPushTarget, payload: PartitionEndedPayload) => void;

let dealHook: DealHook | null = null;
let endedHook: EndedHook | null = null;

/**
 * Install the two pushes. `partition:puzzle-solved` is the same handler as the deal
 * (`onDeal`) with `reason: "PUZZLE_SOLVED"` — the spec's three events are two payload
 * shapes, and the client renders both identically (a fresh puzzle, same band).
 */
export function installPartitionHooks(hooks: { onDeal: DealHook; onEnded: EndedHook }): void {
  dealHook = hooks.onDeal;
  endedHook = hooks.onEnded;
}

// ---------------------------------------------------------------------------
// The two flagged assumptions, isolated so either can be flipped (spec Notes)
// ---------------------------------------------------------------------------

/**
 * **Flagged assumption 1.** Nothing in the decided rules says to reshuffle the band
 * split between puzzles, so it is computed **once per team at round start** and reused
 * for every puzzle (spec Context). Flipping this to "reshuffle per puzzle" means
 * changing this function and the one branch in `advanceToNextPuzzle` that reads it —
 * nothing else in the round changes.
 */
export function reuseSplitAcrossPuzzles(): boolean {
  return true;
}

/**
 * **Flagged assumption 2.** The rest of the grid is shown **read-only, not hidden**, so
 * the team can see the whole puzzle for context (spec Context). This is a payload/UI
 * decision only — the server sends the combined grid either way, because it must send
 * the member's own cells merged over the given cells regardless. Flipping to "hidden"
 * means blanking the other bands in `toDealPayload`, guarded by this flag.
 */
export function showOtherBandsReadOnly(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** The Team stage's second round is the partition collaboration; round 1 is Unit 13. */
export function isPartitionRound(stageType: string, roundSequence: number): boolean {
  return stageType === "TEAM" && roundSequence === 2;
}

/**
 * The row-band split (TEM-005, spec Acceptance Criterion 1): `memberCount` contiguous
 * horizontal bands covering `[0, rows)` exactly once, **as equal as possible with the
 * extra rows going to the first bands**. A 9-row grid split 4 ways is `[3,2,2,2]`,
 * never `[2,2,2,3]`.
 *
 * Works for any grid shape and never assumes 9×9 (BLD-011). A grid with fewer rows
 * than members leaves the surplus members with an empty band (`startRow > endRow`) —
 * they can see the puzzle but own no rows. Team size is validated by Unit 04's import,
 * not here (spec Error Cases).
 *
 * Exported because it is the round's one piece of arithmetic worth testing directly.
 */
export function splitRowBands(rows: number, memberIds: string[]): RowBand[] {
  const count = memberIds.length;
  if (count === 0) return [];
  if (rows <= 0) return memberIds.map((participantId) => ({ participantId, startRow: 0, endRow: -1 }));

  const base = Math.floor(rows / count);
  // The first `extra` bands each get one more row — that is what makes [3,2,2,2].
  const extra = rows % count;

  const bands: RowBand[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const height = base + (i < extra ? 1 : 0);
    bands.push({
      participantId: memberIds[i]!,
      startRow: cursor,
      endRow: cursor + height - 1,
    });
    cursor += height;
  }
  return bands;
}

/** Fisher–Yates with a bounded draw — the same draw Unit 13 uses, kept local. */
function drawPuzzles<T>(pool: T[], count: number): T[] {
  const items = [...pool];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items.slice(0, Math.max(0, count));
}

function rowIndexOf(cellIndex: number, columns: number): number {
  return Math.floor(cellIndex / columns);
}

/**
 * Which cells of a full-length grid this band owns. A cell is in the band when its row
 * falls inside `[startRow, endRow]`; the columns are unrestricted (TEM-005 cuts
 * horizontal row-bands, not blocks).
 */
function bandCellIndices(band: RowBand, columns: number, size: number): number[] {
  const indices: number[] = [];
  if (band.endRow < band.startRow) return indices;
  for (let i = 0; i < size; i += 1) {
    const row = rowIndexOf(i, columns);
    if (row >= band.startRow && row <= band.endRow) indices.push(i);
  }
  return indices;
}

/**
 * Merge every member's band over the puzzle's given cells into the combined grid the
 * answer check runs against (spec Detail 3). A given cell is **never** overwritable —
 * the member's own value is ignored there, so a client cannot "solve" a puzzle by
 * rewriting the pre-filled numbers.
 */
function combineGrid(
  given: (number | null)[],
  memberGrids: MemberGrid[],
): WorkingGrid {
  const combined: WorkingGrid = [...given];
  for (const member of memberGrids) {
    for (let i = 0; i < combined.length && i < member.grid.length; i += 1) {
      if (given[i] !== null) continue;
      const value = member.grid[i];
      if (value !== null && value !== undefined) combined[i] = value;
    }
  }
  return combined;
}

/** True when no cell of the combined grid is still empty. */
function isFullyFilled(grid: WorkingGrid): boolean {
  return grid.every((cell) => cell !== null && cell !== undefined);
}

/** The durable mirror is bookkeeping only: never let it cost a team its round. */
async function mirrorSafely(state: PartitionState): Promise<void> {
  try {
    await repository.mirrorPartitionState(state);
  } catch (error) {
    logger.error("team partition: failed to mirror the partition state", {
      roundId: state.roundId,
      teamId: state.teamId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Resolve the caller to an active team member of this competition — what stops a
 * member writing on behalf of a teammate (spec Security Considerations).
 */
async function resolveMembership(
  competitionId: string,
  participantId: string,
): Promise<{ teamId: string; categoryId: string }> {
  const found = await repository.findTeamForParticipant(competitionId, participantId);
  if (!found) {
    throw new NotFoundError(translate("en", "partition.notATeamMember"), {
      code: "partition.notATeamMember",
    });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Payload assembly
// ---------------------------------------------------------------------------

/**
 * The puzzle the team is working on, or null once every puzzle is done. `puzzles` is
 * re-read from the category pool on demand rather than cached in Redis, so a puzzle's
 * given cells and solution are never persisted outside PostgreSQL (BLD-010).
 */
async function loadPuzzle(
  state: PartitionState,
): Promise<repository.PartitionPuzzleEntry | null> {
  const questionId = state.puzzles[state.puzzleIndex]?.id;
  if (!questionId) return null;
  const pool = await repository.listPartitionPool(state.competitionId, state.categoryId);
  return pool.find((entry) => entry.question.id === questionId) ?? null;
}

async function toDealPayload(
  state: PartitionState,
  participantId: string,
  reason: PartitionDealPayload["reason"],
): Promise<PartitionDealPayload> {
  const puzzle = state.finished ? null : await loadPuzzle(state);
  const band = state.bands.find((b) => b.participantId === participantId) ?? null;

  let grid: WorkingGrid = [];
  if (puzzle) {
    const combined = combineGrid(puzzle.given, state.memberGrids);
    grid = showOtherBandsReadOnly() || !band
      ? combined
      : // Not the rule this unit implements: hide every band but this member's.
        combined.map((cell, i) => {
          const row = rowIndexOf(i, puzzle.question.gridColumns);
          const mine = row >= band.startRow && row <= band.endRow;
          return mine || puzzle.given[i] !== null ? cell : null;
        });
  }

  return {
    roundId: state.roundId,
    competitionId: state.competitionId,
    stageId: state.stageId,
    teamId: state.teamId,
    participantId,
    puzzle: puzzle ? puzzle.question : null,
    band,
    grid,
    puzzleIndex: state.puzzleIndex,
    puzzleCount: state.puzzleCount,
    solvedCount: state.solvedCount,
    teamScore: state.solvedCount * state.pointsPerPuzzle,
    totalTimeDeadlineMs: state.totalTimeDeadlineMs,
    reason,
  };
}

function targetOf(state: PartitionState, participantId: string): PartitionPushTarget {
  return { competitionId: state.competitionId, teamId: state.teamId, participantId };
}

async function pushToAllMembers(
  state: PartitionState,
  reason: PartitionDealPayload["reason"],
): Promise<void> {
  if (!dealHook) return;
  for (const band of state.bands) {
    dealHook(targetOf(state, band.participantId), await toDealPayload(state, band.participantId, reason));
  }
}

function pushEnded(state: PartitionState, payload: PartitionEndedPayload): void {
  if (!endedHook) return;
  for (const band of state.bands) {
    endedHook(targetOf(state, band.participantId), payload);
  }
}

// ---------------------------------------------------------------------------
// Round start (spec Detail 1)
// ---------------------------------------------------------------------------

/**
 * Deal one team's round: draw its puzzles, compute the band split once, and hand every
 * member puzzle 1 with an empty grid. Idempotent — a team that already has working state
 * keeps it, so a repeated start cannot re-deal and orphan a member's progress.
 */
async function dealTeam(input: {
  roundId: string;
  competitionId: string;
  stageId: string;
  team: repository.RotationTeamRow;
  puzzleCount: number;
  pointsPerPuzzle: number;
  totalTimeSeconds: number;
  startedAtMs: number;
}): Promise<PartitionState> {
  const existing = await repository.loadPartitionState(input.roundId, input.team.teamId);
  if (existing) return existing;

  const pool = await repository.listPartitionPool(input.competitionId, input.team.categoryId);
  // A pool smaller than the configured count gives the team fewer puzzles; a puzzle is
  // never repeated (spec Context: only puzzles that reached a fully correct state count).
  const drawn = drawPuzzles(pool, input.puzzleCount);

  const memberIds = input.team.members.map((m) => m.participantId);
  // The split is computed against the first puzzle's row count and reused for every
  // puzzle (flagged assumption 1). A puzzle of a different shape than the first is a
  // pool inconsistency: it cannot be split by the same bands and is logged, not guessed.
  const rows = drawn[0]?.question.gridRows ?? 0;
  const bands = splitRowBands(rows, memberIds);
  const shapeMismatch = drawn.some(
    (entry) => entry.question.gridRows !== rows || entry.question.gridColumns !== (drawn[0]?.question.gridColumns ?? 0),
  );
  if (shapeMismatch) {
    logger.warn("team partition: the drawn puzzles do not all share one grid shape", {
      roundId: input.roundId,
      teamId: input.team.teamId,
      categoryId: input.team.categoryId,
    });
  }

  const state: PartitionState = {
    roundId: input.roundId,
    competitionId: input.competitionId,
    stageId: input.stageId,
    teamId: input.team.teamId,
    categoryId: input.team.categoryId,
    bands,
    puzzles: drawn.map((d) => d.question),
    puzzleIndex: 0,
    solvedCount: 0,
    memberGrids: bands.map((band) => ({
      participantId: band.participantId,
      grid: new Array<null>(rows * (drawn[0]?.question.gridColumns ?? 0)).fill(null),
    })),
    startedAtMs: input.startedAtMs,
    pointsPerPuzzle: input.pointsPerPuzzle,
    puzzleCount: drawn.length,
    totalTimeDeadlineMs: input.startedAtMs + input.totalTimeSeconds * 1000,
    finished: false,
  };

  await repository.savePartitionState(state);
  await mirrorSafely(state);

  if (drawn.length === 0) {
    // No puzzles at all in this category's pool: there is nothing to solve, so the
    // team's round is over the moment it began. Settle at zero rather than leaving
    // tablets on an empty puzzle forever — the same call Unit 13 makes.
    logger.warn("team partition: a category pool is empty; settling the team at zero", {
      roundId: input.roundId,
      teamId: input.team.teamId,
      categoryId: input.team.categoryId,
    });
    await endTeam(state, "ALL_SOLVED");
    return { ...state, finished: true };
  }

  await pushToAllMembers(state, "DEAL");
  return state;
}

/**
 * Round start for the Team stage's partition round. Called by the Round module at
 * countdown zero, in place of the Individual stage's "fetch all 6 puzzles" step —
 * a team round never sets `Question.roundId` (BLD-040).
 *
 * The round's own Unit 07 clock keeps running and stays the authority for
 * pause/resume and for the controller's end-early command (invariant 3).
 * `partitionTotalTimeSeconds` is tracked as this round's **own** deadline so the two
 * end conditions the spec names stay distinguishable: a team that solves every puzzle
 * before its total time gets `completionTimeSeconds`, one that runs out does not
 * (spec Detail 4).
 */
export async function startPartitionRound(input: {
  roundId: string;
  competitionId: string;
  stageId: string;
  partition: { puzzleCount: number; totalTimeSeconds: number; pointsPerPuzzle: number };
}): Promise<void> {
  const startedAtMs = nowMs();
  const teams = await repository.listTeamsWithActiveMembers(input.competitionId);

  if (teams.length === 0) {
    logger.warn("team partition: no team with active members; nothing to deal", {
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
        puzzleCount: input.partition.puzzleCount,
        pointsPerPuzzle: input.partition.pointsPerPuzzle,
        totalTimeSeconds: input.partition.totalTimeSeconds,
        startedAtMs,
      });
    } catch (error) {
      // One team's failed deal must not strand the whole round; log and continue.
      logger.error("team partition: failed to deal a team", {
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
// The tick loop: the total-time end condition (spec Detail 4)
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
      logger.error("team partition: tick failed", {
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
 * One tick: settle any team whose total time has elapsed, then re-arm. A tick is never
 * the authority — it reads the deadline and acts on whatever is due, so a delayed or
 * skipped tick only changes the display cadence (invariant 3). Unlike Unit 13 there is
 * no rotation to fire, so the loop has exactly one job.
 */
async function tick(roundId: string): Promise<void> {
  const timer = await roundTimerService.remaining(roundId);
  if (!timer || timer.status === "FINISHED") return;

  const states = await repository.listPartitionStates(roundId);
  if (states.length === 0) return;

  // While the round is paused the partition clock stops with it (SCR-011): re-arm so it
  // picks up again on resume, and settle nobody. The first paused tick stamps the pause;
  // nothing else touches the deadlines while it lasts.
  if (timer.status === "PAUSED") {
    if (!pausedSince.has(roundId)) pausedSince.set(roundId, nowMs());
    scheduleWakeup(roundId);
    return;
  }

  // Resumed: hand back the time spent paused by pushing every unfinished team's
  // deadline out by exactly that amount. A team that already finished keeps its
  // settled result untouched.
  const pauseStart = pausedSince.get(roundId);
  if (pauseStart !== undefined) {
    pausedSince.delete(roundId);
    const shift = Math.max(0, nowMs() - pauseStart);
    if (shift > 0) {
      for (const state of states) {
        if (state.finished) continue;
        state.totalTimeDeadlineMs += shift;
        try {
          await repository.savePartitionState(state);
          await repository.mirrorPartitionState(state);
        } catch (error) {
          logger.error("team partition: could not extend a team's deadline after a pause", {
            roundId,
            teamId: state.teamId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  const at = nowMs();
  for (const state of states) {
    if (state.finished) continue;
    try {
      if (at >= state.totalTimeDeadlineMs) await endTeam(state, "TIME_LIMIT");
    } catch (error) {
      logger.error("team partition: a team's tick failed", {
        roundId,
        teamId: state.teamId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ended = await maybeEndRound(roundId);
  if (!ended) scheduleWakeup(roundId);
}

// ---------------------------------------------------------------------------
// Per-member autosave and the combined-grid check (spec Details 2 and 3)
// ---------------------------------------------------------------------------

/**
 * Save one member's band and, if the combined grid just became fully correct, score the
 * puzzle and advance the team. This is the round's only write path — there is no
 * per-member submit (spec Context).
 *
 * Edit scoping is enforced **server-side, per cell** (spec Security Considerations): a
 * cell outside the caller's band, or on a given cell, may only echo what the server
 * already holds — a different value is a 422, not a silent trim. Silently dropping it
 * would hide a client bug and let a member believe an edit landed; rejecting an echo too
 * would fail every autosave, because the tablet sends the whole combined board it renders.
 *
 * Rejections: 404 the round does not exist; 404 the caller is not an active team member;
 * 422 the round is not a partition round; 409 the round already ended; 422 this team's
 * round has not been dealt; 409 the client is editing a puzzle the team has moved past;
 * 422 the grid length does not match the puzzle; 422 an edit outside the caller's band.
 */
export async function autosaveBand(
  roundId: string,
  participantId: string,
  input: PartitionAutosaveInput,
): Promise<PartitionAutosaveResult> {
  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }
  if (!isPartitionRound(round.stage.type, round.sequence)) {
    throw new UnprocessableEntityError(translate("en", "partition.notAPartitionRound"), {
      code: "partition.notAPartitionRound",
    });
  }
  // A round that is no longer ACTIVE has ended — its total time elapsed or the controller
  // ended it early. Both are the same thing to a tablet mid-edit: a 409 so the client
  // stops working and refreshes, never the generic "not active" 422.
  if (round.status !== "ACTIVE") {
    throw new ConflictError(translate("en", "partition.roundEnded"), {
      code: "partition.roundEnded",
    });
  }

  const membership = await resolveMembership(round.stage.competitionId, participantId);
  const state = await repository.loadPartitionState(roundId, membership.teamId);
  if (!state) {
    throw new UnprocessableEntityError(translate("en", "partition.partitionNotStarted"), {
      code: "partition.partitionNotStarted",
    });
  }
  if (state.finished) {
    throw new ConflictError(translate("en", "partition.roundEnded"), {
      code: "partition.roundEnded",
    });
  }

  const puzzle = await loadPuzzle(state);
  if (!puzzle || puzzle.question.id !== input.questionId) {
    // The stale-puzzle race: this autosave was in flight while a teammate's edit solved
    // the puzzle and the team advanced. Reject and let the client refresh.
    throw new ConflictError(translate("en", "partition.stalePuzzle"), {
      code: "partition.stalePuzzle",
      details: { currentQuestionId: puzzle?.question.id ?? null },
    });
  }

  const band = state.bands.find((b) => b.participantId === participantId) ?? null;
  if (!band) {
    throw new UnprocessableEntityError(translate("en", "partition.noBand"), {
      code: "partition.noBand",
    });
  }

  const columns = puzzle.question.gridColumns;
  const size = puzzle.question.gridRows * columns;
  if (input.grid.length !== size) {
    throw new UnprocessableEntityError(translate("en", "partition.invalidGrid"), {
      code: "partition.invalidGrid",
      details: { expectedLength: size, receivedLength: input.grid.length },
    });
  }

  // Per-cell scoping. Only the caller's own band cells, and only where the puzzle left a
  // blank, may carry a *new* value. A cell elsewhere that merely **echoes** what the
  // server already holds is not an edit — and the tablet sends the whole combined board
  // every time, because that is what it renders — so an echo must pass and only a
  // difference is a 422. Rejecting echoes too would make every autosave fail, and
  // accepting a difference would let a member write into a teammate's band.
  const current = combineGrid(puzzle.given, state.memberGrids);
  const allowed = new Set(bandCellIndices(band, columns, size));
  for (let i = 0; i < size; i += 1) {
    const value = input.grid[i];
    if (value === null || value === undefined) continue;
    const outsideBand = !allowed.has(i) || puzzle.given[i] !== null;
    if (outsideBand && current[i] !== value) {
      throw new UnprocessableEntityError(translate("en", "partition.outsideBand"), {
        code: "partition.outsideBand",
        details: { cellIndex: i, row: rowIndexOf(i, columns), band },
      });
    }
  }

  // Kept cells only: this member's contribution is their band, with everything outside it
  // nulled, which makes an out-of-band write structurally unrepresentable from here on.
  const ownGrid: WorkingGrid = new Array<null>(size).fill(null);
  for (const i of allowed) {
    if (puzzle.given[i] !== null) continue;
    const value = input.grid[i];
    ownGrid[i] = value === undefined ? null : value;
  }

  const memberGrids: MemberGrid[] = state.memberGrids.map((m) =>
    m.participantId === participantId ? { participantId, grid: ownGrid } : m,
  );

  // Detail 3: check whether every band is filled, and if so evaluate the **combined**
  // grid with Unit 08's logic unchanged (BLD-010). The check is entirely server-side;
  // no client ever reports "my band is correct".
  const combined = combineGrid(puzzle.given, memberGrids);
  const solved = isFullyFilled(combined) && scoringService.gridsEqual(combined, puzzle.solution);

  if (!solved) {
    const updated: PartitionState = { ...state, memberGrids };
    await repository.savePartitionState(updated);
    await mirrorSafely(updated);
    return {
      savedAtMs: nowMs(),
      puzzleIndex: updated.puzzleIndex,
      puzzleCount: updated.puzzleCount,
      solvedCount: updated.solvedCount,
      teamScore: updated.solvedCount * updated.pointsPerPuzzle,
      puzzleSolved: false,
      roundEnded: false,
    };
  }

  const solvedCount = state.solvedCount + 1;
  const isLastPuzzle = solvedCount >= state.puzzleCount;

  if (isLastPuzzle) {
    // Detail 4: `completionTimeSeconds` is set only when the round ended by solving
    // every puzzle, which is exactly this branch.
    const finishedState: PartitionState = { ...state, memberGrids, solvedCount };
    await endTeam(finishedState, "ALL_SOLVED");
    const roundEnded = await maybeEndRound(roundId);
    return {
      savedAtMs: nowMs(),
      puzzleIndex: state.puzzleIndex,
      puzzleCount: state.puzzleCount,
      solvedCount,
      teamScore: solvedCount * state.pointsPerPuzzle,
      puzzleSolved: true,
      roundEnded,
    };
  }

  // Advance to the next puzzle: fresh grids, and — under the rule this unit implements —
  // the **same** band split. `reuseSplitAcrossPuzzles()` is the single place that decides
  // it (flagged assumption 1); flipping it to false re-splits against the next puzzle's own
  // row count, which is why both branches are spelled out here rather than sharing one.
  const nextIndex = state.puzzleIndex + 1;
  const nextPuzzle = state.puzzles[nextIndex] ?? null;
  const blankGrids = (bands: RowBand[]): MemberGrid[] =>
    bands.map((band) => ({
      participantId: band.participantId,
      grid: new Array<null>(size).fill(null),
    }));

  const advanced: PartitionState = reuseSplitAcrossPuzzles()
    ? {
        ...state,
        bands: state.bands,
        memberGrids: blankGrids(state.bands),
        puzzleIndex: nextIndex,
        solvedCount,
      }
    : {
        ...state,
        // Not the rule this unit implements: reshuffle the split for each puzzle.
        bands: splitRowBands(nextPuzzle?.gridRows ?? puzzle.question.gridRows, state.bands.map((b) => b.participantId)),
        memberGrids: blankGrids(
          splitRowBands(nextPuzzle?.gridRows ?? puzzle.question.gridRows, state.bands.map((b) => b.participantId)),
        ),
        puzzleIndex: nextIndex,
        solvedCount,
      };

  await repository.savePartitionState(advanced);
  await mirrorSafely(advanced);
  await pushToAllMembers(advanced, "PUZZLE_SOLVED");

  return {
    savedAtMs: nowMs(),
    puzzleIndex: advanced.puzzleIndex,
    puzzleCount: advanced.puzzleCount,
    solvedCount: advanced.solvedCount,
    teamScore: advanced.solvedCount * advanced.pointsPerPuzzle,
    puzzleSolved: true,
    roundEnded: false,
  };
}

// ---------------------------------------------------------------------------
// Round end (spec Detail 4)
// ---------------------------------------------------------------------------

/**
 * Settle one team's `TeamRoundResult` and push `partition:round-ended` to its tablets.
 * Idempotent: the repository's find-then-create is the only thing standing between a late
 * tick and a duplicate result row (`TeamRoundResult` has no unique constraint on
 * (roundId, teamId)).
 *
 * The score is `solvedCount × pointsPerPuzzle` (spec Acceptance Criterion 6). A puzzle
 * left incomplete when time ran out contributes nothing, which needs no special case —
 * it simply never incremented `solvedCount`.
 */
async function endTeam(
  state: PartitionState,
  reason: "ALL_SOLVED" | "TIME_LIMIT",
): Promise<void> {
  if (state.finished) return;

  const completionTimeSeconds =
    reason === "ALL_SOLVED"
      ? Math.max(0, Math.round((nowMs() - state.startedAtMs) / 1000))
      : null;
  const score = state.solvedCount * state.pointsPerPuzzle;

  await repository.finalizeTeamRoundResult({
    roundId: state.roundId,
    teamId: state.teamId,
    categoryId: state.categoryId,
    correctCount: state.solvedCount,
    score,
    completionTimeSeconds,
  });

  const finished: PartitionState = { ...state, finished: true };
  await repository.savePartitionState(finished);
  await mirrorSafely(finished);

  pushEnded(finished, {
    roundId: state.roundId,
    competitionId: state.competitionId,
    stageId: state.stageId,
    teamId: state.teamId,
    reason,
    solvedCount: state.solvedCount,
    score,
    completionTimeSeconds,
  });
}

/**
 * When every team has a settled result, the round itself is over: flip the durable state,
 * stop the Unit 07 clock without marking it an early end, and hand the advance to the
 * Gameplay module's chain (Detail 5). Returns true when this call ended it.
 *
 * `roundTimerService.stopRoundEarly` is deliberately **not** used: it writes
 * `Round.earlyEnded`, the controller's end-round-early flag (§7.4), which would mislabel a
 * round that finished on its own. The timer is released and the round marked FINISHED
 * directly — the same transition Unit 13's natural finish performs.
 *
 * Because this is the Team stage's **last** round, the advance chain finds no next round,
 * finishes the stage, and runs Unit 11's whole-competition finish check (spec Detail 5,
 * Acceptance Criterion 7). This unit triggers that check; it does not re-implement it.
 */
async function maybeEndRound(roundId: string): Promise<boolean> {
  const states = await repository.listPartitionStates(roundId);
  if (states.length === 0) return false;
  if (states.some((s) => !s.finished)) return false;

  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round || round.status === "FINISHED") return false;

  cancelWakeup(roundId);
  pausedSince.delete(roundId);
  await roundTimerService.releaseTimer(roundId);
  await roundRepository.setRoundStatus(roundId, "FINISHED", { endedAt: now() });
  await roundRepository.upsertRuntimeState({
    competitionId: round.stage.competitionId,
    currentStageId: round.stageId,
    currentRoundId: roundId,
    phase: "ROUND_FINISHED",
  });

  // The Gameplay module owns the advance chain (Unit 08's CS-022 path, extended for the
  // Team stage by Unit 13's Detail 5 and reused here). It imports this file, so the
  // callback is installed as a hook rather than imported — no cycle (invariant 4).
  await partitionRoundEndedHook?.({
    roundId,
    stageId: round.stageId,
    competitionId: round.stage.competitionId,
    endedAtMs: nowMs(),
  });

  await repository.deletePartitionStates(roundId);
  return true;
}

/**
 * Installed by `gameplay.service` at module load: what to do once a partition round has
 * ended on its own. For this round that is the whole-competition finish check, since it is
 * the last round of the last stage. Keeps this file free of an import from
 * `gameplay.service`, which imports this one.
 */
type PartitionRoundEndedHook = (event: RoundEndedEvent) => Promise<void>;
let partitionRoundEndedHook: PartitionRoundEndedHook | null = null;
export function installPartitionRoundEndedHook(hook: PartitionRoundEndedHook): void {
  partitionRoundEndedHook = hook;
}

/**
 * The timer-expiry / controller-end path for this round, reached from
 * `gameplay.service.handleRoundEnded`. Whatever was already solved counts; an incomplete
 * puzzle contributes nothing (spec Context, "Round end condition"). Never throws: one
 * team's failure is logged and the round still advances, so a single bad row cannot strand
 * the competition.
 */
export async function handlePartitionRoundEnded(event: RoundEndedEvent): Promise<void> {
  cancelWakeup(event.roundId);
  pausedSince.delete(event.roundId);
  const states = await repository.listPartitionStates(event.roundId);

  for (const state of states) {
    if (state.finished) continue;
    try {
      await endTeam(state, "TIME_LIMIT");
    } catch (error) {
      logger.error("team partition: failed to settle a team at the round's end", {
        roundId: event.roundId,
        teamId: state.teamId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // `maybeEndRound` refuses to advance while the round row is already FINISHED, which is
  // exactly the case here — the timer path that emitted this event marked it. Drive the
  // advance directly so the competition still completes (Detail 5).
  const advanced = await maybeEndRound(event.roundId);
  if (!advanced) {
    await partitionRoundEndedHook?.(event);
  }
  await repository.deletePartitionStates(event.roundId);
}

// ---------------------------------------------------------------------------
// Reconnect
// ---------------------------------------------------------------------------

/**
 * What one tablet reads on reconnect. The Individual stage's
 * `GET /api/gameplay/:roundId/state` cannot serve a team round — its questions come from
 * `Question.roundId`, which a team round never sets (BLD-040) — so this is the partition
 * round's own read, mirroring Unit 13's.
 */
export async function getTabletState(
  roundId: string,
  participantId: string,
): Promise<PartitionTabletState> {
  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }

  const membership = await resolveMembership(round.stage.competitionId, participantId);
  const state = await repository.loadPartitionState(roundId, membership.teamId);
  const result = await repository.findTeamRoundResult(roundId, membership.teamId);

  const toEndedPayload = (
    solvedCount: number,
    score: number,
    completionTimeSeconds: number | null,
  ): PartitionEndedPayload => ({
    roundId,
    competitionId: round.stage.competitionId,
    stageId: round.stageId,
    teamId: membership.teamId,
    // `completionTimeSeconds` is written only for an all-solved end (Detail 4), so its
    // presence is what distinguishes the two reasons after the fact.
    reason: completionTimeSeconds === null ? "TIME_LIMIT" : "ALL_SOLVED",
    solvedCount,
    score,
    completionTimeSeconds,
  });

  if (!state) {
    if (!result) {
      throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
        code: "gameplay.notActive",
        details: { reason: "partitionNotStarted" },
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
      puzzle: null,
      band: null,
      grid: [],
      puzzleIndex: 0,
      puzzleCount: 0,
      solvedCount: result.correctCount,
      teamScore: result.score,
      totalTimeDeadlineMs: 0,
      result: toEndedPayload(result.correctCount, result.score, result.completionTimeSeconds),
    };
  }

  const deal = await toDealPayload(state, participantId, "RECONNECT");
  return {
    roundId,
    competitionId: state.competitionId,
    stageId: state.stageId,
    teamId: state.teamId,
    participantId,
    status: state.finished || round.status === "FINISHED" ? "FINISHED" : "ACTIVE",
    puzzle: deal.puzzle,
    band: deal.band,
    grid: deal.grid,
    puzzleIndex: state.puzzleIndex,
    puzzleCount: state.puzzleCount,
    solvedCount: state.solvedCount,
    teamScore: state.solvedCount * state.pointsPerPuzzle,
    totalTimeDeadlineMs: state.totalTimeDeadlineMs,
    result: result
      ? toEndedPayload(result.correctCount, result.score, result.completionTimeSeconds)
      : null,
  };
}

export const teamPartitionService = {
  isPartitionRound,
  splitRowBands,
  reuseSplitAcrossPuzzles,
  showOtherBandsReadOnly,
  startPartitionRound,
  autosaveBand,
  getTabletState,
  handlePartitionRoundEnded,
  installPartitionHooks,
  installPartitionRoundEndedHook,
  /**
   * One tick, exposed for the tests. Not part of the module's public surface for other
   * modules — the tick is driven by this file's own wakeup chain. A test calls it instead
   * of waiting out a real 30-minute total time.
   */
  tickForTest: tick,
};
