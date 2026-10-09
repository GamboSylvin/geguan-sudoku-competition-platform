import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { roundTimerService } from "../src/modules/round";
import { gameplayService, teamPartitionService } from "../src/modules/gameplay";
import * as partitionRepository from "../src/modules/gameplay/team-partition.repository";
import type { PartitionState } from "../src/modules/gameplay";

/**
 * Unit 14 integration tests: the Team stage's partition collaboration (齐心协力).
 *
 * Covers the seven behavioural acceptance criteria from
 * `specs/14-team-stage-partition-collaboration.md` (the eighth is CI running this
 * suite at all):
 *   1. A team's puzzle is split into contiguous row-bands, one per active member,
 *      as equal as possible with the extra rows going to the **first** bands.
 *   2. A member can edit only their own band; an edit to another row is rejected.
 *   3. A puzzle scores `partitionPointsPerPuzzle` the instant the **combined** grid
 *      is fully correct — no submit action, no early bonus.
 *   4. The team advances to the next puzzle immediately, with the same split.
 *   5. The round ends at `partitionPuzzleCount` solved or
 *      `partitionTotalTimeSeconds`, whichever first; an incomplete puzzle scores 0.
 *   6. The final score is `(puzzles solved) × partitionPointsPerPuzzle`.
 *   7. Once every team's result is finalized, Unit 11's whole-competition finish
 *      check is triggered — this is the last round of the last stage.
 *
 * Seeding follows Unit 13's precedent exactly: `Team`/`Participant`/`Question` rows
 * are created directly (Unit 04 is still gated on U-01, and Unit 05's importer is
 * not what this unit tests), and the pool still satisfies publish readiness.
 *
 * The total time is never waited out — the default is 1800s and the seed uses 3600s
 * so no background tick can settle a team mid-test. A timed test instead moves the
 * team's own `totalTimeDeadlineMs` into the past and waits for the wakeup chain: the
 * deadline is still the server's (invariant 3) and the tick is only display cadence.
 *
 * The grid here is **9 rows × 3 columns**, not square, on purpose: TEM-005/BLD-11
 * forbid assuming 9×9, and 9 rows over 4 members is the spec's own `[3,2,2,2]`
 * example. The stored grids are row-major **matrices** with `0` for blank, the shape
 * the Excel importer actually writes (`question-parse.ts`'s `mergeGrids`) — this is
 * the first round that indexes cells by row, so it is the first that has to prove
 * `flattenStoredGrid` handles that shape.
 */

const app = createApp();
const PASSWORD = "test-pass-14";
const suffix = Math.random().toString(36).slice(2, 8);

const GRID_ROWS = 9;
const GRID_COLUMNS = 3;
const GRID_SIZE = GRID_ROWS * GRID_COLUMNS;
const TEAM_SIZE = 4;
/** More than `partitionPuzzleCount` (3) so the draw is a real draw. */
const POOL_SIZE = 5;
const PUZZLE_COUNT = 3;
const POINTS_PER_PUZZLE = 20;

/** A 9×3 Latin-pattern solution. Never uses 0 — that is the importer's "blank". */
const SOLUTION_FLAT: (number | null)[] = Array.from(
  { length: GRID_SIZE },
  (_, i) => ((Math.floor(i / GRID_COLUMNS) + (i % GRID_COLUMNS)) % 3) + 1,
);
/** Given cells: all of row 0 and all of row 4, blank everywhere else. */
const STARTING_FLAT: (number | null)[] = SOLUTION_FLAT.map((value, i) => {
  const row = Math.floor(i / GRID_COLUMNS);
  return row === 0 || row === 4 ? value : null;
});

function toMatrix(flat: (number | null)[]): number[][] {
  const matrix: number[][] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    matrix.push(
      flat.slice(row * GRID_COLUMNS, (row + 1) * GRID_COLUMNS).map((v) => (v === null ? 0 : v)),
    );
  }
  return matrix;
}

const STARTING_MATRIX = toMatrix(STARTING_FLAT);
const SOLUTION_MATRIX = toMatrix(SOLUTION_FLAT);

const createdCompetitionIds: string[] = [];
const createdAccountUsernames: string[] = [];

interface SeededPartitionCompetition {
  competitionId: string;
  categoryId: string;
  teamStageId: string;
  teamRound1Id: string;
  teamRound2Id: string;
  individualStageId: string;
  teamId: string;
  participantIds: string[];
}

async function createAccount(
  username: string,
  role: "CONTROLLER" | "PLAYER",
  participantId?: string,
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
      participantId: participantId ?? null,
    },
  });
  createdAccountUsernames.push(username);
}

