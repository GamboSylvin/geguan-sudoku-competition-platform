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

function gridKey(roundId: string, participantId: string, questionId: string): string {
  return `${GRID_KEY_PREFIX}${roundId}:${participantId}:${questionId}`;
}

function gridScanPattern(roundId: string, participantId: string): string {
  return `${GRID_KEY_PREFIX}${roundId}:${participantId}:*`;
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
 * Every saved grid the player has for a round. Used by the reconnect path. The
 * per-round per-participant keyspace is small (≤ 6 entries for an Individual
 * round), so a SCAN followed by a pipelined GET is cheap and stays within a
 * single Redis round-trip for the reads.
 */
export async function listGridsForRound(
  roundId: string,
  participantId: string,
): Promise<SavedGridEntry[]> {
  const pattern = gridScanPattern(roundId, participantId);
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length === 0) return [];

  const raws = await redis.mget(keys);
  const entries: SavedGridEntry[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    const raw = raws[i];
    const key = keys[i];
    if (!raw || !key) continue;
    const questionId = key.slice(gridKey(roundId, participantId, "").length);
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
 * grid. The keyspace is the same one `listGridsForRound` scans, so this is the
 * same shape, just `DEL` instead of `GET`.
 */
export async function clearGridsForRound(
  roundId: string,
  participantId: string,
): Promise<number> {
  const pattern = gridScanPattern(roundId, participantId);
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length === 0) return 0;
  return redis.del(...keys);
}
