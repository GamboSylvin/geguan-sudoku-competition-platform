# Manual Test Scenarios — Sudoku Arena

**Purpose.** A step-by-step, click-by-click script for a human to manually verify every feature that has been built so far — no coding knowledge required beyond following the steps. This is separate from, and does not replace, the project's automated tests (94 backend tests across 10 suites, 16 frontend tests across 5 suites, run in CI on every pull request — see `backend/tests/` and `frontend/tests/`). Automated tests catch regressions fast; this guide is for a human to confirm the whole system actually behaves as intended when used for real, and to sign off before the event.

**Coverage.** Every unit that is built today — `01` Foundation, `02` Authentication, `03` Competition setup, `05` Question import, `06` Judges and ranges, `07` Round runtime, `08` Submission and scoring, `09` Ranking and big screen, `10` Judge supervision — has at least one scenario below. Units `11`–`15` (controller live commands, results/export, team stages, school ranking) are not built yet; see the note at the end.

**Last verified against the system:** 2026-10-08. If a step's wording, button label or URL has visibly changed since, that's a sign this file needs a refresh, not that you're doing something wrong.

---

## 0. One-time setup

1. Start the stack: `docker compose up -d` from the project root.
2. Wait until it's healthy: open `http://localhost:3001/api/health` — it should return `{"status":"ok", ...}`. (Port may differ if you changed `BACKEND_PORT` in `.env`; check with `docker compose ps`.)
3. Open the frontend at `http://localhost:5173`.
4. Create the test data (accounts, a published competition, players, a judge) by running, in a terminal:
   ```bash
   docker compose exec backend npx tsx prisma/seed-manual-qa.ts
   ```
   This prints every login you'll need. **Keep that output open** — you'll copy usernames/passwords from it as you go. If you've already run it once, it reprints the same accounts instead of duplicating anything (the judge's password only prints the first time it's created — re-run against a fresh database if you need to see it again).

Example of what it prints (yours may have different random values for the judge password and the generated IDs):

```
Controller login: qa-controller / test-pass-1234
Judge login: qa-judge-239cf4 / DSXSHPBJ
  Player #1 (QA School Alpha (G1-2), Grades 1-2): qa-player-1 / test-pass-1234
  Player #2 (QA School Alpha (G1-2), Grades 1-2): qa-player-2 / test-pass-1234
  ... (8 players total, across 2 categories and 4 schools)
Big-screen URL (open directly, no login): /big-screen/<token>
```

Everyone's password is **`test-pass-1234`** unless noted otherwise.

**If a route that should exist returns "Cannot GET/POST ..." right after a `git pull`:** the backend's file watcher can miss files added by `git` (a known Docker-on-Windows bind-mount limitation) and keep running the old code. Run `docker compose restart backend` and try again before assuming something is broken.

---

## A. Controller scenarios

### A1 — Login and generic error message (Units 01, 02)

1. Go to `http://localhost:5173/login`.
2. Click **Controller**.
3. Type a wrong password for `qa-controller`. Submit.
   - **Expect:** a generic error (something like "incorrect username or password") — it must **not** say which of the two is wrong (`AUTH-002`).
4. Now log in for real: `qa-controller` / `test-pass-1234`.
   - **Expect:** you land on the controller home / competition setup area, no error.

### A2 — One active device per account (Unit 02, `PAR-005`)

1. While still logged in as `qa-controller` in your browser, open a **second browser** (or a private/incognito window) and log in as `qa-controller` again.
2. Go back to the **first** browser and try clicking around.
   - **Expect:** the first session is kicked out (the new login takes over) — refreshing or acting should show you're logged out there.

### A3 — Create a new competition (Unit 03)

1. Logged in as controller, go to `http://localhost:5173/controller/competition/new`.
2. Fill in a name (e.g. "My Test Competition") and add at least one category, e.g. code `G1-2`, name "Grades 1-2".
3. Save / create.
   - **Expect:** the competition is created in draft form; you can see the two stages (Individual, Team) and their rounds already exist automatically — you did not create them by hand.
4. Try to publish immediately, before adding questions/judges.
   - **Expect:** publish is refused, naming what's still missing (no question sets assigned to rounds, no judge range, etc.) — this is the readiness check (`REQUIREMENTS.md` §publish readiness).

### A4 — Import a real question file (Unit 05) — the big one

This is the scenario that proves the whole import pipeline works end to end, using a **real file from the client**, hand-prepared with the given-cell text column (no OCR, no image reading — `BLD-047`).

