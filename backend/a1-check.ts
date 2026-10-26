/**
 * Targeted verification of anomaly A1 (and its sibling A1b) from
 * `ANOMALY-REPORT-FULL-SWEEP-2026-10-22.md`.
 *
 * A1: a player polling `GET /api/gameplay/:roundId/state` while the round is still
 * in PREPARATION used to get 403 `gameplay.notAParticipant`, because the
 * participation rows are only created at the PREPARATION -> ACTIVE transition. The
 * frontend swallowed the 403, so the tablet stayed on the waiting screen until a
 * socket tick happened to arrive.
 *
 * What this script proves, over real HTTP against the running stack, in order:
 *   (a) during PREPARATION the state read answers **200** with status PREPARATION,
 *       no questions, no saved grids, a non-null timer and participationState
 *       WAITING;
 *   (b) a player of a *different* competition still gets **403** on that same round
 *       — the widening is scoped, not open;
 *   (c) no `RoundParticipation` row exists while the round is in PREPARATION, and
 *       one exists per active participant once it goes ACTIVE. This is the invariant
 *       the fix must not break: `handleRoundEnded` counts WAITING rows as still
 *       open, so a row created early would stop the competition advancing.
 *   (d) autosave during PREPARATION is still refused (`gameplay.notActive`) —
 *       widening the *read* did not widen the *write*;
 *   (e) when the round expires with nothing submitted, every participation ends in a
 *       terminal state, i.e. `stillOpen === 0`, so the competition can advance.
 *
 * Run: docker exec sudoku-backend sh -lc 'cd /app && npx tsx /app/a1-check.ts'
 */
import { readFileSync } from "node:fs";
// @ts-expect-error container path, resolved at runtime by tsx
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3001/api";
const suffix = Math.random().toString(36).slice(2, 8);
const QUESTIONS = "/tmp/questions-text.xlsx";
const PARTICIPANTS = "/tmp/participants.xlsx";
const PREPARATION_SECONDS = 10;
const DURATION_SECONDS = 25;

const log: string[] = [];
const failures: string[] = [];
let step = 0;
const db = new PrismaClient();

function say(line: string): void {
  log.push(line);
  // eslint-disable-next-line no-console
  console.log(line);
}

function fail(what: string): void {
  failures.push(what);
  say(`      >>> FAIL: ${what.split("\n")[0]}`);
}

