# Open Questions — to ask again before the context files are final

> Questions from the pre-build interview that were **not answered, or answered only with an assumption**.
> Purpose: bring these back to the stakeholders (and settle the team-only ones) so the context files
> are complete enough to code from. The README rule applies: a coding agent that meets an unanswered
> question will guess, so none of these may stay open once specs are written.
>
> The stakeholder-facing items are collected in `_stakeholder-question-pack.md` (36 questions plus a re-confirmation table).
> Answers received go back into this file first, and then into the draft context files (`project-overview.md`, `competition-rules.md`, `architecture.md`, `ui-context.md`, `progress-tracker.md`, ...), which are updated as answers arrive.
>
> Source: `_interview-notes.md`. IDs in brackets (U-03, I-06, ...) are references from the user's
> answers only; each question is written in plain words so this file stands on its own.
> **RULE (set by the user): assume nothing.** Ask until the answer is clear; if it stays unclear, it is kept here
> and revisited at the end. A "suggestion on record" is what someone wrote down, NOT an answer, and is not used.
> Status: OPEN = no clear answer yet · ANSWERED = clear answer recorded below.
>
> When a question is answered: write the answer and date in its "Answer" line, set status to ANSWERED,
> and update the matching section of `_interview-notes.md` and the final context files.
> A question is marked RESOLVED only when the answer is clear enough for a developer to build from it. Its status tag
> (stakeholder-confirmed, or team decision awaiting confirmation) is always recorded with it.

## Resolved items

Resolved points were moved out of this file on 2026-09-26. The decisions are in `competition-rules.md` (tagged [T], not client-confirmed); the client's confirmation of them is carried by rows R15 to R28 of `_stakeholder-question-pack.md`. This file now lists only what is still open.

Last updated: 2026-09-26, after the resolved points were removed (they live in `competition-rules.md`). All interview steps asked; readiness check not passed.

---

## A. Questions for the stakeholder

Priority 1 = changes the data model or scoring, needed **before the schema is approved**.
Priority 2 = affects behaviour or specs, needed before the affected spec is written.
Priority 3 = confirmations and later-phase items.

### Priority 1 — scoring and round rules

Pack Q1 to Q4 (points and total, submission, early-finish bonus, late submit) were decided on 2026-09-26 by the project owner, answering in the stakeholder's role. The decisions are in `competition-rules.md` ([T], **not yet confirmed by the client's own stakeholder**, pack R15 to R28).

**Still open from this part**

**A1c. Do the question PDFs carry the points? (U-03, second part)** — OPEN, project owner
- The project owner will come back with a sample PDF. Do not assume the PDF carries the points.
- Answer: _

**A4d. When may students see their score? (U-24, U-88)** — OPEN, stakeholder
- What does "publish results" mean, and when exactly do results count as published? (Decided: students see their own score and rank after the results are published, and no score right after a submit, U-23.)
- Answer: _

### Priority 2 — event behaviour

**A5f. Do the categories have their own question files? (U-32)** — OPEN, stakeholder
- Answer: _

**A6d. Finished early: awards, and reset after finishing (U-27, U-89)** — OPEN, stakeholder
- Do awards apply when a competition is finished early? Can the controller reset (rematch) after the competition has finished?
- Answer: _

**A8. Server restart during a round (I-10)** — Priority 2 — PARTLY RESOLVED (2026-09-26)
- Decided [C] (BLD-007): a replay is acceptable. Round state changes are kept in PostgreSQL and the working grids in Redis with persistence on. After a restart the competition comes back paused, so the controller chooses to resume or replay (see `architecture.md`).
- **Still OPEN (U-49):** how long an interruption during a round is acceptable.
- Answer: _

**A10. Team round 2, "齐心协力" (U-21)** — Priority 2 — OPEN (deferred)
- Question: What exactly is the second team round? Is it the partition-collaboration round (team members each solve part of one grid)? How does scoring work?
- Suggestion on record (NOT an answer, not used): build the rotation round first; treat this round as a later phase.
- Answer (2026-09-25): **"Don't know."** Still OPEN (U-05, U-21).
- Known, and it is not settled whether these two are the same round:
  - The stakeholder's own words suggest a shared board where the whole team sees and edits each other's entries. [O] (TEM-003)
  - The client's partition collaboration splits one puzzle into blocks, one tablet per block, and the team scores when the whole puzzle is complete. [S]
- Not defined anywhere: scoring, number of puzzles, time limit.

### Priority 3 — confirmations

**A11. Puzzle authoring/generation (U-45; earlier cited as U-43)** — Priority 3 — OPEN
- Question: Is creating, generating or editing puzzles inside the app in scope or out of scope? Documented [T]: questions are imported from the predefined PDF, with no OCR.
- Suggestion on record: none. The earlier "authoring is out" was withdrawn.
- Answer: _

**A12. Export format (U-08)** — Priority 3 — OPEN
- Question: Confirm exports (scores, rankings, answers) are Excel `.xlsx` files. Any required layout or columns?
- Suggestion on record (NOT an answer, not used): `.xlsx`.
- Answer: _

