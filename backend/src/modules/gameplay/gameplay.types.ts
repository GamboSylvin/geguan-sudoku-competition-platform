/**
 * Types for the Gameplay module (Unit 07 — autosave, reconnection, grid restore;
 * Unit 08 — manual submission and the round-ended auto-submit).
 *
 * The module owns: the player's working grid for every puzzle of the active
 * round (in Redis with persistence on, BLD-007), the autosave write path, the
 * reconnect path, and the manual submit that closes a `RoundParticipation`
 * (Unit 08).
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
  /**
   * The caller's own participation state (Unit 08). When the round has been
   * submitted (manually or automatically), this is `"SUBMITTED"` or
   * `"AUTO_SUBMITTED"` and the client renders the read-only "submission
   * accepted" view; the score is never sent (SUB-007/BLD-029).
   */
  participationState: "WAITING" | "ACTIVE" | "SUBMITTED" | "AUTO_SUBMITTED" | "RESTARTED";
}

/**
 * What `POST /api/gameplay/:roundId/submit` returns (Unit 08, SUB-007/BLD-029).
 * The server never tells the player their score here; `accepted` is all that
 * crosses the wire.
 */
export interface SubmitResult {
  accepted: true;
  /** How the server recorded the submission — for the client's read-only view. */
  submissionType: "MANUAL" | "TIMEOUT" | "CONTROLLER_END" | "AUTO";
}
