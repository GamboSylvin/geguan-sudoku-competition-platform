/**
 * Diagnostic: for every judge that actually holds an assignment, what does the
 * judge supervision service return, and does it see the players that are connected
 * right now? Also prints which competitions have connected participants at all.
 */
import { prisma } from "/app/src/infra/prisma";
// @ts-expect-error - absolute container path
import { judgeSupervisionService } from "/app/src/modules/identity/judge-supervision.service";

async function main() {
  const out: string[] = [];

  const assignments = await prisma.competitionJudgeAssignment.findMany({
    select: { judgeId: true, competitionId: true, competition: { select: { name: true } } },
  });
  const judgeIds = [...new Set(assignments.map((a) => a.judgeId))];
  out.push(`judges with an assignment: ${judgeIds.length}`);

  for (const judgeId of judgeIds) {
    const judge = await prisma.judge.findUnique({
      where: { id: judgeId },
      select: { name: true, active: true },
    });
    const rows = await judgeSupervisionService.listStudentsForJudge(judgeId);
    const comps = assignments
      .filter((a) => a.judgeId === judgeId)
      .map((a) => `${a.competition.name}(${a.competitionId.slice(0, 8)})`)
      .join(", ");
    out.push(
      `judge ${judge?.name} (${judgeId.slice(0, 8)}) active=${judge?.active} comps=[${comps}] rows=${rows.length} connected=${rows.filter((r) => r.connected).length}`,
    );
    for (const r of rows.filter((x) => x.connected).slice(0, 5)) {
      out.push(`    CONNECTED #${r.participantNumber} ${r.participantName} comp=${r.competitionId.slice(0, 8)}`);
    }
  }

  out.push("--- competitions that have at least one connected participant ---");
  const connected = await prisma.participant.findMany({
    where: { account: { activeDeviceId: { not: null } } },
    select: {
      participantNumber: true,
      name: true,
      competitionId: true,
      competition: { select: { name: true, status: true } },
    },
  });
  for (const c of connected) {
    out.push(
      `  #${c.participantNumber} ${c.name} comp=${c.competition.name}(${c.competitionId.slice(0, 8)}) status=${c.competition.status}`,
    );
  }
  if (connected.length === 0) out.push("  (none)");

  console.log(out.join("\n"));
}

main()
  .catch((e) => console.log("THROWN", String(e)))
  .finally(async () => {
    await prisma.$disconnect();
  });
