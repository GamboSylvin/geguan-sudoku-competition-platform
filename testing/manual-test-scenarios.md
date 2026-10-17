# Manual Test Scenarios — Sudoku Arena

**Purpose.** A step-by-step, click-by-click script for a human to manually verify every feature that has been built so far — no coding knowledge required beyond following the steps. This is separate from, and does not replace, the project's automated tests (**267 backend tests across 19 suites, 81 frontend tests across 12 suites** — see `backend/tests/` and `frontend/tests/`). Automated tests catch regressions fast; this guide is for a human to confirm the whole system actually behaves as intended when used for real, and to sign off before the event.

**Coverage.** All 15 originally-planned units have at least one scenario below: `01` Foundation, `02` Authentication, `03` Competition setup, `04` Participant import, `05` Question import, `06` Judges and ranges, `07` Round runtime, `08` Submission and scoring, `09` Ranking and big screen, `10` Judge supervision, `11` Controller live commands, `12` Results/corrections/export, `13` Team stage rotation relay, `14` Team stage partition collaboration, `15` School ranking — **plus the 5 post-build additions decided 2026-10-15/16 (BLD-050 through BLD-054): school CRUD (K), scoring configuration (L), competition deletion (M), the language switcher (N), and the visual design pass (O).**

**Last verified against the system: 2026-10-16.** If a step's wording, button label or URL has visibly changed since, that's a sign this file needs a refresh, not that you're doing something wrong.

**Three bugs found by manual testing on 2026-10-15/16 are now fixed and committed** (commit `e688495`): the cross-category question/scoring leak (C2/G/H now behave correctly even with 2+ categories), a player stuck forever on "the round starts in Xs" after connecting/reconnecting/reloading post-ACTIVE (C2/G1/H1 all specifically re-test this), and the misleading `/judges/me` error message. The sections below assume these fixes are in place — if any of the three symptoms reappears, that's a regression, not a known issue.

**Correction, 2026-10-15: `context/samples/选手信息.xlsx` is NOT the empty template this section used to describe.** Every check from 2026-10-13/14 onward (including the one this section originally cited) compared the file's unchanged size/date to an earlier check and wrongly concluded "still empty," without ever re-unzipping it. It actually holds 3 real rows (张三/李四/刘一), and the project owner ran the first real import through Unit 04 manually, correctly — see `context/progress-tracker.md`'s Unit 04 row for the full account. Section A8 below still works as a hand-add exercise on a *copy* of the file if you want extra synthetic rows, but you no longer need to invent data to see a real import succeed — the file already has some. Team rows are in a different position: no application code anywhere creates a `Team` row (Finding 11, `U-102` stays open with the stakeholder on *random* team formation) — the seed script below hand-creates one team per school per category so Units 13/14/15 have something to run against, exactly the way the backend's own `team-rotation.test.ts`/`team-partition.test.ts` do it.

---

## 0. One-time setup

