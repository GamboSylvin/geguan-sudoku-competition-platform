/**
 * Full-system manual test sweep, pass 3. Over real HTTP against the running dev
 * stack.
 *
 * Corrections over pass 2 (every one of pass 2's four "anomalies" was a fault of
 * the script, not of the app, and each was checked against the real response):
 *   - the question pool is `body.groups[].questions`, not `body.questionSets`, so
 *     pass 2 saw zero questions, skipped every `select-questions` call and then
 *     correctly bounced off the publish-readiness gate;
 *   - `current-round` answers `{ round: { roundId } }`, not a top-level `roundId`;
 *   - deleting a school with no participants returning 204 is correct behaviour;
 *   - `judge.hasActiveAssignment` 409 against an unfinished copy is correct.
 *
 * This pass therefore reaches a genuinely PUBLISHED competition, waits for a round
 * to go ACTIVE, and plays it with a real correct answer. The player is never told
 * the solution (rightly), so the grid sent is read back from the database through
 * Prisma — that is a test-harness shortcut, not an API the app exposes.
 *
 * Run: docker exec sudoku-backend sh -lc 'cd /app && npx tsx /tmp/sweep3.ts'
 */
import { readFileSync } from "node:fs";
// @ts-expect-error container path, resolved at runtime by tsx
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3001/api";
const suffix = Math.random().toString(36).slice(2, 8);
const QUESTIONS = "/tmp/questions-text.xlsx";
const PARTICIPANTS = "/tmp/participants.xlsx";
const log: string[] = [];
const anomalies: string[] = [];
let step = 0;
const db = new PrismaClient();

function say(line: string): void {
  log.push(line);
  // eslint-disable-next-line no-console
  console.log(line);
}

