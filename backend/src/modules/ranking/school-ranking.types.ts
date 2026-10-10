/**
 * Types for the Ranking module's school scope (Unit 15, spec 15).
 *
 * These live beside, not inside, Unit 09's `ranking.types.ts` on purpose: the
 * individual payload interfaces there are literal-typed to `scope: "INDIVIDUAL"`
 * and describe one participant per row, while a school row aggregates an entire
 * school. Keeping them in their own file also keeps the two builders' work off
 * the same file (Units 13/14 are being built in parallel).
 *
 * The one rule that shapes everything here (SCR-018, resolves U-04): the
 * individual half of a school's total counts **every** player the school has in
 * the category — not just the 2–6 players on that school's team. The team half
 * uses the school's single team in the category. Those are genuinely different
 * sets of people, so a row carries both halves separately.
 */

/**
 * One row of a category's school leaderboard.
 *
 * `schoolTotal` is an **exact decimal serialized as a string** (SCR-013: never
 * rounded or truncated). `RankingSnapshot.payload` is JSON and JSON has no decimal
 * type, so a JS number would reintroduce float imprecision on the way in and out.
 * The frontend renders the string as-is.
 */
export interface SchoolRankingRow {
  rank: number;
  schoolId: string;
  schoolName: string;
  /**
   * Sum of `IndividualRoundResult.totalScore` over every one of this school's
   * players in this category, across both Individual rounds — the pre-coefficient
   * half of the formula.
   */
  individualSum: number;
  /** The school's team score in the TEAM stage's round 1 (rotation relay). */
  teamRound1Score: number;
  /** The school's team score in the TEAM stage's round 2 (partition collaboration). */
  teamRound2Score: number;
  /** `individualSum × schoolCoefficient + teamRound1Score + teamRound2Score`, exact. */
  schoolTotal: string;
  /**
   * SCR-020's school-level tie-break: the sum of the submission times of the same
   * counted players as `individualSum` (every player, not just the team). Earlier
   * wins. Zero when nothing has been submitted yet.
   */
  completionTimeSeconds: number;
  /** How many of this school's active players are in this category — the counted set (SCR-018). */
  countedPlayers: number;
  /** False while any counted player is still missing an Individual result, or the team is missing a round score. */
  isComplete: boolean;
}

/**
 * The stored shape of a `RankingSnapshot.payload` for `scope = SCHOOL`.
 * `stageId` is null on the snapshot row itself: a school total spans both stages,
 * so it belongs to neither one.
 */
export interface SchoolRankingSnapshotPayload {
  categoryId: string;
  scope: "SCHOOL";
  isFinal: boolean;
  /** The coefficient actually applied, as an exact decimal string, for traceability. */
  schoolCoefficient: string;
  rows: SchoolRankingRow[];
}

/** What the controller-facing school-ranking read returns. */
export interface SchoolCategoryRanking {
  categoryId: string;
  /**
   * True only when every school's data is complete (both Individual rounds
   * finalized for every counted player, and a team score for both TEAM rounds).
   * An incomplete category is **not** an error — it returns what is computable
   * with `isFinal: false` (spec 15, Error Cases).
   */
  isFinal: boolean;
  schoolCoefficient: string;
  rows: SchoolRankingRow[];
}
