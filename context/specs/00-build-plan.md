# Build Plan — APPROVED (2026-09-30)

> **Approved build plan.** Approved 2026-09-30 by the team / project owner (checklist item A7, section E of `FILL-BEFORE-CODING.md`), together with the Unit 1 spec. The plan is built from the constraints already in the context files. A unit that depends on an open item is marked and **must not start until that item is answered** (open-item gate).
> Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [O] open. See `../README.md`.
> **Approving the plan does not answer its open items.** Units marked as waiting on an open item remain blocked until that item is answered.

## Decided constraints

- **First slice:** the **Individual stage, end to end**. The team stage and the design come later. Keep the data model ready for team rotation [C] (BLD-009).
- **Workflow:** one branch per unit; a pull request before every merge; lint, type check, tests and build in CI must pass before a merge; the other developer reviews each pull request [C] (BLD-002).
- **A unit** produces one visible, verifiable result, stays within one system boundary, and can be built in one focused session (methodology).
- **Order rules** (methodology): dependencies first; security before functionality; backend before frontend wiring; shells before real data; dependencies installed just in time.
- **Unknowns rule** [T]: an unknown is an implementation detail unless it changes the domain model, the state machine, scoring or ranking, authentication, the question format, or a critical API or WebSocket contract; only those need a decision before coding.
- **Work split** [T] (I-23): ownership by module, one owner per module, roughly 70/30 (Sylvin backend-leaning, Louise frontend-leaning); contract first. The "Builder" column below follows that split and is a guide, not a strict rule.
- **Stack:** Node.js with TypeScript, Express.js [T] (I-02); React with TypeScript [T]; PostgreSQL 16 and Redis 7 (persistence on) [T]; Prisma [T] (I-31); Docker with Docker Compose, a Dockerfile per service [T] (I-24); Jest via ts-jest [T] (I-32); WebSocket (Socket.io the tool the team knows best) [T].
- **Reference only, out of date:** the earlier 15-day plan is in `progress-tracker.md`. It is not a plan to follow.

## Units

