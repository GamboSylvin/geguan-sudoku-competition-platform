/**
 * School ranking (Unit 15, spec 15 — SCR-013, SCR-018, SCR-020, resolves U-04).
 *
 * A school's total in a category is
 *
 *   (sum of every one of the school's players' `IndividualRoundResult.totalScore`
 *    across both Individual rounds) × `ScoringConfiguration.schoolCoefficient`
 *   + the school's team score in TEAM round 1 (rotation relay)
 *   + the school's team score in TEAM round 2 (partition collaboration)
 *
 * Two things are easy to get wrong and are handled explicitly here:
 *
 * 1. **The individual half counts every player the school has in the category, not
 *    just the team.** A school may have 20 players in a category but a 4-person
 *    team; the individual half sums all 20, the team half uses the one team's two
 *    round scores. Those are different sets of people (SCR-018).
 *
 * 2. **The total is an exact decimal, never rounded or truncated (SCR-013).**
 *    `schoolCoefficient` is a Prisma `Decimal` for exactly that reason, so the
 *    whole computation runs on `Prisma.Decimal` and the result is serialized into
 *    the JSON snapshot payload as a **string** — JSON has no decimal type, and a
 *    JS number would reintroduce float imprecision on the way in and out.
 *
 * An incomplete category is not an error: it returns whatever is computable with
 * `isFinal: false` (spec 15, Error Cases).
 */
import { Prisma } from "@prisma/client";
import { translate } from "../../shared/i18n";
import { NotFoundError } from "../../shared/errors";
import {
  findIndividualStageWithRounds,
  listFinalizedResultsForRounds,
} from "./ranking.repository";
import {
  findCurrentSchoolSnapshot,
  findScoringConfiguration,
  findTeamStageWithRounds,
  listActiveCategoryParticipantsWithSchool,
  listSchools,
  listTeamResultsForRounds,
  listTeamsInCategory,
  replaceCurrentSchoolSnapshot,
} from "./school-ranking.repository";
import type {
  SchoolCategoryRanking,
  SchoolRankingRow,
  SchoolRankingSnapshotPayload,
} from "./school-ranking.types";

/**
 * The school-level tie-break (SCR-020). It is deliberately **not** Unit 09's
 * `breakTie`: that one compares one participant's own cumulative completion time,
 * this one compares the sum of the submission times of all the school's counted
 * players — a different aggregate over a different set (spec 15, Implementation
 * Notes: "two small functions, not one shared one"). Earlier wins.
 */
export function schoolBreakTie(a: SchoolRankingRow, b: SchoolRankingRow): number {
  return a.completionTimeSeconds - b.completionTimeSeconds;
}

/** Mutable accumulator while results are being folded into their school. */
interface SchoolAccumulator {
  schoolId: string;
  schoolName: string;
  individualSum: number;
  completionTimeSeconds: number;
  /** How many of them have finalized *every* Individual round. */
  playersFinished: number;
  /** How many of this school's active players are in this category at all (SCR-018). */
  playerCount: number;
  teamRound1Score: number;
  teamRound2Score: number;
  hasTeamRound1: boolean;
  hasTeamRound2: boolean;
  hasTeam: boolean;
}

/**
 * Compute, store and return a category's school ranking. Recomputing on read is
 * the same approach Unit 09 takes for the individual ranking: the durable
 * results are the source of truth and the snapshot is just the record of the
 * last computation, so a stale snapshot can never be served.
 */
