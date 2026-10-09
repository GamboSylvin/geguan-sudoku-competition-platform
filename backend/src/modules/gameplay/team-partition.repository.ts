/**
 * Storage access for the Team stage's partition collaboration round (Unit 14). No
 * domain rule lives here; the service holds them (invariant 4).
 *
 * Two stores, two jobs, the same split Unit 13's rotation round uses (BLD-007):
 *   - **Redis** (persistence on) holds the fast-changing working state — the band
 *     split, which puzzle the team is on, every member's cells. Key shape
 *     `gameplay:partition:{roundId}:{teamId}`, one JSON blob per team.
 *   - **PostgreSQL** holds the durable mirror (`TeamPartitionState`, added by this
 *     unit, so a judge can read a team's round-2 status — ROL-008) and the only
 *     *settled* value, `TeamRoundResult`, reused unchanged from Unit 13.
 *
 * The question **solution** is read here only for the server-side combined-grid
 * check (BLD-010). It never enters a payload and never crosses a module boundary.
 */
import { prisma, redis } from "../../infra";
import type { PartitionQuestion, PartitionState, RowBand } from "./team-partition.types";

const PARTITION_KEY_PREFIX = "gameplay:partition:";

function partitionKey(roundId: string, teamId: string): string {
  return `${PARTITION_KEY_PREFIX}${roundId}:${teamId}`;
}

function partitionScanPattern(roundId: string): string {
  return `${PARTITION_KEY_PREFIX}${roundId}:*`;
}

// ---------------------------------------------------------------------------
// Grid shape normalisation
// ---------------------------------------------------------------------------

/**
 * Flatten a stored grid into a row-major array of length `rows × columns`.
 *
 * Both shapes exist in the database and this unit has to cope with either, because
 * the partition round is the first one that indexes cells **by row**:
 *   - the Excel importer writes `startingGrid`/`solution` as row-major **matrices**
 *     (`number[][]`, `0` meaning "blank" — `question-parse.ts`'s `mergeGrids`);
 *   - Unit 13's rotation round, and every test seed, treat them as already-flat
 *     `number[]`.
 *
 * `0` is normalised to `null` so a blank given-cell and an unfilled cell are the same
 * thing to the answer check, matching how the tablet represents an empty cell
 * (`WorkingGrid` is `(number | null)[]`). A grid of the wrong total length is
 * returned blank rather than silently mis-shaped — a mis-shaped puzzle can never be
 * solved, and a loud zero is safer than a wrong row-band split.
 */
