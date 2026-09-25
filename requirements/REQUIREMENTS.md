# REQUIREMENTS.md

**Status:** Consolidated and reviewed on 2026-09-25: all 12 source passes and the merge of the stakeholder answers (pass 0) are done (`../archive/client-view.md`, the Alignment Guideline, the Q2 and Q3 summaries, `../archive/PROJECT_ANALYSIS_UPDATED.md`, `../archive/PLAYER_REQUIREMENTS.md`, `../archive/ORGANIZATION_ADMIN_REQUIREMENTS.md`, `../archive/JUDGE_REQUIREMENTS_PROPOSAL.md`, `../archive/STAGE_REQUIREMENTS.md`, `../archive/FLOW_REQUIREMENTS.md`, `../archive/ARCHITECTURE_REQUIREMENTS.md`, `../archive/SUPER_ADMIN_REQUIREMENTS.md`); see `../archive/CONSOLIDATION_LOG.md`
**Purpose:** The single place for what the product must do. Decision status lives in `../decisions/`; the technical design lives in `ARCHITECTURE.md`.
**Sources:** the client's original vision (`../archive/client-view.md`, Chinese) and the team's engineering guideline (`../archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`). The stakeholder's later answers (register §15) are merged into this document; the decision ID is shown next to each statement.

## 0. How to read this document

Every statement carries a status tag and, where it exists, a decision ID.

| Tag | Meaning |
|---|---|
| **[C]** | Confirmed by the stakeholder. |
| **[S]** | Stated in the client's original document; not contradicted by later answers; not yet re-confirmed. |
| **[P]** | Proposed by the team and approved by the stakeholder in one blanket answer ("your suggestions are good"), without discussing the detail. The register calls these "accepted proposal". Re-check these first if the stakeholder later disagrees. |
| **[T]** | Team decision from the engineering guideline; not yet reviewed by the stakeholder. |
| **[A]** | Assumed by the team, awaiting confirmation. |
| **[O]** | Open — see `../decisions/unmade-decisions.md`. |
| **[L]** | Later phase, not in the MVP. |

The stakeholder's working principle for everything that can be set: **make customizable whatever can be customized, and operate the rest directly.** **[C]** (with U-19: numeric values and simple settings are customizable; the structure and the game rules stay fixed)

Rule for conflicts: the latest stakeholder answer wins over the client's original document, which wins over team proposals, which win over older drafts. Conflicts are never resolved silently; they are listed in `../decisions/unmade-decisions.md`.

## 1. Product overview

- Working name: **Sudoku Arena**. **[T]**
- The product is a web app that runs a school Sudoku competition digitally, based on the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League. **[S]**
- The MVP is **not** a generic competition engine or multi-tenant platform; it serves one organizing institution's competition. **[C]** (ENV-007)
- **Why the product exists:** many Sudoku competitions in China, run by schools and other organizations at local and regional level, are still largely paper-based. That means printing and distributing materials, preparing rooms, collecting and correcting answer sheets by hand, calculating and checking rankings by hand, a risk of human error, and little real-time view of progress. These problems grow with the number of participants. **[S]** (`../archive/PROJECT_ANALYSIS_UPDATED.md` §1)
- **Objective:** digitalize the *operational process* of running a competition (setup, distributing problems, collecting answers, validating, scoring, ranking, monitoring, displaying, and access to the data afterwards), not just provide an online Sudoku game. **[S]**
- **Business goals:** reduce material costs; reduce organizer effort; reduce correction time (answers validated automatically); reduce human error; improve real-time visibility for judges and organizers; provide a reusable platform (multi-tenant SaaS is the long-term vision, deferred, see §11). **[S]**
- **Operating environment:** participants compete **in person** in a supervised venue such as a classroom, on organization-provided tablets or computers (the real event uses learning tablets). **[S]**
- **Four ends:** player, judge, admin/controller, and big screen. **[S]**
- The ends never talk to each other directly; everything goes through one server hub, which makes permissions, state sync and data storage easier. **[S]**
- Players and big screens are **passive** ends (they receive commands and display). Judges and the admin are **active** ends (they send commands and control). **[S]**
- The system must work on a weak network with light traffic (see §10). **[S]**
- **Real scale:** about **600–720 students** (the stated numbers do not add up: 10 rooms of about 30 plus one room of about 300 is about 600; U-02), **11 rooms**, **at least 30 judges** and **10 big screens**. Design and test target: about **800 clients** online at once. **[C]** (EVT-001; exact numbers open)
- **Delivery constraints:** two developers (a junior team, so the design must stay easy to understand), about 15 days. **[T]**
- **Priorities, in order:** (1) correct competition execution, (2) server-authoritative state and timing, (3) reliable autosave and reconnection, (4) automatic scoring and ranking, (5) judge control, (6) big-screen display, (7) simple deployment and maintenance. Generic configurability and future platform capabilities are deferred. **[T]** **Proposed phasing** (not yet signed off by the stakeholder): first the Individual stage end to end; then team rotation, the school ranking, copy and score corrections; later 齐心协力 and the question bank. **[A]** U-07 (the stakeholder did not rank features into "essential on the day" and "later"; 齐心协力 blocks only its own mode: U-05, U-21) Note that the team stage has two rounds and the school total uses both team rounds, so if 齐心协力 is needed on competition day, its rules are needed by about day 8 of the build (U-05).

## 2. Competition structure

