/**
 * Types for the Team stage's partition collaboration round (Unit 14, 齐心协力).
 *
 * Like Unit 13's rotation round, the working state is fast-changing, so Redis holds
 * the live copy (BLD-007) and `TeamPartitionState` is a best-effort durable mirror
 * (added by this unit — see `prisma/schema.prisma`). The only *settled* durable value
 * is `TeamRoundResult`, reused unchanged from Unit 13.
 *
 * The round has **no per-member submit**: a puzzle scores the instant the *combined*
 * grid is fully correct (spec Context, SCR-001/SCR-002). There is therefore no
 * `SubmitResult` shape here — the autosave response reports progress instead.
 */
import type { RoundQuestionPayload } from "../round/round.types";
import type { WorkingGrid } from "./gameplay.types";

/** A question as the tablet needs it. The solution is never included (BLD-010). */
export type PartitionQuestion = RoundQuestionPayload;

/**
 * One active member's contiguous horizontal row-band (TEM-005). Both ends are
 * **inclusive** row indices, so `endRow - startRow + 1` is the band's height. Bands
 * cover the puzzle's rows exactly once, in order, as equally as possible with the
 * extra rows going to the **first** bands — a 9-row grid split 4 ways is
 * `[3,2,2,2]`, never `[2,2,2,3]`.
 */
export interface RowBand {
  participantId: string;
  startRow: number;
  endRow: number;
}

/**
 * One member's contribution to the current puzzle: the cells of **their own band
 * only**, stored as a full-length grid array whose cells outside the band are always
 * `null`. Keeping it full-length (rather than a band-sized slice) makes the combined
 * grid a simple element-wise merge, and makes an out-of-band write structurally
 * impossible to represent rather than merely rejected.
 */
export interface MemberGrid {
  participantId: string;
  /** Length `gridRows × gridColumns`, row-major; non-null only inside the band. */
  grid: WorkingGrid;
}

/** The per-team partition state, as Redis holds it. */
export interface PartitionState {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  categoryId: string;
  /**
   * The band split, computed **once** at round start and reused for every puzzle
   * (a flagged assumption, isolated in the service's `reuseSplitAcrossPuzzles()`).
   * Ordered by band, covering rows `[0, gridRows)` exactly once.
   */
  bands: RowBand[];
  /**
   * The round's puzzles in play order, drawn from the category pool. Its length is
   * `min(partitionPuzzleCount, pool size)` — a pool smaller than the configured
   * count simply gives the team fewer puzzles, never a repeat.
   */
  puzzles: PartitionQuestion[];
  /** Zero-based index of the puzzle the team is working on now. */
  puzzleIndex: number;
  /** Puzzles whose combined grid reached a fully correct state. */
  solvedCount: number;
  /** One entry per band member, for the current puzzle. Cleared on each advance. */
  memberGrids: MemberGrid[];
  /** Server-clock epoch ms when this team's round started. */
  startedAtMs: number;
  /**
   * The flat points-per-puzzle value locked at round start (TEM-008; RND-002/004 — a
   * round's settings are read once, never re-read). Never `Question.points`.
   */
  pointsPerPuzzle: number;
  /** How many puzzles end the round (TEM-006). */
  puzzleCount: number;
  /** Server-clock epoch ms when `partitionTotalTimeSeconds` runs out (TEM-007). */
  totalTimeDeadlineMs: number;
  /** True once this team's `TeamRoundResult` is written. */
  finished: boolean;
}

/**
 * What `partition:deal` and `partition:puzzle-solved` push to each tablet. Both
 * carry the same shape so one client handler covers the deal, the advance and the
 * reconnect — the `reason` field is the only difference.
 *
 * The **whole grid** is sent to every member, with `editableRows` naming the band
 * they may change. The rest is shown read-only, not hidden (the second flagged
 * assumption, isolated in the service's `showOtherBandsReadOnly()`): the team needs
 * to see the puzzle to coordinate.
 */
export interface PartitionDealPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  /** The member this payload is addressed to. */
  participantId: string;
  /** Null once the round is over and there is no puzzle left to show. */
  puzzle: PartitionQuestion | null;
  /** This member's own band; null when the round is over. */
  band: RowBand | null;
  /**
   * The combined grid as it currently stands: every member's cells merged over the
   * puzzle's given cells. Sent whole so each tablet can render the other bands
   * read-only, and so a reconnecting member sees their teammates' progress.
   */
  grid: WorkingGrid;
  /** Zero-based; the client renders `puzzleIndex + 1` of `puzzleCount`. */
  puzzleIndex: number;
  puzzleCount: number;
  solvedCount: number;
  /** `solvedCount × pointsPerPuzzle`. A shared flat value, safe to show (see Unit 13). */
  teamScore: number;
  /** Server-clock epoch ms when the round's total time runs out. */
  totalTimeDeadlineMs: number;
  /** Why the tablet is being refreshed — for the client's transient message. */
  reason: "DEAL" | "PUZZLE_SOLVED" | "RECONNECT";
}

/** What `partition:round-ended` pushes to every tablet of a team. */
export interface PartitionEndedPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  /**
   * `ALL_SOLVED` = every puzzle was completed; `TIME_LIMIT` = the total time ran out
   * first (or the controller ended the round early).
   */
  reason: "ALL_SOLVED" | "TIME_LIMIT";
  /** Puzzles solved — `TeamRoundResult.correctCount`. */
  solvedCount: number;
  /**
   * `solvedCount × partitionPointsPerPuzzle` (spec Acceptance Criterion 6). A flat
   * per-puzzle value — never `Question.points`, and **never** an early-finish bonus
   * (spec Constraints).
   */
  score: number;
  /** Set only when the round ended by solving every puzzle (spec Detail 4). */
  completionTimeSeconds: number | null;
}

/** The body of `POST /api/gameplay/partition/:roundId/autosave`. */
export interface PartitionAutosaveInput {
  /** The puzzle the client believes it is editing — a stale-puzzle guard. */
  questionId: string;
  /**
   * This member's grid. The server keeps only the cells inside their own band and
   * ignores everything else; a grid claiming edits outside the band is rejected
   * (spec Error Cases, Security Considerations).
   */
  grid: WorkingGrid;
}

/**
 * What a partition autosave returns. There is no per-member "correct" — the check is
 * on the combined grid and the outcome is a team event, so the response reports
 * progress and lets the push carry the rest.
 */
export interface PartitionAutosaveResult {
  savedAtMs: number;
  puzzleIndex: number;
  puzzleCount: number;
  solvedCount: number;
  teamScore: number;
  /** True when this autosave completed a puzzle and the team advanced. */
  puzzleSolved: boolean;
  /** True when that solved puzzle was the last one, ending the round. */
  roundEnded: boolean;
}

/** What one tablet's reconnect read (`GET .../partition/:roundId/state`) returns. */
export interface PartitionTabletState {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  participantId: string;
  status: "ACTIVE" | "FINISHED";
  puzzle: PartitionQuestion | null;
  band: RowBand | null;
  grid: WorkingGrid;
  puzzleIndex: number;
  puzzleCount: number;
  solvedCount: number;
  teamScore: number;
  totalTimeDeadlineMs: number;
  /** The settled result, present once this team's round has ended. */
  result: PartitionEndedPayload | null;
}
