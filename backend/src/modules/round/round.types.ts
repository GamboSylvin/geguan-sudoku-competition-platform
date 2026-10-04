/**
 * Types for the Round module (Unit 07 — round runtime and autosave).
 *
 * The module owns: stage and round state transitions, the preparation countdown,
 * the round timer (start / pause / resume / remaining), and the round-end signal.
 * The "3, 2, 1, Start" that plays on resume (RND-001) and the auto-advance
 * between rounds (CS-022) also live here; the *first* stage is started by an
 * internal dev trigger (Unit 11 replaces it), and advancing past the last round
 * of a stage stays a human action (RND-006).
 *
 * This unit does not score, does not build submission, and does not expose any
 * controller-facing command — those belong to Units 08 and 11.
 */
import type { RoundStatus } from "@prisma/client";

/** The phases a competition's runtime moves through (CompetitionRuntimeState.phase). */
export type CompetitionPhase =
  | "WAITING"
  | "PREPARATION"
  | "ROUND_ACTIVE"
  | "PAUSED"
  | "ROUND_FINISHED"
  | "STAGE_FINISHED"
  | "FINISHED";

/**
 * What the timer service reports about one round. `remainingSeconds` is the
 * authoritative value, always computed from the server clock (invariant 3);
 * the client's own countdown is cosmetic.
 */
export interface TimerSnapshot {
  roundId: string;
  status: RoundStatus;
  /** Whole seconds left on the current phase (preparation or round). */
  remainingSeconds: number;
  /** Total seconds the phase was started with (preparation or round duration). */
  totalSeconds: number;
}

/**
 * The two timer modes. A pause applies to whichever mode is currently running
 * (preparation or round-active); the mode is what `pause()`/`resume()` preserve.
 */
export type TimerMode = "preparation" | "round";

/**
 * Internal record the timer service keeps per running round, persisted to Redis
 * (with persistence on, BLD-007) so a server restart can recover the paused
 * state. All times are server-clock epoch milliseconds.
 */
export interface TimerState {
  roundId: string;
  competitionId: string;
  stageId: string;
  mode: TimerMode;
  status: RoundStatus;
  /** Epoch ms at which the current mode ends; meaningless while paused. */
  deadlineMs: number;
  /** Total seconds the mode was started with (for the client's progress display). */
  totalSeconds: number;
  /** Set only while paused: how much was left when the pause began. */
  pausedRemainingSeconds: number | null;
}

/** The payload pushed on `round:preparation-tick`. */
export interface PreparationTickPayload {
  roundId: string;
  stageId: string;
  competitionId: string;
  remainingSeconds: number;
  totalSeconds: number;
}

/** One question the active round's clients receive. Solution is never sent. */
export interface RoundQuestionPayload {
  id: string;
  sequence: number;
  type: "STANDARD" | "VARIANT";
  gridRows: number;
  gridColumns: number;
  regions: unknown;
  startingGrid: unknown;
  points: number;
}

/** The payload pushed on `round:started` (carries the round's questions — BLD-006). */
export interface RoundStartedPayload {
  roundId: string;
  stageId: string;
  competitionId: string;
  durationSeconds: number;
  questions: RoundQuestionPayload[];
}

/** The payload pushed on `round:timer-sync` (on reconnect, and periodically). */
export interface TimerSyncPayload {
  roundId: string;
  competitionId: string;
  status: RoundStatus;
  mode: TimerMode;
  remainingSeconds: number;
  totalSeconds: number;
}

/** The payload pushed on `round:paused` and `round:resumed`. */
export interface RoundPausedPayload {
  roundId: string;
  competitionId: string;
  pausedRemainingSeconds: number;
}
export interface RoundResumedPayload {
  roundId: string;
  competitionId: string;
  /**
   * Resume plays "3, 2, 1, Start" first (RND-001): `resumesAt` is when the
   * countdown actually continues; `resumeCountdownSeconds` is the 3.
   */
  resumesAtMs: number;
  resumeCountdownSeconds: number;
  pausedRemainingSeconds: number;
}

/** What the dev-only internal trigger returns. */
export interface StartedPreparationResult {
  competitionId: string;
  stageId: string;
  roundId: string;
  status: RoundStatus;
  preparationSeconds: number;
}

/** Internal "round ended" signal. Unit 08 subscribes; nothing else in this unit. */
export interface RoundEndedEvent {
  roundId: string;
  stageId: string;
  competitionId: string;
  endedAtMs: number;
}