export function flattenStoredGrid(stored: unknown, rows: number, columns: number): (number | null)[] {
  const size = rows * columns;
  const out = new Array<number | null>(size).fill(null);
  if (size <= 0) return out;

  const cells: unknown[] = [];
  if (Array.isArray(stored)) {
    const looksLikeMatrix = stored.length > 0 && Array.isArray(stored[0]);
    if (looksLikeMatrix) {
      for (const row of stored) {
        if (!Array.isArray(row)) return out;
        cells.push(...row);
      }
    } else {
      cells.push(...stored);
    }
  }
  if (cells.length !== size) return out;

  for (let i = 0; i < size; i += 1) {
    const value = cells[i];
    // `0` is the importer's "blank"; anything else non-numeric is treated as blank.
    out[i] = typeof value === "number" && value !== 0 ? value : null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Redis: the working partition state
// ---------------------------------------------------------------------------

export async function savePartitionState(state: PartitionState): Promise<void> {
  await redis.set(partitionKey(state.roundId, state.teamId), JSON.stringify(state));
}

export async function loadPartitionState(
  roundId: string,
  teamId: string,
): Promise<PartitionState | null> {
  const raw = await redis.get(partitionKey(roundId, teamId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PartitionState;
  } catch {
    return null;
  }
}

/** Every team's working state for one round. Used by the tick loop and the end check. */
export async function listPartitionStates(roundId: string): Promise<PartitionState[]> {
  const pattern = partitionScanPattern(roundId);
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length === 0) return [];

  const raws = await redis.mget(keys);
  const states: PartitionState[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    try {
      states.push(JSON.parse(raw) as PartitionState);
    } catch {
      // Skip a corrupt blob; the durable mirror still shows where the team was.
    }
  }
  return states;
}

export async function deletePartitionStates(roundId: string): Promise<void> {
  const pattern = partitionScanPattern(roundId);
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  if (keys.length > 0) await redis.del(...keys);
}

// ---------------------------------------------------------------------------
// PostgreSQL: the durable mirror of the working state
// ---------------------------------------------------------------------------

/**
 * Mirror the working state into `TeamPartitionState`, keyed `@@unique([roundId,
 * teamId])`, so an upsert. Best-effort bookkeeping: a failure here must never cost a
 * team its round, so the service catches and logs rather than propagating.
 *
 * `blockAssignments` is stored exactly as the JSON array of bands
 * (`[{ participantId, startRow, endRow }]`), which is what `context/data-model.md`
 * line 52 calls for and what a judge's round-2 status read needs.
 */
export async function mirrorPartitionState(state: PartitionState): Promise<void> {
  const data = {
    blockAssignments: state.bands as unknown as RowBand[],
    puzzleIndex: state.puzzleIndex,
    solvedCount: state.solvedCount,
    finished: state.finished,
    endedAt: state.finished ? new Date() : null,
  };
  await prisma.teamPartitionState.upsert({
    where: { roundId_teamId: { roundId: state.roundId, teamId: state.teamId } },
    create: {
      roundId: state.roundId,
      teamId: state.teamId,
      startedAt: new Date(state.startedAtMs),
      ...data,
    },
    update: data,
  });
}

// ---------------------------------------------------------------------------
// The round's teams, the question pool, the settled result
// ---------------------------------------------------------------------------
//
// All three are identical in shape to Unit 13's rotation repository, and are
// re-exported from there rather than duplicated: both team rounds need the same
// teams-with-active-members query, the same `roundId`-unfiltered category pool
// (BLD-040 — a team round never sets `Question.roundId`), and the same idempotent
// `TeamRoundResult` write. One copy means the two rounds cannot drift apart.

export {
  listTeamsWithActiveMembers,
  findTeamForParticipant,
  listCategoryPool,
  finalizeTeamRoundResult,
  countTeamsWithoutResult,
  findTeamRoundResult,
  type RotationMemberRow,
  type RotationTeamRow,
} from "./team-rotation.repository";

/**
 * One puzzle of the category pool, with its grids normalised to flat row-major
 * arrays. `startingGrid` holds the given cells (`null` where blank); `solution` holds
 * every cell filled. The solution never leaves the server.
 */
export interface PartitionPuzzleEntry {
  question: PartitionQuestion;
  given: (number | null)[];
  solution: (number | null)[];
}

/**
 * A category's pool, ready for the partition round: the same pool the rotation round
 * draws from, with both grids flattened (see `flattenStoredGrid` for why that is this
 * round's job and not the shared query's).
 */
export async function listPartitionPool(
  competitionId: string,
  categoryId: string,
): Promise<PartitionPuzzleEntry[]> {
  const rows = await prisma.question.findMany({
    where: { questionSet: { competitionId, categoryId } },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      type: true,
      gridRows: true,
      gridColumns: true,
      regions: true,
      startingGrid: true,
      points: true,
      solution: true,
    },
  });

  return rows.map((r) => ({
    question: {
      id: r.id,
      sequence: r.sequence,
      type: r.type,
      gridRows: r.gridRows,
      gridColumns: r.gridColumns,
      regions: r.regions,
      startingGrid: r.startingGrid,
      points: r.points,
    },
    given: flattenStoredGrid(r.startingGrid, r.gridRows, r.gridColumns),
    solution: flattenStoredGrid(r.solution, r.gridRows, r.gridColumns),
  }));
}
