# Unit 01: Foundation — PLACEHOLDER (v1, 2026-09-26)

> **[[FILL-BEFORE-CODING: the Unit 1 spec (goal, context, implementation details, acceptance criteria, out of scope) = ________ ; owner: team]]**
> This file follows the structure of `building-with-ai/templates/feature-spec.md`. It is an empty structure. It must be filled and approved before coding starts. Do not add anything the team has not decided.
> Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [O] open. See `../README.md`.

## Goal

Guidance given so far (to be confirmed): **the foundation only, with no feature**: the repository, the environment, CI and the project skeleton. Authentication, import, the answer check and the team stage wait for their open items (see `00-build-plan.md`).
Goal in one or two testable sentences: ________

## Context

- The stack decided so far: React with TypeScript, PostgreSQL, Redis (persistence on), WebSocket, a modular monolith [T]; the backend language and framework: ________ (see `../architecture.md`).
- Workflow already decided [C] (BLD-002): one branch per unit; a pull request before every merge; lint, type check, tests and build in CI must pass before a merge; the other developer reviews each pull request.
- The first slice is the Individual stage, end to end [C] (BLD-009). This unit delivers none of it; it is the base the next units build on.
- What already exists before this unit: nothing is built.

## Implementation Details

The methodology's pre-code checklist lists these artifacts. Decide here whether each is produced in this unit or already exists:

1. Repository skeleton: folders by module and by feature (see `../architecture.md`, System boundaries): ________
2. Reproducible development environment: dependency lock files committed = ________ ; `.env.example` listing every required variable = ________ ; containerization the stack needs = ________
3. CI pipeline: lint, type check, tests, build, and how a failure blocks the merge = ________
4. Git setup: branch and pull-request rules as decided = ________
5. Translation mechanism for English and Chinese planned in from the start [C] (ARCH-026): set up here or in the first UI unit = ________
6. Project skeleton for the backend and the frontend (empty modules and feature folders, health check, a first passing test) = ________

### Inputs

________

### Expected Behavior

________

### Components Involved

________

### Error Cases

________

### Security Considerations

________

### Constraints

- No feature code. No invented conventions: use `../code-standards.md` once the backend language is decided.
- Nothing tagged [O] or OPEN in the context files may be implemented.

### Implementation Notes

________

### Related Features

- Every later unit depends on this one.

## Acceptance Criteria

1. ________
2. ________
3. ________
4. Build, lint, type check and tests pass in CI on a fresh clone.

## Out of Scope

- Authentication, roles and login.
- Competition setup and the participant and question imports.
- The competition engine (rounds, timers, autosave, submission, scoring, ranking).
- The team stage, the big screens, and any visual design.
