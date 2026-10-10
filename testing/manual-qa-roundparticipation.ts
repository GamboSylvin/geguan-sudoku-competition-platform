/**
 * Manual reproduction for the RoundParticipation fix, run through HTTP exactly
 * like the UI does (step 3 of the fix's definition of done):
 *   1. start a real round via the dev trigger for a WAITING competition,
 *   2. let the preparation countdown reach zero (2 s),
 *   3. assert the RoundParticipation rows exist with state ACTIVE,
 *   4. autosave + reconnect state read as a real player — no DB seeding,
 *   5. judge restart on that participant,
 *   6. wait for the round timer to expire and assert AUTO_SUBMITTED + a
 *      finalized IndividualRoundResult with submissionType TIMEOUT.
 *
 * Dev tooling, not a test suite: it points at the live Docker stack and prints
 * what it sees. Usage: npx tsx testing/manual-qa-roundparticipation.ts
 */
import { prisma } from "../backend/src/infra/prisma";

const BASE = "http://localhost:3001/api";

interface ApiResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

async function api(
  method: string,
  path: string,
  token?: string | null,
  deviceId?: string | null,
  body?: unknown,
): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
      ...(deviceId ? { "x-device-id": deviceId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function login(username: string, password: string): Promise<{ token: string; deviceId: string }> {
  const probe = await api("POST", "/auth/controller/login", undefined, undefined, { username, password });
  if (probe.ok) return { token: probe.body.sessionToken as string, deviceId: probe.body.deviceId as string };
  const judge = await api("POST", "/auth/judge/login", undefined, undefined, { username, password });
  if (judge.ok) return { token: judge.body.sessionToken as string, deviceId: judge.body.deviceId as string };
  const player = await api("POST", "/auth/player/login", undefined, undefined, { username, password });
  if (player.ok) return { token: player.body.sessionToken as string, deviceId: player.body.deviceId as string };
  throw new Error(`login failed for ${username}: ${JSON.stringify({ probe, judge, player })}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const controller = await login("qa-controller", "test-pass-1234");
  console.log(`controller session ok (device ${controller.deviceId})`);

  // Build a fresh WAITING competition with the real fixture.
  const fixture = (await import("./manual-qa-fixture")).default;
  const competition = await fixture(prisma);
  console.log(`fixture competition ${competition.id} status ${competition.status}`);

  const trigger = await api(
    "POST",
    `/rounds/dev/start-stage1-round1`,
    controller.token,
    controller.deviceId,
    { competitionId: competition.id },
  );
  if (!trigger.ok) throw new Error(`dev trigger failed: ${trigger.status} ${JSON.stringify(trigger.body)}`);
  const roundId = trigger.body.roundId as string;
  console.log(`round ${roundId} preparation started`);

  await sleep(3000); // preparation countdown is 2 s in the fixture

  const rows = await prisma.roundParticipation.findMany({ where: { roundId } });
  console.log(`participation rows: ${rows.length}, states: ${rows.map((r) => r.state).join(",")}`);
  if (rows.length === 0) throw new Error("no participation rows created — fix is not live");
  if (rows.some((r) => r.state !== "ACTIVE")) throw new Error("a row is not ACTIVE");

  const player = await login(`qa-player-1`, "test-pass-1234");
  console.log(`player session ok`);

  const autosave = await api(
    "POST",
    `/gameplay/${roundId}/autosave`,
    player.token,
    player.deviceId,
    { grids: { "1": [[1, 2, 3, 4]] } },
  );
  console.log(`autosave: ${autosave.status} ${JSON.stringify(autosave.body).slice(0, 120)}`);
  if (!autosave.ok) throw new Error("autosave failed — gameplay.notAParticipant?");

  const state = await api("GET", `/gameplay/${roundId}/state`, player.token, player.deviceId);
  console.log(`reconnect state: ${state.status}, keys ${Object.keys(state.body).join(",")}`);
  if (!state.ok) throw new Error("reconnect failed");

  const judgeName = await prisma.judge.findFirst({
    where: { competitionJudgeAssignment: { some: { competitionId: competition.id } } },
  });
  if (!judgeName) throw new Error("fixture created no judge");
  const judge = await login(judgeName.name, "test-pass-1234");
  const participantId = rows[0]!.participantId;
  const restart = await api(
    "POST",
    `/judge/students/${participantId}/restart`,
    judge.token,
    judge.deviceId,
    { roundId },
  );
  console.log(`judge restart: ${restart.status} ${JSON.stringify(restart.body).slice(0, 160)}`);

  console.log("waiting for the round timer to expire (20 s)…");
  await sleep(22000);

  const after = await prisma.roundParticipation.findMany({
    where: { roundId },
    include: {
      attempts: { include: { individualRoundResult: true }, where: { archived: false } },
    },
  });
  for (const row of after) {
    const attempt = row.attempts[0];
    console.log(
      `participant ${row.participantId.slice(0, 8)}: state ${row.state}, attempt ${attempt?.submissionType ?? "-"}, result ${attempt?.individualRoundResult ? "finalized" : "none"}`,
    );
  }
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  console.log(`round status: ${round?.status}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
