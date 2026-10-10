import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

/**
 * Unit 15 integration tests for the competition copy (acceptance criteria 3, 4, 5
 * and 6 — CMP-10, resolves U-10).
 *
 * The source competition is seeded with the two halves a copy treats differently:
 * structure and questions on one side (copied, as new rows scoped to the copy),
 * player data and results on the other (never copied). Everything is hand-seeded
 * through Prisma, the way Unit 03's own tests seed the readiness data that Units
 * 04-06 would normally create.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `u15c-controller-${suffix}`,
  playerBase: `u15c-player-${suffix}`,
};

let controllerToken = "";
let controllerDevice = "";
let playerToken = "";
let playerDevice = "";

/** Each source gets its own player account — `Account.username` is unique. */
let playerSeed = 0;

function nextPlayerUsername(): string {
  playerSeed += 1;
  return `${users.playerBase}-${playerSeed}`;
}

const createdCompetitionIds: string[] = [];
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

function login(role: "controller" | "player", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

function authedController(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

/**
 * A source competition with everything a copy is defined against: a second
 * category, customized round settings (not the schema defaults), a scoring
 * configuration with a non-default coefficient, a question set with questions both
 * assigned to a round and left in the pool, a judge assignment, and — on the side
 * that must NOT be copied — a school, a team, a participant with an account, an
 * attempt, an answer, an individual result, a team result, a score correction and a
 * ranking snapshot.
 */
async function seedSource(name: string): Promise<{ id: string; playerUsername: string }> {
  const created = await competitionService.createCompetition({
    name,
    description: "copy source",
    categories: [
      { code: "U8", name: "Under 8" },
      { code: "U12", name: "Under 12" },
    ],
  });
  createdCompetitionIds.push(created.id);

  const full = await prisma.competition.findUniqueOrThrow({
    where: { id: created.id },
    include: { categories: true, stages: { include: { rounds: true } } },
  });
  const category = full.categories[0]!;
  const individualRounds = (
    full.stages.find((s) => s.type === "INDIVIDUAL")!.rounds
  )
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const round1 = individualRounds[0]!;
  const round2 = individualRounds[1]!;

  // Customized settings, so a copy that fell back to schema defaults would show it.
  await prisma.roundSettings.update({
    where: { roundId: round1.id },
    data: { durationSeconds: 999, preparationSeconds: 77, earlyBonusRate: 5 },
  });
  await prisma.scoringConfiguration.update({
    where: { competitionId: created.id },
    data: { schoolCoefficient: "0.75", rankingCycleSeconds: 42 },
  });

  // One question set per category (a set belongs to exactly one category, BLD-028),
  // each with a complete round-1 and round-2 selection of 6 assigned questions —
  // Unit 03's readiness condition 2 — plus one pooled question with `roundId = null`
  // (BLD-040), so a copy has to carry both kinds and re-point both links.
  let firstQuestionId = "";
  for (const [categoryIndex, cat] of full.categories.entries()) {
    const questionSet = await prisma.questionSet.create({
      data: {
        competitionId: created.id,
        categoryId: cat.id,
        name: `Set ${cat.code} ${suffix}`,
      },
    });
    let sequence = 0;
    for (const round of [round1, round2]) {
      for (let i = 0; i < 6; i += 1) {
        sequence += 1;
        await prisma.question.create({
          data: {
            questionSetId: questionSet.id,
            roundId: round.id,
            sequence,
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
    sequence += 1;
    await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        roundId: null,
        sequence,
        points: 20,
        gridRows: 6,
        gridColumns: 6,
        regions: [[0, 1]],
        startingGrid: [[2]],
        solution: [[3]],
      },
    });
    // Only the first category's first question is used for the Answer row below.
    if (categoryIndex === 0) {
      firstQuestionId = (
        await prisma.question.findFirstOrThrow({
          where: { questionSetId: questionSet.id, roundId: round1.id },
          orderBy: { sequence: "asc" },
        })
      ).id;
    }
  }

  const judge = await prisma.judge.create({ data: { name: `Judge ${suffix}` } });
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: created.id,
      judgeId: judge.id,
      fromParticipantNumber: 1,
      toParticipantNumber: 5,
    },
  });

  // --- the half a copy must leave behind ---
  const school = await prisma.school.create({
    data: { competitionId: created.id, name: `Alpha ${suffix}`, sequence: 1 },
  });
  const team = await prisma.team.create({
    data: {
      competitionId: created.id,
      categoryId: category.id,
      schoolId: school.id,
      name: `Alpha team ${suffix}`,
      sequence: 1,
    },
  });
  const participant = await prisma.participant.create({
    data: {
      competitionId: created.id,
      categoryId: category.id,
      schoolId: school.id,
      teamId: team.id,
      name: `P1 ${suffix}`,
      participantNumber: 1,
      sequence: 1,
    },
  });
  const playerUsername = nextPlayerUsername();
  await createAccount(playerUsername, "PLAYER", participant.id);

  const participation = await prisma.roundParticipation.create({
    data: {
      roundId: round1.id,
      participantId: participant.id,
      categoryId: category.id,
      state: "SUBMITTED",
    },
  });
  const attempt = await prisma.attempt.create({
    data: {
      roundParticipationId: participation.id,
      attemptNumber: 1,
      submissionType: "MANUAL",
      score: 10,
      totalScore: 10,
      completionTimeSeconds: 30,
    },
  });
  await prisma.roundParticipation.update({
    where: { id: participation.id },
    data: { currentAttemptId: attempt.id },
  });
  await prisma.answer.create({
    data: {
      attemptId: attempt.id,
      questionId: firstQuestionId,
      submittedGrid: [[1]],
      correct: true,
      pointsAwarded: 10,
    },
  });
  await prisma.individualRoundResult.create({
    data: {
      roundId: round1.id,
      participantId: participant.id,
      categoryId: category.id,
      attemptId: attempt.id,
      score: 10,
      totalScore: 10,
      submissionType: "MANUAL",
      completionTimeSeconds: 30,
    },
  });
  await prisma.individualRoundResult.create({
    data: {
      roundId: round2.id,
      participantId: participant.id,
      categoryId: category.id,
      attemptId: attempt.id,
      score: 5,
      totalScore: 5,
      submissionType: "MANUAL",
      completionTimeSeconds: 40,
    },
  });
  const teamStage = full.stages.find((s) => s.type === "TEAM")!;
  await prisma.teamRoundResult.create({
    data: {
      roundId: teamStage.rounds[0]!.id,
      teamId: team.id,
      categoryId: category.id,
      correctCount: 3,
      score: 30,
    },
  });
  await prisma.scoreCorrection.create({
    data: {
      competitionId: created.id,
      targetType: "PARTICIPANT",
      targetId: participant.id,
      oldScore: "10",
      newScore: "11",
      reason: "test",
    },
  });
  await prisma.rankingSnapshot.create({
    data: {
      competitionId: created.id,
      stageId: null,
      categoryId: category.id,
      scope: "SCHOOL",
      isFinal: true,
      payload: { rows: [] },
    },
  });

  return { id: created.id, playerUsername };
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;
});

