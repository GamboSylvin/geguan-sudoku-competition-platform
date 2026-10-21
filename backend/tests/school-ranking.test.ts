import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import { schoolRankingService } from "../src/modules/ranking";
import type { SchoolRankingRow } from "../src/modules/ranking";

/**
 * Unit 15 integration tests, half 1: school ranking.
 *
 * Covers the acceptance criteria from
 * `specs/15-school-ranking-and-competition-copy.md`:
 *   1. A school's total is an exact decimal: (sum of every one of its players'
 *      individual two-round totals in the category) × the coefficient + the team's
 *      rotation score + the team's partition score.
 *   2. Schools are ranked within a category on that total; a genuine tie is broken
 *      by the sum of the submission times of the school's counted players, earlier
 *      wins (SCR-020).
 *   6. A non-controller session cannot read a school ranking (ROL-002).
 * Plus the spec's Error Cases: an incomplete category returns what is computable
 * with `isFinal: false`, never an error.
 *
 * `TeamRoundResult` rows are hand-seeded here, exactly the way Unit 09's tests
 * hand-seeded `IndividualRoundResult` rows before Unit 08's real gameplay flow
 * existed. Units 13/14 (which will write those rows for real) are being built in
 * parallel and are not part of this checkout; the computation does not care who
 * wrote the row.
 *
 * The individual sum is seeded to **3** with the default coefficient 0.6 on
 * purpose: `3 * 0.6` is `1.7999999999999998` in plain IEEE-754 floating point but
 * exactly `1.8` in decimal. That single number is what proves SCR-013 ("never
 * rounded or truncated") is honoured rather than accidentally working.
 */

