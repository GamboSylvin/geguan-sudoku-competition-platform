> **[CONTEXT FEEDER NOTE]** Working file of the requirements process (interview record, open questions, question pack). It FEEDS the `context/` folder and contains superseded statements. Do NOT read it to decide what to build.

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
On 2026-09-30, Part 1's remaining five items (A1c, A4d, A5f, A6d, A10b) were answered directly by the client's stakeholder (marked ✅) or given as team working positions where the stakeholder's answer was unclear or missing (marked 🔶). ✅ items are tagged [C]; 🔶 items are tagged [T]. Their decisions are in `competition-rules.md`; client confirmation of the ✅ items is carried by rows R30 to R34 of `_stakeholder-question-pack.md`.

Last updated: 2026-09-26, after the resolved points were removed (they live in `competition-rules.md`). All interview steps asked; readiness check not passed.

---

## A. Questions for the stakeholder

Priority 1 = changes the data model or scoring, needed **before the schema is approved**.
Priority 2 = affects behaviour or specs, needed before the affected spec is written.
Priority 3 = confirmations and later-phase items.

### Priority 1 — scoring and round rules

Pack Q1 to Q4 (points and total, submission, early-finish bonus, late submit) were decided on 2026-09-26 by the project owner, answering in the stakeholder's role. The decisions are in `competition-rules.md` ([T], **not yet confirmed by the client's own stakeholder**, pack R15 to R28).

**Still open from this part**

**A1c. Does the question import file carry the points? — RESOLVED 2026-09-30, folded into the format correction**
- **Answer:** the question import file is **Excel (.xlsx), not PDF** [C] (BLD-012, resolves U-93). It does carry a points value per question, but that is only a starting value: points stay fully controller-customizable everywhere [C] (BLD-013, resolves U-92). Recorded in `competition-rules.md` §2.

**A4d. When may students see their score? — RESOLVED 2026-09-30**
- **Answer:** only when the whole competition reaches `FINISHED` — not after each round, not after each stage [C] (BLD-017, resolves U-24, U-88). Whether a separate manual "publish" click by the controller is also wanted at that same moment was not addressed; treated as a minor residual detail, not blocking. Recorded in `competition-rules.md` §4.

### Priority 2 — event behaviour

**A5f. Do the categories have their own question files? — RESOLVED 2026-09-30**
- **Answer:** one file per category, not a shared pool [C] (BLD-016, resolves U-32); each category (e.g. U8, U12) is uploaded and imported separately, even when running the same round in parallel. Recorded in `competition-rules.md` §2 and `architecture.md` Data model.

**A6d. Finished early: awards, and reset after finishing — RESOLVED 2026-10-01**
- **Reset: resolved, was never actually open.** A finished competition, early or not, cannot continue — already stated directly in the documents (REQUIREMENTS §7.7). Not a separate question.
- **Awards: resolved 2026-10-01** [C] (U-89, narrowed): whether to grant awards after an early finish is entirely a human, on-site decision by the organizers — not the system's concern. The system's only responsibility is to clearly mark the result "finished early" and correctly calculate the scores of the rounds actually played (already built, RND-007). No special award-tier computation or marking is needed for this case — showing the computed scores and ranking is enough for the organizers to decide whether to award, re-run, or do something else. This narrows the earlier working position (BLD-018/BLD-030), which assumed the system would still compute award tiers.
- **Does not resolve the separate, general question (U-27):** whether the system computes award tiers at all for a *normal* finish. That stays open.

**A6e. Follow-up: awards after an early finish, re-asked with the scenario (U-89, U-27)** — RESOLVED 2026-10-01 (sent as pack Q38)
- Picture the individual stage running, and the controller ends the competition early because of a fire alarm. The school total still gets computed from whatever was played, and the result is marked "finished early". Does the school still give out its usual awards (medals, certificates, whatever it normally does) based on that early-finish result, or are awards withheld when a competition didn't run to its normal end?
- **Answer (2026-10-01)** [C]: see A6d above — entirely a human, on-site decision; the system just marks "finished early" and shows the computed scores/ranking for the rounds played.

**A8. Server restart during a round (I-10)** — Priority 2 — RESOLVED (2026-09-30)
- Decided [C] (BLD-007): a replay is acceptable. Round state changes are kept in PostgreSQL and the working grids in Redis with persistence on. After a restart the competition comes back paused, so the controller chooses to resume or replay (see `architecture.md`).
- **Tolerable interruption length, resolved 2026-09-30** [C] (U-49): no fixed limit. The stakeholder deliberately declined to set one — the controller decides, on the day, whether to resume or replay based on the event's schedule at that moment, regardless of how long the interruption lasted. Both resume and replay must always stay available to the controller; the system must never impose a timeout that disables either path.
- Answer: given, see above (pack Q15)

**A10. Team round 2, "齐心协力" (U-21)** — Priority 2 — RESOLVED 2026-09-29
- Earlier answer (2026-09-25): "Don't know." Superseded.
- **Answer (2026-09-29):** it is the client document's partition collaboration: one puzzle split into blocks, one block per tablet/member, each member seeing and editing only their own block [C] (TEM-005, resolves TEM-003, U-21, U-05). The earlier guess of a shared full-grid board (TEM-003) is dropped.
  - **Block split** [C] (TEM-005, resolves U-91): contiguous horizontal row-bands, one band per active member (2 to 6), as equal as possible, extra rows to the first bands; works for any grid shape, never assuming 9x9.
  - **Puzzles per round:** 3, customizable — working position [T] (TEM-006), not sourced; the real number should come from the 4th Zhejiang league regulation (pack ref R9).
  - **Total round time:** 30 minutes, customizable — working position [T] (TEM-007), anchored to the Individual stage's 30-minute variant round, not sourced.
  - **Points:** one "points per puzzle" value for the whole round, default 20, customizable — working position [T] (TEM-008), same one-value-per-round pattern as rotation, not sourced.
  - **Scoring:** all-or-nothing per puzzle once the blocks are combined, no early bonus, same rules as everywhere else [C] (SCR-001, SCR-002).
  - **Needed on the event day:** yes, the school total counts both team rounds; needed by about day 8 of the build if required on competition day.
