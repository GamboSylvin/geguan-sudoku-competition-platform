# Project Instructions

## Current Phase

The project is currently in the **requirements and decision phase**.

Do not assume that requirements, architecture, constraints, or technical decisions are final unless they are explicitly marked as confirmed.

Do not move into implementation unless explicitly requested.

---

## Project Documentation

The project root contains:

```text
requirements/
decisions/
client-view.md
```

### `requirements/`

Contains proposed and established requirements for the project, including functional requirements, roles, architecture, constraints, and other project aspects.

Requirements may be proposals unless explicitly confirmed.

### `decisions/`

Contains the current decision tracking:

* `project-decisions.md` — history and current status of project decisions.
* `unmade-decisions.md` — decisions that are still open, deferred, or otherwise require confirmation.

Decision statuses must always be respected.

### `client-view.md`

Contains the client's proposals, expectations, and vision for the project.

This is the primary reference for understanding what the client has requested or proposed.

---

## Mandatory Documentation Review

Whenever creating, modifying, reviewing, or discussing a requirements or decision document:

1. Read all relevant files in `requirements/`.
2. Read both files in `decisions/`.
3. Read `client-view.md`.
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

When writing new requirements, always compare them against the client's `client-view.md` and clearly identify any divergence.

---

## Decision Tracking

Treat `decisions/` as a **live decision-tracking system**.

When a decision changes:

* Update its status appropriately.
* If an open/unmade decision becomes confirmed, remove it from `unmade-decisions.md` and record/update it in `project-decisions.md`.
* If a confirmed decision becomes open, deferred, or otherwise unconfirmed, update `project-decisions.md` and add it to `unmade-decisions.md` when appropriate.
* Keep the two decision files consistent.

Do not silently change the status of a decision.

---

## Status Integrity

Always distinguish between:

* **Confirmed** — explicitly decided.
* **Working Proposal** — accepted for the MVP but may change.
* **Deferred** — intentionally postponed.
* **Open / Unmade** — no final decision has been made.

Never present a proposal, working proposal, or open decision as a confirmed requirement.

---

## General Rule

**Compare first. Update second. Assume nothing.**

The goal is to maintain consistency between:

```text
Client View
     ↓
Requirements
     ↓
Decisions
     ↓
Unmade Decisions
```

and to make every divergence or unresolved decision visible before documentation is changed.

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
