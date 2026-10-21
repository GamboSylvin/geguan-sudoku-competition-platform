/**
 * Types for the Ranking module (Unit 09 — individual ranking).
 *
 * The module owns: cumulative stage score, tie-breaking, and provisional/final
 * ranking (architecture.md, "System boundaries"). It reads Unit 08's finalized
 * `IndividualRoundResult` rows and writes `RankingSnapshot` rows. It never exposes
 * a score or rank to a player session (SUB-007/BLD-029); the controller read and
 * the big-screen push are the only outputs.
 */

/**
 * One row of a category ranking, in the exact shape the big screen renders
 * (ui-context.md, "Big screen" columns: rank, player name, score, completion
 * time). `completionTimeSeconds` is the participant's cumulative completion time
 * across the rounds they have finalized so far.
 */
export interface RankingRow {
  rank: number;
  participantId: string;
  participantName: string;
  /** Cumulative totalScore across the category's finalized Individual rounds so far. */
  score: number;
  /** Cumulative completionTimeSeconds across the finalized Individual rounds so far. */
  completionTimeSeconds: number;
}

/**
 * The stored shape of a `RankingSnapshot.payload` for `scope = INDIVIDUAL`. The
 * snapshot is the durable record of a category's ranking at a moment in time —
 * provisional while the stage is still running, final once every participant has
 * finished both Individual rounds.
 */
export interface RankingSnapshotPayload {
  categoryId: string;
  scope: "INDIVIDUAL";
  isFinal: boolean;
  rows: RankingRow[];
}

/**
 * The payload pushed to big-screen clients on `ranking:update` and handed to the
 * realtime gateway by the ranking-update hook. Scoped to exactly one category
 * (EVT-002 — categories are never mixed).
 */
export interface RankingUpdatePayload {
  competitionId: string;
  categoryId: string;
  scope: "INDIVIDUAL";
  isFinal: boolean;
  rows: RankingRow[];
}

/**
 * The signal the Gameplay module emits after it finalizes one participant's
 * Individual-round result (Unit 08). Ranking subscribes to recompute the affected
 * category. Carries only identifiers — the ranking module re-reads the durable
 * results itself (server authority; the signal is a trigger, not the data).
 */
export interface IndividualResultFinalizedEvent {
  competitionId: string;
  stageId: string;
  roundId: string;
  participantId: string;
  categoryId: string;
}

/** What the controller-facing read returns: a category's current ranking. */
export interface CategoryRanking {
  categoryId: string;
  isFinal: boolean;
  rows: RankingRow[];
}
