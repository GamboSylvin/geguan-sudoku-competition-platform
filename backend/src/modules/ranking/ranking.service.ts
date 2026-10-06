/**
 * The Ranking module's domain rules and public interface (Unit 09). Other modules
 * call this service, never the repository (invariant 4).
 *
 * Owns: cumulative stage score, tie-breaking, provisional and final ranking.
 *
 * Two hard rules this module enforces:
 *   - **Categories are ranked separately, never mixed** (EVT-002). Every read and
 *     every computation is scoped to exactly one category; no query ever aggregates
 *     across categories.
 *   - **No score or rank reaches a player session** (SUB-007/BLD-029). The only
 *     outputs are the controller-facing read and the big-screen push (via the
 *     installed update hook). The player-facing reveal is Unit 12's concern.
 *
 * Trigger: the Gameplay module emits an "individual result finalized" signal each
 * time Unit 08 settles one participant's round result. Ranking subscribes, recomputes
 * that participant's category, stores a provisional snapshot, and — once every
 * participant in the category has finished both Individual rounds — stores the final
 * snapshot. A recompute pushes the new ranking to the big screen through the hook.
 */
import { logger } from "../../infra";
import * as repository from "./ranking.repository";
import type {
  CategoryRanking,
  IndividualResultFinalizedEvent,
  RankingRow,
  RankingSnapshotPayload,
  RankingUpdatePayload,
} from "./ranking.types";

// ---------------------------------------------------------------------------
// Tie-break (SCR-017, narrows U-22)
// ---------------------------------------------------------------------------

/**
 * Decide the relative order of two participants with an equal cumulative score.
 *
 * Today a genuine tie receives **shared rank** — this function reports "tie" (0) for
 * equal scores, so the two share a rank. The stakeholder confirmed that earlier
 * submission time wins a tie (superseding the client document's "round 1 score"
 * rule), but *how* submission time combines across an individual's two rounds is the
 * team's proposed extension, explicitly **not yet confirmed** (U-22, still open in
 * `unmade-decisions.md`). This unit does not guess that aggregation.
 *
 * Kept as a single named seam so that once U-22's extension is confirmed, only this
 * function changes — not the surrounding ranking computation (spec Implementation
 * Notes). Each round's `submittedAt` is already stored by Unit 08, so the upgrade
 * needs no rebuild.
 *
 * Returns a negative number if `a` ranks ahead of `b`, positive if behind, 0 for a
 * shared rank.
 */
export function breakTie(a: RankingRow, b: RankingRow): number {
  // Shared rank today: an equal cumulative score is a genuine tie (no guessed
  // tie-break). The participants' identity never decides rank.
  void a;
  void b;
  return 0;
}

// ---------------------------------------------------------------------------
// Ranking-update hook (the realtime gateway / big screen subscribes)
// ---------------------------------------------------------------------------

/**
 * Whoever needs to know a category ranking changed (the big screen, via the
 * realtime gateway) installs this hook. Installed once at startup; keeps this
 * module free of any import from realtime (invariant 4, no cycles).
 */
type RankingUpdateHook = (payload: RankingUpdatePayload) => void;
let rankingUpdateHook: RankingUpdateHook | null = null;

export function installRankingUpdateHook(hook: RankingUpdateHook): void {
  rankingUpdateHook = hook;
}

// ---------------------------------------------------------------------------
// The computation
// ---------------------------------------------------------------------------

/**
 * Build the ordered rows for one category from its finalized results. Sums each
 * participant's totalScore and completionTimeSeconds across the rounds they have
 * finalized, sorts descending by score, and assigns ranks with shared rank on a
 * genuine tie (via `breakTie`).
 *
 * Participants with no finalized result yet are included at the bottom (score 0),
 * so a provisional ranking reflects the whole category, not only those who have
 * finished. This keeps the leaderboard stable as results arrive.
 */
