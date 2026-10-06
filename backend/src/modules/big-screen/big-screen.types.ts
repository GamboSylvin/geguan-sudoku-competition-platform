/**
 * Types for the BigScreen module (Unit 09 — the big-screen ranking display).
 *
 * The module owns: big-screen state, ranking projection, and the automatic rotation
 * through category leaderboards. It never computes a rank itself (invariant 8) — it
 * reads the Ranking module's recomputed rankings and pushes them to connected
 * big-screen clients on a server-driven timer.
 */
import type { RankingRow } from "../ranking/ranking.types";

/**
 * The payload pushed to a big-screen client on `ranking:update`. This is the exact
 * shape the big screen renders — the server has already ordered the rows and
 * assigned the ranks, so the client does no computation (invariant 8).
 */
export interface BigScreenRankingPayload {
  competitionId: string;
  categoryId: string;
  /** Display name of the category (the leaderboard's on-screen title). */
  categoryName: string;
  scope: "INDIVIDUAL";
  /** True once every participant in the category has finished both Individual rounds. */
  isFinal: boolean;
  /** 1-based position of this category in the rotation, for the client's "x of y". */
  pageIndex: number;
  /** Total categories in the rotation. */
  pageCount: number;
  rows: RankingRow[];
}

/**
 * The signal the big-screen service emits when it wants a payload pushed to every
 * big-screen client of one competition. The realtime gateway installs the hook that
 * actually puts it on the wire; this module never imports Socket.io (BLD-020).
 */
export type BigScreenPushHook = (payload: BigScreenRankingPayload) => void;

/** What `authenticateBigScreen` resolves a valid link token to. */
export interface BigScreenContext {
  competitionId: string;
}
