# Project Instructions

## Current Phase

The project is currently in the **requirements and decision phase**.

The requirement documents were consolidated on 2026-09-25 into two live documents (`requirements/REQUIREMENTS.md` and `requirements/ARCHITECTURE.md`), and the decision files are aligned with them. Consolidated does **not** mean final: many statements are proposals, assumptions or open, and each one carries a status tag.

Do not assume that requirements, architecture, constraints, or technical decisions are final unless they are explicitly marked as confirmed.

Do not move into implementation unless explicitly requested.

Before any coding starts, the open items marked "needed before coding" in `requirements/REQUIREMENTS.md` §12 and `decisions/unmade-decisions.md` §16 (in particular I-01, the revised domain model and API) must be dealt with.

---

## Project Documentation

The project root contains:

```text
requirements/
decisions/
archive/
```

### `requirements/`

Contains the two live requirement documents:

* `REQUIREMENTS.md` — what the product must do: competition rules, roles, flows, screens, data, later phases, open items.
* `ARCHITECTURE.md` — how it is built: style, stack, modules, data model, real-time design, API, scale, deployment, open technical decisions.

Every statement in them carries a status tag and, where it exists, a decision ID:

* **[C]** confirmed by the stakeholder
* **[P]** proposed by the team and approved in the stakeholder's blanket answer ("accepted proposal" in the register)
* **[S]** stated in the client's original document, not contradicted, not re-confirmed
* **[T]** team decision from the engineering guideline, not reviewed by the stakeholder
* **[A]** assumed by the team, awaiting confirmation
* **[O]** open (see `decisions/unmade-decisions.md`)
* **[L]** later phase, not in the MVP

Requirements may be proposals unless tagged [C].

### `decisions/`

Contains the current decision tracking:

* `project-decisions.md` — history and current status of project decisions (rows with IDs such as SCR-001, ROL-003, PAR-005).
* `unmade-decisions.md` — decisions that are still open, deferred, or otherwise require confirmation. Section 16 is the live list (U-* for the stakeholder or assumptions, I-* internal); the older sections are history and are annotated when resolved.

Decision statuses must always be respected.

### `archive/`

Holds the source documents whose content has already been merged into `requirements/` and `decisions/`, and `CONSOLIDATION_LOG.md`, the record of how each source was merged and checked. It is kept for reference and is not edited. `archive/README.md` lists each file and where it was merged.

`archive/client-view.md` contains the client's proposals, expectations, and vision for the project. It is the primary reference for understanding what the client has requested or proposed. Its content is merged into `requirements/REQUIREMENTS.md` and `requirements/ARCHITECTURE.md` (statements tagged **[S]**).

---

## Mandatory Documentation Review

Whenever creating, modifying, reviewing, or discussing a requirements or decision document:

1. Read `requirements/REQUIREMENTS.md` and `requirements/ARCHITECTURE.md`.
2. Read both files in `decisions/`.
3. Read `archive/client-view.md`.
4. Compare the new information with the existing documentation before proposing changes.

Do not rely only on the most recently discussed information.

---

## Requirement Conflicts

Whenever a new requirement or proposal conflicts with existing documentation:

* Clearly identify the conflict.
* State what the existing documentation says.
* State what the new proposal says.
* Do not silently replace the existing requirement.
* Do not resolve the conflict without explicit confirmation.

When writing new requirements, always compare them against the client's `archive/client-view.md` and clearly identify any divergence.

---

## Decision Tracking

Treat `decisions/` as a **live decision-tracking system**.

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
Client View (archive/client-view.md)
     ↓
Requirements (requirements/)
     ↓
Decisions (decisions/project-decisions.md)
     ↓
Unmade Decisions (decisions/unmade-decisions.md)
```

and to make every divergence or unresolved decision visible before documentation is changed.
