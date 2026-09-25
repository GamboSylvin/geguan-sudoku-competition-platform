# Sudoku Competition Platform — Unmade Decisions & Open Questions

**Document Status:** live list of open decisions (cleaned on 2026-09-25)  
**Purpose:** everything that is still open, assumed or waiting for an answer. It is the companion to [`project-decisions.md`](./project-decisions.md), which records what has been settled. Only open items are kept here; when one is answered it moves to `project-decisions.md` and leaves this file.  
**History:** the earlier body of this file (sections 1–15, with every resolved row) is archived unchanged in [`../archive/unmade-decisions-history.md`](../archive/unmade-decisions-history.md).  
**Rule:** any question the project files cannot answer is recorded here with the next free ID and a source note. Nothing is guessed or decided in its place.

| Prefix | Meaning |
|---|---|
| **U-** | For the stakeholder, or a low-risk team assumption waiting for confirmation. |
| **I-** | Internal: for the team or the project owner, not for the stakeholder. |
| **SA-, ORG-, PK-, IND-** | Later-phase or detail questions kept from the older register (section 4). |

The stakeholder answered most questions on 2026-09-24 and approved the team's proposals as a whole; the confirmed results are in `project-decisions.md` §15. Each item below shows the default the team can build on and whether it blocks coding.

---

## 1. Needs the stakeholder

