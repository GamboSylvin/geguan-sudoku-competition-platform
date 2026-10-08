/**
 * Scratch seed for Unit 03's own verification: a controller account, one competition
 * with two categories, and the participant / question-set / judge-range rows the
 * publish readiness check needs. Those three are normally created by Units 04, 05
 * and 06; this is throwaway dev tooling, not a feature and not wired into any
 * user-facing flow (spec 03, "Components Involved" / "Implementation Notes"), the
 * same pattern as `seed-test-accounts.ts`.
 *
 * Usage: npx tsx prisma/seed-test-competition.ts
 * Idempotent: if the seed competition already exists it is left untouched and the
 * script stops, so it never accumulates duplicates and never deletes anything.
 */
import { prisma } from "../src/infra/prisma";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

const SEED_NAME = "Seed Competition (Unit 03)";
const CONTROLLER_USERNAME = "controller-test";
const TEST_PASSWORD = "test-pass-1234";

/** A tiny placeholder grid payload — the real shape is defined with Unit 05's import. */
function placeholderGrid(): {
  gridRows: number;
  gridColumns: number;
  regions: number[][];
  startingGrid: number[][];
  solution: number[][];
} {
  return {
    gridRows: 4,
    gridColumns: 4,
    regions: [
      [0, 1, 4, 5],
      [2, 3, 6, 7],
      [8, 9, 12, 13],
      [10, 11, 14, 15],
    ],
    startingGrid: [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    solution: [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ],
  };
}

async function main(): Promise<void> {
  const existing = await prisma.competition.findFirst({ where: { name: SEED_NAME } });
  if (existing) {
    console.log(`Seed competition already exists (${existing.id}). Nothing to do.`);
    return;
  }

  // The controller account the endpoints require (reused from the Unit 02 seed).
  await prisma.account.upsert({
    where: { username: CONTROLLER_USERNAME },
    update: {},
    create: {
      username: CONTROLLER_USERNAME,
      passwordHash: await identityService.hashPassword(TEST_PASSWORD),
      role: "CONTROLLER",
      isActive: true,
    },
  });

  const competition = await competitionService.createCompetition({
    name: SEED_NAME,
    description: "Scratch data for Unit 03's own verification.",
    categories: [
      { code: "U8", name: "Under 8" },
      { code: "U12", name: "Under 12" },
    ],
  });

  const individualStage = competition.stages.find((stage) => stage.type === "INDIVIDUAL");
  const individualRoundIds = (individualStage?.rounds ?? []).map((round) => round.id);

  let participantNumber = 0;
  for (const category of competition.categories) {
    const school = await prisma.school.create({
      data: {
        competitionId: competition.id,
        name: `Seed School ${category.code}`,
        sequence: category.sequence,
      },
    });

    for (const name of [`${category.code} Player A`, `${category.code} Player B`]) {
      participantNumber += 1;
      await prisma.participant.create({
        data: {
          competitionId: competition.id,
          categoryId: category.id,
          schoolId: school.id,
          name,
          participantNumber,
          sequence: participantNumber,
        },
      });
    }

    // One question set per category (BLD-028), with a complete selection of 6
    // questions assigned to each Individual round — the readiness check requires all 6
    // per round now that `roundId` is nullable (BLD-040).
    const questionSet = await prisma.questionSet.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        name: `${category.code} question set`,
      },
    });
    for (const [roundIndex, roundId] of individualRoundIds.entries()) {
      for (let questionIndex = 0; questionIndex < 6; questionIndex += 1) {
        await prisma.question.create({
          data: {
            questionSetId: questionSet.id,
            roundId,
            sequence: roundIndex * 6 + questionIndex + 1,
            points: 10,
            ...placeholderGrid(),
          },
        });
      }
    }
  }

  // One judge whose range covers every participant number created above.
  const judge = await prisma.judge.create({ data: { name: "Seed Judge" } });
  await prisma.competitionJudgeAssignment.create({
    data: {
      competitionId: competition.id,
      judgeId: judge.id,
      fromParticipantNumber: 1,
      toParticipantNumber: participantNumber,
    },
  });

  const readiness = await competitionService.checkPublishReadiness(competition.id);
  console.log(`Seeded competition ${competition.id} (${SEED_NAME}).`);
  console.log(`Controller login: ${CONTROLLER_USERNAME} / ${TEST_PASSWORD}`);
  console.log(`Readiness: ${readiness.ready ? "ready to publish" : "not ready"}`);
  for (const unmet of readiness.unmet) {
    console.log(`  unmet: ${unmet.key}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
