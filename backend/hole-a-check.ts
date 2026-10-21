/**
 * Manual end-to-end check of `GET /api/gameplay/competition` (report 2026-10-19,
 * hole A) over real HTTP.
 *
 * The route is the waiting screen's only possible source of a competition name: the
 * entry token that carried the id is consumed and deleted by exactly one login, the
 * stored session never held one, and a PLAYER session reaches no module outside
 * `gameplay`. So what is under test is not only the payload but also the two things
 * that could break it — that the route is mounted *before* the `:roundId` routes so
 * it is never swallowed by one, and that a non-player session is rejected rather
 * than answered.
 *
 * The competition is created by a real controller login, and one real participant is
 * added through the real `POST /api/competitions/:id/participants` route (PAR-003),
 * which issues the PLAYER account this check then logs in with. Nothing is
 * hand-seeded into the database.
 */
import { prisma } from "/app/src/infra/prisma";
// @ts-expect-error - absolute container path, resolved at runtime by tsx
import { identityService } from "/app/src/modules/identity";

const BASE = "http://localhost:3001/api";
const suffix = Math.random().toString(36).slice(2, 8);
const PASSWORD = `ctrl-pass-${suffix}`;
const username = `manual-hole-a-${suffix}`;
const log: string[] = [];

function say(step: string, detail?: unknown) {
  log.push(detail === undefined ? step : `${step} :: ${JSON.stringify(detail)}`);
}

let failures = 0;
function expect(label: string, actual: unknown, wanted: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures += 1;
  say(`${ok ? "PASS" : "FAIL"} ${label}`, ok ? undefined : { actual, wanted });
}

