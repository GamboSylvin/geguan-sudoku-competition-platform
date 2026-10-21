import { prisma } from "./src/infra";
import { competitionService } from "./src/modules/competition/competition.service";

async function main() {
  const CID = "ecd88711-0275-4370-b380-e7b42d31265d";
  const anySvc = competitionService as any;
  const fn = anySvc.checkPublishReadiness ?? anySvc.publishReadiness;
  if (typeof fn !== "function") {
    console.log("exports:", Object.keys(anySvc).join(", "));
    return;
  }
  const r = await fn(CID);
  console.log(JSON.stringify(r, null, 1));
}
main().finally(() => prisma.$disconnect());
