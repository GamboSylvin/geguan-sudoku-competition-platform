## Application Building Context (DRAFT v0, 2026-09-26)

> **Not yet renamed.** Per the methodology this file becomes the coding agent's entry file (`CLAUDE.md`, `AGENTS.md`, ...) at the project root.
> A root `CLAUDE.md` already exists and governs the documentation phase (`requirements/`, `decisions/`, `archive/`), so this draft stays in `context/` until that is resolved.

**Before anything else, read `context/FILL-BEFORE-CODING.md`.** Search `context/` for `FILL-BEFORE-CODING`. If any marker remains, **do not write code**; report the markers.

Read the following files in order before implementing or making any architectural decision:

1. `context/README.md` — what the files are, the status tags, the reading rules
2. `context/project-overview.md` — product definition, goals, features, and scope
3. `context/competition-rules.md` — the decided competition and scoring rules, and the open ones
4. `context/architecture.md` — system structure, boundaries, storage model, and invariants
5. `context/ui-context.md` — screens, states, and interaction rules
6. `context/code-standards.md` — implementation rules and conventions
7. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
8. `context/progress-tracker.md` — current phase, blockers, open questions, and next steps
9. `context/data-model.md` — the approved data model and schema (**placeholder, to be filled and approved**)
10. `context/specs/00-build-plan.md` — full build order with dependencies (**placeholder, to be filled**)

Before starting any unit, read its spec at `context/specs/NN-unit-name.md` for that unit's goal, implementation details, acceptance criteria, and scope (**no unit specs exist yet; they follow the build plan**).

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, ask, then update the relevant file before continuing.

**Open-item gate.** Anything tagged **[O]** or marked OPEN is not decided. Do not implement it and do not guess it. If a unit depends on an open item, stop and report it.
**Status gate.** Only **[C]** means the client's stakeholder confirmed it. **[T]** decisions were made by the team or the project owner and are not stakeholder-confirmed.

The working files live **outside this folder**, in `context-working/`. They are not part of the context and contain superseded statements. Ignore them.
