> **[CONTEXT FEEDER NOTE]** Working file of the requirements process (interview record, open questions, question pack). It FEEDS the `context/` folder and contains superseded statements. Do NOT read it to decide what to build.

# Interview Notes (working draft)

> Raw answers from the pre-build interview (building-with-ai protocol).
> Source for the real context files. NOT one of the final context files.
> Delete or archive once the context files are approved.
>
> Status tags: **[C]** confirmed by stakeholder · **[P]** proposed, approved in stakeholder's blanket answer ·
> **[S]** stated in client's original document, not re-confirmed · **[T]** team decision, not reviewed by stakeholder ·
> **[A]** assumed, awaiting confirmation · **[O]** open · **[L]** later phase.
> Decision IDs in brackets (e.g. PAR-006, U-03, I-06) come from the user's answers.
>
> **RULE (set by the user): assume nothing.** Ask until the answer is clear. Only a clear answer is recorded as an
> answer. Anything else is logged in `_open-questions.md` and revisited at the end. A "suggestion on record" below is
> what someone wrote down, NOT an answer, and must not be used as a decision. Only **[C]** items are confirmed by the
> stakeholder; every other tag is still to be re-confirmed (see section E of `_open-questions.md`).

Interview progress: Step 1 done · Step 2 done · Step 3 done (answers below; team questions answered, none settled) · Group 4 (venue) answered, none settled · Step 4 answered, none settled · Step 5 answered (module list and access rules not final) · Step 6 answered (little documented) · Step 7 and workflow items answered (nothing decided). All interview steps asked; readiness check not passed.

Unanswered or assumed items are tracked in `_open-questions.md` (to be re-asked to the stakeholders).