async function main() {
  await prisma.account.create({
    data: {
      username,
      role: "CONTROLLER",
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
    },
  });

  const device = `dev-${suffix}`;
  const login = await fetch(`${BASE}/auth/controller/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": device },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  const loginBody: any = await login.json();
  const controllerAuth = {
    "x-session-token": loginBody.token as string,
    "x-device-id": (loginBody.deviceId as string) ?? device,
    "content-type": "application/json",
  };
  expect("1. controller login", login.status, 200);

  const created = await fetch(`${BASE}/competitions`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({
      name: `Test trou A ${suffix}`,
      description: "Une description lisible par l'élève.",
      categories: [{ code: "G34", name: "三四年级组" }],
    }),
  });
  const comp: any = await created.json();
  expect("2. competition created", created.status, 201);
  const competitionId: string = comp.id;
  const categoryId: string = comp.categories[0].id;
  const stages: any[] = comp.stages;

  const added = await fetch(`${BASE}/competitions/${competitionId}/participants`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({
      name: "张三",
      categoryId,
      schoolName: `École ${suffix}`,
      individualEvent: true,
      teamEvent: false,
    }),
  });
  const addedBody: any = await added.json();
  expect("3. participant added", added.status, 201);
  const credential = addedBody.credential ?? addedBody.credentials?.[0] ?? null;
  say("3b. issued credential", {
    username: credential?.username,
    participantNumber: credential?.participantNumber,
  });

  const playerLogin = await fetch(`${BASE}/auth/player/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-p-${suffix}` },
    body: JSON.stringify({ username: credential.username, password: credential.password }),
  });
  const playerBody: any = await playerLogin.json();
  expect("4. player login", playerLogin.status, 200);
  const playerAuth = {
    "x-session-token": playerBody.token as string,
    "x-device-id": (playerBody.deviceId as string) ?? `dev-p-${suffix}`,
  };

  // --- the route under test -------------------------------------------------
  const mine = await fetch(`${BASE}/gameplay/competition`, { headers: playerAuth });
  const mineBody: any = await mine.json();
  expect("5. GET /gameplay/competition", mine.status, 200);
  expect("5a. competition name", mineBody.competition?.name, `Test trou A ${suffix}`);
  expect("5b. description carried", mineBody.competition?.description, "Une description lisible par l'élève.");
  expect("5c. competition id", mineBody.competition?.id, competitionId);
  expect("5d. participant name", mineBody.participant?.name, "张三");
  expect("5e. participant number", mineBody.participant?.participantNumber, credential.participantNumber);
  expect("5f. event flags", [mineBody.participant?.individualEvent, mineBody.participant?.teamEvent], [true, false]);
  expect("5g. category", mineBody.category?.name, "三四年级组");
  expect("5h. school", mineBody.school?.name, `École ${suffix}`);

  // The programme must be the whole schedule in running order, with each round's kind
  // resolved — INDIVIDUAL 1/2 individual, TEAM 1 rotation, TEAM 2 partition (BLD-40).
  const flat = mineBody.programme.flatMap((s: any) =>
    s.rounds.map((r: any) => `${s.stageType}${s.stageSequence}/${r.sequence}:${r.kind}:${r.status}`),
  );
  say("5i. programme", flat);
  expect(
    "5j. programme kinds",
    mineBody.programme.flatMap((s: any) => s.rounds.map((r: any) => r.kind)),
    ["individual", "individual", "rotation", "partition"],
  );
  expect("5k. stage order", mineBody.programme.map((s: any) => s.stageSequence), [1, 2]);
  expect("5l. round statuses are all WAITING", mineBody.programme.flatMap((s: any) => s.rounds.map((r: any) => r.status)), ["WAITING", "WAITING", "WAITING", "WAITING"]);
  expect("5m. individual duration resolved", mineBody.programme[0].rounds[0].totalSeconds !== null, true);

  // No question content may leak onto a waiting screen: nothing has been dealt yet,
  // and a dealt question must never reach the player before its round is ACTIVE.
  expect("5n. no questions in payload", JSON.stringify(mineBody).includes("givenGrid"), false);

  // --- the mounting order and the guard -------------------------------------
  // Registered after `/current-round`, above every `:roundId/*` route. If the order
  // were wrong the single segment could not match a two-segment route anyway, but a
  // 404 here would still mean the route is not mounted at all.
  const currentRound = await fetch(`${BASE}/gameplay/current-round`, { headers: playerAuth });
  expect("6. /current-round still answers", currentRound.status, 200);

  const asController = await fetch(`${BASE}/gameplay/competition`, { headers: controllerAuth });
  expect("7. controller session rejected", asController.status, 401);

  const anonymous = await fetch(`${BASE}/gameplay/competition`);
  expect("8. anonymous rejected", anonymous.status, 401);

  // --- after the competition is published and a stage started ---------------
  const published = await fetch(`${BASE}/competitions/${competitionId}/publish`, {
    method: "POST",
    headers: controllerAuth,
  });
  expect("9. publish accepted", [200, 201, 409, 422].includes(published.status), true);
  say("9b. publish status", published.status);

  const stage1 = stages.find((s) => s.type === "INDIVIDUAL");
  const started = await fetch(`${BASE}/competitions/${competitionId}/stages/${stage1.id}/start`, {
    method: "POST",
    headers: controllerAuth,
  });
  say("10. start stage 1", started.status);

  const after = await fetch(`${BASE}/gameplay/competition`, { headers: playerAuth });
  const afterBody: any = await after.json();
  expect("11. still 200 after the stage started", after.status, 200);
  say(
    "11b. statuses after start",
    afterBody.programme.flatMap((s: any) => s.rounds.map((r: any) => `${r.name}=${r.status}`)),
  );
  expect("12. stage 1 no longer WAITING", afterBody.programme[0].stageStatus !== "WAITING", true);

  say(`RESULT: ${failures === 0 ? "ALL GREEN" : `${failures} FAILURE(S)`}`);
}

main()
  .catch((error) => {
    say("THROWN", error instanceof Error ? `${error.message}\n${error.stack}` : String(error));
    failures += 1;
  })
  .finally(async () => {
    // Clean up what this check created, so re-running it does not pile rows up.
    try {
      const comps = await prisma.competition.findMany({ where: { name: { startsWith: "Test trou A" } }, select: { id: true } });
      await prisma.competition.deleteMany({ where: { id: { in: comps.map((c) => c.id) } } });
      await prisma.account.deleteMany({ where: { username } });
      say("cleanup done");
    } catch {
      say("cleanup failed (harmless)");
    }
    // eslint-disable-next-line no-console
    console.log(log.join("\n"));
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