| # | Unit name | What it builds (one visible result) | Depends on | Done when (acceptance criteria) | Builder |
|---|---|---|---|---|---|
| 01 | Foundation | Repository, Docker/Compose environment, CI (lint, type check, test, build), backend and frontend skeletons, Prisma schema initialized with its first migration, a health check, a first passing Jest test, and the English/Chinese i18n scaffold. No feature. | none | CI is green on a fresh clone; both services run under Docker Compose; the health check responds; the first migration applies; a Jest test passes. Spec: `01-foundation.md`. | Both (shared) |
| 02 | Authentication and accounts | Role-separated login (controller, judge, player) [T]; sessions; **one active device per account**, newest login takes over [P] (PAR-005). | 01 | A user of each role logs in and out; a second login on another device takes over; the saved answers and remaining time survive the switch. **Waits:** credential format (I-30), session length and idle behaviour (I-16). | Sylvin |
| 03 | Competition setup and lifecycle | Create a competition with several categories; the fixed stage/round structure; the status machine `CREATED → PUBLISHED/WAITING`; publish readiness checks; the entry link/QR and the big-screen link; structure lock; copy [C] (CMP-100). | 02 | A controller creates and publishes a competition; publishing is refused when a readiness condition fails; the entry and big-screen links are generated; the structure is locked after publish. | Sylvin |
| 04 | Participant import, teams and credentials | Participant Excel import with **atomic whole-file validation**; generated participant numbers [P] (PAR-001); derived teams; player accounts; credential-slip export. | 03 | A valid file creates participants, teams and accounts; an invalid file commits nothing and names the row; credential slips export. **Waits:** sample Excel (U-01), extra columns (U-40). | Louise |
| 05 | Question import and question sets | Question Excel import (`.xlsx`, not PDF [C] BLD-024) in a strict format, **no OCR**, whole-import rejection on any failure; **one file per category, not shared** [C] (BLD-028); generic grid [C] (BLD-011); the stored solution [C] (BLD-010) — **currently incomplete in the real sample files**, see the note below; per-question points [C] (SCR-003), fully customizable regardless of the file [C] (BLD-025); assignment to the predefined rounds. | 03 | A valid file imports its questions into the right rounds; any failure rejects the whole import with an explanation; questions show a generic grid and a stored solution. **Waits:** sample participant Excel and a past results sheet (U-01), the missing complete-solution column (U-94, re-asking). | Louise |
| 06 | Judges and ranges | Judge list (create by name, credentials shown) [T]; **range assignment by the controller, changeable during the event** [C] (BLD-008); authority limited to the assigned competition. | 02, 03 | A controller creates judges and assigns ranges; a judge enters only the assigned competition. **Waits:** judge credential format (I-30), removing a judge on an unfinished competition (I-12). | Sylvin |
| 07 | Round runtime and autosave | Competition room; preparation screen with rules and countdown [C] (RND-001); the server-owned round timer; autosave (~2/s per player) [T]; reconnection restores the saved grid with the timer still running [T]; questions fetched at the round start [C] (BLD-006). | 03 | A player enters a round, solves, disconnects and reconnects, and gets the saved grid back with the correct remaining time; the server owns the clock. | Sylvin |
| 08 | Submission, answer check and scoring | Single final submit per round with confirmation [C] (SUB-001/002); automatic submission at time expiry and the late-submit rule [C] (SUB-003); **answer check against the stored solution** [C] (BLD-010); all-or-nothing scoring [C] (SCR-001); the early-finish bonus [C] (SCR-008–011). | 05, 07 | A submit is evaluated against the stored solution; a blank or wrong puzzle scores 0; an early all-correct submit earns the bonus; the late-submit rule applies. **Waits:** unique solutions (U-90). | Sylvin |
| 09 | Individual ranking and big-screen ranking | Provisional ranking after each finalized round, cumulative [T]; the final ranking of a stage; the big-screen ranking cycle (3 minutes, customizable) [T]/[C] (BSC-002); no ranking computed on the big screen [T]. | 08 | The ranking updates as rounds finalize; the big screen shows the ranking cycle and never calculates it. **Waits:** tie-break (U-22), when students see their score (U-24, U-88). | Louise |
| 10 | Judge supervision and single-student restart | Judge view of their students' status (connected, submitted); **restart one student's round** with the attempt archived [C]/[P] (SUB-005/008, ROL-005). | 06, 07, 08 | A judge restarts one student while the round runs; the earlier attempt is archived, not deleted; the student restarts blank on the remaining round time. | Sylvin |
| 11 | Controller live commands | Start a stage (all categories together) [T]; global pause and resume [C]; end a round early [T]; finish the competition early [C] (RND-007); reset or rematch, archiving old scores [C]/[P] (ROL-005); take over from a disconnected judge. | 07, 08 | Each command changes state as decided; an early finish marks the results "finished early"; a rematch archives the old scores. **Waits:** cancel (U-31), awards/reset after an early finish (U-27, U-89). | Sylvin |
| 12 | Results, corrections, export and purge | Results view for the controller [T]/[C]; **score correction with a mandatory reason and a change log** [P] (RES-003); export of scores, rankings and answers [C] (RES-002); the **15-day purge schedule** [P] (RES-004). | 09 | A correction recalculates the ranks and is logged; the export contains the decided columns; the purge deletes answers, scores and student accounts after 15 days and keeps setup, questions and judges. **Waits:** export format (U-08), purge scope (U-59, U-62). | Louise |
| 13 | Team stage: rotation relay | The rotation-relay round [C] (TEM-004): initial deal, timed rotation, answer-and-refill, "not enough questions", finish; team scoring = correct answers × points per question [C] (SCR-015); questions rotate, not seats. | 08 | A team of 4 runs a rotation round end to end with the defaults (10 questions, 60 s rotation); the team score is settled at the end condition. | Sylvin + Louise |
| 14 | Team stage: partition collaboration (second round) | The partition-collaboration round ("齐心协力") [C] (TEM-005): a puzzle split into contiguous row-band blocks, one band per active team member (2 to 6, as equal as possible, extra rows to the first bands); each member edits only their own band; the puzzle is scored all-or-nothing once the bands are combined, no early bonus [C] (SCR-001, SCR-002). Puzzle count (default 3), total round time (default 30 min) and points per puzzle (default 20) are **working positions** [T] (TEM-006 to TEM-008), not sourced from the regulation. **Scheduled right after Unit 13**, since the school total needs both team rounds. | 13 | A team of 2 to 6 runs a partition round end to end with the defaults (3 puzzles, 30 min, 20 pts/puzzle); the grid is split into row-bands per member, each member can edit only their own band; the team scores only when a puzzle's combined bands are fully correct. **Waits:** nothing blocking — the real regulation numbers for TEM-006 to TEM-008 can replace the working positions later without a rebuild. | Sylvin + Louise |
| 15 | School ranking and competition copy | The **school total** = individual sum × coefficient (default 0.6, exact decimal, not rounded) + the team stage's **two-round sum** [C] (SCR-004/013, confirmed formula "individual two-round sum × 0.6 + team two-round sum"); the school ranking; competition copy [C] (CMP-100). | 09, 13, 14 | The school total is computed as an exact decimal and schools are ranked on it, using **both** team rounds (rotation, Unit 13, and partition collaboration, Unit 14); a copied competition keeps settings, questions and judges, not results. | Louise |

