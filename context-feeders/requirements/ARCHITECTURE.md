> **[CONTEXT FEEDER NOTE]** This file is part of the requirements record. It FEEDS the `context/` folder; it is NOT what a coding agent builds from - build from `context/` (see the root `CLAUDE.md`). If this file and `context/` differ, do not resolve it silently: raise it. It is maintained under the documentation rules in the root `CLAUDE.md`.

# ARCHITECTURE.md

**Status:** Consolidated and reviewed on 2026-09-25: all 12 source passes and the merge of the stakeholder answers (pass 0) are done (`../archive/client-view.md`, the Alignment Guideline, the Q2 and Q3 summaries, `../archive/PROJECT_ANALYSIS_UPDATED.md`, `../archive/PLAYER_REQUIREMENTS.md`, `../archive/ORGANIZATION_ADMIN_REQUIREMENTS.md`, `../archive/JUDGE_REQUIREMENTS_PROPOSAL.md`, `../archive/STAGE_REQUIREMENTS.md`, `../archive/FLOW_REQUIREMENTS.md`, `../archive/ARCHITECTURE_REQUIREMENTS.md`, `../archive/SUPER_ADMIN_REQUIREMENTS.md`); see `../archive/CONSOLIDATION_LOG.md`
**Purpose:** How the product is built: style, stack, modules, data model, real-time design, API, scale and deployment. What the product must do lives in `REQUIREMENTS.md`.

## 0. How to read this document

