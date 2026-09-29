# Pull request

<!-- BLD-002: one branch per unit; a pull request before every merge;
     lint, type check, tests and build must pass in CI before a merge;
     the other developer reviews every pull request. -->

## Unit

<!-- Which unit of the build plan (context/specs/00-build-plan.md) does this PR deliver? -->
Unit:

## What changed

<!-- One or two sentences. Focus on why, not a line-by-line list. -->

## Acceptance criteria

<!-- Copy the unit's acceptance criteria from its spec (context/specs/NN-unit-name.md)
     and mark each one. The unit is not done until they all pass. -->

- [ ]
- [ ]

## Definition of done (project-wide, I-22)

- [ ] The unit's acceptance criteria pass.
- [ ] The project-wide failure and edge-case list relevant to this unit passes (REQUIREMENTS §13).
- [ ] Lint, type check, tests and build pass in CI (BLD-002).
- [ ] The other developer has reviewed this pull request.
- [ ] No invariant in `context/architecture.md` is violated.
- [ ] `context/progress-tracker.md` reflects the work.

## Open items / blanks

<!-- Does this change anything tagged [O]/OPEN in the context files?
     It must not implement one. If it does, stop and report it instead. -->

- [ ] This change does not implement anything tagged [O] or OPEN.
- [ ] If it changes the architecture, scope or standards, the relevant context file was
      updated (and the decision register, if a decision changed).

## Notes for the reviewer
