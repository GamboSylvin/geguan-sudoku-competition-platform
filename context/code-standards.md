# Code Standards (DRAFT v0 SKELETON, 2026-09-26)

> **Mostly blocked.** The backend language and framework are **TBD — to be decided by the project owner** (I-02), so language, framework, API and testing conventions cannot be written yet.
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
- **Backend:** **TBD — to be decided by the project owner** (I-02). [[FILL-BEFORE-CODING: backend language = ________ ; owner: project owner]] Do not write backend code or conventions until decided.
- Validate unknown external input at system boundaries before trusting it (the client is never trusted [T]).

## Framework / library

- **Frontend:** React [T]. Project conventions (routing, state, data fetching, styling): **OPEN**.
- **Backend framework:** **OPEN (I-02).** [[FILL-BEFORE-CODING: backend framework = ________ ; owner: project owner]]
- **UI component library, icons, fonts:** **OPEN (I-20).**

## Error handling

- Never swallow errors silently. Log failures with enough context to diagnose.
- Error shape and messages: **OPEN.** User-facing messages must exist in both English and Chinese [C]/[T] (ARCH-026).

## Naming conventions

- Name things after the responsibility they contain, not the technology used. Use the module names in `architecture.md` for module and folder names. Casing rules: **OPEN** until the language is chosen.

## API conventions

**OPEN.** The API contract is a "Working Position", explicitly a starting point and not final (ARCH-023). Real-time uses WebSocket [T]. Handler order of operations (validate input, then enforce auth and ownership, then run logic, then respond) and response shape: **OPEN.**
Decided behaviour that affects the API: separate login endpoints per role [T]; a repeated submission never changes the result [C].

## Testing

CI runs lint, type check, tests and build, and must pass before a merge [C] (BLD-002). Test framework and coverage rules: **OPEN** (depend on the backend language). Documented: a failure and edge-case test list [T]: disconnect and reconnect, timer expiry, manual and duplicate submission, pause and resume, early round end, early finish, many players at once, team scoring, tie-breaks, big-screen synchronization, invalid participant or question file (REQUIREMENTS §13). Extended cases still to add: rematch, takeover, corrections, several categories, the 15-day purge.

## Comments

- Write comments that explain **why**, not what. Do not leave commented-out code in commits.

## Dependencies

- Do not add a dependency without justification. Prefer built-in or existing solutions. Evaluate maintenance status and size before adding a package. Ask before adding any major dependency.

## Data and storage

- Durable results belong in PostgreSQL, never only in Redis [T]. Redis holds runtime state [T].
- Question and round scores are stored as **integers**; the school total is an **exact decimal** (not floating point), neither rounded nor truncated [T].
- Do not store large files in the database. Files (participant Excel, question PDF, credential slips, exports) live on the server's disk, in a mounted folder, not in object storage [C] (BLD-001).
- The grid model is generic (rows, columns, regions); never assume 9x9 [C] (BLD-011). The answer check compares the submitted grid with the solution stored with the question [C] (BLD-010).
- Never delete scores or attempts on a restart or rematch; archive them [P].

## File organization

- Frontend by feature: `auth`, `competition`, `player`, `judge`, `admin`, `big-screen`, `ranking`, `gameplay` [T].
- Backend: **OPEN (I-02).**

## Forbidden / restricted practices

- Do not trust the client for time, validity, score, rank or eligibility [T].
- Do not run scoring from autosave [T].
- Do not compute rankings on the big screen [T].
- Do not commit secrets, keys or credentials to the repository.
- Do not bypass authentication for any endpoint.
- Do not implement anything tagged [O]/OPEN, and do not present a [T] decision as client-confirmed.
- If a situation seems to make violating one of these the easiest solution, stop and report the conflict.
