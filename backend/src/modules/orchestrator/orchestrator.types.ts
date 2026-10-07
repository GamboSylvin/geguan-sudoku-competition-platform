/**
 * The Orchestrator module. Owns: the sequence — start stage, preparation, start
 * and end round, next round, next stage, finish — and the reset/rematch/replay
 * mechanic (ROL-005).
 *
 * Unit 10 builds the single-student case of the archive-and-restart operation:
 * one judge restarts one student's running round, archiving the earlier attempt
 * (never deleting it) and giving the student a blank grid on the round's shared,
 * unchanged remaining time. Unit 11 will call the same public function at a wider
 * scope (whole round or whole competition) — parameterizing it by participant
 * list keeps the rule in exactly one place.
 */

/** Error codes used across the orchestrator module. */
export const ORCHESTRATOR_ROUND_NOT_RUNNING = "orchestrator.roundNotRunning";
export const ORCHESTRATOR_PARTICIPANT_NOT_FOUND =
  "orchestrator.participantNotFound";

export interface RestartOneParticipantInput {
  /** The round to restart the participant on. */
  roundId: string;
  /** The participant being restarted. */
  participantId: string;
}

export interface RestartOneParticipantResult {
  participationId: string;
  /** The attempt id that was archived (the "before" state). */
  archivedAttemptId: string | null;
  /** The fresh attempt id the participant is now working on. */
  newAttemptId: string;
  /** The visible restart count after this restart. */
  attemptCount: number;
  /** The server-authoritative remaining seconds on the round's shared timer. */
  remainingSeconds: number;
  /** Total seconds the round was started with. */
  totalSeconds: number;
}
