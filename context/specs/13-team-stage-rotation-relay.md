# Unit 13: Team stage — rotation relay — APPROVED (2026-10-08)

> **Approved spec** [T] (BLD-046, blanket project-owner approval for the final build push). This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (not listed in `../specs/00-build-plan.md`, "Units that cannot be specified").

## Goal

A team of 2–6 (default 4) runs the Team stage's first round: each member is dealt one question, questions rotate between members on a timer (not the members themselves), a member may submit their currently-held question at any time for an immediate answer check, a correctly answered question is replaced from the remaining queue, and the round ends once every question has been correctly answered or an optional total time elapses — settling the team's score as correct answers × the round's flat points-per-question value, with no early bonus.

Goal in one testable sentence: **a team of 4 starts with 4 of the round's 10 (default) questions dealt one per member; every 60 seconds (default) each member's currently-held question (with its partial grid) moves to the next member; a correct submission scores immediately and is replaced from the queue if one remains; the round ends once all 10 questions are correctly answered or the optional total time runs out, and the team's score is settled as correct-answer-count × the round's points-per-question.**

## Context

- **What already exists:** Unit 07's preparation/round state machine, server-owned timer and reconnection patterns; Unit 08's puzzle-evaluation (answer-check) logic, which this unit reuses for per-question checking; Unit 11's "start a stage" command, which already works generically for any stage (including this one). **This unit adds no new tables** — `TeamRotationState` and `TeamRoundResult` already exist from Unit 1 (`../data-model.md`).
- **Where this lives:** the rotation queue and in-progress tablet-holds state belong to the **Gameplay** module, which explicitly owns "team rotation queue and partition-block state (TEM-004, TEM-005)" (`../architecture.md`, "System boundaries"); puzzle evaluation is reused from the **Scoring** module (Unit 08). Backend code goes in `backend/src/modules/gameplay/` (the rotation-specific logic) and reuses `backend/src/modules/scoring/`.
- **Team and question data for this unit's own testing:** `Team` rows depend on the participant import (Unit 04, still gated on U-01), and this round's `Question` rows depend on the question import (Unit 05, **no longer gated as of 2026-10-07** — BLD-041/BLD-042/BLD-047 resolved its open items — but not yet built). **This unit uses seeded `Team`/`Participant`/`Question` data for its own testing**, the same precedent Units 03, 06, 08 and 10 established for data whose real import/management unit isn't built yet.
- **Structure already exists:** Unit 03 auto-created the Team stage's two rounds (rotation relay, then partition collaboration) with `RoundSettings` defaults (`teamPointsPerQuestion` 10, `rotationPeriodSeconds` 60, `teamQuestionCount` 10, `teamTotalTimeSeconds` nullable) for every category. This unit builds round 1's actual gameplay on top of that existing structure.
- **Preparation is unchanged** [C] (RND-001): the round still gets the standard 60-second-default countdown and rules screen, reusing Unit 07's preparation sequence as-is. **This unit's round-start step replaces Unit 07's Individual-stage "fetch all 6 puzzles" step** with the team-specific initial deal (see Implementation Details).
- **Team scoring, a flat value, not per-question points** [C] (SCR-007, SCR-015): "the controller sets **one** 'points per question' value for the whole round" (`RoundSettings.teamPointsPerQuestion`, default 10) — **team rounds do not use `Question.points`**, which is an Individual-stage-only customization. Team score = correct answers × `teamPointsPerQuestion` (4 correct = 40 with the defaults). **No fixed maximum and no "doesn't add to 100" warning** for team rounds [C].
- **Rotation mechanics** [C] (TEM-002, TEM-004, SUB-006): every `rotationPeriodSeconds` (default 60s), each member's **currently-held question**, including its **partly filled grid**, moves to the next teammate — **"questions rotate, not seats"**: the member stays at their own tablet. The rotation period is **not a deadline** — a member may submit their currently held question at any time, not only right before it rotates away.
- **A submit for a question the tablet no longer holds is rejected**, and the member simply sees whatever question has rotated in [C] — this handles the race between a submit arriving and the rotation timer firing at nearly the same moment.
- **A resolved interpretation, flagged because it isn't spelled out explicitly:** nothing in the decided rules says what happens to a question after an **incorrect** submit. This unit treats it the same as before the submit — **the question stays in circulation and keeps rotating**, available to be answered correctly by a later teammate, rather than being discarded or ending that question's chance. This is consistent with "ends when the queue is empty" meaning *every* question has eventually been answered correctly, not merely attempted once.
- **End condition** [C] (TEM-004): the round ends when the **queue is empty** — interpreted here as every one of the round's `teamQuestionCount` questions having been **correctly** answered (no undealt questions left, and nothing still circulating unanswered) — **or** when the optional `teamTotalTimeSeconds` is reached, whichever comes first. If the round ends by the optional time limit, **only answers already submitted and correct count** — an in-progress or wrong attempt contributes nothing.
- **No early-finish bonus in team rounds** [C] — this unit never computes one, unlike Unit 08's Individual-stage scoring.
- **Completes Unit 08's auto-advance pattern, for the team round:** once this round's `TeamRoundResult` is finalized for every team in every category, this unit calls back into Unit 07's preparation-start logic for the Team stage's second round (partition collaboration) — **built by Unit 14, which doesn't exist yet when this unit is built.** Same accepted gap as Unit 11's generic "start a stage" for the Team stage: the hook is built here; Unit 14 is what makes the next round's gameplay actually meaningful.

## Implementation Details