/** Assert one property of a response body, recording the real value either way. */
function check(label: string, actual: unknown, predicate: (v: unknown) => boolean, detail: string): void {
  const ok = predicate(actual);
  say(`      ${ok ? "[OK ]" : "[!!!" + "]" + " "} ${label}: ${detail} (actual: ${JSON.stringify(actual) ?? "undefined"})`);
  if (!ok) fail(`${label}\n  expected: ${detail}\n  actual: ${JSON.stringify(actual)}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Headers = Record<string, string>;

async function call(
  label: string,
  path: string,
  init: RequestInit = {},
  expected: number[] = [200],
): Promise<{ status: number; body: any; text: string }> {
  step += 1;
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const ok = expected.includes(res.status);
  const shown = body !== null ? JSON.stringify(body) : text.replace(/\s+/g, " ");
  say(
    `${String(step).padStart(3, " ")}. [${ok ? "OK " : "!!!"}] ${label}\n` +
      `      ${init.method ?? "GET"} ${path} -> ${res.status}\n` +
      `      ${shown.length > 700 ? `${shown.slice(0, 700)}...` : shown}`,
  );
  if (!ok) {
    fail(`${label}\n  request: ${init.method ?? "GET"} ${path}\n  expected: ${expected.join(" | ")}\n  actual: ${res.status}\n  body: ${shown.slice(0, 700)}`);
  }
  return { status: res.status, body, text };
}

async function login(
  role: string,
  username: string,
  password: string,
  entryLinkToken?: string,
): Promise<{ headers: Headers; body: any } | null> {
  step += 1;
  const device = `a1-${role}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;
  const res = await fetch(`${BASE}/auth/${role}/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": device },
    body: JSON.stringify({ username, password, ...(entryLinkToken ? { entryLinkToken } : {}) }),
  });
  const body: any = await res.json().catch(() => null);
  const ok = res.status === 200 && body?.token;
  say(
    `${String(step).padStart(3, " ")}. [${ok ? "OK " : "!!!"}] login ${role} "${username}"${entryLinkToken ? " via entry link" : ""}\n` +
      `      -> ${res.status} ${JSON.stringify(body)?.slice(0, 300)}`,
  );
  if (!ok) {
    fail(`login ${role} "${username}" -> ${res.status} ${JSON.stringify(body)}`);
    return null;
  }
  return {
    headers: {
      "x-session-token": body.token as string,
      "x-device-id": (body.deviceId as string) ?? device,
      "content-type": "application/json",
    },
    body,
  };
}

function multipart(filePath: string): { body: Buffer; contentType: string } {
  const bytes = readFileSync(filePath);
  const boundary = `----a1${suffix}${Math.random().toString(36).slice(2, 8)}`;
  const name = filePath.split("/").pop() ?? "upload.xlsx";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return { body: Buffer.concat([head, bytes, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

type Built = {
  competitionId: string;
  categoryId: string;
  entryToken?: string;
  individualStageId?: string;
  individualRound1Id?: string;
  credentials: { participantId: string; username: string; password: string }[];
};

/**
 * Build one competition all the way to PUBLISHED, with the real participant roster
 * and the real question file imported and 2 questions assigned to individual round 1.
 * Timers are short enough for a script to sit through one full round.
 */
async function buildCompetition(tag: string, ch: Headers): Promise<Built | null> {
  const created = await call(`[${tag}] create competition`, "/competitions", {
    method: "POST",
    headers: ch,
    body: JSON.stringify({
      name: `A1 ${tag} ${suffix}`,
      description: "Targeted A1 verification.",
      categories: [{ code: "G12", name: "一二年级组" }],
    }),
  }, [201]);
  const competitionId: string | undefined = created.body?.id;
  const categoryId: string | undefined = created.body?.categories?.[0]?.id;
  const entryToken: string | undefined = created.body?.entryLinkToken;
  if (!competitionId || !categoryId) return null;

  const rounds: { id: string; kind: string; sequence: number; stageId: string }[] = [];
  for (const stage of created.body?.stages ?? []) {
    for (const r of stage.rounds ?? []) {
      rounds.push({ id: r.id, kind: stage.type, sequence: r.sequence, stageId: stage.id });
    }
  }
  const settingsRecord: Record<string, any> = {};
  for (const r of rounds) {
    settingsRecord[r.id] = {
      durationSeconds: DURATION_SECONDS,
      preparationSeconds: PREPARATION_SECONDS,
      individualQuestionCount: 2,
      teamQuestionCount: 2,
      partitionPuzzleCount: 2,
      partitionTotalTimeSeconds: 300,
      rotationPeriodSeconds: 30,
      teamTotalTimeSeconds: 300,
    };
  }
  await call(`[${tag}] patch round settings`, `/competitions/${competitionId}`, {
    method: "PATCH",
    headers: ch,
    body: JSON.stringify({ roundSettings: settingsRecord }),
  });

  const pi = multipart(PARTICIPANTS);
  const pi1 = await call(`[${tag}] import the real participant roster`, `/competitions/${competitionId}/participants/import`, {
    method: "POST",
    headers: { ...ch, "content-type": pi.contentType },
    body: pi.body,
  });
  const credentials: { participantId: string; username: string; password: string }[] = pi1.body?.credentials ?? [];
  say(`      [${tag}] credentials issued: ${credentials.length} -> ${JSON.stringify(credentials.map((c) => c.username))}`);

  const qi = multipart(QUESTIONS);
  await call(`[${tag}] import the real question file`, `/competitions/${competitionId}/categories/${categoryId}/questions/import`, {
    method: "POST",
    headers: { ...ch, "content-type": qi.contentType },
    body: qi.body,
  });

  const pool = await call(`[${tag}] read the question pool`, `/competitions/${competitionId}/categories/${categoryId}/questions/pool`, { headers: ch });
  const all: any[] = (pool.body?.groups ?? []).flatMap((g: any) => g.questions ?? []);
  say(`      [${tag}] pool: ${all.length} question(s)`);
  if (all.length === 0) {
    fail(`[${tag}] the question pool is empty after a successful import`);
    return null;
  }

  // The publish gate is real and strict: **every** round of **every** category needs
  // its questions assigned, and the judge ranges must cover every participant number.
  // Assign 2 questions per round from this competition's own pool (a question may only
  // belong to one round), then create and assign a judge. Skipping this left the
  // earlier run testing an unpublished competition — a dishonest proof.
  let cursor = 0;
  for (const r of rounds) {
    const slice = all.slice(cursor, cursor + 2).map((q: any) => q.id);
    cursor += 2;
    await call(`[${tag}] select 2 questions for ${r.kind}${r.sequence}`, `/competitions/${competitionId}/categories/${categoryId}/rounds/${r.id}/select-questions`, {
      method: "POST",
      headers: ch,
      body: JSON.stringify({ questionIds: slice }),
    }, [200, 201]);
  }

  const judge = await call(`[${tag}] create a judge`, "/judges", {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ name: `A1 Judge ${tag} ${suffix}` }),
  }, [201]);
  const rosterCount = await db.participant.count({ where: { competitionId, active: true } });
  say(`      [${tag}] active participants in db: ${rosterCount}`);
  await call(`[${tag}] assign the judge range 1-${rosterCount}`, `/competitions/${competitionId}/judge-assignments`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ judgeId: judge.body?.id, fromParticipantNumber: 1, toParticipantNumber: rosterCount }),
  }, [201]);

  const indStageId = rounds.find((r) => r.kind === "INDIVIDUAL")?.stageId;
  const indRound1 = rounds.find((r) => r.kind === "INDIVIDUAL" && r.sequence === 1);
  if (!indStageId || !indRound1) {
    fail(`[${tag}] no individual stage/round in the created competition`);
    return null;
  }

  const published = await call(`[${tag}] publish`, `/competitions/${competitionId}/publish`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({}),
  }, [200, 201]);
  if (published.body?.status !== "WAITING") {
    fail(`[${tag}] publish did not leave the competition in WAITING\n  actual status: ${JSON.stringify(published.body?.status)}`);
    return null;
  }

  return { competitionId, categoryId, entryToken, individualStageId: indStageId, individualRound1Id: indRound1.id, credentials };
}

async function main(): Promise<void> {
  say(`=== A1 TARGETED CHECK ${new Date().toISOString()} (run ${suffix}) ===\n`);

  const ctrl = await login("controller", "controller-test", "test-pass-1234");
  if (!ctrl) return;
  const ch = ctrl.headers;

  const a = await buildCompetition("A", ch);
  if (!a) { say("\n=== stopped: competition A could not be built ==="); return; }
  const b = await buildCompetition("B", ch);
  if (!b) { say("\n=== stopped: competition B could not be built ==="); return; }

  const playerA = await login("player", a.credentials[0].username, a.credentials[0].password, a.entryToken);
  if (!playerA) return;
  const playerB = await login("player", b.credentials[0].username, b.credentials[0].password, b.entryToken);
  if (!playerB) return;

  const roundId = a.individualRound1Id as string;

  // ---- baseline: nothing has started -----------------------------------------
  await call("[A] player A reads the state before anything started (no round is live)", `/gameplay/${roundId}/state`, { headers: playerA.headers }, [403, 404, 409, 422]);
  const before = await db.roundParticipation.count({ where: { roundId } });
  check("(c0) participation rows before the stage starts", before, (v) => v === 0, "0");

  // ---- start the individual stage: the round enters PREPARATION ---------------
  await call("[A] start the individual stage", `/competitions/${a.competitionId}/stages/${a.individualStageId}/start`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({}),
  });

  const cr = await call("[A] player A discovers the current round during PREPARATION", "/gameplay/current-round", { headers: playerA.headers });
  say(`      discovered: ${JSON.stringify(cr.body?.round)}`);
  check("(a0) the discovered round is in PREPARATION", cr.body?.round?.status, (v) => v === "PREPARATION", '"PREPARATION"');

  // ---- (a) the fix: the state read answers during PREPARATION ----------------
  const prep = await call("[A] **player A reads the state during PREPARATION (was 403)**", `/gameplay/${roundId}/state`, { headers: playerA.headers }, [200]);
  if (prep.status === 200) {
    check("(a1) status", prep.body?.status, (v) => v === "PREPARATION", '"PREPARATION"');
    check("(a2) questions are empty", prep.body?.questions?.length, (v) => v === 0, "0");
    check("(a3) savedGrids are empty", prep.body?.savedGrids?.length, (v) => v === 0, "0");
    check("(a4) participationState", prep.body?.participationState, (v) => v === "WAITING", '"WAITING"');
    check("(a5) a countdown timer is carried", prep.body?.timer?.remainingSeconds, (v) => typeof v === "number" && v > 0, "a number > 0");
    check("(a6) the timer total matches the settings", prep.body?.timer?.totalSeconds, (v) => v === PREPARATION_SECONDS, String(PREPARATION_SECONDS));
    check("(a7) no solution leaks", JSON.stringify(prep.body ?? {}).includes('"solution"'), (v) => v === false, "false");
    say(`      state keys: ${JSON.stringify(Object.keys(prep.body ?? {}))}`);
  }

  // ---- (b) the widening is scoped to this competition ------------------------
  const outside = await call("[B] **player of competition B reads competition A's round (must still be 403)**", `/gameplay/${roundId}/state`, { headers: playerB.headers }, [403]);
  check("(b1) the error code is still gameplay.notAParticipant", outside.body?.error?.code, (v) => v === "gameplay.notAParticipant", '"gameplay.notAParticipant"');

  // ---- (c) no row was created by the read ------------------------------------
  const during = await db.roundParticipation.count({ where: { roundId } });
  check("(c1) participation rows created by reading during PREPARATION", during, (v) => v === 0, "0 — a WAITING row here would block handleRoundEnded from advancing");

  // ---- (d) the write path is unchanged ---------------------------------------
  await call("[A] **autosave during PREPARATION (must still be refused)**", `/gameplay/${roundId}/autosave`, {
    method: "POST",
    headers: playerA.headers,
    body: JSON.stringify({ questionId: "00000000-0000-0000-0000-000000000000", grid: [] }),
  }, [400, 403, 409, 422]);
  await call("[A] **submit during PREPARATION (must still be refused)**", `/gameplay/${roundId}/submit`, {
    method: "POST",
    headers: playerA.headers,
    body: JSON.stringify({ submissionType: "MANUAL" }),
  }, [400, 403, 409, 422]);

  // ---- wait for ACTIVE --------------------------------------------------------
  say(`\n      waiting out the ${PREPARATION_SECONDS} s preparation ...`);
  let active: any = null;
  for (let i = 0; i < PREPARATION_SECONDS + 20 && !active; i += 1) {
    await wait(1000);
    const probe = await fetch(`${BASE}/gameplay/current-round`, { headers: playerA.headers });
    const body: any = await probe.json().catch(() => null);
    if (body?.round?.status === "ACTIVE") active = body.round;
  }
  if (!active) {
    fail(`the round never reached ACTIVE within ${PREPARATION_SECONDS + 20} s`);
  } else {
    say(`      round is ACTIVE, timer ${JSON.stringify(active.timer)}`);
    const live = await call("[A] player A reads the state while ACTIVE", `/gameplay/${roundId}/state`, { headers: playerA.headers });
    check("(a8) participationState flipped to ACTIVE", live.body?.participationState, (v) => v === "ACTIVE", '"ACTIVE"');
    check("(a9) the real questions are now dealt", live.body?.questions?.length, (v) => typeof v === "number" && v > 0, "> 0");

    const opened = await db.roundParticipation.count({ where: { roundId } });
    const expectedRows = await db.participant.count({ where: { competitionId: a.competitionId, active: true, individualEvent: true } });
    check("(c2) one participation row per active individual participant, created at the transition", opened, (v) => v === expectedRows && v > 0, `${expectedRows} (> 0)`);
    const waiting = await db.roundParticipation.count({ where: { roundId, state: "WAITING" } });
    check("(c3) those rows are ACTIVE, not left WAITING", waiting, (v) => v === 0, "0");
  }

  // ---- (e) let the round expire and confirm the competition can advance -------
  say(`\n      letting the ${DURATION_SECONDS} s round expire with nothing submitted ...`);
  await wait((DURATION_SECONDS + 12) * 1000);
  const stillOpen = await db.roundParticipation.count({ where: { roundId, state: { in: ["WAITING", "ACTIVE"] } } });
  check("(e1) no participation left open after the round ended", stillOpen, (v) => v === 0, "0 — anything above 0 would stop the competition advancing");
  const row = await db.round.findUnique({ where: { id: roundId }, select: { status: true, earlyEnded: true, startedAt: true, endedAt: true } });
  say(`      round row: ${JSON.stringify(row)}`);
  const after = await call("[A] player A asks for the current round after round 1 ended", "/gameplay/current-round", { headers: playerA.headers });
  say(`      current-round now: ${JSON.stringify(after.body?.round)}`);

  // ---- report -----------------------------------------------------------------
  say(`\n=== ${step} HTTP calls, ${failures.length} failure(s) ===`);
  failures.forEach((f, i) => say(`\nF${i + 1}. ${f}`));
  say(failures.length === 0 ? "\nRESULT: A1 ALL GREEN" : "\nRESULT: A1 NOT GREEN");
  await db.$disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(async (error) => {
  say(`\nFATAL ${String(error)}`);
  await db.$disconnect();
  process.exit(2);
});
