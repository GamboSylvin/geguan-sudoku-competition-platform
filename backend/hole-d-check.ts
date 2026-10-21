/**
 * Manual end-to-end check of hole D over real HTTP: ONE entry link per competition,
 * serving a player and a judge alike, plus the public name lookup behind it.
 *
 * Nothing is hand-seeded except the controller account (the one thing no HTTP route can
 * bootstrap, same as hole-a-check.ts). Everything else goes through real routes: create
 * the competition, add a real participant (which issues the PLAYER credential), create a
 * real judge (which issues the JUDGE credential), assign that judge to the competition.
 * The entry token is read from the competition's own published links, not invented.
 *
 * What is under test:
 *  - GET /api/auth/entry-link/:token answers { competitionName } and nothing else;
 *  - a PLAYER login and a JUDGE login both accept that same token;
 *  - the token of a DIFFERENT competition is rejected with the one generic message;
 *  - a CONTROLLER's token is ignored, not rejected (ROL-004).
 */
import { prisma } from "/app/src/infra/prisma";
// @ts-expect-error - absolute container path, resolved at runtime by tsx
import { identityService } from "/app/src/modules/identity";

const BASE = "http://localhost:3001/api";
const suffix = Math.random().toString(36).slice(2, 8);
const PASSWORD = `ctrl-pass-${suffix}`;
const username = `manual-hole-d-${suffix}`;
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

  // --- competition A (the one the link points at) ---
  const createdA = await fetch(`${BASE}/competitions`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({
      name: `Trou D cup A ${suffix}`,
      categories: [{ code: "G34", name: "三四年级组" }],
    }),
  });
  const compA: any = await createdA.json();
  expect("2. competition A created", createdA.status, 201);
  const compAId: string = compA.id;
  const catAId: string = compA.categories[0].id;

  // --- a second, unrelated competition B, whose token must be rejected for A's people ---
  const createdB = await fetch(`${BASE}/competitions`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({
      name: `Trou D cup B ${suffix}`,
      categories: [{ code: "G34", name: "三四年级组" }],
    }),
  });
  const compB: any = await createdB.json();
  expect("3. competition B created", createdB.status, 201);

  // The entry token is read from the competition itself, never invented.
  const tokenA: string = compA.entryLinkToken;
  const tokenB: string = compB.entryLinkToken;
  say("3b. tokens", { tokenA: tokenA?.slice(0, 8), tokenB: tokenB?.slice(0, 8) });

  // --- public name lookup, the route that was not loaded before the restart ---
  const nameLookup = await fetch(`${BASE}/auth/entry-link/${encodeURIComponent(tokenA)}`);
  const nameBody = await nameLookup.json();
  expect("4. entry-link names competition A", nameLookup.status, 200);
  expect("4b. it answers the name and NOTHING else", nameBody, {
    competitionName: `Trou D cup A ${suffix}`,
  });

  const unknownLookup = await fetch(`${BASE}/auth/entry-link/not-a-real-token`);
  const unknownBody: any = await unknownLookup.json();
  expect("5. unknown token is 404", unknownLookup.status, 404);
  expect("5b. with auth.entryLinkUnknown", unknownBody.error.code, "auth.entryLinkUnknown");

  // --- a real player, through the real participant route (issues the PLAYER credential) ---
  const added = await fetch(`${BASE}/competitions/${compAId}/participants`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({
      name: "张三",
      categoryId: catAId,
      schoolName: `École ${suffix}`,
      individualEvent: true,
      teamEvent: false,
    }),
  });
  const addedBody: any = await added.json();
  expect("6. participant added", added.status, 201);
  const credential = addedBody.credential ?? addedBody.credentials?.[0] ?? null;

  const playerLogin = await fetch(`${BASE}/auth/player/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-p-${suffix}` },
    body: JSON.stringify({
      username: credential.username,
      password: credential.password,
      entryLinkToken: tokenA,
    }),
  });
  const playerBody: any = await playerLogin.json();
  expect("7. PLAYER login with A's token", playerLogin.status, 200);
  expect("7b. role is PLAYER", playerBody.role, "PLAYER");

  // The same player, sent the WRONG competition's token, must be rejected generically.
  const playerWrong = await fetch(`${BASE}/auth/player/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-pw-${suffix}` },
    body: JSON.stringify({
      username: credential.username,
      password: credential.password,
      entryLinkToken: tokenB,
    }),
  });
  const playerWrongBody: any = await playerWrong.json();
  expect("8. PLAYER login with B's token is 401", playerWrong.status, 401);
  expect("8b. same generic auth.invalidCredentials", playerWrongBody.error.code, "auth.invalidCredentials");

  // --- a real judge, through the real judge routes (create + assign to A) ---
  const judgeCreated = await fetch(`${BASE}/judges`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ name: `Juge ${suffix}` }),
  });
  const judgeBody: any = await judgeCreated.json();
  expect("9. judge created", judgeCreated.status, 201);
  const judgeId: string = judgeBody.judge?.id ?? judgeBody.id;
  const judgeCred = judgeBody.credential ?? {
    username: judgeBody.username,
    password: judgeBody.password,
  };
  say("9b. judge credential", { username: judgeCred?.username });

  const assigned = await fetch(`${BASE}/competitions/${compAId}/judge-assignments`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 1, toParticipantNumber: 10 }),
  });
  expect("10. judge assigned to A", assigned.status, 201);

  const judgeLogin = await fetch(`${BASE}/auth/judge/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-j-${suffix}` },
    body: JSON.stringify({
      username: judgeCred.username,
      password: judgeCred.password,
      entryLinkToken: tokenA,
    }),
  });
  const judgeLoginBody: any = await judgeLogin.json();
  expect("11. JUDGE login with A's token (the same link the player used)", judgeLogin.status, 200);
  expect("11b. role is JUDGE", judgeLoginBody.role, "JUDGE");

  // The same judge, sent B's token (a competition they are NOT assigned to): rejected.
  const judgeWrong = await fetch(`${BASE}/auth/judge/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-jw-${suffix}` },
    body: JSON.stringify({
      username: judgeCred.username,
      password: judgeCred.password,
      entryLinkToken: tokenB,
    }),
  });
  const judgeWrongBody: any = await judgeWrong.json();
  expect("12. JUDGE login with B's token is 401", judgeWrong.status, 401);
  expect("12b. same generic auth.invalidCredentials", judgeWrongBody.error.code, "auth.invalidCredentials");

  // --- a CONTROLLER's token is ignored, not rejected (ROL-004) ---
  const controllerTokenLogin = await fetch(`${BASE}/auth/controller/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-ct-${suffix}` },
    body: JSON.stringify({ username, password: PASSWORD, entryLinkToken: "not-a-real-token" }),
  });
  const controllerTokenBody: any = await controllerTokenLogin.json();
  expect("13. CONTROLLER with a bogus token still logs in", controllerTokenLogin.status, 200);
  expect("13b. role is CONTROLLER", controllerTokenBody.role, "CONTROLLER");

  say(failures === 0 ? "RESULT ALL GREEN" : `RESULT ${failures} FAILURE(S)`);
}

main()
  .catch((error) => {
    say("THROWN", { message: String(error?.message ?? error) });
    failures += 1;
  })
  .finally(async () => {
    await prisma.account.deleteMany({ where: { username } });
    await prisma.$disconnect();
    console.log(log.join("\n"));
    process.exit(failures === 0 ? 0 : 1);
  });