1. **Initial deal.** When a Team-stage rotation round starts (after preparation), randomly draw `teamQuestionCount` (default 10) `Question` rows from the category's `QuestionSet` pool — **not filtered by `roundId`**, which is Individual-stage-only (BLD-040) — and deal one to each active team member's tablet; the rest form `TeamRotationState.refillQueue`. Record `tabletHolds` (member → current question) and `rotationIndex`.
2. **Timed rotation.** Every `rotationPeriodSeconds`, each member's current question — with its partly filled grid — moves to the next member in a fixed rotation order; update `tabletHolds` and `lastRotationAt`. Server-authoritative, reusing Unit 07's timer patterns at the team's own cadence (not the whole-round countdown).
3. **Submit and immediate check.** A member submits their currently held question at any time; the server checks the tablet still holds that question (reject and refresh their view if it has already rotated away), then evaluates it via Unit 08's puzzle-evaluation logic (all-or-nothing). Correct: award `teamPointsPerQuestion` to the team's running score, remove the question from circulation, and refill that member's tablet from `refillQueue` if one remains (else show the "nothing to work on right now" state). Incorrect: no score change, the question stays in `tabletHolds` to be rotated onward at the next tick (see the flagged interpretation above).
4. **Round end.** When every question has been correctly answered, or `teamTotalTimeSeconds` elapses (if set) — whichever first — finalize `TeamRoundResult` (`correctCount`, `score = correctCount × teamPointsPerQuestion`, `completionTimeSeconds` set only if ended by queue-empty).
5. **Auto-advance completion.** Once every team's `TeamRoundResult` for this round is finalized, call Unit 07's preparation-start logic for the Team stage's round 2 (Unit 14's build).
6. **Frontend.** The rotation-round tablet view: the currently held question, a submit action, the partly filled grid carried across a rotation, and a distinct "waiting for the next rotation, nothing to work on" state when refilled with nothing.

### Inputs

- Submit: `questionId` (must match the member's current `tabletHolds` entry), the submitted grid.

### Expected Behavior

- A 4-member team starts with 4 questions dealt, one per tablet; every 60 seconds, each member's question (and its progress) moves to the next member.
- A member who answers correctly immediately sees their score contribute to the team total and gets a fresh question if the queue still has one.
- A member who answers incorrectly sees no score change; their current question keeps rotating at the next tick.
- Once all 10 (default) questions have been correctly answered by the team as a whole, the round ends and the team's score is `correctCount × teamPointsPerQuestion`.
- If an optional total time is set and it runs out first, the round ends with whatever was correctly answered by then — nothing in progress counts.

### Components Involved

- **Backend (`gameplay` module):** `team-rotation.service.ts` (deal, rotation timer, submit-and-refill, end-condition check), reusing `scoring.service.ts`'s puzzle evaluation from Unit 08.
- **Frontend:** the rotation-round tablet view under `frontend/src/features/gameplay/`.

### API Contract (Working Position for this unit)

- WebSocket: `rotation:deal` (initial), `rotation:rotated` (the new question + grid state for each affected tablet), `rotation:ended`.
- `POST /api/gameplay/rotation/:roundId/submit` — body: `{ questionId, grid }`. `409` if the tablet no longer holds that question.

### Error Cases

- **Submit for a question the tablet no longer holds:** rejected; the client is refreshed with whatever question is now held.
- **Submit from a member not on an active team for this round:** rejected.
- **Submit after the round has already ended:** rejected (no-op).

### Security Considerations

- Submission is scoped to the authenticated player's own team membership and currently-held question — a member cannot submit on behalf of another teammate or for a question they don't currently hold.
- Scoring is entirely server-side, from the server-held `tabletHolds` state — the client never asserts which question it holds.

### Constraints

- No schema change — `TeamRotationState`/`TeamRoundResult` already exist from Unit 1.
- Builds and tests against seeded `Team`/`Question` data (Units 04/05 are still gated) — same precedent as Units 03, 06, 08, 10.
- Does not build the partition-collaboration round (Unit 14).
- Does not build team-level results/export/correction display (Unit 12's `TEAM` scope, or Unit 15's school total) — this unit only produces `TeamRoundResult`, consumed later.
- No early-finish bonus — not built, not applicable to team rounds.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Keep the rotation order fixed and simple (e.g. a stable list of active member ids) — nothing in the decided rules calls for anything more elaborate.
- The "incorrect submit stays in circulation" interpretation (see Context) should be easy to flip if the stakeholder clarifies otherwise later — isolate it in one function.

### Related Features

- **Depends on:** Unit 08 (puzzle-evaluation logic, reused here), Unit 07 (preparation sequence, timer patterns), Unit 11 (the generic "start a stage" command already works for the Team stage).
- **Depended on by:** Unit 14 (the Team stage's round 2, started by this unit's auto-advance completion), Unit 15 (school total uses this round's `TeamRoundResult`), Unit 12 (results/export, once `TEAM` scope is exercisable).

## Acceptance Criteria

1. A team of 4 is dealt 4 of the round's 10 default questions at round start, one per member.
2. Every `rotationPeriodSeconds` (default 60), each member's current question and its partial grid move to the next member; members never move.
3. A correct submission scores `teamPointsPerQuestion` immediately and removes that question from circulation, refilling from the queue if one remains.
4. An incorrect submission makes no score change and leaves the question in circulation for the next rotation.
5. The round ends once every question is correctly answered, or the optional `teamTotalTimeSeconds` elapses, whichever comes first; the team's final score is `correctCount × teamPointsPerQuestion`.
6. A submit for a question the tablet no longer holds is rejected and the client is shown the question currently held instead.
7. No early-finish bonus is computed for this round under any circumstance.
8. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- The partition-collaboration round — Unit 14.
- Team-level results display, export, and score correction exercised for real — Unit 12/15, once built on top of this unit's `TeamRoundResult`.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
