# Architecture Context (DRAFT v1, 2026-09-26)

> Status tags: [C] confirmed by the client's stakeholder · [P] approved in the blanket answer · [S] stated in the client's document · [T] team decision, not client-confirmed · [A] assumed · [O] open · [L] later. See `README.md`.
> **Status note.** The build and engineering decisions of 2026-09-26 (BLD-001 to BLD-011) are tagged [C]: confirmed on that date (confirmed again by the project owner). If a confirmed decision changes later, update this file and add a line to `progress-tracker.md`, "Context change log".
> **Left blank on purpose:** anything marked **TBD — to be decided by the project owner** (where the server runs on the event day). Do not choose a value.
> Anything tagged [O] or OPEN is not decided. Do not implement it. The schema must be approved before any feature is built on it.
> **Blanks to fill:** search this folder for `FILL-BEFORE-CODING`; the full checklist is `FILL-BEFORE-CODING.md`.

## Stack

| Layer | Technology | Role | Status |
|---|---|---|---|
| Frontend | React with TypeScript, one application with role-based areas (ARCH-020) | All four ends: player, judge, controller/admin, big screen | [T] register status "Confirmed 2026-09-23"; not stakeholder-decided |
| Backend | **Node.js with TypeScript, using Express.js as the framework** [T] (I-02, ARCH-024) | Server-owned state, timer, scoring, ranking | Decided 2026-09-27 by the project owner. Same language as the frontend; Express.js is the framework |
| Durable data | PostgreSQL (ARCH-021) | Durable results, setup, accounts, round state changes | [T] |
| ORM and migrations | **Prisma** [T] (I-31) | The PostgreSQL schema (the single source of truth for the database) and the versioned migrations; used by the backend | Decided 2026-09-29 by the team |
| Runtime state | Redis **with persistence turned on** (ARCH-021, BLD-007) | Working grids | [T]/[C] |
| Real-time | WebSocket (ARCH-022) | Commands and state to tablets, judges, controller, big screens | [T] |
| Architectural style | Modular monolith, one deployable system (ARC-001, ARC-002) | Single backend | "Working Position" [T]; both developers still to record acceptance (I-08) |
| API contract and data model | (ARCH-023) | Starting point | "Working Position", not final [T] |
| File storage | **The server's disk, in a mounted folder**, not object storage [C] (BLD-001) | Participant Excel, question PDF, credential slips, exports | Decided |
| Containers | **Docker with Docker Compose** [T] (I-24), with a **Dockerfile per service** (backend, frontend) | The whole codebase: backend, frontend, PostgreSQL, Redis — the same environment in development and deployment | Decided 2026-09-29 by the team |
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

**OPEN (I-01, module list): the module list is not final.** It was written for one judge and one category. It has **no module** for team rotation, score corrections, the 15-day purge, import and export, competition copy, participant numbering, judge ranges and takeover, or several synchronized big screens. **Keep the data model ready for team rotation** even though the Individual stage is built first [C] (BLD-009). The **data model part of I-01 is decided** (2026-09-30, `data-model.md`); the module list is revised with the build plan (A7).
**OPEN (I-08):** whether modules talk through events or direct calls.

## Backend folder structure (decided 2026-09-30)

**Module-first** [T] (I-02, decided 2026-09-30 by the project owner). The structure follows the module boundaries above, so that one module folder is the one owner of its state (invariant 4) and a module's internals stay reachable only through its public interface. It respects the decided constraints: Node.js with TypeScript and Express.js [T] (I-02), Prisma as the ORM and migration system [T] (I-31), Docker with a Dockerfile per service [T] (I-24), WebSocket real-time [T], files on the server's disk [C] (BLD-001), the single server clock, and the English/Chinese message catalogues [C] (ARCH-026). It is the base adopted for the build; it may be refined as the module list is revised (I-01).

```text
backend/
├── prisma/
│   ├── schema.prisma          # single source of truth for the database (I-31)
│   └── migrations/
├── src/
│   ├── index.ts               # entry: load config, connect infra, start HTTP + WS
│   ├── app.ts                 # Express app: middleware + route mounting
│   ├── config/
│   │   └── env.ts             # read and validate env; fail fast on a missing variable
│   ├── modules/               # one folder per module = one owner of state
│   │   ├── competition/
│   │   ├── identity/          # Participant / Identity
│   │   ├── question/
│   │   ├── round/             # Stage / Round
│   │   ├── gameplay/          # current grid, autosave, submission state
│   │   ├── orchestrator/      # the sequence: start stage, preparation, start/end round, finish
│   │   ├── scoring/
│   │   ├── ranking/
│   │   └── big-screen/
│   ├── realtime/              # WebSocket gateway (Socket.io)
│   │   ├── gateway.ts
│   │   ├── events.ts          # event-name constants and payload types
│   │   └── handlers/          # one handler per module; calls the module's service
│   ├── infra/                 # adapters to external systems, no domain rules
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── file-store.ts      # the disk file store (BLD-001)
│   │   └── logger.ts
│   ├── shared/                # cross-cutting, no domain state
│   │   ├── errors/
│   │   ├── middleware/
│   │   ├── validation/
│   │   ├── i18n/              # English / Chinese message catalogues (ARCH-026)
│   │   └── clock/             # the single server clock (the server owns time)
│   └── routes.ts              # mounts each module's routes
├── tests/
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
└── jest.config.ts
```