| ID | Open point | Assumed default until answered | Blocks coding? |
|---|---|---|---|
| U-01 | **Real sample files were not sent:** the question PDF (with points), the participant Excel, and a past results sheet. | Build the importers against an assumed format and keep them easy to change. | No — but obtain early; it affects only the import module |
| U-02 | **Exact numbers:** 10 rooms × ~30 + 1 room × ~300 is about 600, not the stated 720. How many students, rooms, categories and schools? Does one room mix categories? | Design for about 800 clients; rooms are just groups of participant numbers; a room may mix categories. | No — the design covers either answer |
| U-03 | **Round total:** the original client document says each round is worth 100 points; the stakeholder says points are per question by difficulty. Is the round total fixed at 100 or simply the sum? Are points typed in the app or read from the question file? | The total is the sum of the question points; points can come from the file and be edited in the app before publishing. | No |
| U-04 | **School total:** does the individual part count all of a school's players in the category, or only its team members? The worked example (80+70+60+50, team 100 → 256) was not confirmed. | Count all of the school's players in that category. | No |
| U-05 | **"齐心协力" rules:** how it works (sections of one puzzle vs. one shared full grid), how many puzzles, time limit, points. The stakeholder's Q17 answer was about rankings and did not describe it. | Build rotation first; treat "齐心协力" as a later phase. | Blocks only that mode; rules are needed about day 8 if it is required on competition day |
| U-06 | **Devices and network:** exact model of the learning tablets, Quark version, a test unit, devices for judges/controller/screens, Wi-Fi capacity for 300 tablets in one room. | Assume a modern Chromium-based Android browser; test on a real tablet early; load-test with about 800 simulated clients. | No — but the biggest real-world risk |
| U-07 | **Priorities:** the stakeholder did not rank features into "essential on the day" and "later". | Use the proposed phasing (individual stage end to end first; then team rotation, school ranking, copy, corrections; later "齐心协力" and the question bank) and get it signed off. | No |
| U-08 | **Export file format and columns** for scores, rankings and answers. | Excel (.xlsx) with scores, ranks and the answer per question. | No |
| U-09 | **Score corrections:** the stakeholder said "rankings must be editable". The team proposal (edit scores with a reason and a log) was approved, but the exact intent was not stated. | Edit scores with a reason and a change log; ranks recalculate. | No |
| U-10 | **Copy details:** the stakeholder said the copy keeps "everything the same"; the approved proposal excludes results. Also, student data is deleted after 15 days, so an old copy cannot keep its students. | Copy settings, questions and judges; not results; re-import students after 15 days. | No |
| U-21 | **Is "齐心协力" the client's "partition collaboration" mode?** The client document's team stage has two rounds: rotation relay, then partition collaboration (one puzzle split into blocks, each tablet handles a block). This very probably is the mode the stakeholder called "齐心协力". (The stakeholder's own words, `project-decisions.md` TEM-003, suggested instead a shared board where the whole team sees and edits each other's entries, which may be a different mode.) Confirm, and get how it works, the number of puzzles, the time limit and the points. | Treat them as the same mode; build rotation first. | Blocks only that mode |
| U-22 | **Tie-break rule.** The client document says: same score → rank by round 1 score; if both rounds are equal → shared rank. The team's plan recorded earliest submission time, then alphabetical name. The stakeholder never confirmed either. | The client document's rule (round 1, then shared rank); keep the submission time stored. | No |
| U-23 | **Do players see their own score and rank after results are published?** The client document says yes; the team's plan says players see nothing and only the big screen shows results. | Players see their own score and rank once results are published (client document). | No |
| U-24 | **Does the judge/controller publish results in one step?** The client document has a single "confirm and publish" action; the team's plan finalizes results automatically with no publish step. *(The judge proposal also asked what "publish" would mean: showing the results on the big screen, locking them, officially releasing them, or exporting them. A human confirmation step is worth having only for a concrete need, such as confirming official completion, and never as a check of every answer.)* | One publish action by the controller; players and screens see final results only after it. | No |
| U-25 | **Candidate-number (pencil) marks** on the answer screen: the client document says the standard round supports them; the stakeholder's answer-screen description does not list them. | Not in the first version; add later if wanted. | No |
| U-26 | **Qualifiers list on the big screen:** the client document lists it. Is there any qualification to a next round? | No qualification; not built. | No |
| U-27 | **Awards:** individual top 8 per category get certificates and the top 3 get medals; team prizes go to 10% / 20% / 30% of teams (first, second, third prize — the client document does not say whether the percentages are cumulative or per tier); the top 3 teams get a trophy. Should the system compute and mark award tiers, and put them in the export? | The system marks the award tier in the ranking and export; certificates themselves are produced elsewhere. | No |
| U-28 | **Login flow:** the client document has one entry page where the user picks a role; the team's plan uses a competition-specific link with no global selection. | One link, with role choice on the login page. | No |
| U-29 | **Warm-up round:** the client document's segment library has a third individual "warm-up speed" round; the regulation has only two individual rounds. Is there a warm-up or practice round? | No warm-up round. | No |
| U-30 | **Team rotation total time (T):** is there an overall time limit for the whole team round, and did the stakeholder's "time, 60 seconds" mean the rotation period or the round time? | 60 s is the rotation period; the round has no overall limit unless set. | No |
| U-31 | **Is "Cancel" still needed now that rematch and reset exist?** The team's plan cancels an invalid competition: no final scoring, results not released, and the admin creates a new one. What happens to the data (answers are kept 15 days for appeals)? | Keep cancel as an exceptional action that ends the competition without publishing results; its data is treated like any other and purged after 15 days. | No |
| U-32 | **Question files and categories:** with several categories in one event, is there one question PDF per category (and per round), or one file for the whole event? How does the participant Excel map to the categories? | One question PDF per category; one participant Excel for the whole event with the category in each row. | Blocks only the import design |
| U-33 | **Submission granularity:** is there one submission for the whole round (all 6 puzzles) or one per puzzle? The team's plan says "per puzzle/round"; students move between questions with previous/next buttons. | One submission per round; the student can move between the puzzles until then. | No |
| U-34 | **Preparation length:** how long is the preparation period (rules, countdown) before each round? The team's plan says "predefined" but gives no value. | A customizable value, 30 seconds by default (SCR-005). | No |
| U-35 | **Next stage start:** after a stage finishes, does the next stage start automatically or wait for the controller? The team's plan is inconsistent (lifecycle diagram vs. its stage-transition flow). | It waits for the controller. | No |
| U-36 | **Whole-file re-upload after publishing:** the team's plan forbids replacing the participant Excel after publishing; the stakeholder wants individual add, edit and replace at any time. Is a whole-file re-upload still allowed after publishing? | Only individual edits after publishing; whole-file upload before publishing. | No |
| U-42 | **Is 15 days enough for appeals?** The client document sends results to arbitration and says answers must be kept for appeals (`requirements/REQUIREMENTS.md` §7.8), while answers, scores and student accounts are permanently deleted 15 days after the competition (RES-004). How long does the appeals period last, and who needs the answers after the purge? | Appeals must be settled within the 15 days; the controller exports scores, rankings and answers (RES-002) before the purge, and that file is the only long-term record. | No |
| U-45 | **Puzzle authoring or generation.** The documents mention only importing questions from a predefined PDF; nothing says the app creates, generates or edits puzzles. Confirm that this is out for this version (the reusable question bank is a later phase, CMP-101). | Out of scope: questions come only from the imported PDF (strict format, no OCR); no in-app authoring, generation or editing (see U-43). | No |
| U-46 | **Venue network, internet and hosting.** Is there internet access at the venue? How good is the Wi-Fi in each room (one room has about 300 tablets)? Who provides and runs the server on the day, and where must the data live (school premises, a cloud server in China, elsewhere)? Related: U-06 (devices and Wi-Fi capacity), I-03 (hosting and infrastructure). | No default yet; I-03 keeps the option of an on-site server on the venue network as a fallback, and the design target is about 800 clients (I-05). | Blocks the deployment choice, not the first build units |

