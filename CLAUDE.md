# Project Instructions

## Application Building Context

**Before anything else, read `context/FILL-BEFORE-CODING.md`.** Search `context/` for the blanks it describes: `FILL-BEFORE-CODING` (blocks all coding), `FILL-BEFORE-UNIT` (blocks only the unit it names), `FILL-BEFORE-DEPLOYMENT` (blocks deployment, not coding). **None of today's open rows block coding** — see "Current status" below for exactly what's open and why it doesn't block.

Read the following files in order before implementing or making any architectural decision:

1. `context/README.md` — what the files are, the status tags, the reading rules
2. `context/project-overview.md` — product definition, goals, features, and scope
3. `context/competition-rules.md` — the decided competition and scoring rules, and the open ones
4. `context/architecture.md` — system structure, boundaries, storage model, and invariants
5. `context/ui-context.md` — screens, states, and interaction rules
6. `context/code-standards.md` — implementation rules and conventions
7. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
8. `context/progress-tracker.md` — current phase, blockers, open questions, and next steps. **This is the single most current file in the project — read it in full.** If anything in this `CLAUDE.md` file ever disagrees with `progress-tracker.md`, trust `progress-tracker.md` and fix this file.
9. `context/data-model.md` — the data model and schema, **approved 2026-09-30**, amended 2026-10-01 (added `RoundSettings` fields for the second Team round)
10. `context/specs/00-build-plan.md` — full build order with dependencies, **approved 2026-09-30**, 15 units

Before starting any unit, read its spec at `context/specs/NN-unit-name.md` for that unit's goal, implementation details, acceptance criteria, and scope. **Check the spec file's own header line.** It says either `APPROVED` or `DRAFT, awaiting approval`. **If it still says draft, stop and get the project owner's explicit approval before writing any code for that unit** — this applies per unit, separately from the one-time gate below, and it is a real, current requirement, not leftover boilerplate. See "Current status" for exactly which specs exist today and their approval state.

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, ask, then update the relevant file before continuing.

**Open-item gate.** Anything tagged **[O]** or marked OPEN is not decided. Do not implement it and do not guess it. If a unit depends on an open item, stop and report it.
**Status gate.** **[C]** means the client's stakeholder confirmed it (on the date shown; a confirmed rule can change later, and the change is logged in `context/progress-tracker.md`). **[T]** decisions were made by the team or the project owner and are not stakeholder-confirmed.

Open items not yet answered live in `context-feeders/decisions/unmade-decisions.md`. (The earlier working files under `context-feeders/working/` — the interview record and the question pack — were removed 2026-10-01 once fully answered; everything they held is reflected in `context-feeders/decisions/` and `context/`, see `context-feeders/README.md`.)

---

## Current status (last checked 2026-10-02 — if this section looks out of date, `context/progress-tracker.md` is always the authority; update this section to match it)

**Phase: Building, not pre-build.** The one-time coding gate passed 2026-09-30 (no `FILL-BEFORE-CODING` blank remained, and `FILL-BEFORE-CODING.md` section E — including the data model and the Unit 1 spec — was approved). The project owner gave the explicit go-ahead to build on 2026-10-01. Requirements are still being refined in parallel through the stakeholder process (see "Two sets of documents" below) — that is normal and does not block building.

**What's actually built:** Unit 1 (foundation) only — repository, Docker/Compose environment, CI (lint, type check, test, build), backend and frontend skeletons, the Prisma schema with its first migration, a health check, a first passing Jest test, the English/Chinese i18n scaffold. **No feature code exists yet.**

**What's spec'd but not yet built, and not yet approved:** `context/specs/02-authentication-and-accounts.md`, `03-competition-setup-and-lifecycle.md`, and `06` through `15` (judges and ranges; round runtime and autosave; submission, answer check and scoring; individual ranking and big-screen ranking; judge supervision and single-student restart; controller live commands; results, corrections, export and purge; team stage rotation relay; team stage partition collaboration; school ranking and competition copy). **All twelve still say `DRAFT, awaiting approval` in their own header.** Get sign-off on each one before building it.

**What's blocked, with no spec at all:** Units 04 (participant import) and 05 (question import). Both wait on the stakeholder, not on the team: **U-01** (the real sample participant Excel and a past results sheet — never sent) and **U-94** (whether production question files can supply the puzzle's given cells as text, not just an embedded picture). Do not start either unit or guess its spec; `context/specs/00-build-plan.md`'s "Units that cannot be specified until an open item is answered" table is the authoritative list.