async function computeSchoolRanking(
  competitionId: string,
  categoryId: string,
): Promise<SchoolCategoryRanking> {
  const individualStage = await findIndividualStageWithRounds(competitionId);
  if (!individualStage) {
    throw new NotFoundError(translate("en", "ranking.notFound"), {
      code: "ranking.notFound",
    });
  }
  const individualRoundIds = individualStage.rounds.map((r) => r.id);
  const individualRoundCount = individualStage.rounds.length;

  const teamStage = await findTeamStageWithRounds(competitionId);
  const teamRoundIds = teamStage ? teamStage.rounds.map((r) => r.id) : [];
  const teamRoundCount = teamStage ? teamStage.rounds.length : 0;

  const scoringConfiguration = await findScoringConfiguration(competitionId);
  // The column has a database default, so a missing row falls back to it rather
  // than inventing a different number here.
  const coefficient = scoringConfiguration
    ? scoringConfiguration.schoolCoefficient
    : new Prisma.Decimal("0.6");

  const [schools, participants, individualResults, teams, teamResults] = await Promise.all([
    listSchools(competitionId),
    listActiveCategoryParticipantsWithSchool(categoryId),
    listFinalizedResultsForRounds(individualRoundIds, categoryId),
    listTeamsInCategory(categoryId),
    listTeamResultsForRounds(teamRoundIds, categoryId),
  ]);

  const accumulators = new Map<string, SchoolAccumulator>();
  for (const school of schools) {
    accumulators.set(school.id, {
      schoolId: school.id,
      schoolName: school.name,
      individualSum: 0,
      completionTimeSeconds: 0,
      playersFinished: 0,
      playerCount: 0,
      teamRound1Score: 0,
      teamRound2Score: 0,
      hasTeamRound1: false,
      hasTeamRound2: false,
      hasTeam: false,
    });
  }

  // --- individual half: every player of the school in this category (SCR-018) ---
  const participantsBySchool = new Map(
    participants.map((p) => [p.id, p] as const),
  );
  const roundsPerPlayer = new Map<string, Set<string>>();
  for (const participant of participants) {
    const accumulator = accumulators.get(participant.schoolId);
    if (!accumulator) continue; // a participant whose school row is missing cannot be counted
    accumulator.playerCount += 1;
  }
  for (const result of individualResults) {
    // The result carries no schoolId, so it is attributed through the participant
    // list above — which also guarantees only active players are counted.
    const participant = participantsBySchool.get(result.participantId);
    if (!participant) continue;
    const accumulator = accumulators.get(participant.schoolId);
    if (!accumulator) continue;
    accumulator.individualSum += result.totalScore;
    accumulator.completionTimeSeconds += result.completionTimeSeconds;
    const roundsDone = roundsPerPlayer.get(result.participantId) ?? new Set<string>();
    roundsDone.add(result.roundId);
    roundsPerPlayer.set(result.participantId, roundsDone);
  }
  // A player counts as finished only once every Individual round is finalized for
  // them — one round out of two is still in flight.
  for (const [participantId, roundsDone] of roundsPerPlayer) {
    if (roundsDone.size < individualRoundCount) continue;
    const participant = participantsBySchool.get(participantId);
    if (!participant) continue;
    const accumulator = accumulators.get(participant.schoolId);
    if (accumulator) accumulator.playersFinished += 1;
  }

  // --- team half: the school's one team in this category ---
  const teamToSchool = new Map(teams.map((t) => [t.id, t.schoolId]));
  const teamRoundBySequence = new Map<string, number>();
  if (teamStage) {
    for (const round of teamStage.rounds) teamRoundBySequence.set(round.id, round.sequence);
  }
  for (const result of teamResults) {
    const schoolId = teamToSchool.get(result.teamId);
    if (!schoolId) continue;
    const accumulator = accumulators.get(schoolId);
    if (!accumulator) continue;
    const sequence = teamRoundBySequence.get(result.roundId);
    if (sequence === 1) {
      accumulator.teamRound1Score = result.score;
      accumulator.hasTeamRound1 = true;
    } else if (sequence === 2) {
      accumulator.teamRound2Score = result.score;
      accumulator.hasTeamRound2 = true;
    }
  }
  for (const team of teams) {
    const accumulator = accumulators.get(team.schoolId);
    if (accumulator) accumulator.hasTeam = true;
  }

  const rows: SchoolRankingRow[] = [];
  let isFinal = true;
  for (const accumulator of accumulators.values()) {
    // A school with no player and no team in this category is not in this
    // category's leaderboard at all — listing it with a zero total would only
    // invent competitors that do not exist.
    if (accumulator.playerCount === 0 && !accumulator.hasTeam) continue;

    // Exact decimal arithmetic: never a plain JS number for the coefficient step.
    const total = new Prisma.Decimal(accumulator.individualSum)
      .mul(coefficient)
      .plus(accumulator.teamRound1Score)
      .plus(accumulator.teamRound2Score);

    // A school is complete when every one of its players in this category has
    // finalized both Individual rounds and, if it has a team here, that team has a
    // score in both TEAM rounds. A school with nothing in this category at all is
    // vacuously complete — it has nothing left to wait for.
    const individualComplete =
      accumulator.playerCount === 0 ||
      (individualRoundCount > 0 && accumulator.playersFinished >= accumulator.playerCount);
    const teamComplete =
      teamRoundCount === 0 ||
      !accumulator.hasTeam ||
      (accumulator.hasTeamRound1 && accumulator.hasTeamRound2);
    const complete = individualComplete && teamComplete;
    if (!complete) isFinal = false;

    rows.push({
      rank: 0,
      schoolId: accumulator.schoolId,
      schoolName: accumulator.schoolName,
      individualSum: accumulator.individualSum,
      teamRound1Score: accumulator.teamRound1Score,
      teamRound2Score: accumulator.teamRound2Score,
      // Serialized as a string: JSON has no decimal type and a number would lose
      // the exactness SCR-013 requires.
      schoolTotal: total.toString(),
      completionTimeSeconds: accumulator.completionTimeSeconds,
      countedPlayers: accumulator.playerCount,
      isComplete: complete,
    });
  }

  rows.sort((a, b) => {
    // Descending by exact total. Comparing Decimals, not the strings, so "9" never
    // sorts after "21".
    const byTotal = new Prisma.Decimal(b.schoolTotal).cmp(new Prisma.Decimal(a.schoolTotal));
    if (byTotal !== 0) return byTotal;
    return schoolBreakTie(a, b);
  });

  // Shared-rank "1224" ordering: a rank is shared only when the total **and** the
  // tie-break are equal, and the next distinct ordering is `i + 1`.
  let previous: SchoolRankingRow | null = null;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as SchoolRankingRow;
    if (
      previous &&
      previous.schoolTotal === row.schoolTotal &&
      schoolBreakTie(row, previous) === 0
    ) {
      row.rank = previous.rank;
    } else {
      row.rank = i + 1;
    }
    previous = row;
  }

  const payload: SchoolRankingSnapshotPayload = {
    categoryId,
    scope: "SCHOOL",
    isFinal,
    schoolCoefficient: coefficient.toString(),
    rows,
  };
  await replaceCurrentSchoolSnapshot({
    competitionId,
    categoryId,
    isFinal,
    payload,
  });

  return {
    categoryId,
    isFinal,
    schoolCoefficient: coefficient.toString(),
    rows,
  };
}

/**
 * The controller-facing read. Returns the freshly computed ranking; falls back to
 * the last stored snapshot only if the computation itself has nothing to work
 * with yet (no school row at all), so an early read is never an error.
 */
async function getSchoolCategoryRanking(
  competitionId: string,
  categoryId: string,
): Promise<SchoolCategoryRanking> {
  return computeSchoolRanking(competitionId, categoryId);
}

/** The last stored SCHOOL-scope snapshot, for callers that want history only. */
async function getStoredSchoolSnapshot(competitionId: string, categoryId: string) {
  return findCurrentSchoolSnapshot(competitionId, categoryId);
}

export const schoolRankingService = {
  schoolBreakTie,
  getSchoolCategoryRanking,
  getStoredSchoolSnapshot,
};