**Later slice (not in the first slice):** the reusable Question Bank [L] (CMP-101); the visual design (comes after the first slice, BLD-009).

(Add or split rows as the team sees fit. **Each unit needs its own spec** in `specs/NN-unit-name.md`, written with: goal, context, implementation details, acceptance criteria, out of scope. Present the build plan and each spec for review before starting that unit.)

## Definition of done (project-wide)

- **Acceptance scenario:** the MVP acceptance scenario and the failure and edge-case test list [T], plus the extended scenario with the stakeholder's additions [A], are in `context-feeders/requirements/REQUIREMENTS.md` §13. They are the project-level definition of done; each unit's own acceptance criteria are in its spec. (Their content is not duplicated into `context/`; the requirement document is the reference. Copy the test list into the first unit spec that needs it.)
- **Per-unit rule (I-22):** a unit is done when (1) its acceptance criteria pass, (2) the project-wide failure and edge-case list relevant to it passes, (3) lint, type check, tests and build pass in CI (BLD-002), (4) the other developer has reviewed the pull request, (5) no invariant in `architecture.md` is violated, and (6) `progress-tracker.md` reflects the work.

## Units that cannot be specified until an open item is answered

A unit in this list must not start until its item is answered (open-item gate).

| Unit area | Waits for |
|---|---|
| Import (participant Excel, question Excel) | Sample participant Excel and a past results sheet (U-01), extra Excel columns (U-40), the missing complete-solution column (U-94) |
| Authentication | Judge and controller credential format (I-30), session length and idle behaviour (I-16) |
| Answer check and scoring | Unique solutions (U-90) |
| Ranking | Tie-break (U-22) |
| Results and finishing | When students see scores (U-24, U-88), export format (U-08), awards and reset after an early finish (U-27, U-89), purge scope (U-59, U-62) |
| Controller commands | Cancel (U-31) |
| Judges | Removing a judge on an unfinished competition (I-12) |

## Open technical decisions that affect the plan

- **Backend folder structure:** **decided 2026-09-30 — module-first** (I-02, BLD-020; see `../architecture.md`, "Backend folder structure"). Unit 01 uses it.
- **Modules: events vs direct calls** (I-08). Affects the API/WebSocket contracts the units agree on.
- **Final module list and API** (I-01, module-list part): revised with this plan; the contracts are agreed per unit ("contract first").
