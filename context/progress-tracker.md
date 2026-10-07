# Progress Tracker

**This is a living document: it describes the current state of the project, not the history.**
It answers four questions at a glance — what is being built now, what is done, what is next, and what is blocked.
Update it after every meaningful change. Keep it short: replace stale lines instead of appending new ones.

**History is not lost — it lives in [`progress-tracker-history.md`](progress-tracker-history.md).** The three chronological logs that used to sit in this file (the full "Completed" log, the full "Context change log" and the full "Last Updated" log) were moved there verbatim on 2026-10-02. When you add a dated entry, append it to the matching section at the bottom of the history file; keep only the current state here.

Last updated: **2026-10-08** (**UI-008**: project owner decision, no dedicated design pass before the MVP/event — current Tailwind-default screens ship as-is; closes `FILL-BEFORE-CODING.md` row B5 with Tailwind's own border-radius/spacing scale, fixes U-65/U-66's timing without resolving their content, both still open to revisit after the event. Previously, 2026-10-07: Unit 09 built and verified; 9 project-owner decisions resolved — PAR-011, PAR-012, BLD-040, SCR-020, BLD-041, BLD-042, BLD-043, BIZ-001; Unit 05's spec drafted, flags 2 new findings needing confirmation; three code-side follow-ups pending, see Known Issues and Next Up).

---

## Current Phase

**Building.** The coding gate passed 2026-09-30 (no `FILL-BEFORE-CODING` blank remains; section E approved) and the project owner gave the explicit go-ahead 2026-10-01. Requirements are still refined in parallel through the stakeholder process; answers are applied as amendments, not rebuilds.

## Current Goal

Build the units in `specs/00-build-plan.md` order. **Unit 09 (individual ranking and big-screen ranking) is built; the next unit to approve and build is Unit 10 (judge supervision and single-student restart).** Each unit needs its own spec approved (its header must read `APPROVED`) before code is written for it.

## What's Built

| Unit | Status | Notes |
|---|---|---|
| 01 Foundation | **Done** | Repository, Docker/Compose, CI (lint/typecheck/test/build), backend + frontend skeletons, Prisma schema + `0_init` migration, health check, first Jest tests, EN/ZH i18n scaffold. Acceptance criteria 1 and 3 verified live under Docker 2026-10-02. |
| 02 Authentication and accounts | **Done** (2026-10-02) | Backend `modules/identity` (role-separated login/logout, bcrypt, 24h-from-login session, one-active-device takeover, generic 401), `requireAuth` middleware, platform-written CORS, Socket.io handshake auth, frontend `features/auth` session store. Migration `20261002000000_add_account_session_expires_at` applied live. |
| 03 Competition setup and lifecycle | **Done** (2026-10-02) | Backend `modules/competition` (create with the fixed 2-stage × 2-round structure, the four-condition publish readiness check, publish → `PUBLISHED`→`WAITING`, the structure lock, controller-only access) and the frontend `features/competition` creation/publish screen. No schema change (tokens come from the schema's `@default(uuid())`). |
| 06 Judges and ranges | **Done** (2026-10-04) | Backend `modules/identity` (judge list CRUD with one-time credentials, range assignment editable anytime per BLD-008, ROL-010 removal guard, the exported authority-scoping check Unit 10 will call) and frontend `features/judge` (JudgeManagementPage, JudgeRangeAssignmentPanel on the competition setup screen, JudgeLandingPage). No schema change. |
| 07 Round runtime and autosave | **Done** (2026-10-04) | Backend `modules/round` (server-authoritative timer in Redis with deadline-epoch-ms as truth, preparation → active → paused → resumed transitions, dev-only `start-stage1-round1` trigger) + `modules/gameplay` (participant-scoped autosave, reconnect state read with questions + saved grids + timer snapshot, solution column never sent). Realtime `/player` namespace pushes `round:preparation-tick` / `round:started` / `round:timer-sync` / `round:paused` / `round:resumed`. Frontend `features/player` (round-runtime page mirroring server state) + `features/gameplay` (landscape-gated active round with grid, number pad, debounced autosave). No schema change. |
| 08 Submission, answer check and scoring | **Done** (2026-10-05) | Backend `modules/scoring` (pure scoring rules — `gridsEqual`, `computeEarlyBonus` per SCR-008–SCR-011 — plus `finalizeAttempt` writing Attempt + Answer + IndividualRoundResult idempotently) and additive extensions to `modules/gameplay` (`POST /:roundId/submit`, `finalizeParticipation`, `handleRoundEnded` for auto-submit on timer expiry, `advanceAfterRoundFinalized` for INDIVIDUAL-stage round advance). Composition root wires the round-ended listener with a once-per-process guard. Frontend `features/gameplay` gains a submit button + confirmation dialog naming blank-puzzle count + read-only "submission accepted" view; `features/player` carries the new `participationState` field through. The score is never sent to the player (SUB-007/BLD-029); a late submit is recorded as TIMEOUT with no distinct message (SUB-003); a repeated submit is a no-op (PL-009). No schema change. |
| 09 Individual ranking and big-screen ranking | **Done** (2026-10-07) | Backend `modules/ranking` (recompute-on-read category ranking from finalized `IndividualRoundResult` rows, provisional + final `RankingSnapshot` with `isFinal` once every active participant finishes both Individual rounds, shared-rank "1224" ties via the single named `breakTie` seam — U-22's unconfirmed extension NOT implemented) and `modules/big-screen` (no-login token auth per BSC-001, per-competition rotation timer over `ScoringConfiguration.rankingCycleSeconds`, out-of-cycle push on a ranking update so the 2-second target U-58 is met, stop-on-last-disconnect). Gameplay fires the `individualResultFinalized` hook from `finalizeParticipation`; the realtime gateway authenticates `/big-screen` by `bigScreenLinkToken` (session namespaces keep session auth) and emits `ranking:update`. Frontend `features/big-screen` (receive-only leaderboard at `/big-screen/:token`, local pagination of server-sent rows — never computes a rank, invariant 8). Controller-only read `GET /api/competitions/:id/categories/:categoryId/ranking` (ROL-002); no score/rank to a player session (SUB-007/BLD-029). No schema change. |

No other feature code exists yet. The orchestrator module is still skeleton-only.

## In Progress

Nothing in flight. Unit 09 is built and verified; the next unit awaits its spec's approval.

- **Unit 09 completion note.** Built 2026-10-07: backend lint + typecheck + build clean, `tests/ranking.test.ts` written and **run green under Docker** (64/64 backend tests pass across all 8 suites, the 9 new ranking cases included), frontend lint + typecheck + build clean. No new migrations.
- **Unit 08 completion note.** Built 2026-10-05: backend lint + typecheck + build clean, `tests/scoring.test.ts` written and **run green under Docker** (55/55 backend tests pass across all 7 suites, the 13 new scoring cases included), frontend lint + typecheck + build clean. No new migrations.
- **Unit 07 completion note.** Built 2026-10-04: backend lint + typecheck clean, `tests/round.test.ts` written and **run green under Docker** (42/42 backend tests pass across all 6 suites, the 10 new round cases included), frontend lint + typecheck + build clean. No new migrations. Local PostgreSQL 18 Windows service was stopped so Docker's postgres could own host `localhost:5432` for the test run (user-approved).
- **Unit 03 scope decision (flag for spec reconciliation).** The spec's Context says the 2×2 structure is auto-created "for every category", but its own Goal, Acceptance Criteria and the approved `data-model.md` place the two stages on the **competition** (shared across categories). Implemented per the schema/data model — two stages per competition, not per category. The spec's Context wording is the outlier and should be reconciled.

## Next Up (recommended order)

**`05` → `10` → `11` → `12` → `13` → `14` → `15`**, with **`04`** slotted in whenever the rest of **U-01** resolves (a real participant file with data, a past results sheet). (`02`, `03`, `06`, `07`, `08` and `09` are done.)

Before starting any unit: get the project owner's explicit approval and make sure that unit's spec header reads `APPROVED`. **Units 05 and 10–15 are all drafted but not yet approved.** Unit 05's spec flags two findings needing the project owner's confirmation before it's built: (1) a category can have several `QuestionSet`s (one per imported file/variant), not just one as `data-model.md`'s prose implied; (2) the irregular ("不规则") variant's import is explicitly out of scope — its region shapes aren't extractable from the current file format, a narrower, new gap than U-94.

## Blocked

**Nothing blocks the units being built.** The coding gate is passed.

- **Unit 04 (participant import) is blocked with no spec** — waits on the stakeholder, not the team: **U-01**, a real participant file with data rows and a past results sheet, neither sent (confirmed still unavailable, 2026-10-07). Do not start or guess it. `specs/00-build-plan.md`'s "Units that cannot be specified until an open item is answered" table is authoritative.
- **Unit 05 (question import) is no longer blocked** (2026-10-07: BLD-041/BLD-042/BLD-043 resolved its three open items) and now has a drafted spec, awaiting approval — see Next Up for the two findings it flags.

## Open Questions

**Authoritative list: `context-feeders/decisions/unmade-decisions.md`** (open items live there; resolved ones move to `project-decisions.md`). Non-blocking items in flight:

- **U-01** — real sample files partly received 2026-10-07 (`context/samples/`): a participant-file column template (no data rows) and 12 real question files across 3 grade groups. Stakeholder confirmed 2026-10-07 there's currently no real participant data or past results sheet to send — still blocks Unit 04 only. Reading the files raised six follow-up questions, **all now resolved**: **PAR-011** (no Team column, inferred from School+Category+flag), **PAR-012** (ignore the pre-filled participant number), **BLD-040** (question files are a pool — Unit 05 needs a new manual round-selection step), **BLD-041** (the grade-pair folders ARE the real category scheme — reverses the earlier BLD-027 answer, U6–U20), **BLD-042** (the audio column is ignored), and **BLD-043** (the given-cells/solution image problem, U-94 — a temporary OCR exception, explicitly not the target state). **Unit 05 is unblocked** — see Next Up.
- **U-40** — extra participant-Excel columns (Working Position: ignore unrecognized columns, PAR-008). Not blocking.
- **U-65 / U-66** — default visual style and screen layouts. **Timing fixed 2026-10-08 (UI-008):** no dedicated design pass before the MVP/event — current Tailwind-default screens ship as-is; the stakeholder's actual preference stays open to revisit after the event. Not blocking.
- **U-46** (remainder) — venue-network facts, deferred to closer to the event date. Not blocking.
- **B5** (`FILL-BEFORE-CODING.md`) — the two UI token tables (border radius, spacing scale). Needed only before the first UI/design unit.
- **C1 / C2** (`FILL-BEFORE-CODING.md`) — where the event-day server runs; the missing CI automated-review step. Needed before a real deployment, not before coding.

## Known Issues

- **New schema drift, found 2026-10-07, not yet fixed in code.** `data-model.md` now makes `Question.roundId` nullable (BLD-040, resolves U-100 — a question file is a pool, a question is assigned to an Individual round by a new manual controller step, not at import). `backend/prisma/schema.prisma` still has `roundId` required — needs a migration before Unit 05 is built. **Also pending:** Unit 09's live `breakTie` function (and the as-yet-unbuilt Unit 15) need updating for **SCR-020** (resolves U-22, confirmed 2026-10-07): a tie breaks by summed submission time (both rounds for an individual, all counted players for a school), not shared rank. Both are context-folder changes already made; the code hasn't caught up yet.
- **Schema drift vs. the approved data model (found and fixed 2026-10-02).** `backend/prisma/schema.prisma` had diverged from the approved `data-model.md` on two points: (1) `RoundSettings` was missing the partition-round fields `partitionPuzzleCount` / `partitionTotalTimeSeconds` / `partitionPointsPerPuzzle` (defaults 3 / 1800 / 20), added to the data model by the 2026-10-01 amendment; (2) `QuestionSet.categoryId` was nullable in the schema but required in the approved data model (BLD-028 resolved U-32). Both were reconciled to the data model and applied live via migration `20261002081521_add_partition_round_settings_and_required_question_set_category` (purely additive + a NOT NULL tightening). Backend typecheck clean, 13/13 tests pass.
- The module list and schema (I-01) predate the stakeholder's answers. **Both parts are now closed**: the data-model part 2026-09-30 (A6), the module-list part 2026-10-01 (BLD-032, ten modules — see `architecture.md`, "System boundaries").
- Question delivery differs from the client's original document, which preloads questions on the tablets (BLD-006: fetch at the round start).
- ID to verify against the register: U-47.

## Architecture Decisions

React + TypeScript + Vite + Tailwind CSS; Node.js + TypeScript + Express.js; PostgreSQL 16 + Redis 7 (persistence on); Prisma (schema is the single source of truth, migrations versioned); Jest; Docker with Docker Compose, a Dockerfile per service; module-first backend folder structure; WebSocket (Socket.io); modular monolith, server authority; files on the server's disk [C]; questions fetched at the round start [C]; replay acceptable after a restart, competition returns paused [C]; one role per account [C]; generic grid model [C]. Full detail: `architecture.md`.

## Current Architecture State

- **Backend:** module-first (BLD-020) under `backend/src/modules/` — `identity` (with judge list and range assignment from Unit 06), `competition`, `round` (timer + preparation, Unit 07), `gameplay` (autosave + reconnect state + submit, Units 07/08), `scoring` (Unit 08), `ranking` (Unit 09) and `big-screen` (Unit 09) exist (the rest are skeletons) — plus `realtime/` (gateway wires the round lifecycle events to `/player` and the big-screen ranking pushes to `/big-screen`, the latter gated by the no-login `bigScreenLinkToken`), `infra/`, `shared/` (errors, middleware, validation, i18n, clock), `config/`, `prisma/`.
- **Frontend:** Vite + React + TypeScript + Tailwind (BLD-023), with `features/auth`, `features/competition`, `features/judge`, `features/player`, `features/gameplay` and `features/big-screen` implemented and the other feature folders as placeholders; EN/ZH i18n scaffold.
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass in both services; the whole stack runs under Docker Compose.

## Current Database State

**Live and verified (2026-10-02).** Docker Desktop 29.8.1 installed, engine running (hardware virtualization enabled in firmware by the user). `docker compose up` builds and starts all four services; PostgreSQL 16 and Redis 7 healthy; the backend applies migrations via `prisma migrate deploy`; the health check returns `200 {"status":"ok","dependencies":{"database":"up","redis":"up"}}`; the frontend responds on `:5173`. Migrations applied: `0_init`, `20261002000000_add_account_session_expires_at`, `20261002081521_add_partition_round_settings_and_required_question_set_category`. All 30 tables exist in the live `sudoku` database.

## Session Notes

- Assume nothing. Anything marked **TBD — to be decided by the project owner** stays blank until the project owner decides.
- Answers are recorded directly in `context-feeders/decisions/` (resolved → `project-decisions.md`, still-open → `unmade-decisions.md`), then reflected into `context/`. `context-feeders/working/` was removed 2026-10-01.
- From 2026-10-01, `context-feeders/decisions/unmade-decisions.md` is edited directly at the project owner's request: once a decision is written into `context/` and verified, its row is removed there. `project-decisions.md` and `context-feeders/archive/` are not edited.
- **Environment gotchas for DB-touching work:** two PostgreSQL servers bind host `localhost:5432` (a native Windows service and Docker's proxy), so run DB commands inside the Compose network (`postgres:5432`); and `tsx watch` does not see file changes across the Windows bind mount, so restart the backend container after a code change.
- **Windows:** Node/npm must be invoked via `cmd //c "..."` from this shell.

## Context change log

**Full log: [`progress-tracker-history.md`](progress-tracker-history.md), "Context change log".** Recent entries only:

- 2026-10-07: **Unit 09 (Individual ranking and big-screen ranking) built and verified** — backend `modules/ranking` (recompute-on-read, provisional + final `RankingSnapshot`, shared-rank "1224" ties via the `breakTie` seam, U-22 extension not implemented) + `modules/big-screen` (token auth BSC-001, per-competition rotation over `rankingCycleSeconds`, out-of-cycle push on a ranking update for the U-58 2-second target), gameplay fires the `individualResultFinalized` hook, gateway authenticates `/big-screen` by `bigScreenLinkToken` and emits `ranking:update`, frontend `features/big-screen` (receive-only, never computes, invariant 8). 64/64 backend tests pass (9 new in `tests/ranking.test.ts`); both builds clean. No schema change. Files touched: `backend/src/modules/{ranking,big-screen}/*` (new), `backend/src/modules/gameplay/*` (hook), `backend/src/{routes.ts,app.ts}`, `backend/src/realtime/{events.ts,gateway.ts}`, `backend/src/shared/i18n/{en,zh}.ts`, `backend/tests/ranking.test.ts`, `frontend/src/features/big-screen/*` (new), `frontend/src/App.tsx`, `frontend/src/i18n/{en,zh}.ts`, `context/specs/09-individual-ranking-and-big-screen-ranking.md`, `context/progress-tracker.md`.

- 2026-10-04: **Unit 07 (Round runtime and autosave) built and verified** — backend `modules/round` (timer service with Redis-persisted deadlines + hook-based round transitions) + `modules/gameplay` (autosave + reconnect state), realtime `/player` events wired, frontend `features/player` + `features/gameplay`. 42/42 backend tests pass (10 new in `tests/round.test.ts`); both builds clean. No schema change. Local `postgresql-x64-18` Windows service stopped (user-approved) so Docker postgres could own host `localhost:5432`. Files touched: `backend/src/modules/{round,gameplay}/*`, `backend/src/realtime/{events.ts,gateway.ts}`, `backend/src/routes.ts`, `backend/src/shared/i18n/{en,zh}.ts`, `backend/tests/round.test.ts`, `frontend/src/features/{player,gameplay}/*` (new), `frontend/src/App.tsx`, `frontend/src/i18n/{en,zh}.ts`, `frontend/package.json` (added `socket.io-client`), `context/specs/07-round-runtime-and-autosave.md`, `context/progress-tracker.md`.

- 2026-10-02: **Unit 03 built and verified** — backend `modules/competition` + frontend `features/competition`, no schema change. Backend 22/22 tests, frontend 10/10 tests, both builds clean. `progress-tracker.md` updated (Unit 03 → Done; next unit 06). Files touched: `backend/src/modules/competition/*`, `backend/src/shared/errors/app-error.ts`, `backend/src/shared/i18n/{en,zh}.ts`, `backend/src/routes.ts`, `backend/tests/competition.test.ts`, `backend/prisma/seed-test-competition.ts`, `frontend/src/features/competition/*`, `frontend/src/App.tsx`, `frontend/src/i18n/{en,zh}.ts`, `frontend/tests/competition-setup.test.tsx`, `context/progress-tracker.md`.

- 2026-10-02: `progress-tracker.md` restructured into this living current-state document; the three chronological logs moved verbatim to `progress-tracker-history.md`. No information deleted. Files touched: `context/progress-tracker.md`, `context/progress-tracker-history.md`. Directed by the project owner.
- 2026-10-02: **schema drift fixed** — `RoundSettings` gained `partitionPuzzleCount`/`partitionTotalTimeSeconds`/`partitionPointsPerPuzzle` (defaults 3/1800/20, TEM-006–008) and `QuestionSet.categoryId` was made required (BLD-028), matching the approved `data-model.md`. Migration `20261002081521_add_partition_round_settings_and_required_question_set_category` applied live. Files touched: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261002081521_…`, `context/progress-tracker.md`.
- 2026-10-02: two governance rules added to the root `CLAUDE.md` — `progress-tracker.md` is a living current-state document (replace, don't append; history goes to `progress-tracker-history.md`), and every concerned document (including the data model's concrete form, `schema.prisma` + migrations) must be brought up to date behind a concluded decision. Files touched: `CLAUDE.md`.
- 2026-10-02: **Unit 03 spec approved and finalized** — header flipped to `APPROVED (2026-10-02)`; `durationSeconds` values stated (Individual 1200/1800, Team 1800/1800, all controller-editable); publish wording aligned to the schema's `@default(uuid())` tokens. Files touched: `context/specs/03-competition-setup-and-lifecycle.md`, `context/progress-tracker.md`. Approved by the project owner 2026-10-02.