Status tags: **[C]** confirmed by the stakeholder, **[S]** stated in the client's original document and not contradicted, **[P]** proposed by the team and approved in the stakeholder's blanket answer (the register's "accepted proposal"), **[T]** team decision from the engineering guideline (not yet reviewed by the stakeholder), **[A]** assumed by the team, **[O]** open (see `../decisions/unmade-decisions.md`), **[L]** later.

## 1. Style and principles

- **One deployable backend, organized as a modular monolith.** Modules are logical boundaries with their own responsibilities; they are not separately deployed services. **[T]**
- **Hub-and-spoke.** The four ends (player, judge, admin/controller, big screen) never communicate with each other directly. Everything goes through the server, which keeps permissions, state synchronization and data storage in one place. **[S]**
- **Active and passive ends.** Players and big screens mainly receive commands and display; judges and the admin send commands. **[S]**
- **Permission arbitration.** When two active ends control the same thing (for example the big screen), the server arbitrates: the last action wins, and the action is logged so it can be traced. **[S]** Rules for who may control what: `../decisions/project-decisions.md` BSC-002.
- **The server is authoritative** for: competition, stage and round state; the timer; pause and resume; submission validity; scoring; ranking; participant eligibility. **[T]** (ENV-006) The client renders the UI, captures input, shows countdowns derived from server state, sends actions, and keeps only temporary local UI state. The client is never trusted to decide whether a round is active, how much time remains, whether a submission is valid, what score was earned or what rank a player has.
- **Communication between modules:** a direct call through a service or contract by default; events only where they give a clear benefit, chiefly recording player moves and state. Scoring does not react to every move; it reacts to a submission, then ranking follows. **[T]** This narrows the earlier team decision of event-driven communication across the game subsystem: **[O]** I-08.
- **Data ownership.** Each major piece of state has one owner and no other module modifies it: competition state → Competition; player membership → Participant; question data → Question; round state → Stage/Round; current grid → Gameplay; final score → Scoring; ranking → Ranking; big-screen projection → Big Screen. **[T]**
- **Two paths.** The *gameplay path* is: move → save state → the player continues. The *result path* is: submit, timeout or judge end → evaluate → score → rank → display. The Orchestrator decides when each path may operate (waiting → preparation → round active → round finished → next round or stage finished → finished). **[T]**
- **Engineering rules for the build:** do not expand scope; the server decides competition truth; one source of truth per state; modules are logical, not microservices; events only where useful; durable results live in PostgreSQL, never only in Redis; integrate continuously; do not generalize prematurely (hard-code the known rules; numeric values stay customizable, SCR-005); protect competition execution over admin extras; freeze the architecture unless a real blocker appears. **[T]** Build **vertically**, not module by module: the first goal is the smallest end-to-end slice — create a competition and a participant, publish, a player logs in, the controller starts a stage, a round runs, the player moves and autosaves, submits, the system scores and ranks, and the big screen shows the result — then expand outward (participant import, PDF processing, pause and reconnect, team competition, projections, admin polish). **[T]**

- **Why this style.** Two developers, so deployment and coordination overhead must stay low: one artifact to build, ship and run; clear module boundaries keep the code readable and changeable; the same boundaries are a natural seam for extracting a module later, if and when that is ever needed. Microservices would add network, versioning, observability and operations cost with no MVP benefit. **[T]** (ARC-001, ARC-002, ARC-004)
- **Scaling posture.** Scaling is a later concern: the modular structure must not prevent it, but the MVP is not designed around speculative scale, and extracting a module into a separate service is not planned and not a design goal. **[T]** (ARC-005)
- **How the style was chosen.** The team chose it ahead of full requirements validation, for team-size and delivery reasons, not by deriving it from the requirements as the earlier process rule asked (divergence D-1 in the register, `../decisions/project-decisions.md` §8.1). It fixes the style only, and it must stay revisable if the requirements contradict it. **[T]** (ARC-006)
- **Module rules.** Boundaries are explicit and enforced by convention and code structure. A module's internals are reachable only through its public interface, and no module reads another module's tables or data structures directly. Modules follow the domain and its responsibilities, not a technical layering chosen in advance. **[T]** (ARC-003, ARC-010, ARC-013)
- **Event rules (earlier team decision; scope open, I-08).** The earlier decision applied events to the competition/game subsystem only (stage and round lifecycle, player actions, validation, scoring, team rotation), where many components must hear about the same occurrence; modules outside it call each other directly, in-process, through their public interfaces, because a blanket event bus there would add indirection without benefit. Where events are used they are **in-process**: no external message broker, queue or event-streaming infrastructure, revisited only if a concrete requirement demands durability or cross-process delivery. Events describe a **fact that happened** (for example "round ended"), never a command to another module. Events announce changes to authoritative state; they never make a client authoritative. **[T]** (ARC-020, ARC-021, ARC-023, ARC-025) The reason for events is that one occurrence, such as a round ending, affects players, the judge view, the big screen, scoring and rotation, and pairwise calls between them would couple them tightly and multiply the cost of a change; events let a component announce what happened without knowing who cares, which also keeps the subsystem maintainable as round types and team mechanics grow (only the rotation round was detailed when this was decided). Candidate events are listed in §5.
- **Non-goals for the MVP.** Microservices or separately deployed services; an external broker or event streaming; a general dynamic rules engine or plugin architecture (the client's "Steam-like" upload idea is not accepted); the client's "unified configuration distribution engine"; events across the whole monolith; multi-region, high-availability or auto-scaling design; remote-competition and anti-cheating architecture (ENV-005). **[T]** / **[C]**
- **Later multi-tenant target [L].** When the platform becomes multi-tenant (ENV-007, deferred), tenant isolation is enforced structurally at module level, not by each developer remembering a filter, and events carry their tenant context so no subscriber processes an event across a tenant boundary. Nothing of this is built in the MVP. (ARC-011, ARC-024)

### Architecture in one view

```text
                      ADMIN / CONTROLLER (HTTP + live channel)
                                   │
   PLAYER (React/TS) ◄── WS ──►    │    ◄── WS ──► JUDGE (React/TS)
                                   ▼
   BIG SCREEN (React/TS) ◄─ WS ─► MODULAR MONOLITH
                     Competition · Participant/Identity · Question ·
                     Stage/Round · Gameplay/Player State · Orchestrator ·
                     Scoring · Ranking · Big Screen
                                   │
                        ┌──────────┴──────────┐
                     PostgreSQL             Redis
                  (durable data)        (runtime state)
```

The guideline drew the admin as HTTP only; the stakeholder needs the controller to have a live view, so the controller also needs a live channel (ROL-004). **[C]**

## 2. Technology stack

| Layer | Choice | Reason given |
|---|---|---|
| Frontend | **React with TypeScript**, one application with role-based areas | One app avoids duplicating shared components and state; separate apps only if deployment forces it **[T]** |
| Backend language / framework | **[O]** ARCH-2, I-02 — the only major choice not yet named | — |
| Durable database | **PostgreSQL** | Durable business data: competitions, participants, teams, accounts, judges, stages, rounds, questions and question packs, finalized submissions and results, scores, ranking data (or the source data to compute it) **[T]** |
| Runtime state | **Redis** | Fast-changing state: active competition and round state, timing coordination, connection state, pub/sub for WebSocket if needed **[T]** |
| Real-time transport | **WebSocket** | Player, judge and big-screen channels; one physical endpoint with authenticated roles, or separate endpoints if simpler **[T]** |
| Authentication | Username and password for player, judge and admin; printed credential slips | **[C]** (PAR-002) |
| Question import | Fixed PDF format, the narrowest parser that handles the real client document, no OCR; the extraction library is not chosen (I-04); real sample files (question PDF with points, participant Excel, a past results sheet) have not been received, so the importers are built against an assumed format and kept easy to change (U-01) | **[T]** / **[O]** |
| UI languages | English and Chinese, with translation planned in from the start | **[C]** (ARCH-026) |

The reasons for the backend language, deployment and libraries still have to be written when they are chosen. **[O]**

## 3. Modules and responsibilities

| Module | Owns |
|---|---|
| Competition | creation, metadata, lifecycle, publish state, pause/resume state, finish and cancel state |
| Participant / Identity | players, teams, player and judge accounts, participant membership, competition-specific access |
| Question | question import and validation, question packs, question-to-round assignment (the Question Bank is later) |
| Stage / Round | stage and round definitions, round timing, round state, preparation state |
| Gameplay / Player State | current grid, autosave, reconnection state, submission state, player runtime state |
| Orchestrator | the execution sequence: start stage, preparation, start round, end round, next round, next stage, finish. It coordinates modules and must not become the owner of every rule |
| Scoring | puzzle evaluation, score and bonus calculation, the finalized round score |
| Ranking | cumulative stage score, tie-breaking, provisional and final ranking |
| Big Screen | big-screen state, ranking projection, player and team projection, display mode |

**Control hub** (client document): takes commands from judges and the admin, queues projection commands, applies the arbitration rule and broadcasts state to players and screens. **[S]** — it lives inside the Orchestrator and Big Screen modules.

**Earlier candidate modules (a proposal, not settled; revisit under I-01):** Identity & Access; Competition Configuration; Question Bank & Import; Participants & Teams; Judge Management; Competition Execution (game engine); Answer Validation & Scoring; Team Rotation; Results & Analytics; Live Monitoring & Presentation. The guideline's list above merges these (Judge Management into Participant / Identity, Results & Analytics into Ranking and Scoring). The candidate Tenant / Organization module is later (ENV-007), and the Audit / Configuration Versioning module is not needed (DP-011), apart from the log of score corrections.

**Needed by the stakeholder's answers but missing from the guideline's module list [O]** (see I-01): team rotation (TEM-004); score corrections with a change log (RES-003); retention and the 15-day purge (RES-004); import and export (Excel, credential slips, results file: PAR-002, RES-002); competition copy (CMP-100); participant numbering (PAR-001); judge number ranges and takeover (ROL-003, ROL-004); one active device per account (PAR-005); several synchronized big screens on one shared link (BSC-001, BSC-002); reset, rematch and replay with archived scores (ROL-005); customizable numeric values (SCR-005).

## 4. Domain and data model

The guideline's minimum conceptual model **[T]**:

```text
Competition ── Category, Judge, Participants, Stages, QuestionPack
Participant ── Player, Team
Player      ── Account
Stage       ── Rounds
Round       ── Questions, PlayerRoundState
PlayerRoundState ── CurrentGrid, SubmissionState, RuntimeState
RoundResult ── Player/Team, Score, SubmissionTimestamp
StageRanking ── Player/Team, CumulativeScore, Ranking
Question    ── QuestionBank
```

Exact table normalization is decided during implementation. In this model a competition has one category and one judge; the real event has several categories and at least 30 judges (see the extension list below).

**Must be extended before coding** (the stakeholder's answers; see `../decisions/unmade-decisions.md` I-01): an event with several categories that start together, rooms and judge number ranges (EVT-002, ROL-003); per-question points (SCR-003); configurable numeric values (SCR-005); archived scores after a rematch (ROL-005); a score-correction log (RES-003); an "auto-filled" answer flag and unanswered questions stored as wrong (RES-001); kept submitted answers and the 15-day purge of answers, scores and student accounts (RES-001, RES-004); participant numbering by school in file order, then row order, with consecutive team numbers (PAR-001); the account's single active device (PAR-005); copy (CMP-100); the school total and school ranking (SCR-004). Sizing: about 800 clients, 11 rooms, one room of about 300 (EVT-001). **[O]**

## 5. Real-time design

Four flows run through the hub. **[S]**

| Flow | Direction | Content |
|---|---|---|
| Configuration | admin → server → the other ends | numeric settings and competition setup (a versioned "configuration center" is rejected) |
| Control | judge/admin ↔ server ↔ players and screens | start, pause, end a round; unified start command; screen control |
| Data | players and judges → server → admin | answers, results, times, scores |
| Projection | a player's board → server → big screen | board state and move coordinates only |

- **Channels:** a player channel, a judge channel and a big-screen channel. **[T]**
- **Autosave** goes over WebSocket, not one REST request per move, and is rate-limited to about **2 grid updates per second per player**. A grid update saves the current state and never triggers scoring. **[T]**
- **Timer model.** The server owns the round timer, derived from `roundStartTime`, `roundDuration` and `serverNow`. A client countdown is only a display of server time; a client-side `setInterval` countdown must never be the source of truth. **[T]**
- **Reconnection.** On reconnecting, the server sends the current competition state and the latest saved grid is restored. **[T]**
- **Internal events versus client messages.** What propagates inside the server and what reaches a tablet or screen are separate: the low-bandwidth rule applies to the client channels, which carry only light commands and state, whatever the internal events are (ARCQ-7). **[T]**
- **Light synchronization.** Only commands and move coordinates are sent; the big screen **rebuilds the board locally**; **no video** is streamed. **[S]** The big screen never calculates ranking. **[T]**
- **Projection.** For a close-up, the selected student's board state is relayed to the big screen as light moves. For a team view, the states of all of the team's tablets are relayed side by side. The projected target uploads its board data **only when commanded to**, so idle tablets add no traffic. **[S]**
- **Question delivery.** The client document preloads questions on the player's device to keep match-time traffic light. **[S]** When to deliver them is open: see §10.
- **Candidate domain events (earlier proposal, to be checked against the final flow):** stage started and ended; round waiting entered and countdown started; round started and ended; competition paused and resumed; round ended early; player move saved; player submitted; player auto-submitted at expiry; answer validated (correct or not); score calculated; ranking updated; team question assigned, replenished or rotated; participant connected and disconnected; big-screen display target changed; results made visible (what "publish" means: U-24). **[T]**
- **Ranking updates are independent of the big-screen display timer** (the 3-minute cycle does not restart when ranking data changes). **[T]**

## 6. API contract

The guideline's minimum conceptual contract; URL names may change. **[T]** Its "Judge" commands (start a stage, pause, resume, end a round, finish, cancel, display control) were written when there was one judge. Under the stakeholder's answers these become **controller** commands, and judges get status for their number range and the single-student restart (ROL-003); the list under "To add" below shows what changes.

**REST**

| Area | Endpoints |
|---|---|
| Authentication | `POST /auth/player/login`, `POST /auth/judge/login`, `POST /auth/admin/login` |
| Admin — setup | `POST /competitions`, `GET /competitions/:id`, `POST /competitions/:id/participants`, `POST /competitions/:id/questions/import`, `POST /competitions/:id/judge`, `POST /competitions/:id/publish` |
| Admin — results | `GET /competitions/:id/results`, `GET /competitions/:id/stages/:stageId/ranking` |
| Judge — competition control | `POST /competitions/:id/start-stage`, `.../pause`, `.../resume`, `.../finish`, `.../cancel` |
| Judge — round control | `POST /stages/:stageId/start`, `POST /rounds/:roundId/end` |
| Judge — big screen | `POST /competitions/:id/display/player`, `.../display/team`, `.../display/normal` |
| Player | `GET /competitions/:id/me`, `GET /rounds/:roundId/state`, `POST /rounds/:roundId/submit` |

**WebSocket messages**

- Player → server: `PLAYER_CONNECT`, `PLAYER_GRID_UPDATE`, `PLAYER_SUBMIT`.
- Server → player: `COMPETITION_STATE`, `STAGE_STARTED`, `PREPARATION_STARTED`, `ROUND_STARTED`, `ROUND_STATE`, `COMPETITION_PAUSED`, `COMPETITION_RESUMED`, `ROUND_FINISHED`, `STAGE_FINISHED`, `SUBMISSION_ACCEPTED`, `COMPETITION_FINISHED`.
- Judge → server (REST or WebSocket): `START_STAGE`, `END_ROUND`, `PAUSE_COMPETITION`, `RESUME_COMPETITION`, `FINISH_COMPETITION`, `CANCEL_COMPETITION`, `PROJECT_PLAYER`, `PROJECT_TEAM`, `RETURN_TO_NORMAL_DISPLAY`.
- Server → judge: `COMPETITION_STATE`, `STAGE_STATE`, `ROUND_STATE`, player/team counts, `RANKING_UPDATES`, `DISPLAY_STATE`.
- Server → big screen: `COMPETITION_STATE`, `ROUND_STATE`, `RANKING_UPDATE`, `STAGE_FINISHED`, `DISPLAY_MODE`, `PLAYER_PROJECTION`, `TEAM_PROJECTION`.

Event names are implementation details; the semantics matter.

**To add for the stakeholder's answers [O]:** controller and judge role split (start/pause/end for the controller; assigned ranges and single-student restart for judges: ROL-002, ROL-003); reset and rematch (ROL-005); takeover (ROL-004); individual participant add, edit and replace (PAR-003); score corrections (RES-003); results export (RES-002); credential slips (PAR-002); competition copy (CMP-100); the shared big-screen link (no login: BSC-001) and its controller-only control with several screens (BSC-002); judge status for assigned students (ROL-003); several categories in one event (EVT-002); the controller's live channel (ROL-004); customizable numeric values before a round starts (SCR-005).

## 7. Scale, performance and reliability

- The client document set the targets for the full platform vision: **1000+ devices online, 3000 concurrent users, low bandwidth**. **[S]** Those are not the MVP numbers; the real scale is in `../decisions/project-decisions.md` EVT-001 (about 600–720 students, 11 rooms, 30+ judges, 10 screens; design target about 800 clients).
- **Client devices.** Students use **Quark Browser on learning tablets (学练机)**, shown in landscape, with a "please rotate your device" screen when held upright. **[C]** (PAR-006, UI-001) The exact tablet model and Quark version are not known, and there is no test unit yet (U-06). Working assumption: a modern Chromium-based Android browser; test on a real tablet early. **[A]** The biggest real-world risk is the venue Wi-Fi with about 300 tablets in one room (U-06); design and load-test for about 800 clients sending roughly 2 grid saves per second (I-05).
- **Low bandwidth** is a design principle: light commands, local rendering, no video. **[S]**
- The competition survives a student's disconnection through server-owned time and the restored saved grid; a failed round is replayed. **[T]** / **[C]** (ROL-005)
- Stabilization work needed near the end of the build: an end-to-end rehearsal, a performance sanity test, logging and error handling, database migration checks, backups, environment configuration, production deployment, and a competition-day runbook. **[T]**

## 8. Security and access

- Each role logs in with a username and password; players may take part only if they belong to the competition's participant dataset. **[T]**
- The competition entry link/QR identifies the competition. **[T]** (The client document has a role-selection page: **[O]** U-28.)
- One active device per account; a new login takes over. **[P]** (PAR-005)
- The big screens open from one shared link, with no login. **[C]** (BSC-001) Anyone holding the link can view the screen, and the link can be regenerated: **[A]** U-15.
- The judge sees how many times a student left the answer page — information only. **[P]** (PAR-005)

## 9. Deployment and environments

- One deployable backend application and one React application with role-based areas, laid out by feature: auth, competition, player, judge, admin, big-screen, ranking, gameplay. **[T]** Separate frontend applications only if deployment forces it; role-specific routes and views share common components and state infrastructure.
- **Earlier build sequence, kept for reference and to be reworked in the build plan (I-01)** **[T]**: days 1–2 foundation (project structure, PostgreSQL and Redis connections, basic schema, authentication foundation, competition, participant, stage and round models, API structure, WebSocket infrastructure); days 3–4 competition setup (creation, participant import and validation, account generation, teams, judge assignment, publish readiness, publish and lock); days 5–6 question system (PDF validation, extraction, classification into rounds, question pack, round question retrieval; if PDF parsing becomes a blocker, use the predefined format and the narrowest parser for the real client document); days 7–9 runtime (stage state machine, preparation countdown, round timer, start and end round, pause and resume, finish, player entry and runtime state, autosave, WebSocket synchronization); days 10–11 scoring and ranking (submission, auto-submit, evaluation, scoring, bonus, cumulative ranking, tie-breaks, final ranking); day 12 big screen (ranking display, pagination, the 3-minute cycle, projections, pause display, final results); days 13–14 integration and failure cases; day 15 stabilization with no new features. The plan predates the stakeholder's answers, so it has no team rotation, several categories, judge ranges, corrections, purge, export or copy.
- **Two-developer split, also for reference:** one developer takes the competition lifecycle, orchestrator, judge and controller APIs, WebSocket state and the server timer; the other takes the player UI, gameplay grid, submission UI, scoring and ranking, and the big screen. Both share database model decisions, authentication, integration and testing, and boundaries move with actual strengths. Do not split strictly backend versus frontend for all 15 days; integrate every day. **[T]**
- Hosting, infrastructure and whether to run an on-site server on the venue network as a fallback: **[O]** (`../decisions/unmade-decisions.md` I-03). What the venue offers (internet, Wi-Fi per room, who runs the server) is a question for the stakeholder: U-46.

## 10. Open technical decisions

- **Question delivery timing (decided 2026-09-26).** The questions are fetched at the start of the round, with no preloading; a round is only 6 puzzles, a small payload, and nobody sees a puzzle before the start. Preloading encrypted, with the key released at the start, stays a fallback if the load test of about 800 clients shows a problem (I-05). **[C]** (BLD-006)
- **Screen command log (I-07).** The client document requires screen commands to be traceable; how much is logged and for how long is undecided. **[O]**
- **Event scope (I-08).** The earlier team decision put in-process events across the game subsystem; the later guideline uses direct calls by default and events mainly for recording moves. Decide which one to follow, and whether the same events also feed the real-time push to clients or push stays a separate concern (ARCQ-2). Both developers should then record their acceptance of the final style and event scope. **[O]**
- **Server restart during a round (decided 2026-09-26).** A replay is acceptable (ROL-005). Round state changes are kept in PostgreSQL and the working grids in Redis with persistence turned on; after a restart the competition comes back paused, so the controller chooses to resume or replay. How long an interruption is acceptable is still open (U-49). Whether in-process event delivery is enough or some events must survive a restart (ARCQ-3) follows from the event-scope decision (I-08). **[C]** (BLD-007)
- **Files, workflow and roles (decided 2026-09-26).** Uploaded and generated files live on the server's disk in a mounted folder. **[C]** (BLD-001) Work is one branch per unit, a pull request before every merge, and lint, type check, tests and build in CI. **[C]** (BLD-002) The data model has one role per account, several controller accounts allowed, and a question set per category. **[C]** (BLD-004, BLD-005) The backend language and framework, who builds what, and where the server runs on the event day are left blank on purpose: I-02, I-17, I-18, I-23, I-03, U-46.
- **Late manual submit (decided 2026-09-26).** A submit that arrives after the server timer ended is not counted as manual; the last saved grid is auto-submitted instead, with no grace period. This is for the Individual rounds; the team rotation is in `REQUIREMENTS.md` §4.1. **[C]** (SUB-003, SUB-006)
- **Rejected or failed login (I-13).** What a player or judge sees when the login is rejected is not decided. **[O]**
- **Grid shapes (decided 2026-09-26).** Puzzles can be 9×9 or another shape (9×6 was discussed). The grid model is generic (rows, columns and regions), and the answer check, the answer screen and the question file format never assume 9×9. The shapes supported first are those in the sample question PDF; how a shape is written in the PDF and how it relates to question type follow from that sample (U-01). **[C]** (BLD-011)
- **Answer check and unique solutions (decided 2026-09-26).** The answer is compared with the solution stored with the question, with no rule checker per variant. This relies on every puzzle having a unique solution, which the stakeholder is asked to confirm (U-90). **[C]** (BLD-010)
- **Session length and idle behavior (I-16).** How long a login lasts, and what happens when a session expires or a tablet sleeps, are not decided. Documented only: one active device per account (PAR-005), and a page refresh counts as a reconnect. **[O]**
- **Triage rule for unknowns** **[T]**: treat an unknown as an implementation detail unless it changes the domain model, the competition state machine, scoring or ranking behavior, authentication or access, the question input format, or a critical API or WebSocket contract; only those need a decision before coding.
- Everything else: `../decisions/unmade-decisions.md` §3.