**A13. Data protection for student data** — Priority 3 — OPEN (Step 4, not yet answered)
- Question: Are there legal or school rules for storing student data (names, answers, login accounts)? The plan is to delete answers, scores and student accounts 15 days after the event, after the controller exports what it needs. Is that acceptable, and who must approve it?
- Answer: _

**A14. Written approval of requirements (Step 8)** — Priority 3 — OPEN
- Question: Will the stakeholder approve the summarized requirements in writing before the specs are written? Who signs, and when?
- Why it matters: the README makes this a mandatory gate for client projects.
- Answer: _

**A15. Third language (U-51)** — Priority 3 — OPEN
- Question: English and Chinese are both in [C]. Is any other language in or out of scope?
- Suggestion on record: none. The earlier "a third language is out" was withdrawn.
- Answer: _

**A16. Primary user (U-52)** — Priority 3 — OPEN
- Question: Which of the four ends (player, controller, judge, big screen) is the primary user of the product?
- Suggestion on record: none. The documents list four ends and a business goal of reducing the organizers' effort, without naming a primary user. The earlier "the controller" was withdrawn.
- Answer: _

**A18. Who opens the big-screen link and hands out slips and tablets (U-54)** — Priority 2 — OPEN
- Question: All screens open from one shared link. Who opens it on the screens? Who hands out the credential slips and the tablets?
- Suggestion on record: none. The earlier "the controller opens the link" and "the slips go out with the tablets" were withdrawn.
- Answer: _

**A19. Judge powers beyond their own students (U-55)** — Priority 2 — OPEN
- Question: Beyond watching their own students and restarting one student's round, what else can a judge do or see?
- The register lists this as open.
- Answer: _

---

## B. Facts needed from the stakeholder or venue

**B1. Exact participant numbers (U-02)** — OPEN
- Question: How many students, teams, schools and rooms exactly? The numbers given (about 600–720 students; 11 rooms: 10 of about 30 and one of about 300) do not add up.
- Why it matters: sizing, test data, and load targets.
- Suggestion on record (NOT an answer, not used): design and test for about 800 clients. The group 4 answer lists this target as on record under [C] (EVT-001); whether the [C] covers the 800 figure itself is unclear. To verify. The group 5 answer again lists it as [C] (EVT-001), while also listing the load target of about 800 clients and 2 saves per second as an open point (I-05). The two statements are not reconciled.
- Answer (2026-09-26): **Stakeholder still has to give the exact numbers.** Still OPEN (U-02).
- On record [C] (EVT-001): about 600–720 students; 11 rooms (10 of about 30 students and 1 of about 300, which comes to about 600, not 720); at least 30 judges; 10 big screens.
- Teams: the count is not on record. The rule on record: each school has exactly one team per category. [C] (SCR-004)
- Schools and categories: not on record. Categories run from U6 to U20 [T], but the documents do not say how many are used.

**B2. Tablets and browser (U-06)** — OPEN
- Question: Which tablet model (学练机) and which Quark Browser version? Can we get a test tablet before the event?
- Why it matters: decides what web features are safe to use.
- Suggestion on record (NOT an answer, not used): assume a modern Chromium-based Android browser. The earlier "please add a compatibility check" was withdrawn; the documents say only that a test on a real tablet was proposed as a team default.
- Answer (2026-09-26): **Stakeholder still has to answer.** Still OPEN (U-06).
- Known: students use Quark Browser on learning tablets (学练机). [C] (PAR-006)
- OPEN: tablet model; Quark version; whether a test tablet is available before the event.

**B3. Venue network (U-06)** — OPEN
- Question: Does the venue have internet? How strong is the Wi-Fi in the room with about 300 tablets, and how many devices can it handle at once? Can we run our own Wi-Fi router or on-site server?
- Why it matters: the biggest real-world risk. Decides whether the app must work on a local network only.
- Answer (2026-09-26): **Stakeholder still has to answer all of it.** Still OPEN (U-06, U-46): internet at the venue; Wi-Fi strength in the room with about 300 tablets; how many devices it handles at once; whether we may bring our own router or an on-site server.

**B4. Hosting (I-03)** — OPEN
- Question: Where does the server run on the day: a school server on the venue network, a cloud server in China, or elsewhere? Who is responsible for setting it up and running it? Is an on-site fallback server wanted?
- Answer (2026-09-26): **Stakeholder still has to answer.** Still OPEN (U-46): where the server runs on the day; who sets it up and runs it; whether an on-site fallback server is wanted.
- Internal side: hosting and infrastructure are undecided, including the option of an on-site server as a fallback. OPEN (I-03).

---

## C. Team decisions (not for the stakeholder — but blocking)

**C1. Developers' skills (I-18)** — OPEN
- Question: What languages and frameworks do the two developers already know well? What is their experience with real-time apps, PostgreSQL and Redis?
- Why it matters: this counts for more than any technology comparison and determines the stack.
- Answer (2026-09-25): **Not in the documents.** Still OPEN (I-18, extended to name real-time applications, PostgreSQL and Redis). The project owner or the developers must supply it.

