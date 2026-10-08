import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

/**
 * Unit 03 integration tests: creating a competition with the auto-generated fixed
 * structure, the four-condition publish readiness check, publishing, the structure
 * lock, and the controller-only access rule. They run against the real database the
 * CI provisions (migrations are applied first), so they exercise the whole stack.
 *
 * Readiness conditions 2-4 read Participant / Question / CompetitionJudgeAssignment,
 * which Units 04-06 normally create; here they are seeded directly as scratch data
 * (spec 03, "Components Involved"). Everything created here is removed afterwards.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it3-controller-${suffix}`,
  judge: `it3-judge-${suffix}`,
  player: `it3-player-${suffix}`,
};

const createdCompetitionIds: string[] = [];
let controllerToken = "";
let controllerDevice = "";
let judgeToken = "";
let judgeDevice = "";

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE" | "PLAYER",
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
    },
  });
}

function login(role: "controller" | "judge" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

/** A competition created straight through the service, tracked for cleanup. */
async function makeCompetition(name: string) {
  const competition = await competitionService.createCompetition({
    name,
    categories: [
      { code: "U8", name: "Under 8" },
      { code: "U12", name: "Under 12" },
    ],
  });
  createdCompetitionIds.push(competition.id);
  return competition;
}

/** Seed the participant / question / judge rows the readiness check needs. */
async function seedReadinessData(
  competitionId: string,
  options: { judgeRanges?: boolean } = {},
): Promise<void> {
  const competition = await prisma.competition.findUniqueOrThrow({
    where: { id: competitionId },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const individualRoundIds = (
    competition.stages.find((stage) => stage.type === "INDIVIDUAL")?.rounds ?? []
  ).map((round) => round.id);

  let participantNumber = 0;
  for (const category of competition.categories) {
    const school = await prisma.school.create({
      data: { competitionId, name: `School ${category.code} ${suffix}`, sequence: category.sequence },
    });
    participantNumber += 1;
    await prisma.participant.create({
      data: {
        competitionId,
        categoryId: category.id,
        schoolId: school.id,
        name: `P ${category.code} ${suffix}`,
        participantNumber,
        sequence: participantNumber,
      },
    });

    const questionSet = await prisma.questionSet.create({
      data: { competitionId, categoryId: category.id, name: `Set ${category.code} ${suffix}` },
    });
    // The readiness check requires a complete selection of 6 assigned questions per
    // Individual round (BLD-040 / Unit 05's round-selection step).
    for (const [roundIndex, roundId] of individualRoundIds.entries()) {
      for (let questionIndex = 0; questionIndex < 6; questionIndex += 1) {
        await prisma.question.create({
          data: {
            questionSetId: questionSet.id,
            roundId,
            sequence: roundIndex * 6 + questionIndex + 1,
            points: 10,
            gridRows: 4,
            gridColumns: 4,
            regions: [[0, 1, 4, 5]],
            startingGrid: [[0]],
            solution: [[1]],
          },
        });
      }
    }
  }

  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  if (options.judgeRanges !== false) {
    await prisma.competitionJudgeAssignment.create({
      data: {
        competitionId,
        judgeId: judge.id,
        fromParticipantNumber: 1,
        toParticipantNumber: participantNumber,
      },
    });
  }
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  await createAccount(users.judge, "JUDGE");
  await createAccount(users.player, "PLAYER");

  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  const judge = await login("judge", users.judge);
  judgeToken = judge.body.token;
  judgeDevice = judge.body.deviceId;
});

afterAll(async () => {
  // Cascades remove categories, stages, rounds, settings, participants, questions,
  // judge assignments and the scoring configuration.
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.judge.deleteMany({ where: { name: `Judge ${suffix}` } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

function authed(req: request.Test): request.Test {
  return req
    .set("x-session-token", controllerToken)
    .set("x-device-id", controllerDevice);
}

describe("create a competition (AC 1, AC 2)", () => {
  it("creates the competition with two categories and the fixed 2x2 structure", async () => {
    const res = await authed(request(app).post("/api/competitions")).send({
      name: `Created ${suffix}`,
      description: "made by the test",
      categories: [
        { code: "U8", name: "Under 8" },
        { code: "U12", name: "Under 12" },
      ],
    });

    expect(res.status).toBe(201);
    createdCompetitionIds.push(res.body.id);

    expect(res.body.status).toBe("CREATED");
    expect(res.body.categories).toHaveLength(2);

    // Exactly two stages: Individual then Team.
    expect(res.body.stages.map((s: { type: string }) => s.type)).toEqual([
      "INDIVIDUAL",
      "TEAM",
    ]);

    // Two rounds per stage, with the documented default durations.
    const durations: Record<string, number> = {};
    for (const stage of res.body.stages) {
      expect(stage.rounds).toHaveLength(2);
      for (const round of stage.rounds) {
        durations[`${stage.type}:${round.sequence}`] = round.settings.durationSeconds;
        expect(round.settings.preparationSeconds).toBe(60);
        expect(round.settings.earlyBonusRate).toBe(3);
      }
    }
    expect(durations).toEqual({
      "INDIVIDUAL:1": 1200,
      "INDIVIDUAL:2": 1800,
      "TEAM:1": 1800,
      "TEAM:2": 1800,
    });

    // The 1:1 scoring configuration is created with its defaults.
    expect(res.body.scoringConfiguration.schoolCoefficient).toBe("0.6");
    expect(res.body.scoringConfiguration.rankingCycleSeconds).toBe(180);

    // Both link tokens exist from creation (schema @default(uuid())).
    expect(typeof res.body.entryLinkToken).toBe("string");
    expect(typeof res.body.bigScreenLinkToken).toBe("string");
    expect(res.body.entryLinkToken).not.toBe(res.body.bigScreenLinkToken);
  });

  it("rejects a competition with zero categories", async () => {
    const res = await authed(request(app).post("/api/competitions")).send({
      name: `Empty ${suffix}`,
      categories: [],
    });
    expect(res.status).toBe(400);
  });
});

describe("publish readiness (AC 3, AC 4)", () => {
  it("refuses publish and names every unmet condition", async () => {
    const competition = await makeCompetition(`NotReady ${suffix}`);

    const res = await authed(
      request(app).post(`/api/competitions/${competition.id}/publish`),
    ).send();

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("competition.notReady");
    const keys = (res.body.error.details.unmet as { key: string }[]).map((c) => c.key);
    // No participants and no questions — both named. Judge ranges are NOT named:
    // with no participants there is no number for a range to cover, so that
    // condition is vacuously satisfied (naming it here would only add noise).
    expect(keys).toContain("competition.readiness.participantsRequired");
    expect(keys).toContain("competition.readiness.questionsRequired");
    expect(keys).not.toContain("competition.readiness.judgeRangesRequired");

    // No state change: still CREATED.
    const after = await prisma.competition.findUniqueOrThrow({
      where: { id: competition.id },
    });
    expect(after.status).toBe("CREATED");
    expect(after.publishedAt).toBeNull();
  });

  it("names the judge-range condition when participants exist but no range covers them", async () => {
    const competition = await makeCompetition(`NoRanges ${suffix}`);
    await seedReadinessData(competition.id, { judgeRanges: false });

    const res = await authed(
      request(app).post(`/api/competitions/${competition.id}/publish`),
    ).send();

    expect(res.status).toBe(422);
    const keys = (res.body.error.details.unmet as { key: string }[]).map((c) => c.key);
    expect(keys).toContain("competition.readiness.judgeRangesRequired");
  });

  it("publishes once all four conditions pass, returning both links (AC 4)", async () => {
    const competition = await makeCompetition(`Ready ${suffix}`);
    await seedReadinessData(competition.id);

    const readiness = await competitionService.checkPublishReadiness(competition.id);
    expect(readiness.ready).toBe(true);

    const res = await authed(
      request(app).post(`/api/competitions/${competition.id}/publish`),
    ).send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("WAITING");
    expect(typeof res.body.entryLinkToken).toBe("string");
    expect(typeof res.body.bigScreenLinkToken).toBe("string");

    const after = await prisma.competition.findUniqueOrThrow({
      where: { id: competition.id },
    });
    expect(after.status).toBe("WAITING");
    expect(after.publishedAt).not.toBeNull();
  });

  it("treats a partial question selection as not ready (nullable roundId, BLD-040)", async () => {
    // Since `Question.roundId` became nullable, an imported-but-unassigned question
    // (`roundId = null`) must NOT count as coverage, and a round with fewer than the
    // full 6 assigned questions must fail readiness. Seed full data, then remove one
    // assigned question from each Individual round and add unassigned pool questions.
    const competition = await makeCompetition(`PartialQuestions ${suffix}`);
    await seedReadinessData(competition.id);

    const competitionFull = await prisma.competition.findUniqueOrThrow({
      where: { id: competition.id },
      include: { categories: true, stages: { include: { rounds: true } } },
    });
    const individualRoundIds = (
      competitionFull.stages.find((s) => s.type === "INDIVIDUAL")?.rounds ?? []
    ).map((r) => r.id);

    for (const roundId of individualRoundIds) {
      // Drop to 5 assigned questions on this round.
      const assigned = await prisma.question.findMany({ where: { roundId }, select: { id: true } });
      await prisma.question.delete({ where: { id: assigned[0]!.id } });
      // Add 3 unassigned pool questions (roundId = null) — these must not count.
      const category = competitionFull.categories[0]!;
      const set = await prisma.questionSet.findFirstOrThrow({
        where: { categoryId: category.id },
        select: { id: true },
      });
      for (let i = 0; i < 3; i += 1) {
        await prisma.question.create({
          data: {
            questionSetId: set.id,
            roundId: null,
            sequence: 100 + i,
            points: 10,
            gridRows: 4,
            gridColumns: 4,
            regions: [[0, 1, 4, 5]],
            startingGrid: [[0]],
            solution: [[1]],
          },
        });
      }
    }

    const readiness = await competitionService.checkPublishReadiness(competition.id);
    expect(readiness.ready).toBe(false);
    expect(readiness.unmet.map((c) => c.key)).toContain(
      "competition.readiness.questionsRequired",
    );
  });
});

describe("structure lock (AC 5)", () => {
  it("rejects a category change after publish but still allows a round-settings edit", async () => {
    const competition = await makeCompetition(`Locked ${suffix}`);
    await seedReadinessData(competition.id);
    await competitionService.publishCompetition(competition.id);

    // A structure change (category list) is refused.
    const blocked = await authed(
      request(app).patch(`/api/competitions/${competition.id}`),
    ).send({ categories: [{ code: "U8", name: "Under 8" }] });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("competition.structureLocked");

    // A numeric round-settings edit still succeeds.
    const roundId = competition.stages[0]!.rounds[0]!.id;
    const ok = await authed(
      request(app).patch(`/api/competitions/${competition.id}`),
    ).send({ roundSettings: { [roundId]: { durationSeconds: 900 } } });
    expect(ok.status).toBe(200);
    const edited = ok.body.stages[0].rounds[0].settings.durationSeconds;
    expect(edited).toBe(900);
  });

  it("rejects round settings outside the decided constraints", async () => {
    const competition = await makeCompetition(`BadSettings ${suffix}`);
    const roundId = competition.stages[0]!.rounds[0]!.id;

    const res = await authed(
      request(app).patch(`/api/competitions/${competition.id}`),
    ).send({ roundSettings: { [roundId]: { durationSeconds: 0 } } });
    expect(res.status).toBe(400);
  });
});

describe("controller-only access (AC 6)", () => {
  it("refuses a judge session", async () => {
    const res = await request(app)
      .post("/api/competitions")
      .set("x-session-token", judgeToken)
      .set("x-device-id", judgeDevice)
      .send({ name: "Nope", categories: [{ code: "U8", name: "Under 8" }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("competition.forbidden");
  });

  it("refuses a request with no session", async () => {
    const res = await request(app)
      .post("/api/competitions")
      .send({ name: "Nope", categories: [{ code: "U8", name: "Under 8" }] });
    expect(res.status).toBe(401);
  });
});