> **Update (2026-09-26, later).** A document from the project (`decisions-for-the-context-builder.md`, since transferred and removed) stated that the Part 1 decisions (Q1 to Q6) and a set of build and engineering decisions were **confirmed by the stakeholder**. The sections below carry the earlier status ([T], project owner in the stakeholder's role) and some items that have since been answered.
> **The current source is `competition-rules.md` and `architecture.md`**, where those decisions are tagged [C]. Backend language and framework, developers' skills, names and roles, who builds what, and where the server runs are left blank on purpose (TBD — to be decided by the project owner).

---

## Step 1 — What and why

- **Product:** web app, working name **Sudoku Arena [T]**. Runs a school Sudoku competition digitally, following the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League. [S]
- **Problem:** many Sudoku competitions in China are paper-based: printing, room prep, collecting answer sheets, manual correction and ranking. Human error, little real-time view of progress, grows with participant count. [S]
- **Aim:** digitalize the *operational process* of running a competition. Not an online Sudoku game. [S]
- **MVP scope:** one organizing institution (school/university), single-tenant. [C] (ENV-007, ENV-008). Multi-tenant SaaS is the long-term vision, deferred not cancelled. [L]
- **Users (four ends):**
  - Players: students, in person, on school learning tablets with Quark Browser. [C] (PAR-006)
  - Controller (控制员): runs the event, assumed to be the administrator. [A] (ROL-001) — which user is primary: OPEN, the documents do not say (U-52)
  - Judges: at least 30, each with a range of participant numbers. [C] (EVT-001)
  - Big screens: 10, showing rankings and close-ups. [C]
- **One sentence (working wording written by Claude, NOT from the documents, not an answer):** lets a school run a live, in-person Sudoku competition on tablets, from setup through automatic scoring and ranking to a big-screen display, without paper.
- **Team:** two developers, ~15 days, junior team, so the design must stay easy to understand. [T]
- **Client side:** one stakeholder answers business questions; approved team proposals as a whole; working principle: "make customizable whatever can be customized, and operate the rest directly". [C] Project owner made the single-tenant decision (ENV-007).
- **PENDING (I-17):** names/roles of developers, business lead and project owner are not in the documents. The project owner must supply them.

---

## Step 2 — Core flows and features

### Core flow — setup (controller)
1. Controller logs in with username + password. [T]
2. Creates competition: name, description, category, participant Excel, question PDF. [T] One event can hold several categories at once. [P] (EVT-002)
3. System validates Excel as a whole; invalid file commits nothing. Creates participants, teams, accounts; generates participant numbers and credentials. [T]/[P] (PAR-001)
4. Controller exports credential slips, printed. [C] (PAR-002)
5. Imports question PDF: strict predefined format, no OCR; any failure rejects the whole import. [T]
6. Judges (≥30) each have a range of participant numbers. [C]/[P] (EVT-001, ROL-003) Who assigns each judge's range, and when: OPEN (U-53).
7. Publishes. System refuses if anything is missing. Publishing generates entry link/QR and big-screen link, and locks the structure. [T]/[S]

### Core flow — event day
8. All big screens open from one shared link, no login. [C] (BSC-001) Who opens the link, and who hands out the slips and tablets: OPEN (U-54).
9. Player opens link/QR, logs in with printed credentials, waits in the competition room. [T]
10. Controller starts a stage; one command starts all categories together. [T]/[P]
11. Player sees a preparation room: round rules + countdown. [T]
12. Round starts; players solve; every move autosaved [C] (PL-006); server owns the time. [T]
13. Player submits, or system submits latest saved state at expiry. [T]
14. System checks, scores, updates ranking. Big screens show ranking; controller can project one student or a whole team. [T]/[C] (BSC-002)
15. Judges watch their own students' status and can restart one student's round. [P] (ROL-003) Controller sees all progress; can pause/resume, end a round early, take over from a disconnected judge, replay a round. [C] (ROL-004, ROL-005)
16. Next round inside a stage starts by itself. [T] The next stage does not start by itself: players see "waiting for the next stage" and the controller starts it (Q6, 2026-09-26, U-35; not confirmed by the stakeholder). The earlier wording "waits for the controller" had been withdrawn as unsourced; it is now an answer.
17. Team stage runs the same way, with rotation first. [C] (TEM-001)
18. Final rankings and school total produced; competition becomes `FINISHED`. [T]/[C] (SCR-004)
19. Controller views results, can correct scores with a reason, exports scores/rankings/answers. [P]/[C] (RES-003, RES-002)
20. Fifteen days later, answers, scores and student accounts are deleted. [P] (RES-004)

(These 20 steps are the event flow, not 20 build units.)

### Rounds
Fixed by regulations [S]:
- **Individual stage**, two rounds:
  - R1 standard Sudoku: 6 questions, 20 min, 100 pts.
  - R2 variant Sudoku (diagonal, killer, jigsaw): 6 questions, 30 min, 100 pts.
  - Finishing early with everything correct: 3 pts/minute (client's figure, customizable). [A] (U-18)
- **Team stage**, two rounds, teams of 4 on tablets:
  - R1 rotation relay. R2 partition collaboration, very probably the stakeholder's "齐心协力". [O] (U-21)
  - Rotation defaults: 10 questions, 10 pts each, rotation every 60 s; ends when queue empty or optional total time reached; all customizable. [C] (TEM-002, TEM-004)
- **School total** = individual × 0.6 + team. [C] (SCR-004)

Round mechanics:
- Structure (stages, rounds, order) is predefined, not admin-defined. Only numeric values customizable by controller before a round starts. [P] (SCR-005)
- Preparation: automatic countdown before each round.
- Puzzle release: students wait for a unified start command; questions preloaded on the tablet so only light commands travel during the round [S]; each question shows its point value.
- Time runs out: latest saved state auto-submitted; empty grid scores 0. No penalty for zero score, no moves, never submitting, or disconnection. [T]
- Scoring: all-or-nothing per puzzle (wrong or blank cell = 0). [C] (SCR-001) Points per question by difficulty, customizable. [C] (SCR-003) Team rounds get no early bonus. [C] (SCR-002)

### MVP features — OPEN (U-07)
The stakeholder has not said which features are essential per role or on the event day. The earlier table of "must exist first"
features was **withdrawn**: it was a selection made by Claude, not documented.
The only documented point is the team's proposal to build the Individual stage first, end to end. [A] Not signed off.

### Out of scope
- Multi-tenant support (and Super Administrator role): deferred. [C] (ENV-007)
- Puzzle authoring/generation: OPEN (U-45; earlier cited as U-43). The earlier statement "authoring is out" was withdrawn: it was treated as out without a source.
  Documented [T]: questions are imported from the predefined PDF, no OCR.
- Long-term results archive: none; deleted after 15 days, controller exports first. [P]/[C] (RES-004, RES-002)
- Languages: English and Chinese both IN [C] (ARCH-026). Whether any third language is in or out: OPEN (U-51). The earlier "third language out" was withdrawn.
- Later/out: PK stage and matching [L]; reusable question bank [L]; buzzer mode (dropped) [C]; configuration center and logic-template upload (rejected); payment; remote/home competitions, camera supervision, proctoring; detailed analytics and comparison reports; generic configurable competition engines; microservices.
- **IN scope (not out):** reconnection after tablet crash — saved grid restored, timer keeps running [T]; continue on another tablet with same login [P] (PAR-005).

### Part 1 decisions by the project owner: Q1 to Q4 of the pack (2026-09-26)
Decided by the project owner, answering in the stakeholder's role. Decisions to build from, tagged [T]; **not yet confirmed by the client's own stakeholder** (do not present them as such). They supersede the group 2 section below for Q1 to Q4.
Full text: "Resolved items" in `_open-questions.md`. Register rows: SCR-006 to SCR-012, SUB-001 to SUB-007 (context-feeders/decisions/project-decisions.md §15.8; not touched here).
- **Terms:** an event has categories; a category has two stages (Individual, Team); each stage has 2 rounds; an Individual round has 6 puzzles.
- **Points and total:** the controller defines the puzzle points before a round; no default split of the 100 is imposed (U-71); the round total is the sum of the question points, calculated; warning before an Individual round if the total is not 100, not blocked; team rounds have no fixed maximum (team score = correct answers times points per question), no warning (U-72).
- **Submission:** once per whole round; free movement and editing; read-only and final after submitting (U-33); confirmation before the final submit, blank puzzles allowed (score 0, the confirmation gives the count) (U-74); after submitting the student sees "accepted" and no immediate score.
- **Judge restart:** one-person rematch; earlier submission and score archived (ROL-005); a judge can restart a student only while the round is running; blank grid and the **remaining** round time on the shared server timer, same deadline as everyone (U-75; corrected 2026-09-26, the earlier "full round time" conflicted with the shared timer);
  if a restart would come too late to be useful, the remedy is the replay of the round (judge or controller); the bonus is measured on the round timer, not a separate clock. Differs from tablet failure recovery (PAR-005).
  A judge may restart the same student as many times as needed while the round is running: no separate limit, no controller approval; each restart archives the earlier attempt (the count stays visible) and the remaining time keeps shrinking (team decision SUB-008). Whether the stakeholder wants a limit: OPEN (U-85).
- **Bonus:** both Individual rounds, none in team rounds; earned when submitted before time ends with every puzzle of the round fully correct, whole minutes (U-47); 3 points per whole minute, controller-changeable (U-18); optional cap in points per Individual round, empty = no cap;
  part of the round score, which can exceed the round maximum, used in the individual ranking and school total (U-73); measured on the server round timer, which stops during a pause; fixed at the student's manual submit; automatic submissions (expiry, early end by the controller) get no bonus (U-78).
- **Round end:** no automatic end when everyone has submitted (U-79). **Values:** whole numbers, question and round scores stored as integers, a question's points at least 1 (no negative, no zero), bonus rate may be 0, times and counts above 0, school coefficient decimal (default 0.6) (U-80).
  **School total:** stored as an exact decimal (not floating point), neither rounded nor truncated, schools ranked on the exact value and shown with decimals; whether the regulation requires rounding is OPEN (U-82).
- **Late submit (Individual rounds):** server clock decides; late manual submit replaced by the automatic submit of the latest autosave; no grace period (U-48); student sees the expired state, no lateness message (U-77).
- **Team rotation:** the 60 s is the interval for moving questions between seats, not a deadline; partly filled grid moves with the question; a submit for a question the tablet no longer holds is rejected; with a total round time only submitted and correct answers count (U-76).
  **Team rotation points:** the controller sets one "points per question" value for the whole rotation round (default 10); team score = correct answers times that value (4 correct give 40 with the defaults). Basis TEM-004 (confirmed rotation rules), extended by a team decision (SCR-015). Different points per question in this round: OPEN, stakeholder (U-84).
- **Preparation countdown (Q5, 2026-09-26):** 60 seconds by default before each round; the controller can change it for each round before that round starts; the preparation screen shows the round's rules and the countdown; the "3, 2, 1, Start" countdown after a pause is separate and does not use round time (U-34). Status not stated by the user; recorded as not confirmed by the client's stakeholder.
  When the countdown reaches zero the puzzles appear immediately and the round timer starts, no extra "3, 2, 1, Start" (REQUIREMENTS §7, [T]). A pause during preparation stops the countdown; on resume the "3, 2, 1, Start" shows first, then the countdown continues from where it stopped, not from 60, and the "3, 2, 1, Start" does not use up preparation time (REQUIREMENTS §7.5, [T]; the last detail is a team decision).
  "Before a round starts" means before that round's preparation begins: once the countdown has started, no numeric value of that round can be changed (points, bonus, times, counts, the countdown length); a change applies to the next round (team decision, clarifies SCR-005).
  The controller cannot end the preparation early; the countdown always runs to zero; a shorter wait is a shorter countdown length set per round before the preparation begins (REQUIREMENTS §7, [T]).
  The controller can change round 2's values at any time before round 2's preparation begins (before the stage starts and while round 1 is running); the window closes the moment round 1 ends, by its timer or because the controller ended it early (SCR-005 [P], RND-002, J-003 [T]; not confirmed by the stakeholder).
  Working position, not confirmed: the round time, preparation length, bonus rate and cap, and other numeric values are set once per round for the whole event, not per category (20 minutes applies to both U8 and U12); question points belong to the questions and follow each category's question set.
  OPEN, stakeholder: do categories have their own question files (U-32); does any category need different round values (U-87).
  The "total is not 100" warning is checked per category and per round (Individual rounds only), names the category and round, and is shown on the setup screen (next to the points, updated as typed) and as a summary when starting the stage; it never blocks. Status not stated; recorded as not confirmed.
  No further follow-ups for Q5.
- **After a stage ends (Q6, 2026-09-26, U-35):** the next stage does not start by itself. When a stage finishes, players see the "waiting for the next stage" state and the controller starts the next stage with the same start command, which starts all categories together. Rounds inside a stage still follow each other automatically. After the last round of the last stage, the competition finishes. Status not stated; recorded as not confirmed by the client's stakeholder.
  The competition finishes by itself when the last round of the last stage ends, once that round's scoring is final; no Finish press at the normal end. The "finish" command exists for finishing early: the running round is ended the same way, then the competition finishes (REQUIREMENTS §7.4, §7.7, [T]/[P]).
  While waiting for the next stage: students' tablets show a waiting message (stage over, next stage coming), no score or rank; when students see their score and rank is OPEN (U-24, U-88). Big screens: the ranking cycle continues, now including the final ranking of the stage that just ended; the controller can switch to any other display at any time.
  Finishing early: unplayed rounds have no scores and add nothing (same as 0); school total = individual part x 0.6 + the team part actually played (0 if the Team stage never started); the running round is scored on the students' latest saved state; results and export carry a visible "finished early" mark.
  It is treated as a normal finished competition (the controller keeps access to the results and can export). No resuming after finishing; for an interruption such as a fire alarm the controller uses pause, then resume. OPEN, stakeholder: awards for an early finish (U-27, U-89); reset after finishing (U-89).
  No further follow-ups for Q6.
- **Students see their score and rank after results are published; none right after a submit** (U-23).
- **OPEN:** whether the question PDF carries the points (U-03 second part; sample PDF to come, do not assume); what "publish results" means and when students see scores (U-24). Also OPEN, stakeholder: whether the regulation requires rounding of the school total (U-82); whether unscored or practice puzzles exist (U-83). (Follow-ups G1 to G4 on judge restart, bonus clock, school total and zero points were answered 2026-09-26 and are recorded above.)
- **Corrections:** the bonus's "everything correct" was first wrongly listed as confirmed (only the wording was; the reading "every puzzle of the round" is now decided). "A submission is the player's final result for that round" came from earlier player requirements; once-per-round is now decided by the project owner.
- **Not covered yet:** Q5 to Q7 of Part 1 and Parts 2 to 7 of the pack.

### Re-asked answers: group 2, scoring and round rules (2026-09-25), superseded for Q1 to Q4 by the section above
- **Round total:** RESOLVED 2026-09-26 as a team decision [T] (basis SCR-003, SCR-005), stakeholder confirmation pending: the maximum score of a round is the sum of its question points, calculated, not a fixed 100.
  The regulation's 100 is the default. If the total differs from 100 the controller sees a warning before the round starts, not blocked. (Earlier answer "don't know" superseded.)
  Follow-ups: the warning applies to the Individual rounds only, until U-72 is answered [T]. OPEN, stakeholder: default split of a round's points across its 6 questions (U-71); where points are set, question PDF, controller or both (U-03; the controller can edit any numeric value before a round, SCR-005; do not assume the PDF carries the points);
  whether team rounds have a fixed maximum (U-72; the 100 is documented only for the two Individual rounds; the rotation defaults are 10 questions of 10 points each, not stated as a fixed maximum).
  Known: regulation says 100 points per round [S]; per-question points customizable [C] (SCR-003).
- **Submission unit:** RESOLVED 2026-09-26 as a team decision [T] (basis PL-007, SCR-002), stakeholder confirmation pending: in the Individual stage a student submits once for the whole round;
  free movement and editing across the 6 puzzles until then; after submitting all puzzles are read-only and final; on time-out the latest saved answers for the whole round are submitted automatically. Team stage rules are separate.
  Basis correction: the confirmed rows (PL-007, FR-PLAYER-008) say only that a player can submit early; FR-PLAYER-010 says a repeated submission changes nothing. The sentence "a submission is the player's final result for that round" is a team statement, so "once per whole round" stays a team decision (U-33).
  Team decisions, not confirmed: the student is asked to confirm before the final submit (U-74, matches UI-001); a judge's restart of one student is a one-person rematch (ROL-005), earlier submission and score archived, not deleted.
  OPEN, stakeholder (U-75): what the restarted round starts with (blank or saved grid) and the time the student gets. (Earlier "don't know" superseded.) Facts below still apply.
  - Answered: one effective submission, repeated submits change nothing [T]; puzzle read-only after submitting [S]/[T];
    free movement and editing until submitting, no live correctness feedback [T]; answer screen has previous, next and question-number buttons [C] (UI-001).
  - Team rotation: a member submits a single question, checked at once [C] (TEM-004).
- **Early-finish bonus** (individual stage only; team rounds get none [C] SCR-002):
  - Answered: whole minutes only (1 min 30 s early = 1 minute) [C].
  - Team decisions [T] 2026-09-26, stakeholder confirmation pending (U-18, U-47): default 3 points per whole minute early, changeable by the controller before a round; applies in both Individual rounds, none in team rounds;
    no maximum defined, with an optional "maximum bonus" setting (empty by default) the controller can set before a round.
  - Wording confirmed [C] (SCR-002): the bonus is earned only when the round is finished before time ends with everything correct, counted in whole minutes. The reading "everything correct means every puzzle of the round is fully correct" is a working reading, NOT confirmed; stakeholder to answer (U-47). (An earlier statement that this was confirmed was wrong.)
  - Team decision, not confirmed (U-73): the bonus is added to the round score, so a round score can exceed the round maximum; the individual ranking and the school total use that score; team rounds have no bonus.
  - Correction: the earlier readings "applies to both individual rounds" and "every puzzle of the round" were inferred, not documented, and are withdrawn.
  - Depends on the submission-unit question: what "finishing" means.
- **Late submission:** RESOLVED 2026-09-26 as a team decision [T] (basis: server-owned timer and expiry auto-submit, REQUIREMENTS §3; closes I-11 technical side), stakeholder confirmation pending (U-48):
  the server clock decides; a manual submit reaching the server after the round timer has ended is not counted as manual, the latest autosaved answers are submitted automatically as at any expiry; no grace period; applies to the Individual rounds only (corrected 2026-09-26: the rotation period is an interval for moving questions between seats, not a deadline).
  OPEN, stakeholder (U-76): team rotation late-submit behaviour: what happens to a partly filled grid when the question moves to the next seat, whether a submit after a rotation is rejected, whether unfinished questions are auto-submitted at the end of the total round time (client text: an error or an unfinished question at timeout earns no points, team stage).
  Team decision, not confirmed: a student whose late submit was replaced sees the same state as any student whose time expired (puzzles read-only, submission shown as received, "no score"); no separate lateness message is defined, whether one is wanted is open (U-77). Meaning of "no score" under clarification (A4c, F1). (Earlier "don't know" superseded.)

### Re-asked answers: group 3, event behaviour (2026-09-25)
- **Preparation countdown length:** SUPERSEDED 2026-09-26 by the Part 1 decisions section above (was: OPEN, "don't know", U-34). Known: automatic; preparation room with rules and countdown [T]; numeric so controller-customizable before a round [P] (SCR-005).
- **Next round / next stage:**
  - Next round inside a stage starts by itself, no judge or controller action [T] (CS-022, J-003). Team decision, not stakeholder-confirmed.
  - Next stage: SUPERSEDED 2026-09-26 by the Part 1 decisions section (was: OPEN, "don't know", U-35). Known: only the controller starts a stage [P] (ROL-003).
- **Event-day features:** OPEN, "don't know" (U-07); stakeholder has not ranked. The only documented point is the team's proposal to build the Individual stage first [A], not signed off.
  (A longer build order given earlier in the interview is not documented and must not be used.)
  Rotation first within the team stage is confirmed [C] (TEM-001). The school total needs both team rounds.
- **Server restart:** accepted behaviour is that after a network or server failure the round is replayed, triggered by judge or controller [C] (ROL-005).
  OPEN: whether a round must continue exactly where it stopped (I-10); tolerable interruption length (U-49).
- **Question delivery / early-viewing risk:** OPEN, "don't know" (I-06 technical, U-50 accepted risk). Known: preloaded on tablets to keep traffic light [S];
  options on the table: encrypted preload with key at start, or fetch at round start with staggering; up to ~300 tablets in one room.
- **Team round 2, "齐心协力":** OPEN, "don't know" (U-05, U-21). Two candidate readings, not settled whether the same: shared board where the team sees and edits each other's entries [O] (TEM-003);
  partition collaboration, one puzzle split into blocks, one tablet per block, team scores when complete [S]. Scoring, number of puzzles and time limit not defined anywhere.

### Open items and suggestions on record
None of the suggestions below is an answer. Do not use them as decisions. All are tracked in `_open-questions.md`.

| Item | Question | Suggestion on record (NOT an answer) | Status |
|---|---|---|---|
| U-03 | Is a round's total fixed at 100 or the sum of question points? | RESOLVED 2026-09-26 as team decision: sum of question points, calculated (see Part 1 decisions, project owner, not client-confirmed) | [T] |
| U-21 | How does 齐心协力 work? | Build rotation first; 齐心协力 later | [O] |
| U-33 | Submission per round or per puzzle? | RESOLVED 2026-09-26 as team decision: once per whole round in the Individual stage (see Part 1 decisions, project owner, not client-confirmed) | [T] |
| U-34 | Preparation countdown length | none (earlier "30 s" withdrawn) | [O] |
| U-35 | Does next stage start by itself? | ANSWERED 2026-09-26: it does not; the controller starts it (see Part 1 decisions); not confirmed by the stakeholder | [T] |
| U-07 | Which features essential on the day? | none; only "Individual stage first" is documented [A] | [O] |
| U-18 | Early-finish bonus 3 pts/min | Team decision 2026-09-26: 3 points per whole minute, controller-changeable (see Part 1 decisions, project owner, not client-confirmed); client's figure [S] | [T] |
| U-45 | Puzzle authoring/generation in or out? | none (earlier "out" withdrawn) | [O] |
| U-08 | Export format | `.xlsx` | [A] |
| I-06 | When to deliver questions (early inspection risk) | none — list options | [O] |
| I-10 | Server restart mid-round | none — list options | [O] |
| I-11 | Manual submit arriving just after deadline | none — list options | [O] |

The earlier "product-level constraints" for I-06, I-10 and I-11 (no early inspection, a restart must not lose the event, a fair last few seconds) were **withdrawn**. They are not documented.

---

## Step 3 — Stack and technology

### Team decisions [T], NOT the stakeholder's — recorded status
The user could not re-confirm these; the team and the project owner must say what, if anything, stays open.
- React + TypeScript frontend (ARCH-020); PostgreSQL for durable data and Redis for runtime state (ARCH-021); WebSocket (ARCH-022): register status "Confirmed (2026-09-23)", as team decisions. The stakeholder did not decide the technology.
- Modular monolith, one deployable system (ARC-001, ARC-002): "Working Position (team decision)". Event scope inside the monolith: OPEN (I-08); both developers are to record their acceptance there.
- API contract and data model (ARCH-023): "Working Position", a starting point, not final.

### Not decided
- **Backend language/framework [O] (I-02, register row ARCH-024).** Undecided. No option is recorded as chosen or recommended. The register says only that React/TypeScript suggests a Node.js backend, without confirming it.
- **Developer skills [O] (I-18):** not in the documents (I-18 now names real-time applications, PostgreSQL and Redis). The project owner or the developers must supply them.
- **File storage [O] (I-19):** not decided.
- **Hosting [O] (I-03):** undecided, including whether to run an on-site server on the venue network as fallback. Venue internet and Wi-Fi strength unknown; ~300 tablets in one room on venue Wi-Fi is the biggest real-world risk [A] (U-06). Pending: venue network, internet, who hosts.

### Scale
- ~600–720 students, 11 rooms (10 of ~30 + one of ~300, which is ~600, not 720), ≥30 judges, 10 big screens [C] (EVT-001). Exact numbers OPEN (U-02).
- Teams: count not on record. Rule on record: each school has exactly one team per category [C] (SCR-004). Schools and number of categories used: not on record. Categories run from U6 to U20 [T].
- Sessions run together, one command starts all categories. Design/test target of ~800 clients: listed under [C] (EVT-001) in the group 4 answer, but earlier recorded as a suggestion; status to verify.
  Autosave rate of about 2 grid saves per second per player is documented [T]; the load target (about 800 clients, about 2 saves per second) is also listed as an open point (I-05). The two statements are not reconciled. Ceiling not confirmed (U-60).

### Data
- Documented: PostgreSQL and Redis, as team decisions [T]. The earlier "no objection to a relational database" and "keep Redis" were Claude's opinions and are withdrawn.
- File location (Excel, PDF, exports): the documents do not mention file storage. New internal item I-19. Original question PDF kept with the competition [A]; export assumed `.xlsx` [A] (U-08).

### Authentication
- Username + password for player, judge, controller [C] (PAR-002). No OTP, nothing beyond that. Separate login endpoints per role [T].
- Session length: not decided [O] (I-16). (The earlier "must survive the whole round and a page refresh" was withdrawn.)
- One active device per account, newest login takes over [P] (PAR-005): proposed by the team, approved in the stakeholder's blanket answer without discussing the detail; not an explicit stakeholder decision.
  Known from PAR-005: a student whose tablet fails can continue on another tablet with the same login, with saved answers and remaining time carried over.
- Big screens: one shared link, no login [C] (BSC-001).

### Devices
- Quark Browser on learning tablets (学练机), landscape, with a "please rotate" screen [C].
- Model and version unknown, no test unit [O] (U-06). Suggestion on record (NOT an answer): assume a modern Chromium-based Android browser [A]. The earlier "please add a compatibility check" was withdrawn. The documents say only that a test on a real tablet was proposed as a team default (U-06).

### Pending for stakeholder (group 4 answered 2026-09-26: none settled)
- U-06: tablet model, Quark version, test unit.
- U-02: exact numbers of students, teams, schools, rooms.
- U-06, U-46: venue internet, Wi-Fi strength and device capacity in the ~300-tablet room, own router or on-site server allowed.
- U-46: where the server runs, who sets it up and runs it, on-site fallback server wanted or not. Internal side: I-03.

---

## Step 4 — Technical complexity (answered 2026-09-26; none settled, all need the stakeholder)

- **Risks:** no risk assessment in the documents; which parts the stakeholder considers most risky is OPEN (U-56).
  Documented technical open points (unranked): venue Wi-Fi and tablet model/Quark version (U-06); load target of ~800 clients at ~2 saves/second (I-05); request burst at round start if questions are fetched then, up to ~300 tablets in one room (I-06);
  server restart mid-round (I-10); submit just after the timer ends (I-11).
  Handled: a failed round is replayed; the stakeholder believes the network is the most likely cause [C] (ROL-005).
  Failure cases the team plans to test [T]: disconnect/reconnect, timer expiry, manual and duplicate submission, pause/resume, early round end, early finish, many players at once, team scoring, tie-breaks, big-screen synchronization, invalid participant or question file.
- **External systems:** none described in the documents (no SMS, email or student-ID system mentioned). Whether any is needed: OPEN (U-57).
- **Performance:** autosave ~2 grid saves/second per player [T]; 3-minute ranking cycle on the big screen [T]; provisional ranking updates immediately when a round result is finalized, without waiting for everyone [T].
  Response times for ranking update after a submit and for all tablets starting together: not defined, OPEN (U-58).
- **Security and data:**
  - Server decides time, submission validity, score and rank; the client is never trusted [T]. One active device per account [P] (PAR-005).
    Judge sees how many times a student left the answer page, information only, no penalty [P]. Remote-competition security and proctoring out of scope [S] (ENV-005).
  - Anti-cheating beyond that: not defined, OPEN (U-37). What must be protected and legal/school rules for student data: OPEN (U-59). Related: 15-day deletion [P] (RES-004); where data must live is open (U-46).
- **Scale:** ~600–720 students and a design/test target of ~800 clients [C] (EVT-001); the client's original document aimed at 1000+ devices and 3000 concurrent users for the full platform [S].
  Whether 800 is the maximum for this version: OPEN (U-60).
- **Reliability:** failed round is replayed [C] (ROL-005); saved grid restored on reconnection [T]; on-site server on the venue network kept as an option [O] (I-03).
  Tolerable failure and backup plan (paper is not mentioned anywhere): OPEN (U-61, with U-49 and U-46).

---

## Step 5 — Boundaries and rules (answered 2026-09-26; details in `_open-questions.md` section H)

- **System boundaries [T], not final (I-01):** one deployable backend, modular monolith, nine modules: Competition; Participant/Identity; Question; Stage/Round; Gameplay/Player State; Orchestrator; Scoring; Ranking; Big Screen.
  The client's "control hub" (takes judge and controller commands, applies the arbitration rule, broadcasts state) lives inside Orchestrator and Big Screen [S]. Frontend: one React app, role-based areas, laid out by feature [T].
  The module list was written for one judge and one category; it has no module for team rotation, score corrections, the 15-day purge, import/export, competition copy, participant numbering, judge ranges and takeover, or several synchronized big screens. OPEN (I-01).
  Also OPEN: events vs direct calls between modules (I-08); backend language and folder structure (I-02); file storage (I-19).
- **Invariants:**
  - [C]: a repeated submission never changes the result (PL-009); validation, scoring, results and ranking are automatic (EX-001 to EX-004); the judge does not determine or calculate rankings (EX-005).
  - [T]: server owns state, timer, validity, scoring, ranking and eligibility, client never trusted (ENV-006 "Working Position"); one owner per state; internals only via public interface; durable results in PostgreSQL, never only Redis;
    autosave never triggers scoring; a round transition only after final scoring; big screen never calculates rankings; an early round end cannot be undone; the client is never an authority.
  - [P]: scores change only via a controller correction with mandatory reason and a change log (RES-003); a rematch archives old scores, never deletes them (ROL-005); numeric values customizable by the controller only, before a round starts (SCR-005);
    15 days after the competition answers, scores and student accounts are permanently deleted, setup, questions and judges kept (RES-004).
  - OPEN (U-62): whether archived scores and the correction log are also deleted after 15 days.
- **Access control:** documented for player [C] (PL-001), judge [P] (ROL-003) / [T], controller [C] (ROL-002, ROL-004) and big screen [S] / [T]. Who can read and change what is not written as a rule: OPEN (U-63, with U-55 for judge powers).
- **Roles:** player, judge, controller (also called admin), big screen [S]. Super Administrator deferred [L] (SA-005); no role above the controller documented.
  OPEN: one person with several roles (U-64); controller = admin is assumed [A] (ROL-001, U-11); more than one controller is unconfirmed and conflicts with the older "exactly one admin" rule (U-11, OA-002).

---

## Step 6 — Design (answered 2026-09-26; details in `_open-questions.md` section I)

- **Visual language, school brand:** nothing documented; OPEN (U-65).
- **Component library, icons, fonts:** frontend is React + TypeScript [T] (ARCH-020); no UI library, icon set or font documented; team decision OPEN (I-20). Chinese text rendering on tablets undocumented, depends on tablet model and Quark version (U-06); font/Chinese-display requirements OPEN (U-70).
- **Answer screen [C] (UI-001):** landscape; puzzle left, number pad right; previous, next, question-number buttons; delete (clears selected cell) and clear-all (restarts the puzzle), both with confirmation; each question's point value shown [S].
- **Player states [T]:** competition room, preparation room (rules + countdown), active round, read-only after submitting, waiting; the pause notice is a blocking message.
- **Big screen:** ranking cycle every 3 minutes, paginated when it does not fit [T]; one-student close-up and team view split into 2 to 6 sections [T]; "Competition Paused" and finished displays;
  controller can show a category leaderboard, school ranking or close-up, optional rotation between categories [C] (BSC-002);
  columns: individuals rank/name/score/completion time; teams rank/team name/score/completion time; school ranking rank/school/total.
- **Judge and controller content (not layout):** judge sees own students' status, stage, round, remaining time and live ranking; controller has the command list in ROL-002 to ROL-005.
  Layouts of judge, controller and big screens, and of login, competition room, preparation, waiting and results screens: OPEN (U-66).
- **Devices:** answer screen landscape with a "please rotate your device" screen when upright [C] (UI-001, PAR-006). Screen sizes and orientations for tablets, judges' and controller's devices, big screens: OPEN (U-67, with U-06).
- **Bilingual UI:** English and Chinese, not one or the other; translation mechanism planned in from the start [C] (ARCH-026); messages such as the pause notice written in both languages [T].
  Per user, per event or both at once, and the default: OPEN (U-68).
- **Accessibility and interaction:** nothing documented (touch target sizes, contrast, keyboard use, autosave-failure feedback); OPEN (U-69).

---

## Step 7 and workflow items — Build order (answered 2026-09-26; details in `_open-questions.md` section J)

- **Buildable units:** none documented; OPEN (I-21). Only sequence on file: the team's earlier 15-day plan, "for reference" and "to be reworked" [T] (ARCHITECTURE §9):
  1 Foundation; 2 Competition setup and imports; 3 Question system; 4 Runtime; 5 Scoring and ranking; 6 Big screen; 7 Integration and failure cases; 8 Stabilization (no new features).
  It is out of date: no team rotation, several categories, judge ranges, corrections, purge, export or copy (I-01). "Individual stage first, end to end" is only a proposal in U-07, not signed off.
- **Order and dependencies:** not documented; OPEN (I-21). The old plan puts an authentication foundation in days 1 to 2 and setup/imports (days 3 to 6) before runtime (days 7 to 9), as a reference plan [T], not a rule. No document says security must come before functionality.
  Rule for unknowns [T]: an unknown is an implementation detail unless it changes the domain model, state machine, scoring or ranking, authentication, question format, or a critical API/WebSocket contract; only those need a decision before coding.
  Needed before coding (REQUIREMENTS §12): I-01, I-06, I-10, I-11, I-14, I-15 (I-14 and I-15 not described in the answer).
- **Definition of done:** no per-unit rule; OPEN (I-22). Documented: MVP acceptance scenario; failure and edge-case test list [T]; extended scenario with the stakeholder's additions [A], to confirm (REQUIREMENTS §13).
  Edge cases include disconnect/reconnect, timer expiry, duplicate submission, pause/resume, many players at once, tie-breaks, invalid files. Additions still to add: rematch, takeover, corrections, several categories, 15-day purge.
- **Who builds what:** reference split [T] (ARCHITECTURE §9): one developer takes competition lifecycle, orchestrator, judge and controller APIs, WebSocket state, server timer; the other takes player UI, gameplay grid, submission UI, scoring and ranking, big screen; both share database model, authentication, integration, testing.
  OPEN (I-23): it predates the stakeholder's answers; names and skills not recorded (I-17, I-18); both developers still to record acceptance (I-08).
- **Workflow (all OPEN):** environment (I-24; only "environment configuration" as stabilization work); git branching and PR rules (I-25); CI (I-26); review by AI, automated checks or human (I-27); team meeting rhythm (I-28; "integrate every day" is not a meeting rule).

---

## Corrections received (2026-09-25)

The user sent corrections to earlier answers. Each item below was applied above and is now OPEN or withdrawn. Nothing here is an answer.

- **Step 1:** "controller/organizer is the primary user" withdrawn; the documents do not say. OPEN (U-52). The one-sentence summary was Claude's wording, not the documents'.
- **Step 2 flow:** who assigns each judge's range and when: OPEN (U-53). Who opens the shared big-screen link and who hands out slips and tablets: OPEN (U-54).
  "Next stage waits for the controller" withdrawn (U-35 still open).
- **Rounds:** "30 seconds" (preparation length) and "sum of question points" (round total) withdrawn (U-34, U-03 open).
- **MVP features table:** withdrawn (U-07 open). Only "Individual stage first" is documented, and it is not signed off.
- **Out of scope:** "puzzle authoring is out" and "a third language is out" withdrawn (U-45, new U-51).
- **Step 3:** "no objection to a relational database", "Option A fits", "revisable only with a reason", "please add a compatibility check" and the constraints on sessions, I-06, I-10 and I-11 withdrawn.
  File storage: not in the documents, new internal item I-19. Backend language stays open (I-02).
- **Roles:** the explanation of why the controller took over is withdrawn (the change is documented, its reason is not). No such statement was found in these notes to remove.
  Exact judge powers beyond their own students: OPEN (new U-55).
- **Group 2:** A3's readings "both individual rounds" and "every puzzle of the round" were inferred and are withdrawn (U-47 now asks both). A1 and A2: treat as "don't know".
- **IDs:** the corrections cite U-45 for puzzle authoring (earlier cited as U-43) and U-47 for both A3 items (earlier cited for the cap). Verify the IDs against the source register.
- **Not touched:** `context-feeders/requirements/` and `context-feeders/decisions/`. The correction about a statement in `REQUIREMENTS.md` concerns those files and was not applied here.