**Recommended build order, once each spec is approved:** `02 → 03 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15`, with `04` and `05` slotted in whenever U-01/U-94 resolve. Units 06 onward were deliberately specced to build and test against seeded or hand-transcribed participant/question data in the meantime (see each spec's own Context section for exactly how) — none of them are actually blocked by 04/05 being unbuilt.

**Open items that do NOT block building right now** (do not wait on these): a default visual style not yet stakeholder-confirmed (U-65); the ranking tie-break's submission-time extension (U-22); extra participant-Excel columns (U-40); two UI token tables (border radius, spacing scale — `FILL-BEFORE-CODING.md` row B5, needed only before the first UI/design unit); a missing CI automated-review step (row C2, needed before a real deployment, not before coding); where the event-day server runs (row C1, needed only before deployment); a measurable business-goal metric (U-96, informational only). The full, current list is `context/progress-tracker.md`'s "Open Questions" section and `context-feeders/decisions/unmade-decisions.md`.

**Two sets of documents.** `context/` is what an agent builds from. `context-feeders/requirements/`, `context-feeders/decisions/` and `context-feeders/archive/` are the requirements record, governed by the rules below — they feed `context/`, they are not what gets built from. If the two differ, do not resolve it silently: identify the difference and ask.

---

## Project Documentation

The project root contains:

```text
CLAUDE.md            this file: the entry point
context/             the deliverable: what an agent builds from
building-with-ai/    the methodology (reference — still used during the build, not just to write context/: see its README for the per-unit workflow cycle, quality layers, and CI/CD shape)
context-feeders/     transit folder: files that only FEED context/
    requirements/    the two live requirement documents
    decisions/       the decision register
    archive/         merged source documents
```

* `context/` — the context folder, read first (see above).
* `context-feeders/` — everything that feeds `context/`. It is **not** what a coding agent builds from. Each file starts with a short note saying its role. See `context-feeders/README.md` for what each subfolder holds, including the `working/` folder's removal.

### `context-feeders/requirements/`

Contains the two live requirement documents:

* `REQUIREMENTS.md` — what the product must do: competition rules, roles, flows, screens, data, later phases, open items.
* `ARCHITECTURE.md` — how it is built: style, stack, modules, data model, real-time design, API, scale, deployment, open technical decisions.

Every statement in them carries a status tag and, where it exists, a decision ID:

* **[C]** confirmed by the stakeholder
* **[P]** proposed by the team and approved in the stakeholder's blanket answer ("accepted proposal" in the register)
* **[S]** stated in the client's original document, not contradicted, not re-confirmed
* **[T]** team decision from the engineering guideline, not reviewed by the stakeholder
* **[A]** assumed by the team, awaiting confirmation
* **[O]** open (see `context-feeders/decisions/unmade-decisions.md`)
* **[L]** later phase, not in the MVP

Requirements may be proposals unless tagged [C].

### `context-feeders/decisions/`

Contains the current decision tracking:

* `project-decisions.md` — history and current status of project decisions (rows with IDs such as SCR-001, ROL-003, PAR-005).
* `unmade-decisions.md` — decisions that are still open, deferred, or otherwise require confirmation. The file holds only open items (U-* for the stakeholder or assumptions, I-* internal, and a few later-phase rows); once an item is answered it moves to `project-decisions.md` and leaves this file. The old body, with all resolved rows, is archived in `context-feeders/archive/unmade-decisions-history.md`. Any question the project files cannot answer is recorded here, never guessed.

Decision statuses must always be respected.

### `context-feeders/archive/`

Holds the source documents whose content has already been merged into `context-feeders/requirements/` and `context-feeders/decisions/`, and `CONSOLIDATION_LOG.md`, the record of how each source was merged and checked. It is kept for reference and is not edited. `context-feeders/archive/README.md` lists each file and where it was merged.

`context-feeders/archive/client-view.md` contains the client's proposals, expectations, and vision for the project. It is the primary reference for understanding what the client has requested or proposed. Its content is merged into `context-feeders/requirements/REQUIREMENTS.md` and `context-feeders/requirements/ARCHITECTURE.md` (statements tagged **[S]**).

---

## Mandatory Documentation Review

Whenever creating, modifying, reviewing, or discussing a requirements or decision document (in `context-feeders/requirements/` or `context-feeders/decisions/`):

1. Read `context-feeders/requirements/REQUIREMENTS.md` and `context-feeders/requirements/ARCHITECTURE.md`.
2. Read both files in `context-feeders/decisions/`.
3. Read `context-feeders/archive/client-view.md`.
4. Compare the new information with the existing documentation before proposing changes.

Do not rely only on the most recently discussed information.

(The `context/` folder has its own rules: `context/ai-workflow-rules.md`.)

---

## Requirement Conflicts

Whenever a new requirement or proposal conflicts with existing documentation:

* Clearly identify the conflict.
* State what the existing documentation says.
* State what the new proposal says.
* Do not silently replace the existing requirement.
* Do not resolve the conflict without explicit confirmation.

When writing new requirements, always compare them against the client's `context-feeders/archive/client-view.md` and clearly identify any divergence.

---

## Decision Tracking

Treat `context-feeders/decisions/` as a **live decision-tracking system**.

**Every time a new requirement, proposal, constraint, or other project information is added or modified, check whether it creates, changes, confirms, reopens, or invalidates any project decision. Update the decision files accordingly.**

When a decision changes:

* Update its status appropriately.
* If an open/unmade decision becomes confirmed, remove it from `unmade-decisions.md` and record/update it in `project-decisions.md`.
* If a confirmed decision becomes open, deferred, or otherwise unconfirmed, update `project-decisions.md` and add it to `unmade-decisions.md` when appropriate.
* If a new requirement introduces a decision that did not previously exist, add that decision to the appropriate decision-tracking file.
* If a new or modified requirement makes an existing decision obsolete or changes its scope, update the affected decision and its status.
* Keep `project-decisions.md` and `unmade-decisions.md` consistent at all times.

**Do not treat updating the requirement document as sufficient when the change also affects a project decision. The corresponding decision-tracking files must also be updated.**

Do not silently change the status of a decision.

---

## Status Integrity

Always distinguish between:

* **Confirmed** — explicitly decided ([C]).
* **Working Proposal** — accepted for the MVP but may change ([P], [T], [A]).
* **Deferred** — intentionally postponed ([L]).
* **Open / Unmade** — no final decision has been made ([O]).

Never present a proposal, working proposal, or open decision as a confirmed requirement.

---

## General Rule

**Compare first. Update second. Assume nothing.**

The goal is to maintain consistency between:

```text
Client View (context-feeders/archive/client-view.md)
     ↓
Requirements (context-feeders/requirements/)
     ↓
Decisions (context-feeders/decisions/project-decisions.md)
     ↓
Unmade Decisions (context-feeders/decisions/unmade-decisions.md)
```

and to make every divergence or unresolved decision visible before documentation is changed.
