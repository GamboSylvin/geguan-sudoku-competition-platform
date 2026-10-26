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
  const individualStage = competition.stages.find((stage) => stage.type === "INDIVIDUAL");
  const individualRoundIds = (individualStage?.rounds ?? []).map((round) => round.id);
  const teamRounds = competition.stages.find((stage) => stage.type === "TEAM")?.rounds ?? [];

  let participantNumber = 0;
  let globalQuestionSequence = 0;
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
    // The readiness check requires a complete selection per round (BLD-040, revised
    // 2026-10-19): 6 per Individual round, `teamQuestionCount` (10) for the rotation
    // Team round and `partitionPuzzleCount` (3) for the partition Team round. Seed all
    // four so a "ready" expectation genuinely covers every round.
    const perRound: Array<[string, number]> = [
      ...individualRoundIds.map((roundId) => [roundId, 6] as [string, number]),
      ...teamRounds.map(
        (round) =>
          [round.id, round.sequence === 2 ? 3 : 10] as [string, number],
      ),
    ];
    for (const [roundId, count] of perRound) {
      for (let questionIndex = 0; questionIndex < count; questionIndex += 1) {
        globalQuestionSequence += 1;
        await prisma.question.create({
          data: {
            questionSetId: questionSet.id,
            roundId,
            sequence: globalQuestionSequence,
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

/**
 * BLD-051 (decided 2026-10-15): the scoring configuration is settable by the
 * controller, on create and on update, through the endpoints that already existed.
 * The default case is asserted by the create test above ("0.6" / 180), so what this
 * block pins is that a supplied value is actually stored and read back, that an
 * update sticks and that a partial update leaves the other field alone.
 */
describe("scoring configuration CRUD (BLD-051)", () => {
  const CATEGORIES = [
    { code: "U8", name: "Under 8" },
    { code: "U12", name: "Under 12" },
  ];

  it("creates with supplied values and reads them back from GET /:id", async () => {
    const created = await authed(request(app).post("/api/competitions")).send({
      name: `Scoring create ${suffix}`,
      categories: CATEGORIES,
      scoringConfiguration: { schoolCoefficient: 0.75, rankingCycleSeconds: 300 },
    });

    expect(created.status).toBe(201);
    createdCompetitionIds.push(created.body.id);
    // A Decimal comes back serialized as a string; the int stays a number.
    expect(created.body.scoringConfiguration.schoolCoefficient).toBe("0.75");
    expect(created.body.scoringConfiguration.rankingCycleSeconds).toBe(300);

    const read = await authed(request(app).get(`/api/competitions/${created.body.id}`)).send();
    expect(read.status).toBe(200);
    expect(read.body.scoringConfiguration.schoolCoefficient).toBe("0.75");
    expect(read.body.scoringConfiguration.rankingCycleSeconds).toBe(300);
  });

  it("updates the values and a partial update leaves the other field alone", async () => {
    const created = await authed(request(app).post("/api/competitions")).send({
      name: `Scoring update ${suffix}`,
      categories: CATEGORIES,
      scoringConfiguration: { schoolCoefficient: 0.75, rankingCycleSeconds: 300 },
    });
    createdCompetitionIds.push(created.body.id);
    const id = created.body.id;

    const full = await authed(request(app).patch(`/api/competitions/${id}`)).send({
      scoringConfiguration: { schoolCoefficient: 0.5, rankingCycleSeconds: 60 },
    });
    expect(full.status).toBe(200);
    expect(full.body.scoringConfiguration.schoolCoefficient).toBe("0.5");
    expect(full.body.scoringConfiguration.rankingCycleSeconds).toBe(60);

    // Only the cycle is named, so the coefficient must keep its stored value.
    const partial = await authed(request(app).patch(`/api/competitions/${id}`)).send({
      scoringConfiguration: { rankingCycleSeconds: 45 },
    });
    expect(partial.status).toBe(200);
    expect(partial.body.scoringConfiguration.rankingCycleSeconds).toBe(45);
    expect(partial.body.scoringConfiguration.schoolCoefficient).toBe("0.5");

    const read = await authed(request(app).get(`/api/competitions/${id}`)).send();
    expect(read.body.scoringConfiguration.schoolCoefficient).toBe("0.5");
    expect(read.body.scoringConfiguration.rankingCycleSeconds).toBe(45);
  });

  it("still edits the scoring configuration after publish, since it is a value not structure", async () => {
    const competition = await makeCompetition(`Scoring locked ${suffix}`);
    await seedReadinessData(competition.id, { judgeRanges: true });

    const published = await authed(
      request(app).post(`/api/competitions/${competition.id}/publish`),
    ).send();
    expect(published.status).toBe(200);

    const edited = await authed(request(app).patch(`/api/competitions/${competition.id}`)).send({
      scoringConfiguration: { schoolCoefficient: 0.9 },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.scoringConfiguration.schoolCoefficient).toBe("0.9");
    expect(edited.body.scoringConfiguration.rankingCycleSeconds).toBe(180);
  });

  it("rejects values that cannot be stored", async () => {
    const zeroCoefficient = await authed(request(app).post("/api/competitions")).send({
      name: `Scoring bad ${suffix}`,
      categories: CATEGORIES,
      scoringConfiguration: { schoolCoefficient: 0 },
    });
    expect(zeroCoefficient.status).toBe(400);

    const fractionalCycle = await authed(request(app).post("/api/competitions")).send({
      name: `Scoring bad ${suffix}`,
      categories: CATEGORIES,
      scoringConfiguration: { rankingCycleSeconds: 1.5 },
    });
    expect(fractionalCycle.status).toBe(400);

    // An unknown field is refused outright by the strict object.
    const unknownField = await authed(request(app).post("/api/competitions")).send({
      name: `Scoring bad ${suffix}`,
      categories: CATEGORIES,
      scoringConfiguration: { notAField: 1 },
    });
    expect(unknownField.status).toBe(400);
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

  it("names the category, the round and its count in the question condition", async () => {
    // The condition used to be one undifferentiated sentence. With two categories and two
    // Individual rounds each there were four places to inspect and no way to know which
    // was short, which reads like a missing feature rather than a missing selection.
    const competition = await makeCompetition(`NamedCulprit ${suffix}`);
    await seedReadinessData(competition.id);

    // Empty round 2 of the second category, and drop one question from round 1 of the
    // first, so the message has to name two different categories and two counts.
    const categories = await prisma.competitionCategory.findMany({
      where: { competitionId: competition.id },
      orderBy: { sequence: "asc" },
    });
    const rounds = await prisma.round.findMany({
      where: { stage: { competitionId: competition.id, type: "INDIVIDUAL" } },
      orderBy: { sequence: "asc" },
    });
    await prisma.question.deleteMany({ where: { roundId: rounds[1]!.id } });
    const oneOfRoundZero = await prisma.question.findFirstOrThrow({
      where: { roundId: rounds[0]!.id },
      select: { id: true },
    });
    await prisma.question.delete({ where: { id: oneOfRoundZero.id } });

    const readiness = await competitionService.checkPublishReadiness(competition.id);
    expect(readiness.ready).toBe(false);

    const named = readiness.unmet.find(
      (c) => c.key === "competition.readiness.questionsRequired",
    );
    expect(named).toBeDefined();
    // Every culprit is listed, not just the first: the second category keeps its own
    // `Under 12` name and its round is at zero.
    expect(named!.message).toContain(categories[0]!.name);
    expect(named!.message).toContain(categories[1]!.name);
    expect(named!.message).toContain(rounds[0]!.name);
    expect(named!.message).toContain(rounds[1]!.name);
    expect(named!.message).toContain("5 / 6");
    expect(named!.message).toContain("0 / 6");
    // Exactly one condition carries that key, however many rounds are short — the
    // controller renders the list keyed by it.
    expect(
      readiness.unmet.filter((c) => c.key === "competition.readiness.questionsRequired"),
    ).toHaveLength(1);
  });
});

describe("per-round Individual question count (BLD-057)", () => {
  /** The Individual round 1 id of a freshly created competition. */
  function individualRoundOne(competition: { stages: Array<{ type: string; rounds: Array<{ id: string; sequence: number }> }> }): string {
    const stage = competition.stages.find((s) => s.type === "INDIVIDUAL");
    return stage!.rounds.find((r) => r.sequence === 1)!.id;
  }

  async function patchCount(competitionId: string, roundId: string, count: number) {
    return authed(request(app).patch(`/api/competitions/${competitionId}`)).send({
      roundSettings: { [roundId]: { individualQuestionCount: count } },
    });
  }

  it("defaults to 6, so every round created before this change behaves as it did", async () => {
    const competition = await makeCompetition(`CountDefault ${suffix}`);
    const roundId = individualRoundOne(competition);
    const row = await prisma.roundSettings.findUniqueOrThrow({
      where: { roundId },
      select: { individualQuestionCount: true },
    });
    expect(row.individualQuestionCount).toBe(6);
  });

  it("accepts a smaller count and makes the readiness check ask for that many", async () => {
    const competition = await makeCompetition(`CountSmall ${suffix}`);
    await seedReadinessData(competition.id); // 6 assigned to each Individual round

    const roundId = individualRoundOne(competition);
    const res = await patchCount(competition.id, roundId, 3);
    expect(res.status).toBe(200);
    expect(res.body.stages[0].rounds[0].settings.individualQuestionCount).toBe(3);

    // 6 assigned against a target of 3 is now *too many*, and the message says so with
    // the configured number rather than the old constant.
    const tooMany = await competitionService.checkPublishReadiness(competition.id);
    expect(tooMany.ready).toBe(false);
    expect(
      tooMany.unmet.find((c) => c.key === "competition.readiness.questionsRequired")!.message,
    ).toContain("6 / 3");

    // Drop three from every category's selection of every Individual round and the
    // competition becomes publishable: the count drives the real gate, not just the
    // message. The trim is per question set, not per round, because the readiness check
    // counts per category·round and `seedReadinessData` seeded 6 in each of the two.
    const individualRounds = await prisma.round.findMany({
      where: { stage: { competitionId: competition.id, type: "INDIVIDUAL" } },
    });
    for (const round of individualRounds) {
      const sets = await prisma.question.findMany({
        where: { roundId: round.id },
        select: { questionSetId: true },
        distinct: ["questionSetId"],
      });
      for (const set of sets) {
        const extras = await prisma.question.findMany({
          where: { roundId: round.id, questionSetId: set.questionSetId },
          orderBy: { sequence: "desc" },
          take: 3,
          select: { id: true },
        });
        await prisma.question.deleteMany({ where: { id: { in: extras.map((q) => q.id) } } });
      }
    }
    // Round 2 was never edited, so it still expects its default 6 and now holds 3.
    await patchCount(competition.id, individualRounds[1]!.id, 3);

    const ready = await competitionService.checkPublishReadiness(competition.id);
    expect(ready.unmet.map((c) => c.key)).not.toContain(
      "competition.readiness.questionsRequired",
    );
    const published = await authed(
      request(app).post(`/api/competitions/${competition.id}/publish`),
    ).send({});
    expect(published.status).toBe(200);
  });

  it("rejects a count that is not a whole number above zero (SCR-012)", async () => {
    const competition = await makeCompetition(`CountBad ${suffix}`);
    const roundId = individualRoundOne(competition);
    expect((await patchCount(competition.id, roundId, 0)).status).toBe(400);
    expect((await patchCount(competition.id, roundId, -2)).status).toBe(400);
    expect((await patchCount(competition.id, roundId, 1.5)).status).toBe(400);
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