Each module folder holds: `<name>.controller.ts` (HTTP), `<name>.service.ts` (the domain rules; the public interface other modules may call), `<name>.repository.ts` (Prisma access), `<name>.types.ts` and `index.ts` (the barrel that exposes only the public interface). The repository root stays `backend/`, `frontend/`, `docker-compose.yml`. Where a module must publish an event, it does so from its service; the `realtime/` handlers translate between client messages and module services and hold no domain rule.

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

## API boundaries

Documented:
- All client requests go through the one backend; the client is never an authority [T]. The server owns state.
- Real-time commands and state travel over WebSocket [T] (ARCH-022). The API contract is a "Working Position", a starting point and not final [T] (ARCH-023).
- Separate login endpoints per role [T].
- The big screen uses one shared link with no login and is a passive display: it receives state and shows it [C]/[S].
- Inside the backend, a module's internals are reachable only through its public interface [T].

**OPEN (do not invent):** the API style and endpoint conventions, versioning, the error shape, and the WebSocket message contract. They are written on top of the decided stack (Node.js with TypeScript, Express.js — I-02) with `code-standards.md` and the first unit specs.

## Storage model

- **PostgreSQL:** durable data and round state changes. Durable results live in PostgreSQL, **never only in Redis** [T].
- **Redis (persistence on):** the working grids [C] (BLD-007).
- **Files:** the server's disk, in a mounted folder [C] (BLD-001). Path and reference conventions are decided in `data-model.md`: the path template `{STORAGE_ROOT}/competitions/{competitionId}/{kind}/{fileId}-{originalName}` and the reference column `StoredFile.path`. The original question PDF is kept with the competition [A].
- **Purge:** 15 days after the competition, answers, scores and student accounts are permanently deleted; setup, questions and judges are kept [P]. **OPEN (U-62, U-59):** archived scores, the correction log and the uploaded participant Excel.

## Data model — DESIGNED and approved (2026-09-30)

The approved data model and schema is `data-model.md` (approved 2026-09-30, checklist item A6). The schema is expressed in **Prisma** [T] (I-31): the Prisma schema is the single source of truth for the PostgreSQL schema and the migrations are versioned in the repository.

The entities below are the decided model; the full fields and constraints are in `data-model.md`. Open fields inside an entity are marked there and must not be implemented.

- Competition (event), Category, Stage, Round (with numeric round settings, set once per round for the whole event)
- **Question set per category** (a category may point to a shared set); whether each category has its own question file is OPEN (U-32) [C] (BLD-005)
- Question/puzzle: **generic grid** (rows, columns and regions; never assume 9x9), points, the **stored solution**; the shapes supported first are those in the sample question PDF, still to be sent (U-01) [C] (BLD-011)
- School, Team (one per school per category), Participant (name, school, category, team; a generated number)
- **Account with exactly one role** (player, judge, controller); several controller accounts are allowed; one person with several roles is handled as two accounts [C] (BLD-004)
- Judge assignment (a range of participant numbers), **assigned by the controller during setup and changeable during the event** [C] (BLD-008)
- Attempt/submission (archived on a judge restart or rematch; the count stays visible), finalized round result, Score (integers; the round score includes the bonus), Score correction log (mandatory reason)
- Ranking (individual, team, school; the school total is an exact decimal)
- Big-screen display state; purge schedule; import batch; audit log

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

## Cross-tool integration rules

Documented:
- Round state changes are kept in PostgreSQL and the working grids in Redis with persistence turned on [C] (BLD-007). Durable results are never only in Redis [T].
- Only members of the competition's participant dataset can take part, and a judge can enter only the competition they are assigned to [T]. These are access rules; how they are enforced across the API, the WebSocket layer and storage is OPEN.
- Files live on the server's disk in a mounted folder [C] (BLD-001). How the database refers to them is still to be written with the data model.

**OPEN (do not invent):** the rules for how WebSocket, PostgreSQL, Redis and the file store must work together, for example what must be verified before a real-time session or a command is accepted. They are written with the data model and the first unit specs.

## External services

None described in the documents (no SMS, email or student-ID system mentioned). **OPEN (U-57):** whether any is needed.

## Development environment and workflow

