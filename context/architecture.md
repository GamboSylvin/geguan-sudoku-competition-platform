# Architecture Context (DRAFT v1, 2026-09-26)

> Status tags: [C] confirmed by the client's stakeholder · [P] approved in the blanket answer · [S] stated in the client's document · [T] team decision, not client-confirmed · [A] assumed · [O] open · [L] later. See `README.md`.
> **Status note.** The build and engineering decisions of 2026-09-26 (BLD-001 to BLD-011) are tagged [C]: confirmed on that date (confirmed again by the project owner). If a confirmed decision changes later, update this file and add a line to `progress-tracker.md`, "Context change log".
> **Left blank on purpose:** anything marked **TBD — to be decided by the project owner** (where the server runs on the event day). Do not choose a value.
> Anything tagged [O] or OPEN is not decided. Do not implement it. The schema must be approved before any feature is built on it.
> **Blanks to fill:** search this folder for `FILL-BEFORE-CODING`; the full checklist is `FILL-BEFORE-CODING.md`.

## Stack

| Layer | Technology | Role | Status |
|---|---|---|---|
| Frontend | React with TypeScript, one application with role-based areas (ARCH-020); built with **Vite**, styled with **Tailwind CSS** [T] (BLD-023) | All four ends: player, judge, controller/admin, big screen | [T] register status "Confirmed 2026-09-23"; not stakeholder-decided. Build tool and styling decided 2026-09-30 |
| Backend | **Node.js with TypeScript, using Express.js as the framework** [T] (I-02, ARCH-024) | Server-owned state, timer, scoring, ranking | Decided 2026-09-27 by the project owner. Same language as the frontend; Express.js is the framework |
| Durable data | PostgreSQL (ARCH-021) | Durable results, setup, accounts, round state changes | [T] |
| ORM and migrations | **Prisma** [T] (I-31) | The PostgreSQL schema (the single source of truth for the database) and the versioned migrations; used by the backend | Decided 2026-09-29 by the team |
| Runtime state | Redis **with persistence turned on** (ARCH-021, BLD-007) | Working grids | [T]/[C] |
| Real-time | WebSocket (ARCH-022) | Commands and state to tablets, judges, controller, big screens | [T] |
| Architectural style | Modular monolith, one deployable system (ARC-001, ARC-002) | Single backend | "Working Position" [T]; **event scope resolved 2026-10-01** [T] (BLD-033) — see "System boundaries" below |
| API contract and data model | (ARCH-023) | Starting point | "Working Position", not final [T] |
| File storage | **The server's disk, in a mounted folder**, not object storage [C] (BLD-001) | Participant Excel, question Excel, credential slips, exports | Decided |
| Containers | **Docker with Docker Compose** [T] (I-24), with a **Dockerfile per service** (backend, frontend) | The whole codebase: backend, frontend, PostgreSQL, Redis — the same environment in development and deployment | Decided 2026-09-29 by the team |
| Hosting | **Single host, decided 2026-10-09** [T] (BLD-048, supersedes BLD-031's two-phase Railway plan — never executed, superseded before any deployment existed): **Alibaba Cloud ECS, Mainland China region**, running the existing `docker-compose.yml` directly (BLD-016's principle: no architecture change between dev and deployment). Chosen over Railway/Render/Vercel because the student users are physically in mainland China with **no VPN access**, and the Great Firewall makes international platforms (hosted on US/EU infrastructure, often on IP ranges shared with unrelated sites) unreliable for this audience — unpredictable blocking and especially fragile long-lived WebSocket connections (the round timer, live ranking) over the international gateway. Mainland China hosting normally needs an **ICP备案** (domain filing, taking days to weeks) to bind a domain name to the server — **avoided for now by not using a domain name at all**: the app is reached by the server's **public IP address** directly, which is why ICP备案 does not apply yet. The project owner already has a usable Alibaba Cloud account, so no new account/payment step was needed. **Redeploy is manual, by choice** (the project owner declined CI/CD automation for now): `git pull` + `docker compose build` + `docker compose up -d` on the server, a few minutes each time new units land — the same single host serves development demos, continued building and the real event, so there is no separate "demo" vs "event day" phase to redo later. | Where the server runs, for every use from the current demo through the real event | **Decided, not yet executed.** Two things flagged for later, not blocking today's setup — see `unmade-decisions.md`: (1) Alibaba Cloud's exact current policy on serving plain HTTP on ports 80/443 by bare IP (no ICP) should be verified directly against their console/docs when the instance is created, since provider policy can change and this wasn't independently confirmed; (2) running without a domain means **no HTTPS**, so session tokens travel unencrypted over whatever network a client is on (including a venue's Wi-Fi) — acceptable for continued building and a low-stakes demo, but should be revisited (a domain + Let's Encrypt + the resulting ICP备案 lead time) before the real event if real student data is at stake. |