function loginPlayer(username: string) {
  return request(app)
    .post("/api/auth/player/login")
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

async function seedPartitionCompetition(
  name: string,
): Promise<SeededPartitionCompetition> {
  const competition = await competitionService.createCompetition({
    name,
    categories: [{ code: "U9", name: "Under 9" }],
  });
  createdCompetitionIds.push(competition.id);

  const full = await prisma.competition.findUniqueOrThrow({
    where: { id: competition.id },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const category = full.categories[0]!;
  const individualStage = full.stages.find((s) => s.type === "INDIVIDUAL")!;
  const teamStage = full.stages.find((s) => s.type === "TEAM")!;
  const teamRound1 = teamStage.rounds.find((r) => r.sequence === 1)!;
  const teamRound2 = teamStage.rounds.find((r) => r.sequence === 2)!;

  const school = await prisma.school.create({
    data: { competitionId: competition.id, name: `School ${suffix}`, sequence: 1 },
  });
  const team = await prisma.team.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Team ${suffix}`,
      sequence: 1,
    },
  });

  const participantIds: string[] = [];
  for (let index = 0; index < TEAM_SIZE; index += 1) {
    const participant = await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        schoolId: school.id,
        teamId: team.id,
        name: `Member ${index + 1} ${suffix}`,
        participantNumber: index + 1,
        sequence: index + 1,
      },
    });
    participantIds.push(participant.id);
  }

  const questionSet = await prisma.questionSet.create({
    data: { competitionId: competition.id, categoryId: category.id, name: `Set ${suffix}` },
  });

  // Publish readiness: exactly 6 assigned questions per Individual round. Their shape
  // is irrelevant here — the partition round never reads a `roundId`-assigned question.
  for (const round of individualStage.rounds) {
    for (let sequence = 1; sequence <= 6; sequence += 1) {
      await prisma.question.create({
        data: {
          questionSetId: questionSet.id,
          roundId: round.id,
          sequence,
          points: 10,
          gridRows: 4,
          gridColumns: 4,
          regions: [[0, 1, 4, 5]],
          startingGrid: [1, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 1],
          solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
        },
      });
    }
  }
  // The team pool: `roundId` null (BLD-040 — a team round never sets it).
  for (let sequence = 1; sequence <= POOL_SIZE; sequence += 1) {
    await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        roundId: null,
        sequence: 100 + sequence,
        points: 10,
        gridRows: GRID_ROWS,
        gridColumns: GRID_COLUMNS,
        regions: [[0, 1, 2]],
        startingGrid: STARTING_MATRIX,
        solution: SOLUTION_MATRIX,
      },
    });
  }

  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: judge.id,
      fromParticipantNumber: 1,
      toParticipantNumber: TEAM_SIZE,
    },
  });

  await prisma.roundSettings.update({
    where: { roundId: teamRound1.id },
    data: { durationSeconds: 1200, preparationSeconds: 60 },
  });
  // Round 2's own settings (TEM-006 to TEM-008). The total time is long by default so
  // no background tick can settle a team mid-test; the two timed tests override it.
  await prisma.roundSettings.update({
    where: { roundId: teamRound2.id },
    data: {
      durationSeconds: 4000,
      preparationSeconds: 60,
      partitionPuzzleCount: PUZZLE_COUNT,
      partitionTotalTimeSeconds: 3600,
      partitionPointsPerPuzzle: POINTS_PER_PUZZLE,
    },
  });

  await competitionService.publishCompetition(competition.id);

  return {
    competitionId: competition.id,
    categoryId: category.id,
    teamStageId: teamStage.id,
    teamRound1Id: teamRound1.id,
    teamRound2Id: teamRound2.id,
    individualStageId: individualStage.id,
    teamId: team.id,
    participantIds,
  };
}

/** Put the partition round into the state `startActivePhaseFromTimer` would have. */
async function startPartitionRound(
  ctx: SeededPartitionCompetition,
  overrides: { partitionTotalTimeSeconds?: number } = {},
): Promise<void> {
  if (overrides.partitionTotalTimeSeconds !== undefined) {
    await prisma.roundSettings.update({
      where: { roundId: ctx.teamRound2Id },
      data: { partitionTotalTimeSeconds: overrides.partitionTotalTimeSeconds },
    });
  }

  await prisma.competition.update({
    where: { id: ctx.competitionId },
    data: { status: "ROUND_ACTIVE" },
  });
  await prisma.stage.update({
    where: { id: ctx.teamStageId },
    data: { status: "ACTIVE" },
  });
  await prisma.round.update({
    where: { id: ctx.teamRound2Id },
    data: { status: "ACTIVE", startedAt: new Date() },
  });
  await roundTimerService.startRoundTimer(
    ctx.teamRound2Id,
    ctx.competitionId,
    ctx.teamStageId,
    4000,
  );

  const settings = await prisma.roundSettings.findUniqueOrThrow({
    where: { roundId: ctx.teamRound2Id },
  });
  await teamPartitionService.startPartitionRound({
    roundId: ctx.teamRound2Id,
    competitionId: ctx.competitionId,
    stageId: ctx.teamStageId,
    partition: {
      puzzleCount: settings.partitionPuzzleCount,
      totalTimeSeconds: settings.partitionTotalTimeSeconds,
      pointsPerPuzzle: settings.partitionPointsPerPuzzle,
    },
  });
}

async function loadState(roundId: string, teamId: string): Promise<PartitionState> {
  const state = await partitionRepository.loadPartitionState(roundId, teamId);
  if (!state) throw new Error("no partition state");
  return state;
}

/** Log in all four members; returns one authed request helper per member. */
async function loginTeam(ctx: SeededPartitionCompetition, label: string) {
  const sessions = [];
  for (let index = 0; index < ctx.participantIds.length; index += 1) {
    const username = `it14-${label}-${index}-${suffix}`;
    await createAccount(username, "PLAYER", ctx.participantIds[index]!);
    const login = await loginPlayer(username);
    sessions.push({
      participantId: ctx.participantIds[index]!,
      token: login.body.token as string,
      deviceId: login.body.deviceId as string,
    });
  }
  return sessions;
}

function autosave(
  session: { token: string; deviceId: string },
  roundId: string,
  questionId: string,
  grid: (number | null)[],
) {
  return request(app)
    .post(`/api/gameplay/partition/${roundId}/autosave`)
    .set("x-session-token", session.token)
    .set("x-device-id", session.deviceId)
    .send({ questionId, grid });
}

/**
 * What a member sends: the whole combined board the tablet renders, with only this
 * member's own band rows filled in correctly. Everything outside the band is an echo
 * of what the server already holds, which is exactly what the real client sends.
 */
function memberGridForBand(bandIndex: number, correct: boolean): (number | null)[] {
  const bands = teamPartitionService.splitRowBands(GRID_ROWS, ["a", "b", "c", "d"]);
  const band = bands[bandIndex]!;
  const grid = [...STARTING_FLAT];
  for (let row = band.startRow; row <= band.endRow; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const index = row * GRID_COLUMNS + column;
      if (STARTING_FLAT[index] !== null) continue;
      grid[index] = correct ? SOLUTION_FLAT[index] : 9;
    }
  }
  return grid;
}

/** Every member fills their own band correctly, in order. Returns the last response. */
async function solveCurrentPuzzle(
  ctx: SeededPartitionCompetition,
  sessions: { token: string; deviceId: string }[],
) {
  const state = await loadState(ctx.teamRound2Id, ctx.teamId);
  const puzzleId = state.puzzles[state.puzzleIndex]!.id;
  let last = null;
  for (let index = 0; index < sessions.length; index += 1) {
    last = await autosave(
      sessions[index]!,
      ctx.teamRound2Id,
      puzzleId,
      memberGridForBand(index, true),
    );
    expect(last.status).toBe(200);
  }
  return { puzzleId, last: last!.body };
}

/** Wait for the settled `TeamRoundResult` the wakeup chain writes at the deadline. */
async function waitForTeamResult(roundId: string, teamId: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await prisma.teamRoundResult.findFirst({ where: { roundId, teamId } });
    if (result) return result;
    if (Date.now() > deadline) throw new Error("waitForTeamResult: timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("pure partition rules (no I/O)", () => {
  it("isPartitionRound: only the Team stage's round 2", () => {
    expect(teamPartitionService.isPartitionRound("TEAM", 2)).toBe(true);
    expect(teamPartitionService.isPartitionRound("TEAM", 1)).toBe(false);
    expect(teamPartitionService.isPartitionRound("INDIVIDUAL", 2)).toBe(false);
  });

  it("the two flagged assumptions are each isolated in one function (spec Notes)", () => {
    expect(teamPartitionService.reuseSplitAcrossPuzzles()).toBe(true);
    expect(teamPartitionService.showOtherBandsReadOnly()).toBe(true);
  });

  it("splits 9 rows over 4 members as [3,2,2,2], extra rows to the FIRST bands", () => {
    const bands = teamPartitionService.splitRowBands(9, ["a", "b", "c", "d"]);
    expect(bands.map((b) => b.endRow - b.startRow + 1)).toEqual([3, 2, 2, 2]);
    expect(bands.map((b) => b.startRow)).toEqual([0, 3, 5, 7]);
    expect(bands.map((b) => b.endRow)).toEqual([2, 4, 6, 8]);
    expect(bands.map((b) => b.participantId)).toEqual(["a", "b", "c", "d"]);
  });

  it("covers every row exactly once for other shapes too (BLD-011: never assume 9×9)", () => {
    for (const [rows, members] of [
      [4, 4],
      [7, 3],
      [10, 6],
      [1, 4],
    ] as const) {
      const ids = Array.from({ length: members }, (_, i) => `m${i}`);
      const bands = teamPartitionService.splitRowBands(rows, ids);
      const covered: number[] = [];
      for (const band of bands) {
        for (let row = band.startRow; row <= band.endRow; row += 1) covered.push(row);
      }
      expect(covered.sort((x, y) => x - y)).toEqual(
        Array.from({ length: rows }, (_, i) => i),
      );
    }
  });

  it("a 2-member split is the minimum team size and still covers the grid", () => {
    const bands = teamPartitionService.splitRowBands(9, ["a", "b"]);
    expect(bands.map((b) => b.endRow - b.startRow + 1)).toEqual([5, 4]);
  });

  it("more members than rows leaves the surplus members with an empty band", () => {
    const bands = teamPartitionService.splitRowBands(2, ["a", "b", "c", "d"]);
    expect(bands[2]!.startRow).toBeGreaterThan(bands[2]!.endRow);
    expect(bands[3]!.startRow).toBeGreaterThan(bands[3]!.endRow);
  });

  it("flattenStoredGrid reads both stored shapes and maps 0 to blank", () => {
    // The importer's row-major matrix, `0` meaning blank.
    expect(
      partitionRepository.flattenStoredGrid(
        [
          [1, 0],
          [0, 4],
        ],
        2,
        2,
      ),
    ).toEqual([1, null, null, 4]);
    // The already-flat shape Unit 13 and every older seed use.
    expect(partitionRepository.flattenStoredGrid([1, 0, 0, 4], 2, 2)).toEqual([
      1, null, null, 4,
    ]);
    // A grid of the wrong length is returned blank, never silently mis-shaped.
    expect(partitionRepository.flattenStoredGrid([1, 2], 2, 2)).toEqual([
      null, null, null, null,
    ]);
  });
});

describe("round start and the band split (acceptance criterion 1)", () => {
  it("deals puzzle 1 with one row-band per active member and the durable mirror", async () => {
    const ctx = await seedPartitionCompetition(`Deal ${suffix}`);
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    expect(state.bands.map((b) => b.participantId)).toEqual(ctx.participantIds);
    expect(state.bands.map((b) => b.endRow - b.startRow + 1)).toEqual([3, 2, 2, 2]);
    expect(state.puzzleIndex).toBe(0);
    expect(state.solvedCount).toBe(0);
    expect(state.puzzleCount).toBe(PUZZLE_COUNT);
    expect(state.pointsPerPuzzle).toBe(POINTS_PER_PUZZLE);
    // Every member starts with an empty grid of the full length.
    for (const member of state.memberGrids) {
      expect(member.grid).toEqual(new Array<null>(GRID_SIZE).fill(null));
    }

    // The puzzles come from the category's pool — the whole `QuestionSet`, **not**
    // filtered by `roundId` (BLD-040) — with no repeats, capped at the configured count.
    expect(state.puzzles).toHaveLength(PUZZLE_COUNT);
    expect(new Set(state.puzzles.map((p) => p.id)).size).toBe(PUZZLE_COUNT);
    const inPool = await prisma.question.findMany({
      where: {
        id: { in: state.puzzles.map((p) => p.id) },
        questionSet: { competitionId: ctx.competitionId, categoryId: ctx.categoryId },
        roundId: null,
      },
      select: { id: true },
    });
    expect(inPool).toHaveLength(PUZZLE_COUNT);

    const mirror = await prisma.teamPartitionState.findUniqueOrThrow({
      where: { roundId_teamId: { roundId: ctx.teamRound2Id, teamId: ctx.teamId } },
    });
    expect(mirror.puzzleIndex).toBe(0);
    expect(mirror.solvedCount).toBe(0);
    expect(mirror.finished).toBe(false);
    expect(mirror.blockAssignments).toEqual(state.bands);
  });

  it("is idempotent — a repeated start cannot re-deal", async () => {
    const ctx = await seedPartitionCompetition(`DealTwice ${suffix}`);
    await startPartitionRound(ctx);
    const before = await loadState(ctx.teamRound2Id, ctx.teamId);

    await teamPartitionService.startPartitionRound({
      roundId: ctx.teamRound2Id,
      competitionId: ctx.competitionId,
      stageId: ctx.teamStageId,
      partition: {
        puzzleCount: PUZZLE_COUNT,
        totalTimeSeconds: 3600,
        pointsPerPuzzle: POINTS_PER_PUZZLE,
      },
    });

    const after = await loadState(ctx.teamRound2Id, ctx.teamId);
    expect(after.puzzles.map((p) => p.id)).toEqual(before.puzzles.map((p) => p.id));
    expect(after.puzzleIndex).toBe(before.puzzleIndex);
  });

  it("the reconnect read gives a member their own band and the whole grid", async () => {
    const ctx = await seedPartitionCompetition(`Reconnect ${suffix}`);
    const sessions = await loginTeam(ctx, "reconnect");
    await startPartitionRound(ctx);

    const res = await request(app)
      .get(`/api/gameplay/partition/${ctx.teamRound2Id}/state`)
      .set("x-session-token", sessions[1]!.token)
      .set("x-device-id", sessions[1]!.deviceId);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACTIVE");
    expect(res.body.participantId).toBe(ctx.participantIds[1]);
    expect(res.body.band).toEqual({
      participantId: ctx.participantIds[1],
      startRow: 3,
      endRow: 4,
    });
    expect(res.body.grid).toHaveLength(GRID_SIZE);
    expect(res.body.puzzleIndex).toBe(0);
    expect(res.body.puzzleCount).toBe(PUZZLE_COUNT);
    expect(res.body.teamScore).toBe(0);
    expect(res.body.result).toBeNull();
    // The solution is never sent to a tablet (BLD-010). Two checks, because a string
    // comparison against a serialized array can be defeated by key order: no field in
    // the payload is named after the solution, and every cell the puzzle left blank is
    // blank in what the tablet was given.
    expect(JSON.stringify(res.body)).not.toContain("solution");
    for (let i = 0; i < GRID_SIZE; i += 1) {
      expect(res.body.grid[i]).toBe(STARTING_FLAT[i]);
    }
  });
});

describe("per-cell edit scoping (acceptance criterion 2)", () => {
  it("rejects an edit to a row in another member's band, with 422", async () => {
    const ctx = await seedPartitionCompetition(`OutsideBand ${suffix}`);
    const sessions = await loginTeam(ctx, "outsideband");
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    const puzzleId = state.puzzles[0]!.id;

    // Member 0 owns rows 0–2 of the 9-row split [3,2,2,2]; row 5 belongs to member 2
    // (rows 5–6), so writing it is out of band.
    const grid = [...STARTING_FLAT];
    grid[5 * GRID_COLUMNS] = 3;
    const res = await autosave(sessions[0]!, ctx.teamRound2Id, puzzleId, grid);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("partition.outsideBand");
    expect(res.body.error.details.cellIndex).toBe(5 * GRID_COLUMNS);
    expect(res.body.error.details.row).toBe(5);

    // Nothing was stored.
    const after = await loadState(ctx.teamRound2Id, ctx.teamId);
    expect(after.memberGrids[0]!.grid).toEqual(new Array<null>(GRID_SIZE).fill(null));
  });

  it("rejects an edit that overwrites a given cell", async () => {
    const ctx = await seedPartitionCompetition(`Given ${suffix}`);
    const sessions = await loginTeam(ctx, "given");
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    const puzzleId = state.puzzles[0]!.id;
    // Row 0 is given and sits inside member 0's own band — still not theirs to change.
    const grid = [...STARTING_FLAT];
    grid[0] = 9;
    const res = await autosave(sessions[0]!, ctx.teamRound2Id, puzzleId, grid);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("partition.outsideBand");
  });

  it("accepts an edit inside the member's own band, and an echo of a cell they do not own", async () => {
    const ctx = await seedPartitionCompetition(`InsideBand ${suffix}`);
    const sessions = await loginTeam(ctx, "insideband");
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    const puzzleId = state.puzzles[0]!.id;

    const res = await autosave(
      sessions[2]!,
      ctx.teamRound2Id,
      puzzleId,
      memberGridForBand(2, true),
    );
    expect(res.status).toBe(200);
    expect(res.body.puzzleSolved).toBe(false);

    const after = await loadState(ctx.teamRound2Id, ctx.teamId);
    const mine = after.memberGrids[2]!.grid;
    // Only this member's own rows carry a value; everything else is null, so an
    // out-of-band write is not representable from here on.
    for (let i = 0; i < GRID_SIZE; i += 1) {
      const row = Math.floor(i / GRID_COLUMNS);
      if (row >= 5 && row <= 6) continue;
      if (STARTING_FLAT[i] !== null) continue;
      expect(mine[i]).toBeNull();
    }
    expect(mine[5 * GRID_COLUMNS]).toBe(SOLUTION_FLAT[5 * GRID_COLUMNS]);
  });

  it("rejects a grid of the wrong length", async () => {
    const ctx = await seedPartitionCompetition(`BadLength ${suffix}`);
    const sessions = await loginTeam(ctx, "badlength");
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    const res = await autosave(sessions[0]!, ctx.teamRound2Id, state.puzzles[0]!.id, [1, 2, 3]);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("partition.invalidGrid");
  });
});

describe("the combined-grid check, with no submit (acceptance criteria 3 and 4)", () => {
  it("scores only once every band is filled, then advances with the same split", async () => {
    const ctx = await seedPartitionCompetition(`Combined ${suffix}`);
    const sessions = await loginTeam(ctx, "combined");
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    const puzzleId = state.puzzles[0]!.id;
    const bandsBefore = state.bands;

    // Three of the four members fill their bands correctly. The combined grid is
    // still missing member 3's rows, so nothing scores — and there is no submit
    // action to trigger a check either.
    for (let index = 0; index < 3; index += 1) {
      const res = await autosave(
        sessions[index]!,
        ctx.teamRound2Id,
        puzzleId,
        memberGridForBand(index, true),
      );
      expect(res.status).toBe(200);
      expect(res.body.puzzleSolved).toBe(false);
      expect(res.body.solvedCount).toBe(0);
      expect(res.body.teamScore).toBe(0);
    }

    const midway = await loadState(ctx.teamRound2Id, ctx.teamId);
    expect(midway.solvedCount).toBe(0);
    expect(midway.puzzleIndex).toBe(0);

    // The last band lands: the puzzle scores the instant the combined grid is
    // fully correct, and the team moves on in the same response.
    const last = await autosave(
      sessions[3]!,
      ctx.teamRound2Id,
      puzzleId,
      memberGridForBand(3, true),
    );
    expect(last.status).toBe(200);
    expect(last.body.puzzleSolved).toBe(true);
    expect(last.body.roundEnded).toBe(false);
    expect(last.body.solvedCount).toBe(1);
    expect(last.body.teamScore).toBe(POINTS_PER_PUZZLE);
    expect(last.body.puzzleIndex).toBe(1);

    const after = await loadState(ctx.teamRound2Id, ctx.teamId);
    expect(after.puzzleIndex).toBe(1);
    expect(after.solvedCount).toBe(1);
    // Acceptance criterion 4: the same split, and fresh grids.
    expect(after.bands).toEqual(bandsBefore);
    for (const member of after.memberGrids) {
      expect(member.grid).toEqual(new Array<null>(GRID_SIZE).fill(null));
    }
    // The next puzzle is a different one.
    expect(after.puzzles[1]!.id).not.toBe(puzzleId);

    // No settled result yet — the round is still running, and no individual result
    // was produced (invariant 7).
    expect(
      await prisma.teamRoundResult.findMany({ where: { roundId: ctx.teamRound2Id } }),
    ).toHaveLength(0);
    expect(
      await prisma.individualRoundResult.findMany({ where: { roundId: ctx.teamRound2Id } }),
    ).toHaveLength(0);
  });

  it("a band filled incorrectly does not score", async () => {
    const ctx = await seedPartitionCompetition(`Wrong ${suffix}`);
    const sessions = await loginTeam(ctx, "wrong");
    await startPartitionRound(ctx);

    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    const puzzleId = state.puzzles[0]!.id;
    for (let index = 0; index < TEAM_SIZE; index += 1) {
      const res = await autosave(
        sessions[index]!,
        ctx.teamRound2Id,
        puzzleId,
        memberGridForBand(index, false),
      );
      expect(res.status).toBe(200);
      expect(res.body.puzzleSolved).toBe(false);
    }

    const after = await loadState(ctx.teamRound2Id, ctx.teamId);
    expect(after.solvedCount).toBe(0);
    expect(after.puzzleIndex).toBe(0);
    // The wrong digits are visible to the team, so they can be corrected in place.
    expect(after.memberGrids[0]!.grid[1 * GRID_COLUMNS]).toBe(9);
  });

  it("rejects an autosave aimed at a puzzle the team has moved past, with 409", async () => {
    const ctx = await seedPartitionCompetition(`Stale ${suffix}`);
    const sessions = await loginTeam(ctx, "stale");
    await startPartitionRound(ctx);

    const { puzzleId } = await solveCurrentPuzzle(ctx, sessions);

    const late = await autosave(
      sessions[0]!,
      ctx.teamRound2Id,
      puzzleId,
      memberGridForBand(0, true),
    );
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("partition.stalePuzzle");
  });
});

describe("round end and the final score (acceptance criteria 5, 6 and 7)", () => {
  it("solving every puzzle ends the round, scores the flat value and finishes the competition", async () => {
    const ctx = await seedPartitionCompetition(`AllSolved ${suffix}`);
    const sessions = await loginTeam(ctx, "allsolved");
    await startPartitionRound(ctx);

    let lastBody: { roundEnded: boolean } = { roundEnded: false };
    for (let puzzle = 0; puzzle < PUZZLE_COUNT; puzzle += 1) {
      lastBody = (await solveCurrentPuzzle(ctx, sessions)).last;
    }
    expect(lastBody.roundEnded).toBe(true);

    const result = await prisma.teamRoundResult.findFirstOrThrow({
      where: { roundId: ctx.teamRound2Id, teamId: ctx.teamId },
    });
    expect(result.correctCount).toBe(PUZZLE_COUNT);
    // Acceptance criterion 6: solved × partitionPointsPerPuzzle, and nothing else.
    expect(result.score).toBe(PUZZLE_COUNT * POINTS_PER_PUZZLE);
    // Set only for an all-solved end (Detail 4).
    expect(result.completionTimeSeconds).not.toBeNull();

    const all = await prisma.teamRoundResult.findMany({
      where: { roundId: ctx.teamRound2Id, teamId: ctx.teamId },
    });
    expect(all).toHaveLength(1);

    // The round finished on its own and is not marked as an early end.
    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.teamRound2Id } });
    expect(round.status).toBe("FINISHED");
    expect(round.earlyEnded).toBe(false);

    // Acceptance criterion 7: this is the last round of the last stage, so Unit 11's
    // whole-competition finish check is what closes the event — triggered, not
    // re-implemented, by this unit.
    const stage = await prisma.stage.findUniqueOrThrow({ where: { id: ctx.teamStageId } });
    expect(stage.status).toBe("FINISHED");
    const competition = await prisma.competition.findUniqueOrThrow({
      where: { id: ctx.competitionId },
    });
    expect(competition.status).toBe("FINISHED");
    expect(competition.finishedEarly).toBe(false);
    const runtime = await prisma.competitionRuntimeState.findUniqueOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    expect(runtime.currentRoundId).toBe(ctx.teamRound2Id);
    expect(runtime.phase).toBe("FINISHED");

    // The working state is gone; a reconnecting tablet still gets its settled result.
    const res = await request(app)
      .get(`/api/gameplay/partition/${ctx.teamRound2Id}/state`)
      .set("x-session-token", sessions[0]!.token)
      .set("x-device-id", sessions[0]!.deviceId);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINISHED");
    expect(res.body.result).toEqual({
      roundId: ctx.teamRound2Id,
      competitionId: ctx.competitionId,
      stageId: ctx.teamStageId,
      teamId: ctx.teamId,
      reason: "ALL_SOLVED",
      solvedCount: PUZZLE_COUNT,
      score: PUZZLE_COUNT * POINTS_PER_PUZZLE,
      completionTimeSeconds: result.completionTimeSeconds,
    });
  });

  it("the total time ending first settles only what was already solved", async () => {
    const ctx = await seedPartitionCompetition(`TimeLimit ${suffix}`);
    const sessions = await loginTeam(ctx, "timelimit");
    await startPartitionRound(ctx);

    await solveCurrentPuzzle(ctx, sessions);

    // The deadline is moved into the past rather than waited out: a tick reads the
    // deadline and acts on whatever is due (invariant 3), so this drives the real
    // wakeup chain instead of racing it.
    const state = await loadState(ctx.teamRound2Id, ctx.teamId);
    await partitionRepository.savePartitionState({
      ...state,
      totalTimeDeadlineMs: Date.now() - 1000,
    });

    const result = await waitForTeamResult(ctx.teamRound2Id, ctx.teamId);
    expect(result.correctCount).toBe(1);
    expect(result.score).toBe(POINTS_PER_PUZZLE);
    // Not set — the round ended by the time limit (Detail 4).
    expect(result.completionTimeSeconds).toBeNull();

    const round = await prisma.round.findUniqueOrThrow({ where: { id: ctx.teamRound2Id } });
    expect(round.status).toBe("FINISHED");
    expect(round.earlyEnded).toBe(false);
  });

  it("an autosave after the round ended is rejected", async () => {
    const ctx = await seedPartitionCompetition(`AfterEnd ${suffix}`);
    const sessions = await loginTeam(ctx, "afterend");
    await startPartitionRound(ctx);

    for (let puzzle = 0; puzzle < PUZZLE_COUNT; puzzle += 1) {
      await solveCurrentPuzzle(ctx, sessions);
    }

    const state = await loadState(ctx.teamRound2Id, ctx.teamId).catch(() => null);
    const late = await autosave(
      sessions[0]!,
      ctx.teamRound2Id,
      state?.puzzles[0]?.id ?? "any-question",
      memberGridForBand(0, true),
    );
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("partition.roundEnded");
  });

  it("the timer-expiry path settles every unfinished team (handlePartitionRoundEnded)", async () => {
    const ctx = await seedPartitionCompetition(`TimerExpiry ${suffix}`);
    await startPartitionRound(ctx);

    await prisma.round.update({
      where: { id: ctx.teamRound2Id },
      data: { status: "FINISHED", endedAt: new Date() },
    });
    await gameplayService.handleRoundEnded({
      roundId: ctx.teamRound2Id,
      stageId: ctx.teamStageId,
      competitionId: ctx.competitionId,
      endedAtMs: Date.now(),
    });

    const result = await prisma.teamRoundResult.findFirstOrThrow({
      where: { roundId: ctx.teamRound2Id, teamId: ctx.teamId },
    });
    expect(result.correctCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.completionTimeSeconds).toBeNull();

    const individual = await prisma.individualRoundResult.findMany({
      where: { roundId: ctx.teamRound2Id },
    });
    expect(individual).toHaveLength(0);
  });

  it("no early-finish bonus is ever computed (spec Constraints)", async () => {
    const ctx = await seedPartitionCompetition(`NoBonus ${suffix}`);
    const sessions = await loginTeam(ctx, "nobonus");
    await startPartitionRound(ctx);

    // Solved in well under a second of a 3600-second total time and a 4000-second
    // round duration: an early-finish bonus would have added to this.
    for (let puzzle = 0; puzzle < PUZZLE_COUNT; puzzle += 1) {
      await solveCurrentPuzzle(ctx, sessions);
    }

    const result = await prisma.teamRoundResult.findFirstOrThrow({
      where: { roundId: ctx.teamRound2Id, teamId: ctx.teamId },
    });
    expect(result.score).toBe(result.correctCount * POINTS_PER_PUZZLE);
    expect(result.score).toBe(PUZZLE_COUNT * POINTS_PER_PUZZLE);
  });
});

describe("the pause stops the partition clock with the round (SCR-011, invariant 7)", () => {
  it("a pause does not settle anyone, and its time is handed back on resume", async () => {
    const ctx = await seedPartitionCompetition(`Pause ${suffix}`);
    await startPartitionRound(ctx);

    await roundTimerService.pause(ctx.teamRound2Id);
    // Due already — so the only thing that can stop the settle is the pause.
    const before = await loadState(ctx.teamRound2Id, ctx.teamId);
    await partitionRepository.savePartitionState({
      ...before,
      totalTimeDeadlineMs: Date.now() - 1000,
    });
    await teamPartitionService.tickForTest(ctx.teamRound2Id);
    expect(
      await prisma.teamRoundResult.findMany({ where: { roundId: ctx.teamRound2Id } }),
    ).toHaveLength(0);

    // Put the deadline back into the future before resuming: the resumed tick both
    // hands the paused time back *and* keeps evaluating what is due, so leaving it in
    // the past would settle the team in the same tick the assertion is about.
    const pausedState = await loadState(ctx.teamRound2Id, ctx.teamId);
    await partitionRepository.savePartitionState({
      ...pausedState,
      totalTimeDeadlineMs: Date.now() + 60_000,
    });

    await roundTimerService.resume(ctx.teamRound2Id);
    const paused = await loadState(ctx.teamRound2Id, ctx.teamId);
    await teamPartitionService.tickForTest(ctx.teamRound2Id);

    const after = await loadState(ctx.teamRound2Id, ctx.teamId);
    // The elapsed pause was added back onto the deadline, so the round is still live.
    expect(after.totalTimeDeadlineMs).toBeGreaterThan(paused.totalTimeDeadlineMs);
    expect(after.finished).toBe(false);
    expect(
      await prisma.teamRoundResult.findMany({ where: { roundId: ctx.teamRound2Id } }),
    ).toHaveLength(0);

    await roundTimerService.releaseTimer(ctx.teamRound2Id);
  });
});

describe("membership and round scoping (spec Error Cases, Security)", () => {
  it("rejects an autosave from a participant who is not on a team", async () => {
    const ctx = await seedPartitionCompetition(`NoTeam ${suffix}`);
    await startPartitionRound(ctx);

    const school = await prisma.school.findFirstOrThrow({
      where: { competitionId: ctx.competitionId },
    });
    const outsider = await prisma.participant.create({
      data: {
        competitionId: ctx.competitionId,
        categoryId: ctx.categoryId,
        schoolId: school.id,
        teamId: null,
        name: `Outsider ${suffix}`,
        participantNumber: 99,
        sequence: 99,
      },
    });
    const username = `it14-outsider-${suffix}`;
    await createAccount(username, "PLAYER", outsider.id);
    const login = await loginPlayer(username);

    const res = await request(app)
      .post(`/api/gameplay/partition/${ctx.teamRound2Id}/autosave`)
      .set("x-session-token", login.body.token)
      .set("x-device-id", login.body.deviceId)
      .send({ questionId: "anything", grid: STARTING_FLAT });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("partition.notATeamMember");
  });

  it("rejects an autosave against the rotation round (Team round 1)", async () => {
    const ctx = await seedPartitionCompetition(`WrongRound ${suffix}`);
    await startPartitionRound(ctx);
    const sessions = await loginTeam(ctx, "wronground");

    const res = await autosave(
      sessions[0]!,
      ctx.teamRound1Id,
      "anything",
      memberGridForBand(0, true),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("partition.notAPartitionRound");
  });

  it("rejects an autosave against an Individual-stage round", async () => {
    const ctx = await seedPartitionCompetition(`IndividualRound ${suffix}`);
    await startPartitionRound(ctx);
    const sessions = await loginTeam(ctx, "individualround");

    const individualRound = await prisma.round.findFirstOrThrow({
      where: { stageId: ctx.individualStageId, sequence: 1 },
    });
    const res = await autosave(
      sessions[0]!,
      individualRound.id,
      "anything",
      memberGridForBand(0, true),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("partition.notAPartitionRound");
  });

  it("rejects an autosave and a state read with no player session", async () => {
    const ctx = await seedPartitionCompetition(`NoAuth ${suffix}`);
    await startPartitionRound(ctx);

    const save = await request(app)
      .post(`/api/gameplay/partition/${ctx.teamRound2Id}/autosave`)
      .send({ questionId: "anything", grid: STARTING_FLAT });
    expect(save.status).toBe(401);

    const read = await request(app).get(
      `/api/gameplay/partition/${ctx.teamRound2Id}/state`,
    );
    expect(read.status).toBe(401);
  });

  it("rejects an autosave against a round that does not exist", async () => {
    const ctx = await seedPartitionCompetition(`NoRound ${suffix}`);
    const sessions = await loginTeam(ctx, "noround");

    const res = await autosave(sessions[0]!, "no-such-round", "anything", STARTING_FLAT);
    expect(res.status).toBe(404);
  });
});
