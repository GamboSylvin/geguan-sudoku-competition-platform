# Architecture Context (DRAFT v1, 2026-09-26)

> Status tags: [C] confirmed by the client's stakeholder · [P] approved in the blanket answer · [S] stated in the client's document · [T] team decision, not client-confirmed · [A] assumed · [O] open · [L] later. See `README.md`.
> **Status note.** The build and engineering decisions of 2026-09-26 (BLD-001 to BLD-011) are tagged [C]: confirmed on that date (confirmed again by the project owner). If a confirmed decision changes later, update this file and add a line to `progress-tracker.md`, "Context change log".
> **Left blank on purpose:** anything marked **TBD — to be decided by the project owner** (backend language and framework, developers' skills, names and roles, who builds what, where the server runs on the event day). Do not choose a value.
> Anything tagged [O] or OPEN is not decided. Do not implement it. The schema must be approved before any feature is built on it.
> **Blanks to fill:** search this folder for `FILL-BEFORE-CODING`; the full checklist is `FILL-BEFORE-CODING.md`.

## Stack

| Layer | Technology | Role | Status |
|---|---|---|---|
| Frontend | React with TypeScript, one application with role-based areas (ARCH-020) | All four ends: player, judge, controller/admin, big screen | [T] register status "Confirmed 2026-09-23"; not stakeholder-decided |
| Backend | **TBD — to be decided by the project owner** [[FILL-BEFORE-CODING: backend language and framework = ________ ; owner: project owner]] (I-02, ARCH-024) | Server-owned state, timer, scoring, ranking | Blank on purpose. The register says only that React/TypeScript suggests Node.js; that is not a decision |
| Durable data | PostgreSQL (ARCH-021) | Durable results, setup, accounts, round state changes | [T] |
| Runtime state | Redis **with persistence turned on** (ARCH-021, BLD-007) | Working grids | [T]/[C] |
| Real-time | WebSocket (ARCH-022) | Commands and state to tablets, judges, controller, big screens | [T] |
| Architectural style | Modular monolith, one deployable system (ARC-001, ARC-002) | Single backend | "Working Position" [T]; both developers still to record acceptance (I-08) |
| API contract and data model | (ARCH-023) | Starting point | "Working Position", not final [T] |
| File storage | **The server's disk, in a mounted folder**, not object storage [C] (BLD-001) | Participant Excel, question PDF, credential slips, exports | Decided |
| Hosting | **TBD — to be decided by the project owner** [[FILL-BEFORE-DEPLOYMENT: where the server runs on the event day = ________ ; owner: project owner]] (I-03, U-46) | Where the server runs on the event day | Blank on purpose |

## System boundaries

One deployable backend organized as a modular monolith [T] (ARCHITECTURE §3 of the source documents). Each module owns its state; no other module modifies it.

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

- The client's "control hub" takes commands from judges and the controller, applies the arbitration rule and broadcasts state. It lives inside the Orchestrator and Big Screen modules [S].
- Frontend folders, by feature [T]: `auth`, `competition`, `player`, `judge`, `admin`, `big-screen`, `ranking`, `gameplay`.

**OPEN (I-01): the module list is not final.** It was written for one judge and one category. It has **no module** for team rotation, score corrections, the 15-day purge, import and export, competition copy, participant numbering, judge ranges and takeover, or several synchronized big screens. **Keep the data model ready for team rotation** even though the Individual stage is built first [C] (BLD-009).
**OPEN (I-08):** whether modules talk through events or direct calls. **TBD — to be decided by the project owner:** the backend folder structure (depends on the language).

## First slice

The first slice of the build is the **Individual stage, end to end**. The team stage and the design come later [C] (BLD-009).

## Data flow

- The **server** decides time, competition, stage and round state, pause and resume, submission validity, scoring, ranking and eligibility. The client's countdown is display only [T].
- A human acts only to start a stage, pause, resume, end a round early, or reset; everything else follows automatically [T] (REQUIREMENTS §7).
- **Question delivery** [C] (BLD-006): questions are fetched **at the start of the round**, with **no preloading**. Preloading them encrypted, with the key released at the start, is only a fallback if the load test of about 800 clients shows a problem. This differs from the client's original document, which preloads questions on the tablets to keep traffic light [S]. **Load-test this early** (up to about 300 tablets in one room).
- **Autosave** saves the grid (about 2 saves per second per player [T]) and never triggers scoring. Scoring reacts to a **submission**, not to a move [T].
- **Answer check** [C] (BLD-010): compare the submitted grid with the **solution stored with the question**; no rule checker per variant. This relies on every puzzle having a unique solution: **OPEN (U-90).**
- A round transition happens only after its scoring is final [T]. A provisional ranking updates immediately when a round result is finalized, without waiting for every participant [T].
- Big screens show ranking cycles every 3 minutes [T]; they never calculate rankings [T].
- **Server restart mid-round** [C] (BLD-007): a **replay is acceptable**. Round state changes are kept in PostgreSQL and the working grids in Redis with persistence on. After a restart the competition comes back **paused**, so the controller chooses to resume or replay. **OPEN (U-49):** how long an interruption is acceptable.
- Recovery after a network or server failure: the round is replayed, triggered by a judge or the controller [C] (ROL-005).

## Storage model

- **PostgreSQL:** durable data and round state changes. Durable results live in PostgreSQL, **never only in Redis** [T].
- **Redis (persistence on):** the working grids [C] (BLD-007).
- **Files:** the server's disk, in a mounted folder [C] (BLD-001). Path and reference conventions (a path template and a reference column on the parent record): **still to be written** with the data model. The original question PDF is kept with the competition [A].
- **Purge:** 15 days after the competition, answers, scores and student accounts are permanently deleted; setup, questions and judges are kept [P]. **OPEN (U-62, U-59):** archived scores, the correction log and the uploaded participant Excel.

## Data model — NOT DESIGNED (OPEN, I-01)

[[FILL-BEFORE-CODING: approved data model and schema, in `data-model.md` = ________ ; owner: team]]

There is no approved data model. The list below is only what the decided rules **imply**, to help draft the schema for approval. It is **not** a schema.

- Competition (event), Category, Stage, Round (with numeric round settings, set once per round for the whole event)
- **Question set per category** (a category may point to a shared set); whether each category has its own question file is OPEN (U-32) [C] (BLD-005)
- Question/puzzle: **generic grid** (rows, columns and regions; never assume 9x9), points, the **stored solution**; the shapes supported first are those in the sample question PDF, still to be sent (U-01) [C] (BLD-011)
- School, Team (one per school per category), Participant (name, school, category, team; a generated number)
- **Account with exactly one role** (player, judge, controller, big screen); several controller accounts are allowed; one person with several roles is handled as two accounts [C] (BLD-004)
- Judge assignment (a range of participant numbers), **assigned by the controller during setup and changeable during the event** [C] (BLD-008)
- Attempt/submission (archived on a judge restart or rematch; the count stays visible), Score (integers; the round score includes the bonus), Score correction log (mandatory reason)
- Ranking (individual, team, school; the school total is an exact decimal)
- Big-screen display state; purge schedule

Data rules already decided: question and round scores are whole numbers; the school total is an exact decimal, neither rounded nor truncated [C].

## Import formats and credentials

- **Participant Excel columns** [C]: Name, School, Category, Team. The participant number is generated: schools in Excel order, then students in row order, **unique across the event**, and a team's numbers consecutive. Extra columns: **OPEN (U-40).** The sample files are **still to be sent (U-01).** The whole file is validated; an invalid file commits nothing [T].
- **Question PDF:** strict predefined format, no OCR; any failure rejects the whole import [T]. Whether it also carries the points: **OPEN (U-03)**; the sample PDF is still to be sent (U-01).
- [[FILL-BEFORE-UNIT: import units — place the sample participant Excel at `context/samples/participants-sample.xlsx` and the sample question PDF at `context/samples/question-sample.pdf` ; then fill: extra Excel columns = ________ (U-40) ; does the question PDF carry the points = ________ (U-03) ; grid shapes in the PDF = ________ (U-01) ; is a unique solution guaranteed for every puzzle = ________ (U-90) ; owner: the person completing the context]]
- **Participant credentials** [C] (BLD-003): the **username is the participant number**; the **password is a short random code** generated by the system. Credential slips are exported and printed [C]. **OPEN (I-30):** the format of judge and controller credentials.

## Auth and access model

- Username and password for player, judge and controller [C] (PAR-002). No OTP. Separate login endpoints per role [T].
- **One active device per account; the newest login takes over** [P] (PAR-005). Session length: **OPEN (I-16).** [[FILL-BEFORE-UNIT: authentication unit — session length = ________ ; judge and controller credential format = ________ (I-30) ; owner: the person completing the context]]
- Big screens: one shared link, no login [C] (BSC-001). After the competition a big screen becomes read-only [T].
- Only members of the competition's participant dataset can take part [T]. A judge can enter only the competition they are assigned to [T].
- **Roles** [C] (BLD-004): one role per account; several controller accounts are allowed; one person with several roles is two accounts. The Super Administrator is deferred [L] (SA-005). This settles the earlier open point about more than one controller.
- Documented permissions:
  - **Player:** cannot start or control anything, calculate rankings, control the display, or create or configure competitions [C] (PL-001).
  - **Judge:** sees the status of their assigned students and can restart one student's round [P] (ROL-003).
  - **Controller:** can do everything a judge can, plus event setup, rules and customization [C] (ROL-002); sees all progress in real time and can take over from a disconnected judge [C] (ROL-004). Commands: start a stage, pause, resume, end a round early, finish (early), reset or rematch, correct scores, control the big screens.
- **OPEN:** who can read and who can change what is not written as a rule (U-63, U-55): whether a player can read only their own answers, whether a judge can read students outside their range, who may edit participants during the event, whether a judge can change a score.

## External services

None described in the documents (no SMS, email or student-ID system mentioned). **OPEN (U-57):** whether any is needed.

## Development environment and workflow

- **Workflow** [C] (BLD-002): one branch per unit; a **pull request before every merge**; **lint, type check, tests and build in CI**, which must pass before a merge; the **other developer reviews each pull request**.
- **Environment:** **OPEN (I-24).** [[FILL-BEFORE-CODING: development environment (setup, lock files, `.env.example`, containers) = ________ ; owner: team]] Methodology target: reproducible environments (lock files committed, `.env.example`, containers if the stack needs them).

## Devices and network (constraints)

- Students use Quark Browser on learning tablets (学练机), landscape, with a "please rotate your device" screen [C]. Model and Quark version unknown (U-06); the assumption of a modern Chromium-based Android browser is **not** confirmed.
- Venue internet and Wi-Fi strength unknown; about 300 tablets in one room is the biggest real-world risk [A] (U-06, U-46).

## Non-functional requirements

**Performance**
- Autosave about 2 grid saves per second per player [T]. Big-screen ranking cycle every 3 minutes [T]. A provisional ranking updates immediately when a round result is finalized [T].
- **OPEN (U-58):** how quickly the ranking must update after a submit, how quickly all tablets must start together (relevant now that questions are fetched at the round start), and any other response time.

**Security and student data**
- The server decides time, submission validity, score and rank; the client is never trusted [T]. One active device per account [P].
- The judge sees how many times a student left the answer page, as information only, with no penalty [P]. Remote-competition security and proctoring are out of scope [S] (ENV-005).
- **OPEN (U-37):** anti-cheating beyond the above. **OPEN (U-59):** what must be protected, and any legal or school rules for student data (related: the 15-day deletion [P], and where the data must live).

**Scalability**
- About 600–720 students, 11 rooms, at least 30 judges, 10 big screens [C]. A design and test target of about 800 clients is listed [C] (EVT-001) but the load target (about 800 clients, about 2 saves per second) is also listed as an open point (I-05); **not reconciled.**
- The client's original document aimed at 1000+ devices and 3000 concurrent users for the full platform [S]. **OPEN (U-60):** whether about 800 concurrent clients is the ceiling for this version.

**Reliability**
- A failed round is replayed [C] (ROL-005); after a restart the competition comes back paused [C] (BLD-007); a student's saved grid is restored on reconnection [T].
- **OPEN (U-61, U-49):** how much failure the event can tolerate, and whether there is a backup plan (an on-site server is kept as an option, I-03; paper is not mentioned anywhere).

**Risks**
- No risk assessment exists in the documents. Which parts the stakeholder considers most risky: **OPEN (U-56).**
- Documented technical points, unranked: venue Wi-Fi and the tablet model and Quark version (U-06); the load target (I-05); the request burst at round start, now that questions are fetched then (BLD-006); a server restart mid-round (handled by replay, U-49 open).
- The stakeholder believes the network is the most likely cause of a failed round [C] (ROL-005).
- Failure cases the team plans to test [T]: see `code-standards.md`, Testing.

## Invariants

1. A repeated submission never changes the result [C] (PL-009).
2. Validation, scoring, results and ranking are automatic [C] (EX-001 to EX-004). The judge does not determine or calculate rankings [C] (EX-005).
3. The server owns competition, stage and round state, the timer, pause and resume, submission validity, scoring, ranking and participant eligibility; the client is never trusted for any of them [T] (ENV-006 is a "Working Position").
4. Each piece of state has one owner; no other module modifies it [T]. A module's internals are reachable only through its public interface [T].
5. Durable results live in PostgreSQL, never only in Redis [T].
6. Autosave saves the grid and never triggers scoring; scoring reacts to a submission [T].
7. A round transition happens only after its scoring is final [T].
8. The big screen never calculates rankings [T].
9. An early round end cannot be undone [T].
10. The client is never a source of authority. Events, if used, state facts and not commands [T].
11. Scores change only through a controller correction with a mandatory reason and a change log [P] (RES-003).
12. A rematch (including a judge's single-student restart) archives the old attempt and score; it never deletes them [P] (ROL-005).
13. Numeric values are customizable by the controller only, and only before that round's preparation begins; structure and rules stay fixed [P]/[C] (SCR-005, RND-002).
14. The grid model is generic (rows, columns, regions); never assume 9x9 [C] (BLD-011).

## Technical decision records

- **Modular monolith, not microservices:** two junior developers, about 15 days; the design must stay easy to understand [T].
- **PostgreSQL + Redis (persistence on) + WebSocket:** register status "Confirmed 2026-09-23" as team decisions; alternatives considered are not recorded.
- **Server authority:** the client is never trusted; the server clock decides every timing question [T].
- **Files on the server's disk, not object storage** [C] (BLD-001). Reason not recorded.
- **Questions fetched at round start, no preloading** [C] (BLD-006): avoids early inspection and keeps the client simple; the cost is a request burst at the round start, to be load-tested, with encrypted preload as the fallback.
- **Answer check against the stored solution** [C] (BLD-010): simple and works for every variant, but relies on unique solutions (U-90).
- **One role per account** [C] (BLD-004): keeps access rules simple; a person with two roles gets two accounts.

## Open technical decisions (do not implement until decided)

| Item | Open point |
|---|---|
| I-02 | Backend language and framework, and folder structure: **TBD — to be decided by the project owner** |
| I-03, U-46 | Where the server runs on the event day: **TBD — to be decided by the project owner** |
| I-01 | Final module list and the data model (skeleton checkpoint) |
| I-08 | Events vs direct calls between modules |
| I-16 | Session length |
| I-20 | UI component library, icons, fonts |
| I-24 | Development environment (workflow and CI are decided) |
| I-30 | Format of judge and controller credentials |
| U-01, U-03, U-40 | Sample PDF and Excel not yet sent; whether the PDF carries points; extra Excel columns |
| U-90 | Whether every puzzle has a unique solution |
| U-49 | How long an interruption during a round is acceptable |
| I-05, U-60 | Load target and ceiling; listed both as [C] and as open |
| U-06 | Tablet model and Quark version |
| I-14, I-15 | [[FILL-BEFORE-CODING: what I-14 and I-15 are and how they are resolved = ________ ; owner: project owner]] The requirements list them as needed before coding; no context file describes them. **Where to look:** `requirements/REQUIREMENTS.md` §12 and `decisions/unmade-decisions.md` (search for I-14 and I-15) |
