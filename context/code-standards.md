# Code Standards (DRAFT v1 SKELETON, 2026-09-26)

> **Partly written.** The backend language and framework are decided: **Node.js with TypeScript, Express.js** [T] (I-02, 2026-09-27). The ORM and migration tool is decided: **Prisma** [T] (I-31, 2026-09-29). The test framework is decided: **Jest** [T] (I-32, 2026-09-29). The frontend build tool is decided: **Vite** [T] (BLD-023, 2026-09-30). The styling approach is decided: **Tailwind CSS** [T] (BLD-023, 2026-09-30). The API, the routing/state/data-fetching conventions and the remaining testing conventions are still to be written on top of the decided stack.
> This file holds only what is already decided or comes from the agreed methodology. Everything else is marked OPEN. Do not invent conventions.
> Status tags: [T] team decision · [O] open. See `README.md`.

## General

- Keep modules small and single-purpose. Fix root causes; do not layer workarounds.
- Do not mix unrelated concerns in one module or route.
- Follow the existing architecture; reuse existing components before creating new ones; do not introduce new patterns without justification.
- Respect the boundaries and invariants in `architecture.md`. If following a rule seems to require violating one, stop and report the conflict.
- Every technical decision must be explainable by the team. Do not add a technology because it is popular or because an AI recommended it.

## Language

- **Frontend:** TypeScript [T] (ARCH-020).
- **Backend:** Node.js with TypeScript [T] (I-02).
- Validate unknown external input at system boundaries before trusting it (the client is never trusted [T]).

## Framework / library

- **Frontend:** React [T]. The **build tool is Vite** [T] (BLD-023, decided 2026-09-30) — the frontend is a Vite project (React with TypeScript); `npm run build` runs Vite's production build and the dev server is Vite's. **Styling is Tailwind CSS** [T] (BLD-023, decided 2026-09-30) — utility-first classes, configured through `tailwind.config` and a global stylesheet; do not introduce a second styling system. Project conventions (routing, state, data fetching): **OPEN**.
- **Backend framework:** Express.js [T] (I-02).
- **ORM and migrations:** **Prisma** [T] (I-31, decided 2026-09-29) — the ORM for the PostgreSQL schema and the migration system. Migrations are versioned in the repository and applied in CI and on deployment; the schema is the single source of truth for the database. Do not write raw SQL migrations by hand.
- **UI component library, icons, fonts:** **Resolved 2026-10-01** [T] (BLD-035, I-20): **Headless UI** (unstyled, accessible interactive components) + **Heroicons** (icon set), both built by the Tailwind team, pairing natively with the decided styling approach (Tailwind CSS, BLD-023). Fonts are decided (U-70). The visual design (colors, layout) comes after the first slice [C] (BLD-009).

## Error handling

- Never swallow errors silently. Log failures with enough context to diagnose.
- Error shape and messages: **OPEN.** User-facing messages must exist in both English and Chinese [C]/[T] (ARCH-026).

## Naming conventions

- Name things after the responsibility they contain, not the technology used. Use the module names in `architecture.md` for module and folder names.
- **Casing** (TypeScript, both ends) [T] (I-33, decided 2026-09-29): `camelCase` for variables and functions; `PascalCase` for types, classes, interfaces and React components; `UPPER_SNAKE_CASE` for true constants. Files and folders follow the module and feature names in `architecture.md`.

## API conventions

**OPEN.** The API contract is a "Working Position", explicitly a starting point and not final (ARCH-023). Real-time uses WebSocket [T]. Handler order of operations (validate input, then enforce auth and ownership, then run logic, then respond) and response shape: **OPEN.**
Decided behaviour that affects the API: separate login endpoints per role [T]; a repeated submission never changes the result [C].

## Testing

CI runs lint, type check, tests and build, and must pass before a merge [C] (BLD-002). **Test framework: Jest** [T] (I-32, decided 2026-09-29) — one runner for both the frontend (React) and the backend (Node.js with TypeScript, through `ts-jest`); it runs in the CI pipeline of BLD-002. **Coverage rules: OPEN**, to be written with the first unit. **Scope** [T] (2026-09-29): keep the tests to the necessary minimum for the MVP — cover what the event depends on, do not go deep. Documented: a failure and edge-case test list [T]: disconnect and reconnect, timer expiry, manual and duplicate submission, pause and resume, early round end, early finish, many players at once, team scoring, tie-breaks, big-screen synchronization, invalid participant or question file (REQUIREMENTS §13). Extended cases still to add: rematch, takeover, corrections, several categories, the 15-day purge.

## Comments

- Write comments that explain **why**, not what. Do not leave commented-out code in commits.

## Dependencies

- Do not add a dependency without justification. Prefer built-in or existing solutions. Evaluate maintenance status and size before adding a package. Ask before adding any major dependency.

## Data and storage

- Durable results belong in PostgreSQL, never only in Redis [T]. Redis holds runtime state [T].
- Question and round scores are stored as **integers**; the school total is an **exact decimal** (not floating point), neither rounded nor truncated [T].
- Do not store large files in the database. Files (participant Excel, question Excel, credential slips, exports) live on the server's disk, in a mounted folder, not in object storage [C] (BLD-001).
- The grid model is generic (rows, columns, regions); never assume 9x9 [C] (BLD-011). The answer check compares the submitted grid with the solution stored with the question [C] (BLD-010).
- Never delete scores or attempts on a restart or rematch; archive them [P].

## File organization

- Frontend by feature: `auth`, `competition`, `player`, `judge`, `admin`, `big-screen`, `ranking`, `gameplay` [T]. The frontend is a **Vite** project with **Tailwind CSS** [T] (BLD-023): feature folders live under `frontend/src/features/<feature>/`, with the app entry and router in `frontend/src/`, the Tailwind entry stylesheet in `frontend/src/`, and `frontend/tailwind.config.js` + `frontend/vite.config.ts` at the frontend root.
- Backend: **module-first** [T] (I-02, decided 2026-09-30; see `architecture.md`, "Backend folder structure"). One folder per module under `backend/src/modules/` (the modules in `architecture.md`), each holding `<name>.controller.ts` (HTTP), `<name>.service.ts` (domain rules and the public interface), `<name>.repository.ts` (Prisma access), `<name>.types.ts` and `index.ts` (barrel exposing only the public interface). Around the modules: `realtime/` (the Socket.io gateway, event constants and per-module handlers), `infra/` (Prisma, Redis, the disk file store, the logger), `shared/` (errors, middleware, validation, i18n, clock), `config/` and `prisma/`. The repository root stays `backend/`, `frontend/`, `docker-compose.yml`.

## Forbidden / restricted practices

- Do not trust the client for time, validity, score, rank or eligibility [T].
- Do not run scoring from autosave [T].
- Do not compute rankings on the big screen [T].
- Do not commit secrets, keys or credentials to the repository.
- Do not bypass authentication for any endpoint.
- Do not implement anything tagged [O]/OPEN, and do not present a [T] decision as client-confirmed.
- If a situation seems to make violating one of these the easiest solution, stop and report the conflict.