- **Workflow** [C] (BLD-002): one branch per unit; a **pull request before every merge**; **lint, type check, tests and build in CI**, which must pass before a merge; the **other developer reviews each pull request**.
- **Environment** [T] (I-24, decided 2026-09-29): **reproducible and containerized** — the whole codebase runs in containers, so development and deployment use the same environment and the two developers cannot drift apart. Decided by the team.
  - **Containers:** **Docker with Docker Compose**, with a **Dockerfile per service** (backend, frontend). PostgreSQL and Redis run as Compose services in development, and the application (backend and frontend) is containerized too; the **same containers are the deployment target**, not just local development. Where the containers run on the event day is still open (I-03, U-46).
  - **Package manager and lock file:** **npm**, with **`package-lock.json` committed**.
  - **ORM and migrations:** **Prisma** (I-31); the Prisma schema is the single source of truth for the PostgreSQL database and the migrations are versioned in the repository, applied in CI and on deployment.
  - **Versions pinned:** **Node.js LTS, PostgreSQL 16, Redis 7**, recorded in `docker-compose.yml` and `.env.example`; the exact patch numbers are fixed at setup.
  - **`.env.example`** is committed and lists every required variable with placeholder values; the real `.env` is git-ignored and never committed.
  - **Created in Unit 1**, the foundation (repository, environment, CI, skeleton); see `specs/01-foundation.md`.
- **Testing scope and tool** [T] (2026-09-29): the framework is **Jest** (I-32), one runner for the frontend and the backend, wired into the CI pipeline. Keep the tests to the necessary minimum for the MVP — cover what the event depends on, do not go deep. Recorded in `code-standards.md`, Testing.
- **Later phase (not in the MVP)** [L]: an AI code review (for example CodeRabbit) and possibly GitHub Actions are planned for later, when the project is pushed; the exact tools depend on the time left. Today CI runs lint, type check, tests and build [C] (BLD-002).

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
- **Answer check against the stored solution** [C] (BLD-010): compare the submitted grid with the solution stored with the question; no rule checker per variant. Simple and works for every variant, but relies on every puzzle having a unique solution (U-90). Resolves **I-14**.
- **Generic grid model** [C] (BLD-011): rows, columns and regions, never assuming 9x9, applied consistently across the data model, the answer check, the answer screen and the question file format. The shapes supported first are the ones in the sample question PDF, still to be sent (U-01). Resolves **I-15**.
- **One role per account** [C] (BLD-004): keeps access rules simple; a person with two roles gets two accounts.
- **Prisma as ORM and migration system** [T] (I-31, decided 2026-09-29): the PostgreSQL schema is defined in Prisma and migrations are versioned in the repository, so the schema stays reproducible across the two developers and across development and deployment. The Prisma schema is the single source of truth for the database; the data model in `data-model.md` is expressed through it. Resolves the ORM/migration gap left open by the backend stack decision (I-02).
- **Docker and Docker Compose, with a Dockerfile per service** [T] (I-24, decided 2026-09-29): the same containers are used in development and deployment, so the two developers cannot drift apart in versions or environment (the problem the team had before). PostgreSQL and Redis run as Compose services.
- **Jest as the test framework** [T] (I-32, decided 2026-09-29): one runner for both the React frontend and the Node.js/TypeScript backend (through `ts-jest`), wired into the CI pipeline of BLD-002. Scope: the necessary minimum for the MVP.
- **Module-first backend folder structure** [T] (I-02, decided 2026-09-30): `backend/src/modules/<module>/` with one folder per module, each holding its controller, service, repository, types and barrel; plus `realtime/` (Socket.io gateway and handlers), `infra/` (Prisma, Redis, file store, logger), `shared/` (errors, middleware, validation, i18n, clock), `config/`, and `prisma/`. The structure mirrors the module boundaries so that invariant 4 (one owner per piece of state, internals reachable only through the public interface) is expressed in the code layout, and it fits the decided stack (Express.js, Prisma, Docker, WebSocket). Resolves the folder-structure gap left by the backend stack decision (I-02); see "Backend folder structure" above.

## Open technical decisions (do not implement until decided)

| Item | Open point |
|---|---|
| I-02 | Backend language and framework: **decided 2026-09-27 — Node.js with TypeScript, Express.js** [T]. Folder structure: **decided 2026-09-30** — module-first, see "Backend folder structure" above [T] |
| I-03, U-46 | Where the server runs on the event day: **TBD — to be decided by the project owner** |
| I-01 | **Data model: decided 2026-09-30** — approved in `data-model.md` (checklist item A6). The **final module list** and the **API** remain open |
| I-08 | Events vs direct calls between modules |
| I-16 | Session length |
| I-20 | UI component library, icons, fonts |
| I-30 | Format of judge and controller credentials |
| U-01, U-03, U-40 | Sample PDF and Excel not yet sent; whether the PDF carries points; extra Excel columns |
| U-90 | Whether every puzzle has a unique solution |
| U-49 | How long an interruption during a round is acceptable |
| I-05, U-60 | Load target and ceiling; listed both as [C] and as open |
| U-06 | Tablet model and Quark version |