**C2. Backend language and framework (I-02)** — OPEN
- Question: Which backend language and framework?
- Already decided [T]: React + TypeScript frontend, PostgreSQL, Redis, WebSocket, modular monolith.
- No option is recorded as chosen or recommended. The decision is the team's.
- Answer (2026-09-25): **Not decided.** Still OPEN (I-02; register row ARCH-024). The register says only that the React/TypeScript choice suggests a Node.js backend but does not confirm it.

**C3. Team names and roles (I-17)** — OPEN
- Question: Who are the two developers, the business/client lead and the project owner?
- Why it matters: the README requires team roles to be defined before the build starts.
- Answer (2026-09-25): **Not in the documents.** Still OPEN (I-17). The documents record only two junior developers [T], a stakeholder on the client side, and a project owner who made the single-tenant decision (ENV-007). The project owner must supply the names and roles.

**C5. Session length and login rules** — OPEN
- Question: How long should a login session last? (The earlier "it must survive a whole round and a page refresh" was withdrawn.) Documented [P] (PAR-005): one active device per account, the newest login takes over. Do you confirm?
- Suggestion on record (NOT an answer, not used): none for length.
- Answer (2026-09-25), split in two:
  - **Session length: not decided.** Still OPEN (I-16).
  - **One active device per account, newest login takes over:** recorded [P] (PAR-005). The team proposed it and the stakeholder approved it in the blanket answer, without discussing the detail. It is not an explicit stakeholder decision, so it stays to be re-confirmed (E2).
  - Known from PAR-005: a student whose tablet fails can continue on another tablet with the same login, with saved answers and remaining time carried over.

**C7. Internal-only status tags** — OPEN
- Question: The context files keep the status tags ([C], [P], [S], [T], [A], [O], [L]). Confirm this format and whether decision IDs stay as references.
- Answer: _

---

## D. Step 4: technical complexity and non-functional requirements

Asked 2026-09-26 as group 5. Answered with what the documents hold; **every item below still needs the stakeholder** and stays OPEN.

- **D1. Risks (U-56)** — OPEN
  - Question: what are the most risky or complex parts, and what could go wrong on the event day?
  - Answer (2026-09-26): no risk assessment exists in the documents. Which parts the stakeholder considers most risky: the stakeholder still has to answer (U-56).
  - Documented technical open points, listed without ranking: venue Wi-Fi, and the tablet model and Quark version, both unknown (U-06); the load target of about 800 clients sending roughly 2 grid saves per second (I-05);
    a burst of requests at round start if questions are fetched then, with up to 300 tablets in one room (I-06); a server restart mid-round (I-10); a submit that arrives just after the timer ends (I-11).
  - Documented as handled: after a network or server failure the round is replayed, and the stakeholder believes the network is the most likely cause. [C] (ROL-005)
  - Failure cases the team plans to test [T]: disconnect and reconnect, timer expiry, manual and duplicate submission, pause and resume, an early round end, an early finish, many players at once, team scoring, tie-breaks, big-screen synchronization, an invalid participant or question file.
- **D2. External systems (U-57)** — OPEN
  - Question: does the system need to connect to anything beyond the tablets and screens (for example SMS, email, a school student-ID system)?
  - Answer (2026-09-26): the documents describe no connection to anything beyond the tablets, the judges' and controller's devices and the big screens, and say nothing about SMS, email or a student-ID system. Whether any is needed: the stakeholder still has to answer (U-57).
- **D3. Performance (U-58)** — OPEN
  - Question: what response times must hold (ranking update after a submit, all tablets starting together, others)?
  - Documented: an autosave rate of about 2 grid saves per second per player [T]; a 3-minute ranking cycle on the big screen [T]; a provisional ranking that updates immediately when a round result is finalized, without waiting for every participant. [T]
  - Not defined: how quickly the ranking must update after a submit, how quickly all tablets must start together, any other response time. The stakeholder still has to answer (U-58).
- **D4. Security, cheating and student data (U-37, U-59)** — OPEN
  - Question: what must be protected, how should cheating be prevented, and are there legal or school rules for student data?
  - Documented: the server decides the time, the validity of submissions, the score and the rank, and the client is never trusted [T]; one active device per account [P] (PAR-005);
    the judge sees how many times a student left the answer page, as information only, with no penalty [P]; remote-competition security and proctoring are out of scope [S] (ENV-005).
  - Anti-cheating beyond that: not defined. The register has only a team assumption that it is kept light, not confirmed by the stakeholder. OPEN (U-37).
  - What must be protected and any legal or school rules for student data: none recorded. The stakeholder still has to answer (U-59). Related facts only: the 15-day deletion [P] (RES-004) and that where the data must live is open (U-46).
- **D5. Scale (U-60)** — OPEN
  - Question: is the current client count the ceiling for this version?
  - Documented: about 600–720 students and a design and test target of about 800 clients [C] (EVT-001). The client's original document aimed at 1000+ devices and 3000 concurrent users for the full platform [S].
  - Not stated: whether 800 is the maximum for this version. The stakeholder still has to answer (U-60).
