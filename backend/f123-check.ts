/**
 * Manual end-to-end check of F1/F2/F3 over real HTTP and a real WebSocket.
 *
 * Nothing is hand-seeded except the controller account (the one thing no HTTP
 * route can bootstrap, same as hole-a-check.ts / hole-d-check.ts). Everything
 * else goes through real routes: two competitions (A and B), one participant on
 * A (which issues the PLAYER credential), one judge assigned to BOTH A and B
 * (which is exactly the F1 leak: through A's link the judge must see A only).
 *
 * What is under test:
 *  - F1  GET /api/judges/me, logged in through A's entry token, answers ONE
 *        assignment (competition A), never B — the scope comes from the token,
 *        resolved server-side, not from any query string;
 *  - F2  GET /api/judge/students reports the player `connected: true` only after
 *        a real player login, and `connected: false` again after a real logout
 *        (the `clearSession()` → server logout fix);
 *  - F3  a judge socket joined on A's room receives `judge:student-connected`
 *        when the player logs in, carrying ids + name and NO row data.
 */
import { prisma } from "/app/src/infra/prisma";
// @ts-expect-error - absolute container path, resolved at runtime by tsx
import { identityService } from "/app/src/modules/identity";
// @ts-expect-error - installed with --no-save into node_modules for this check only
import { io as ioClient } from "socket.io-client";

