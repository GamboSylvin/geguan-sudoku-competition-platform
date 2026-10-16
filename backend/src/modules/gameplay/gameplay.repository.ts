/**
 * Redis access for the Gameplay module (Unit 07). No domain rule lives here; the
 * service holds the rules (invariant 4). Working grids live in Redis with
 * persistence on (BLD-007), so they survive a server restart.
 *
 * Key shape: `gameplay:grid:{roundId}:{participantId}:{questionId}` — one Redis
 * blob per (round, participant, question). The blob is JSON of the working grid
 * plus the saved-at timestamp; the service owns the shape.
 */
import { redis } from "../../infra";
import type { SavedGridEntry, WorkingGrid } from "./gameplay.types";

const GRID_KEY_PREFIX = "gameplay:grid:";
const GRID_INDEX_PREFIX = "gameplay:grid:index:";

function gridKey(roundId: string, participantId: string, questionId: string): string {
  return `${GRID_KEY_PREFIX}${roundId}:${participantId}:${questionId}`;
}

function gridIndexKey(roundId: string, participantId: string): string {
  return `${GRID_INDEX_PREFIX}${roundId}:${participantId}`;
}

interface StoredGridBlob {
  grid: WorkingGrid;
  savedAtMs: number;
}

/**
 * Overwrite the player's working grid for one question. Idempotent — the last
 * write wins, which is exactly what autosave wants.
 */
export async function saveGrid(
  roundId: string,
  participantId: string,
  questionId: string,
  grid: WorkingGrid,
  savedAtMs: number,
): Promise<void> {
  const blob: StoredGridBlob = { grid, savedAtMs };
  // The player's question set for one round is indexed explicitly. A `SCAN`
  // would otherwise be O(total keys in Redis) — and this path is read back on
  // every reconnect and every scoring, so its cost must not depend on unrelated
  // data accumulated in the same database.
  await redis.sadd(gridIndexKey(roundId, participantId), questionId);
  await redis.set(gridKey(roundId, participantId, questionId), JSON.stringify(blob));
}

/** The player's saved grid for one question, or null when none has been saved yet. */
export async function loadGrid(
  roundId: string,
  participantId: string,
  questionId: string,
): Promise<SavedGridEntry | null> {
  const raw = await redis.get(gridKey(roundId, participantId, questionId));
  if (!raw) return null;
  try {
    const blob = JSON.parse(raw) as StoredGridBlob;
    return { questionId, grid: blob.grid, savedAtMs: blob.savedAtMs };
  } catch {
    return null;
  }
}

/**
 * Every saved grid the player has for a round. Used by the reconnect path and by
 * scoring. The per-round per-participant keyspace is small (≤ 6 entries for an
 * Individual round), so it is read through an explicit index Set: an index read
 * plus one `MGET`, both O(entries).
 */
export async function listGridsForRound(
  roundId: string,
  participantId: string,
): Promise<SavedGridEntry[]> {
  const indexKey = gridIndexKey(roundId, participantId);
  const questionIds = await redis.smembers(indexKey);
  if (questionIds.length === 0) return [];

  const keys = questionIds.map((questionId) => gridKey(roundId, participantId, questionId));
  const raws = await redis.mget(keys);
  const entries: SavedGridEntry[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    const raw = raws[i];
    const questionId = questionIds[i];
    if (!raw || !questionId) {
      // The blob is gone but the index still lists the question — drop the stale member.
      if (questionId) await redis.srem(indexKey, questionId);
      continue;
    }
    try {
      const blob = JSON.parse(raw) as StoredGridBlob;
      entries.push({ questionId, grid: blob.grid, savedAtMs: blob.savedAtMs });
    } catch {
      // Skip a corrupt blob; autosave will overwrite it on the next tick.
    }
  }
  return entries;
}

/**
 * Delete every saved grid the player has for a round. Called by the Orchestrator
 * module's restart operation (Unit 10) so the student comes back to a blank
 * grid. The keyspace is the same one `listGridsForRound` reads, so this is the
 * same shape, just `DEL` instead of `GET`.
 */
export async function clearGridsForRound(
  roundId: string,
  participantId: string,
): Promise<number> {
  const indexKey = gridIndexKey(roundId, participantId);
  const questionIds = await redis.smembers(indexKey);
  if (questionIds.length === 0) {
    await redis.del(indexKey);
    return 0;
  }
  const deleted = await redis.del(
    ...questionIds.map((questionId) => gridKey(roundId, participantId, questionId)),
  );
  await redis.del(indexKey);
  return deleted;
}
