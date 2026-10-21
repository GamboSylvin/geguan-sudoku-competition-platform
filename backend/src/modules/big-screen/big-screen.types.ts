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

/**
 * The display modes (Unit 11, BSC-002). `RANKING` is Unit 09's rotating
 * leaderboard; `PAUSED` and `FINAL` are this unit's additions, set automatically by
 * the controller's pause and finish commands and manually from the same endpoint.
 * `PLAYER_CLOSEUP` and `TEAM_SPLIT` exist in the schema's enum but no screen or
 * data backs them yet — they are explicitly out of scope for Unit 11.
 */
export type BigScreenMode =
  | "RANKING"
  | "PAUSED"
  | "FINAL"
  | "PLAYER_CLOSEUP"
  | "TEAM_SPLIT";

/**
 * The display state pushed to the screens on `big-screen:mode`, and returned to the
 * controller by the mode endpoint. The screen renders the mode it is told and never
 * decides one itself (invariant 8, in spirit: the screen computes nothing).
 */
export interface BigScreenModePayload {
  competitionId: string;
  mode: BigScreenMode;
  /** The category the controller picked manually; null while rotating. */
  targetId: string | null;
  rotationEnabled: boolean;
}

/** Who puts a mode change on the wire (the realtime gateway) installs this. */
export type BigScreenModeHook = (payload: BigScreenModePayload) => void;

/** What `authenticateBigScreen` resolves a valid link token to. */
export interface BigScreenContext {
  competitionId: string;
}
