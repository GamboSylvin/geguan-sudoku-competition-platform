# Context folder — Sudoku Arena (DRAFT v1, 2026-09-26)

This folder is the single source of truth a coding agent reads before it builds anything. It follows the `building-with-ai` methodology.
**It is a draft with visible gaps. It is not approved.** See `progress-tracker.md`, "Minimum to start coding", for what still blocks coding. Anything marked **TBD — to be decided by the project owner** is blank on purpose.

## Files

| File | What it holds | State |
|---|---|---|
| `ENTRY_POINT.md` | What an agent reads first, in order. Not yet renamed to `CLAUDE.md` (a root `CLAUDE.md` already exists) | Draft |
| `project-overview.md` | Product, users, flow, features, scope | Mostly written |
| `competition-rules.md` | The competition and scoring rules that have been decided, and the ones still open | Written from the decisions so far |
| `architecture.md` | Stack, boundaries, invariants, storage, access model | Mostly written: the backend language, hosting and the data model are blank (see `FILL-BEFORE-CODING.md`) |
| `code-standards.md` | Implementation rules | Skeleton: blocked by the backend language |
| `ai-workflow-rules.md` | How the agent must behave while building | Mostly written; git, CI and review are decided; team roles and sync rhythm are open |
| `ui-context.md` | Screens, states, interaction rules | Partial: look, layouts and sizes are open |
| `progress-tracker.md` | Phase, blockers, open items, next steps | Written |
| `FILL-BEFORE-CODING.md` | The checklist of every blank to fill before coding, with owners | Written |
| `data-model.md` | The data model and schema | **Placeholder**, to be filled and approved |
| `specs/00-build-plan.md` | Units, order, dependencies, definition of done | **Placeholder**, to be filled |

Not yet written: the unit specs (`specs/NN-unit-name.md`). They follow the build plan.

**Blanks:** search the folder for `FILL-BEFORE-CODING` (needed before the first unit), `FILL-BEFORE-UNIT` (needed before a named unit) and `FILL-BEFORE-DEPLOYMENT`. **Do not write code while a `FILL-BEFORE-CODING` marker remains.**

## Working files (outside this folder)

The interview record, the open questions and the questions for the client's stakeholder are in **`context-working/`**, next to `context/`, so that this folder holds only the context. **Do not read them to decide what to build**; they contain superseded statements.
The context builder records new answers there first and then updates the files here. Delete or archive `context-working/` once the context files are approved.

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
