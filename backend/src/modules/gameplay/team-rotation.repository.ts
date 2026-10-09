/**
 * Storage access for the Team stage's rotation relay (Unit 13). No domain rule
 * lives here; the service holds the rules (invariant 4).
 *
 * Two stores, two jobs (BLD-007), the same split the Individual gameplay path
 * uses:
 *   - **Redis** (persistence on) holds the fast-changing working state — which
 *     tablet holds which question, the refill queue, the rotation deadline.
 *     Key shape `gameplay:rotation:{roundId}:{teamId}`, one JSON blob per team.
 *   - **PostgreSQL** holds the durable mirror (`TeamRotationState`, so a restart
 *     or an investigation can see where the round was) and the only *settled*
 *     value, `TeamRoundResult`. Both rows already exist from Unit 1 — this unit
 *     adds no schema change.
 *
 * The question **solution** is never stored in Redis and never crosses a module
 * boundary in a payload: it is read here, on demand, only for the answer check
 * (BLD-010).
 */
import { prisma, redis } from "../../infra";
import type { RotationQuestion, RotationState } from "./team-rotation.types";

const ROTATION_KEY_PREFIX = "gameplay:rotation:";

function rotationKey(roundId: string, teamId: string): string {
  return `${ROTATION_KEY_PREFIX}${roundId}:${teamId}`;
}

function rotationScanPattern(roundId: string): string {
  return `${ROTATION_KEY_PREFIX}${roundId}:*`;
}

// ---------------------------------------------------------------------------
// Redis: the working rotation state
// ---------------------------------------------------------------------------

export async function saveRotationState(state: RotationState): Promise<void> {
  await redis.set(rotationKey(state.roundId, state.teamId), JSON.stringify(state));
}

export async function loadRotationState(
  roundId: string,
  teamId: string,
): Promise<RotationState | null> {
  const raw = await redis.get(rotationKey(roundId, teamId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RotationState;
  } catch {
    return null;
  }
}

/** Every team's working state for one round. Used by the tick loop and by the end check. */
export async function listRotationStates(roundId: string): Promise<RotationState[]> {
  const pattern = rotationScanPattern(roundId);
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length === 0) return [];

  const raws = await redis.mget(keys);
  const states: RotationState[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    try {
      states.push(JSON.parse(raw) as RotationState);
    } catch {
      // Skip a corrupt blob; the durable mirror still shows where the team was.
    }
  }
  return states;
}

export async function deleteRotationStates(roundId: string): Promise<void> {
  const pattern = rotationScanPattern(roundId);
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
 * Mirror the working state into `TeamRotationState`. The row is keyed
 * `@@unique([roundId, teamId])`, so this is an upsert. The mirror is
 * best-effort bookkeeping: a failure here must never cost a team its round, so
 * the service catches and logs rather than propagating.
 */
export async function mirrorRotationState(state: RotationState): Promise<void> {
  const refillQueue = state.refillQueue.map((q) => q.id);
  const tabletHolds = state.holds.map((h) => ({
    participantId: h.participantId,
    questionId: h.question?.id ?? null,
    grid: h.grid,
  }));
  const data = {
    refillQueue,
    tabletHolds,
    rotationIndex: state.rotationIndex,
    lastRotationAt: state.lastRotationAtMs ? new Date(state.lastRotationAtMs) : null,
  };
  await prisma.teamRotationState.upsert({
    where: { roundId_teamId: { roundId: state.roundId, teamId: state.teamId } },
    create: { roundId: state.roundId, teamId: state.teamId, ...data },
    update: data,
  });
}

// ---------------------------------------------------------------------------
// The round's teams and members
// ---------------------------------------------------------------------------

export interface RotationMemberRow {
  participantId: string;
  name: string;
  participantNumber: number;
  sequence: number;
}

export interface RotationTeamRow {
  teamId: string;
  categoryId: string;
  schoolId: string;
  name: string;
  members: RotationMemberRow[];
}

/**
 * Every team of a competition that has at least one **active** member, with its
 * members in a fixed order (`sequence`, then `participantNumber`). The order is
 * what makes the rotation deterministic and stable (spec Implementation Notes).
 * A team whose members were all removed is skipped — it has no tablet to deal to.
 */
export async function listTeamsWithActiveMembers(
  competitionId: string,
): Promise<RotationTeamRow[]> {
  const teams = await prisma.team.findMany({
    where: { competitionId },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      categoryId: true,
      schoolId: true,
      name: true,
      participants: {
        where: { active: true },
        orderBy: [{ sequence: "asc" }, { participantNumber: "asc" }],
        select: {
          id: true,
          name: true,
          participantNumber: true,
          sequence: true,
        },
      },
    },
  });

  return teams
    .filter((t) => t.participants.length > 0)
    .map((t) => ({
      teamId: t.id,
      categoryId: t.categoryId,
      schoolId: t.schoolId,
      name: t.name,
      members: t.participants.map((p) => ({
        participantId: p.id,
        name: p.name,
        participantNumber: p.participantNumber,
        sequence: p.sequence,
      })),
    }));
}