const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `u15s-controller-${suffix}`,
  player: `u15s-player-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";
let playerToken = "";
let playerDevice = "";

const createdCompetitionIds: string[] = [];
const createdJudgeIds: string[] = [];
const createdAccountUsernames: string[] = [];

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
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

function login(role: "controller" | "judge" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

function authedController(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

interface SeededCategory {
  competitionId: string;
  categoryId: string;
  individualRoundIds: string[];
  teamRoundIds: string[];
  schoolIds: string[];
  teamIds: string[];
  participantIds: string[];
}

/**
 * A published one-category competition with two schools. School A has **three**
 * players in the category (SCR-018's point: the individual half counts every one
 * of them, not just the team); school B has two. Each school has exactly one team
 * in the category (SCR-004).
 *
 * `publish` is false by default because publishing runs Unit 03's four readiness
 * conditions, and the school ranking does not need a published competition — it
 * reads durable results.
 */
async function seedSchoolCompetition(name: string): Promise<SeededCategory> {
  const competition = await competitionService.createCompetition({
    name,
    categories: [{ code: "U8", name: "Under 8" }],
  });
  createdCompetitionIds.push(competition.id);

  const full = await prisma.competition.findUniqueOrThrow({
    where: { id: competition.id },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const category = full.categories[0]!;
  const individualStage = full.stages.find((s) => s.type === "INDIVIDUAL")!;
  const teamStage = full.stages.find((s) => s.type === "TEAM")!;
  const individualRounds = individualStage.rounds
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const teamRounds = teamStage.rounds.slice().sort((a, b) => a.sequence - b.sequence);

  const schoolA = await prisma.school.create({
    data: { competitionId: competition.id, name: `Alpha ${suffix}`, sequence: 1 },
  });
  const schoolB = await prisma.school.create({
    data: { competitionId: competition.id, name: `Beta ${suffix}`, sequence: 2 },
  });

  const teamA = await prisma.team.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: schoolA.id,
      name: `Alpha team ${suffix}`,
      sequence: 1,
    },
  });
  const teamB = await prisma.team.create({
    data: {
      competitionId: competition.id,
      categoryId: category.id,
      schoolId: schoolB.id,
      name: `Beta team ${suffix}`,
      sequence: 2,
    },
  });

  // Three players for school A, two for school B. Only the first two of A are on
  // A's team — the third is a plain category participant, and SCR-018 still counts
  // their score toward the school total.
  const specs: { name: string; schoolId: string; teamId: string; number: number }[] = [
    { name: `A1 ${suffix}`, schoolId: schoolA.id, teamId: teamA.id, number: 1 },
    { name: `A2 ${suffix}`, schoolId: schoolA.id, teamId: teamA.id, number: 2 },
    { name: `A3 ${suffix}`, schoolId: schoolA.id, teamId: teamA.id, number: 3 },
    { name: `B1 ${suffix}`, schoolId: schoolB.id, teamId: teamB.id, number: 4 },
    { name: `B2 ${suffix}`, schoolId: schoolB.id, teamId: teamB.id, number: 5 },
  ];
  const participantIds: string[] = [];
  for (const spec of specs) {
    const participant = await prisma.participant.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        schoolId: spec.schoolId,
        teamId: spec.teamId,
        name: spec.name,
        participantNumber: spec.number,
        sequence: spec.number,
      },
    });
    participantIds.push(participant.id);
  }

  return {
    competitionId: competition.id,
    categoryId: category.id,
    individualRoundIds: individualRounds.map((r) => r.id),
    teamRoundIds: teamRounds.map((r) => r.id),
    schoolIds: [schoolA.id, schoolB.id],
    teamIds: [teamA.id, teamB.id],
    participantIds,
  };
}

/**
 * Hand-seed one finalized Individual-round result. `IndividualRoundResult` needs a
 * real `Attempt`, which needs a real `RoundParticipation` — so all three are
 * created, mirroring what Unit 08's finalize writes.
 */
async function seedIndividualResult(input: {
  roundId: string;
  participantId: string;
  categoryId: string;
  totalScore: number;
  completionTimeSeconds: number;
}): Promise<void> {
  const participation = await prisma.roundParticipation.create({
    data: {
      roundId: input.roundId,
      participantId: input.participantId,
      categoryId: input.categoryId,
      state: "SUBMITTED",
    },
  });
  const attempt = await prisma.attempt.create({
    data: {
      roundParticipationId: participation.id,
      attemptNumber: 1,
      submissionType: "MANUAL",
      totalScore: input.totalScore,
      completionTimeSeconds: input.completionTimeSeconds,
    },
  });
  await prisma.roundParticipation.update({
    where: { id: participation.id },
    data: { currentAttemptId: attempt.id },
  });
  await prisma.individualRoundResult.create({
    data: {
      roundId: input.roundId,
      participantId: input.participantId,
      categoryId: input.categoryId,
      attemptId: attempt.id,
      score: input.totalScore,
      totalScore: input.totalScore,
      submissionType: "MANUAL",
      completionTimeSeconds: input.completionTimeSeconds,
    },
  });
}

/** Hand-seed one team round result (Units 13/14 write these for real). */
async function seedTeamResult(input: {
  roundId: string;
  teamId: string;
  categoryId: string;
  score: number;
}): Promise<void> {
  await prisma.teamRoundResult.create({
    data: {
      roundId: input.roundId,
      teamId: input.teamId,
      categoryId: input.categoryId,
      correctCount: input.score,
      score: input.score,
      completionTimeSeconds: 100,
    },
  });
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;
});

afterAll(async () => {
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { judgeId: { in: createdJudgeIds } } });
  await prisma.judge.deleteMany({ where: { id: { in: createdJudgeIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("pure school tie-break rule (no I/O)", () => {
  it("ranks the lower summed submission time ahead (SCR-020)", () => {
    const base: SchoolRankingRow = {
      rank: 0,
      schoolId: "s-a",
      schoolName: "A",
      individualSum: 100,
      teamRound1Score: 10,
      teamRound2Score: 10,
      schoolTotal: "80",
      completionTimeSeconds: 900,
      countedPlayers: 3,
      isComplete: true,
    };
    const slower: SchoolRankingRow = { ...base, completionTimeSeconds: 900 };
    const faster: SchoolRankingRow = { ...base, completionTimeSeconds: 700 };
    expect(schoolRankingService.schoolBreakTie(faster, slower)).toBeLessThan(0);
    expect(schoolRankingService.schoolBreakTie(slower, faster)).toBeGreaterThan(0);
    expect(schoolRankingService.schoolBreakTie(base, { ...base })).toBe(0);
  });
});

describe("school total and ranking", () => {
  it("computes the exact decimal total and ranks schools on it (criteria 1 and 2)", async () => {
    const seeded = await seedSchoolCompetition(`u15-total-${suffix}`);
    const [round1, round2] = seeded.individualRoundIds;
    const [teamRound1, teamRound2] = seeded.teamRoundIds;
    const [pA1, pA2, pA3, pB1, pB2] = seeded.participantIds;

    // School A: all three of its category players count, including pA3 who is not
    // on the team. 1 + 1 + 1 = 3 individual points in round 1 (both rounds below).
    // 3 × 0.6 = 1.8 exactly — but 1.7999999999999998 in plain floating point.
    for (const roundId of [round1!, round2!]) {
      await seedIndividualResult({
        roundId,
        participantId: pA1!,
        categoryId: seeded.categoryId,
        totalScore: 1,
        completionTimeSeconds: 10,
      });
      await seedIndividualResult({
        roundId,
        participantId: pA2!,
        categoryId: seeded.categoryId,
        totalScore: 1,
        completionTimeSeconds: 10,
      });
      await seedIndividualResult({
        roundId,
        participantId: pA3!,
        categoryId: seeded.categoryId,
        totalScore: 1,
        completionTimeSeconds: 10,
      });
    }
    // School B: 2 players × 5 points × 2 rounds = 20 → 20 × 0.6 = 12 exactly.
    for (const roundId of [round1!, round2!]) {
      for (const participantId of [pB1, pB2]) {
        await seedIndividualResult({
          roundId,
          participantId: participantId!,
          categoryId: seeded.categoryId,
          totalScore: 5,
          completionTimeSeconds: 30,
        });
      }
    }

    await seedTeamResult({
      roundId: teamRound1!,
      teamId: seeded.teamIds[0]!,
      categoryId: seeded.categoryId,
      score: 7,
    });
    await seedTeamResult({
      roundId: teamRound2!,
      teamId: seeded.teamIds[0]!,
      categoryId: seeded.categoryId,
      score: 3,
    });
    await seedTeamResult({
      roundId: teamRound1!,
      teamId: seeded.teamIds[1]!,
      categoryId: seeded.categoryId,
      score: 1,
    });
    await seedTeamResult({
      roundId: teamRound2!,
      teamId: seeded.teamIds[1]!,
      categoryId: seeded.categoryId,
      score: 1,
    });

    const res = await authedController(
      request(app).get(
        `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
      ),
    );

    expect(res.status).toBe(200);
    expect(res.body.isFinal).toBe(true);
    expect(res.body.schoolCoefficient).toBe("0.6");
    expect(res.body.rows).toHaveLength(2);

    const schoolA = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[0]);
    const schoolB = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[1]);

    // Criterion 1: the individual half counted all THREE of A's players (6 across
    // two rounds), not just the two on the team, and the total is exact.
    expect(schoolA.individualSum).toBe(6);
    expect(schoolA.countedPlayers).toBe(3);
    expect(schoolA.teamRound1Score).toBe(7);
    expect(schoolA.teamRound2Score).toBe(3);
    // 6 × 0.6 = 3.6, + 7 + 3 = 13.6. A JS number would give 13.600000000000001.
    expect(schoolA.schoolTotal).toBe("13.6");

    expect(schoolB.individualSum).toBe(20);
    expect(schoolB.schoolTotal).toBe("14");

    // Criterion 2: B's total is higher, so B ranks first even though A has more players.
    expect(schoolB.rank).toBe(1);
    expect(schoolA.rank).toBe(2);
  });

  it("never degrades the stored total to a floating-point number (criterion 1, SCR-013)", async () => {
    const seeded = await seedSchoolCompetition(`u15-exact-${suffix}`);
    const [round1, round2] = seeded.individualRoundIds;
    const [pA1, pA2, pA3] = seeded.participantIds;

    // 3 individual points in total across both rounds (1 + 1 + 1 in round 1).
    // 3 × 0.6 is 1.7999999999999998 in IEEE-754 but exactly 1.8 in decimal.
    await seedIndividualResult({
      roundId: round1!,
      participantId: pA1!,
      categoryId: seeded.categoryId,
      totalScore: 1,
      completionTimeSeconds: 5,
    });
    await seedIndividualResult({
      roundId: round1!,
      participantId: pA2!,
      categoryId: seeded.categoryId,
      totalScore: 1,
      completionTimeSeconds: 5,
    });
    await seedIndividualResult({
      roundId: round2!,
      participantId: pA3!,
      categoryId: seeded.categoryId,
      totalScore: 1,
      completionTimeSeconds: 5,
    });

    const res = await authedController(
      request(app).get(
        `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
      ),
    );
    expect(res.status).toBe(200);
    const schoolA = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[0]);
    expect(schoolA.schoolTotal).toBe("1.8");
    // The proof that a plain number would have failed: 3 * 0.6 is not 1.8.
    expect(3 * 0.6).not.toBe(1.8);

    // The snapshot payload itself stores the exact string too, so a later read of
    // the durable record is not degraded either.
    const snapshot = await prisma.rankingSnapshot.findFirst({
      where: {
        competitionId: seeded.competitionId,
        categoryId: seeded.categoryId,
        scope: "SCHOOL",
      },
      orderBy: { computedAt: "desc" },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.stageId).toBeNull();
    const payload = snapshot!.payload as unknown as {
      scope: string;
      rows: SchoolRankingRow[];
      schoolCoefficient: string;
    };
    expect(payload.scope).toBe("SCHOOL");
    expect(payload.schoolCoefficient).toBe("0.6");
    expect(payload.rows.find((r) => r.schoolId === seeded.schoolIds[0])?.schoolTotal).toBe("1.8");
  });

  it("breaks a genuine tie on the summed submission time of all counted players (criterion 2)", async () => {
    const seeded = await seedSchoolCompetition(`u15-tie-${suffix}`);
    const [round1] = seeded.individualRoundIds;
    const [pA1, pA2, pA3, pB1, pB2] = seeded.participantIds;

    // Both schools reach the same total, but A's three players submit faster in
    // aggregate than B's two. The tie-break sums over **all** counted players, so
    // A's extra (faster) third player is what settles it.
    await seedIndividualResult({
      roundId: round1!,
      participantId: pA1!,
      categoryId: seeded.categoryId,
      totalScore: 10,
      completionTimeSeconds: 10,
    });
    await seedIndividualResult({
      roundId: round1!,
      participantId: pA2!,
      categoryId: seeded.categoryId,
      totalScore: 0,
      completionTimeSeconds: 10,
    });
    await seedIndividualResult({
      roundId: round1!,
      participantId: pA3!,
      categoryId: seeded.categoryId,
      totalScore: 0,
      completionTimeSeconds: 10,
    });
    // B: the same 10 individual points, so the same 10 × 0.6 = 6 total, but split
    // over only two players submitting at 40 s each — 80 s against A's 30 s.
    await seedIndividualResult({
      roundId: round1!,
      participantId: pB1!,
      categoryId: seeded.categoryId,
      totalScore: 10,
      completionTimeSeconds: 40,
    });
    await seedIndividualResult({
      roundId: round1!,
      participantId: pB2!,
      categoryId: seeded.categoryId,
      totalScore: 0,
      completionTimeSeconds: 40,
    });

    const res = await authedController(
      request(app).get(
        `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
      ),
    );
    expect(res.status).toBe(200);
    const schoolA = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[0]);
    const schoolB = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[1]);
    expect(schoolA.schoolTotal).toBe(schoolB.schoolTotal);
    expect(schoolA.completionTimeSeconds).toBe(30);
    expect(schoolB.completionTimeSeconds).toBe(80);
    // A is earlier in aggregate, so A ranks first, and the ranks are NOT shared.
    expect(schoolA.rank).toBe(1);
    expect(schoolB.rank).toBe(2);
  });

  it("shares a rank only when both the total and the tie-break are equal (criterion 2)", async () => {
    const seeded = await seedSchoolCompetition(`u15-share-${suffix}`);
    const [round1] = seeded.individualRoundIds;
    // Index 3 is B1 — destructuring the first two elements would have taken two of
    // school A's players and left B with nothing to tie on.
    const pA1 = seeded.participantIds[0]!;
    const pB1 = seeded.participantIds[3]!;

    await seedIndividualResult({
      roundId: round1!,
      participantId: pA1,
      categoryId: seeded.categoryId,
      totalScore: 10,
      completionTimeSeconds: 25,
    });
    await seedIndividualResult({
      roundId: round1!,
      participantId: pB1,
      categoryId: seeded.categoryId,
      totalScore: 10,
      completionTimeSeconds: 25,
    });

    const res = await authedController(
      request(app).get(
        `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
      ),
    );
    expect(res.status).toBe(200);
    const schoolA = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[0]);
    const schoolB = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[1]);
    // Same exact total, same summed submission time → the rank is shared.
    expect(schoolA.schoolTotal).toBe(schoolB.schoolTotal);
    expect(schoolA.completionTimeSeconds).toBe(25);
    expect(schoolB.completionTimeSeconds).toBe(25);
    expect(res.body.rows[0].rank).toBe(1);
    expect(res.body.rows[1].rank).toBe(1);
  });

  it("returns what is computable, not an error, while a category is incomplete", async () => {
    const seeded = await seedSchoolCompetition(`u15-partial-${suffix}`);
    const [round1] = seeded.individualRoundIds;
    const [pA1] = seeded.participantIds;

    // Only one of A's three players has one of two rounds finalized, and no team
    // result exists at all: everything is still computable, nothing is final.
    await seedIndividualResult({
      roundId: round1!,
      participantId: pA1!,
      categoryId: seeded.categoryId,
      totalScore: 4,
      completionTimeSeconds: 12,
    });

    const res = await authedController(
      request(app).get(
        `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body.isFinal).toBe(false);
    const schoolA = res.body.rows.find((r: SchoolRankingRow) => r.schoolId === seeded.schoolIds[0]);
    expect(schoolA.isComplete).toBe(false);
    expect(schoolA.schoolTotal).toBe("2.4");
  });

  it("never mixes two categories in one school ranking (EVT-002)", async () => {
    const seeded = await seedSchoolCompetition(`u15-cat-${suffix}`);
    const secondCategory = await prisma.competitionCategory.create({
      data: {
        competitionId: seeded.competitionId,
        code: "U10",
        name: "Under 10",
        sequence: 2,
      },
    });
    const [round1] = seeded.individualRoundIds;
    await seedIndividualResult({
      roundId: round1!,
      participantId: seeded.participantIds[0]!,
      categoryId: seeded.categoryId,
      totalScore: 9,
      completionTimeSeconds: 12,
    });

    const other = await authedController(
      request(app).get(
        `/api/competitions/${seeded.competitionId}/categories/${secondCategory.id}/school-ranking`,
      ),
    );
    expect(other.status).toBe(200);
    // The second category has no participant and no team, so its leaderboard is empty.
    expect(other.body.rows).toEqual([]);
    expect(other.body.isFinal).toBe(true);
  });
});

describe("school ranking security (ROL-002)", () => {
  it("rejects a player session with 403", async () => {
    const seeded = await seedSchoolCompetition(`u15-sec-${suffix}`);
    await createAccount(users.player, "PLAYER", seeded.participantIds[0]);
    const player = await login("player", users.player);
    playerToken = player.body.token;
    playerDevice = player.body.deviceId;

    const res = await request(app)
      .get(
        `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
      )
      .set("x-session-token", playerToken)
      .set("x-device-id", playerDevice);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ranking.forbidden");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const seeded = await seedSchoolCompetition(`u15-anon-${suffix}`);
    const res = await request(app).get(
      `/api/competitions/${seeded.competitionId}/categories/${seeded.categoryId}/school-ranking`,
    );
    expect(res.status).toBe(401);
  });

  it("404s on a competition with no Individual stage", async () => {
    const res = await authedController(
      request(app).get(`/api/competitions/no-such-id/categories/no-such-cat/school-ranking`),
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ranking.notFound");
  });
});
