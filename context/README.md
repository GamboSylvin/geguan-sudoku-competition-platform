# Context folder — Sudoku Arena (DRAFT v1, 2026-09-26)

This folder is the single source of truth a coding agent reads before it builds anything. It follows the `building-with-ai` methodology.
**It is a draft with visible gaps. It is not approved.** See `progress-tracker.md`, "Minimum to start coding", for what still blocks coding. Anything marked **TBD — to be decided by the project owner** is blank on purpose.

## Files

| File | What it holds | State |
|---|---|---|
| root `CLAUDE.md` (outside this folder) | The entry point an agent reads first, in order. It also keeps the documentation-phase rules for `context-feeders/requirements/`, `context-feeders/decisions/` and `context-feeders/archive/` | Merged 2026-09-26 |
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
| `specs/01-foundation.md` | The spec of Unit 1 (foundation), in the feature-spec structure | **Placeholder**, to be filled and approved |
| `samples/` | Where the sample participant Excel and question PDF are placed | Empty, to be filled |

Not yet written: the specs of the later units (`specs/NN-unit-name.md`). They follow the build plan.

**Blanks:** search the folder for `FILL-BEFORE-CODING` (needed before the first unit), `FILL-BEFORE-UNIT` (needed before a named unit) and `FILL-BEFORE-DEPLOYMENT`. **Do not write code while a `FILL-BEFORE-CODING` marker remains.**

## Working files (outside this folder)

Everything that feeds this folder lives in the transit folder **`context-feeders/`**, next to `context/`, so that this folder holds only the context: `requirements/`, `decisions/`, `archive/` and `working/` (the interview record, the open questions and the questions for the client's stakeholder). Each file there starts with a note saying its role. **Do not read them to decide what to build**; `working/` contains superseded statements.
The context builder records new answers in `context-feeders/working/` first and then updates the files here. Delete or archive `context-feeders/working/` once the context files are approved.

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
