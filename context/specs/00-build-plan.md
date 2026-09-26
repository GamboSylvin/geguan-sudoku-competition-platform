# Build Plan — PLACEHOLDER (v1, 2026-09-26)

> **[[FILL-BEFORE-CODING: the build plan (units, order, dependencies, definition of done) = ________ ; owner: team]]**
> This file is an empty structure. It must be filled and approved, together with the Unit 1 spec, before coding starts.
> Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [O] open. See `../README.md`.

## Decided constraints

- **First slice:** the **Individual stage, end to end**. The team stage and the design come later. Keep the data model ready for team rotation [C].
- **Workflow:** one branch per unit; a pull request before every merge; lint, type check, tests and build in CI must pass before a merge; the other developer reviews each pull request [C].
- **A unit** produces one visible, verifiable result, stays within one system boundary, and can be built in one focused session (methodology).
- **Order rules** (methodology): dependencies first; security before functionality; backend before frontend wiring; shells before real data; dependencies installed just in time.
- **Unknowns rule** [T]: an unknown is an implementation detail unless it changes the domain model, the state machine, scoring or ranking, authentication, the question format, or a critical API or WebSocket contract; only those need a decision before coding.
- **Reference only, out of date:** the earlier 15-day plan is in `progress-tracker.md`. It is not a plan to follow.

## Units (blank on purpose)

| # | Unit name | What it builds (one visible result) | Depends on | Done when (acceptance criteria) | Builder |
|---|---|---|---|---|---|
| 01 | ________ | ________ | ________ | ________ | ________ |
| 02 | ________ | ________ | ________ | ________ | ________ |
| 03 | ________ | ________ | ________ | ________ | ________ |
| 04 | ________ | ________ | ________ | ________ | ________ |
| 05 | ________ | ________ | ________ | ________ | ________ |

(Add rows as needed. Each unit needs its own spec in `specs/NN-unit-name.md` with: goal, context, implementation details, acceptance criteria, out of scope.)

## Definition of done (project-wide)

- Documented sources: the MVP acceptance scenario, the failure and edge-case test list [T], and the extended scenario with the stakeholder's additions [A] (REQUIREMENTS §13). Their content is not yet copied into the context files: ________
- Per-unit rule (I-22): ________

## Units that cannot be specified until an open item is answered

| Unit area | Waits for |
|---|---|
| Import (participant Excel, question PDF) | Sample files (U-01), extra Excel columns (U-40), points in the PDF (U-03) |
| Authentication | Judge and controller credential format (I-30), session length (I-16) |
| Answer check | Unique solutions (U-90), grid shapes from the sample PDF (U-01) |
| Results and finishing | When students see scores (U-24, U-88), awards and reset (U-89, U-27) |
| Team stage | The second team round (U-05, U-21), question files per category (U-32) |
