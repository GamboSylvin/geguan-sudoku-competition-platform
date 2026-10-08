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
// Tie-break (SCR-020, resolves U-22)
// ---------------------------------------------------------------------------

/**
 * Decide the relative order of two participants with an equal cumulative score.
 *
 * SCR-020 (confirmed 2026-10-07, resolves U-22): a tie on cumulative score is broken
 * by the **sum of both Individual rounds' submission times — the lower sum ranks
 * ahead**. Each round's submission time is the `completionTimeSeconds` Unit 08 stores
 * when it finalizes the result (submission moment minus round start), and `buildRows`
 * already accumulates it per participant, so this compares the two sums directly.
 *
 * Two participants with an equal score *and* an equal summed time are still a genuine
 * tie and share a rank ("1224"); a participant's identity never decides rank.
 *
 * This is the individual-level tie-break only. The school-level version (Unit 15) sums
 * across all the school's counted players — a different aggregate, so it is a separate
 * function there, not a shared one (spec 15, Implementation Notes).
 *
 * Returns a negative number if `a` ranks ahead of `b`, positive if behind, 0 for a
 * shared rank.
 */
export function breakTie(a: RankingRow, b: RankingRow): number {
  return a.completionTimeSeconds - b.completionTimeSeconds;
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
 * finalized, sorts descending by score (equal scores ordered by `breakTie`), and
 * assigns ranks, sharing a rank only on a genuine tie (equal score *and* equal summed
 * submission time).
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
      return breakTie(a, b); // equal score → SCR-020's lower summed submission time first
    });

  // Assign ranks, sharing a rank only on a genuine tie: both the score and the
  // tie-break must be equal (SCR-020 means an equal score with a lower summed
  // submission time now ranks strictly ahead, not jointly). The next distinct
  // ordering skips ahead by the number of participants that shared the rank above
  // (standard competition ranking, "1224").
  let previousRow: RankingRow | null = null;
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i]!;
    if (
      previousRow !== null &&
      row.score === previousRow.score &&
      breakTie(row, previousRow) === 0
    ) {
      row.rank = previousRow.rank;
    } else {
      row.rank = i + 1;
    }
    previousRow = row;
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