const BASE = "http://localhost:3001";
const API = `${BASE}/api`;
const suffix = Math.random().toString(36).slice(2, 8);
const PASSWORD = `ctrl-pass-${suffix}`;
const username = `manual-f123-${suffix}`;
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
function expectTrue(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures += 1;
  say(`${cond ? "PASS" : "FAIL"} ${label}`, cond ? undefined : detail);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const login = await fetch(`${API}/auth/controller/login`, {
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

  // --- competition A (the one the judge/player will use) and B (the one that must NOT leak) ---
  const createdA = await fetch(`${API}/competitions`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ name: `F123 cup A ${suffix}`, categories: [{ code: "G34", name: "三四年级组" }] }),
  });
  const compA: any = await createdA.json();
  expect("2. competition A created", createdA.status, 201);
  const compAId: string = compA.id;
  const catAId: string = compA.categories[0].id;
  const tokenA: string = compA.entryLinkToken;

  const createdB = await fetch(`${API}/competitions`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ name: `F123 cup B ${suffix}`, categories: [{ code: "G34", name: "三四年级组" }] }),
  });
  const compB: any = await createdB.json();
  expect("3. competition B created", createdB.status, 201);
  const compBId: string = compB.id;

  // --- one real participant on A (issues the PLAYER credential) ---
  const added = await fetch(`${API}/competitions/${compAId}/participants`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({
      name: "张三",
      categoryId: catAId,
      schoolName: `School ${suffix}`,
      individualEvent: true,
      teamEvent: false,
    }),
  });
  const addedBody: any = await added.json();
  expect("4. participant added", added.status, 201);
  const credential = addedBody.credential ?? addedBody.credentials?.[0] ?? null;
  const participantId: string = addedBody.participant?.id ?? addedBody.id;

  // --- one judge assigned to BOTH A and B (the exact F1 leak scenario) ---
  const judgeCreated = await fetch(`${API}/judges`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ name: `Judge ${suffix}` }),
  });
  const judgeBody: any = await judgeCreated.json();
  expect("5. judge created", judgeCreated.status, 201);
  const judgeId: string = judgeBody.judge?.id ?? judgeBody.id;
  const judgeCred = judgeBody.credential ?? { username: judgeBody.username, password: judgeBody.password };

  const assignedA = await fetch(`${API}/competitions/${compAId}/judge-assignments`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 1, toParticipantNumber: 10 }),
  });
  expect("6. judge assigned to A", assignedA.status, 201);
  const assignedB = await fetch(`${API}/competitions/${compBId}/judge-assignments`, {
    method: "POST",
    headers: controllerAuth,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 1, toParticipantNumber: 10 }),
  });
  expect("6b. judge assigned to B too (the leak this tests for)", assignedB.status, 201);

  // --- JUDGE logs in through A's token only ---
  const judgeLogin = await fetch(`${API}/auth/judge/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-j-${suffix}` },
    body: JSON.stringify({ username: judgeCred.username, password: judgeCred.password, entryLinkToken: tokenA }),
  });
  const judgeLoginBody: any = await judgeLogin.json();
  expect("7. JUDGE login with A's token", judgeLogin.status, 200);
  const judgeAuth = {
    "x-session-token": judgeLoginBody.token as string,
    "x-device-id": (judgeLoginBody.deviceId as string) ?? `dev-j-${suffix}`,
    "content-type": "application/json",
  };

  // ============ F1: /api/judges/me answers ONE assignment (A), never B ============
  const me = await fetch(`${API}/judges/me`, { headers: judgeAuth });
  const meBody: any = await me.json();
  expect("F1-8. /judges/me is 200", me.status, 200);
  const assignments: any[] = meBody.assignments ?? [];
  expect("F1-9. exactly ONE assignment (was leaking both before the fix)", assignments.length, 1);
  expect("F1-10. the one assignment is competition A", assignments[0]?.competitionId, compAId);
  expectTrue(
    "F1-11. competition B is NOT in the answer",
    !assignments.some((a) => a.competitionId === compBId),
    { assignments },
  );

  // The query string must not widen it: a judge naming B gets nothing, not B.
  const meWiden = await fetch(`${API}/judges/me?competitionId=${compBId}`, { headers: judgeAuth });
  const meWidenBody: any = await meWiden.json();
  const widenAssignments: any[] = meWidenBody.assignments ?? [];
  expectTrue(
    "F1-12. ?competitionId=B does NOT widen the judge's view (invariant 3)",
    !widenAssignments.some((a) => a.competitionId === compBId),
    { widenAssignments },
  );

  // ============ F2: connected is false before login, true after, false after logout ============
  const studentsBefore = await fetch(`${API}/judge/students`, { headers: judgeAuth });
  const beforeBody: any = await studentsBefore.json();
  expect("F2-13. /judge/students is 200", studentsBefore.status, 200);
  const rowBefore = (beforeBody.students ?? []).find((s: any) => s.participantId === participantId);
  expectTrue("F2-14. player is listed", rowBefore !== undefined, { students: beforeBody.students });
  expect("F2-15. player NOT connected before any login", rowBefore?.connected, false);

  // --- F3: open the judge socket on A's room BEFORE the player logs in ---
  const judgeSocket = ioClient(`${BASE}/judge`, {
    auth: { token: judgeLoginBody.token, deviceId: judgeLoginBody.deviceId ?? `dev-j-${suffix}` },
    transports: ["websocket"],
  });
  const connectedEvents: any[] = [];
  const disconnectedEvents: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("judge socket did not connect in 8s")), 8000);
    judgeSocket.on("connect", () => { clearTimeout(t); resolve(); });
    judgeSocket.on("connect_error", (e: any) => { clearTimeout(t); reject(e); });
  });
  say("F3-16. judge socket connected on /judge namespace");
  judgeSocket.on("judge:student-connected", (p: any) => connectedEvents.push(p));
  judgeSocket.on("judge:student-disconnected", (p: any) => disconnectedEvents.push(p));

  // --- real player login through A's token ---
  const playerLogin = await fetch(`${API}/auth/player/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": `dev-p-${suffix}` },
    body: JSON.stringify({ username: credential.username, password: credential.password, entryLinkToken: tokenA }),
  });
  const playerBody: any = await playerLogin.json();
  expect("F2/F3-17. PLAYER login with A's token", playerLogin.status, 200);
  const playerAuth = {
    "x-session-token": playerBody.token as string,
    "x-device-id": (playerBody.deviceId as string) ?? `dev-p-${suffix}`,
    "content-type": "application/json",
  };

  // F2: after login, connected flips to true.
  await sleep(400);
  const studentsAfter = await fetch(`${API}/judge/students`, { headers: judgeAuth });
  const afterBody: any = await studentsAfter.json();
  const rowAfter = (afterBody.students ?? []).find((s: any) => s.participantId === participantId);
  expect("F2-18. player connected=true after a real login", rowAfter?.connected, true);

  // F3: the push arrived on the judge socket, carrying ids+name and NO row data.
  await sleep(400);
  expectTrue("F3-19. judge socket received student-connected", connectedEvents.length >= 1, { connectedEvents });
  const evt = connectedEvents[0] ?? {};
  expect("F3-20. push names competition A", evt.competitionId, compAId);
  expect("F3-21. push names the participant", evt.participantId, participantId);
  expectTrue("F3-22. push carries a participant name", typeof evt.participantName === "string" && evt.participantName.length > 0, { evt });
  expectTrue(
    "F3-23. push carries NO row data (no grid/answers/score)",
    !("givenGrid" in evt) && !("answer" in evt) && !("score" in evt) && !("students" in evt),
    { keys: Object.keys(evt) },
  );

  // F2: a real logout flips connected back to false (the clearSession→server fix).
  const loggedOut = await fetch(`${API}/auth/logout`, { method: "POST", headers: playerAuth });
  expect("F2-24. player logout is 2xx", loggedOut.status >= 200 && loggedOut.status < 300 ? 200 : loggedOut.status, 200);
  await sleep(500);
  const studentsPostLogout = await fetch(`${API}/judge/students`, { headers: judgeAuth });
  const postBody: any = await studentsPostLogout.json();
  const rowPost = (postBody.students ?? []).find((s: any) => s.participantId === participantId);
  expect("F2-25. player connected=false after a real logout", rowPost?.connected, false);
  expectTrue("F3-26. judge socket received student-disconnected", disconnectedEvents.length >= 1, { disconnectedEvents });

  judgeSocket.disconnect();
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