afterAll(async () => {
  // Cascades take the categories, stages, rounds, settings, participants, questions,
  // judge assignments and scoring configuration of both the source and every copy.
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: createdAccountUsernames } } });
  await prisma.judge.deleteMany({ where: { name: `Judge ${suffix}` } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("copy a competition (criterion 3)", () => {
  it("creates a CREATED competition carrying categories, settings, scoring, questions and judges", async () => {
    const { id: sourceId } = await seedSource(`CopySrc ${suffix}`);
    const res = await authedController(request(app).post(`/api/competitions/${sourceId}/copy`));

    expect(res.status).toBe(201);
    createdCompetitionIds.push(res.body.id);
    expect(res.body.id).not.toBe(sourceId);
    expect(res.body.status).toBe("CREATED");
    expect(res.body.copiedFromCompetitionId).toBe(sourceId);
    // Unpublished: the links are fresh, not the source's.
    expect(res.body.publishedAt).toBeNull();
    expect(res.body.entryLinkToken).not.toBe(
      (await prisma.competition.findUniqueOrThrow({ where: { id: sourceId } })).entryLinkToken,
    );

    const source = await prisma.competition.findUniqueOrThrow({
      where: { id: sourceId },
      include: { categories: true, stages: { include: { rounds: { include: { settings: true } } } } },
    });

    // Categories: same codes, names and order — but new rows.
    expect(res.body.categories.map((c: { code: string }) => c.code)).toEqual(["U8", "U12"]);
    expect(res.body.categories[0].id).not.toBe(source.categories[0]!.id);

    // Scoring configuration: the source's own customized values, not the defaults.
    expect(res.body.scoringConfiguration.schoolCoefficient).toBe("0.75");
    expect(res.body.scoringConfiguration.rankingCycleSeconds).toBe(42);

    // Structure: same stage types, and the round settings are the source's edited
    // values, which is what distinguishes a copy from a fresh create.
    expect(res.body.stages.map((s: { type: string }) => s.type)).toEqual([
      "INDIVIDUAL",
      "TEAM",
    ]);
    const copyRound1 = res.body.stages[0].rounds[0];
    const copyRound2 = res.body.stages[0].rounds[1];
    expect(copyRound1.settings.durationSeconds).toBe(999);
    expect(copyRound1.settings.preparationSeconds).toBe(77);
    expect(copyRound1.settings.earlyBonusRate).toBe(5);
    expect(copyRound1.id).not.toBe(source.stages[0]!.rounds[0]!.id);

    // Question sets and questions are new rows scoped to the copy, with the same
    // content; an assigned question follows its round, a pooled one stays null.
    const copySets = await prisma.questionSet.findMany({
      where: { competitionId: res.body.id },
      orderBy: { name: "asc" },
      include: { questions: { orderBy: { sequence: "asc" } } },
    });
    expect(copySets).toHaveLength(2);
    const copyCategoryIds = res.body.categories.map((c: { id: string }) => c.id);
    expect(copySets.map((s) => s.categoryId).sort()).toEqual([...copyCategoryIds].sort());
    for (const copySet of copySets) {
      // 6 per Individual round, plus one pooled question.
      expect(copySet.questions).toHaveLength(13);
      expect(copySet.questions[12]!.roundId).toBeNull();
      const round1Questions = copySet.questions.filter((q) => q.roundId === copyRound1.id);
      const round2Questions = copySet.questions.filter((q) => q.roundId === copyRound2.id);
      expect(round1Questions).toHaveLength(6);
      expect(round2Questions).toHaveLength(6);
    }
    const sourceSets = await prisma.questionSet.findMany({
      where: { competitionId: sourceId },
      orderBy: { name: "asc" },
      include: { questions: { orderBy: { sequence: "asc" } } },
    });
    expect(copySets.map((s) => s.id)).not.toEqual(sourceSets.map((s) => s.id));
    expect(copySets.map((s) => s.name)).toEqual(sourceSets.map((s) => s.name));
    expect(copySets[0]!.questions.map((q) => q.id)).not.toEqual(
      sourceSets[0]!.questions.map((q) => q.id),
    );
    expect(copySets[0]!.questions.map((q) => q.points)).toEqual(
      sourceSets[0]!.questions.map((q) => q.points),
    );

    // Judge assignments: the same Judge entity, the same range as a starting point.
    const copyAssignments = await prisma.competitionJudgeAssignment.findMany({
      where: { competitionId: res.body.id },
    });
    expect(copyAssignments).toHaveLength(1);
    expect(copyAssignments[0]!.fromParticipantNumber).toBe(1);
    expect(copyAssignments[0]!.toParticipantNumber).toBe(5);
    const sourceAssignment = await prisma.competitionJudgeAssignment.findFirstOrThrow({
      where: { competitionId: sourceId },
    });
    expect(copyAssignments[0]!.judgeId).toBe(sourceAssignment.judgeId);
    expect(copyAssignments[0]!.id).not.toBe(sourceAssignment.id);
  });
});

describe("what a copy leaves behind (criterion 4)", () => {
  it("carries zero schools, teams, participants, accounts, attempts, answers, results, corrections, rankings and files", async () => {
    const { id: sourceId, playerUsername } = await seedSource(`CopyEmpty ${suffix}`);
    const res = await authedController(request(app).post(`/api/competitions/${sourceId}/copy`));
    expect(res.status).toBe(201);
    const copyId = res.body.id as string;
    createdCompetitionIds.push(copyId);

    const [
      schools,
      teams,
      participants,
      assignments,
      attempts,
      answers,
      individualResults,
      teamResults,
      corrections,
      snapshots,
      files,
      batches,
    ] = await Promise.all([
      prisma.school.count({ where: { competitionId: copyId } }),
      prisma.team.count({ where: { competitionId: copyId } }),
      prisma.participant.count({ where: { competitionId: copyId } }),
      prisma.account.count({ where: { participant: { competitionId: copyId } } }),
      prisma.attempt.count({
        where: { roundParticipation: { round: { stage: { competitionId: copyId } } } },
      }),
      prisma.answer.count({
        where: { attempt: { roundParticipation: { round: { stage: { competitionId: copyId } } } } },
      }),
      prisma.individualRoundResult.count({
        where: { round: { stage: { competitionId: copyId } } },
      }),
      prisma.teamRoundResult.count({ where: { round: { stage: { competitionId: copyId } } } }),
      prisma.scoreCorrection.count({ where: { competitionId: copyId } }),
      prisma.rankingSnapshot.count({ where: { competitionId: copyId } }),
      prisma.storedFile.count({ where: { competitionId: copyId } }),
      prisma.importBatch.count({ where: { competitionId: copyId } }),
    ]);

    // The source really did have all of these, so the zeros mean something.
    expect(await prisma.participant.count({ where: { competitionId: sourceId } })).toBe(1);
    expect(
      await prisma.individualRoundResult.count({ where: { round: { stage: { competitionId: sourceId } } } }),
    ).toBe(2);

    expect(schools).toBe(0);
    expect(teams).toBe(0);
    expect(participants).toBe(0);
    expect(assignments).toBe(0);
    expect(attempts).toBe(0);
    expect(answers).toBe(0);
    expect(individualResults).toBe(0);
    expect(teamResults).toBe(0);
    expect(corrections).toBe(0);
    expect(snapshots).toBe(0);
    expect(files).toBe(0);
    expect(batches).toBe(0);

    // The source's player account still exists and still points at the source's
    // participant — the copy did not steal or re-point it.
    const playerAccount = await prisma.account.findUniqueOrThrow({
      where: { username: playerUsername },
    });
    expect(playerAccount.participantId).not.toBeNull();
    const owner = await prisma.participant.findUniqueOrThrow({
      where: { id: playerAccount.participantId! },
    });
    expect(owner.competitionId).toBe(sourceId);
  });
});

describe("the copy must be published again (criterion 5)", () => {
  it("refuses to publish without a fresh participant import, then publishes once complete", async () => {
    const { id: sourceId } = await seedSource(`CopyPub ${suffix}`);
    const res = await authedController(request(app).post(`/api/competitions/${sourceId}/copy`));
    expect(res.status).toBe(201);
    const copyId = res.body.id as string;
    createdCompetitionIds.push(copyId);

    // Questions and judge ranges were copied, but no participant was — so readiness
    // fails on participants exactly as Unit 03's own check requires, and the copy is
    // not runnable yet.
    const refused = await authedController(
      request(app).post(`/api/competitions/${copyId}/publish`),
    ).send();
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("competition.notReady");
    expect(
      (refused.body.error.details.unmet as { key: string }[]).map((c) => c.key),
    ).toContain("competition.readiness.participantsRequired");

    // Importing a participant into every category of the copy — Unit 04's job,
    // hand-seeded here — is what makes it publishable through the normal flow.
    const copy = await prisma.competition.findUniqueOrThrow({
      where: { id: copyId },
      include: { categories: { orderBy: { sequence: "asc" } } },
    });
    let participantNumber = 0;
    for (const cat of copy.categories) {
      const school = await prisma.school.create({
        data: { competitionId: copyId, name: `Beta ${cat.code} ${suffix}`, sequence: cat.sequence },
      });
      participantNumber += 1;
      await prisma.participant.create({
        data: {
          competitionId: copyId,
          categoryId: cat.id,
          schoolId: school.id,
          name: `P${cat.code} ${suffix}`,
          participantNumber,
          sequence: participantNumber,
        },
      });
    }

    const published = await authedController(
      request(app).post(`/api/competitions/${copyId}/publish`),
    ).send();
    expect(published.status).toBe(200);
    // Unit 03's publish moves CREATED → WAITING (not a literal "PUBLISHED" status)
    // and stamps `publishedAt` — that is what "published again" means here.
    expect(published.body.status).toBe("WAITING");
    expect(published.body.publishedAt).not.toBeNull();
    // The source is untouched by all of this.
    const source = await prisma.competition.findUniqueOrThrow({ where: { id: sourceId } });
    expect(source.status).toBe("CREATED");
  });
});

describe("copy access (criterion 6)", () => {
  it("rejects a player session with 403", async () => {
    const { id: sourceId, playerUsername } = await seedSource(`CopySec ${suffix}`);
    const player = await login("player", playerUsername);
    playerToken = player.body.token;
    playerDevice = player.body.deviceId;

    const res = await request(app)
      .post(`/api/competitions/${sourceId}/copy`)
      .set("x-session-token", playerToken)
      .set("x-device-id", playerDevice);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("competition.forbidden");
    // Nothing was created by the rejected call.
    expect(await prisma.competition.count({ where: { copiedFromCompetitionId: sourceId } })).toBe(0);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const { id: sourceId } = await seedSource(`CopyAnon ${suffix}`);
    const res = await request(app).post(`/api/competitions/${sourceId}/copy`);
    expect(res.status).toBe(401);
  });

  it("404s on an unknown competition", async () => {
    const res = await authedController(
      request(app).post("/api/competitions/no-such-competition/copy"),
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("competition.notFound");
  });
});
