# Context folder — Sudoku Arena (last checked 2026-10-08)

This folder is the single source of truth a coding agent reads before it builds anything. It follows the `building-with-ai` methodology.
**Every `FILL-BEFORE-CODING` blank is filled and section E is approved by the project owner (2026-09-30); the coding gate is passed.** See `progress-tracker.md`, "Blocked". Anything marked **TBD — to be decided by the project owner** is blank on purpose (today only the event-day hosting, `FILL-BEFORE-DEPLOYMENT`).

## Files

| File | What it holds | State |
|---|---|---|
| root `CLAUDE.md` (outside this folder) | The entry point an agent reads first, in order. It also keeps the documentation-phase rules for `context-feeders/requirements/`, `context-feeders/decisions/` and `context-feeders/archive/` | Merged 2026-09-26 |
| `project-overview.md` | Product, users, flow, features, scope | Mostly written |
| `competition-rules.md` | The competition and scoring rules that have been decided, and the ones still open | Written from the decisions so far |
| `architecture.md` | Stack, boundaries, invariants, storage, access model | Written: stack, module-first folder structure, module list (ten modules, BLD-032) and the data model are all decided; only the event-day hosting location stays open (`FILL-BEFORE-CODING.md` row C1, needed before deployment, not before coding) |
| `code-standards.md` | Implementation rules | Skeleton: the stack is decided (Node.js with TypeScript, Express.js, Prisma, Jest); the API and the remaining testing conventions are still to be written |
| `ai-workflow-rules.md` | How the agent must behave while building | Mostly written; git, CI and review are decided; team roles are recorded; team sync rhythm is open |
| `ui-context.md` | Screens, states, interaction rules | Tokens filled with Tailwind defaults; **no dedicated design pass before the event** (UI-008, 2026-10-08) — ships as-is, the look/layout questions (U-65/U-66) stay open to revisit after the event, but don't block building |
| `progress-tracker.md` | Phase, blockers, open items, next steps | Written — **read this one in full, it's the most current file in the project** |
| `FILL-BEFORE-CODING.md` | The checklist of every blank to fill before coding, with owners | Written, all rows closed or explicitly deferred past coding |
| `data-model.md` | The data model and schema | Written and **approved** 2026-09-30 (A6), amended several times since; the Prisma schema is its concrete form (one amendment, `Question.roundId` nullable, not yet migrated — see `progress-tracker.md`, "Known Issues") |
| `specs/00-build-plan.md` | Units, order, dependencies, definition of done | **Approved** 2026-09-30 (A7): 15 units |
| `specs/01-foundation.md` through `specs/15-*.md` | Each unit's own spec | 12 units built (`01,02,03,05,06,07,08,09,10,11`); specs `12`–`15` are drafted and **approved**, ready to build; Unit `04` has no spec yet, blocked on U-01 — see `progress-tracker.md` |
| `samples/` | Real participant/question sample files from the client | Populated 2026-10-07 — see `samples/README.md` |

**Blanks:** search the folder for `FILL-BEFORE-CODING` (needed before the first unit), `FILL-BEFORE-UNIT` (needed before a named unit) and `FILL-BEFORE-DEPLOYMENT`. **Do not write code while a `FILL-BEFORE-CODING` marker remains.**

## Working files (outside this folder)

Everything that feeds this folder lives in the transit folder **`context-feeders/`**, next to `context/`, so that this folder holds only the context: `requirements/`, `decisions/` and `archive/`. Each file there starts with a note saying its role. **Do not read them to decide what to build.**
The context builder records a new answer in `context-feeders/decisions/` (resolved items in `project-decisions.md`, still-open ones in `unmade-decisions.md`) and then updates the files here. **`context-feeders/working/`, the earlier staging folder for the interview record and open questions, was removed 2026-10-01** once fully answered — see `context-feeders/README.md` for what happened to its content.

## Status tags (used in every file)

- **[C]** confirmed by the client's stakeholder, **on the date shown** (2026-09-26 for the decisions of that day). The stakeholder can change a confirmed rule later; if so, update the file and record the change in `progress-tracker.md`, "Context change log". [C] is the right status: it says "confirmed as of that date", not "final forever".
- **[P]** proposed by the team, approved in the stakeholder's blanket answer (not discussed in detail)
- **[S]** stated in the client's original document, not re-confirmed
- **[T]** team or project-owner decision, **not confirmed by the client's stakeholder**
  (The decisions of 2026-09-26 in `competition-rules.md` and `architecture.md` are tagged [C]: the project owner confirmed they were confirmed by the stakeholder.)
- **[A]** assumed, awaiting confirmation
- **[O]** open: no decision. **Do not implement.**
- **[L]** later phase, not in the MVP

Decision IDs in brackets (for example `U-33`, `SCR-005`, `I-06`) are references to the project's decision register. They are kept only as pointers; each rule is written in plain words.

## Rules for reading these files

1. Only **[C]** means the client's stakeholder confirmed it. Decisions taken by the project owner in the stakeholder's role are **[T]** and must never be described as stakeholder-confirmed.
2. Anything marked **[O]** or "OPEN" is not decided. Do not invent it. Add it to `progress-tracker.md` as an open question and ask.
3. If implementation changes the architecture, scope or standards, ask, then update the relevant file before continuing.