- **D6. Reliability and backup plan (U-61, with U-49 and U-46)** — OPEN
  - Question: how much failure can the event tolerate, and is there a backup plan (on-site server, paper)?
  - Documented: a failed round is replayed [C] (ROL-005); a student's saved grid is restored on reconnection [T]; an on-site server on the venue network is kept as an option [O] (I-03).
  - Not defined: how much failure the event can tolerate, and whether there is a backup plan. Paper is not mentioned anywhere. The stakeholder still has to answer (U-61).

---

## E. Statements on record that are not confirmed

These were given as part of the answers but carry a tag other than [C]. Under the "assume nothing" rule they
are not answers until re-confirmed. **[T]** items are to be confirmed by the team (the user); **[P]**, **[S]** and
**[A]** items are to be re-confirmed by the stakeholder. None of them is used as a decision.

- **E1. Team decisions [T] to confirm:** React + TypeScript frontend (one app, role-based areas); PostgreSQL; Redis for runtime state;
  WebSocket; modular monolith; working name "Sudoku Arena"; two developers, about 15 days, junior team;
  login with username and password for the controller; question PDF in a strict predefined format with no OCR and
  the whole import rejected on any failure; whole-file Excel validation with nothing committed if invalid; server owns the time;
  auto-submit of the latest saved state at expiry, empty grid scores 0, no penalty for a zero score, no moves,
  never submitting, or disconnection; the publish check and structure lock; reconnection restores the saved grid with the timer running;
  a preparation room before each round.
  - **Answer (2026-09-25):** the user could not confirm them and gave their recorded status instead. The team and the project owner must say which, if any, should stay open. The documents list only the backend language as open.
    - React with TypeScript (ARCH-020), PostgreSQL for durable data and Redis for runtime state (ARCH-021), WebSocket (ARCH-022): register status "Confirmed (2026-09-23)", as team decisions. The stakeholder did not decide the technology.
    - Modular monolith, one deployable system (ARC-001, ARC-002): "Working Position (team decision)". Event scope inside the monolith: OPEN (I-08); both developers are also to record their acceptance there.
    - API contract and data model (ARCH-023): "Working Position", explicitly a starting point and not final.
- **E2. Stakeholder statements [P] to re-confirm:** several categories in one event (EVT-002); participant/team/account generation (PAR-001);
  judges restart one student's round (ROL-003); one active device per account, new login takes over (PAR-005);
  continuing on another tablet with the same login; scores can be corrected with a reason and results exported (RES-002, RES-003);
  deletion of answers, scores and student accounts 15 days after the event (RES-004);
  categories start together with one command; numeric values customizable before a round (SCR-005).
- **E3. Client-document statements [S] to re-confirm:** the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League as the rule source;
  the individual and team round structure (times, question counts, points); questions preloaded on tablets with only light commands during the round;
  the publish step generating the entry link/QR and big-screen link; "digitalize the process, not an online game".
- **E4. Assumptions [A] to re-confirm:** the controller is the administrator (ROL-001);
  the early-finish bonus figure (U-18); export as `.xlsx` (U-08); "Individual stage first" (U-07);
  the venue Wi-Fi as the biggest risk (U-06). (Removed after correction: "the next stage waits for the controller" and "puzzle authoring out of scope".)
- **E5. Later phase [L] to re-confirm:** multi-tenant SaaS, PK stage, and the reusable question bank are deferred, not cancelled.
- **E6. Step 5 statements to re-confirm (see H2):** the [T] invariants (server authority, one owner per state, public interfaces only, durable results in PostgreSQL, autosave never scores, transitions after final scoring, big screen never ranks, early end final, client never an authority) by the team;
  the [P] invariants (score corrections with reason and log, rematch archives, numeric values customizable by the controller before a round, 15-day deletion) by the stakeholder; and the [T] module list, pending I-01.

---

## F. Ask log

Which questions were re-asked, and the outcome. A question stays OPEN until a clear answer is recorded.

