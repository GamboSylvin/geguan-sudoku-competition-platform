/**
 * Types for the Team stage's rotation relay (Unit 13).
 *
 * The round's working state — which tablet holds which question, what is left in
 * the refill queue, when the next rotation is due — is fast-changing, so it lives
 * in Redis with persistence on (BLD-007) and is mirrored into the existing
 * `TeamRotationState` row. The only *settled* durable value is `TeamRoundResult`
 * (spec Detail 4). No schema change: both rows already exist from Unit 1.
 */
import type { RoundQuestionPayload } from "../round/round.types";
import type { WorkingGrid } from "./gameplay.types";

/** A question as the tablet needs it. Solution is never included (BLD-010). */
export type RotationQuestion = RoundQuestionPayload;

/**
 * One tablet's current holding. `question` is null when the queue ran out and
 * this member has nothing to work on (spec Detail 3, the "nothing to work on
 * right now" state). `grid` travels with the question across a rotation
 * ("questions rotate, not seats", TEM-002) — it is the partly filled grid the
 * next member inherits, never reset.
 */
export interface TabletHold {
  participantId: string;
  question: RotationQuestion | null;
  grid: WorkingGrid;
}

/** The per-team rotation state, as Redis holds it. */
export interface RotationState {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  categoryId: string;
  /**
   * The fixed rotation order (spec Implementation Notes: "a stable list of active
   * member ids" — nothing in the decided rules calls for anything more elaborate).
   */
  memberOrder: string[];
  /** One entry per member in `memberOrder`. */
  holds: TabletHold[];
  /** Questions not yet dealt, in draw order. */
  refillQueue: RotationQuestion[];
  /** How many of the round's questions have been correctly answered so far. */
  correctCount: number;
  /** How many the round drew in total (`RoundSettings.teamQuestionCount`). */
  totalQuestionCount: number;
  /**
   * How many rotations have happened. The next rotation is due at
   * `nextRotationAtMs`; the tick loop is display cadence only, the deadline
   * decides (invariant 3).
   */
  rotationIndex: number;
  /** Server-clock epoch ms when the last rotation actually moved the questions. */
  lastRotationAtMs: number | null;
  /** Server-clock epoch ms when the next rotation is due. */
  nextRotationAtMs: number;
  /** Server-clock epoch ms when this team's round started. */
  startedAtMs: number;
  /**
   * The flat "points per question" value locked at round start (SCR-007/SCR-015,
   * RND-002/004 — a round's settings are read once, never re-read). A team round
   * never uses `Question.points`.
   */
  pointsPerQuestion: number;
  rotationPeriodSeconds: number;
  /**
   * Server-clock epoch ms when the optional total time runs out, or null when the
   * controller left `RoundSettings.teamTotalTimeSeconds` empty.
   */
  totalTimeDeadlineMs: number | null;
  /** True once this team's `TeamRoundResult` is written. */
  finished: boolean;
}

/** What `rotation:deal` pushes to each tablet of a team at round start. */
export interface RotationDealPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  /** The member this payload is addressed to. */
  participantId: string;
  /** The member's own holding; null when they were dealt nothing. */
  hold: { question: RotationQuestion; grid: WorkingGrid } | null;
  /** How many questions the round drew in total, for the progress display. */
  totalQuestionCount: number;
  /** The team's correct-answer count at deal time (always 0). */
  correctCount: number;
  /** The team's running score, `correctCount × pointsPerQuestion`. */
  teamScore: number;
  /** Server-clock epoch ms when the next rotation is due. */
  nextRotationAtMs: number;
  rotationPeriodSeconds: number;
  /** Server-clock epoch ms when the optional total time runs out, or null. */
  totalTimeDeadlineMs: number | null;
}

/**
 * What `rotation:rotated` pushes after a timed rotation, after a correct submit's
 * refill, and after a rejected stale-hold submit (spec Error Cases: the client is
 * refreshed with whatever question is now held). Same shape as the deal payload,
 * so one client handler covers all three.
 */
export interface RotationRotatedPayload extends RotationDealPayload {
  /** Why the tablet is being refreshed — for the client's transient message. */
  reason: "ROTATION" | "REFILL" | "STALE_HOLD" | "RECONNECT";
}

/** What `rotation:ended` pushes to every tablet of a team. */
export interface RotationEndedPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  /** How the round ended: every question answered, or the optional total time. */
  reason: "ALL_CORRECT" | "TIME_LIMIT";
  correctCount: number;
  /**
   * `correctCount × RoundSettings.teamPointsPerQuestion` (SCR-007/SCR-015). A flat
   * per-question value — never `Question.points`, and never an early-finish bonus
   * (spec Acceptance Criterion 7).
   */
  score: number;
  /** Set only when the round ended by queue-empty (spec Detail 4). */
  completionTimeSeconds: number | null;
}

/** The body of `POST /api/gameplay/rotation/:roundId/submit`. */
export interface RotationSubmitInput {
  questionId: string;
  grid: WorkingGrid;
}

/** What a rotation submit returns to the submitting tablet. */
export interface RotationSubmitResult {
  /** All-or-nothing answer check (Unit 08's `gridsEqual`, BLD-010). */
  correct: boolean;
  /** The team's running correct-answer count after this submit. */
  correctCount: number;
  /**
   * The team's running score, `correctCount × teamPointsPerQuestion`. Unlike the
   * Individual stage (SUB-007/BLD-029), a team round's score is a shared, flat
   * value the whole team watches move — it is not a hidden per-player result.
   */
  teamScore: number;
  /** True when this submit emptied the queue and therefore ended the round. */
  roundEnded: boolean;
}

/** What one tablet's reconnect read (`GET .../rotation/:roundId/state`) returns. */
export interface RotationTabletState {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  participantId: string;
  status: "ACTIVE" | "FINISHED";
  hold: { question: RotationQuestion; grid: WorkingGrid } | null;
  totalQuestionCount: number;
  correctCount: number;
  teamScore: number;
  nextRotationAtMs: number;
  rotationPeriodSeconds: number;
  totalTimeDeadlineMs: number | null;
  /** The settled result, present once this team's round has ended. */
  result: RotationEndedPayload | null;
}