1. On the same competition-setup page, find the **question import** panel for category `G1-2` (or whichever category you created in A3).
2. Upload: `context/samples/【一二年级组】四宫标准60_文字版.xlsx`.
   - **Expect:** success — it reports a `QuestionSet` created with **24 questions** imported (the variant label "四宫标准数独" is recognized as the standard 4×4 family).
3. Open the pool view for that category.
   - **Expect:** you see the 24 imported questions listed, each with a 4×4 grid, points = 5 (the file's own value).
4. Try uploading the same file again, or a second file for the same category.
   - **Expect:** it's accepted as a **second, separate** `QuestionSet` under the same category (`BLD-044` — several sets per category is normal, not an error).
5. **Negative test:** make a broken copy of the file (e.g. delete one value from a `*给定数字` cell so it no longer complements `*正确答案` for that row) and upload it.
   - **Expect:** the **whole file** is rejected, naming the specific row and the reason — not a partial import.
6. **Negative test:** try uploading one of the original, un-transcribed files from `context/samples/一二年级组/` (no `*给定数字` column at all).
   - **Expect:** rejected — the given-cells column is missing.
7. **Negative test:** try uploading `context/samples/一二年级组/【一二年级组】四宫不规则30.xlsx` (the irregular variant).
   - **Expect:** rejected outright, naming the variant as unsupported (`BLD-045`).

### A5 — Select 6 questions per round (Unit 05)

1. Still on the category's question pool, open the round-selection screen for Individual Round 1.
2. Pick exactly 6 of the imported questions. Save.
   - **Expect:** success.
3. Try picking only 5, or 7.
   - **Expect:** rejected (not exactly 6).
4. Repeat for Individual Round 2 with a different 6 questions.
5. Do the same for the other category if you created one.

### A6 — Judge management (Unit 06)

1. Go to `http://localhost:5173/controller/judges`.
2. Create a new judge (any name).
   - **Expect:** a one-time username/password is shown — write it down, it won't be shown again the same way.
3. Back on the competition setup page, assign that judge a participant-number range (e.g. 1 to 4).
   - **Expect:** saved successfully; the range can be changed again later (it's editable any time, not locked at publish, `BLD-008`).
4. Try to remove a judge who is assigned to this competition (and the competition isn't finished).
   - **Expect:** blocked (`ROL-010`) — reassign or wait until the competition finishes.

### A7 — Publish the competition (Unit 03)

1. Once categories have participants (see note below), 6+6 questions assigned per round, and judge ranges covering everyone — publish.
   - **Expect:** success this time; you get an entry link and a big-screen link.

> **Note on participants:** there is no UI yet to import participants (Unit 04 is blocked on the real stakeholder data, `U-01`) — that's why the seed script (`seed-manual-qa.ts`) creates the 8 QA players directly. If you created your **own** competition in A3 instead of using the seeded one, you won't be able to publish it through the UI alone — either add participants via direct database access, or just use the already-published **Manual QA Competition** the seed script creates for the scenarios below.

---

## B. Judge scenarios

### B1 — Judge login and landing (Unit 06)

1. Go to `/login`, click **Judge**.
2. Log in with the judge credentials printed by the seed script (`qa-judge-xxxxxx` / the generated password).
   - **Expect:** lands on a judge landing page showing their assigned range.

### B2 — Supervision dashboard (Unit 10)

1. Go to `http://localhost:5173/judge/dashboard`.
   - **Expect:** a table listing every participant in the judge's range (participant number, name, category, connected status, round state, how many times they left the answer page, attempt count, time remaining). Updates every ~3 seconds (polling, not push).
2. Try opening this page logged in as **controller** instead.
   - **Expect:** rejected — judge-only (`U-55`: status view + single-student restart only, strictly bounded).

### B3 — Restart a single student (Unit 10)

*(Needs a round actually running — see scenario C1 first, then come back here.)*

1. With Stage 1 Round 1 active (see C1), on the judge dashboard, find a student in your range and click **Restart**.
2. Confirm the dialog.
   - **Expect:** success message; that student's working grid is cleared and they get a fresh blank attempt (their answers so far are archived, not deleted — `ROL-005`); the shared round timer is **not** affected, everyone else keeps going.
3. Try restarting a student **outside** your assigned range (if you have another judge/range, or inspect the API directly).
   - **Expect:** rejected (403, out of range).

---

## C. Player scenarios

### C1 — Start Stage 1 Round 1 (the one manual step with no UI yet)

Unit 11 (the controller's live "start round" button) isn't built yet — today this is triggered through a direct API call. This is expected, not a bug.

1. Get a fresh controller session:
   ```bash
   curl -s -X POST http://localhost:3001/api/auth/controller/login \
     -H "Content-Type: application/json" -H "x-device-id: manual-qa" \
     -d '{"username":"qa-controller","password":"test-pass-1234"}'
   ```
   Copy both the `"token"` **and** the `"deviceId"` from the response — every later request needs **both** headers (`x-session-token` and `x-device-id`, the latter set to the response's `deviceId`, not the arbitrary string you sent at login — PAR-005's one-active-device check validates it on every request, not just at login; omitting it or reusing your own string causes a `401 auth.deviceTakenOver`, which looks confusing but just means this header is missing or wrong).
2. Find the competition id (the seed script prints it, e.g. `Seeded and published competition <id>`).
3. Trigger the round:
   ```bash
   curl -s -X POST http://localhost:3001/api/rounds/dev/start-stage1-round1 \
     -H "Content-Type: application/json" \
     -H "x-session-token: <paste token here>" \
     -H "x-device-id: <paste the response's deviceId here>" \
     -d '{"competitionId":"<paste competition id here>"}'
   ```
   - **Expect:** `201` with the started preparation's details.

### C2 — Preparation countdown, active round, autosave (Unit 07)

1. Log in as a player (`qa-player-1` / `test-pass-1234`) at `/login`.
2. You should land on the round-runtime page and see the **preparation countdown** (3-2-1) start automatically, in sync with the trigger from C1.
3. When it reaches zero, the active round screen appears: a 4×4 grid, a number pad, a puzzle counter ("Puzzle 1 of 6").
4. Fill in a few cells.
   - **Expect:** no explicit "save" button needed — it autosaves in the background (debounced). Refresh the page.
   - **Expect:** your entries are still there (reconnect state read restores your saved grid and the correct remaining time).
5. On a phone or a narrow/portrait browser window: shrink the window to portrait.
   - **Expect:** a "please rotate your device" screen (`PAR-006`) instead of the grid.

### C3 — Submit (Unit 08)

1. Fill in all 6 puzzles (correctly or not — either is fine for this test) on `qa-player-1`.
2. Click submit.
   - **Expect:** a confirmation dialog naming how many puzzles are still blank (if any), then a read-only "submission accepted" screen. You cannot go back and edit.
3. Try clicking submit again (e.g. resubmitting the form via browser back + forward).
   - **Expect:** no error, no duplicate effect (idempotent no-op, `PL-009`).
4. Check that the player is never shown their score or rank on this screen (`SUB-007`/`BLD-029`) — final results only appear once the whole competition is published as finished, a later unit.

### C4 — A second player, for ranking (Units 08, 09)

1. Repeat C2–C3 logged in as `qa-player-2` (same category, different school) with a different pattern of correct/incorrect answers.
2. This gives you at least two finalized results in the same category, needed for B1/D1's ranking checks to show something meaningful.

---

## D. Big-screen scenarios (Unit 09)

### D1 — Open the big screen, no login

1. Open the big-screen URL the seed script printed (e.g. `http://localhost:5173/big-screen/<token>`) directly — no login needed, this is the whole point of a shared public link (`BSC-001`).
2. Once `qa-player-1`/`qa-player-2` (C3/C4) have submitted:
   - **Expect:** a leaderboard appears for their category, updating within ~2 seconds of each submission (`NF-011`), marked **provisional** (not **final**, since not every participant in the category has finished both rounds yet).
3. Open the same link in a second tab/device.
   - **Expect:** both show the same content, staying in sync (several screens show what's chosen — no per-screen separate state, `BSC-002`).
4. Edit the URL to an invalid/made-up token.
   - **Expect:** a clear "invalid link" message, not a crash.

---

## E. Quick coverage checklist

Tick these off as you go — by the end, every built unit has been exercised at least once:

- [ ] Unit 01 (Foundation) — the app loads, health check passes (step 0.2)
- [ ] Unit 02 (Auth) — A1, A2
- [ ] Unit 03 (Competition setup) — A3, A7
- [ ] Unit 05 (Question import) — A4, A5
- [ ] Unit 06 (Judges and ranges) — A6, B1
- [ ] Unit 07 (Round runtime) — C1, C2
- [ ] Unit 08 (Submission and scoring) — C3, C4
- [ ] Unit 09 (Ranking and big screen) — D1
- [ ] Unit 10 (Judge supervision) — B2, B3

## What's not testable yet

Units `11` (controller live commands — pause/resume/end round from the UI, not just the dev trigger), `12` (results, corrections, export, purge), `13`/`14` (team stages), `15` (school ranking, competition copy) are approved specs but not built. There's nothing to click yet for those — this file should grow a new section for each as it lands, following the same role-by-role, step-by-step style.