- Recorded in `competition-rules.md` §1 and §8, and `architecture.md` (Data model). TEM-006 to TEM-008 remain flagged for replacement once the regulation numbers arrive — see new item **A10b**.

**A10b. Regulation numbers for the second team round (TEM-006 to TEM-008)** — OPEN, stakeholder / project owner
- The puzzle count (3), total time (30 min) and points per puzzle (20) are working positions, not read from any source. Replace with the 4th Zhejiang league regulation's actual numbers once available (pack ref R9).
- **Answer (2026-09-30): no reply came back.** These stay exactly as they were. Since every one of these values is fully customizable in the product, whatever real numbers arrive later just get typed in — no rebuild needed. **Decision (2026-09-30, the user, general principle):** a working position may be used to build against now, exactly as if it were a stakeholder answer; it can still be changed later, like any [C] or [T] decision, at any time, without special process. TEM-006 to TEM-008 are now in active use on that basis. Not blocking.

### Priority 3 — confirmations

**A11. Puzzle authoring/generation (U-45; earlier cited as U-43)** — Priority 3 — RESOLVED 2026-10-01
- Question: Is creating, generating or editing puzzles inside the app in scope or out of scope? Documented [T]: questions are imported from the predefined question Excel (corrected from PDF, 2026-09-30), with no OCR.
- **Answer (2026-10-01)** [C]: out of scope for this version, confirmed. The system only imports pre-made questions (Excel, per category). No puzzle-authoring or puzzle-editing feature is built — same later-phase category as the reusable Question Bank.

**A12. Export format (U-08)** — Priority 3 — RESOLVED 2026-10-01
- Question: Confirm exports (scores, rankings, answers) are Excel `.xlsx` files. Any required layout or columns?
- **Answer (2026-10-01)** [C]: Excel (`.xlsx`), with scores, ranks and the answer per question — as already planned. No specific layout or column list imposed; the exact columns stay an easy-to-adjust detail, not a system rule.

**A13. Data protection for student data** — Priority 3 — OPEN (Step 4, not yet answered)
- Question: Are there legal or school rules for storing student data (names, answers, login accounts)? The plan is to delete answers, scores and student accounts 15 days after the event, after the controller exports what it needs. Is that acceptable, and who must approve it?
- Answer: _

**A14. Written approval of requirements (Step 8)** — Priority 3 — RESOLVED 2026-10-01
- Question: Will the stakeholder approve the summarized requirements in writing before the specs are written? Who signs, and when?
- Why it matters: the README makes this a mandatory gate for client projects.
- **Answer (2026-10-01)** [C]: informal process, no formal signature required. The stakeholder/project owner does not sign a formal written requirements document with a deadline — approval happens informally, as the project owner validates each answer along the way (as already done throughout this pack). Consistent with the existing `FILL-BEFORE-CODING.md` section E row, already marked done.

**A15. Third language (U-51)** — Priority 3 — RESOLVED 2026-10-01
- Question: English and Chinese are both in [C]. Is any other language in or out of scope?
- **Answer (2026-10-01)** [C]: no third language needed beyond English and Chinese.

**A16. Primary user (U-52)** — Priority 3 — RESOLVED 2026-09-30
- **Answer:** the controller. The product is mainly built for the controller — the event organizer — per the documented business goal of reducing organizer effort, and because the controller is the only role that touches setup, live control, score corrections and export [C].
- **Note on scope:** the big screen is not a "user" in the same sense as the other three roles. It is a passive architectural end (see `architecture.md`, "Hub-and-spoke") that only receives server-pushed state and displays it — no person operates it as an actor. Treated as a display target, not a fourth user persona.
- Recorded in `project-overview.md` ("Target users") and `architecture.md` (new "Hub-and-spoke" note under System boundaries).

**A18. Who opens the big-screen link and hands out slips and tablets (U-54)** — Priority 2 — RESOLVED 2026-09-30
- **Answer:** out of scope for product design [C]. Who physically opens the big-screen link on the day, and who hands out printed credential slips and tablets to students, is pure event-day staffing logistics, not a product decision. The system's behaviour does not depend on who performs these actions: the big-screen link works identically regardless of who opens it, and credential slips/tablets are distributed before login, entirely outside the app. No screen, role or permission needs to account for this.
- Recorded in `project-overview.md`, flow step 8.

**A19. Judge powers beyond their own students (U-55)** — Priority 2 — RESOLVED 2026-09-30
- **Answer:** nothing more, beyond what is already documented (status of assigned students, single-student restart) [C]. See H3 above for the full access-rules answer (also covers U-63).
- **Still OPEN (U-39):** what a judge sees specifically in the team stage.

---

## B. Facts needed from the stakeholder or venue

**B1. Exact participant numbers (U-02)** — PARTLY RESOLVED 2026-09-30
- Question: How many students, teams, schools and rooms exactly? The numbers given (about 600–720 students; 11 rooms: 10 of about 30 and one of about 300) do not add up.
- Why it matters: sizing, test data, and load targets.
- Suggestion on record (NOT an answer, not used): design and test for about 800 clients. The group 4 answer lists this target as on record under [C] (EVT-001); whether the [C] covers the 800 figure itself is unclear. The group 5 answer again lists it as [C] (EVT-001), while also listing the load target of about 800 clients and 2 saves per second as an open point (I-05). **Reconciled 2026-09-30, see D5/Q21:** 800 clients is confirmed as the ceiling for this version; the two statements now agree.
- **Answer (2026-09-30)** [T]: exact numbers not provided; the documented estimates are kept as the working position **deliberately, not a gap** — the design already handles either answer (rooms are just groups of participant numbers; the system is built to about 800 clients regardless of the exact split). No design changes needed; exact numbers can be supplied later without a rebuild.
- On record [C] (EVT-001): about 600–720 students; 11 rooms (10 of about 30 students and 1 of about 300, which comes to about 600, not 720); at least 30 judges; 10 big screens.
- Teams: the count is not on record. The rule on record: each school has exactly one team per category. [C] (SCR-004)
- Categories: all of U6 to U20 [T] confirmed in use, per the 2026-09-30 answer.
- **Still OPEN (U-02, narrowed):** whether a room mixes categories.