## 2. Assumed by the team, low risk (confirm when convenient)

| ID | Assumption |
|---|---|
| U-11 | The controller (控制员) is the administrator; there may be more than one controller. *(Tension with the older working position OA-002, "exactly one admin"; see `project-decisions.md` OA-002.)* |
| U-12 | Takeover of a disconnected judge is manual, and the last action wins. |
| U-13 | A rematch gives students the full round time again, erases their partial answers for that round and keeps earlier rounds' scores; the old scores are archived. |
| U-14 | With one big screen, judge and controller both control it; the stakeholder also offered "controller only in every case". |
| U-15 | Anyone holding the big-screen link can view it; the link can be regenerated. |
| U-16 | Participant numbers are not bound to a device; login is by the printed username and password; the admin can adjust numbers. |
| U-17 | Added or replaced students get a new printed slip. |
| U-18 | The individual early bonus is 3 points per minute (from the original client document), customizable; team rounds have none. |
| U-19 | "Customizable" covers all numeric values and simple settings; the structure (which stages and rounds exist) and the game rules stay fixed. |
| U-20 | Two answer-screen buttons are enough: delete the selected cell, and clear all. |
| U-40 | The participant file needs only Name, School, Category and Team (PAR-004). The client's flow document also listed age, city or province and other classification parameters; they are assumed unnecessary, and extra columns in the file are ignored without an error. Earlier row: OA-1 ("worth confirming nothing else is actually needed"). |
| U-41 | **Team management.** The admin does not form teams by hand (PT-003); the client's flow document says team management is only reading the Team column of the file, while the client's original document lists "grouping" among the participant-management functions. Assumed: no separate team screen; a player changes team by editing the Team value (individual edit, PAR-003) or through a corrected file, and each school keeps exactly one team per category (SCR-004). Earlier questions: "can teams change after import?" (question 26 in `archive/ORGANIZATION_ADMIN_REQUIREMENTS.md`, never carried into the register), PT-003. |
| U-43 | The original question PDF is kept with the competition (as part of its setup, which survives the 15-day purge, RES-004), so a failed or disputed import can be checked; the extracted questions are not edited in the app, the admin corrects the PDF and imports it again. Earlier row: OA-14. |
| U-44 | **A wrong answer key found after scoring.** If the solution stored with a question turns out to be wrong after a round was scored, there is no automatic re-scoring (the earlier plan excluded result recalculation and an answer-key correction workflow, and the stakeholder approved score corrections with a reason and a change log, RES-003). Assumed: the controller corrects the affected students' scores one by one with a reason, or orders a rematch of the round (ROL-005), and fixes the question file for the next event. |
| U-37 | **Anti-cheating inside the venue is kept light:** no software measures beyond server-owned time and answers, one active device per account, and human supervision by the judges (from the stakeholder's "keep it light", §15.5, and the venue setting). Camera, remote-proctoring and similar measures stay out of scope. Source: earlier open row FL-5. |
| U-38 | **No manual start of a single round: stakeholder confirmation.** The judge proposal had a manual round start as an exception path (recovering from a stuck automatic transition). The team already decided to drop it (`project-decisions.md` CS-022, Confirmed 2026-09-23): the build has only stage start, pause, resume, early end, finish and reset, and recovery is reset, rematch or replay (ROL-005). Still needed: the stakeholder confirming that dropping it was intentional (earlier row JD-14). |
| U-39 | **Judge view in the team stage.** Nothing defines what a judge sees for team rounds. Assumed: the same per-student status (connected, submitted) for the judge's number range, with no separate team view. Earlier row: JD-25. |

## 3. Internal (not for the stakeholder)

| ID | Open point |
|---|---|
| I-01 | **The skeleton must be revised before coding:** the planning guideline's domain model, API and 15-day plan predate these answers. They need events with several categories, rooms and judge number ranges, per-question points, configurable values, archived scores, the state of a team's rotation (refill queue and the question each tablet holds; the old row DP-6 asked for a team-progress data model), a score-correction log, an "auto-filled" flag, the 15-day purge, participant numbering, copy, and several synchronized big screens. The Guideline's module list also has no module for team rotation, control-hub arbitration, score corrections, purge, import/export or copy (see `requirements/ARCHITECTURE.md` §3). |
| I-02 | Backend language/framework is still not named (ARCH-2). |
| I-03 | Deployment and infrastructure, including whether to run an on-site server on the venue network as a fallback (ARCH-8/9). The venue facts the team needs from the stakeholder are U-46. |
| I-04 | PDF extraction approach (ARCH-11). |
| I-05 | Load test target: about 800 clients sending roughly 2 grid saves per second. |
| I-06 | **Question delivery timing.** Preloading questions on the tablets keeps traffic light but lets a student inspect them early; fetching at round start creates a burst of requests (up to 300 tablets in one room). Options: preload encrypted and release the key at the start, or fetch at the start with staggering. |
| I-07 | **Screen command log.** The client document requires screen commands to be traceable; how much is logged and for how long is undecided. |
| I-08 | **Event scope.** `archive/ARCHITECTURE_REQUIREMENTS.md` (ARC-020) put in-process events across the whole game subsystem; the later Guideline uses direct calls by default and events mainly for recording player moves and state. Decide which one to follow; the Guideline is the more recent and simpler. Also decide whether the same events feed the real-time push to clients or push stays a separate concern (`archive/ARCHITECTURE_REQUIREMENTS.md` ARCQ-2). Both developers should then record their acceptance of the final style and event scope. |
| I-09 | **Matching participants across file versions.** When a corrected Excel replaces an older one, unchanged participants keep their accounts; how two rows are recognized as the same person (name plus school plus category?) is an implementation rule still to define. |
| I-10 | **Server restart during a round.** What happens to runtime state (in Redis: working grids, timers, current round state) if the server or Redis restarts mid-round? Decide what must be written to PostgreSQL so a round can resume (e.g. round start time, latest saved grids) rather than be replayed, and whether Redis persistence is turned on. Today only "a failed round is replayed" (ROL-005) is decided. Earlier rows: FL-3, ARCH-19. Also the durability of events (`archive/ARCHITECTURE_REQUIREMENTS.md` ARCQ-3): is in-process delivery enough, or must some events survive a restart? |
| I-11 | **Late manual submit.** A student presses submit just before the timer ends but the message reaches the server after it. Options: the server's clock decides and the late submit is ignored (the last autosaved grid is auto-submitted instead); or a short grace period (a few seconds) accepts it. Affects the fairness of the last seconds and the submission API. Source: `archive/PLAYER_REQUIREMENTS.md` §8, "connection lost near the exact time of submission or time expiry". |
| I-12 | **Removing a judge who is assigned to an unfinished competition.** The admin can remove a judge from the reusable list (OA-061); what happens if that judge is assigned to a competition that has not finished is not specified. Working default: a judge assigned to a live or upcoming competition cannot be removed until that competition finishes, and the controller takes over a judge who is disconnected (ROL-004). Source: `archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-061. |
| I-13 | **Rejected or failed login.** No document says what a player or judge sees when the username or password is wrong, or the account is not in this competition. Working default: one generic message ("wrong username or password", in both languages) that does not say which part was wrong, and no lockout. Earlier rows: PL-6, JD-9, FLW-Q3. |
| I-14 | **Puzzles with more than one valid solution.** Answers are checked by comparing the submitted grid with the stored solution (`requirements/REQUIREMENTS.md` §3). If a puzzle has several valid solutions, a correct answer that differs from the stored one would be rejected. Working default: the question file must contain only puzzles with a unique solution, and the import checks the file format only. Alternative: check the submitted grid against the puzzle's rules instead of one solution (more work for variant puzzles). Source: `archive/STAGE_REQUIREMENTS.md` IND-012. |
| I-15 | **Grid shapes.** Puzzles can have different shapes (9×9 and 9×6 were discussed; IND-4). The grid model, the answer check, the answer screen and the question file format must not assume 9×9. This changes the domain model and the question file format, so under the triage rule it needs a decision before coding: which shapes exist, how a shape is written in the PDF, and how it relates to question type (IND-3). Source: `archive/STAGE_REQUIREMENTS.md` IND-020, IND-021. |
| I-16 | **Session length and idle behavior.** No document says how long a login lasts, what happens when a session expires or a tablet goes to sleep, or how a session interacts with one active device per account (PAR-005: a new login takes over). Product constraints only, not decisions: a session must survive the whole event day and a page refresh, and an expired session must not lose saved answers. To be decided with the team; not for the stakeholder. Source: builder question, 2026-09-25. |
| I-17 | **Team roles and names.** The documents say only that the team is two junior developers and that there is a stakeholder on the client side and a project owner who made the single-tenant decision (ENV-007). They do not say who the developers, the business lead and the project owner are. To be supplied by the project owner; not for the stakeholder. Source: builder question, 2026-09-25. |
| I-18 | **What the two developers already know well** (languages, frameworks, databases). Not recorded anywhere, and it decides the backend language and framework (I-02). To be supplied by the project owner or the developers; not for the stakeholder. Source: builder question, 2026-09-25. |

## 4. Still open in the older register (later phases and detail)

Not needed to start coding. The old architecture rows ARCH-2 and ARCH-8 to ARCH-11 are tracked as I-02 to I-04, and ARCH-14 to ARCH-16 as I-01.

| # | Question |
|---|---|
| SA-1 | What exactly can a Super Administrator do? *(Partially answered — MVP working scope in `archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-2 | What are the Super Administrator's responsibilities and permissions at platform level? *(Partially answered — see `archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-3 | Does the Super Administrator manage tenants (organizations), billing, platform configuration, or something else? *(Tenant overview/revocation: yes. Billing deferred — no payment system. Platform configuration: open.)* |
| SA-4 | Is there any tenant-level overlap between Super Admin and Organization Admin responsibilities? *(Still open — recorded in `archive/SUPER_ADMIN_REQUIREMENTS.md` §7.)* |
| SA-5 | Should the Super Administrator be able to view competition results of a particular organization? *(Open.)* |
| SA-6 | Should the Super Administrator be able to access competition participants? *(Open — current lean: out of scope.)* |
| SA-7 | What exactly happens when a tenant is revoked/deleted? *(Open — deletion semantics.)* |
| SA-8 | Should Super Administrator access be read-only except for revocation, or can they edit tenant/competition info? *(Open.)* |
| SA-9 | What exactly counts as "basic information" for a tenant and for a competition? *(Open; from question 3 of `archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-10 | What analytics, if any, should the Super Administrator see? *(Open; question 4.)* |
| SA-11 | Can a revoked tenant be restored, and can the Super Administrator suspend or block one organization admin without deleting the tenant? *(Open; questions 6 and 7.)* |
| SA-12 | Should Super Administrator actions be auditable, and when a payment system exists, what billing management should the role have? *(Open; questions 10 and 11.)* |
| ORG-1 | Can an organization have multiple administrators in the future (beyond the MVP one-admin model)? |
| ORG-2 | Is there a future need for organization-level permissions or role hierarchies? |
| ORG-3 | Can the Organization Admin change organization information? |
| ORG-4 | What organization information is required in the MVP? |
| ORG-5 | Can an organization be deactivated? |
| ORG-6 | What happens to an organization's competitions and data after deactivation? |
| IND-3 | **Question types** for the Individual stage are to be defined. Which types exist, and how are they determined? |
| IND-4 | What **puzzle shapes** are supported (e.g., 9×9, 9×6)? How does shape relate to question type? |
| PK-1 | Is PK always random pairing? |
| PK-2 | Random among whom: all eligible participants, a category, a stage, or another scope? |
| PK-3 | Are there pairing eligibility constraints? |
| PK-4 | What happens with an odd number of eligible participants? |
| PK-5 | Can a participant appear in multiple PK rounds? |
| PK-6 | Can pairings be regenerated? |
| PK-7 | Who or what determines the final pairing? |
