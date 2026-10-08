/**
 * Manual-QA seed: a fully published competition with real, login-ready accounts
 * for every built-unit role — controller, judge, and players — so a human tester
 * can walk the scenarios in `testing/manual-test-scenarios.md` without touching
 * Prisma Studio or the database directly. Same throwaway-dev-tooling pattern as
 * `seed-test-accounts.ts`/`seed-test-competition.ts` (not a feature, not wired
 * into any user-facing flow), extended to also create participant accounts
 * (Unit 04 doesn't exist yet, so this is the only way to log in as a player today)
 * and to publish the competition so Units 06-10's live flows are reachable.
 *
 * Usage: npx tsx prisma/seed-manual-qa.ts
 * Idempotent: if the seed competition already exists, prints its existing
 * credentials/links again instead of creating a duplicate.
 */
import { prisma } from "../src/infra/prisma";
import { identityService } from "../src/modules/identity";
import { judgeService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

const SEED_NAME = "Manual QA Competition";
const PASSWORD = "test-pass-1234";
const CONTROLLER_USERNAME = "qa-controller";

// The real, stakeholder-confirmed category scheme (BLD-041): 3 age-pair groups,
// not U6-U20. Two of the three are enough to exercise multi-category flows.
const CATEGORIES = [
  { code: "G1-2", name: "Grades 1-2" },
  { code: "G3-4", name: "Grades 3-4" },
];

// Two schools per category, two players per school: enough to exercise the
// school-total ranking (SCR-004, more than one school) without being tedious
// to read through by hand.
const SCHOOLS_PER_CATEGORY = ["QA School Alpha", "QA School Beta"];
const PLAYERS_PER_SCHOOL = 2;

/** A tiny, always-valid 4x4 grid — any Question row needs one; the real import
 * format (and the real sample file transcribed for Unit 05) is exercised
 * separately, as its own manual scenario, not through this seed. */
function placeholderGrid(seed: number): {
  gridRows: number;
  gridColumns: number;
  regions: number[][];
  startingGrid: number[][];
  solution: number[][];
} {
  const base = [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ];
  // Rotate rows by `seed` so every seeded question has a distinct-looking grid
  // (cosmetic only — still a valid, uniquely-solvable 4x4 Sudoku).
  const solution = base.map((_, i) => base[(i + seed) % 4]);
  const startingGrid = solution.map((row, i) => row.map((v, j) => (i === 0 && j === 0 ? v : 0)));
  return {
    gridRows: 4,
    gridColumns: 4,
    regions: [
      [0, 1, 4, 5],
      [2, 3, 6, 7],
      [8, 9, 12, 13],
      [10, 11, 14, 15],
    ],
    startingGrid,
    solution,
  };
}

async function main(): Promise<void> {
  const existing = await prisma.competition.findFirst({ where: { name: SEED_NAME } });
  if (existing) {
    console.log(`Seed competition already exists (${existing.id}). Re-printing its details.`);
    console.log(`Controller login: ${CONTROLLER_USERNAME} / ${PASSWORD}`);
    console.log(`Status: ${existing.status}`);
    console.log(`Big-screen URL: /big-screen/${existing.bigScreenLinkToken}`);
    const participants = await prisma.participant.findMany({
      where: { competitionId: existing.id },
      include: { account: true, school: true, category: true },
      orderBy: { participantNumber: "asc" },
    });
    for (const p of participants) {
      console.log(
        `  Player ${p.participantNumber} (${p.name}, ${p.school.name}, ${p.category.name}): ${p.account?.username} / ${PASSWORD}`,
      );
    }
    const assignments = await prisma.competitionJudgeAssignment.findMany({
      where: { competitionId: existing.id },
      include: { judge: { include: { account: true } } },
    });
    for (const a of assignments) {
      console.log(
        `  Judge ${a.judge.name} (range ${a.fromParticipantNumber}-${a.toParticipantNumber}): ${a.judge.account?.username} / <password only shown at creation, re-run with a fresh DB to see it again>`,
      );
    }
    return;
  }

  await prisma.account.upsert({
    where: { username: CONTROLLER_USERNAME },
    update: {},
    create: {
      username: CONTROLLER_USERNAME,
      passwordHash: await identityService.hashPassword(PASSWORD),
      role: "CONTROLLER",
      isActive: true,
    },
  });

  const competition = await competitionService.createCompetition({
    name: SEED_NAME,
    description: "Manual QA fixture — see testing/manual-test-scenarios.md.",
    categories: CATEGORIES,
  });

  const individualStage = competition.stages.find((s) => s.type === "INDIVIDUAL");
  const individualRoundIds = (individualStage?.rounds ?? []).map((r) => r.id);

  let participantNumber = 0;
  const playerLines: string[] = [];

  for (const category of competition.categories) {
    for (const schoolName of SCHOOLS_PER_CATEGORY) {
      const school = await prisma.school.create({
        data: {
          competitionId: competition.id,
          name: `${schoolName} (${category.code})`,
          sequence: category.sequence,
        },
      });

      for (let i = 1; i <= PLAYERS_PER_SCHOOL; i += 1) {
        participantNumber += 1;
        const participant = await prisma.participant.create({
          data: {
            competitionId: competition.id,
            categoryId: category.id,
            schoolId: school.id,
            name: `${category.code} Player ${participantNumber}`,
            participantNumber,
            sequence: participantNumber,
          },
        });

        const username = `qa-player-${participantNumber}`;
        await prisma.account.create({
          data: {
            username,
            passwordHash: await identityService.hashPassword(PASSWORD),
            role: "PLAYER",
            isActive: true,
            participantId: participant.id,
          },
        });
        playerLines.push(
          `  Player #${participantNumber} (${school.name}, ${category.name}): ${username} / ${PASSWORD}`,
        );
      }
    }

    // One question set per category with 6 questions assigned to each Individual
    // round (the minimum the publish-readiness check requires, BLD-040).
    const questionSet = await prisma.questionSet.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        name: `${category.code} seeded question set`,
      },
    });
    for (const [roundIndex, roundId] of individualRoundIds.entries()) {
      for (let q = 0; q < 6; q += 1) {
        await prisma.question.create({
          data: {
            questionSetId: questionSet.id,
            roundId,
            sequence: roundIndex * 6 + q + 1,
            points: 10,
            ...placeholderGrid(q),
          },
        });
      }
    }
  }

  // One judge covering every participant created above.
  const judge = await judgeService.createJudge({ name: "QA Judge" });
  await judgeService.assignJudgeRange(
    competition.id,
    { judgeId: judge.id, fromParticipantNumber: 1, toParticipantNumber: participantNumber },
    null,
  );

  const readiness = await competitionService.checkPublishReadiness(competition.id);
  if (!readiness.ready) {
    console.error("Seed competition is not publish-ready — this is a bug in the seed script:");
    for (const unmet of readiness.unmet) console.error(`  unmet: ${unmet.key}`);
    process.exitCode = 1;
    return;
  }
  const published = await competitionService.publishCompetition(competition.id);

  console.log(`Seeded and published competition ${published.id} (${SEED_NAME}).`);
  console.log("");
  console.log(`Controller login: ${CONTROLLER_USERNAME} / ${PASSWORD}`);
  console.log(`Judge login: ${judge.username} / ${judge.password}`);
  for (const line of playerLines) console.log(line);
  console.log("");
  console.log(`Big-screen URL (open directly, no login): /big-screen/${published.bigScreenLinkToken}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
