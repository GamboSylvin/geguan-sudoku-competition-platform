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

/** The three round kinds, named so the client can pick the right reconnect reader. */
export type RoundKind = "individual" | "rotation" | "partition";

/** A round status as the client sees it. */
export type RoundStatusValue = "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";

/**
 * One stage of the player-facing programme, with the rounds it holds. The player
 * never sees a round's questions here — only what is coming and how long it lasts,
 * which is what a waiting screen can honestly say before anything has been dealt.
 */
export interface ProgrammeRoundView {
  roundId: string;
  name: string;
  sequence: number;
  status: RoundStatusValue;
  kind: RoundKind;
  /**
   * The round's total playing time in seconds, resolved for its kind: an
   * Individual round's `durationSeconds`, a rotation round's
   * `teamTotalTimeSeconds` and a partition round's `partitionTotalTimeSeconds`.
   * Null when the round has no settings row yet (competition still being set up).
   */
  totalSeconds: number | null;
}

export interface ProgrammeStageView {
  stageId: string;
  stageType: "INDIVIDUAL" | "TEAM";
  stageSequence: number;
  stageStatus: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
  rounds: ProgrammeRoundView[];
}

/**
 * What `GET /api/gameplay/competition` returns: **which competition this session
 * belongs to**, and who the caller is inside it.
 *
 * Why this exists (report 2026-10-19, hole A): the player's entry token is
 * consumed and deleted by exactly one login (`takeEntryToken`), the stored
 * `Session` carries no `competitionId`, and a PLAYER session may only reach the
 * gameplay module — so the waiting screen had nothing to name. It rendered two
 * static strings ("Competition room" / "Waiting for the competition to start…")
 * with no competition name, no category, no school and no idea of what happens
 * next. The server always knew the answer (`identity.repository`'s
 * `findAccountCompetitionIds`, already used to verify the token at login); it was
 * simply never exposed for reading. This is that exposure: read-only, resolved
 * from the session alone, no migration.
 *
 * `competition` is never null for a real player session — a participant row
 * always belongs to a competition — but the shape stays nullable so a stale or
 * half-created account renders as an empty state rather than a 500.
 */
export interface MyCompetitionPayload {
  competition: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  } | null;
  /** The caller's own registration row, scoped to them and nobody else. */
  participant: {
    name: string;
    participantNumber: number;
    individualEvent: boolean;
    teamEvent: boolean;
  } | null;
  category: { id: string; code: string; name: string } | null;
  school: { name: string } | null;
  /** The whole schedule, in running order, with each round's status. */
  programme: ProgrammeStageView[];
}

/**
 * What `GET /api/gameplay/current-round` returns: which round — if any — the
 * caller is in right now, and what kind it is.
 *
 * This exists because a socket that connects *after* the round went ACTIVE missed
 * the one push that names it: `round:started` is emitted once, at the transition,
 * and `round:preparation-tick` is namespace-wide so it cannot be used to discover
 * "my" round without also accepting another competition's countdown. Everything
 * else the client can read is keyed by `:roundId`, which is exactly the value it
 * does not have. The session does resolve it: participant → competition → the
 * live round.
 *
 * `kind` is what routes the client to the right reconnect reader, because the
 * three round kinds have three different endpoints: a team round's questions come
 * from the category pool and never carry a `roundId` (BLD-040), so
 * `GET /:roundId/state` finds nothing for one.
 */
export interface CurrentRoundPayload {
  /** Null when the caller has no round running — the "waiting" screen is correct. */
  round: {
    roundId: string;
    competitionId: string;
    kind: RoundKind;
    status: RoundStatusValue;
    /** Server-authoritative timer; null when the round has no live timer. */
    timer: { remainingSeconds: number; totalSeconds: number } | null;
  } | null;
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