**B2. Tablets and browser (U-06)** — RESOLVED 2026-09-30
- Question: Which tablet model (学练机) and which Quark Browser version? Can we get a test tablet before the event?
- Why it matters: decides what web features are safe to use.
- Suggestion on record (NOT an answer, not used, now superseded): assume a modern Chromium-based Android browser.
- **Answer (2026-09-30)** [C]: no fixed device or browser target. The player-facing app must work broadly across platforms — tablet, phone or computer — not locked to one tablet model or one Quark Browser version. Build as a standard responsive web app, using only widely-supported web APIs, avoiding anything tied to a specific device or browser vendor. This replaces the earlier "modern Chromium-based Android browser" assumption. Testing on a real learning tablet before the event, if one becomes available, is still valuable — it just means the exact model/version is no longer a blocking unknown.
- Known: students use Quark Browser on learning tablets (学练机) as the primary real-world device. [C] (PAR-006)

**B3. Venue network (U-46)** — DEFERRED 2026-09-30 (deliberately, not blocking)
- Question: Does the venue have internet? How strong is the Wi-Fi in the room with about 300 tablets, and how many devices can it handle at once? Can we run our own Wi-Fi router or on-site server?
- Why it matters: the biggest real-world risk (already confirmed as such, see D1/Q19). Decides whether the app must work on a local network only.
- **Answer (2026-09-30)** [C]: deferred to closer to the event date, deliberately non-blocking. The venue's actual internet availability and Wi-Fi strength aren't needed for the current build phase — the priority right now is that the system be reachable from any computer, phone or tablet, for testing and demoing features, not the real venue's network conditions. Does not hold up construction of the current system at all.
- The router/on-site-server sub-question is carried to B4/Q24 (hosting), where it is addressed in full.

**B4. Hosting (I-03)** — PARTLY RESOLVED 2026-09-30 (a separate near-term plan added; the event-day question itself stays OPEN)
- Question: Where does the server run on the day: a school server on the venue network, a cloud server in China, or elsewhere? Who is responsible for setting it up and running it? Is an on-site fallback server wanted?
- **Still OPEN (U-46, I-03):** where the server runs on the event day; who sets it up and runs it; whether an on-site fallback server is wanted. The stakeholder's answer (2026-09-30, see Q24) keeps this deliberately deferred until the venue and date are known — not blocking.
- **New, resolved 2026-09-30** [T] (BLD-031, Working Position, separate from U-46): a two-phase hosting proposal, raised while discussing Q23/Q24, for getting a shareable demo/test link now at no/low cost. **Phase 1 (now, free):** deploy `docker-compose.yml` to Railway (railway.app) — stays awake 24/7 unlike Render's free tier (which sleeps after 15 min and drops WebSocket connections, a problem for the round timer and live ranking); managed PostgreSQL/Redis in a few clicks; ~$5 one-time + $1/month free credit; persistent file storage not in the free tier (fine for a demo, not production). **Phase 2 (event day, paid, ~800+ clients):** a dedicated VM (DigitalOcean Droplet or Hetzner Cloud), same `docker-compose.yml`, no architecture change; billed hourly. Simpler alternative: Render paid tier or Railway Pro. **Phase 1 starts immediately; the Phase 2 choice stays open until U-46 is answered.**

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

- **D1. Risks (U-56)** — RESOLVED 2026-09-30
  - Question: what are the most risky or complex parts, and what could go wrong on the event day?
  - **Answer (2026-09-30)** [C]: the venue Wi-Fi, in the room with about 300 tablets, is confirmed as the biggest real-world risk. Does not change the system design — the platform is already designed and load-tested for about 800 simultaneous clients. Only addition: an advisory reminder note shown to the controller when creating a competition, telling them to ask their network/IT team to properly configure the venue Wi-Fi before the event. UI copy only, no validation, no blocking behavior, not a functional requirement. This also pre-confirmed pack row R13 (Part 6) — no separate round-trip needed there.
  - Documented technical open points, listed without ranking: the tablet model and Quark version, still unknown (U-06); the load target of about 800 clients sending roughly 2 grid saves per second (I-05);
    a burst of requests at round start if questions are fetched then, with up to 300 tablets in one room (I-06); a server restart mid-round (I-10); a submit that arrives just after the timer ends (I-11).
  - Documented as handled: after a network or server failure the round is replayed, and the stakeholder believes the network is the most likely cause. [C] (ROL-005)
  - Failure cases the team plans to test [T]: disconnect and reconnect, timer expiry, manual and duplicate submission, pause and resume, an early round end, an early finish, many players at once, team scoring, tie-breaks, big-screen synchronization, an invalid participant or question file.
- **D2. External systems (U-57)** — RESOLVED 2026-09-30
  - Question: does the system need to connect to anything beyond the tablets and screens (for example SMS, email, a school student-ID system)?
  - **Answer (2026-09-30)** [C] (ARCH-028): no external system integration for this version, confirmed. The system connects only to its own four ends — tablets, judges' and controller's devices, and big screens. No SMS, no email, no external school student-ID system. Credentials are generated and printed internally; no external identity system needed.
- **D3. Performance (U-58)** — RESOLVED 2026-10-01
  - Question: what response times must hold (ranking update after a submit, all tablets starting together, others)?
  - Documented: an autosave rate of about 2 grid saves per second per player [T]; a 3-minute ranking cycle on the big screen [T]; a provisional ranking that updates immediately when a round result is finalized, without waiting for every participant. [T]
  - **Answer (2026-10-01)** [C]: ranking updates within 2 seconds of a submission; all tablets start a round together within 1 second of each other. No other timing requirement identified.