1. Start the stack: `docker compose up -d` from the project root.
2. Wait until it's healthy: open `http://localhost:3001/api/health` — it should return `{"status":"ok", ...}`. (Port may differ if you changed `BACKEND_PORT` in `.env`; check with `docker compose ps`.)
3. Open the frontend at `http://localhost:5173`.
4. Create the test data (accounts, a published competition, players, teams, a judge) by running, in a terminal:
   ```bash
   docker compose exec backend npx tsx prisma/seed-manual-qa.ts
   ```
   This prints every login you'll need, plus one line per seeded **team** (with its id, needed for the `TEAM` scope in section E). **Keep that output open** — you'll copy usernames/passwords/ids from it as you go. If you've already run it once, it reprints the same accounts and teams instead of duplicating anything (the judge's password only prints the first time it's created — re-run against a fresh database if you need to see it again).

   **If you seeded this competition before 2026-10-14** (i.e. before this guide's Units 13/14/15 sections existed), the existing "Manual QA Competition" row predates team creation and the script's idempotent branch will not retrofit teams onto it. Delete it first so the script rebuilds it with teams:
   ```bash
   docker compose exec backend node -e "
   const { PrismaClient } = require('@prisma/client');
   const p = new PrismaClient();
   p.competition.findFirst({ where: { name: 'Manual QA Competition' } })
     .then(c => c ? p.competition.delete({ where: { id: c.id } }) : null)
     .then(r => { console.log(r ? 'deleted' : 'nothing to delete'); return p.\$disconnect(); });
   "
   ```
   then re-run the seed command above.

Example of what it prints (yours may have different random values for the judge password and the generated ids):

```
Controller login: qa-controller / test-pass-1234
Judge login: qa-judge-239cf4 / DSXSHPBJ
  Player #1 (QA School Alpha (G1-2), Grades 1-2, team QA School Alpha Team (G1-2)): qa-player-1 / test-pass-1234
  ... (8 players total, across 2 categories and 4 schools)

  Team QA School Alpha Team (G1-2) (Grades 1-2): id=9324c53d-...
  ... (4 teams total, one per school per category)

Big-screen URL (open directly, no login): /big-screen/<token>
```

Everyone's password is **`test-pass-1234`** unless noted otherwise.

**If a route that should exist returns "Cannot GET/POST ..." right after a `git pull`:** the backend's file watcher can miss files added by `git` (a known Docker-on-Windows bind-mount limitation) and keep running the old code. Run `docker compose restart backend` and, if the frontend looks stale too (an old screen, a missing button), `docker compose restart frontend` as well, before assuming something is broken.

---

## A. Controller scenarios — setup

### A1 — Login and generic error message (Units 01, 02)

1. Go to `http://localhost:5173/login`.
2. Click **Controller**.
3. Type a wrong password for `qa-controller`. Submit.
   - **Expect:** a generic error (something like "incorrect username or password") — it must **not** say which of the two is wrong (`AUTH-002`).
4. Now log in for real: `qa-controller` / `test-pass-1234`.
   - **Expect:** you land on the controller's competition picker (`/controller`), no error.

### A2 — One active device per account (Unit 02, `PAR-005`)

1. While still logged in as `qa-controller` in your browser, open a **second browser** (or a private/incognito window) and log in as `qa-controller` again.
2. Go back to the **first** browser and try clicking around.
   - **Expect:** the first session is kicked out (the new login takes over) — refreshing or acting should show you're logged out there.

### A3 — Create a new competition (Unit 03)

1. Logged in as controller, go to `http://localhost:5173/controller/competition/new`.
2. Fill in a name (e.g. "My Test Competition") and add at least one category, e.g. code `G1-2`, name "Grades 1-2".
3. Save / create.
   - **Expect:** the competition is created in draft form; you can see the two stages (Individual, Team) and their rounds already exist automatically — you did not create them by hand.
4. Try to publish immediately, before adding participants/questions/judges.
   - **Expect:** publish is refused, naming what's still missing (no question sets assigned to rounds, no judge range, etc.) — this is the readiness check. Note that **teams are not among the readiness conditions** (Finding 11) — the Individual stage runs fine with zero `Team` rows.

### A4 — Import a real question file (Unit 05) — the big one

This is the scenario that proves the whole import pipeline works end to end, using a **real file from the client**, hand-prepared with the given-cell text column (no OCR, no image reading — `BLD-047`).

1. On the same competition-setup page, find the **question import** panel ("Questions") for category `G1-2` (or whichever category you created in A3).
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

### A7 — Note on participants in these scenarios (Unit 04)

Unit 04 built a real participant-import panel ("Participants", mounted above the question panel in competition setup), and it works — the 500 some earlier manual testing hit was a stale generated Prisma client, fixed 2026-10-11. But for sections B–J below, **don't import participants through the UI for your own test competition** — use the seeded **Manual QA Competition** (section 0) instead, or import via the seed script's pattern. The reasons: (1) the real file's 3 rows (see the corrected note at the top of this file) are too few to populate a full multi-category test run on their own, and (2) critically, **the import panel cannot create `Team` rows at all** (Finding 11) — Units 13/14/15 need teams, and the only way to get them today is the seed script's hand-seeding. If you want to exercise the import *panel itself*, do that separately in A8, on its own throwaway competition.

### A8 — Import participants via the UI (Unit 04)

This tests the importer itself, in isolation — it does not need to feed the rest of your test run, since (per A7) a real competition for B–J should come from the seed script instead.

1. Make a working copy of `context/samples/选手信息.xlsx`. It has the 12 real columns (`比赛名称`, `选手编号`, `姓名`, `年龄`, `省`, `市`, `区（县）`, `学校名称`, `组别`, `个人赛`, `团队赛`, `备注`) and **3 real data rows already** (张三/李四/刘一, plus column L2's note explaining the flag rule attached to the first row) — add 2-3 more by hand if you want a bigger sample (any plausible name/school/category; set `个人赛`/`团队赛` to `1` for a couple of them and leave one blank to test the "not taking part" default).
2. On a competition you created in A3 (still in draft, not published), find the **Participants** panel and click **Import file**. Upload your copy.
   - **Expect:** success — "Imported: N" where N is your data-row count; the note row itself is skipped and reported as a warning (`participant.import.noteRowSkipped`), not counted as data and not an error.
3. Open the roster list.
   - **Expect:** your rows appear with the right name/school/category, and the `个人赛`/`团队赛` flags match what you typed (a blank cell → not participating in that event).
4. **Negative test (Finding 10):** re-upload the same file after changing only one row's `团队赛` from `1` to blank (same name + school + category as before).
   - **Expect:** the roster still shows the **same number of participants** — the existing row's flag is updated in place, not replaced by a new row (this is the asked-not-guessed resolution in `participant.service.ts`'s `flagChangeIsAnUpdateNotAReplacement()`; the question itself, whether this is the right call, is still open and tracked as `I-41`).
5. **Note what you will *not* see:** no team is created and no participant gets a `teamId`, however many students have `团队赛 = 1` (Finding 11) — this is expected, not a bug, and it's why section A7 tells you to use the seeded competition for everything downstream.

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
   - **Note (fixed 2026-10-14):** the restarted participant has no placeholder attempt at all until they actually submit again — earlier, a judge/controller restart could leave a non-archived placeholder that made Unit 08's finalize silently drop the student from the ranking. That's closed now; a restarted student who goes on to submit normally should get a normal ranking result like anyone else.
3. Try restarting a student **outside** your assigned range (if you have another judge/range, or inspect the API directly).
   - **Expect:** rejected (403, out of range).

---

## C. Player scenarios — Individual stage

### C1 — Start Stage 1 Round 1

Unit 11 is built now, so the real way to do this is the controller's **Live control** screen — no `curl` needed any more.

1. Log in as `qa-controller`, go to `http://localhost:5173/controller`, and open the **Manual QA Competition**'s control panel (or whichever competition you published).
2. Under **Sequence**, click **Start stage** next to "Individual 1".
   - **Expect:** a success notice ("Stage started. The preparation countdown is running.") and the Individual stage's Round 1 shows status "Preparation" in the **Rounds** table.
3. That's it — Round 1 moves from Preparation to Running on its own once the countdown ends, and **Round 2 starts automatically** when Round 1 finishes (both stages auto-advance between their own rounds; only moving from one *stage* to the next needs another click here, `RND-006`).

<details>
<summary>Dev-only fallback, if you need to script this instead of clicking (kept for completeness, not the normal path)</summary>

```bash
curl -s -X POST http://localhost:3001/api/auth/controller/login \
  -H "Content-Type: application/json" -H "x-device-id: manual-qa" \
  -d '{"username":"qa-controller","password":"test-pass-1234"}'
```
Copy both the `"token"` **and** the `"deviceId"` from the response — every later request needs **both** headers (`x-session-token` and `x-device-id`, the latter set to the response's `deviceId`, not the arbitrary string you sent at login — `PAR-005`'s one-active-device check validates it on every request, not just at login; omitting it or reusing your own string causes a `401 auth.deviceTakenOver`).
```bash
curl -s -X POST http://localhost:3001/api/rounds/dev/start-stage1-round1 \
  -H "Content-Type: application/json" \
  -H "x-session-token: <token>" -H "x-device-id: <deviceId>" \
  -d '{"competitionId":"<competition id>"}'
```
This route refuses to run in production and exists only as the narrow form Unit 11 generalized.
</details>

### C2 — Preparation countdown, active round, autosave (Unit 07)

1. Log in as a player (`qa-player-1` / `test-pass-1234`) at `/login`.
2. You should land on the round-runtime page and see the **preparation countdown** (3-2-1) start automatically, in sync with the trigger from C1.
3. When it reaches zero, the active round screen appears: a 4×4 grid, a number pad, a puzzle counter ("Puzzle 1 of 6").
4. Fill in a few cells.
   - **Expect:** no explicit "save" button needed — it autosaves in the background (debounced). Refresh the page.
   - **Expect:** your entries are still there (reconnect state read restores your saved grid and the correct remaining time).
5. On a phone or a narrow/portrait browser window: shrink the window to portrait.
   - **Expect:** a "please rotate your device" screen (`PAR-006`) instead of the grid.
6. **Regression check (fixed 2026-10-16):** log in as a player who has **never connected to this round before** (e.g. `qa-player-3`), but only *after* Round 1 has already gone Active (wait past the 60s preparation countdown, or have a different player already mid-round). Also try it by waiting for Round 1 → Round 2's automatic handoff and only logging in once Round 2 is already Active.
   - **Expect:** the real grid, not a frozen "Get ready / the round starts in Xs" screen. Previously this screen got the player stuck forever (even across a reload) — the fix added a `GET /api/gameplay/current-round` discovery call and a `status` field on the preparation-tick push so a late arrival can tell an ACTIVE round's tick from a genuine preparation one.
7. **Regression check (fixed 2026-10-16), with 2+ categories:** make sure your test competition has at least two categories, each with its own 6 questions assigned to Round 1 (A5, repeated per category). Log in as a player in each category.
   - **Expect:** each player sees exactly **6** puzzles — their own category's, never the other category's mixed in ("Puzzle 1 of 12" was the symptom of the bug; `round.repository.ts`'s `listRoundQuestions` now filters by category and the round-started push is routed to a per-category room instead of broadcast to everyone).

### C3 — Submit (Unit 08)

1. Fill in all 6 puzzles (correctly or not — either is fine for this test) on `qa-player-1`.
2. Click submit.
   - **Expect:** a confirmation dialog naming how many puzzles are still blank (if any), then a read-only "submission accepted" screen. You cannot go back and edit.
3. Try clicking submit again (e.g. resubmitting the form via browser back + forward).
   - **Expect:** no error, no duplicate effect (idempotent no-op, `PL-009`).
4. Check that the player is never shown their score or rank on this screen (`SUB-007`/`BLD-029`) — final results only appear once the controller publishes the competition's results (section F).

### C4 — A second player, for ranking (Units 08, 09)

1. Repeat C2–C3 logged in as `qa-player-2` (same category, different school) with a different pattern of correct/incorrect answers.
2. This gives you at least two finalized results in the same category, needed for B2/D1/F1's ranking checks to show something meaningful.
3. Repeat the whole of C1 (if needed)–C4 for `qa-player-3`/`qa-player-4` (the other G1-2 school) and `qa-player-5`–`qa-player-8` (G3-4) once you're ready to also exercise school ranking (section I) — a school's total needs **every** one of its players finalized to stop being "incomplete" (J1).

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

## E. Controller live commands (Unit 11)

All of these live on the **Live control** screen (`/controller/competitions/:id/live`), reached from the controller's competition picker. The dashboard polls the server every ~3 seconds; every button's enabled/disabled state is read from the server, never guessed client-side.

### E1 — Pause and resume (RND, global timer)

*(Needs a round actually running — do C1 first.)*

1. With a round active, click **Pause** (next to the Sequence section's Start-stage buttons).
   - **Expect:** "Paused on every screen." notice; the **Remaining** readout freezes; the big screen switches to its paused display; on a player's screen, the round shows paused too.
2. Click **Resume** (the same button, now labeled differently).
   - **Expect:** "Resuming: the screens count down 3, 2, 1, Start." — the countdown does **not** eat into round or preparation time (`RND-001`).
3. With nothing running (e.g. before C1, or after a stage finished), check that **Pause** is disabled rather than clickable-but-rejected.

### E2 — End a round early

1. With a round active, in the **Rounds** table, click **End early** on that row. Confirm the dialog ("Every student still playing is closed and scored as-is, with no early-submission bonus. This cannot be undone.").
   - **Expect:** success notice; the round's status becomes "Finished"; any player still mid-round is auto-submitted with whatever they had typed.
2. Check a player who was still playing: their screen should now show the submitted/read-only state, not an error.

### E3 — Reset / rematch, with its scope picker

1. Under **Reset / rematch**, open the **Scope** dropdown: `Whole event (the round in flight)`, `One round`, `One participant`, `One team`.
2. Pick **One participant**, paste a participant id (e.g. from the judge dashboard, or a player's id from the database) into the field that appears, click **Reset**, confirm.
   - **Expect:** "Reset applied. Earlier attempts are archived." — that participant's current attempt is archived (not deleted) and they get the round's full duration again.
3. Pick **One team** and paste one of the team ids the seed script printed, to reset a whole team's round state the same way.
4. On a `FINISHED`/`CANCELLED` competition, check the whole Reset/rematch section is disabled.

### E4 — Big-screen mode and rotation

1. Under **Big screens**, click each of **Live ranking**, **Paused screen**, **Final results** in turn.
   - **Expect:** the button for the current mode is disabled (you can't re-select the mode you're already in); the big-screen tab (D1) reflects the change within a couple of seconds.
2. Click **Enable rotation** / **Disable rotation** (category rotation, when more than one category exists).
   - **Expect:** the label flips and the big screen starts/stops cycling between categories.

### E5 — Finish the competition early

1. Click **Finish the competition early** (in **Terminal actions**). Read the confirmation body carefully — it is explicit that this cannot be undone.
2. Confirm.
   - **Expect:** "The competition is finished early." notice; every section's controls (Start stage, Pause, Reset, big-screen mode changes) become disabled; a "This competition is closed." note appears.
3. Open the results screen (section F) for this competition.
   - **Expect:** results are readable (a competition finished early still releases its results, `Competition.finishedEarly`), unlike a cancelled one (E6).

*Do this on a competition you don't mind losing — it's terminal. Use a throwaway one from A3, not the shared Manual QA Competition, if you want to keep testing the rest of this guide afterwards.*

### E6 — Cancel the competition

1. On a **different** throwaway competition (cancel is just as terminal as finish-early, and the two have different downstream behaviour worth seeing separately), click **Cancel the competition**. Read the warning: no results will ever be released.
2. Confirm.
   - **Expect:** "The competition is cancelled. No results will be released." notice.
3. Open the results screen (section F) for this competition.
   - **Expect:** rejected — `results.errors.results_competitionCancelled` (`ROL-009`, `U-31`), not a page full of numbers.

---

## F. Results, corrections and export (Unit 12)

Reached from **Live control**'s **Results** link, or the controller's competition picker's "Open results" (`/controller/competitions/:id/results`). Needs at least one finalized result — do C1–C4 on the Manual QA Competition first.

### F1 — Read results and the category leaderboard

1. Open the results screen for a competition with at least two finished players in a category (C4).
   - **Expect:** a **Category leaderboard** (rank, name, score, time) and, below it, every round's detail table (participant number, name, rank, raw score, bonus, total, time, submission type, an action column).
2. Check the submission-type column reflects reality: `Manual` for a normal submit, `Timeout` if a round ended by the clock, `Ended by controller` if you used E2, `Automatic` for an auto-submit sweep.

### F2 — Correct a score

1. Click **Correct** on any row. A dialog opens showing the participant, round and current total.
2. Try saving with the reason field left blank.
   - **Expect:** rejected client-side ("A reason is required...") before it even reaches the server.
3. Enter a new score and a reason ("manual QA test correction"), click **Save correction**.
   - **Expect:** "The score was corrected and the ranking recalculated." — the leaderboard above updates immediately, and a new row appears in **Correction history** (old → new score, the reason, the timestamp) — this history is permanent and visible, never silently editable (`RES-003`).
4. Try correcting a score on a **cancelled** competition (E6).
   - **Expect:** the whole results screen is already rejected (F1's negative case), so there's nothing to correct.

### F3 — Export and the purge notice

1. Click **Export .xlsx**.
   - **Expect:** a file downloads; "Export downloaded" notice names the filename.
2. Look for the purge notice near the top of the screen (a banner, not a control — there is deliberately **no manual purge button anywhere**; purging is schedule-driven on the server only).
   - **Expect:** either "This competition's student data will be permanently purged on `<date>`" or, if the purge already ran, "...was permanently purged on `<date>`".

---

## G. Team stage — rotation relay (Unit 13)

Needs Stage 1 (Individual) **fully finished** for the Manual QA Competition first (`RND-006` — stages run in sequence), then Stage 2 ("Team") started from **Live control** exactly like C1 (click **Start stage** next to "Team 2"). Team Round 1 is the rotation relay.

### G1 — Play a rotation round as a team member

1. Log in as `qa-player-1` (or any seeded team member) once Team Round 1 is active.
   - **Expect:** a **different** screen from the Individual stage's: one question at a time, a **Team score** shown openly (unlike the Individual stage, a team round's score is never hidden from players, `SCR-007`/`SCR-015`), and a submit button that checks your answer **immediately**.
2. Submit a wrong answer on purpose.
   - **Expect:** an "incorrect" message; the question **stays in circulation** and will rotate to a teammate rather than disappearing (`keepIncorrectSubmitInCirculation()` — Finding 7, not a bug).
3. Submit a correct answer.
   - **Expect:** a "Correct!" message and the next question rotates in (either immediately, if the queue had one waiting, or after the configured rotation period — the seed script shortens this to 20s so you don't have to wait long).
4. Log in as a **second** member of the **same team** (e.g. `qa-player-2`, if they share a school) in a different browser/tab at the same time.
   - **Expect:** they hold a **different** question (or the same one if it already rotated to them) — never literally the same held question as another member at once.
5. Let the round run until every pool question is answered correctly, or the round's duration elapses.
   - **Expect:** a "Round over" screen with the final shared team score; this is one flat value (`correctCount × teamPointsPerQuestion`), identical for every member of the team.
6. **Regression check (fixed 2026-10-16):** log in as a team member only *after* this round is already Active.
   - **Expect:** the real rotation screen, not a frozen "round starts in Xs" — the same fix as C2's step 6 covers all three round kinds.

### G2 — Supervise a team round (judge/controller)

1. While Team Round 1 is active, open the judge dashboard (B2) or the controller's **Live control** students panel.
   - **Expect:** team members show up the same way Individual-stage participants did (connected status, round state) — the same supervision surface Unit 10 built, reused here (spec Detail 6).
2. Try the **One team** reset/rematch scope (E3) against this team mid-round.
   - **Expect:** the team's rotation state is archived and restarted with the round's full duration, same semantics as a participant-level reset.

---

## H. Team stage — partition collaboration, 齐心协力 (Unit 14)

Team Round 2 (the second Team-stage round) starts **automatically** once Team Round 1 finishes for every team — no extra click needed (only the Individual→Team stage transition needs a human click, as in G's intro).

### H1 — Play a partition round as a team member

1. Log in as a seeded team member once Team Round 2 is active.
   - **Expect:** the **whole puzzle** is visible, but only a contiguous band of rows is yours to edit — the rest is shown read-only (not hidden), so the team can see what it's collectively solving (`showOtherBandsReadOnly()`). The header shows "Puzzle N of M" and the shared team score.
2. Type a value into a cell **outside** your band (if you can reach one via the keyboard — otherwise inspect the read-only rows visually).
   - **Expect:** it's not editable; a value sent outside your band from the API is rejected (422), never silently trimmed.
3. Fill in your band's cells correctly, matching what a teammate would need for the combined grid to be fully correct.
   - **Expect:** **no submit button** — the server checks the *combined* grid after every autosave, and the puzzle advances the instant every cell (across every member's band) is correct, with no early-finish bonus.
4. Log in as a second member of the same team at the same time, and complete their band.
   - **Expect:** once both bands are correct, the puzzle solves and the next one (of `partitionPuzzleCount`, default 3) loads for everyone on the team.
5. Finish every puzzle, or let the round's duration elapse.
   - **Expect:** "Round over" with the final shared team score (`solvedCount × partitionPointsPerPuzzle`).
6. **Regression check (fixed 2026-10-16):** log in as a team member only *after* this round is already Active (e.g. because Round 1's rotation relay finished on its own before you got here).
   - **Expect:** the real partition screen, not a frozen "round starts in Xs" — same fix as C2's step 6.

---

## I. School ranking (Unit 15)

Reached from **Live control**'s competition picker ("School ranking") or `/controller/competitions/:id/school-ranking`. Needs both Team rounds (G, H) finished — and ideally every player in a category finalized in both Individual rounds too (C4's last step) — to see a **final**, not **provisional**, row.

### I1 — Read the school leaderboard

1. Open the school ranking screen for the Manual QA Competition.
   - **Expect:** one leaderboard **per category** (never mixed across categories, `EVT-002`) — rank, school name, exact total, the individual-score sum, both team-round scores, summed completion time, and counted-players.
2. Check a school that hasn't finished every player yet (if any): its row is marked **incomplete** rather than silently included as if final.
3. Check the status line: **provisional** until every participant and team in the category has finished, **final** afterward.
4. If two schools land on the exact same total, look for the tie-break note — the row says whether the summed completion time actually separated them (`SCR-020`'s school-level tie-break, `schoolBreakTie()`, a separate function from the individual one).

---

## K. School management (BLD-052)

On the competition setup page, the **Schools** panel sits just above **Participants** (an organizer creates schools before importing students who point at them). Works on any competition, published or not.

### K1 — Add, rename, and the two delete guards

1. On a competition's setup page, find **Schools**. If it's empty: "No school yet. Add one below."
2. Type a name in the **New school name** field, click **Add school**.
   - **Expect:** "School added" and the row appears, showing 0 participants / 0 teams.
3. Click **Rename** on that row, change the name, **Save**.
   - **Expect:** "School renamed", new name shown immediately.
4. Try adding a second school with the **exact same name** as an existing one.
   - **Expect:** rejected — "A school with this name already exists."
5. Import at least one participant into this school (A8, or the seed script), then come back to this panel.
   - **Expect:** **Remove** is disabled, with the reason printed right beside it: "Still has participants — remove them first." — no need to click anything to discover why.
6. Pick a school with **zero** participants and **zero** teams (e.g. the one from step 2, if you never imported into it) and click **Remove**.
   - **Expect:** "School removed", row disappears.
7. (If you have a team-stage-tested competition with a seeded team attached to a school) try removing a school that has a team but no participants.
   - **Expect:** blocked the same way, with "Still has a team — remove it first."

---

## L. Scoring configuration (BLD-051) — API only, no screen yet

**There is currently no UI for this at all** — `schoolCoefficient` and `rankingCycleSeconds` can only be set through the API directly, by design (the decision added the fields to the existing create/update endpoints, not a new screen). Worth knowing before you go looking for a form that isn't there.

### L1 — Set and read back custom values

1. Get a fresh controller session token (see C1's dev-fallback box for the login `curl`).
2. Create a competition with a custom scoring configuration:
   ```bash
   curl -s -X POST http://localhost:3001/api/competitions \
     -H "Content-Type: application/json" -H "x-session-token: <token>" -H "x-device-id: <deviceId>" \
     -d '{"name":"Scoring Config Test","categories":[{"code":"G1-2","name":"Grades 1-2"}],"scoringConfiguration":{"schoolCoefficient":0.75,"rankingCycleSeconds":60}}'
   ```
   - **Expect:** `201`, and the response's `scoringConfiguration.schoolCoefficient` reads back as the **string** `"0.75"` (it's a Prisma `Decimal`, not a number — matters if you're scripting against this, SCR-013's exact-decimal rule).
3. `PATCH` the same competition's `/api/competitions/:id` with a different `schoolCoefficient`.
   - **Expect:** the new value sticks on the next `GET`.
4. Create a competition with **no** `scoringConfiguration` at all.
   - **Expect:** it still gets one, with the schema defaults `"0.6"` / `180` — omitting the field doesn't break creation.

---

## M. Delete a competition (BLD-050)

**This is permanent and has no undo.** Only do this to a throwaway competition you're done with — not the shared Manual QA Competition, unless you're about to re-seed anyway.

### M1 — The warning dialog and the typed-name guard

1. On the controller's competition picker (`/controller`), find **Delete this competition** on any competition's row.
2. Click it.
   - **Expect:** a dialog titled "Delete this competition forever?" that lists, in plain language, every category of data about to be destroyed — structure, questions, judge assignments (not the judges themselves), schools/teams/participants, student logins and their devices, results/corrections/rankings/audit entries, uploaded files. Not a generic "are you sure?".
3. Try clicking **Delete forever** immediately, without typing anything.
   - **Expect:** the button is disabled — it only activates once you've typed the competition's **exact** name into the field above it.
4. Type the name exactly, click **Delete forever**.
   - **Expect:** "Deleting…" then the competition disappears from the picker. It works at **any** status — try it on a published, or even a finished, competition too.
5. Confirm the judges survive: go to `/controller/judges` — any judge who was assigned to the deleted competition is still listed (only their *assignment* to that competition was removed, not the judge itself, `ROL-010`'s reusable-judge model).

---

## N. Language switcher (BLD-053)

### N1 — Default locale, switching, persistence, and where it's absent

1. Clear `localStorage` (or open a fresh/private browser) and load any controller or judge screen.
   - **Expect:** the UI renders in **Chinese** by default (U-68's confirmed default) — not English.
2. Look at the bottom-left corner of the screen.
   - **Expect:** a small floating control with two buttons, "English" and "中文". The one matching the current language is visually marked active.
3. Click **English**.
   - **Expect:** every piece of UI text on screen switches to English immediately, no reload.
4. Reload the page.
   - **Expect:** it stays in English — the choice is remembered (`localStorage` key `sudoku-arena.locale`), not reset to the default.
5. Navigate to a player round screen (`/player`, logged in as any player) or a big-screen link (`/big-screen/<token>`).
   - **Expect:** the language switcher is **not there at all** — not just disabled, genuinely absent, so a player can't accidentally flip their own screen's language mid-puzzle and the shared public big screen has no interactive control sitting on it.
6. Go back to a controller screen.
   - **Expect:** the switcher reappears, still showing your last choice.

---

## O. Visual design pass (BLD-054) — a look, not a click-test

This was a pure CSS/styling pass (classes and inline styles only — the decision explicitly forbade any behaviour, content, route or data change alongside it), so there's nothing functional to verify beyond what sections A–N already cover. Worth a quick visual pass anyway:

1. Skim through a few screens of each "mood" the design report defined: the login screen (glass-on-gradient), a controller back-office screen like competition setup or results (light), and a gameplay/big-screen screen (dark). Nothing should look unstyled, broken, or like it's missing a class (stray default blue links, unstyled buttons, overlapping elements).
2. If anything looks visually broken, that's worth reporting — but a layout or color you simply don't like is a design-taste note for the project owner, not a bug.

---

## J. Quick coverage checklist

Tick these off as you go — by the end, every built unit has been exercised at least once:

- [ ] Unit 01 (Foundation) — the app loads, health check passes (step 0.2)
- [ ] Unit 02 (Auth) — A1, A2
- [ ] Unit 03 (Competition setup) — A3
- [ ] Unit 04 (Participant import) — A7, A8
- [ ] Unit 05 (Question import) — A4, A5
- [ ] Unit 06 (Judges and ranges) — A6, B1
- [ ] Unit 07 (Round runtime) — C1, C2
- [ ] Unit 08 (Submission and scoring) — C3, C4
- [ ] Unit 09 (Ranking and big screen) — D1
- [ ] Unit 10 (Judge supervision) — B2, B3
- [ ] Unit 11 (Controller live commands) — E1-E6
- [ ] Unit 12 (Results, corrections, export) — F1-F3
- [ ] Unit 13 (Team stage rotation relay) — G1, G2
- [ ] Unit 14 (Team stage partition collaboration) — H1
- [ ] Unit 15 (School ranking) — I1
- [ ] BLD-052 (School management) — K1
- [ ] BLD-051 (Scoring configuration) — L1
- [ ] BLD-050 (Delete a competition) — M1
- [ ] BLD-053 (Language switcher) — N1
- [ ] BLD-054 (Visual design pass) — O1

## Known limitations of this guide, as of 2026-10-16

- ~~**No real populated participant file exists.**~~ **Corrected 2026-10-15: it does — `选手信息.xlsx` has 3 real rows, already imported successfully.** A8 shows you how to hand-add a few more on top if you want a bigger sample for a fuller test run.
- **Teams only exist because the seed script hand-creates them.** No screen or API anywhere lets a controller form, name or edit a team (Finding 11) — `U-102` (random mixed-school team formation) is still open with the stakeholder. Sections G/H/I above only work because section 0's seed script does what no application code does yet.
- **Scoring configuration (section L) has no UI at all** — by design, per BLD-051's decision, not an oversight to report.
- **The automated suites cover more edge cases than this guide does** (concurrency, idempotency under retries, exact error codes) — this guide is for confirming the system *behaves*, not for regression coverage; see `backend/tests/` and `frontend/tests/` for that.
