# Unit 08: Submission, answer check and scoring — DRAFT, awaiting approval

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (not listed in `../specs/00-build-plan.md`, "Units that cannot be specified"). The build plan's own note — "**Waits:** unique solutions (U-90)" — is resolved: every puzzle has exactly one valid solution, confirmed by the stakeholder [C] (U-90).
> Present this spec for review before starting the unit, per the methodology.

## Goal

A player submits a round once (manually, with confirmation, or automatically at time expiry); the server checks each puzzle's submitted grid against its stored solution, scores all-or-nothing per puzzle, awards the early-finish bonus when it applies, and finalizes the round's result — which also completes Unit 07's round-to-round advance, since a round transition can only happen once its scoring is final.

Goal in one testable sentence: **a manual submit with every puzzle correct and time left earns the round's early-finish bonus and a finalized score; a manual submit with a wrong or blank puzzle scores 0 for that puzzle; a submission arriving after the timer expired is recorded as automatic, not manual, and earns no bonus; once every participant's attempt in a round is finalized, the next round's preparation begins (completing Unit 07's auto-advance).**

## Context

- **What already exists:** Unit 03's `Competition`/`Stage`/`Round`, and Unit 07's round-active state, server-owned timer (with its `pause`/`resume`/`remaining` interface and its "round ended" signal at timer expiry), and autosaved working grids in Redis. **This unit adds no new tables** — `Attempt`, `Answer`, `IndividualRoundResult` and `RoundParticipation` already exist from Unit 1 (`../data-model.md`).
- **Where this lives:** submission itself (closing a `RoundParticipation`, turning the current attempt read-only) is **Gameplay**; puzzle evaluation, score and bonus calculation are **Scoring** (`../architecture.md`, "System boundaries") — backend code goes in `backend/src/modules/gameplay/` and `backend/src/modules/scoring/`.
- **Question data for this unit's own testing:** `Question.solution` is only reliably populated for a **hand-transcribed starter set** today — the real question-import pipeline (Unit 05) is still gated on U-01/U-94 and isn't built yet. This is the exact situation the interim plan (BLD-026) was written for: "hand-transcribe a small starter set meanwhile... to build and test the answer-check unit." **This unit builds and tests the answer check against that hand-transcribed seed data**, the same seed-data precedent Unit 03 and Unit 06 used, not against Unit 05's (not-yet-built) import.
- **Completes Unit 07's auto-advance sequence:** Unit 07 stops autosave and emits a "round ended" signal at timer expiry, but does not itself start the next round's preparation, because **a round transition happens only after its scoring is final** [T] (invariant 7). **This unit listens for that signal, auto-submits every participant still active, scores every attempt in the round, finalizes `IndividualRoundResult` for each participant, and only then calls back into Unit 07's preparation-start logic** for the next round (or marks the stage finished, if it was the last round).
- **Single final submission** [C] (SUB-001/SUB-002): once per round. Until submitted, the student moves freely between the round's 6 puzzles (already built, Unit 07). The student confirms before the final submit; the confirmation states how many puzzles are blank. A blank puzzle is allowed and scores 0. A repeated submission never changes the result [C] (PL-009).
- **Late submit** [C] (SUB-003): the server clock decides. A manual submit arriving after the timer already reached zero is **not** counted as manual — it's treated exactly like any time-expiry auto-submission, using the student's latest autosaved state, with **no grace period** and **no separate message** (same read-only "submission received, no score shown" state as anyone whose time expired).
- **Time expiry** [T]: the latest autosaved state for the whole round is submitted automatically. An empty grid scores 0. No penalty, ever, for a zero score, no moves, never submitting, or disconnection.
- **Answer check** [C] (BLD-010): the submitted grid is compared with `Question.solution`, with no rule checker per variant — simple equality, relying on the confirmed unique solution [C] (U-90).
- **All-or-nothing scoring** [C] (SCR-001): any wrong or blank cell in a puzzle means 0 for that puzzle; every puzzle in the round counts, none are unscored/practice [T] (SCR-019). Points per question were set by the controller (`Question.points`, from Unit 05's eventual import or, meanwhile, seed data) and scores are stored as integers.
- **Early-finish bonus, Individual stage only** [C] (SCR-008–SCR-011): 3 points per whole minute early (`RoundSettings.earlyBonusRate`, customizable), earned only when the student submits **manually**, **before time ends**, with **every puzzle in the round fully correct**; counted in whole minutes (1 min 30 s early counts as 1). No cap by default; an optional per-round cap may be set (`RoundSettings.earlyBonusCap`). The bonus is part of the round score (a round can exceed its nominal maximum). Measured on the server round timer, which stops during a pause (Unit 07's timer service). An automatic submission (timeout, or a controller-ended round — Unit 11, not yet built) earns **no bonus**. A student who submitted earlier keeps their bonus even if the round later ends early for everyone else.
- **Seeing scores** [C] (SUB-007, BLD-029): a student sees "submission accepted," never their score, until the whole competition reaches `FINISHED` — this unit implements the "accepted" response; the score-reveal gate at `FINISHED` is Unit 09/12's concern (ranking and results), not this unit's.

## Implementation Details

1. **Manual submission.** A player submits their current round's answers once. The server validates the `RoundParticipation` is still `ACTIVE` and the round's timer has not yet reached zero (Unit 07's `remaining()`) — if it has, treat as described in step 2, not as manual. On a valid manual submit: close the attempt (`submissionType = MANUAL`, `submittedAt` = now), mark every puzzle not yet attempted as blank, and proceed to scoring (step 3).
2. **Automatic submission.** Triggered two ways: (a) Unit 07's "round ended" signal, for every `RoundParticipation` still `ACTIVE` in that round — uses each student's latest autosaved grid, `submissionType = TIMEOUT`; (b) a manual submit request arriving after the timer already hit zero — same treatment, `submissionType = TIMEOUT`, not `MANUAL`, no distinct error or message shown to the student.
3. **Scoring.** For each submitted `Answer`, compare `submittedGrid` against `Question.solution`; all cells must match for `correct = true` and `pointsAwarded = Question.points`, otherwise `correct = false` and `pointsAwarded = 0`. Sum into the `Attempt.score`. If `submissionType = MANUAL`, the round is an Individual round, submission was before the timer reached zero, and every puzzle in the attempt is correct: compute `bonus = earlyBonusRate × floor(minutes early)`, capped at `earlyBonusCap` if set. `totalScore = score + bonus`.
4. **Finalize the round result.** Write `IndividualRoundResult` (the settled result, kept separate from the archivable `Attempt`, per `../data-model.md`) from the finalized `Attempt`. Set `RoundParticipation.state` to `SUBMITTED` (manual) or `AUTO_SUBMITTED` (timeout).
5. **Complete Unit 07's auto-advance.** Once every `RoundParticipation` in the round has a finalized result (every active participant has been auto-submitted and scored), mark `Round.status = FINISHED` and call Unit 07's preparation-start logic for the next round — or, if this was the stage's last round, mark the stage finished (no auto-start of the next stage, Unit 11's command).
6. **Frontend.** The submit confirmation dialog (states how many puzzles are blank, per SUB-002), the post-submit "submission accepted" screen (no score shown), and the read-only puzzle view once submitted.

### Inputs

- Manual submit: the player's session identifies the round and participant; no body beyond the confirmation.
- (Internally, the server reads each puzzle's latest autosaved grid from Unit 07's Redis storage — no separate input from the client beyond what autosave already captured.)

### Expected Behavior

- A player who has answered every puzzle correctly submits manually with 5 minutes left on a 20-minute round: scores 100 (6×points, using seed defaults) plus a bonus of `5 × earlyBonusRate`, both part of the same round's `totalScore`.
- A player who submits with one wrong puzzle: that puzzle scores 0, the rest score normally, and no bonus is earned (not every puzzle was correct).
- A player who never touches a puzzle and lets the timer run out: that puzzle is auto-submitted as blank and scores 0, with no bonus and no penalty beyond the 0.
- A player's manual submit request that arrives one second after the timer reached zero is recorded as an automatic (`TIMEOUT`) submission on their latest saved state, with no error and no distinct message — same as if they'd done nothing.
- Once every participant's round result is finalized, the next round's preparation begins automatically (Unit 07's sequence, completed here).

### Components Involved

- **Backend (`gameplay` module):** `gameplay.service.ts` additions (manual submit endpoint, closing a `RoundParticipation`).
- **Backend (`scoring` module):** `scoring.service.ts` (answer check, all-or-nothing evaluation, bonus calculation), `scoring.repository.ts` (`Attempt`, `Answer`, `IndividualRoundResult`).
- **Realtime:** the handler that listens for Unit 07's "round ended" signal and drives the auto-submit-everyone-remaining step.
- **Frontend:** submit confirmation dialog, "submission accepted" screen, read-only puzzle view.

### API Contract (Working Position for this unit)

- `POST /api/gameplay/:roundId/submit` — player-initiated manual submit. `200` with `{ accepted: true }` (never the score, per SUB-007/BLD-029) if before expiry; if the timer had already reached zero, still `200` with `{ accepted: true }` but recorded as `TIMEOUT` internally, with no indication to the client that anything unusual happened.
- Internal (not client-facing): the round-ended handler iterates `RoundParticipation` rows in `ACTIVE` state and calls the same scoring path as a manual submit, with `submissionType = TIMEOUT`.

### Error Cases

- **Submit for a round not `ACTIVE` for that participant** (already submitted, or round not started): rejected as a no-op — per PL-009, a repeated submission never changes the result, so a double-submit request simply returns the same "accepted" response without re-scoring.
- **Submit for another participant's round:** rejected (session-scoped, same pattern as Unit 07's gameplay access rule).

### Security Considerations

- The submit endpoint is scoped to the authenticated player's own `RoundParticipation`; a player can never submit on behalf of another participant [T] (consistent with Unit 07's access rule).
- Scoring and bonus calculation happen entirely server-side, from the server-authoritative timer and the server-stored grid — the client never reports its own elapsed time, score, or correctness [T] (invariant 3).

### Constraints

- No schema change — `Attempt`, `Answer`, `IndividualRoundResult`, `RoundParticipation` already exist from Unit 1.
- Builds and tests against hand-transcribed seed `Question` data (BLD-026) — does not depend on, or wait for, Unit 05's real import pipeline, which stays gated on U-01/U-94.
- Does not build ranking (cumulative stage score, tie-break, the big-screen ranking cycle) — Unit 09.
- Does not build the controller's "end a round early" command (which also yields `submissionType = CONTROLLER_END`, no bonus) — Unit 11; this unit's scoring logic already treats any non-manual-before-expiry submission as bonus-ineligible, so Unit 11 only needs to trigger the same auto-submit path this unit builds, not duplicate the scoring rule.
- Does not build team-stage scoring (rotation relay, partition collaboration — different rules, no early bonus) — Units 13, 14.
- Does not reveal scores to the student before the competition reaches `FINISHED` — that gate is Unit 09/12's concern; this unit only ever returns "accepted."
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Keep the all-or-nothing comparison a simple deep-equality check between `submittedGrid` and `Question.solution` — no per-variant rule checker, per BLD-010.
- The "every puzzle correct" bonus condition and the "every participant scored" advance condition are both whole-round aggregates — compute them once per attempt/round, not per-puzzle, to avoid redundant work at scale (~800 clients, U-60).
- Unit 11's "end a round early" command should call the same round-ended handler this unit builds (step 5), with every still-active participant treated as a `CONTROLLER_END` (not `TIMEOUT`) auto-submission — both are "automatic, no bonus," so the scoring logic itself does not need to change for Unit 11, only the `submissionType` value passed in.

### Related Features

- **Depends on:** Unit 05 (question points/solution — this unit uses hand-transcribed seed data in the interim, per BLD-026), Unit 07 (the round-active state, the server timer, autosaved grids, and the "round ended" signal this unit listens for and completes).
- **Depended on by:** Unit 09 (ranking is derived from `IndividualRoundResult`), Unit 10 (a judge restart archives the current `Attempt`, reusing this unit's attempt model), Unit 11 ("end a round early" reuses this unit's auto-submit/scoring path), Unit 12 (results/export read `IndividualRoundResult` and `Answer`).

## Acceptance Criteria

1. A manual submit with every puzzle correct, before the timer expires, earns the early-finish bonus (3 points per whole minute early by default) as part of the round's `totalScore`.
2. A manual submit with any wrong or blank puzzle scores 0 for that puzzle and earns no bonus, even if every other puzzle is correct.
3. A round's timer expiry auto-submits every still-active participant's latest saved grid, with `submissionType = TIMEOUT` and no bonus.
4. A manual submit request arriving after the timer already expired is recorded identically to a timeout submission, with no error and no distinct message to the student.
5. A repeated submission for an already-submitted round is a no-op — the result never changes (PL-009).
6. Once every participant's result in a round is finalized, the next round's preparation begins automatically (completing Unit 07's sequence) — or, if it was the stage's last round, the stage is marked finished with no auto-start of the next stage.
7. A player session cannot submit, or read the score of, another participant's attempt.
8. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Ranking (cumulative stage score, tie-break, the big-screen ranking cycle) — Unit 09.
- The controller's "end a round early" command itself (the UI/endpoint) — Unit 11; this unit builds the auto-submit/scoring path Unit 11 will trigger.
- Judge supervision and the single-student restart — Unit 10.
- Team-stage submission and scoring (rotation relay, partition collaboration — different rules, no early bonus) — Units 13, 14.
- Revealing scores to the student before the competition reaches `FINISHED` — Unit 09/12.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