- The real format has only an **Individual stage** and a **Team stage**. There is no PK stage. **[C]** (CS-010)
- Hierarchy: **event → categories → stages (Individual, Team) → rounds**. **[T]** Several categories run **in parallel** and are ranked separately; rooms are groups of participant numbers. **[P]** (EVT-002) Sessions that run at the same time are all Individual or all Team, and one start command starts all categories together. **[P]** (EVT-002) Whether a room mixes categories: **[O]** U-02. This replaces the guideline's "one competition = one category".
- Categories run from **U6 to U20**. **[T]**
- Stages, rounds, their order, durations, preparation times and rules are **predefined in code or configuration**; the admin does not define them. **[T]** Every **numeric value** (points, coefficient, bonus, counts, times) is customizable, by the controller only, and only before a round starts; the structure and the rules stay fixed. **[P]** (SCR-005)
- Each stage has two rounds. **[S]**
- Results are computed per age category. **[P]** (EVT-002)

## 3. Individual stage

| Round | Content | Questions | Time | Max score |
|---|---|---|---|---|
| 1 | Standard Sudoku | 6 | 20 minutes | 100 **[S]** |
| 2 | Variant (irregular) Sudoku | 6 | 30 minutes | 100 **[S]** |

- Variant examples: diagonal, killer, jigsaw Sudoku. **[S]** Exact question types and grid shapes: **[O]** (`unmade-decisions.md` IND-3, IND-4).
- Whether "100" is per round or per question, and whether a round's total is fixed: **[O]** U-03. The stakeholder decided that points are set **per question by difficulty** and are customizable; this replaces the earlier answer "the same points for every question in a round" and the planning document's flat 100 per question. **[C]** (SCR-003)
- A question with a wrong or missing entry scores 0; there is no partial credit. **[C]** (SCR-001)
- **Early-finish bonus:** only when the round is finished and everything is correct; whole minutes only (finishing 1 minute 30 seconds early counts as 1 minute). **[C]** (SCR-002) The bonus rate of 3 points per minute comes from the client document and is customizable. **[A]** U-18
- A round can be submitted early; after submitting, the student cannot answer again and the puzzle becomes read-only. **[S]** / **[T]**
- The student can edit the puzzle freely until submitting, and gets **no live correctness feedback**. **[T]**
- Each player has **one effective submission**; duplicate submissions have no extra effect. **[T]** Whether the submission covers the whole round or each puzzle: **[O]** U-33.
- The complete answer is evaluated **only at submission**, automatically, against the stored solution; nobody calculates scores by hand. **[T]**
- Every move is saved automatically, because the system must hold the player's current state if the time limit is reached before a manual submit. **[C]** (PL-006) How and where it is saved is an architecture matter (`ARCHITECTURE.md` §5).
- A submission is the player's final result for that round. **[C]** (PL-007)
- At time expiry the **latest saved state is submitted automatically**, however complete the grid is. An empty grid scores 0. There is no penalty for a zero score, no moves, never submitting, or a network disconnection. **[T]**
- In the Individual stage each player is scored, ranked and stored **as an individual**; team membership has no effect. **[T]** (CS-013)
- **How an answer is checked:** each question stores its starting grid and its solution, taken from the imported PDF. The submitted grid is compared with the stored solution, so the system does not need to know a question's type; with all-or-nothing scoring per question (SCR-001) and points set per question (SCR-003), no per-type scoring is needed. **[T]** (EX-001, EX-010; not yet reviewed by the stakeholder.) A puzzle with more than one valid solution would wrongly reject a correct answer: **[O]** I-14.
- **Grid shapes vary.** Puzzles can have different shapes (9×9 and 9×6 were discussed); the grid model and the question file must not assume 9×9, and the import needs a defined shape for each question type. **[T]** The supported set of shapes and the link between shape and question type: **[O]** IND-4, I-15.
- Each question's point value is **shown on the student's device**. **[S]**
- Students wait for a **unified start command** before each round begins. **[S]**
- A "difficulty coefficient × base points" mechanism is a possible way to set per-question points. **[S]** / **[O]** U-03
- The standard round may support **candidate-number (pencil) marks**. **[S]** / **[O]** U-25

## 4. Team stage

- A team has **4 players** who answer on tablets; team size can be 2–6, default 4. **[S]** (CS-014)
- The team stage has **two rounds**: round 1 is **rotation relay (轮转接力)**; round 2 is **partition collaboration (分区协作)**. **[S]** Partition collaboration is very probably the stakeholder's "齐心协力" mode. **[O]** U-21 The stakeholder's own words suggest a shared board where the whole team sees and can edit each other's entries, which may be a different mode from the client's block-per-tablet design; its rules are not defined. **[O]** (TEM-003) The stakeholder confirmed that the team stage has only two modes, rotation and 齐心协力, and that **rotation is built first**. **[C]** (TEM-001)
- The buzzer-style mode (抢答夺分) is dropped. **[C]** (TEM-001)
- Team rounds get **no early-finish bonus**; the client document's +10 per minute is superseded. **[C]** (SCR-002)
- Each team round can be submitted early. **[S]**
- Finished puzzles are checked **automatically**, not marked by the judge. **[C]** (EX-001)
- Teammates do **not** communicate through the system (no chat or voice). **[C]** (TEM-002)

### 4.1 Rotation relay — rules

The stakeholder said the rules follow the client's mind map, so the rules below are **[C]** (TEM-004). Customizable values follow SCR-005. The team answer screen can be built first and refined later. **[C]** (UI-002)

