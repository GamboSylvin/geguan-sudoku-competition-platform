# Unit 01: Foundation — APPROVED (2026-09-30)

> **Approved Unit 1 spec.** Approved 2026-09-30 by the team / project owner (checklist item A7, section E of `FILL-BEFORE-CODING.md`), together with the build plan (`00-build-plan.md`).
> This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [O] open. See `../README.md`.
> **No blocking blank remains for this unit:** the backend **folder structure** was decided 2026-09-30 (I-02, module-first; see `../architecture.md`, "Backend folder structure").

## Goal

The foundation only, with **no feature**: a repository the two developers can clone and run with one command, a reproducible containerized environment, a CI pipeline that blocks a merge on failure, the backend and frontend skeletons, the Prisma schema initialized with its first migration, a health check, a first passing Jest test, and the English/Chinese internationalization scaffold planned in from the start.

Goal in one testable sentence: **on a fresh clone, `docker compose up` starts the backend, the frontend, PostgreSQL and Redis, the backend health check responds, the first Prisma migration applies, and CI (lint, type check, test, build) is green.**

## Context

- The stack decided so far: React with TypeScript, PostgreSQL, Redis (persistence on), WebSocket, a modular monolith [T]; the backend language and framework: Node.js with TypeScript, Express.js [T] (I-02, decided 2026-09-27; see `../architecture.md`).
- Environment (I-24, decided 2026-09-29): **Docker with Docker Compose**, a **Dockerfile per service** (backend, frontend); PostgreSQL 16 and Redis 7 as Compose services; **npm** with `package-lock.json` committed; versions pinned; `.env.example` committed, the real `.env` git-ignored. The same containers are used in development and deployment.
- ORM and migrations (I-31, decided 2026-09-29): **Prisma**; the Prisma schema is the single source of truth for the PostgreSQL schema; migrations are versioned in the repository and applied in CI and on deployment.
- Test framework (I-32, decided 2026-09-29): **Jest** (through `ts-jest`), one runner for the frontend and the backend, in the CI pipeline.
- Casing (I-33, decided 2026-09-29): `camelCase` variables and functions, `PascalCase` types/classes/components, `UPPER_SNAKE_CASE` constants (see `../code-standards.md`).
- Frontend build tool and styling (BLD-023, decided 2026-09-30): **Vite** (the React + TypeScript app is a Vite project; `npm run build` is Vite's production build) and **Tailwind CSS** (utility-first styling, configured through `tailwind.config.js` and a global stylesheet). See `../code-standards.md`, Framework/library and File organization.
- Workflow already decided [C] (BLD-002): one branch per unit; a pull request before every merge; lint, type check, tests and build in CI must pass before a merge; the other developer reviews each pull request.
- The first slice is the Individual stage, end to end [C] (BLD-009). This unit delivers none of it; it is the base the next units build on.
- What already exists before this unit: nothing is built.

## Implementation Details

The methodology's pre-code checklist lists these artifacts. Each is produced in this unit:

1. **Repository skeleton:** folders by module and by feature (see `../architecture.md`, System boundaries, and "Backend folder structure"). The backend folder structure is decided (I-02, 2026-09-30): **module-first** — `backend/src/modules/<module>/` (one folder per module, each with controller, service, repository, types and barrel), plus `realtime/`, `infra/`, `shared/`, `config/` and `prisma/`. The frontend folders by feature are decided (`auth`, `competition`, `player`, `judge`, `admin`, `big-screen`, `ranking`, `gameplay`).
2. **Reproducible development environment** (I-24): **npm with `package-lock.json` committed**; `.env.example` listing every required variable with placeholder values (the real `.env` git-ignored); **Docker with Docker Compose and a Dockerfile per service**; PostgreSQL 16 and Redis 7 as Compose services with a named volume for PostgreSQL and persistence on for Redis; Node.js LTS pinned. The frontend service is a **Vite** dev server (BLD-023).
3. **CI pipeline:** lint, type check, tests and build — **the four checks of BLD-002 run in CI and must pass before a merge**; the test step runs **Jest** (I-32); the pipeline runs against the Compose services (or service containers) for PostgreSQL and Redis.
4. **Git setup:** branch and pull-request rules as decided [C] (BLD-002) — one branch per unit, a pull request before every merge, the other developer reviews each pull request; a PR template and the CI checks configured as required status checks.
5. **Translation mechanism for English and Chinese** planned in from the start [C] (ARCH-026): set up the i18n scaffold here (locale files, a translation function, the language switch hook), with **English and Chinese as the only locales**; the actual strings come with each screen. Any third language is OPEN (U-51) and is **not** set up.
6. **Project skeleton** for the backend and the frontend: empty modules and feature folders, a **health-check** endpoint on the backend, **the Prisma schema initialized and its first migration applied** (I-31), and **a first passing test in Jest** (I-32). The skeleton contains **no feature code**.

### Inputs

- The decided stack and environment (I-02, I-24, I-31, I-32, I-33) as above.
- The backend folder structure — decided 2026-09-30 (I-02): module-first; see `../architecture.md`, "Backend folder structure".
- The module boundaries in `../architecture.md` (the module list is provisional, I-01).

### Expected Behavior

- `docker compose up` (or the decided equivalent) starts the backend, the frontend, PostgreSQL and Redis.
- The backend health check responds and reports the database and Redis connection status.
- The first Prisma migration applies on a fresh database.
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` succeed locally and in CI.
- The frontend builds and serves a placeholder page through the i18n scaffold.

### Components Involved

- **Infrastructure:** `docker-compose.yml`, a Dockerfile per service, `.env.example`, the pinned versions.
- **Backend skeleton:** the Express.js app entry, the health-check route, the empty module folders, the Prisma schema and the first migration.
- **Frontend skeleton:** the React app entry (a **Vite** project, BLD-023), the empty feature folders, **Tailwind CSS** configured (BLD-023), the i18n scaffold, a placeholder route.
- **CI:** the pipeline definition with the four checks of BLD-002.

### Error Cases

- A missing required environment variable fails fast with a clear message (no silent defaults for secrets).
- The health check reports a failed database or Redis connection instead of returning healthy.
- CI fails the merge on any of lint, type check, test or build.

### Security Considerations

- No secrets in the repository; `.env` is git-ignored, `.env.example` holds placeholders only (BLD-002 / code-standards "Forbidden practices").
- The client is never trusted: this unit sets up the boundary only, no auth yet (authentication is Unit 02).

### Constraints

- **No feature code.** No competition, participant, question, runtime, scoring or ranking behaviour.
- No invented conventions: use `../code-standards.md` (the stack is decided: Node.js with TypeScript, Express.js, Prisma, Jest, Docker).
- Nothing tagged [O] or OPEN in the context files may be implemented.

### Implementation Notes

- The i18n scaffold sets up the mechanism only; it does not pre-translate screens that do not exist yet.
- The Prisma schema in this unit is the initial structure from `../data-model.md`; it is created here so migrations start from the first unit. Any field marked OPEN in `data-model.md` is **not** created.

### Related Features

- Every later unit depends on this one (Units 02–14 in `00-build-plan.md`).

## Acceptance Criteria

1. On a fresh clone, `docker compose up` starts the backend, the frontend, PostgreSQL 16 and Redis 7.
2. The backend health check responds and reports the database and Redis connection status; a failed connection is reported, not hidden.
3. The Prisma schema is initialized and its first migration applies on a fresh database.
4. Lint, type check, tests and build pass in CI on a fresh clone, and the CI checks block a merge on failure (BLD-002).
5. The English/Chinese i18n scaffold is in place with English and Chinese as the only locales.
6. A first Jest test passes.

## Out of Scope

- Authentication, roles and login (Unit 02).
- Competition setup and the participant and question imports (Units 03–06).
- The competition engine (rounds, timers, autosave, submission, scoring, ranking) (Units 07–12).
- The team stage, the big screens, and any visual design (later slice, BLD-009).
- Any third language beyond English and Chinese (U-51, open).