- **D4. Security, cheating and student data (U-59)** — PARTLY RESOLVED 2026-09-30
  - Question: what must be protected, how should cheating be prevented, and are there legal or school rules for student data?
  - Documented: the server decides the time, the validity of submissions, the score and the rank, and the client is never trusted [T]; one active device per account [P] (PAR-005);
    the judge sees how many times a student left the answer page, as information only, with no penalty [P]; remote-competition security and proctoring are out of scope [S] (ENV-005).
  - **Anti-cheating, resolved 2026-09-30** [C] (SEC-001, resolves U-37): confirmed as-is, nothing added — kept light because the competition is in-person and physically supervised by 30+ judges. No camera, no remote proctoring, no additional lockdown measure.
  - What must be protected and any legal or school rules for student data: none recorded. **Answer (2026-10-01), see Q27:** explicitly classified as "to be confirmed with the stakeholder" — genuine unknowns, not a team decision. **Still OPEN (U-59).** Related facts only: the 15-day deletion [P] (RES-004) and that where the data must live is open (U-46).
- **D5. Scale (U-60)** — RESOLVED 2026-09-30
  - Question: is the current client count the ceiling for this version?
  - Documented: about 600–720 students and a design and test target of about 800 clients [C] (EVT-001). The client's original document aimed at 1000+ devices and 3000 concurrent users for the full platform [S].
  - **Answer (2026-09-30)** [C]: about 800 simultaneous clients is the ceiling for this version. Not the original 1000+ devices / 3000 concurrent users — that targeted the full multi-tenant platform vision, deferred to a later phase. The real known event scale (~600–720 students) fits comfortably under 800, so the existing load-test target stays as-is (~800 clients at ~2 grid saves/second). This also reconciles the "listed both as [C] and as open" flag on I-05.