| Parameter | Symbol | Meaning | Default | Range |
|---|---|---|---|---|
| Players per team | n | Members in a team | 4 | 2–6 |
| Total questions | m | Questions in the round's pool | 10 | custom |
| Points per question | s | Points for one correct answer | 10 | custom |
| Rotation period | t | Seconds between rotations | 60 | custom |
| Total round time | T | Upper limit for the whole round (assumed: none unless set; the stakeholder's "time, 60 seconds" is read as the rotation period, U-30) | none | custom / unlimited |

**Algorithm (five steps)**
1. **Initial deal:** draw `min(n, m)` different questions at random and give one to each member A, B, C…; the rest wait in a refill queue.
2. **Timed rotation:** every t seconds the questions move one seat clockwise (A→B→C→D→A). Empty seats take part in the rotation.
3. **Answer and refill:** when a member submits, the answer is checked; if correct the team gets s points. That member's tablet immediately receives a new random question from the refill queue, without waiting for the next rotation.
4. **Not enough questions:** when the remaining questions r are fewer than n, r random members hold a question and the others show "waiting". The rotation continues.
5. **Finish:** when the refill queue is empty and everything on the tablets is answered, or when T is reached, the team score is settled. The end condition is configurable.

**Design points:** (1) the **questions** rotate, not the seats; (2) an empty seat is not an elimination, only a wait; (3) the two checks `min(n, m)` and `r < n` cover every team size from 2 to 6; (4) submitting triggers the refill at once.

**Example (4 members, 10 questions, rotation every minute):** four different questions are drawn (for example #5, #2, #8, #9), six remain queued; every minute they rotate A→B→C→D→A; each finished question is replaced from the queue until it is empty; with 3 left one member waits, with 2 left two wait, with 1 left three wait. (An earlier discussion mentioned 16 questions and a rotation of "a couple of minutes"; the client example and the defaults are 10 questions and 60 seconds, customizable, TEM-002.)

### 4.2 Partition collaboration

One puzzle is split into several blocks. Several tablets are linked, and each one is responsible for one block. The team scores when the whole puzzle is complete. **[S]** How it works in practice, the number of puzzles, the time limit and the points: **[O]** U-21.

## 5. Scoring, ranking and awards

- **School total** = (sum of the two-round individual scores of the school's players in that category) × 0.6 + (the school's two-round team scores). The 0.6 is customizable. **[C]** (SCR-004) Counting all of the school's players in that category, not only its team members, is assumed: **[A]** U-04.
- Each school has exactly one team per category, and a school ranking by this total is required. **[C]** (SCR-004)
- **Scoring is automatic** and the judge does not calculate it. A finalized round result stores the stage, round, player or team, score, and completion/submission time. **[T]**
- **Rankings** are derived by the system from the rules and the results; nobody ranks by hand. The judge or controller only decides when and how a ranking is shown on the big screen (§8). **[S]** / **[T]** Individual players are ranked per category on the total of their two rounds, and teams are ranked on their team-stage score, as the awards imply. **[S]** The Individual and Team stages are ranked separately, in addition to the school total. **[T]** / **[C]** (SCR-004)
- **Provisional ranking** is produced after every completed round and is **cumulative** across the completed rounds. It updates **immediately whenever an individual round result is finalized**, without waiting for every participant. The **final ranking** of a stage is the latest provisional ranking when the stage finishes: pending auto-submissions are processed, scores are calculated, the cumulative ranking is finalized and the stage becomes `FINISHED`. Ranking data keeps its stage. **[T]** After that it changes only through a logged correction. **[P]** (RES-003)
- The actual **completion/submission time is kept** for ranking. **[T]**
- **Tie-break:** the client's rule is *same score → rank by round 1 score; if both rounds are equal → shared rank*. The team's plan recorded *higher score, then the earlier completion/submission time, then, if the times are identical to the second, alphabetical name (case-insensitive)*. **[O]** U-22
- **Score corrections:** the controller can correct scores with a mandatory reason; ranks recalculate automatically and a change log records who changed what. **[P]** (RES-003; the stakeholder's earlier "rankings must be editable" is met this way, and the stakeholder's exact intent is open, U-09) A rematch archives the old scores instead of deleting them. **[P]** (ROL-005) There is no in-app dispute workflow. **[A]**
- **Awards (client regulation):** individual — top 8 in each category get a certificate and the top 3 get a medal; team — 10% first prize, 20% second prize, 30% third prize (the client document does not say whether the percentages are cumulative or per tier); the top 3 teams get a trophy and medals. **[S]** Whether the system computes or marks awards: **[O]** U-27.

## 6. Roles and permissions

**Guiding principle:** the judge and the controller are the operators and supervisors of a live competition, not the engine that runs or calculates every operation. The system runs the normal flow automatically (progression, validation, scoring, ranking, saving); a human steps in only when something needs it (start a stage, pause, end early, reset) and controls what the public sees. A feature is added only where it has a real operational purpose, not because it is technically possible. **[T]** (J-001)

- **Player:** logs in, sees the registered events, answers and submits. A player does **not** start a competition or a stage, control progression, calculate rankings or official results, control the public display, choose which board is projected, create or configure competitions, or manage participants. **[C]** (PL-001) Whether players see their own score and rank after results are published: **[S]** in the client document, **[O]** U-23 against the team's plan.
- **Judge:** at least 30 judges. **[C]** (EVT-001) Each is assigned a range of participant numbers, sees the status of those students (connected, submitted) and can restart the round of one student. Judges do not start, pause or end rounds for everyone. **[P]** (ROL-003) A judge also sees the current stage, round and remaining time, and the **live ranking**, which is always visible and not gated behind a decision. **[T]** (J-034) There is **no** per-student elapsed-time or progress display. **[T]** (JD-22, JD-23) In the team stage the judge sees the same per-student status (team members have consecutive numbers, PAR-001), with no extra team view: **[A]** U-39. The client document also has the judge choose the session, issue the unified start command, control the big screen, confirm and publish results, and hand results to arbitration. **[S]** Judges are created by the admin (name only), their credentials are generated and printed. **[T]** / **[C]** (PAR-002)
- **Controller (控制员, assumed to be the admin):** the controller is the administrator. **[A]** (ROL-001, U-11) It can do everything a judge can, plus event setup, rules and customization. **[C]** (ROL-002) Commands: start a stage, pause, resume, end a round early, finish the competition, reset or rematch, correct scores, take over from a disconnected judge, control the big screens. **[C]** (ROL-004, ROL-005) The takeover is manual and the last action wins: **[A]** U-12. Cancel: **[O]** U-31. The controller sees all progress in real time. **[C]** (ROL-004)
- **Admin areas:** four — competition entry (name, time, category, question import), participant management (registration, grouping, batch account creation; the client's later flow document limits team "grouping" to reading the Team column of the file, see §7.2 and U-41), format configuration (numeric values only; the "logic template upload" idea is rejected), and data analysis (score reports, rankings, the school total). **[S]** The analysis area is narrowed for the first version to the final rankings, the final scores and the export (§9). The client's entry form also lists a competition time; the team's working position is that the overall duration is not configured but derived from the rounds (CS-006).
- **Big screen:** a passive display. All big screens open from **one shared link with no per-screen login**; the controller opens it on the screens. **[C]** (BSC-001) With one screen, judge and controller both control it and the last action wins; with several screens only the controller controls them, and all show the same content. **[C]** (BSC-002) Commands are traceable (logged). **[S]**
- **Judge publishes results once:** the client document has a single "confirm and publish" step; the team's plan has automatic finalization. **[O]** U-24 (which also records what "publish" could mean, and that a human confirmation is only for a concrete need, never a check of every answer)

## 7. Functional flows

### 7.1 Lifecycle

The server controls the lifecycle. **[T]**

`CREATED` → *publish* → `PUBLISHED / WAITING` → *the controller starts a stage* → `PREPARATION` → *countdown completes* → `ROUND_ACTIVE` → *timer ends, or the round is ended early* → `ROUND_FINISHED` → more rounds? → `PREPARATION`; otherwise `STAGE_FINISHED` → more stages? → the next stage; otherwise `FINISHED`.

Interruptions: `ACTIVE → PAUSED → RESUME COUNTDOWN → ACTIVE`; `ACTIVE → FINISHED`; `ACTIVE → CANCELLED` (**[O]** U-31).

- A round transition happens only after all required scoring for the finished round is final and the provisional ranking is updated. **[T]**
- **Starting a stage changes the competition's state; it is not a signal sent to each player.** The server then moves every connected end through the sequence. **[T]** (J-002)
- **Rounds within a stage progress automatically:** once a stage has started, the sequence preparation → countdown → round → end → next preparation needs no judge or controller action. A human acts only to start a stage, pause, resume, end early, or reset. **[T]** (J-003)
- The preparation countdown is automatic; its length: **[O]** U-34.
- Whether the next stage starts automatically or waits for the controller: **[O]** U-35 (assumed: it waits).

### 7.2 Competition setup

1. Only the admin (controller) can create a competition; judges and players cannot. **[S]** The admin creates the competition with a **name, description, category, participant Excel and question PDF**. No venue or organizer-name field. The server generates the creation time, identifiers, player identifiers and credentials. **[T]** With several categories in one event, how the Excel and PDFs map to categories: **[O]** U-32.
2. **Participant Excel:** Name, School, Category, Team (the school is needed for the school total); the participant number is generated. **[T]** (PAR-004, a working position) **Numbering:** schools in Excel order, then students in row order, unique across the whole event, and a team's numbers are consecutive; the number is printed on the credential slip and stuck on the tablet. **[P]** (PAR-001) Participant numbers are not bound to a device, and the admin can adjust them: **[A]** U-16. The client also considered age, city or province and other classification columns; the assumption is that the four columns are enough and extra columns are ignored without an error: **[A]** U-40. The Team value decides which players are on the same team. The admin does **not** form teams by hand: team information comes from the file and the system derives the teams. **[S]** (PT-003) There is no separate team-management screen; a team changes only by editing the player's Team value or by importing a corrected file: **[A]** U-41. The system creates participants, teams and accounts, generates credentials, and exports the credential list, which is **printed**. **[T]** / **[C]** (PAR-002)
3. **Validation is atomic:** an invalid file commits nothing. Missing name, invalid category, invalid team size or the same person in conflicting teams reject the whole file; exact duplicate rows may be cleaned automatically, but contradictory data is never silently resolved. Errors name the problem and the row ("Missing name — row 17"). **[T]**
4. **Re-upload:** a corrected file is fully validated first; only a valid file replaces the dataset, and teams, accounts and credentials are synchronized; an invalid file leaves the existing dataset untouched. Participants whose data is unchanged keep their accounts. **[T]** Participants can also be **added, edited or replaced individually before, during and after** the competition. **[C]** (PAR-003) An added or replaced student gets a new printed slip: **[A]** U-17. A changed participant is treated as an identity change: the old participation is removed, a new one is created and new credentials are issued. **[A]** Participants removed from a file are removed from the active set. **[T]** The guideline forbade replacing the whole Excel after publishing; whether a whole-file re-upload is still allowed then: **[O]** U-36. How two records are matched as the same person is an implementation detail still to define: **[O]** I-09.
5. **Judges** are a reusable list: the admin creates a judge by name (the system creates the account and shows the generated credentials immediately), can remove a judge, and picks judges from the list, or creates them during setup, and assigns them before publishing. A judge's authority is limited to the competition they are assigned to. **[T]** / **[C]** (OA-010 in the register; the removal of a judge who is assigned to an unfinished competition: **[O]** I-12) (The guideline required exactly one judge per competition, who could not serve a second ongoing competition and became available again after finishing or cancelling; superseded by ROL-003.)
6. **Questions:** a PDF in a strictly predefined format; the system validates it, extracts the questions, and assigns them to the predefined rounds. The imported questions form the competition's own **question pack**. There is **no OCR**. Any structure, parsing, extraction or classification failure rejects the whole import; nothing is committed partially. The admin receives an explanation of the failure, fixes the PDF and retries; extracted questions are not edited in the app, and the original PDF is kept with the competition: **[A]** U-43. **[T]** The reusable Question Bank is **[L]**; the first version uses each competition's own upload. **[C]** (CMP-101)
7. **Publish readiness:** competition information valid; participant file valid and participants and teams exist; accounts and credentials exist; question import complete and questions assigned to the predefined rounds; the fixed stages and rounds valid; judges assigned. If any condition fails, publishing is refused. **[T]**
8. Until it is published, the admin can edit the competition freely. **Publish** generates the competition entry link/QR, makes the competition available to players and judges, and locks the structure. **[T]** It also produces the **big-screen link**, which is separate from the player and judge entry link (all screens share it, BSC-001; regenerating it: U-15). **[S]** Numeric values stay editable by the controller until each round starts **[P]** (SCR-005), and participants stay editable **[C]** (PAR-003).
9. **Copy:** a copy button duplicates a configured competition and restarts it as a new one. It keeps the settings, the questions and the judges, not the results. After the 15-day purge the students must be imported again. **[C]** (CMP-100) The stakeholder said "everything stays the same", so what exactly is copied is partly open (U-10).

### 7.3 Entry and player runtime

1. Entry: the player opens the competition link/QR, which identifies the competition; there is no global competition-selection screen; the player logs in with the printed credentials and enters the competition room. **[T]** Judges enter the same way with their own login. **[T]** The client document has a role-selection page instead. **[O]** U-28
2. Only members of the competition's participant dataset may take part, and a judge can enter only the competition they are assigned to; a judge assigned to another competition gains no access. **[T]** What a rejected or failed login shows: **[O]** I-13.
3. The competition room shows the competition, category, stages and the current state. **[T]**
4. Flow: competition room → wait for the start → stage starts → preparation room (the round's **rules** and a **countdown**) → countdown → round active → solve with continuous autosave → submit or automatic submission at time expiry → evaluation and score → wait for the next round → next preparation. **[T]**
5. After submitting, the student sees that the submission was accepted and waits; the student does not need to see the score immediately. **[T]** (Whether players later see their own score and rank: **[O]** U-23.)
6. Each account has **one active device**. A student whose tablet fails can continue on another tablet with the same login; the saved answers and the remaining time carry over, and the new login takes over. **[P]** (PAR-005) The judge sees how many times a student left the answer page: information only, no automatic penalty. **[P]** (PAR-005)

### 7.4 Submission and early end

- Manual submission: lock the puzzle → evaluate → score → store the result → update the ranking → notify the connected screens. **[T]**
- Time expiry: the latest saved state is auto-submitted and goes through the same path. **[T]** A manual submit that reaches the server after the timer has ended (lag near the deadline): accepted, rejected, or given a short grace period — **[O]** I-11.
- **Early end of a round by the controller:** stop the round → auto-submit every student's latest saved state → evaluate → score → update the ranking → continue to the next round or stage. **[T]** It cannot be undone; the way back is a reset or rematch (ROL-005). **[T]** (J-031)
- **No manual start of a single round.** The proposal for a judge to start a round by hand as an exception path was not carried into the build. If something goes wrong with a round, the recovery is to reset it, rematch or replay it. **[T]** (CS-022) The stakeholder has not yet confirmed that dropping the manual start was intentional: U-38.
- **Early finish of the whole competition** during a round: end the round the same way, then finish. Final results are preserved. **[T]**

### 7.5 Pause and resume

Pause is **global**, not per round. While paused: the timer stops; players cannot edit and get a blocking notification; the big screen shows "Competition Paused"; no round transition, preparation countdown or scoring progresses; the exact state is preserved. **[T]** Resume shows a **3 → 2 → 1 → Start** countdown that does not consume round time. **[T]** Pause and resume belong to the controller. **[P]** (ROL-003)

### 7.6 Disconnection and reconnection

The server keeps the round timer running. A reconnecting player receives the current state and gets the latest saved grid back; for example, disconnecting after 2 minutes of a 10-minute round and returning 2 minutes later leaves 8 minutes. If the round ends during the disconnection, the latest saved state is auto-submitted and scored; the player remains a valid participant. A player who reconnects after the round has ended simply enters the current state (next preparation, current round, or stage results). **[T]** Refreshing the page or accidentally closing it is treated as a reconnect: the latest saved grid returns and the timer has kept running. **[T]** (PL-8, PL-9) Judges see connected/disconnected status for their students (ROL-003), which supersedes the guideline's "no inactive status". **[P]**

### 7.7 Finish, cancel, rematch

- The competition becomes `FINISHED` when the final round of the final stage ends, or when it is finished early. Then it cannot continue; judges lose operational access, the admin/controller keeps access to results and data, and results are read-only except for logged corrections. **[T]** / **[P]** (RES-003)
- **Rematch / reset:** the controller can reset the whole event, one round, one person or one team; a reset that already has scores is a rematch. **[C]** (ROL-005) The old scores are archived, not deleted. **[P]** (ROL-005) A rematch gives the students the full round time again, erases their partial answers for that round and keeps the scores of earlier rounds: **[A]** U-13. A network or server failure is handled by replaying the round; the judge or the controller can trigger it. The stakeholder believes the network is the most likely cause. **[C]** (ROL-005)
- **Cancel:** the guideline's meaning is an invalid competition — it is stopped without the normal auto-submit and scoring, its results are **not released and not preserved (discarded)**, and the admin can create a new competition to replace it. It is exceptional: only when something has gone wrong and the competition was stopped prematurely. **[T]** Whether cancel is still needed now that rematch exists, and what happens to the data: **[O]** U-31.

### 7.8 Flows in the client document

1. **Entry:** open the link in a browser or tablet → pick a role (player, judge, admin) → username and password → the role's home page. **[S]** See U-28.
2. **Player:** log in → list of registered events → choose stage (individual or team) → answer → submit (no more answering afterwards) → wait for the unified start command → see own score and rank once published. **[S]**
3. **Judge:** log in → choose the session → control panel (the rounds are listed and controlled one by one) → start or pause a round → unified command → end the round → confirm and publish results → hand results to arbitration and analysis. **[S]**
4. **Admin:** log in → competition entry → participant management → configuration → analysis. **[S]**
5. **After the competition:** results go to arbitration; this is the reason answers must be kept for appeals. **[S]** (RES-001)
6. **Four data flows:** *configuration* (admin → server → the ends), *control* (judge/admin ↔ server ↔ players and screens: start, pause, end, unified command, screen control), *data* (players and judges → server → admin: answers, scores, times), *projection* (a player's board state → server → big screen). **[S]** The "configuration center" with versioned distribution is rejected.

## 8. Screens and user experience

- **Big screen modes:** live ranking that scrolls; one student's answer close-up, enlarged; for a team, all of the team's tablets side by side. **[S]** The controller picks the target and can switch freely: a category leaderboard, the school ranking, or a close-up of a student or a team, with optional automatic rotation between categories, and the final results at the end. **[C]** (BSC-002) With one screen the stakeholder also offered "controller only in every case": **[O]** U-14.
- **Normal ranking cycle:** a fixed **3-minute** cycle that shows the **full ranking**, paginated when it does not fit; ranking updates do not restart the timer. **[T]** The 3 minutes is a numeric value and so customizable (SCR-005). The screen cycles through the current ranking and, once a stage has finished, its final ranking. **Ranking columns:** individual — rank, player name, score, completion/submission time; team — rank, team name, score, completion time (member names are not shown in the team ranking); the school ranking shows rank, school and total. **[T]** / **[A]**
- **Projection:** projecting a student suspends the normal cycle and shows that student's actual competition screen until projection stops; stopping returns to the ranking using the latest data. **[T]** For a team, the big screen splits into 2–6 sections, one per member. **[T]** The big screen never calculates rankings itself. **[T]**
- **Pause:** the big screen shows "Competition Paused" and players see a blocking notice: "Competition paused. Please wait for the judge to resume." (to be written in both languages, and naming the controller if the controller paused). **[T]**
- **Finished competition:** the big screen becomes read-only and can show the final state and results. **[T]**
- **Qualifiers list** on the big screen: **[O]** U-26 — is there qualification to a next round?
- **Player screen:** states are competition room, preparation room with the round's rules and a countdown, active round, read-only after submitting, waiting. It shows each question's point value. **[T]** / **[S]** Students use **Quark Browser on learning tablets (学练机)**; the exact model and version are not yet known (`../decisions/unmade-decisions.md` U-06). **[C]** (PAR-006)
- **Individual answer screen:** landscape, the puzzle on the left, a number pad on the right, previous/next and question-number buttons, a **delete** button (clears the selected cell) and a **clear-all** button (starts the puzzle over); both ask for confirmation. Two buttons of this kind are assumed to be enough: **[A]** U-20. If the tablet is held upright, a "please rotate your device" screen is shown. **[C]** (UI-001, PAR-006) UI details can be iterated after the first version. **[C]** (UI-002)

## 9. Data and retention

- Answers and results are stored per player and team. **[S]** Submitted answers are **kept** and **exported**. **[P]** (RES-001) / **[C]** (RES-002) They are **permanently deleted, with the scores and the student accounts, 15 days after the competition**; the setup, the questions and the judges are kept. **[P]** (RES-004) Because the client document keeps answers "for appeals" (§7.8), appeals would have to be settled inside those 15 days, or the exported file becomes the only record: **[O]** U-42.
- **Unanswered questions** are stored as wrong answers. If a student answered but the system lost the data, the answers are filled in as wrong and **marked "auto-filled"**; the controller can review and correct them, or order a rematch. **[P]** (RES-001)
- Not kept long term: move-by-move history and whether a submission was manual or automatic. **[T]** Working grids during a round are runtime state.
- "Past comparison" reports across competitions are **not** carried forward, which follows from the 15-day deletion. **[P]** (RES-004)
- **Question file:** the PDF contains the questions with their solutions; points and difficulty per question are handled under SCR-003 and U-03.
- Participant numbers are generated by the system (rules in §7.2). **[P]** (PAR-001)
- After the competition the admin can view the final Individual and Team stage rankings, the final scores and the completion times, and export them. **[T]** / **[C]** (RES-002) On screen the admin does **not** get round-level or stage-level breakdowns, individual grids, per-question answers or detailed statistics; the export adds the answers. **[T]** / **[C]** (OA-23, OA-24, RES-002) The export format and columns: **[O]** U-08.

## 10. Non-functional requirements

- **Low bandwidth:** during a competition only light commands and move coordinates travel; the big screen rebuilds boards locally; **no video** is streamed. **[S]**
- Questions are **preloaded on the player's device** before the match, so only light commands are needed during it. **[S]** When questions are delivered, given the risk of early inspection: `ARCHITECTURE.md` §10 / I-06.
- The **server owns the time**: clients only display countdowns derived from server time; the client never decides whether a round is active, how much time remains, whether a submission is valid, the score or the rank. **[T]**
- **Autosave** must not flood the server: about 2 grid saves per second per player at most. **[T]**
- The client document's original targets — 1000+ devices online, 3000 concurrent users — described the full future platform. The real numbers are in §1 (EVT-001).
- The competition must survive a network problem: a student's saved state is restored on reconnection, and a failed round can be replayed. **[C]** (ROL-005) What happens if the server itself restarts mid-round: **[O]** I-10.
- **Anti-cheating is kept light:** no software measures beyond server-owned time and answers, one active device per account, and the judges' supervision in the room. **[A]** U-37 (see §11 for what is out of scope).

## 11. Later phases and out of scope

- **PK stage [L]** (client document, kept for the future): head-to-head duels matched online. Three modes — *same-question race (同题竞速)* (first correct completion wins; the winner gets full points, the loser is scored by progress), *item battle (道具对战)* (add time, mask, change puzzle; correct answer plus item-strategy bonus), *point arena (积分擂台)* (several rounds, wins and losses accumulate, ranked by total). On the big screen a PK match shows the two boards side by side, and the client design also lists an online matching engine. The client's configuration idea included a competition-type toggle (Individual, Team, PK) and PK online-matching parameters; not an accepted requirement. Questions kept for that phase: is pairing always random; random among whom (all eligible players, a category, a stage); are there eligibility rules; what happens with an odd number of players; can a player appear in several matches; can pairings be regenerated; who or what fixes the final pairing.
- **Configuration center / logic-template upload ("Steam-style") [rejected]**, with its versioned configuration distribution.
- **Independent content per big screen [superseded]:** all screens now show the same content (BSC-001, BSC-002).
- **Warm-up round:** the client's segment library lists a third individual round, *warm-up speed* — low-difficulty Sudoku scored by completion time and accuracy, optionally counted in the total ranking, with wrong-answer hints but no deduction. **[O]** U-29 — the regulation has only two individual rounds.
- **Multi-tenant SaaS and the Super Administrator [L]:** see `../decisions/project-decisions.md` ENV-007, SA-005. Questions kept for that phase: can the admin change the organization's information; can an organization be deactivated and what happens to its data; can an organization have several admins; are organization-level permissions needed. (One admin per organization is the earlier working position OA-002; the MVP assumption that several controllers may exist is U-11.)
- **Super Administrator, working scope for the multi-tenant phase [L]** (deferred with multi-tenancy, SA-005; none of it is MVP scope; register rows SA-006, SA-010…SA-033):
  - **Role:** the owner and operator of the platform, working at platform level above all tenants and belonging to none (SA-001, SA-002). The full list of its responsibilities is not final: everything below is a working scope that may change after discussion with the client. (SA-003) There is exactly one Super Administrator account; delegation among platform administrators is out of scope. (SA-006)
  - **Tenant overview:** view the list of every organization (tenant), with basic information (at least the organization name and basic registration or activity data), see each tenant's representatives (its organization admins) and all admins across tenants, and get a platform-level overview of the organizations using the platform. (SA-010…SA-013; which fields count as "basic": SA-9)
  - **Competition overview:** see how many competitions exist on the platform and how many each organization created, and view the names and some basic details of competitions. (SA-020, SA-021) The role's access to "all information in the app" is meant to include competition data and some analytics; which analytics is not defined and waits for the client. (SA-022; SA-10) Whether the Super Administrator may see participants (current lean: no) or competition results is undecided. (SA-023, SA-024; SA-5, SA-6)
  - **Revocation:** revoke a tenant for any reason; in the first version that means deleting it. What deletion does is not defined: immediate or deferred, what happens to the tenant's competitions and data, whether its users lose access at once, whether it can be reversed. (SA-030, SA-031; SA-7, SA-11)
  - **No manual tenant creation:** organizations register themselves on their own portal; the Super Administrator does not add them. (SA-032)
  - **Deferred beyond that:** billing and payments (there is no payment system); suspending or blocking one organization admin without deleting the tenant; platform-level configuration; an audit log of Super Administrator actions (SA-12); reactivating a deleted tenant. Whether access is read-only apart from revocation is undecided. (SA-8)
  - **Shape:** platform (one Super Administrator) → tenants that register themselves → each tenant's organization admin(s) and competitions, whose names and basic details the Super Administrator sees. The Super Administrator sees organizations and their representatives, competition counts and basic details, and can revoke tenants; it never adds them.
- **Reusable Question Bank [L]** (the client's flow document calls the puzzles "equations" and the bank the "equation bank"): imported question packs saved globally so later competitions can reuse them (or import a new PDF); the system tells the admin when the bank is empty. When configuring a round the admin would select questions from the bank, filtered to those compatible with the round type, and manage the bank independently of any competition (create, edit, delete, archive, version: not yet defined). Questions extracted from an imported PDF are also saved to the bank. The first version uses each competition's own upload. **[T]** (CMP-101)
- **Buzzer mode (抢答夺分) [dropped]:** the whole team sees the same puzzle and races to answer; the first correct answer gets full points; a wrong answer deducts points or passes the right to answer. (TEM-001)
- **Rules in the client document replaced by later answers:** the +10 per minute early bonus for team rounds (SCR-002); wrong-answer deductions and time-and-accuracy weighting in the standard round (SCR-001); the proportional "percentage of correct cells" scoring described in the client's flow document, discarded in favor of all-or-nothing per puzzle (SCR-001); the judge marking answers and controlling rotation and refill, which the system now does automatically (EX-001); "past comparison" reports (RES-004).
- **Remote and unsupervised competition, out of scope:** remote or home competitions, camera-based supervision, environmental monitoring, camera-based identity verification, remote-proctoring mechanisms, and anti-cheating measures for unsupervised environments. They may be considered in a future version. **[S]** (ENV-005)
- **Out of scope in the team's guideline, still out:** microservices; a generic configurable competition engine; admin-defined stages and rounds; configurable ranking rules; PK mode; payment; detailed move analytics; long-term history beyond the 15-day retention; detailed post-competition analytics; a configuration/template marketplace; OCR question extraction. **[T]**
- **Out of scope in the guideline, now changed by the stakeholder:** manual score editing, manual ranking editing, and a score-correction/audit trail (now a logged correction, RES-003); fixed scoring formulas (numbers are customizable, SCR-005); a combined individual and team ranking and an overall champion ranking (now the school total, SCR-004); one competition per category (EVT-002); exactly one judge (ROL-003); immutable results and no answer retention (RES-001, RES-003); the reusable Question Bank in the first version (now later, CMP-101).
- **Guideline item still to be decided:** a player-facing final-results screen — **[O]** U-23.

## 12. Open items

The complete live list is `../decisions/unmade-decisions.md` §16: 58 items, U-01…U-43 (questions for the stakeholder and low-risk assumptions) and I-01…I-15 (internal), plus the older later-phase rows listed in its §16.4. Those that most affect what is built:

- **Competition rules still open:** U-03 (round total), U-21 (齐心协力), U-22 (tie-break), U-23 (players see their score), U-24 (publish step), U-27 (awards), U-31 (cancel), U-33 (submission granularity), U-34 (preparation length), U-35 (next stage start).
- **Setup and data:** U-32 (files per category), U-36 (whole-file re-upload after publish), U-42 (appeals versus the 15-day deletion).
- **Assumptions awaiting confirmation:** U-04, U-11…U-20, U-37…U-41, U-43.
- **Internal, needed before coding:** I-01 (revised domain model and API), I-06 (question delivery timing), I-10 (server restart mid-round), I-11 (late manual submit), I-14 and I-15 (answer check and grid shapes); also I-02 (backend language), I-03, I-04, I-05, I-07, I-08, I-09, I-12, I-13.

## 13. MVP acceptance scenario

The MVP is ready when this scenario works reliably. **[T]** The stakeholder's additions are folded into the extended scenario below.

Admin creates the competition → imports participants → accounts are generated → imports questions → assigns judges → publishes → players log in → the controller starts a stage → preparation countdown → round starts → players solve and the grid autosaves → a player submits or the timer expires → the system evaluates and scores → the ranking updates → the big screen updates → next round → next stage → final ranking → the competition finishes → the admin can view the final results.

**Extended scenario with the stakeholder's additions** **[A]** (to confirm): the controller creates an event with several categories and imports the participants; the credential slips are printed and given out with the tablets; at least 30 judges are created and each is assigned a range of participant numbers; the controller publishes and opens the shared big-screen link on the screens; students log in on the learning tablets in landscape; one command starts all categories together; students solve, autosave and submit; judges see the status of their students and the controller sees all progress; the big screens rotate the rankings and project a student or a team; the controller pauses and resumes, ends a round early, takes over from a disconnected judge, and replays a round after a failure (rematch, old scores archived); the controller corrects a score with a reason and the ranks recalculate with a change log; a student's tablet fails and the student continues on another tablet with the same login; the team stage runs (rotation first) and the school total and school ranking are produced; the controller exports scores, rankings and answers; the competition is copied for a new event; 15 days later the answers, scores and student accounts are purged.

**Failure and edge cases to test before the event** **[T]**: disconnect and reconnect; timer expiration; manual submission; duplicate submission; pause and resume; the controller ending a round early; finishing the competition early; many players at once; team scoring; ranking tie-breaks; big-screen synchronization; an invalid participant file; an invalid question file. To add from the stakeholder's answers: rematch and reset, judge takeover, score corrections, several categories at once, the 15-day purge.
