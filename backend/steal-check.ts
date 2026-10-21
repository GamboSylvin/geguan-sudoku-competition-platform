import { prisma } from "./src/infra";
import { questionService } from "./src/modules/question/question.service";

const CID = "ecd88711-0275-4370-b380-e7b42d31265d";
const CAT = "7fc2f8b7-3355-4571-aa29-85b108990d8c";
const R1 = "1bbb6542-9d5c-4a96-a584-082d9e560f54";

async function snapshot() {
  const rows = await prisma.question.findMany({
    where: { questionSet: { categoryId: CAT }, roundId: { not: null } },
    select: { id: true, roundId: true, sequence: true },
  });
  return rows;
}

async function restore(before: { id: string; roundId: string | null; sequence: number }[]) {
  await prisma.question.updateMany({
    where: { questionSet: { categoryId: CAT }, roundId: { not: null } },
    data: { roundId: null },
  });
  for (const q of before) {
    await prisma.question.update({ where: { id: q.id }, data: { roundId: q.roundId, sequence: q.sequence } });
  }
}

async function main() {
  const before = await snapshot();
  console.log("BEFORE: r1=" + before.filter(q => q.roundId === R1).length + " assignedTotal=" + before.length);

  const owned = await prisma.question.findMany({
    where: { questionSet: { categoryId: CAT }, roundId: { not: R1, not: null } },
    select: { id: true }, take: 5,
  });
  const free = await prisma.question.findMany({
    where: { questionSet: { categoryId: CAT }, roundId: null },
    select: { id: true }, take: 1,
  });
  const ids = [...owned.map(q => q.id), ...free.map(q => q.id)];
  console.log("attempt: " + ids.length + " ids, " + owned.length + " of them owned by round 2");

  try {
    await questionService.selectRoundQuestions({ competitionId: CID, categoryId: CAT, roundId: R1, questionIds: ids });
    console.log("RESULT: ACCEPTED <-- steal still possible");
  } catch (e: any) {
    const code = e?.details?.code ?? e?.code ?? "(none)";
    console.log("RESULT: REFUSED code=" + code + " msg=" + (e?.message ?? ""));
  }

  const after = await snapshot();
  const same = JSON.stringify(before) === JSON.stringify(after);
  console.log("AFTER: r1=" + after.filter(q => q.roundId === R1).length + " unchanged=" + same);
  if (!same) { await restore(before); console.log("restored original state"); }
}
main().finally(() => prisma.$disconnect());