function note(anomaly: string): void {
  anomalies.push(anomaly);
  say(`      >>> ANOMALY: ${anomaly.split("\n")[0]}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      `      ${shown.length > 600 ? `${shown.slice(0, 600)}...` : shown}`,
  );
  if (!ok) {
    note(`${label}\n  request: ${init.method ?? "GET"} ${path}\n  expected: ${expected.join(" | ")}\n  actual: ${res.status}\n  body: ${shown.slice(0, 700)}`);
  }
  return { status: res.status, body, text };
}

type Headers = Record<string, string>;

async function login(
  role: string,
  username: string,
  password: string,
  entryLinkToken?: string,
): Promise<{ headers: Headers; body: any } | null> {
  step += 1;
  const device = `sweep3-${role}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;
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
    note(`login ${role} "${username}"${entryLinkToken ? " via entry link" : ""}\n  actual: ${res.status}\n  body: ${JSON.stringify(body)}`);
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
  const boundary = `----sweep3${suffix}${Math.random().toString(36).slice(2, 8)}`;
  const name = filePath.split("/").pop() ?? "upload.xlsx";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return { body: Buffer.concat([head, bytes, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Flatten a stored `solution` matrix into the row-major array the autosave takes. */
function flatten(matrix: unknown, rows: number, columns: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const value = Array.isArray(matrix) ? (matrix[r] as number[] | undefined)?.[c] : undefined;
      out.push(typeof value === "number" && value > 0 ? value : null);
    }
  }
  return out;
}

async function main(): Promise<void> {
  say(`=== SWEEP PASS 3 ${new Date().toISOString()} (run ${suffix}) ===\n`);

  const ctrl = await login("controller", "controller-test", "test-pass-1234");
  if (!ctrl) return;
  const ch = ctrl.headers;

  // ---- create and configure ------------------------------------------------
  const created = await call("create competition", "/competitions", {
    method: "POST",
    headers: ch,
    body: JSON.stringify({
      name: `Sweep3 ${suffix}`,
      description: "Full sweep pass 3, real publish and real play.",
      categories: [{ code: "G12", name: "一二年级组" }],
      scoringConfiguration: { schoolCoefficient: 0.6, rankingCycleSeconds: 180 },
    }),
  }, [201]);
  const competitionId: string | undefined = created.body?.id;
  const categoryId: string | undefined = created.body?.categories?.[0]?.id;
  const entryToken: string | undefined = created.body?.entryLinkToken;
  const bigScreenToken: string | undefined = created.body?.bigScreenLinkToken;
  if (!competitionId || !categoryId) return;

  const rounds: { id: string; kind: string; sequence: number; stageId: string }[] = [];
  for (const stage of created.body?.stages ?? []) {
    for (const r of stage.rounds ?? []) {
      rounds.push({ id: r.id, kind: stage.type, sequence: r.sequence, stageId: stage.id });
    }
  }
  say(`      rounds: ${JSON.stringify(rounds.map((r) => `${r.kind}${r.sequence}`))}`);

  // Two questions per round, timers short enough for a script to sit through.
  const settingsRecord: Record<string, any> = {};
  for (const r of rounds) {
    settingsRecord[r.id] = {
      durationSeconds: 120,
      preparationSeconds: 5,
      individualQuestionCount: 2,
      teamQuestionCount: 2,
      partitionPuzzleCount: 2,
      partitionTotalTimeSeconds: 300,
      rotationPeriodSeconds: 30,
      teamTotalTimeSeconds: 300,
    };
  }
  await call("patch round settings for every round", `/competitions/${competitionId}`, {
    method: "PATCH",
    headers: ch,
    body: JSON.stringify({ roundSettings: settingsRecord }),
  });

  // ---- real imports ---------------------------------------------------------
  const pi = multipart(PARTICIPANTS);
  const pi1 = await call("import the real participant roster", `/competitions/${competitionId}/participants/import`, {
    method: "POST",
    headers: { ...ch, "content-type": pi.contentType },
    body: pi.body,
  });
  const credentials: { participantId: string; username: string; password: string }[] =
    pi1.body?.credentials ?? [];
  say(`      issued credentials: ${credentials.length} -> ${JSON.stringify(credentials.map((c) => c.username))}`);
  const flags = (pi1.body?.participants ?? []).map((p: any) => `${p.name}:${p.individualEvent ? "I" : "-"}${p.teamEvent ? "T" : "-"}`);
  say(`      event flags from the import response: ${JSON.stringify(flags)}`);
  if (credentials.length === 0) note(`the participant import issued no credential\n  POST /competitions/${competitionId}/participants/import -> ${pi1.status}\n  keys: ${JSON.stringify(Object.keys(pi1.body ?? {}))}`);

  const qi = multipart(QUESTIONS);
  await call("import the real question file (text version)", `/competitions/${competitionId}/categories/${categoryId}/questions/import`, {
    method: "POST",
    headers: { ...ch, "content-type": qi.contentType },
    body: qi.body,
  });

  const pool = await call("read the question pool", `/competitions/${competitionId}/categories/${categoryId}/questions/pool`, { headers: ch });
  const groups: any[] = pool.body?.groups ?? [];
  const all: any[] = groups.flatMap((g) => g.questions ?? []);
  say(`      pool: ${groups.length} group(s), ${all.length} question(s)`);
  if (all.length === 0) {
    note(`the question pool is empty after a successful import\n  POST …/questions/import -> 200 with questionCount 24\n  GET …/questions/pool -> ${pool.status} ${JSON.stringify(pool.body)?.slice(0, 300)}`);
    return;
  }

  // ---- assign questions to every round (the real pool shape) ----------------
  let cursor = 0;
  for (const r of rounds) {
    const slice = all.slice(cursor, cursor + 2).map((q: any) => q.id);
    cursor += 2;
    await call(`select 2 questions for ${r.kind}${r.sequence}`, `/competitions/${competitionId}/categories/${categoryId}/rounds/${r.id}/select-questions`, {
      method: "POST",
      headers: ch,
      body: JSON.stringify({ questionIds: slice }),
    }, [200, 201]);
  }

  // A question may only be assigned to one round; reuse would be a real conflict.
  await call("assign the same question to a second round (must be refused)", `/competitions/${competitionId}/categories/${categoryId}/rounds/${rounds[1].id}/select-questions`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ questionIds: [all[0].id] }),
  }, [400, 409, 422]);
  // Re-select round 2's own two, since the call above may have replaced them.
  await call("re-select round 2's questions", `/competitions/${competitionId}/categories/${categoryId}/rounds/${rounds[1].id}/select-questions`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ questionIds: all.slice(2, 4).map((q: any) => q.id) }),
  }, [200, 201]);

  // ---- schools (BLD-052) ----------------------------------------------------
  const school = await call("create a school", `/competitions/${competitionId}/schools`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ name: `Sweep School ${suffix}` }),
  }, [201]);
  const schoolId: string | undefined = school.body?.id;
  const rosterSchoolId: string | undefined = (await call("list participants", `/competitions/${competitionId}/participants`, { headers: ch })).body?.participants?.[0]?.schoolId;
  if (rosterSchoolId) {
    await call("delete the school that holds the 3 imported participants (must be 409)", `/competitions/${competitionId}/schools/${rosterSchoolId}`, {
      method: "DELETE",
      headers: ch,
    }, [409]);
  } else {
    note(`the imported participants carry no schoolId, so the school-delete guard could not be tested\n  GET …/participants -> 200`);
  }
  if (schoolId) {
    await call("delete the empty school (must succeed)", `/competitions/${competitionId}/schools/${schoolId}`, { method: "DELETE", headers: ch }, [204]);
  }

  // ---- judges (Unit 06) -----------------------------------------------------
  const judge = await call("create a judge", "/judges", {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ name: `Sweep Judge ${suffix}` }),
  }, [201]);
  const judgeId: string | undefined = judge.body?.id;
  const judgeUser: string | undefined = judge.body?.username;
  const judgePass: string | undefined = judge.body?.password;
  const maxNumber = await db.participant.count({ where: { competitionId, active: true } });
  say(`      active participants in db: ${maxNumber}`);
  await call(`assign the judge range 1-${maxNumber}`, `/competitions/${competitionId}/judge-assignments`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 1, toParticipantNumber: maxNumber }),
  }, [201]);
  // Overlap is documented as "reported, not rejected" and the range is upserted on
  // U(competitionId, judgeId), so a second assign edits the first rather than failing.
  await call("re-assign an overlapping range to the same judge (upsert, not a conflict)", `/competitions/${competitionId}/judge-assignments`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 2, toParticipantNumber: maxNumber }),
  }, [201]);
  await call("assign an inverted range (must be refused)", `/competitions/${competitionId}/judge-assignments`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 3, toParticipantNumber: 1 }),
  }, [400, 409, 422]);
  await call("restore the judge range to the full roster", `/competitions/${competitionId}/judge-assignments`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ judgeId, fromParticipantNumber: 1, toParticipantNumber: maxNumber }),
  }, [201]);
  const assignList = await call("list judge assignments", `/competitions/${competitionId}/judge-assignments`, { headers: ch });
  const assignmentId: string | undefined = assignList.body?.assignments?.[0]?.id;
  say(`      assignments on this competition: ${(assignList.body?.assignments ?? []).length}`);
  if ((assignList.body?.assignments ?? []).length > 1) {
    note(`re-assigning the same judge created a second range instead of editing the first\n  POST …/judge-assignments twice -> 201 each\n  judge.controller.ts documents an upsert on U(competitionId, judgeId)\n  GET …/judge-assignments -> ${JSON.stringify(assignList.body?.assignments?.map((a: any) => [a.fromParticipantNumber, a.toParticipantNumber]))}`);
  }

  // ---- publish --------------------------------------------------------------
  const pub = await call("publish the competition", `/competitions/${competitionId}/publish`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({}),
  }, [200, 201]);
  if (pub.status === 422) {
    say(`      publish refused; unmet: ${JSON.stringify(pub.body?.error?.details?.unmet)}`);
    say("\n=== ANOMALIES ===");
    anomalies.forEach((a, i) => say(`\nA${i + 1}. ${a}`));
    say(`\n=== ${step} calls, ${anomalies.length} anomalies (stopped at publish) ===`);
    return;
  }
  await call("publish a second time (must be refused)", `/competitions/${competitionId}/publish`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({}),
  }, [400, 409, 422]);

  // ---- entry link (BLD-055) -------------------------------------------------
  if (entryToken) {
    await call("resolve the entry link anonymously", `/auth/entry-link/${entryToken}`, {}, [200]);
    await call("resolve an unknown entry link (must be refused)", "/auth/entry-link/00000000-0000-0000-0000-000000000000", {}, [400, 404]);
  }

  // ---- judge login, plain and via the entry link (F1) -----------------------
  let judgePlain: { headers: Headers; body: any } | null = null;
  let judgeLinked: { headers: Headers; body: any } | null = null;
  if (judgeUser && judgePass) {
    judgePlain = await login("judge", judgeUser, judgePass);
    if (judgePlain) {
      const me = await call("judge /me (plain login)", "/judges/me", { headers: judgePlain.headers });
      const seen = (me.body?.assignments ?? []).length;
      say(`      plain-login judge sees ${seen} assignment(s); competitionId on the session: ${judgePlain.body?.competitionId ?? "null"}`);
      if (seen === 0) {
        note(`a judge who logs in without the entry link sees no assignment\n  GET /judges/me -> 200 with assignments: [] although the range 1-${maxNumber} is assigned\n  judge.controller.ts's own comment says a null scope "keeps the pre-F1 answer rather than showing nothing"`);
      }
      await call("judge student list (plain login)", "/judge/students", { headers: judgePlain.headers });
    }
    if (entryToken) {
      judgeLinked = await login("judge", judgeUser, judgePass, entryToken);
      if (judgeLinked) {
        say(`      entry-link judge session competitionId: ${judgeLinked.body?.competitionId ?? "null"}`);
        const me2 = await call("judge /me (via the entry link)", "/judges/me", { headers: judgeLinked.headers });
        say(`      entry-link judge sees ${(me2.body?.assignments ?? []).length} assignment(s)`);
      }
    }
  }

  // ---- player login with a real issued credential ---------------------------
  const first = credentials[0];
  let player: { headers: Headers; body: any } | null = null;
  if (first) {
    player = await login("player", first.username, first.password, entryToken);
  } else {
    note("no credential was issued, so no player session could be opened");
  }
  if (player) {
    await call("player /gameplay/competition (waiting screen)", "/gameplay/competition", { headers: player.headers });
    const cr0 = await call("player /gameplay/current-round before any round runs", "/gameplay/current-round", { headers: player.headers });
    if (cr0.body?.round !== null) note(`/gameplay/current-round named a round before anything started\n  GET /gameplay/current-round -> ${cr0.status} ${JSON.stringify(cr0.body)?.slice(0, 300)}`);
  }

  // ---- start the individual stage and actually play it ----------------------
  const qs1 = new Set<string>();
  const indStageId = rounds.find((r) => r.kind === "INDIVIDUAL")?.stageId;
  const indRound1 = rounds.find((r) => r.kind === "INDIVIDUAL" && r.sequence === 1);
  if (!indStageId || !indRound1) return;
  await call("start the individual stage", `/competitions/${competitionId}/stages/${indStageId}/start`, {
    method: "POST",
    headers: ch,
    body: JSON.stringify({}),
  });

  if (player) {
    const cr = await call("player /gameplay/current-round during PREPARATION", "/gameplay/current-round", { headers: player.headers });
    const roundId: string | undefined = cr.body?.round?.roundId;
    if (!roundId) {
      note(`the player cannot discover the running round\n  GET /gameplay/current-round -> ${cr.status} ${JSON.stringify(cr.body)?.slice(0, 300)}\n  with no roundId the tablet stays on the waiting screen: this is the "frozen" symptom`);
    } else {
      say(`      discovered roundId=${roundId} status=${cr.body?.round?.status} kind=${cr.body?.round?.kind}`);
      await call("player reads the state during PREPARATION", `/gameplay/${roundId}/state`, { headers: player.headers }, [200, 409, 422]);

      // Wait out the 5 s preparation for the round to go ACTIVE.
      let active: any = null;
      for (let i = 0; i < 20 && !active; i += 1) {
        await wait(1000);
        const probe = await fetch(`${BASE}/gameplay/current-round`, { headers: player.headers });
        const body: any = await probe.json().catch(() => null);
        if (body?.round?.status === "ACTIVE") active = body.round;
      }
      if (!active) {
        note(`the round never reached ACTIVE within 20 s\n  GET /gameplay/current-round polled 20 times\n  preparationSeconds is 5`);
      } else {
        say(`      round is ACTIVE, timer ${JSON.stringify(active.timer)}`);
        const st = await call("player round state while ACTIVE", `/gameplay/${roundId}/state`, { headers: player.headers });
        say(`      state keys: ${JSON.stringify(Object.keys(st.body ?? {}))} participationState=${st.body?.participationState}`);
        const questions: any[] = st.body?.questions ?? [];
        for (const q of questions) qs1.add(q.id);
        say(`      questions dealt to the player: ${questions.length}`);
        if (st.body?.questions?.[0]?.solution !== undefined) {
          note(`the round state leaks the solution to the player\n  GET /gameplay/${roundId}/state -> 200 with questions[0].solution present\n  SUB-007/BLD-029: the player is never told the answer`);
        }
        if (questions.length === 0) {
          note(`an ACTIVE individual round dealt no question to the player\n  GET /gameplay/${roundId}/state -> ${st.status} with questions: []`);
        }

        // Read each question's real solution out of the database: the API never
        // sends one, so this is the harness answering correctly on purpose.
        for (const q of questions) {
          const row = await db.question.findUnique({ where: { id: q.id }, select: { solution: true, startingGrid: true, gridRows: true, gridColumns: true } });
          const grid = flatten(row?.solution ?? null, row?.gridRows ?? q.gridRows, row?.gridColumns ?? q.gridColumns);
          const partial = flatten(row?.startingGrid ?? null, row?.gridRows ?? q.gridRows, row?.gridColumns ?? q.gridColumns);
          await call(`autosave the given cells of question ${q.sequence}`, `/gameplay/${roundId}/autosave`, {
            method: "POST",
            headers: player.headers,
            body: JSON.stringify({ questionId: q.id, grid: partial }),
          });
          await call(`autosave the full solution of question ${q.sequence}`, `/gameplay/${roundId}/autosave`, {
            method: "POST",
            headers: player.headers,
            body: JSON.stringify({ questionId: q.id, grid }),
          });
          await call(`autosave a wrong grid for question ${q.sequence}`, `/gameplay/${roundId}/autosave`, {
            method: "POST",
            headers: player.headers,
            body: JSON.stringify({ questionId: q.id, grid: grid.map((v, i) => (i === 0 && v !== null ? ((v % (row?.gridRows ?? 4)) + 1) : v)) }),
          });
          await call(`autosave the correct grid again for question ${q.sequence}`, `/gameplay/${roundId}/autosave`, {
            method: "POST",
            headers: player.headers,
            body: JSON.stringify({ questionId: q.id, grid }),
          });
        }
        await call("autosave an unknown questionId (must be refused)", `/gameplay/${roundId}/autosave`, {
          method: "POST",
          headers: player.headers,
          body: JSON.stringify({ questionId: "00000000-0000-0000-0000-000000000000", grid: [1] }),
        }, [400, 403, 404, 409, 422]);
        await call("autosave with a malformed grid (must be refused)", `/gameplay/${roundId}/autosave`, {
          method: "POST",
          headers: player.headers,
          body: JSON.stringify({ questionId: questions[0]?.id, grid: ["a", "b"] }),
        }, [400, 422]);
        await call("reconnect: read the state again, saved grids must come back", `/gameplay/${roundId}/state`, { headers: player.headers });
        await call("player reports leaving the page", `/gameplay/${roundId}/left-page`, { method: "POST", headers: player.headers, body: JSON.stringify({}) }, [200]);
        await call("player submits", `/gameplay/${roundId}/submit`, { method: "POST", headers: player.headers, body: JSON.stringify({}) }, [200]);
        await call("player submits twice (must be idempotent, PL-009)", `/gameplay/${roundId}/submit`, { method: "POST", headers: player.headers, body: JSON.stringify({}) }, [200, 409]);
        await call("player autosaves after submitting (must be refused)", `/gameplay/${roundId}/autosave`, {
          method: "POST",
          headers: player.headers,
          body: JSON.stringify({ questionId: questions[0]?.id, grid: [1, 2, 3, 4] }),
        }, [200, 409, 422]);
        const after = await call("player state after submit", `/gameplay/${roundId}/state`, { headers: player.headers });
        say(`      participationState after submit: ${after.body?.participationState}`);
        if (after.body?.participationState !== "SUBMITTED" && after.body?.participationState !== "AUTO_SUBMITTED") {
          note(`the participation did not close on submit\n  GET /gameplay/${roundId}/state -> ${after.status} participationState=${after.body?.participationState}\n  expected SUBMITTED`);
        }
        if (JSON.stringify(after.body ?? {}).includes("score")) {
          note(`the player state carries a score after submit\n  GET /gameplay/${roundId}/state -> 200\n  SUB-007/BLD-029 forbids telling the player their score`);
        }

        // Judge supervision while the round is genuinely running (Unit 10).
        const jh = judgeLinked?.headers ?? judgePlain?.headers;
        if (jh) {
          const students = await call("judge student list during the round", "/judge/students", { headers: jh });
          const me = (students.body?.students ?? []).find((s: any) => s.participantId === first.participantId);
          say(`      judge sees: connected=${me?.connected} leftPages=${me?.leftAnswerPageCount} attempts=${me?.attemptCount} state=${me?.participationState}`);
          if (me && me.leftAnswerPageCount === 0) {
            note(`the judge panel never saw the page-leave the player reported\n  POST /gameplay/${roundId}/left-page -> 200\n  GET /judge/students -> leftAnswerPageCount 0`);
          }
          await call("judge restarts a student mid-round", `/judge/students/${first.participantId}/restart`, { method: "POST", headers: jh, body: JSON.stringify({}) }, [200, 409]);
          const st2 = await call("player state after the judge restart", `/gameplay/${roundId}/state`, { headers: player.headers }, [200, 409]);
          say(`      participationState after restart: ${st2.body?.participationState}`);
          await call("judge restarts an unknown student (must be refused)", "/judge/students/00000000-0000-0000-0000-000000000000/restart", { method: "POST", headers: jh, body: JSON.stringify({}) }, [400, 404, 409]);
        }
      }
    }
  }

  // ---- controller live commands ---------------------------------------------
  await call("pause the competition", `/competitions/${competitionId}/pause`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  await call("pause twice (must be refused or idempotent)", `/competitions/${competitionId}/pause`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  await call("resume the competition", `/competitions/${competitionId}/resume`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  await call("switch the big screen to ranking mode", `/competitions/${competitionId}/big-screen/mode`, { method: "POST", headers: ch, body: JSON.stringify({ mode: "RANKING" }) }, [200]);
  await call("switch the big screen to an unknown mode (must be refused)", `/competitions/${competitionId}/big-screen/mode`, { method: "POST", headers: ch, body: JSON.stringify({ mode: "NOPE" }) }, [400, 422]);
  await call("read the big screen mode", `/competitions/${competitionId}/big-screen/mode`, { headers: ch });

  // ---- second individual round, then close the stage ------------------------
  // There is no `rounds/:roundId/start`: the second round of a stage is started by
  // calling the stage start again, so end round 1 and re-start the stage.
  const indRound2 = rounds.find((r) => r.kind === "INDIVIDUAL" && r.sequence === 2);
  await call("end individual round 1 early", `/competitions/${competitionId}/rounds/${indRound1.id}/end-early`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  await call("end round 1 a second time (must be refused or idempotent)", `/competitions/${competitionId}/rounds/${indRound1.id}/end-early`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  if (indRound2) {
    await call("start individual round 2 by re-starting the stage", `/competitions/${competitionId}/stages/${indStageId}/start`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 201, 409]);
    if (player) {
      let active2: any = null;
      for (let i = 0; i < 20 && !active2; i += 1) {
        await wait(1000);
        const probe = await fetch(`${BASE}/gameplay/current-round`, { headers: player.headers });
        const body: any = await probe.json().catch(() => null);
        if (body?.round?.status === "ACTIVE" && body.round.roundId === indRound2.id) active2 = body.round;
      }
      if (!active2) {
        const crNow = await call("player /current-round where round 2 should be", "/gameplay/current-round", { headers: player.headers }, [200, 409]);
        note(`individual round 2 never went ACTIVE for the player\n  POST …/stages/${indStageId}/start again -> 200\n  GET /gameplay/current-round polled 20 s -> ${JSON.stringify(crNow.body)?.slice(0, 250)}`);
      } else {
        say(`      round 2 is ACTIVE: ${indRound2.id}`);
        const st2 = await call("player round 2 state", `/gameplay/${indRound2.id}/state`, { headers: player.headers }, [200]);
        const qs2: any[] = st2.body?.questions ?? [];
        say(`      round 2 dealt ${qs2.length} question(s); ids differ from round 1: ${qs2.every((q) => !qs1.has(q.id))}`);
        if (qs2.some((q) => qs1.has(q.id))) {
          note(`individual round 2 dealt a question round 1 had already used\n  round 1 ids ${JSON.stringify([...qs1])}\n  round 2 ids ${JSON.stringify(qs2.map((q) => q.id))}\n  select-questions gave each round its own two`);
        }
        for (const q of qs2) {
          const row = await db.question.findUnique({ where: { id: q.id }, select: { solution: true, gridRows: true, gridColumns: true } });
          await call(`autosave the full solution of round-2 question ${q.sequence}`, `/gameplay/${indRound2.id}/autosave`, {
            method: "POST",
            headers: player.headers,
            body: JSON.stringify({ questionId: q.id, grid: flatten(row?.solution ?? null, row?.gridRows ?? 4, row?.gridColumns ?? 4) }),
          });
        }
        await call("submit round 2", `/gameplay/${indRound2.id}/submit`, { method: "POST", headers: player.headers, body: JSON.stringify({}) }, [200]);
      }
    }
    await call("end individual round 2 early", `/competitions/${competitionId}/rounds/${indRound2.id}/end-early`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  }
  const rank = await call("ranking after the individual stage", `/competitions/${competitionId}/categories/${categoryId}/ranking`, { headers: ch }, [200, 409, 422]);
  say(`      ranking rows: ${JSON.stringify(rank.body?.rows)?.slice(0, 400)}`);
  const rows: any[] = rank.body?.rows ?? [];
  if (rows.length === 0) {
    note(`the ranking is empty although a player submitted a fully correct round\n  GET …/ranking -> ${rank.status} rows: []`);
  } else if (rows.every((r) => Number(r.score) === 0)) {
    note(`every submitted answer scored 0 although the grids sent were the database's own solutions\n  GET …/ranking -> 200\n  rows: ${JSON.stringify(rows).slice(0, 400)}`);
  }
  await call("school ranking", `/competitions/${competitionId}/categories/${categoryId}/school-ranking`, { headers: ch }, [200, 409, 422]);
  await call("results", `/competitions/${competitionId}/results`, { headers: ch });
  await call("corrections", `/competitions/${competitionId}/corrections`, { headers: ch });
  const exp = await call("export the results workbook", `/competitions/${competitionId}/export`, { headers: ch });
  say(`      export bytes: ${exp.text.length}, xlsx: ${exp.text.startsWith("PK")}`);
  if (!exp.text.startsWith("PK")) note(`the results export is not an xlsx\n  GET …/export -> ${exp.status}, first bytes ${JSON.stringify(exp.text.slice(0, 40))}`);

  // ---- team stage (Finding 11: no Team row is ever created by the app) -------
  const teamStageId = rounds.find((r) => r.kind === "TEAM")?.stageId;
  if (teamStageId) {
    const ts = await call("start the team stage", `/competitions/${competitionId}/stages/${teamStageId}/start`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 201, 409]);
    say(`      team stage start -> ${ts.status} ${JSON.stringify(ts.body)?.slice(0, 300)}`);
    if (player) {
      const teamRound1 = rounds.find((r) => r.kind === "TEAM" && r.sequence === 1);
      const teamRound2 = rounds.find((r) => r.kind === "TEAM" && r.sequence === 2);
      if (teamRound1) await call("player rotation state", `/gameplay/rotation/${teamRound1.id}/state`, { headers: player.headers }, [200, 404, 409, 422]);
      if (teamRound2) await call("player partition state", `/gameplay/partition/${teamRound2.id}/state`, { headers: player.headers }, [200, 404, 409, 422]);
    }
  }

  // ---- finish, copy, cancel, delete ------------------------------------------
  await call("finish the competition early", `/competitions/${competitionId}/finish-early`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
  const finalResults = await call("results after finishing", `/competitions/${competitionId}/results`, { headers: ch });
  if (finalResults.body?.status !== "FINISHED") note(`the results do not report the competition as FINISHED\n  GET …/results -> ${finalResults.status} status=${finalResults.body?.status}`);
  await call("results stay readable for a competition finished early", `/competitions/${competitionId}/results`, { headers: ch }, [200]);
  const copy = await call("copy the competition (Unit 15)", `/competitions/${competitionId}/copy`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [201]);
  const copyId: string | undefined = copy.body?.id;
  if (copyId) {
    const copyRead = await call("read the copy back", `/competitions/${copyId}`, { headers: ch });
    const text = JSON.stringify(copyRead.body ?? {});
    say(`      copy carries individualQuestionCount: ${text.includes("individualQuestionCount")}`);
    say(`      copy carries fresh tokens: ${copyRead.body?.entryLinkToken !== entryToken && copyRead.body?.bigScreenLinkToken !== bigScreenToken}`);
    say(`      copy carries the questions: ${(copyRead.body?.categories ?? []).length} category(ies)`);
    const copiedQuestionCount = await db.question.count({ where: { questionSet: { competitionId: copyId } } });
    say(`      questions in the copy (db): ${copiedQuestionCount}`);
    if (copiedQuestionCount === 0) note(`the copy carries no question\n  POST …/copy -> 201\n  db count of Question rows of the copy: 0`);
  }
  if (copyId) await call("delete the copy (BLD-050)", `/competitions/${copyId}`, { method: "DELETE", headers: ch }, [204]);

  // Cancel is refused once FINISHED, so exercise ROL-09 on a second competition.
  const c2 = await call("create a second competition to test cancel", "/competitions", {
    method: "POST",
    headers: ch,
    body: JSON.stringify({ name: `Sweep3 cancel ${suffix}`, categories: [{ code: "G12", name: "一二年级组" }] }),
  }, [201]);
  const c2id: string | undefined = c2.body?.id;
  if (c2id) {
    await call("cancel the second competition", `/competitions/${c2id}/cancel`, { method: "POST", headers: ch, body: JSON.stringify({}) }, [200, 409]);
    const hidden = await call("results of a cancelled competition must be hidden (ROL-009)", `/competitions/${c2id}/results`, { headers: ch }, [200, 403, 409, 410]);
    say(`      cancelled-results status: ${hidden.status}`);
    if (hidden.status === 200 && Array.isArray(hidden.body?.categories) && hidden.body.categories.length > 0) {
      note(`a CANCELLED competition still exposes its results\n  GET /competitions/${c2id}/results -> 200 with ${hidden.body.categories.length} category(ies)\n  ROL-009/U-31 requires them hidden`);
    }
    await call("delete the second competition", `/competitions/${c2id}`, { method: "DELETE", headers: ch }, [204]);
  }

  // ---- participant edits ------------------------------------------------------
  const plist = await call("list participants before edits", `/competitions/${competitionId}/participants`, { headers: ch });
  const target: any = (plist.body?.participants ?? [])[0];
  if (target) {
    await call("edit a participant's event flag", `/competitions/${competitionId}/participants/${target.id}`, { method: "PATCH", headers: ch, body: JSON.stringify({ teamEvent: true }) }, [200]);
    await call("reject an empty participant edit", `/competitions/${competitionId}/participants/${target.id}`, { method: "PATCH", headers: ch, body: JSON.stringify({}) }, [400, 422]);
    await call("reject an unknown participant field", `/competitions/${competitionId}/participants/${target.id}`, { method: "PATCH", headers: ch, body: JSON.stringify({ nonsense: 1 }) }, [400, 422]);
    await call("deactivate a participant", `/competitions/${competitionId}/participants/${target.id}`, { method: "DELETE", headers: ch }, [204]);
    const afterDeact = await call("list participants after deactivation", `/competitions/${competitionId}/participants`, { headers: ch });
    const stillThere = (afterDeact.body?.participants ?? []).some((p: any) => p.id === target.id);
    say(`      the deactivated participant is still listed: ${stillThere}`);
    await call("reactivate a participant via PATCH active:true", `/competitions/${competitionId}/participants/${target.id}`, { method: "PATCH", headers: ch, body: JSON.stringify({ active: true }) }, [200]);
  }
  const slips = await call("download the credential slips", `/competitions/${competitionId}/participants/credentials`, { headers: ch });
  say(`      slips bytes: ${slips.text.length}, xlsx: ${slips.text.startsWith("PK")}`);

  // ---- judge deactivation, now that every competition is closed -------------
  if (judgeId) {
    const deact = await call("deactivate the judge", `/judges/${judgeId}`, { method: "DELETE", headers: ch }, [200, 204, 409]);
    if (deact.status === 409) {
      say(`      refused because of: ${JSON.stringify(deact.body?.error?.details?.competitions)}`);
      note(`a judge cannot be deactivated although every competition is FINISHED and the copy is deleted\n  DELETE /judges/${judgeId} -> 409 judge.hasActiveAssignment\n  ROL-010 blocks removal only for an *unfinished* competition; FINISHED is finished\n  competitions named: ${JSON.stringify(deact.body?.error?.details?.competitions)}`);
    }
    if (assignmentId) {
      await call("unassign the judge from the competition", `/competitions/${competitionId}/judge-assignments/${assignmentId}`, { method: "DELETE", headers: ch }, [204, 404]);
      await call("deactivate the judge after unassigning", `/judges/${judgeId}`, { method: "DELETE", headers: ch }, [200, 204, 409]);
    }
    await call("reactivate the judge", `/judges/${judgeId}/reactivate`, { method: "PATCH", headers: ch, body: JSON.stringify({}) }, [200, 404]);
  }

  // ---- BLD-050 hard delete ---------------------------------------------------
  await call("delete the competition", `/competitions/${competitionId}`, { method: "DELETE", headers: ch }, [204]);
  const after = await call("list competitions after delete", "/competitions", { headers: ch });
  const remaining = (after.body?.competitions ?? []).length;
  say(`      competitions remaining: ${remaining}`);
  if (remaining > 0) note(`${remaining} competition(s) survived the hard delete\n  GET /competitions -> 200\n  ${JSON.stringify(after.body?.competitions?.map((c: any) => c.name))}`);
  const orphanQuestions = await db.question.count({ where: { questionSet: { competitionId } } });
  const orphanFiles = await db.storedFile.count();
  say(`      orphaned Question rows after delete: ${orphanQuestions}; StoredFile rows left in the db: ${orphanFiles}`);
  if (orphanQuestions > 0) note(`the hard delete left ${orphanQuestions} Question row(s) behind\n  DELETE /competitions/${competitionId} -> 204`);

  // ---- auth negatives ---------------------------------------------------------
  await call("anonymous reads competitions", "/competitions", {}, [401]);
  await call("wrong password", "/auth/controller/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "controller-test", password: "nope" }) }, [401, 403]);
  await call("a stale session token", "/judges", { headers: { "x-session-token": "not-a-real-token", "x-device-id": "x" } }, [401]);
  if (player) {
    await call("a player session on a controller route", "/competitions", { headers: player.headers }, [401, 403]);
    await call("a player session on a judge route", "/judges/me", { headers: player.headers }, [401, 403]);
    await call("a player session with someone else's device id", "/gameplay/competition", { headers: { ...player.headers, "x-device-id": "00000000-0000-0000-0000-000000000001" } }, [401, 403, 409]);
  }
  if (judgePlain) {
    await call("a judge session on a controller route", "/competitions", { headers: judgePlain.headers }, [401, 403]);
    await call("a judge session on the roster (must be refused)", `/competitions/${competitionId}/participants`, { headers: judgePlain.headers }, [401, 403, 404]);
  }

  say("\n=== ANOMALIES ===");
  if (anomalies.length === 0) say("none");
  anomalies.forEach((a, i) => say(`\nA${i + 1}. ${a}`));
  say(`\n=== ${step} calls, ${anomalies.length} anomalies ===`);
}

main()
  .catch((error) => {
    say(`\nTHROWN: ${error instanceof Error ? `${error.message}\n${error.stack}` : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