/** The active team a participant belongs to on a competition, or null. */
export async function findTeamForParticipant(
  competitionId: string,
  participantId: string,
): Promise<{ teamId: string; categoryId: string } | null> {
  const participant = await prisma.participant.findFirst({
    where: { competitionId, id: participantId, active: true },
    select: { teamId: true, categoryId: true },
  });
  if (!participant?.teamId) return null;
  return { teamId: participant.teamId, categoryId: participant.categoryId };
}

// ---------------------------------------------------------------------------
// The question pool and the answer check
// ---------------------------------------------------------------------------

/**
 * A category's whole question pool, with solutions. **Not filtered by `roundId`**
 * (spec Detail 1, BLD-040): `roundId` is the Individual stage's manual
 * round-selection column and a team round never sets it, so filtering on it would
 * find nothing. The pool is everything the category's `QuestionSet`s hold.
 *
 * The solution is read here only to be used for the server-side answer check; the
 * draw keeps it in memory for the round's lifetime and never serialises it.
 */
export async function listCategoryPool(
  competitionId: string,
  categoryId: string,
): Promise<Array<{ question: RotationQuestion; solution: (number | null)[] }>> {
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
    solution: Array.isArray(r.solution) ? (r.solution as (number | null)[]) : [],
  }));
}

// ---------------------------------------------------------------------------
// The settled result
// ---------------------------------------------------------------------------

/**
 * Write one team's settled `TeamRoundResult`. **Idempotent in code**: the table
 * has an index on `roundId` but no `@@unique([roundId, teamId])`, so the
 * uniqueness the schema cannot enforce is enforced here — find first, create only
 * when absent, and return the existing row otherwise. A repeated finalize (a late
 * tick, a controller's end-round-early arriving after the queue emptied) must not
 * produce a second result row for the same team.
 */
export async function finalizeTeamRoundResult(input: {
  roundId: string;
  teamId: string;
  categoryId: string;
  correctCount: number;
  score: number;
  completionTimeSeconds: number | null;
}): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.teamRoundResult.findFirst({
    where: { roundId: input.roundId, teamId: input.teamId },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.teamRoundResult.create({
    data: {
      roundId: input.roundId,
      teamId: input.teamId,
      categoryId: input.categoryId,
      correctCount: input.correctCount,
      score: input.score,
      completionTimeSeconds: input.completionTimeSeconds,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

/** How many teams of a round still have no settled result. Zero means the round is done. */
export async function countTeamsWithoutResult(
  roundId: string,
  teamIds: string[],
): Promise<number> {
  if (teamIds.length === 0) return 0;
  const settled = await prisma.teamRoundResult.findMany({
    where: { roundId, teamId: { in: teamIds } },
    select: { teamId: true },
  });
  const settledIds = new Set(settled.map((r) => r.teamId));
  return teamIds.filter((id) => !settledIds.has(id)).length;
}

/** One team's settled result for a round, or null. Read by the reconnect path. */
export async function findTeamRoundResult(roundId: string, teamId: string) {
  return prisma.teamRoundResult.findFirst({
    where: { roundId, teamId },
    select: {
      correctCount: true,
      score: true,
      completionTimeSeconds: true,
    },
  });
}