## System boundaries

One deployable backend organized as a modular monolith [T] (ARCHITECTURE §3 of the source documents). Each module owns its state; no other module modifies it.

**Final module list, confirmed 2026-10-01** [T] (BLD-032, closes the module-list part of I-01), derived from the documents alone, not from any code already written:

| Module | Owns |
|---|---|
| Competition | Creation, metadata, lifecycle, publish, pause and resume, finish and cancel state, **competition copy (CMP-100)** |
| Participant / Identity | Players, teams, player and judge accounts, participant membership, competition-specific access, **participant Excel import and numbering (PAR-001)**, **judge range assignment**, **one active device per account (PAR-005)** |
| Question | Question import and validation, question packs, assignment of questions to rounds (the Question Bank is later), **per-question points** |
| Stage / Round | Stage and round definitions, round timing and state, preparation state, **per-round customizable numeric values (SCR-005)** |
| Gameplay | The current grid, autosave, reconnection, submission state, player runtime state, **team rotation queue and partition-block state (TEM-004, TEM-005)** |
| Orchestrator | The sequence: start stage, preparation, start and end round, next round, next stage, finish; **reset/rematch/replay triggering (ROL-005)**; **judge-takeover arbitration (ROL-004)**. It coordinates modules and must not become the owner of every rule |
| Scoring | Puzzle evaluation, score and bonus calculation, the finalized round score (individual and team) |
| Ranking | Cumulative stage score, tie-breaking, provisional and final ranking, the school total |
| Results | Results view, **score corrections and the change log (RES-003)**, **archived scores from a rematch**, **export of scores/rankings/answers (RES-002)**, **the 15-day purge (RES-004)** |
| Big Screen | Big-screen state, ranking projection, player and team projection, display mode, **shared-link generation and regeneration (BSC-001, BSC-003)** |

- The client's "control hub" takes commands from judges and the controller, applies the arbitration rule and broadcasts state. It lives inside the Orchestrator and Big Screen modules [S].
- **Earlier candidate modules, superseded by the list above:** Identity & Access; Competition Configuration; Question Bank & Import; Participants & Teams; Judge Management; Competition Execution (game engine); Answer Validation & Scoring; Team Rotation; Results & Analytics; Live Monitoring & Presentation. The candidate Tenant/Organization module is later (ENV-007); a separate Audit/Configuration Versioning module is not needed (DP-011), apart from the score-correction log, now owned by Results.

**Hub-and-spoke** [C]/[T] (named 2026-09-30, resolves part of U-52 — the term formalizes facts already stated elsewhere in this file, not a new decision): the backend is the one hub; every client is a spoke that only receives server-pushed state over WebSocket, never computes or holds authority (invariant 10). Three spokes are **user roles** that also send commands back to the hub — player (submits), judge (supervises, restarts), controller (the primary user [C] U-52; setup and every live command). The **big screen is a receive-only spoke**: it takes the shared link with no login [C] (BSC-001), shows whatever the hub pushes, and never calculates rankings [T] (invariant 8) or sends any command. It is a display target, not a fourth user persona — see `project-overview.md`, "Target users".
- **Frontend folders, by feature** [T]: `auth`, `competition`, `player`, `judge`, `admin`, `big-screen`, `ranking`, `gameplay`. The frontend is a **Vite** project (React with TypeScript) styled with **Tailwind CSS** [T] (BLD-023, decided 2026-09-30).

**I-01 resolved in full.** The data-model part was decided 2026-09-30 (`data-model.md`). The module-list part is **resolved 2026-10-01** [T] (BLD-032) — the ten-module list above, covering team rotation, score corrections, the 15-day purge, import and export, competition copy, participant numbering, judge ranges and takeover, and the new Results module. **Keep the data model ready for team rotation** even though the Individual stage is built first [C] (BLD-009).
**I-08 resolved 2026-10-01** [T] (BLD-033): direct calls are the default between modules; events are used only inside the competition/game execution subsystem (stage/round lifecycle transitions, submissions, team rotation occurrences) where one occurrence must reach several listeners at once (players, judge view, big screen, scoring, rotation). Everything outside that subsystem — including the new Results module's calls to Ranking/Scoring — uses direct calls. This scope is final, not widened.

## Backend folder structure (decided 2026-09-30)

