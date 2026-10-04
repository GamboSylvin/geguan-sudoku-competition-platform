/**
 * Types for the Gameplay module (Unit 07 — autosave, reconnection, grid restore,
 * and the question delivery at round start). Submission state and scoring types
 * are Unit 08's.
 *
 * The module owns: the player's working grid for every puzzle of the active
 * round (in Redis with persistence on, BLD-007), the autosave write path, and
 * the reconnect path that hands a player back exactly the grid they last saved
 * plus the server-authoritative remaining time.
 */
import type { RoundQuestionPayload } from "../round/round.types";

/**
 * One cell's value in the player's working grid. `null` means "empty". Values
 * are small integers (1..gridRows*gridColumns for a standard Sudoku); the shape
 * is the client's but the round-trip through Redis preserves it exactly.
 */
export type GridCellValue = number | null;

/** A working grid: a flat array of cells, row-major. */
export type WorkingGrid = GridCellValue[];

/**
 * The payload the player posts to `/api/gameplay/:roundId/autosave`. `grid` is
 * the full working grid for one question, not a diff — autosave is idempotent
 * and overwrite-style.
 */
export interface AutosaveInput {
  questionId: string;
  grid: WorkingGrid;
}

/**
 * The player's current saved grid for one question. Returned on reconnect so
 * the client can restore exactly what the player last typed.
 */
export interface SavedGridEntry {
  questionId: string;
  grid: WorkingGrid;
  /** Server-clock epoch ms when this entry was last written. */
  savedAtMs: number;
}

/**
 * What `GET /api/gameplay/:roundId/state` returns: the round's questions (so a
 * client that missed the `round:started` push still renders), the player's
 * saved grids, and the server-authoritative timer snapshot.
 */
export interface GameplayStatePayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  status: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
  questions: RoundQuestionPayload[];
  savedGrids: SavedGridEntry[];
  /** Server-authoritative timer; null when the round has no live timer yet. */
  timer: {
    remainingSeconds: number;
    totalSeconds: number;
  } | null;
}
