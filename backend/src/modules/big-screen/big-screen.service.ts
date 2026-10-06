/**
 * The BigScreen module's domain rules and public interface (Unit 09). Other modules
 * call this service, never the repository (invariant 4).
 *
 * Owns: big-screen state, ranking projection, and the automatic rotation through
 * category leaderboards. The one rule this module exists to enforce is
 * **the big screen never computes a rank** (invariant 8): every payload it pushes
 * is read, already ordered and ranked, from the Ranking module. This module only
 * decides *which* category to show and *when* to advance.
 *
 * Connection gating: the big screen has no login (BSC-001). The unguessable
 * `bigScreenLinkToken` (Unit 03) is the only credential — `authenticateBigScreen`
 * resolves it to a competition or rejects the handshake. An invalid or regenerated
 * token is rejected (spec Error Cases).
 *
 * The rotation timer: while at least one big screen is connected to a competition,
 * a per-competition timer advances through the categories every
 * `ScoringConfiguration.rankingCycleSeconds` (default 180). After a stage finishes,
 * its final ranking stays in the cycle (RND-006) — recompute-on-read always returns
 * the latest snapshot, so a finished stage's final ranking keeps rotating in while
 * the competition waits for the next stage.
 */
import { logger } from "../../infra";
import { UnauthorizedError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { rankingService } from "../ranking/ranking.service";
import * as repository from "./big-screen.repository";
import type {
  BigScreenContext,
  BigScreenPushHook,
  BigScreenRankingPayload,
} from "./big-screen.types";

// ---------------------------------------------------------------------------
// Push hook (the realtime gateway installs the actual emit)
// ---------------------------------------------------------------------------

let pushHook: BigScreenPushHook | null = null;

export function installBigScreenPushHook(hook: BigScreenPushHook): void {
  pushHook = hook;
}

// ---------------------------------------------------------------------------
// Token authentication (no login — BSC-001)
// ---------------------------------------------------------------------------

/**
 * Resolve a big-screen link token to the competition it may display. Throws
 * `UnauthorizedError` for an unknown or empty token; the realtime gateway turns
 * that into a rejected handshake. Never reveals whether the token was close to a
 * real one — the rejection is generic.
 */
async function authenticateBigScreen(
  token: string | null | undefined,
): Promise<BigScreenContext> {
  if (!token) {
    throw new UnauthorizedError(translate("en", "bigScreen.unauthorized"), {
      code: "bigScreen.unauthorized",
    });
  }
  const competition = await repository.findCompetitionIdByBigScreenToken(token);
  if (!competition) {
    throw new UnauthorizedError(translate("en", "bigScreen.unauthorized"), {
      code: "bigScreen.unauthorized",
    });
  }
  return { competitionId: competition.id };
}

// ---------------------------------------------------------------------------
// The rotation timer (per competition, server-driven)
// ---------------------------------------------------------------------------

interface RotationState {
  timer: NodeJS.Timeout;
  /** Index of the category to show on the next tick. */
  nextIndex: number;
  /** Connected big-screen clients for this competition. */
  connections: number;
}

const rotations = new Map<string, RotationState>();

/**
 * Push one category's current ranking to the competition's big screens, then move
 * the rotation to the next category. Reads the latest ranking from the Ranking
 * module (recompute-on-read), so a provisional update and a finished stage's final
 * ranking both flow through without any caching here.
 */
async function tickOnce(competitionId: string): Promise<void> {
  const state = rotations.get(competitionId);
  if (!state) return;

  const competition = await repository.findCompetitionForRotation(competitionId);
  if (!competition) {
    stopRotation(competitionId);
    return;
  }
  const categories = competition.categories;
  if (categories.length === 0) return;

  const index = state.nextIndex % categories.length;
  const category = categories[index]!;
  state.nextIndex = (index + 1) % categories.length;

  const ranking = await rankingService.getCategoryRanking(competitionId, category.id);
  // A category with no Individual stage (defensive — Unit 03 always creates one) or
  // zero results yields an empty leaderboard, which is a valid display, not an error.
  const payload: BigScreenRankingPayload = {
    competitionId,
    categoryId: category.id,
    categoryName: category.name,
    scope: "INDIVIDUAL",
    isFinal: ranking?.isFinal ?? false,
    pageIndex: index,
    pageCount: categories.length,
    rows: ranking?.rows ?? [],
  };
  pushHook?.(payload);
}

async function runTick(competitionId: string): Promise<void> {
  try {
    await tickOnce(competitionId);
  } catch (error) {
    logger.error("bigScreen.tick: rotation tick failed", {
      competitionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Start the rotation for a competition if it is not already running. Reads the
 * cycle length once per start from the scoring configuration. Pushes the first
 * category immediately (a connecting big screen should not wait a whole cycle for
 * its first leaderboard), then advances on the timer.
 */
async function ensureRotation(competitionId: string): Promise<void> {
  if (rotations.has(competitionId)) return;
  const competition = await repository.findCompetitionForRotation(competitionId);
  if (!competition) return;
  const cycleSeconds = competition.scoringConfiguration?.rankingCycleSeconds ?? 180;
  const timer = setInterval(() => {
    void runTick(competitionId);
  }, cycleSeconds * 1000);
  // Do not keep the process alive for a display timer.
  timer.unref?.();
  rotations.set(competitionId, { timer, nextIndex: 0, connections: 0 });
  void runTick(competitionId);
}

function stopRotation(competitionId: string): void {
  const state = rotations.get(competitionId);
  if (!state) return;
  clearInterval(state.timer);
  rotations.delete(competitionId);
}

/**
 * Record a big-screen connection for a competition. Starts the rotation on the
 * first connection. Returns the competition id the socket is scoped to.
 */
async function registerConnection(competitionId: string): Promise<void> {
  await ensureRotation(competitionId);
  const state = rotations.get(competitionId);
  if (state) state.connections += 1;
}

/**
 * Record a big-screen disconnection. Stops the rotation when the last big screen
 * for a competition drops, so an idle competition runs no timer.
 */
function unregisterConnection(competitionId: string): void {
  const state = rotations.get(competitionId);
  if (!state) return;
  state.connections -= 1;
  if (state.connections <= 0) {
    stopRotation(competitionId);
  }
}

/**
 * Push the current leaderboard for the category a ranking update arrived for, out
 * of cycle. The Ranking module calls this (via the composition root) right after a
 * recompute so the big screen reflects a fresh result within the 2-second target
 * (U-58) instead of waiting for the next rotation tick. Only pushes when the
 * updated category is the one currently on screen for that competition.
 */
async function pushCurrentForUpdate(
  competitionId: string,
  categoryId: string,
): Promise<void> {
  const state = rotations.get(competitionId);
  if (!state) return; // no big screen connected; nothing to push to
  const competition = await repository.findCompetitionForRotation(competitionId);
  if (!competition) return;
  const categories = competition.categories;
  if (categories.length === 0) return;
  // The category currently on screen is the one the next tick will advance *from*.
  const currentIndex =
    (state.nextIndex - 1 + categories.length) % categories.length;
  if (categories[currentIndex]?.id !== categoryId) return;
  await runTick(competitionId);
}

export const bigScreenService = {
  installBigScreenPushHook,
  authenticateBigScreen,
  registerConnection,
  unregisterConnection,
  pushCurrentForUpdate,
};