**Module-first** [T] (I-02, decided 2026-09-30 by the project owner). The structure follows the module boundaries above, so that one module folder is the one owner of its state (invariant 4) and a module's internals stay reachable only through its public interface. It respects the decided constraints: Node.js with TypeScript and Express.js [T] (I-02), Prisma as the ORM and migration system [T] (I-31), Docker with a Dockerfile per service [T] (I-24), WebSocket real-time [T], files on the server's disk [C] (BLD-001), the single server clock, and the English/Chinese message catalogues [C] (ARCH-026). It is the base adopted for the build, now that the module list is final (I-01, BLD-032).

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
│   │   ├── results/        # results view, corrections, export, 15-day purge (BLD-032)
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
- **Answer check** [C] (BLD-010): compare the submitted grid with the **solution stored with the question**; no rule checker per variant. This relies on every puzzle having a unique solution. **Resolved 2026-10-01** [C] (BLD-010, resolves U-90): every puzzle has exactly one valid solution, confirmed directly by the stakeholder. *(A wrong stored solution found after scoring is a separate, still-unassessed item, U-44 — not asked yet.)*
- A round transition happens only after its scoring is final [T]. A provisional ranking updates immediately when a round result is finalized, without waiting for every participant [T].
- Big screens show ranking cycles every 3 minutes [T]; they never calculate rankings [T].
- **Server restart mid-round** [C] (BLD-007): a **replay is acceptable**. Round state changes are kept in PostgreSQL and the working grids in Redis with persistence on. After a restart the competition comes back **paused**, so the controller chooses to resume or replay. **Tolerable interruption length, resolved 2026-09-30** [C] (U-49, recorded as RND-008 in `REQUIREMENTS.md` §10): there is **no fixed limit**. The stakeholder deliberately declined to set a time cap — on the event day, the controller decides whether to resume or replay based on the schedule at that moment, regardless of how long the interruption actually lasted. **Hard product constraint:** both resume and replay must always remain available to the controller, no matter the interruption's duration; the system must never impose a timeout that disables either path.
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
- **Files:** the server's disk, in a mounted folder [C] (BLD-001). Path and reference conventions are decided in `data-model.md`: the path template `{STORAGE_ROOT}/competitions/{competitionId}/{kind}/{fileId}-{originalName}` and the reference column `StoredFile.path`. The original question Excel is kept with the competition [A].
- **Purge:** 15 days after the competition, answers, scores and student accounts are permanently deleted; setup, questions and judges are kept [P]. **Archived scores and the correction log, resolved 2026-10-01** [C] (RES-005): also deleted after 15 days, same as the other student data. **The uploaded participant Excel, resolved 2026-10-01** [C] (RES-009): also deleted after 15 days — it holds the same personal data (names, schools) as the derived accounts and records already scheduled for deletion, so keeping the raw source file after deleting what it generated would be inconsistent. **U-62 is now closed in full.** Legal/school rules and approval of the deletion rule are resolved too (U-59, RES-008). *(A controller-notification email before the purge was considered and withdrawn 2026-10-01 — team idea, not the stakeholder's; see `competition-rules.md` §7.)*

## Data model — DESIGNED and approved (2026-09-30)

The approved data model and schema is `data-model.md` (approved 2026-09-30, checklist item A6). The schema is expressed in **Prisma** [T] (I-31): the Prisma schema is the single source of truth for the PostgreSQL schema and the migrations are versioned in the repository.

The entities below are the decided model; the full fields and constraints are in `data-model.md`. Open fields inside an entity are marked there and must not be implemented.

- Competition (event), Category, Stage, Round (with numeric round settings, set once per round for the whole event)
- **Question set per category, one file per category, not a shared pool** [C] (BLD-028, resolves U-32): each category (e.g. U8, U12) is uploaded and imported separately, even when categories run the same round in parallel.
- Question/puzzle: **generic grid** (rows, columns and regions; never assume 9x9), points (customizable by the controller regardless of what the import file carries [C], BLD-025, resolves U-92), the **stored solution**; the shapes supported first are those seen in the real sample question files [C] (BLD-011, BLD-024). **The given cells exist only in an embedded picture in the source files, not as text — resolved 2026-10-07/08** [C] (BLD-047, resolves U-94, overrides the short-lived BLD-043): the real stakeholder reply confirms the given cells/solution are read from **a new text column** (same array-with-gaps format as the existing blank-cells column), exactly BLD-026's original plan — he will ask the real organizer (主办方) to supply production files that way, and for now the team hand-transcribes text for the real sample files already on hand. No OCR, no image reading, anywhere — BLD-024's no-OCR principle holds without exception.
- **Team-round-2 block split** (partition collaboration, "齐心协力") [C] (TEM-005): a puzzle divided into contiguous horizontal row-bands, one band per active team member (2 to 6, as equal as possible, extra rows to the first bands), each member restricted to editing only their own band; the puzzle is scored all-or-nothing once the bands are combined. The model must keep this distinct from the rotation round's one-question-per-member pattern. Puzzle count (3), total time (30 min) and points per puzzle (20) are working positions [T] (TEM-006 to TEM-008), not sourced; do not treat as final. **Closed 2026-10-01** [T] (A10b, TEM-009): no stakeholder question will ever settle these numbers — they are controller-configurable per competition (SCR-005), same as round time and bonus rate, so the real regulation's numbers are entered directly in the setup form when the person running the competition has them.
- School, Team (one per school per category), Participant (name, school, category, team; a generated number)
- **Account with exactly one role** (player, judge, controller, big screen); several controller accounts are allowed; one person with several roles is handled as two accounts [C] (BLD-004)
- Judge assignment (a range of participant numbers), **assigned by the controller during setup and changeable during the event** [C] (BLD-008)
- Attempt/submission (archived on a judge restart or rematch; the count stays visible), finalized round result, Score (integers; the round score includes the bonus), Score correction log (mandatory reason)
- Ranking (individual, team, school; the school total is an exact decimal)
- Big-screen display state; purge schedule; import batch; audit log

Data rules already decided: question and round scores are whole numbers; the school total is an exact decimal, neither rounded nor truncated [C].

## Import formats and credentials

- **Participant Excel columns** [C]: Name, School, Category, plus two yes/no flags (`个人赛`/`团队赛`) rather than an explicit Team column. **Resolved 2026-10-07** [T] (PAR-011, resolves U-97, supersedes the earlier "Team column" wording): the real participant template (`context/samples/选手信息.xlsx`) has no Team column — a school's team in a category is every participant from that school+category with the `团队赛` flag set, never ambiguous since SCR-004 already guarantees exactly one team per school per category. The participant number is generated: schools in Excel order, then students in row order, **unique across the event**, and a team's numbers consecutive [P] (PAR-001). **The real file also carries a pre-filled `选手编号` (participant-number) column — resolved 2026-10-07** [T] (PAR-012, resolves U-98): ignored; the system always generates `participantNumber` itself. **Extra columns, resolved as a Working Position 2026-10-01** [T] (PAR-008, narrows U-40): the real file may carry columns beyond the ones read (e.g. age, province/city/district); the import simply **ignores any column it doesn't recognize** — no error, no warning. **Sample files partly received 2026-10-07** (U-01) — the real column template, but not yet a file with actual data rows, and the past results sheet is still missing. The whole file is validated; an invalid file commits nothing [T].
- **Question Excel** [C] (BLD-024, resolves U-93): the question import file is **Excel (.xlsx), not PDF**. This replaces every earlier "PDF, strictly predefined format" statement. The no-OCR principle holds for **every** structured field, including the given cells/solution — read from cells, never recognized from an image [C] (BLD-047, resolves U-94): see the Question/puzzle bullet above for the full reasoning. Any failure rejects the whole import [T].
  - **Points column** [C] (BLD-025, resolves U-92): the file carries a points value per question, but points stay **fully customizable everywhere** — a flat value repeated down every row (as in the real sample seen so far) is just what that file happens to contain, not a fixed rule. The controller can always change points before a round starts, including to reach the regulation's 100-per-round total.
  - **Each file is a pool, not a ready-made round — resolved 2026-10-07** [T] (BLD-040, resolves U-100): the 12 real question files received hold 30 to 100 questions per category/variant, far more than the 6 an Individual round needs. Unit 05 imports the whole file into the pool (`Question.roundId` starts `null`); a separate, manual controller step selects exactly 6 for a given Individual round before it starts. Does not affect the Team rotation round, which already draws questions at random from the pool (SCR-015) without ever needing `roundId`.
  - **Solution column: missing as text today, resolved via a new text column, no OCR.** The given (pre-filled) cells exist only as an embedded picture in the real sample files, not as text — confirmed on all 12 real files received 2026-10-07, not a one-row quirk. **Resolved 2026-10-07/08** [C] (BLD-047, resolves U-94, overrides the short-lived BLD-043): the given cells/solution are read from a new text column, same as every other field; see the Data model section above for the full reasoning. The 12 real sample files on hand predate this column and need it hand-transcribed before they can be used to test the real import end-to-end (see `specs/05-question-import-and-question-sets.md`).
- **Sample files partly received 2026-10-07** — `context/samples/选手信息.xlsx` (the participant column template) and 12 real question files across 3 grade-group folders; see `context/samples/README.md`. Still missing: a participant file with actual data rows, and a past results sheet (U-01).
- **Participant credentials** [C] (BLD-003): the **username is the participant number**; the **password is a short random code** generated by the system. Credential slips are exported and printed [C]. **Judge and controller credentials, resolved 2026-10-01** [T] (BLD-037, resolves I-30): the **same pattern as participants** (BLD-003) — a system-generated username (e.g. based on name or a sequential judge/controller number) plus a short, randomly generated password, printed the same way (PAR-002). No email or phone number at login — just username and password, consistent with the system's no-external-integration rule (ARCH-028).

## Auth and access model

- Username and password for player, judge and controller [C] (PAR-002). No OTP. Separate login endpoints per role [T].
- **Login flow, resolved 2026-10-01** [T] (ARCH-030, resolves U-28), fixing a real inconsistency found between two `REQUIREMENTS.md` lines (one said no role picker, the other described one): the **competition link identifies the competition** (no global competition-selection screen); the login page then shows an **explicit role picker** (player, judge, controller), followed by that role's printed credentials, then the role's home page. Chosen over auto-detecting the role from the credential format, for simplicity and clarity.
- **One active device per account; the newest login takes over** [P] (PAR-005). **Session length, resolved 2026-10-01** [T] (AUTH-001): the session lasts the whole event day (e.g. 24h), no idle-timeout expiry. The round timer is the real authority during an active round, not the session. Security is already covered by one active device per account (PAR-005) — a new login takes over regardless. **Judge and controller credential format, resolved 2026-10-01** [T] (BLD-037, I-30): system-generated username + short random password, same pattern as participants (BLD-003) — see "Storage model" above. **Unit 2 (Authentication) is now fully unblocked**: both of its open items (I-16, I-30) are resolved.
- Big screens: one shared link, no login [C] (BSC-001). After the competition a big screen becomes read-only [T].
- Only members of the competition's participant dataset can take part [T]. A judge can enter only the competition they are assigned to [T].
- **Roles** [C] (BLD-004): one role per account; several controller accounts are allowed; one person with several roles is two accounts. The Super Administrator is deferred [L] (SA-005). This settles the earlier open point about more than one controller.
- Documented permissions:
  - **Player:** cannot start or control anything, calculate rankings, control the display, or create or configure competitions [C] (PL-001).
  - **Judge:** sees the status of their assigned students and can restart one student's round [P] (ROL-003).
  - **Controller:** can do everything a judge can, plus event setup, rules and customization [C] (ROL-002); sees all progress in real time and can take over from a disconnected judge [C] (ROL-004) — **the takeover is manual (the controller acts), and the last action wins, confirmed 2026-10-01** [T] (ROL-004, resolves U-12), no longer just assumed. Commands: start a stage, pause, resume, end a round early, finish (early), reset or rematch, correct scores, control the big screens.
- **Access rules, resolved 2026-09-30** [C] (U-63, resolves also the general part of U-55; see `data-model.md`, "Access rules" for the field-level home):
  - **Player:** sees only their own answers. No visibility into another player's data.
  - **Judge:** strictly limited to their assigned range; cannot see students outside it. No powers beyond what is already documented — status of assigned students (connected, submitted) and single-student restart. Nothing more.
  - **Editing participants during the event:** only the controller. Judges have no participant-management access.
  - **Score changes:** only the controller can correct a score (already an invariant, RES-003); a judge cannot change a score.
  - **Judge in the Team stage, resolved 2026-10-01** [C] (ROL-008, resolves U-39): same scope as the Individual stage, no expansion — status (connected, in progress) of assigned teams, nothing more, no per-member detail.

## Cross-tool integration rules

Documented:
- Round state changes are kept in PostgreSQL and the working grids in Redis with persistence turned on [C] (BLD-007). Durable results are never only in Redis [T].
- Only members of the competition's participant dataset can take part, and a judge can enter only the competition they are assigned to [T]. **Enforcement, resolved — stale note corrected 2026-10-01** (found during a methodology completeness check; this line still said "OPEN" though the mechanism was built progressively, exactly as planned, across several unit specs): a service-layer scoping check enforces this — `specs/06-judges-and-ranges.md` builds the judge authority-scoping check (competition + participant-number range), reused unchanged by `specs/10-judge-supervision-and-single-student-restart.md`; the equivalent player-own-data check is built in `specs/07-round-runtime-and-autosave.md` and `specs/08-submission-answer-check-and-scoring.md`. No separate enforcement layer was needed at the API or WebSocket transport level — the same service-layer check runs regardless of which transport the request arrived on.
- Files live on the server's disk in a mounted folder [C] (BLD-001). **How the database refers to them, resolved** (`data-model.md`, "Storage conventions"): the path template `{STORAGE_ROOT}/competitions/{competitionId}/{kind}/{fileId}-{originalName}`, with `StoredFile.path` as the reference column on the parent record.

**Resolved progressively, as this note itself anticipated** — stale "OPEN" wording corrected 2026-10-01: what must be verified before a command is accepted is the session (Unit 02) plus the scoping check described above (Units 06/07/08/10); which store holds what is settled in "Storage model" below and in `data-model.md`, "Redis vs PostgreSQL". No single WebSocket-vs-REST contract was needed beyond what each unit spec's own "API Contract (Working Position for this unit)" section defines — consistent with `ARCH-023` (the API contract is explicitly a Working Position, decided per unit, not upfront).

## External services

**No external system integration for this version, confirmed 2026-09-30** [C] (ARCH-028, resolves U-57): the system connects only to its own four ends — tablets, judges' and controller's devices, and big screens. No SMS, no email, no external school student-ID system. Credentials are generated and printed internally; no external identity system is needed.

## Development environment and workflow

- **Workflow** [C] (BLD-002): one branch per unit; a **pull request before every merge**; **lint, type check, tests and build in CI**, which must pass before a merge; the **other developer reviews each pull request**.
- **Environment** [T] (I-24, decided 2026-09-29): **reproducible and containerized** — the whole codebase runs in containers, so development and deployment use the same environment and the two developers cannot drift apart. Decided by the team.
  - **Containers:** **Docker with Docker Compose**, with a **Dockerfile per service** (backend, frontend). PostgreSQL and Redis run as Compose services in development, and the application (backend and frontend) is containerized too; the **same containers are the deployment target**, not just local development. Where the containers run on the event day is still open (I-03, U-46); who sets that up is closed — a team call (B4, BLD-034).
  - **Package manager and lock file:** **npm**, with **`package-lock.json` committed**.
  - **ORM and migrations:** **Prisma** (I-31); the Prisma schema is the single source of truth for the PostgreSQL database and the migrations are versioned in the repository, applied in CI and on deployment.
  - **Frontend build tool and styling** [T] (BLD-023, decided 2026-09-30): **Vite** builds and serves the React frontend; **Tailwind CSS** is the styling approach. Created in Unit 1 with the frontend skeleton.
  - **Versions pinned:** **Node.js LTS, PostgreSQL 16, Redis 7**, recorded in `docker-compose.yml` and `.env.example`; the exact patch numbers are fixed at setup.
  - **`.env.example`** is committed and lists every required variable with placeholder values; the real `.env` is git-ignored and never committed.
  - **Created in Unit 1**, the foundation (repository, environment, CI, skeleton); see `specs/01-foundation.md`.
- **Testing scope and tool** [T] (2026-09-29): the framework is **Jest** (I-32), one runner for the frontend and the backend, wired into the CI pipeline. Keep the tests to the necessary minimum for the MVP — cover what the event depends on, do not go deep. Recorded in `code-standards.md`, Testing.
- **Later phase (not in the MVP)** [L]: an AI code review (for example CodeRabbit) and possibly GitHub Actions are planned for later, when the project is pushed; the exact tools depend on the time left. Today CI runs lint, type check, tests and build [C] (BLD-002).

## Devices and network (constraints)

- Students use Quark Browser on learning tablets (学练机) as the primary real-world device, landscape, with a "please rotate your device" screen [C].
- **Device/browser target, resolved 2026-09-30** [C] (U-06): **no fixed device or browser target.** The player-facing app must work broadly across platforms — tablet, phone or computer — not locked to one tablet model or one Quark Browser version. Build as a **standard responsive web app**, using only widely-supported web APIs, avoiding anything tied to a specific device or browser vendor. This **replaces** the earlier working assumption of "a modern Chromium-based Android browser." It does not remove the value of testing on a real learning tablet before the event if one becomes available — it just means the exact model/version is no longer a blocking unknown.
- Venue internet and Wi-Fi strength: the biggest real-world risk, confirmed [C] (U-56, resolved 2026-09-30 — see "Risks" below). The real venue-network facts stay **OPEN (U-46)**, for the stakeholder, closer to the event. **Who sets up the hosting and whether an on-site fallback is wanted is closed** [T] (B4, BLD-034) — a team/deployment-time call, not a stakeholder question.
- **Venue network details (internet availability, Wi-Fi strength, device capacity, own router), deliberately deferred 2026-09-30** [C] (U-06, U-46): not needed for the current build phase. The priority right now is that the system be reachable from any computer, phone or tablet for testing and demoing features — not the real venue's network conditions. This does not hold up construction at all; it is answered closer to the event date. **The on-site-server/router sub-question is closed** [T] (B4, BLD-034) — the team decides it itself at deployment time via `FILL-BEFORE-DEPLOYMENT` item C1, not a stakeholder question.

## Non-functional requirements

**Performance**
- Autosave about 2 grid saves per second per player [T]. Big-screen ranking cycle every 3 minutes [T]. A provisional ranking updates immediately when a round result is finalized [T].
- **Response-time targets, resolved 2026-10-01** [C] (U-58): the ranking must update within **2 seconds** of a submission; all tablets must start a round together within **1 second** of each other (relevant now that questions are fetched at the round start). No other timing requirement identified.

**Security and student data**
- The server decides time, submission validity, score and rank; the client is never trusted [T]. One active device per account [P].
- The judge sees how many times a student left the answer page, as information only, with no penalty [P]. Remote-competition security and proctoring are out of scope [S] (ENV-005).
- **Anti-cheating, resolved 2026-09-30** [C] (SEC-001, resolves U-37): confirmed as-is, nothing added. Kept deliberately light — server-owned time and answers, one active device per account, and the judge's page-leave count (informational, no penalty) are enough, since the competition is in-person and physically supervised by 30+ judges in the room. No camera, no remote proctoring, no additional lockdown measure.
- **Data protection, resolved 2026-10-01** [C] (RES-008, resolves U-59): no special protection requirement for student data — participants provide it voluntarily, and the organizer assumes no legal liability for it. The existing 15-day deletion plan (RES-004) stands as-is, with no additional legal/compliance requirement layered on top. Who formally approves the 15-day rule was not asked separately, but is treated as answered in substance by this reply, since the stakeholder answering is the one who would approve it.

**Scalability**
- About 600–720 students, 11 rooms, at least 30 judges, 10 big screens [C].
- **Scale ceiling, resolved 2026-09-30** [C] (U-60, also resolves I-05's "not reconciled" flag): **about 800 simultaneous clients is the ceiling for this version**, at about 2 grid saves per second — the existing load-test target (EVT-001) stays exactly as-is. Not the client document's original 1000+ devices / 3000 concurrent users [S]; that figure targeted the full multi-tenant platform vision, explicitly deferred to a later phase. The real known event scale (about 600–720 students) already fits comfortably under 800.

**Reliability**
- A failed round is replayed [C] (ROL-005); after a restart the competition comes back paused [C] (BLD-007); a student's saved grid is restored on reconnection [T].
- **How much failure the event can tolerate, resolved 2026-09-30** [C] (U-61, failure-tolerance part; same answer as U-49): there is no fixed tolerable-interruption duration — the controller decides resume vs. replay on the day, and the system must never time out either option; see "Data flow" above.
- **U-61's backup-plan part, closed 2026-10-01** [T] (B4, BLD-034): whether an on-site fallback server is wanted is not a stakeholder question — the team decides it itself at deployment time, via BLD-031 Phase 2 (paper is not mentioned anywhere as an option). See `FILL-BEFORE-DEPLOYMENT` item C1.

**Risks**
- **Biggest risk, resolved 2026-09-30** [C] (U-56): the venue Wi-Fi, in the room with about 300 tablets, is confirmed as the biggest real-world risk. It does **not** change the system design — the platform is already designed and load-tested for about 800 simultaneous clients. The only product addition is UI copy, not a functional requirement: an advisory reminder note shown to the controller when creating a competition, telling them to ask their network/IT team to properly configure the venue Wi-Fi before the event. No validation, no blocking behavior. See `ui-context.md`, competition creation/setup.
- Documented technical points, unranked: the request burst at round start, now that questions are fetched then (BLD-006); a server restart mid-round (handled by replay; no fixed tolerable-interruption duration, U-49 resolved 2026-09-30).
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
- **Answer check against the stored solution** [C] (BLD-010): compare the submitted grid with the solution stored with the question; no rule checker per variant. Simple and works for every variant; every puzzle having a unique solution is now confirmed (U-90, resolved 2026-10-01). Resolves **I-14**.
- **Generic grid model** [C] (BLD-011): rows, columns and regions, never assuming 9x9, applied consistently across the data model, the answer check, the answer screen and the question file format. The shapes supported first are those in the real sample question files (folder `[0923]各组别字符串`, received 2026-09-29). Resolves **I-15**.
- **One role per account** [C] (BLD-004): keeps access rules simple; a person with two roles gets two accounts.
- **Prisma as ORM and migration system** [T] (I-31, decided 2026-09-29): the PostgreSQL schema is defined in Prisma and migrations are versioned in the repository, so the schema stays reproducible across the two developers and across development and deployment. The Prisma schema is the single source of truth for the database; the data model in `data-model.md` is expressed through it. Resolves the ORM/migration gap left open by the backend stack decision (I-02).
- **Docker and Docker Compose, with a Dockerfile per service** [T] (I-24, decided 2026-09-29): the same containers are used in development and deployment, so the two developers cannot drift apart in versions or environment (the problem the team had before). PostgreSQL and Redis run as Compose services.
- **Jest as the test framework** [T] (I-32, decided 2026-09-29): one runner for both the React frontend and the Node.js/TypeScript backend (through `ts-jest`), wired into the CI pipeline of BLD-002. Scope: the necessary minimum for the MVP.
- **Module-first backend folder structure** [T] (I-02, decided 2026-09-30): `backend/src/modules/<module>/` with one folder per module, each holding its controller, service, repository, types and barrel; plus `realtime/` (Socket.io gateway and handlers), `infra/` (Prisma, Redis, file store, logger), `shared/` (errors, middleware, validation, i18n, clock), `config/`, and `prisma/`. The structure mirrors the module boundaries so that invariant 4 (one owner per piece of state, internals reachable only through the public interface) is expressed in the code layout, and it fits the decided stack (Express.js, Prisma, Docker, WebSocket). Resolves the folder-structure gap left by the backend stack decision (I-02); see "Backend folder structure" above.
- **Vite and Tailwind CSS for the frontend** [T] (BLD-023, decided 2026-09-30 by the project owner): **Vite** is the frontend build tool and dev server (fast, the standard for a React + TypeScript app, no framework lock-in), and **Tailwind CSS** is the styling approach (utility-first, keeps the styling in one system and avoids a heavy component library while the visual design is still open, BLD-009/U-65). The choice is about *how* the frontend is built and styled, not *what* it looks like: the visual language (U-65), the component library, the icon set and the fonts stay open (I-20) and are decided in the design phase. Recorded as BLD-023; see `code-standards.md`, Framework/library and File organization, and `ui-context.md`, Component Library.

## Open technical decisions (do not implement until decided)

| Item | Open point |
|---|---|
| I-02 | Backend language and framework: **decided 2026-09-27 — Node.js with TypeScript, Express.js** [T]. Folder structure: **decided 2026-09-30** — module-first, see "Backend folder structure" above [T] |
| I-03, U-46 | Where the server runs on the event day (Phase 2 hosting): **TBD — to be decided by the team.** Deliberately deferred to closer to the event date (Q23); not blocking. **Closed 2026-10-01** [T] (B4, BLD-034): who sets it up and whether an on-site fallback is wanted is a team/deployment-time call, not a stakeholder question — only the real venue-network facts (internet, Wi-Fi strength) still wait on the stakeholder. The separate near-term demo/testing hosting (Phase 1, Railway) is resolved — see Stack table and BLD-031. |
| I-01 | **Resolved in full.** Data model: decided 2026-09-30 — approved in `data-model.md` (checklist item A6). **Final module list: resolved 2026-10-01** [T] (BLD-032) — see "System boundaries" above. The **API** contract is agreed per unit ("contract first", see `specs/00-build-plan.md`) |
| I-08 | **Resolved 2026-10-01** [T] (BLD-033): direct calls by default; events only inside the competition/game execution subsystem (stage/round lifecycle, submissions, team rotation). See "System boundaries" above |
| I-20 | **Resolved in full.** UI component library, icons, fonts. **Styling approach decided 2026-09-30 — Tailwind CSS** [T] (BLD-023). **Default visual style (theme, colors) resolved 2026-10-01 as a Working Position** [T] (U-65; see `ui-context.md`, "Theme"/"Colors" — not yet stakeholder-confirmed). **Font stack resolved 2026-10-01** [C] (U-70; see `ui-context.md`, "Typography") — explicit Latin + CJK fallback stack, no web-font download. **Component library and icon set resolved 2026-10-01** [T] (BLD-035) — **Headless UI + Heroicons**, see `ui-context.md`, "Component Library"/"Icons". The visual design (colors, layouts) still comes after the first slice [C] (BLD-009) |
| I-30 | **Resolved 2026-10-01** [T] (BLD-037): format of judge and controller credentials — same pattern as participants (BLD-003), system-generated username + short random password. See "Auth and access model" above |
| U-01 | Sample participant Excel (with real data rows) and a past results sheet still not sent — confirmed still missing 2026-10-07; real question files received 2026-09-29/2026-10-07 |
