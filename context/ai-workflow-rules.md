# AI Workflow Rules (DRAFT v0, 2026-09-26)

> Direct instructions to the coding agent. Status tags: [T] team decision · [O] open. See `README.md`.
> The git, CI and review rules are decided (BLD-002); team roles and sync rhythm are still open. The structure below follows the agreed `building-with-ai` methodology.

## Approach

Build this project incrementally with a spec-driven workflow. The context files define what to build, how it is built, and the current state of progress. Always implement against them. **Do not infer or invent behaviour.**

## Before making changes

The agent MUST do the following before writing any code:

1. Read `project-overview.md`.
2. Read `competition-rules.md`.
3. Read `architecture.md`.
4. Read `code-standards.md`.
5. Read `ui-context.md` (for UI work).
6. Read `progress-tracker.md`.
7. Read the relevant unit spec in `specs/` (none exist yet).
8. Inspect the existing implementation.
9. Identify dependencies and potential conflicts.

## Before implementing

10. Explain the proposed approach.
11. Identify the files and components that will change.
12. Identify architectural or database changes.
13. Ask for human confirmation when a change affects: architecture or system boundaries; database structure or schema; public API contracts; security or authentication; major dependencies.

## During implementation

14. Make only the changes the spec requires.
15. Do not silently change unrelated code.
16. Follow existing project patterns.

## After implementation

17. Run relevant tests and checks.
18. Review the diff.
19. Report what changed.
20. Report any assumptions or unresolved issues.
21. Update `progress-tracker.md` when appropriate.

## Scoping rules

- Work on one feature unit or subsystem at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single step.

## When to split work

Split an implementation step if it combines:

- UI changes and backend logic changes.
- Multiple unrelated modules or routes.
- Behaviour not clearly defined in the context files.

If a change cannot be verified end to end quickly, the scope is too broad. Split it.

## Handling missing or open requirements

- **Do not invent product behaviour** that the context files do not define.
- **Open-item gate:** anything tagged [O] or marked OPEN is not decided. Do not implement it, and do not guess a default. If a unit depends on an open item, stop and report it.
- **Coding gate:** do not write any code while a FILL-BEFORE-CODING marker (a blank in double square brackets) remains anywhere in `context/`. Report the remaining markers instead (the checklist is `FILL-BEFORE-CODING.md`). A FILL-BEFORE-UNIT marker blocks only the unit it names.
- **Status gate:** only [C] means the client's stakeholder confirmed a rule. [T] rules were decided by the team or the project owner (often in the stakeholder's role) and must **never be described as stakeholder-confirmed** in code comments, docs, commit messages or reports.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing. If it cannot be resolved, add it as an open question in `progress-tracker.md` and ask.
- If the user describes behaviour that differs from a spec, stop and ask. Do not silently absorb the change.
- **Rule for unknowns [T]:** an unknown is an implementation detail unless it changes the domain model, the state machine, scoring or ranking, authentication, the question format, or a critical API or WebSocket contract. Only those need a decision before coding. Anything else may be decided while building, and recorded in `progress-tracker.md`.

## Protected files

Do not modify the following unless explicitly instructed:

- `requirements/`, `decisions/` and `archive/` at the project root. They belong to the documentation phase and are governed by the root `CLAUDE.md`.
- The working files in `context-working/` (outside this folder). They are the record of the requirements process, not part of the context; do not read them to decide what to build (they contain superseded statements). Changes to them go through the answer-recording process, not through code work.
- Generated UI-library components and third-party internals (once a UI library is chosen, I-20): generated output can be overwritten and vendor code is updated upstream; project customization lives in the app layer.

## Change management

When a requirement changes:
1. Record the change and its reason in the relevant context file **before** acting on it.
2. Update the source of truth before writing code.
3. Check downstream impact on dependent units and specs.
4. For a major change, record the **why**, the **scope of impact**, and the **new solution**.
5. Do not silently absorb changes.
6. Inform the team.

## Keeping docs in sync

Update the relevant context file whenever implementation changes: system architecture or boundaries; storage model decisions; code conventions or standards; feature scope. Progress state must reflect the actual state, not the intended state. If work is half-done, mark it half-done.

## Git, CI and review

Decided [C] (BLD-002):
- **One branch per unit.** No direct commits to `main`.
- A **pull request before every merge.**
- **Lint, type check, tests and build in CI**, which must pass before a merge.
- **The other developer reviews each pull request.**

Methodology rules that still apply (not contradicted): delete a feature branch after merge; write commit messages that say what changed and why; quality layers are AI review, then automated checks, then human review; the developer must read and understand AI-generated code before closing a unit.
Team roles: **TBD — to be decided by the project owner** (I-17). Team sync rhythm: **OPEN (I-28).**

## Before moving to the next unit

1. The current unit works end to end within its defined scope.
2. No invariant defined in `architecture.md` was violated.
3. `progress-tracker.md` reflects the completed work.
4. Build, lint and tests pass without errors.
