# Progress Tracker

**This is a living document: it describes the current state of the project, not the history.**
It answers four questions at a glance — what is being built now, what is done, what is next, and what is blocked.
Update it after every meaningful change. Keep it short: replace stale lines instead of appending new ones.

**History is not lost — it lives in [`progress-tracker-history.md`](progress-tracker-history.md).** The three chronological logs that used to sit in this file (the full "Completed" log, the full "Context change log" and the full "Last Updated" log) were moved there verbatim on 2026-10-02. When you add a dated entry, append it to the matching section at the bottom of the history file; keep only the current state here.

Last updated: **2026-10-02**.

---

## Current Phase

**Building.** The coding gate passed 2026-09-30 (no `FILL-BEFORE-CODING` blank remains; section E approved) and the project owner gave the explicit go-ahead 2026-10-01. Requirements are still refined in parallel through the stakeholder process; answers are applied as amendments, not rebuilds.

## Current Goal

Build the units in `specs/00-build-plan.md` order. **Unit 3 (Competition setup and lifecycle) is built; the next unit to approve and build is Unit 06 (judges and ranges).** Each unit needs its own spec approved (its header must read `APPROVED`) before code is written for it.

## What's Built

| Unit | Status | Notes |
|---|---|---|
| 01 Foundation | **Done** | Repository, Docker/Compose, CI (lint/typecheck/test/build), backend + frontend skeletons, Prisma schema + `0_init` migration, health check, first Jest tests, EN/ZH i18n scaffold. Acceptance criteria 1 and 3 verified live under Docker 2026-10-02. |
| 02 Authentication and accounts | **Done** (2026-10-02) | Backend `modules/identity` (role-separated login/logout, bcrypt, 24h-from-login session, one-active-device takeover, generic 401), `requireAuth` middleware, platform-written CORS, Socket.io handshake auth, frontend `features/auth` session store. Migration `20261002000000_add_account_session_expires_at` applied live. |
| 03 Competition setup and lifecycle | **Done** (2026-10-02) | Backend `modules/competition` (create with the fixed 2-stage × 2-round structure, the four-condition publish readiness check, publish → `PUBLISHED`→`WAITING`, the structure lock, controller-only access) and the frontend `features/competition` creation/publish screen. No schema change (tokens come from the schema's `@default(uuid())`). See "In Progress" note below. |

No other feature code exists yet. The realtime gateway and the other feature modules are still skeleton-only.

## In Progress

Nothing in flight. Unit 03 is complete and verified; the next unit awaits its spec's approval.

- **Unit 03 completion note.** Verified 2026-10-02: backend lint + typecheck clean, 22/22 backend tests pass (9 new in `tests/competition.test.ts`), frontend lint + typecheck + build clean, 10/10 frontend tests pass (3 new in `tests/competition-setup.test.tsx`). Live stack under Docker serves the new endpoints after a backend restart. A scratch seed (`backend/prisma/seed-test-competition.ts`) seeds participant/question/judge data for the readiness check — dev tooling only, not wired into any user-facing flow.
- **Unit 03 scope decision (flag for spec reconciliation).** The spec's Context says the 2×2 structure is auto-created "for every category", but its own Goal, Acceptance Criteria and the approved `data-model.md` place the two stages on the **competition** (shared across categories). Implemented per the schema/data model — two stages per competition, not per category. The spec's Context wording is the outlier and should be reconciled.

## Next Up (recommended order)

**`03` → `06` → `07` → `08` → `09` → `10` → `11` → `12` → `13` → `14` → `15`**, with **`04` and `05`** slotted in whenever **U-01 / U-94** resolve. (`02` and `03` are done.)

Before starting any unit: get the project owner's explicit approval and make sure that unit's spec header reads `APPROVED`. Units 06–15 are drafted but **not yet approved**.

## Blocked

**Nothing blocks the units being built.** The coding gate is passed.

- **Units 04 (participant import) and 05 (question import) are blocked with no spec** — they wait on the stakeholder, not the team: **U-01** (the real sample participant Excel and a past results sheet, never sent) and **U-94** (whether production question files can supply the puzzle's given cells as text, not just an embedded picture). Do not start or guess these. `specs/00-build-plan.md`'s "Units that cannot be specified until an open item is answered" table is authoritative.

## Open Questions

**Authoritative list: `context-feeders/decisions/unmade-decisions.md`** (open items live there; resolved ones move to `project-decisions.md`). Non-blocking items in flight:

- **U-01 / U-94** — sample participant Excel / past results sheet; the given-cells-as-text format. Block Units 04/05 only.
- **U-22** — ranking tie-break's submission-time extension (core rule resolved as a Working Position, SCR-017). Not blocking.
- **U-40** — extra participant-Excel columns (Working Position: ignore unrecognized columns, PAR-008). Not blocking.
- **U-65 / U-66** — default visual style and screen layouts, deferred to the design phase (BLD-009). Not blocking.
- **U-46** (remainder) — venue-network facts, deferred to closer to the event date. Not blocking.
- **U-96** — a measurable business-goal metric. Informational only.
- **B5** (`FILL-BEFORE-CODING.md`) — the two UI token tables (border radius, spacing scale). Needed only before the first UI/design unit.
- **C1 / C2** (`FILL-BEFORE-CODING.md`) — where the event-day server runs; the missing CI automated-review step. Needed before a real deployment, not before coding.

## Known Issues

- **Schema drift vs. the approved data model (found and fixed 2026-10-02).** `backend/prisma/schema.prisma` had diverged from the approved `data-model.md` on two points: (1) `RoundSettings` was missing the partition-round fields `partitionPuzzleCount` / `partitionTotalTimeSeconds` / `partitionPointsPerPuzzle` (defaults 3 / 1800 / 20), added to the data model by the 2026-10-01 amendment; (2) `QuestionSet.categoryId` was nullable in the schema but required in the approved data model (BLD-028 resolved U-32). Both were reconciled to the data model and applied live via migration `20261002081521_add_partition_round_settings_and_required_question_set_category` (purely additive + a NOT NULL tightening). Backend typecheck clean, 13/13 tests pass.
- The module list and schema (I-01) predate the stakeholder's answers. **Both parts are now closed**: the data-model part 2026-09-30 (A6), the module-list part 2026-10-01 (BLD-032, ten modules — see `architecture.md`, "System boundaries").
- Question delivery differs from the client's original document, which preloads questions on the tablets (BLD-006: fetch at the round start).
- ID to verify against the register: U-47.

## Architecture Decisions

React + TypeScript + Vite + Tailwind CSS; Node.js + TypeScript + Express.js; PostgreSQL 16 + Redis 7 (persistence on); Prisma (schema is the single source of truth, migrations versioned); Jest; Docker with Docker Compose, a Dockerfile per service; module-first backend folder structure; WebSocket (Socket.io); modular monolith, server authority; files on the server's disk [C]; questions fetched at the round start [C]; replay acceptable after a restart, competition returns paused [C]; one role per account [C]; generic grid model [C]. Full detail: `architecture.md`.

## Current Architecture State

- **Backend:** module-first (BLD-020) under `backend/src/modules/` — `identity` and `competition` exist (the rest are skeletons) — plus `realtime/`, `infra/`, `shared/` (errors, middleware, validation, i18n, clock), `config/`, `prisma/`.
- **Frontend:** Vite + React + TypeScript + Tailwind (BLD-023), with `features/auth` and `features/competition` implemented and the other feature folders as placeholders; EN/ZH i18n scaffold.
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

- 2026-10-02: **Unit 03 built and verified** — backend `modules/competition` + frontend `features/competition`, no schema change. Backend 22/22 tests, frontend 10/10 tests, both builds clean. `progress-tracker.md` updated (Unit 03 → Done; next unit 06). Files touched: `backend/src/modules/competition/*`, `backend/src/shared/errors/app-error.ts`, `backend/src/shared/i18n/{en,zh}.ts`, `backend/src/routes.ts`, `backend/tests/competition.test.ts`, `backend/prisma/seed-test-competition.ts`, `frontend/src/features/competition/*`, `frontend/src/App.tsx`, `frontend/src/i18n/{en,zh}.ts`, `frontend/tests/competition-setup.test.tsx`, `context/progress-tracker.md`.

- 2026-10-02: `progress-tracker.md` restructured into this living current-state document; the three chronological logs moved verbatim to `progress-tracker-history.md`. No information deleted. Files touched: `context/progress-tracker.md`, `context/progress-tracker-history.md`. Directed by the project owner.
- 2026-10-02: **schema drift fixed** — `RoundSettings` gained `partitionPuzzleCount`/`partitionTotalTimeSeconds`/`partitionPointsPerPuzzle` (defaults 3/1800/20, TEM-006–008) and `QuestionSet.categoryId` was made required (BLD-028), matching the approved `data-model.md`. Migration `20261002081521_add_partition_round_settings_and_required_question_set_category` applied live. Files touched: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261002081521_…`, `context/progress-tracker.md`.
- 2026-10-02: two governance rules added to the root `CLAUDE.md` — `progress-tracker.md` is a living current-state document (replace, don't append; history goes to `progress-tracker-history.md`), and every concerned document (including the data model's concrete form, `schema.prisma` + migrations) must be brought up to date behind a concluded decision. Files touched: `CLAUDE.md`.
- 2026-10-02: **Unit 03 spec approved and finalized** — header flipped to `APPROVED (2026-10-02)`; `durationSeconds` values stated (Individual 1200/1800, Team 1800/1800, all controller-editable); publish wording aligned to the schema's `@default(uuid())` tokens. Files touched: `context/specs/03-competition-setup-and-lifecycle.md`, `context/progress-tracker.md`. Approved by the project owner 2026-10-02.