function buildRows(
  participants: { id: string; name: string }[],
  results: { participantId: string; totalScore: number; completionTimeSeconds: number }[],
): RankingRow[] {
  const totals = new Map<string, { score: number; completionTimeSeconds: number }>();
  for (const participant of participants) {
    totals.set(participant.id, { score: 0, completionTimeSeconds: 0 });
  }
  for (const result of results) {
    const acc = totals.get(result.participantId);
    if (!acc) continue; // a result for a participant no longer active in the category
    acc.score += result.totalScore;
    acc.completionTimeSeconds += result.completionTimeSeconds;
  }

  const sorted = participants
    .map((p) => {
      const acc = totals.get(p.id) ?? { score: 0, completionTimeSeconds: 0 };
      return {
        rank: 0, // assigned below
        participantId: p.id,
        participantName: p.name,
        score: acc.score,
        completionTimeSeconds: acc.completionTimeSeconds,
      } satisfies RankingRow;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // descending cumulative score
      return breakTie(a, b); // genuine tie → 0 → shared rank, stable order preserved
    });

  // Assign ranks with shared rank on a tie: equal score → equal rank, and the next
  // distinct score skips ahead by the number of participants that shared the rank
  // above (standard competition ranking, "1224").
  let previousScore: number | null = null;
  let previousRank = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i]!;
    if (previousScore !== null && row.score === previousScore) {
      row.rank = previousRank;
    } else {
      row.rank = i + 1;
      previousRank = row.rank;
      previousScore = row.score;
    }
  }
  return sorted;
}

/**
 * Recompute one category's Individual ranking from the durable results, store the
 * snapshot, and push the update. This is the single path both the live trigger and
 * the controller read use, so the two never diverge.
 *
 * Returns the recomputed ranking, or null when the competition has no Individual
 * stage (a defensive no-op — every competition created by Unit 03 has one).
 */
async function recomputeCategoryRanking(
  competitionId: string,
  categoryId: string,
): Promise<CategoryRanking | null> {
  const stage = await repository.findIndividualStageWithRounds(competitionId);
  if (!stage) return null;
  const roundIds = stage.rounds.map((r) => r.id);
  const roundCount = roundIds.length;

  const participants = await repository.listActiveCategoryParticipants(categoryId);
  const results = await repository.listFinalizedResultsForRounds(roundIds, categoryId);
  const rows = buildRows(participants, results);

  // A category is final once every active participant has a finalized result for
  // every Individual round. Count finalized rounds per participant.
  const finalizedRoundsPerParticipant = new Map<string, Set<string>>();
  for (const result of results) {
    let set = finalizedRoundsPerParticipant.get(result.participantId);
    if (!set) {
      set = new Set<string>();
      finalizedRoundsPerParticipant.set(result.participantId, set);
    }
    set.add(result.roundId);
  }
  const isFinal =
    participants.length > 0 &&
    roundCount > 0 &&
    participants.every(
      (p) => (finalizedRoundsPerParticipant.get(p.id)?.size ?? 0) >= roundCount,
    );

  const payload: RankingSnapshotPayload = {
    categoryId,
    scope: "INDIVIDUAL",
    isFinal,
    rows,
  };
  await repository.replaceCurrentSnapshot({
    competitionId,
    stageId: stage.id,
    categoryId,
    isFinal,
    payload,
  });

  const update: RankingUpdatePayload = {
    competitionId,
    categoryId,
    scope: "INDIVIDUAL",
    isFinal,
    rows,
  };
  rankingUpdateHook?.(update);

  return { categoryId, isFinal, rows };
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * The Gameplay module's "individual result finalized" signal handler (Unit 08 →
 * Unit 09). Recomputes the affected category. Never throws: a ranking failure must
 * not strand the submission path that emitted the signal — it is logged and the
 * category simply recomputes on the next signal or the next cycle tick.
 */
async function handleIndividualResultFinalized(
  event: IndividualResultFinalizedEvent,
): Promise<void> {
  try {
    await recomputeCategoryRanking(event.competitionId, event.categoryId);
  } catch (error) {
    logger.error("ranking.handleIndividualResultFinalized: recompute failed", {
      competitionId: event.competitionId,
      categoryId: event.categoryId,
      roundId: event.roundId,
      participantId: event.participantId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The controller-facing read: a category's current Individual ranking, recomputed
 * from the durable results. Recomputing on read keeps the controller's view
 * consistent with what the big screen shows, and stays cheap (one category, spec
 * Implementation Notes).
 */
async function getCategoryRanking(
  competitionId: string,
  categoryId: string,
): Promise<CategoryRanking | null> {
  return recomputeCategoryRanking(competitionId, categoryId);
}

export const rankingService = {
  breakTie,
  installRankingUpdateHook,
  recomputeCategoryRanking,
  handleIndividualResultFinalized,
  getCategoryRanking,
};
