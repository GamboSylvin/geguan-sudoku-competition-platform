# Unit 06: Judges and ranges — APPROVED (2026-10-04)

> **Approved Unit 6 spec.** Approved 2026-10-04 by the project owner. This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (`../specs/00-build-plan.md`: "No open items remain — judge credential format is resolved (I-30, BLD-037), judge removal is resolved (I-12, ROL-010).").
> Approved 2026-10-04 and now being built (builder: Sylvin).

## Goal

A controller maintains a reusable judge list (create a judge, get printed credentials) and assigns each judge a contiguous range of participant numbers on a specific competition, changeable at any time during the event. A judge's access is scoped to only their assigned competition and range. Removing a judge is blocked while they are assigned to an unfinished competition.

Goal in one testable sentence: **a controller creates a judge and sees generated credentials; assigns that judge a participant-number range on a competition; the judge can log in (Unit 02) but can act only within that competition and range; removing a judge with an active assignment to an unfinished competition is rejected, naming the competition, and succeeds once the range is reassigned to someone else.**

## Context

- **What already exists:** Unit 02 built role-separated login, sessions and auth middleware — the judge role already logs in through the same role-picker flow as player and controller. Unit 03 built `Competition`/`CompetitionCategory` and used seeded `CompetitionJudgeAssignment` rows to exercise its publish readiness check ("judge-range coverage"). **This unit builds the real judge list and assignment feature** that Unit 03's readiness check queries — no more seed data is needed for that condition once this unit exists.
- **Where this lives:** `Judge` and `CompetitionJudgeAssignment` belong to the **Participant / Identity** module (`../architecture.md`, "System boundaries": "judge range assignment" is explicitly listed there, not under a separate Judges module) — this unit's backend code goes in `backend/src/modules/identity/`.
- **Judge is a reusable, competition-independent list** [T] — `id`, `name`, `active`, `createdAt` (`../data-model.md`). A judge is created once and can be assigned to different competitions over time via separate `CompetitionJudgeAssignment` rows (one assignment per judge per competition, `U(competitionId, judgeId)`).
- **Credentials, same pattern as participants** [T] (BLD-037, resolves I-30): a system-generated username (based on the judge's name or a sequential judge number) plus a short random password, printed the same way participant credential slips will be (PAR-002). **Unit 04 (participant import and its credential-slip export) is not built yet** and this unit does not depend on it — this unit implements its own judge credential generation and slip export, following the same format/pattern that Unit 04 will later use for participants, not by reusing Unit 04 code that doesn't exist.
- **Range assignment** [C] (BLD-008): the controller assigns a judge a range (`fromParticipantNumber`, `toParticipantNumber`) on a specific competition during setup, and **can change it at any time during the event** — unlike round settings, there is no "before preparation begins" cutoff for judge ranges.
- **Authority is strictly scoped** [C] (U-55, re-confirmed 2026-10-01 ROL-008 for the team stage too): a judge sees and acts on only the participants inside their own assigned range, in the competition they are assigned to — "no visibility outside it, and no powers beyond status viewing and single-student restart" (`../data-model.md`, "Access rules"). **This unit builds the scoping rule itself** (a reusable service-layer check other modules call); **the judge-facing supervision dashboard (status view, restart) is Unit 10's build**, not this unit's — see Out of Scope.
- **Removing a judge, resolved** [T] (ROL-010, resolves I-12): prevented while the judge has an active assignment to a competition that hasn't finished — leaving a range of students without a judge on the day is a real operational risk. The controller's workaround already exists: reassign that competition's range to a different judge (an ordinary range edit), which frees the original judge to be removed.
- **No overlap validation between judges' ranges** — not a decided rule anywhere in `competition-rules.md` or `data-model.md`. Each judge's authority is scoped to their own range regardless of what any other judge's range covers; this unit does not reject or warn on overlapping ranges.

## Implementation Details

1. **Judge list.** Create a judge (`name` only); the system generates `username` and a random `password`, stored as `passwordHash` on a new `Account` row with `role = JUDGE` linked via `judgeId`. List judges (active and inactive). Deactivate/remove a judge, subject to the removal rule below.
2. **Credential slip export.** Export a judge's printable credentials (username + password), in the same format participant slips will later use (PAR-002) — implemented independently here, since Unit 04 doesn't exist yet.
3. **Range assignment.** The controller assigns a judge to a competition with `fromParticipantNumber`/`toParticipantNumber`. Editable at any time (no preparation-cutoff rule, unlike `RoundSettings`). One assignment per judge per competition (`U(competitionId, judgeId)`); assigning the same judge again on the same competition edits the existing row rather than creating a duplicate.
4. **Authority scoping.** A service-layer check, callable by other modules: given a judge's account and a target participant/competition, returns whether that judge is authorized (assigned to that competition, target participant number inside their range). Enforced on every judge-facing endpoint added by this and later units (this unit has none beyond its own judge-management endpoints, which are controller-only).
5. **Removal guard.** Removing/deactivating a `Judge` checks for any `CompetitionJudgeAssignment` pointing to a competition whose `status` is not `FINISHED` or `CANCELLED`. If found, reject and name the competition(s); do not reject if every assignment is to a finished or cancelled competition.
6. **Frontend:** a judge-management screen (create, list, credential-slip export, remove) and a range-assignment UI on the competition setup screen (per `../ui-context.md`, "Controller": "assigning judge ranges during setup (changeable during the event)"), both under `frontend/src/features/admin/` or `frontend/src/features/competition/` as appropriate. A minimal judge-side landing after login confirming their assignment ("assigned to competition X, participants #Y–#Z" or "not yet assigned to a competition") — not the full supervision dashboard, which is Unit 10.

### Inputs

- Judge creation: `name`.
- Range assignment: `judgeId`, `competitionId`, `fromParticipantNumber`, `toParticipantNumber` (both positive integers, `from <= to`).

### Expected Behavior

- A controller creates a judge and immediately sees the generated username and password, exportable as a credential slip.
- A controller assigns a judge a range on a competition; the judge, once they log in (Unit 02), sees confirmation of their assignment and cannot see or act on anything outside their assigned competition and range.
- The controller changes a judge's range at any point during the event (before or after the competition has started) and the change takes effect immediately.
- Removing a judge who is still assigned to an unfinished competition is rejected, naming the competition; reassigning the range to a different judge first, then removing the original judge, succeeds.

### Components Involved

- **Backend (`identity` module):** `judge.controller.ts` (create, list, remove), `judge.service.ts` (credential generation, removal guard), `judge-assignment.controller.ts`/`judge-assignment.service.ts` (assign, edit, scoping check), `identity.repository.ts` additions for `Judge`/`CompetitionJudgeAssignment`.
- **Frontend:** judge-management screen (controller), range-assignment UI (competition setup screen), the minimal judge landing confirmation.

### API Contract (Working Position for this unit)

- `POST /api/judges` — body: `{ name }`. Response: the created judge plus `{ username, password }` (shown once, as with participant credentials).
- `GET /api/judges` — list judges.
- `DELETE /api/judges/:id` — removes the judge; `409` naming the unfinished competition(s) if blocked.
- `POST /api/competitions/:id/judge-assignments` — body: `{ judgeId, fromParticipantNumber, toParticipantNumber }`. Creates or edits the judge's assignment on that competition.
- `DELETE /api/competitions/:id/judge-assignments/:assignmentId` — unassigns the judge from that competition.

### Error Cases

- **Remove a judge with an active assignment to an unfinished competition:** rejected, `409`, naming the competition(s) still assigning them.
- **Range with `from > to`, or either bound not a positive integer:** rejected.
- **Assign a judge to a competition they're already assigned to:** edits the existing assignment, does not create a duplicate (enforced by the `U(competitionId, judgeId)` constraint).

### Security Considerations

- Judge creation, listing, removal and range assignment all require a valid `CONTROLLER` session (Unit 02's auth middleware) [C] (ROL-002).
- The authority-scoping check (step 4) is the enforcement point every later judge-facing feature (Unit 10's supervision/restart, and the team-stage equivalent, ROL-008) must call — a judge session must never be trusted to self-report which competition or range it belongs to.

### Constraints

- No schema change — `Judge` and `CompetitionJudgeAssignment` already exist from Unit 1.
- Does not build the judge supervision dashboard (student status, connected/submitted, live ranking) or the single-student restart — that's Unit 10.
- Does not validate or warn about overlapping ranges between judges — not a decided rule.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- The authority-scoping check should be a single exported function from the `identity` module's public interface (`index.ts`), so Unit 10 and any later judge-facing unit call into it rather than re-implementing the range check.
- Judge credential generation can share its random-password-generation utility with what Unit 04 will later build for participants, but the two features' data flows (one manually created by the controller, one bulk-imported from Excel) stay separate — do not couple this unit's code to Unit 04's not-yet-built import pipeline.

### Related Features

- **Depends on:** Unit 02 (login — the judge role already exists), Unit 03 (`Competition` to assign against).
- **Depended on by:** Unit 10 (judge supervision and restart — calls this unit's scoping check), Unit 03's publish readiness check (already wired to query `CompetitionJudgeAssignment`, now populated by real data instead of seed data).

## Acceptance Criteria

1. A controller creates a judge and receives generated login credentials, exportable as a slip.
2. A controller assigns a judge a participant-number range on a competition; the assignment is editable at any time, with no preparation-cutoff restriction.
3. A judge who logs in sees confirmation of their own assignment and cannot access another competition's data or a participant number outside their range.
4. Removing a judge with an active assignment to an unfinished competition is rejected and names the competition; after reassigning that range to another judge, removal succeeds.
5. A non-controller session cannot create, list, remove or assign judges.
6. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- The judge supervision dashboard (student connection/submission status, live ranking view) and the single-student restart — Unit 10.
- Overlap validation between different judges' ranges — not a decided rule.
- The team-stage-specific judge view (same scope as Individual, ROL-008) — built when Unit 10 is built, reusing this unit's scoping check.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