- **D6. Reliability and backup plan (U-61, with U-46)** — PARTLY RESOLVED 2026-09-30
  - Question: how much failure can the event tolerate, and is there a backup plan (on-site server, paper)?
  - Documented: a failed round is replayed [C] (ROL-005); a student's saved grid is restored on reconnection [T]; an on-site server on the venue network is kept as an option [O] (I-03).
  - **Failure-tolerance part, resolved 2026-09-30** [C]: same answer as U-49 (see A8) — no fixed limit, the controller decides resume vs. replay on the day.
  - **Backup-plan part: still OPEN, deferred by the stakeholder to Q24/U-46** (Part 3, where the server runs on the event day) rather than answered twice.
  - **U-49 (tolerable interruption length) resolved 2026-09-30, see A8:** no fixed limit — the controller decides resume vs. replay on the day.

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
  - Still OPEN at the time: A5 (countdown length), A6 (next stage), A7 (event-day features), A8 (exact continuation, tolerable interruption), A9 (question delivery risk), A10 (what 齐心协力 is and its scoring). A10 was later resolved 2026-09-29 (see above).
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
  - New open items (section K): sample files (U-01), extra Excel columns (U-40), unique solutions (U-90), judge and controller credentials (I-30), what I-14 and I-15 are, and the scope of the 15-day deletion (U-59, U-62). (K1 later resolved 2026-09-30: question file is Excel, not PDF.)
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
- A10b regulation numbers for the second team round, in use as working positions (TEM-006 to TEM-008) · K2 extra Excel columns (U-40) · K3 unique solutions (U-90) · K3b the missing complete-solution column, re-ask refined 2026-10-01 (U-94) · K6 15-day deletion scope (U-59, U-62)
- A12, A13 remaining · A6d/U-27 (whether the system computes award tiers at all, for a normal finish — distinct from the now-resolved early-finish question) · D4 (U-59 data protection) · D6 (U-61 reliability's backup-plan part) · K6 (U-62 narrowed to the participant Excel) · U-39 (judge view in the team stage) · E2 to E6 re-confirmations
- Client confirmation of the 2026-09-26 decisions: stated as given (see `competition-rules.md`); verify with the project owner.

**Venue or school (stakeholder to obtain):**
- B1 whether a room mixes categories (U-02, narrowed; the exact-numbers part is resolved as a deliberate working position) · B3 venue network (U-46, deliberately deferred to closer to the event date, not blocking)

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
- **Resolved 2026-10-01** [C] (RES-005, U-62 scores/log part): archived scores and the correction log are also deleted after 15 days, same as the rest of the student data. **Still OPEN (U-62, narrowed):** the uploaded participant Excel.

### H3. Access control — RESOLVED 2026-09-30 (U-63, and the general part of U-55). U-39 stays open.
- **Answer:** player reads only their own answers, no visibility into another player's data. Judge visibility strictly limited to their assigned range, cannot see students outside it. No judge powers beyond what is already documented — status of assigned students (connected, submitted) and single-student restart. Only the controller may add, edit or replace participants during the event; judges have no participant-management access. Only the controller may correct a score; judges cannot change a score. [C]
- **Still OPEN (U-39):** what a judge sees specifically in the team stage.
- Recorded in `architecture.md` (Auth and access model), `ui-context.md` (Judge content), `data-model.md` (new "Access rules" section).
Documented (background, as originally recorded):
- **Player:** does not start or control anything, calculate rankings, control the display, or create or configure competitions [C] (PL-001). Only members of the competition's participant dataset can take part [T]. One active device per account [P].
- **Judge:** sees the status of their assigned students and can restart one student's round [P] (ROL-003). A judge can enter only the competition they are assigned to [T].
- **Controller:** can do everything a judge can, plus event setup, rules and customization [C] (ROL-002). It sees all progress in real time and can take over from a disconnected judge [C] (ROL-004).
  The listed commands are start a stage, pause, resume, end a round early, finish, reset or rematch, correct scores, and control the big screens.
- **Big screen:** a passive display that receives commands and shows [S]. After the competition it becomes read-only [T].

(All of the above is now answered — see the RESOLVED line at the top of this section.)

### H4. Roles — RESOLVED (2026-09-26; U-11 fully resolved 2026-10-01, Part 6 R12)
Decided [C] (BLD-004): one role per account; several controller accounts are allowed; one person with several roles is handled as two accounts. This settles U-64 and the "more than one controller" conflict (U-11). **Whether "controller" and "administrator" are the same role, resolved 2026-10-01** [C] (U-11, R12): confirmed — the controller is the administrator. No role exists above the controller in this MVP version; the Super Administrator is a separate, later multi-tenant-phase role (SA-005). See `project-overview.md`, "Target users".

---

## I. Step 6: design (asked and answered 2026-09-26)

Answered with what the documents hold. **Little is documented for the visual design; almost every item needs the stakeholder or the team.**

### I1. Visual language and school brand (U-65) — RESOLVED 2026-10-01 (Working Position, not stakeholder-confirmed)
Nothing was documented before: not dark or light, not minimal or rich, and no school brand, colours or logo.
**Answer (2026-10-01)** [T], a Working Position in active use, not yet a confirmed stakeholder preference: light theme, minimal (not rich), friendly-but-professional tone, blue primary color with neutral grays (matches Tailwind CSS defaults, already the styling tool). No school brand/colors/logo yet — a placeholder slot is kept for one. If the stakeholder dislikes this once shown, it changes then — build with it in the meantime.

### I2. Component library, icons, fonts, Chinese text — PARTLY RESOLVED 2026-10-01 (fonts/U-70 resolved; component library/icons stay OPEN, I-20)
- Documented: the frontend is React with TypeScript [T] (ARCH-020).
- Not documented: any UI component library or icon set. Internal team decision, **still OPEN (I-20).**
- **Font stack and Chinese display, resolved 2026-10-01** [C] (U-70): not a bare `system-ui`. An explicit stack — generic sans-serif first (Latin/English), then CJK fallbacks in order: PingFang SC (macOS/iOS), Hiragino Sans GB (older macOS), Microsoft YaHei (Windows), Noto Sans CJK SC (Android/Linux), then sans-serif. All already installed on-device — no custom web-font download, which matters given the venue Wi-Fi risk (U-56). This makes the tablet-model/Quark-version dependency (U-06) moot for fonts specifically, since the stack only relies on fonts already present on common OSes, not a specific browser.

### I3. Main screens and layouts — RESOLVED 2026-10-01 (deliberately deferred, not blocking)
- **Answer screen [C] (UI-001):** landscape; the puzzle on the left, a number pad on the right; previous, next and question-number buttons; a delete button that clears the selected cell; a clear-all button that starts the puzzle over. Both buttons ask for confirmation. Each question's point value is shown [S].
- **Player states [T]:** competition room; preparation room with the rules and a countdown; active round; read-only after submitting; waiting. The pause notice for players is a blocking message.
- **Big-screen content:**
  - A ranking cycle every 3 minutes, shown in full and paginated when it does not fit [T].
  - A one-student close-up and a team view, which splits into 2 to 6 sections [T].
  - "Competition Paused" and finished displays.
  - The controller can show a category leaderboard, the school ranking or a close-up, with optional rotation between categories [C] (BSC-002).
  - Ranking columns: rank, player name, score and completion time for individuals; rank, team name, score and completion time for teams; rank, school and total for the school ranking.
- **Judge and controller content (not layout):** the judge sees the status of their students, the stage, round and remaining time, and the live ranking. The controller has the command list in ROL-002 to ROL-005.
- **Answer (2026-10-01)** [C] (U-66): left to the design phase, deliberately not blocking now. No mockups or layout preferences given yet for the judge, controller, login, waiting, preparation or results screens — scheduled for the design phase after the first slice (BLD-009).

### I4. Responsive and device rules — RESOLVED 2026-10-01 (U-67)
- Documented [C] (UI-001, PAR-006): the students' answer screen is landscape, and a "please rotate your device" screen appears when the tablet is held upright.
- **Answer (2026-10-01)** [C]: fully responsive design, no fixed screen-size list — consistent with ARCH-027 (no fixed device target). Student answer screen stays landscape-only (existing rule). Judge/controller screens impose no fixed orientation. Big screens are landscape by nature, no special rule needed.

### I5. Bilingual UI — RESOLVED 2026-10-01 (U-68)
- Documented [C] (ARCH-026): the interface is English and Chinese, not one or the other, and the translation mechanism must be planned in from the start. Messages such as the pause notice are to be written in both languages [T].
- **Answer (2026-10-01)** [C]: language is chosen **per user**, not fixed per event and not shown simultaneously — matches the i18n scaffold already built in Unit 01. **Default language: Chinese.**

### I6. Accessibility and interaction — RESOLVED 2026-10-01 (U-69)
Nothing was documented before: touch target sizes, contrast, keyboard use, or what the student sees when an autosave fails.
**Answer (2026-10-01)** [C]: no formal accessibility standard imposed (no WCAG requirement) — just reasonable practice for the age range (U6–U20) and touch-first devices: touch targets/buttons sized for comfortable tapping (~44px minimum), high contrast, no keyboard dependency.
Autosave failure: a discreet, non-blocking indicator (e.g. "reconnecting...") — not an alarming error — while the system retries in the background, consistent with existing reconnection behavior.

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

**K1. The sample question Excel and participant Excel (U-01)** — RESOLVED (partly) 2026-09-30
- **Answer:** the material has been examined; the question import file is **Excel (.xlsx), not PDF** [C] (BLD-012, resolves U-93), which corrects the earlier "sample question PDF" wording throughout. Physical files are **still not placed in `context/samples/`**; that placement step (renamed `question-sample.xlsx`) remains open as pack item B1 in `FILL-BEFORE-CODING.md`.

**K2. Extra participant Excel columns (U-40)** — OPEN, sent as pack Q44 (2026-10-01)
- The columns are Name, School, Category, Team. Are there any others?
- Answer: _

**K3. Unique solution of every puzzle (U-90)** — OPEN, sent as pack Q39 (2026-10-01)
- The answer check compares the submitted grid with the solution stored with the question and relies on every puzzle having a unique solution. Is that guaranteed?
- Answer: _

**K3b. The missing complete-solution column (U-94)** — STILL OPEN, re-ask refined 2026-10-01 (not yet answered by the stakeholder — this is a technical finding sharpening what to ask)
- The source files have no column for the complete solved grid. The stakeholder's reply ("需要一个") was too short to read as a full answer.
- **Technical finding, 2026-10-01:** there is no way to build an interactive, correctly-locked Sudoku grid using only what the sample files provide today. The **given (pre-filled) cells exist only as an embedded picture, not as text** — and OCR is ruled out by project rule (BLD-010/BLD-011's no-OCR principle). This is a deeper, more fundamental blocker than the missing solution column alone: even the puzzle's starting state can't be automatically imported.
- **Refined question to carry back to the stakeholder:** can the real production files include the given (pre-filled) cells as structured text — the same way the answer column already is — not just as an embedded image?
- **Interim plan stays in place while waiting** [T] (BLD-026): manual transcription of the given cells for a small starter set, to build and test the answer-check unit. **General automated import stays blocked** until a clear answer comes back.
- Answer: _ (refined question not yet sent/answered)

**K4. Format of judge and controller credentials (I-30)** — OPEN
- Participants use the participant number and a short random password. What do judges and controllers use?
- Answer: _

**K5. What are I-14 and I-15?** — OPEN, project owner
- The requirements list them as needed before coding (REQUIREMENTS §12), but no file here describes them, and the 2026-09-26 decisions did not address them.
- Answer: _

**K6. Does the 15-day deletion cover the uploaded participant Excel? (U-62, narrowed)** — OPEN
- **Resolved 2026-10-01, see Q27:** archived scores and the correction log DO follow the 15-day deletion [C] (RES-005). Only the participant Excel question remains open here.
- Answer: _
- **Separate, still OPEN (U-59):** legal/school rules for student data, and who must approve the deletion rule — explicitly classified by the stakeholder as genuine unknowns, not a team decision.

**K7. Blank on purpose: TBD — to be decided by the project owner**
- Backend language and framework (I-02), the developers' skills (I-18), names and roles (I-17), who builds what (I-23), and where the server runs on the event day (I-03, U-46). Do not choose a value.

---

- **2026-09-29, answer to pack Q7 (the second team round) received:** resolved (A10). Which mode and the block split are a direct answer [C] (TEM-005, resolves TEM-003, U-91). Puzzle count, total time and points are working positions, not sourced [T] (TEM-006 to TEM-008); new item A10b tracks replacing them with the regulation's real numbers (pack ref R9). No follow-up questions were needed. Recorded in `competition-rules.md`, `architecture.md`, `progress-tracker.md` and the pack (Q7 replaced by a resolved summary and new Q7b).

---

- **2026-10-01, pack Q27 (student data) received:** archived scores and the correction log confirmed [C] (RES-005, resolves U-62's scores/log part) — also deleted after 15 days, same as other student data. **Legal/school data rules and who approves the deletion rule: explicitly left open** [O] (U-59) — the stakeholder classified these as genuine unknowns, not a team decision. A proposed daily-email reminder to the controller in the last 3 days before deletion was flagged as conflicting with ARCH-028 ("no external system integration... no email", Q25). Recorded in `competition-rules.md` §7/§8, `architecture.md` (Storage model), `data-model.md` (`PurgeSchedule`, `AuditLog`).
- **2026-10-01, Parts 3, 4 and 5 of the pack (Q20 to Q35) closed on the project side.** Re-verified every answer against `context/` (no stale OPEN tags found); genuinely-still-open narrowed items (U-02 room mixing, U-46 venue/hosting, U-59 legal rules, U-62 participant Excel, U-65 not stakeholder-confirmed, U-66 deferred to design) are correctly flagged, not dropped. The pack's sixteen question blocks were replaced with three closure summaries.
- **2026-10-01, pack Q38 (awards after an early finish) received:** resolved [C] (U-89, narrowed) — entirely a human, on-site decision by the organizers; the system's only job is to mark "finished early" and compute scores for the rounds actually played (already built, RND-007), no special award-tier computation. Narrows the earlier BLD-018/BLD-030 working position. **Does not resolve U-27** (whether the system computes award tiers at all for a normal finish) — stays open, separate. No follow-up questions were needed. Recorded in `competition-rules.md` (§3), `data-model.md` (`Competition.finishedEarly`), `FILL-BEFORE-CODING.md`, `specs/00-build-plan.md`.
- **2026-10-01, pack Q37 (missing solution column) re-examined — still open, not resolved.** Technical finding: no way to build an interactive, correctly-locked grid from the sample files as they stand — the given (pre-filled) cells exist only as an embedded picture, not text, and OCR is ruled out. Deeper than the originally-asked "missing solution column" alone. Carried back to the stakeholder with a refined question: can production files supply the given cells as structured text too? Interim plan unchanged (BLD-026): hand-transcribe a starter set; general automated import stays blocked. Recorded in `architecture.md`, `competition-rules.md`, `data-model.md`, `samples/README.md`, and K3b above.
- **2026-10-01, pack Q36 (written approval, Part 7) received:** informal process, no formal signature required [C] (A14) — approval happens as the project owner validates each answer along the way, consistent with the existing `FILL-BEFORE-CODING.md` section E row (already marked done). No follow-up questions were needed. Recorded in `FILL-BEFORE-CODING.md` (section E last row, and header note) and `progress-tracker.md` ("Minimum to start coding").
- **2026-10-01, pack Q35 (accessibility and error feedback) received:** no formal accessibility standard imposed, confirmed [C] (U-69) — no WCAG requirement, reasonable practice for the age range (U6–U20) and touch-first devices: ~44px touch targets, high contrast, no keyboard dependency. Autosave-failure feedback: a discreet, non-blocking "reconnecting..." indicator, not an alarming error, while the system retries in the background. No follow-up questions were needed. Recorded in `ui-context.md` (Interaction patterns, Accessibility requirements). **Every question in Parts 3, 4 and 5 (Q20-Q35) now has an answer** — none of the three parts has been formally closed out (summary-replaced) yet.
- **2026-10-01, pack Q34 (screen sizes and orientations) received:** fully responsive design, no fixed screen-size list, confirmed [C] (U-67) — consistent with ARCH-027/U-06. Student answer screen stays landscape-only (existing rule); judge/controller screens impose no fixed orientation; big screens are landscape by nature, no special rule needed. No follow-up questions were needed. Recorded in `ui-context.md` (Responsive rules).
- **2026-10-01, pack Q33 (layouts) received:** left to the design phase, deliberately not blocking now [C] (U-66) — no mockups or layout preferences given yet for the judge, controller, login, waiting, preparation or results screens; scheduled for after the first slice (BLD-009), same timing already set for the visual design generally. No follow-up questions were needed. Recorded in `ui-context.md` (Layout patterns) and `FILL-BEFORE-CODING.md`.
- **2026-10-01, pack Q32 (fonts and Chinese display) received:** font stack confirmed [C] (U-70) — not a bare `system-ui`; explicit stack with generic sans-serif first then named CJK fallbacks in order (PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC), then `sans-serif`. All on-device already, no web-font download — relevant given the venue Wi-Fi risk (U-56, Q19). No follow-up questions were needed. Recorded in `ui-context.md` (Typography, Component Library) and `architecture.md` (I-20 row).
- **2026-10-01, pack Q31 (look and brand) received:** default visual style set as a **Working Position, explicitly not yet a confirmed stakeholder preference** [T] (U-65): light theme, minimal, friendly-but-professional, blue primary with neutral grays (Tailwind CSS defaults). No school brand/colors/logo yet — a placeholder slot kept, not the same as deciding there is none. Revisable once shown to the stakeholder. No follow-up questions were needed. Recorded in `ui-context.md` (Theme, Visual references, Colors table filled with Tailwind-default tokens) and `architecture.md` (I-20 row).
- **2026-10-01, pack Q30 (third language) received:** no third language needed beyond English and Chinese [C] (U-51). Also resolves the bilingual-UI question (U-68, raised separately in section I but answered together here): language is chosen per user, not fixed per event and not shown simultaneously — matches the i18n scaffold already built in Unit 01; default language Chinese. No follow-up questions were needed. Recorded in `ui-context.md` (Language), `project-overview.md` (Open scope questions), `specs/01-foundation.md` (confirming the existing scaffold needs no change).
- **2026-10-01, pack Q29 (creating puzzles) received:** puzzle authoring/generation/editing confirmed out of scope [C] (U-45) — only pre-made questions are imported (Excel, per category); same later-phase category as the reusable Question Bank. No follow-up questions were needed. Recorded in `project-overview.md` ("Out of scope", "Open scope questions"). While here, also corrected a stale cross-reference in the same list: the second team round line still said "OPEN (U-05, U-21)" though it was resolved 2026-09-29 (TEM-005) — fixed.
- **2026-10-01, pack Q28 (export) received:** export format confirmed [C] (U-08) — Excel (.xlsx), with scores, ranks and the answer per question, as already planned. No specific layout or column list imposed; the exact columns stay an easy-to-adjust detail, not a system rule. No follow-up questions were needed. Recorded in `competition-rules.md` §7 and `data-model.md` (`StoredFile`, and removed from "Open points flagged in this model").
- **2026-10-01, the email-reminder flag withdrawn:** the project owner clarified the email-reminder idea was their own (not the stakeholder's) and withdrew it, parking it as a possible later-phase [L] addition. No conflict remains; ARCH-028 stands unchanged.
- **2026-10-01, pack Q26 (speed requirements) received:** ranking updates within 2 seconds of a submission; all tablets start a round together within 1 second of each other [C] (U-58). No other timing requirement identified. No follow-up questions were needed. Recorded in `architecture.md` (Non-functional requirements, Performance).
- **2026-09-30, pack Q25 (external systems) received:** no external system integration for this version, confirmed [C] (ARCH-028, resolves U-57) — the system connects only to its own four ends (tablets, judge/controller devices, big screens); no SMS, email or external student-ID system; credentials generated and printed internally. No follow-up questions were needed. Recorded in `architecture.md` ("External services"). Note: this exact answer, word for word, was already sitting in `context-feeders/decisions/project-decisions.md` as ARCH-028 ("Confirmed 2026-09-30") and in `unmade-decisions.md` as "ANSWERED, pending builder review" before this chat turn — a second convergence of the same kind seen with Q17/SEC-001, Q21/EVT-004 and Q22/ARCH-027.
- **2026-09-30, pack Q24 (where the system runs) received:** two-phase hosting proposal [T] (BLD-031, Working Position, separate from U-46) — Phase 1 (now, free): deploy to Railway for a shareable demo/test link, stays awake 24/7 unlike Render's free tier. Phase 2 (event day, paid, ~800+ clients): a dedicated VM (DigitalOcean/Hetzner), same `docker-compose.yml`, billed hourly. Phase 1 starts immediately; the final Phase 2 choice stays open until U-46 is answered — does not resolve U-46, a separate near-term need. No follow-up questions were needed. Recorded in `architecture.md` (Stack table — new Hosting (demo/testing) row, Open technical decisions). This also matched `context-feeders/decisions/project-decisions.md`'s BLD-031 row almost verbatim, and `progress-tracker.md`'s "Next Up" item 6 already described the same Railway plan — consistent, not a conflict.
- **2026-09-30, pack Q23 (venue network) received:** deferred to closer to the event date, deliberately non-blocking [C] (U-46) — not needed for the current build phase; the priority right now is that the system be reachable from any computer, phone or tablet for testing and demoing, not the real venue's network conditions. The router/on-site-server sub-question carried to Q24 (hosting). Does not hold up construction at all. No follow-up questions were needed. Recorded in `architecture.md` (Devices and network) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q22 (tablet model and browser) received:** no fixed device or browser target [C] (U-06) — the player-facing app must work broadly across platforms, built as a standard responsive web app using only widely-supported web APIs. Replaces the earlier "modern Chromium-based Android browser" working assumption. Testing on a real tablet before the event, if available, is still worthwhile, just no longer a blocking unknown. No follow-up questions were needed. Recorded in `architecture.md` (Devices and network, Risks, and removed from the open technical decisions table), `project-overview.md` (Target users), `ui-context.md` (Component Library, Responsive rules) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q21 (maximum number of devices) received:** 800 simultaneous clients confirmed as the ceiling for this version [C] (U-60) — not the client document's original 1000+ devices / 3000 concurrent users, which targeted the full multi-tenant platform vision, deferred to a later phase. The real known event scale (~600–720 students) fits comfortably under 800, so the existing load-test target stays as-is (~800 clients at ~2 grid saves/second). Also reconciles I-05's "listed both as [C] and as open" flag. No follow-up questions were needed. Recorded in `architecture.md` (Scalability, and removed from the open technical decisions table) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q20 (exact numbers) received:** exact numbers not provided; documented estimates kept as the working position deliberately, not a gap — the design already handles either answer (rooms are just groups of participant numbers, the system is built to ~800 clients regardless of the split). No design changes needed; real numbers can be supplied later with no rebuild. Narrows U-02 to just "whether a room mixes categories," which stays open. No follow-up questions were needed. Recorded in `competition-rules.md`, `data-model.md` and `progress-tracker.md` (Known Issues).
- **2026-09-30, pack Q19 (biggest risks) received:** the venue Wi-Fi (room with ~300 tablets) confirmed as the biggest real-world risk [C] (U-56). Does not change the system design — already designed and load-tested for ~800 clients. Only addition: an advisory reminder note to the controller when creating a competition, telling them to ask their network/IT team to configure the venue Wi-Fi properly. UI copy only, not a functional requirement. Also pre-confirmed pack row R13 (Part 6) directly, no separate round-trip needed there. No follow-up questions were needed. Recorded in `architecture.md` (Risks) and `ui-context.md` (Controller content, new advisory-note line).
- **2026-09-30, pack Q18 (failure tolerance and backup plan) received:** failure-tolerance part answered by pointing to the U-49/Q15 answer (no fixed limit, resume and replay always available, organizer decides on the day) — same decision, not a new one. Backup-plan part (on-site server, paper, etc.) deliberately deferred to Q24 (Part 3, U-46), which asks it in more depth alongside where the server runs on the day; will be answered once there, not twice. No follow-up questions were needed. Recorded in `architecture.md` (Reliability, split into a resolved failure-tolerance line and a still-open backup-plan line) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q17 (anti-cheating) received:** confirmed as-is, nothing added [C] (SEC-001, resolves U-37) — server-owned time and answers, one active device per account, the judge's page-leave count (informational, no penalty) are enough; no camera, no remote proctoring, no additional lockdown, since the competition is in-person and physically supervised by 30+ judges in the room. No follow-up questions were needed. Recorded in `architecture.md` (Security and student data). Note: `context-feeders/requirements/REQUIREMENTS.md` §10 and `context-feeders/decisions/unmade-decisions.md` already carried this same answer under SEC-001, marked "pending builder review" — this matches it exactly, no conflict.
- **2026-09-30, pack Q15 (server stops during a round — tolerable interruption length) received:** no fixed limit [C] (U-49) — the stakeholder deliberately declined to set a time cap; the controller decides, on the day, whether to resume or replay based on the event's schedule at that moment, regardless of how long the interruption lasted. Hard constraint: both resume and replay must always stay available to the controller; the system must never impose a timeout that disables either path. No schema change. No follow-up questions were needed. Recorded in `architecture.md`, `competition-rules.md`, `data-model.md` (`CompetitionRuntimeState` note: no timeout field added).
- **2026-09-30, pack Q12 (what each role can see and change) received:** access rules resolved [C] (U-63, and the general part of U-55): player reads only own answers; judge strictly limited to assigned range, no powers beyond status viewing and single-student restart; only the controller edits participants during the event or corrects a score. `U-39` (judge view in the team stage) stays open. No follow-up questions were needed. Recorded in `architecture.md`, `ui-context.md`, `data-model.md` (new "Access rules" section, added on top of the approved schema, no field/entity change).
- **2026-09-30, pack Q11 (big screens, slips and tablets on the day) received:** out of scope for product design — pure event-day staffing logistics, no screen, role or permission accounts for it [C] (U-54). No follow-up questions were needed. Recorded in `project-overview.md` (flow step 8) and this pack.
- **2026-09-30, pack Q9 (primary user, Part 2) received:** the controller, per the business goal and the roles only it touches (setup, live control, corrections, export) [C] (U-52). The big screen clarified as a passive display target, not a fourth user persona (architectural "Hub-and-spoke" note added to `architecture.md`). No follow-up questions were needed. Recorded in `project-overview.md`, `architecture.md`, `progress-tracker.md` and this pack.
- **2026-09-30, Part 1's remaining five items received (import format, points, solution column, categories, question files per category, score visibility, awards/reset for an early finish, second team round numbers):**
  - ✅ **Resolved, [C], stakeholder-confirmed:** question import format is Excel not PDF (A1c, BLD-012, U-93); points stay fully customizable everywhere (BLD-013, U-92); categories are U6 to U20, the original scheme (BLD-015, U-95); one question file per category, not shared (A5f, BLD-016, U-32); students see scores only when the competition reaches `FINISHED` (A4d, BLD-017, U-24, U-88); reset after finishing is never allowed, already documented, not actually open (part of A6d).
  - 🔶 **Working position, [T], not confirmed — re-asking:** the missing complete-solution column, stakeholder's reply too short (K3b, BLD-014, U-94); awards after an early finish, stakeholder didn't understand the question, re-asked with a scenario (A6e, BLD-018, U-89 narrowed, U-27).
  - **Unchanged working position, no reply, now in active use for building (per the user's 2026-09-30 general instruction that working positions, like confirmed decisions, can be revised later at any time without a rebuild):** the second team round's puzzle count, time and points (A10b, TEM-006 to TEM-008).
  - Recorded across `competition-rules.md`, `architecture.md`, `data-model.md`, `project-overview.md`, `ui-context.md`, `code-standards.md`, `README.md`, `samples/README.md`, `specs/00-build-plan.md`, `progress-tracker.md`, `FILL-BEFORE-CODING.md` and this pack.
  - **Part 1 of the stakeholder question pack is now fully closed out.** Every question in it has either a confirmed answer, a working position, or an explicit "no reply, in use as a working position" status — none is left blank with no status. Its resolved questions were removed from the pack (see below); the still-open items (K2, K3, K3b, A6e, A8) stay in this file to revisit.

## Not yet asked

Nothing. All 7 interview steps and the workflow items from the README checklist have been asked. **Step 8 (written requirements confirmation, A14) was asked and resolved 2026-10-01** (see A14 above, and pack Q36): informal process, no formal signature. The skeleton checkpoint is done too (Unit 1 scaffold built 2026-09-30).