- **2026-09-25, group 1 (team):** asked C3 (names and roles), C1 (developers' skills), E1 (confirm the [T] team decisions), C2 (backend language and framework). **No answer given. All four remain OPEN.** To ask again at the end.
- **2026-09-25, group 2 (scoring and round rules):** asked A1 (round total), A2 (submission unit), A3 (early-finish bonus details), A4 (late submission). **Answered later, same day, with "don't know" where unknown.**
  - Still OPEN: A1 (round total), A2 (per round or per puzzle), A3 (value per minute, which rounds, cap), A4 (late submission).
  - New facts recorded, none of them resolving the four questions: see the "Known" and "Answered" lines under each.
  - Two new stakeholder items named by the user: cap of the early bonus (U-47) and the fairness rule for late submits (U-48).
  - To ask the stakeholder at the end.
- **2026-09-25, group 3 (event behaviour):** asked A5 to A10. **Answered, with "don't know" where unknown.**
  - Answered: next round inside a stage starts by itself [T] (part of A6); after a network or server failure the round is replayed, triggered by judge or controller [C] (part of A8).
  - Still OPEN: A5 (countdown length), A6 (next stage), A7 (event-day features), A8 (exact continuation, tolerable interruption), A9 (question delivery risk), A10 (what 齐心协力 is and its scoring).
  - Two new stakeholder items named by the user: tolerable interruption length (U-49) and accepted early-viewing risk (U-50).
  - To ask the stakeholder at the end.
- **2026-09-25, corrections received from the user:** many earlier statements withdrawn (see "Corrections received" in `_interview-notes.md`).
  New OPEN items added: A15 third language (U-51), A16 primary user (U-52), A17 who assigns judges' ranges (U-53), A18 who opens the big-screen link and hands out slips and tablets (U-54),
  A19 judge powers beyond their own students (U-55), and file storage as internal item I-19 (C4).
  A3 now also asks which rounds and what "everything correct" means. IDs to verify: U-45 (authoring, earlier U-43) and U-47 (earlier cited for the cap).
- **2026-09-25, team questions re-asked (C1 to C5, E1):** answers received. **No team decision was given; every item stays OPEN.**
  - Names and roles (C3, I-17) and developers' skills (C1, I-18): not in the documents; the project owner or the developers must supply them.
  - Team decisions (E1): register statuses recorded (see E1); the team and the project owner must say what, if anything, stays open.
  - Backend language (C2, I-02), file storage (C4, I-19), session length (C5, I-16): not decided.
  - One active device per account: [P], not an explicit stakeholder decision.
  - Group 4 (venue) was on hold for these answers and is now being asked.
- **2026-09-26, group 4 (venue and facts):** asked B1 to B4. **Answered: none settled, all need the stakeholder.**
  - B1 numbers (U-02): still open; new facts recorded (teams rule [C], categories U6 to U20 [T], the 600 vs 720 mismatch).
  - B2 tablets and browser (U-06), B3 venue network (U-06, U-46), B4 hosting (U-46, I-03): still open.
  - To verify: the answer lists the 800-client target under [C] (EVT-001); earlier it was recorded as a suggestion. Which is it?
  - To ask the stakeholder at the end.
- **2026-09-26, group 5 (Step 4: technical complexity and non-functional requirements):** asked D1 to D6 in neutral wording. **Answered: none settled, all need the stakeholder.**
  - New stakeholder items: risks (U-56), external systems (U-57), performance targets (U-58), data protection (U-59), scale ceiling (U-60), failure tolerance and backup plan (U-61). Anti-cheating beyond the documented points: U-37.
  - New documented facts recorded: autosave about 2 per second [T], 3-minute ranking cycle [T], server-side authority [T], judge sees page-leave count [P], remote security and proctoring out of scope [S].
  - Still to reconcile: the 800-client target is listed as [C] (EVT-001) and the load target is listed as open (I-05).
  - To ask the stakeholder at the end.
- **2026-09-26, group 6 (Step 5: boundaries and rules):** asked system boundaries, invariants, access control, roles. **Answered with documented content; the module list is not final and the access rules are not written.**
  - Recorded in section H. New stakeholder items: archived scores and the correction log after 15 days (U-62), read/change rules per role (U-63, with U-55), one person in several roles (U-64), and more than one controller (U-11, conflicts with the older "exactly one admin" rule, OA-002).
  - Team items: the final module list (I-01), events vs direct calls (I-08).
  - To ask the stakeholder and the team at the end.
- **2026-09-26, group 7 (Step 6: design):** asked visual language, component library, main screens, responsive rules, bilingual UI, accessibility. **Answered with documented content; almost all of the visual design is open.**
  - Recorded in section I. New stakeholder items: visual language and school brand (U-65), Chinese/font requirements (U-70), screen layouts (U-66), screen sizes and orientations (U-67), language switching (U-68), accessibility and save-failure feedback (U-69).
  - New team item: component library, icons and fonts (I-20).
  - To ask the stakeholder and the team at the end.
- **2026-09-26, group 8 (Step 7 and workflow items):** asked buildable units, order, definition of done, who builds what, environment, git, CI, review, team sync. **Answered with documented content; nothing decided.**
  - Recorded in section J. New team items: units (I-21, with U-07 from the stakeholder), definition of done (I-22), who builds what (I-23), environment (I-24), git (I-25), CI (I-26), review (I-27), team sync (I-28).
  - I-14 and I-15 are named as needed before coding but were not described in the answer.
  - All interview steps have now been asked. Readiness check not passed.
  - To ask the team and the project owner at the end.

- **2026-09-26, Part 1 of the pack (Q1 to Q6) answered on the project side.** All resolved entries were removed from this log. The decisions are in `competition-rules.md` ([T], not client-confirmed) and their client confirmation is carried by pack rows R15 to R28. The open items that came out of them stay in the sections above (A1c, A4d, A5f, A6d).
- **2026-09-26, decisions file transferred (`decisions-for-the-context-builder.md`, removed after transfer).** It stated that Q1 to Q6 and the builder's blocking questions were **confirmed by the stakeholder** on 2026-09-26, which reverses their earlier [T] status; the context files now carry them as [C]. Verify with the project owner.
  - Resolved and removed from this file: essential features on the event day (first slice = Individual stage), the server-restart behaviour except its duration (U-49 stays), question delivery, judge ranges, file storage, live-state placement, roles (one role per account, several controllers), workflow and CI.
  - New open items (section K): sample files (U-01), extra Excel columns (U-40), unique solutions (U-90), judge and controller credentials (I-30), what I-14 and I-15 are, and the scope of the 15-day deletion (U-59, U-62).
  - Left blank on purpose (TBD — to be decided by the project owner): backend language and framework, developers' skills, names and roles, who builds what, where the server runs on the event day.

---

## G. Who can answer each open question

Working rule (set by the user): if an answer is unclear and the user can clarify it, ask a follow-up before moving on.
If the stakeholder or the venue must clarify it, log it here and return to it at the end. Assume nothing.

**Project owner (blank on purpose or to be supplied):**
- Backend language and framework (I-02), developers' skills (I-18), names and roles (I-17), who builds what (I-23), where the server runs (I-03, U-46): TBD — to be decided by the project owner
- K1 sample files (U-01) · K5 what I-14 and I-15 are

**Team can settle it (decision not yet made):**
- C5 session length (I-16) · H1 final module list (I-01) and how modules communicate (I-08) · I2 component library, icons, fonts (I-20) · J5 environment (I-24) · J9 team sync (I-28) · J1 to J3 build units, order and definition of done · K4 judge and controller credentials (I-30) · C7 status-tag format · E1 the [T] team decisions

**Only the stakeholder can settle it (log and return at the end):**
- A1c question PDF carries points (U-03) · A4d when students see scores (U-24, U-88) · A6d awards and reset after an early finish (U-27, U-89) · A5f question files per category (U-32) · A8 acceptable interruption length (U-49) · K2 extra Excel columns (U-40) · K3 unique solutions (U-90) · K6 15-day deletion scope (U-59, U-62)
- A10 what 齐心协力 is (U-05, U-21) · A11 to A19 remaining (authoring U-45, third language U-51, primary user U-52, link and slips U-54, judge powers U-55) · D1 to D6 (U-56 risks, U-57 external systems, U-58 performance, U-59 data protection, U-37 anti-cheating, U-60 scale, U-61 reliability) · H2 and H3 (U-62 archived scores, U-63 read/change rules, U-55 judge powers) · I1 to I6 (U-65 brand and look, U-70 fonts and Chinese display, U-66 layouts, U-67 screen sizes, U-68 language switching, U-69 accessibility) · E2 to E6 re-confirmations
- Client confirmation of the 2026-09-26 decisions: stated as given (see `competition-rules.md`); verify with the project owner.

**Venue or school (stakeholder to obtain):**
- B1 exact numbers (U-02) · B2 tablets and Quark version (U-06) · B3 venue network

---

## H. Step 5: boundaries and rules (asked and answered 2026-09-26)

Answered with what the documents hold. **The module list is not final, and the access rules are not written down.** Everything marked OPEN needs the stakeholder or the team.

### H1. System boundaries — OPEN (I-01)
Documented as team decisions [T] (ARCHITECTURE.md §3): one deployable backend organized as a modular monolith, with these modules:

| Module | Owns |
|---|---|
| Competition | Creation, metadata, lifecycle, publish, pause and resume, finish and cancel state |
| Participant / Identity | Players, teams, player and judge accounts, participant membership, competition-specific access |
| Question | Question import and validation, question packs, assignment of questions to rounds |
| Stage / Round | Stage and round definitions, round timing and state, preparation state |
| Gameplay / Player State | The current grid, autosave, reconnection, submission state, player runtime state |
| Orchestrator | The sequence: start stage, preparation, start and end round, next round, next stage, finish. It coordinates and does not own every rule |
| Scoring | Puzzle evaluation, score and bonus calculation, the finalized round score |
| Ranking | Cumulative stage score, tie-breaking, provisional and final ranking |
| Big Screen | Big-screen state, ranking projection, player and team projection, display mode |

- The client's "control hub" takes commands from judges and the controller, applies the arbitration rule and broadcasts state; it lives inside the Orchestrator and Big Screen modules. [S]
- Frontend: one React application with role-based areas, laid out by feature: auth, competition, player, judge, admin, big-screen, ranking, gameplay. [T]
- **OPEN:**
  - The final module list (I-01). The list was written for one judge and one category. It has no module for team rotation, score corrections, the 15-day purge, import and export, competition copy, participant numbering, judge ranges and takeover, or several synchronized big screens.
  - Whether modules talk through events or direct calls (I-08).
  - The backend language and folder structure (I-02, see C2). Where files are stored (I-19, see C4).

### H2. Invariants — documented only
- **Confirmed [C]:** a repeated submission never changes the result (PL-009); validation, scoring, results and ranking are automatic (EX-001 to EX-004); the judge does not determine or calculate rankings (EX-005).
- **Team decisions [T], not confirmed by the stakeholder:**
  - The server owns the competition, stage and round state, the timer, pause and resume, submission validity, scoring, ranking and participant eligibility. The client is never trusted for any of them, and its countdown is display only. (ENV-006 is a "Working Position".)
  - Each piece of state has one owner, and no other module modifies it.
  - A module's internals are reachable only through its public interface.
  - Durable results live in PostgreSQL, never only in Redis.
  - Autosave saves the grid and never triggers scoring. Scoring reacts to a submission, not to a move.
  - A round transition happens only after its scoring is final.
  - The big screen never calculates rankings.
  - An early round end cannot be undone.
  - The client is never a source of authority. Events, if used, state facts and not commands.
- **Approved in the blanket answer [P]:**
  - Scores change only through a controller correction with a mandatory reason, and a change log records it (RES-003).
  - A rematch archives the old scores; it does not delete them (ROL-005).
  - Numeric values are customizable by the controller only, and only before a round starts. The structure and rules stay fixed (SCR-005).
  - Fifteen days after the competition, answers, scores and student accounts are permanently deleted. The setup, the questions and the judges are kept (RES-004).
- **OPEN (U-62):** whether the archived scores and the correction log are also deleted after 15 days.

### H3. Access control — OPEN (U-63, with U-55 for judge powers)
Documented:
- **Player:** does not start or control anything, calculate rankings, control the display, or create or configure competitions [C] (PL-001). Only members of the competition's participant dataset can take part [T]. One active device per account [P].
- **Judge:** sees the status of their assigned students and can restart one student's round [P] (ROL-003). A judge can enter only the competition they are assigned to [T].
- **Controller:** can do everything a judge can, plus event setup, rules and customization [C] (ROL-002). It sees all progress in real time and can take over from a disconnected judge [C] (ROL-004).
  The listed commands are start a stage, pause, resume, end a round early, finish, reset or rematch, correct scores, and control the big screens.
- **Big screen:** a passive display that receives commands and shows [S]. After the competition it becomes read-only [T].

OPEN: who can read and who can change what is not written as a rule (U-63). For example: whether a player can read only their own answers, whether a judge can read students outside their range, who may edit participants during the event, and whether a judge can change a score.

### H4. Roles — RESOLVED (2026-09-26)
Decided [C] (BLD-004): one role per account; several controller accounts are allowed; one person with several roles is handled as two accounts. This settles U-64 and the "more than one controller" conflict (U-11). Whether "controller" and "administrator" are literally the same role remains assumed [A]. See `architecture.md`.

---

## I. Step 6: design (asked and answered 2026-09-26)

Answered with what the documents hold. **Little is documented for the visual design; almost every item needs the stakeholder or the team.**

### I1. Visual language and school brand (U-65) — OPEN
Nothing is documented: not dark or light, not minimal or rich, and no school brand, colours or logo. The stakeholder still has to answer.

### I2. Component library, icons, fonts, Chinese text — OPEN (I-20, U-70)
- Documented: the frontend is React with TypeScript [T] (ARCH-020).
- Not documented: any UI component library, icon set or font. Internal team decision, OPEN (I-20).
- Chinese text rendering on the tablets: undocumented. It depends on the tablet model and Quark version, which are unknown (U-06). Whether there are requirements on fonts or Chinese display: the stakeholder still has to answer, OPEN (U-70).

### I3. Main screens and layouts — partly OPEN (U-66)
- **Answer screen [C] (UI-001):** landscape; the puzzle on the left, a number pad on the right; previous, next and question-number buttons; a delete button that clears the selected cell; a clear-all button that starts the puzzle over. Both buttons ask for confirmation. Each question's point value is shown [S].
- **Player states [T]:** competition room; preparation room with the rules and a countdown; active round; read-only after submitting; waiting. The pause notice for players is a blocking message.
- **Big-screen content:**
  - A ranking cycle every 3 minutes, shown in full and paginated when it does not fit [T].
  - A one-student close-up and a team view, which splits into 2 to 6 sections [T].
  - "Competition Paused" and finished displays.
  - The controller can show a category leaderboard, the school ranking or a close-up, with optional rotation between categories [C] (BSC-002).
  - Ranking columns: rank, player name, score and completion time for individuals; rank, team name, score and completion time for teams; rank, school and total for the school ranking.
- **Judge and controller content (not layout):** the judge sees the status of their students, the stage, round and remaining time, and the live ranking. The controller has the command list in ROL-002 to ROL-005.
- **OPEN (U-66):** the layout of the judge, controller and big screens, and of the login, competition room, preparation, waiting and results screens. The stakeholder still has to answer.

### I4. Responsive and device rules — partly OPEN (U-67, with U-06)
- Documented [C] (UI-001, PAR-006): the students' answer screen is landscape, and a "please rotate your device" screen appears when the tablet is held upright.
- **OPEN (U-67):** screen sizes and orientations for the learning tablets, the judges' and controller's devices, and the big screens. The stakeholder still has to answer.

### I5. Bilingual UI — partly OPEN (U-68)
- Documented [C] (ARCH-026): the interface is English and Chinese, not one or the other, and the translation mechanism must be planned in from the start. Messages such as the pause notice are to be written in both languages [T].
- **OPEN (U-68):** whether the language is per user, per event, or both shown at once, and which is the default. The stakeholder still has to answer.

### I6. Accessibility and interaction — OPEN (U-69)
Nothing is documented: touch target sizes, contrast, keyboard use, or what the student sees when an autosave fails. The stakeholder still has to answer.

---

## J. Step 7 and workflow items (asked and answered 2026-09-26)

Answered with what the documents hold. **No list of units, no dependencies, no definition of done, and no workflow rules are decided.** All items are internal team items unless stated.

### J1. Buildable units — OPEN (I-21)
- Not documented: no list of buildable units, each with one visible result.
- The only sequence in the files is the team's earlier 15-day plan, kept "for reference" and "to be reworked" (ARCHITECTURE §9, [T]). Its stages: 1 Foundation; 2 Competition setup and imports; 3 Question system; 4 Runtime; 5 Scoring and ranking; 6 Big screen; 7 Integration and failure cases; 8 Stabilization, with no new features.
- The plan is out of date: it predates the stakeholder's answers, so it has no team rotation, several categories, judge ranges, corrections, purge, export or copy (I-01).
- "Individual stage first, end to end" appears only as a proposal in U-07, which the stakeholder has not signed off. The stakeholder did not rank features. OPEN.

### J2. Order and dependencies — OPEN (I-21)
- Not documented: which unit depends on which.
- Security first: the old plan puts an "authentication foundation" in days 1 to 2, with the models and API structure. No document says security must come before functionality. OPEN.
- Imports before the round engine: the old plan places setup and imports (days 3 to 6) before runtime (days 7 to 9). It is a reference plan [T], not a rule. OPEN.
- Rule for unknowns [T]: an unknown is an implementation detail unless it changes the domain model, the state machine, scoring or ranking, authentication, the question format, or a critical API or WebSocket contract. Only those need a decision before coding.
- Needed before coding (REQUIREMENTS §12): I-01, I-06, I-10, I-11, I-14 and I-15. The answer did not describe I-14 and I-15; to look up in the register.

### J3. Definition of done — OPEN (I-22)
- No per-unit rule: no acceptance rule, test scenarios or coverage target for any unit.
- Documented (REQUIREMENTS §13): the MVP acceptance scenario; a failure and edge-case test list [T]; an extended scenario with the stakeholder's additions [A], to confirm.
  - The edge cases include disconnect and reconnect, timer expiry, duplicate submission, pause and resume, many players at once, tie-breaks and invalid files.
  - The stakeholder's additions still to add: rematch, takeover, corrections, several categories and the 15-day purge.

### J4. Who builds what — OPEN (I-23)
- Documented reference split [T] (ARCHITECTURE §9): one developer takes the competition lifecycle, orchestrator, judge and controller APIs, WebSocket state and the server timer; the other takes the player UI, gameplay grid, submission UI, scoring and ranking, and the big screen; both share the database model, authentication, integration and testing.
  The boundaries move with actual strengths, and the split is not strictly backend versus frontend.
- Still open: it predates the stakeholder's answers; the developers' names and skills are not recorded (I-17, I-18); both developers are still to record their acceptance (I-08).

### J5 and J9. Workflow items still open
Resolved 2026-09-26: git branching, pull requests, CI and review (I-25 to I-27, BLD-002); see `ai-workflow-rules.md`. The first slice is decided (BLD-009); units, order and the definition of done (J1 to J3) are still to be drafted.
- **J5. Environment (I-24):** not decided. The only mention is "environment configuration" as stabilization work near the end.
- **J9. Team meeting rhythm (I-28):** not documented. The plan says "integrate every day", which is not a meeting rule.

---

## K. New open items from the 2026-09-26 decisions

**K1. The sample question PDF and participant Excel (U-01)** — OPEN, project owner
- Not yet sent. Blocks the import units and the grid shapes.
- Answer: _

**K2. Extra participant Excel columns (U-40)** — OPEN
- The columns are Name, School, Category, Team. Are there any others?
- Answer: _

**K3. Unique solution of every puzzle (U-90)** — OPEN
- The answer check compares the submitted grid with the solution stored with the question and relies on every puzzle having a unique solution. Is that guaranteed?
- Answer: _

**K4. Format of judge and controller credentials (I-30)** — OPEN
- Participants use the participant number and a short random password. What do judges and controllers use?
- Answer: _

**K5. What are I-14 and I-15?** — OPEN, project owner
- The requirements list them as needed before coding (REQUIREMENTS §12), but no file here describes them, and the 2026-09-26 decisions did not address them.
- Answer: _

**K6. Does the 15-day deletion cover the uploaded participant Excel? (U-59, U-62)** — OPEN
- Also open: whether archived scores and the correction log follow the 15-day deletion.
- Answer: _

**K7. Blank on purpose: TBD — to be decided by the project owner**
- Backend language and framework (I-02), the developers' skills (I-18), names and roles (I-17), who builds what (I-23), and where the server runs on the event day (I-03, U-46). Do not choose a value.

---

## Not yet asked

Nothing. All 7 interview steps and the workflow items from the README checklist have been asked. Step 8 (written requirements confirmation, A14) and the skeleton checkpoint are still to come.
