# Unit 10: Judge supervision and single-student restart — APPROVED (2026-10-07)

> **Approved by the project owner 2026-10-07.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (not listed in `../specs/00-build-plan.md`, "Units that cannot be specified").

## Goal

A judge sees the live status (connected, submitted, left-the-page count) of only their assigned range of students, scoped to the competition they're assigned to (Unit 06), and can restart one student's round at any point while it's running — archiving the earlier attempt, never deleting it — with no controller approval needed.

Goal in one testable sentence: **a judge sees status rows only for participants inside their own assigned range; restarting one student while their round is active archives the current attempt (visible in a growing restart count), gives the student a blank grid, and keeps the round's shared remaining time unchanged; a judge cannot see or act on any participant outside their range.**

## Context

- **What already exists:** Unit 06's judge list, range assignment and the reusable authority-scoping check; Unit 07's active-round state and server-owned timer; Unit 08's `Attempt`/`Answer`/`RoundParticipation` model. **This unit adds no new tables** — `Attempt.isArchived`, `RoundParticipation.attemptCount` and `RoundParticipation.leftAnswerPageCount` already exist from Unit 1 (`../data-model.md`).
- **Where this lives:** the restart mechanic (archiving an attempt and starting a fresh one) belongs to the **Orchestrator** module, which owns "reset/rematch/replay triggering (ROL-005)" (`../architecture.md`, "System boundaries") — this unit builds the single-student-scoped case of that mechanic; **Unit 11 later reuses the same archive-and-restart operation** for the controller's whole/part reset-or-rematch command, at a wider scope. Backend code for the restart mechanic goes in `backend/src/modules/orchestrator/`; the judge-facing status view and endpoints call into Unit 06's scoping check (`backend/src/modules/identity/`).
- **Judge authority, strictly bounded** [C] (U-55, data-model.md "Access rules"): "No powers beyond what is already documented — status of assigned students (connected, submitted) and single-student restart. Nothing more." This unit enforces that boundary using Unit 06's scoping check on every endpoint it adds.
- **A flagged inconsistency, resolved conservatively:** `competition-rules.md` §6 says a too-late restart's remedy is "the replay of the round, which the judge **or** the controller can trigger," while `data-model.md`'s "Access rules" section (resolved later, 2026-09-30, U-63) and `ui-context.md`'s Judge section both state the judge's powers stop at status-viewing and single-student restart, "nothing more." **This unit follows the later, more specific access-rules resolution:** whole-round replay is **not** built here, regardless of who may eventually be allowed to trigger it — that's Unit 11's call to make when it builds reset/rematch/replay. If the stakeholder intends judges to trigger a full replay too, that needs its own explicit decision before Unit 11 builds it.
- **Restart rule** [C]/[P] (SUB-005, SUB-008, ROL-005): a judge can restart one student's round **only while that round is running** (interpreted here as `Round.status` being `ACTIVE` or `PAUSED` — not `WAITING`, `PREPARATION` or `FINISHED`), as many times as needed, with no controller approval. The earlier attempt is **archived, not deleted**; the student restarts with a **blank grid** and the **round's shared remaining time**, unchanged — restarting one student never touches the round's timer, which Unit 07 already built as shared across every participant in the round. Each restart increments `RoundParticipation.attemptCount`, so the number of restarts stays visible.
- **"Left the answer page" counter** [P]: `RoundParticipation.leftAnswerPageCount`, information only, no penalty. **This unit adds the capture side too** — Unit 07 didn't build this (it's purely in service of judge visibility, with no other consumer) — a small addition to the Gameplay-side frontend: the player's client reports a page-visibility change (navigating away from the answer screen) during an active round, incrementing the counter server-side.
- **"Live ranking" in the judge view, a scope note:** `ui-context.md`'s Judge section lists "the live ranking" as part of what a judge sees, alongside status. **The build plan's own "Depends on" column for this unit lists only 06, 07, 08 — not 09** (ranking). This unit therefore builds the status view **without** a live-ranking panel; wiring Unit 09's ranking feed into the judge view is a small addition made once Unit 09 exists, not a blocker for this unit's acceptance criteria.
- **Team-stage judge view, same scope, later:** [C] (ROL-008) confirms the judge's Team-stage view has the same scope as the Individual stage (status only, no per-member detail) — built when Units 13/14 (team stage) exist, reusing this unit's scoping check, not built here.

## Implementation Details

1. **Judge status view.** For a judge's own assignment (via Unit 06's scoping check), list each assigned participant's current `RoundParticipation.state`, connection status (from Unit 02's `Device`/session tracking), `leftAnswerPageCount`, and the round's remaining time (Unit 07's `remaining()`). Scoped strictly to the judge's own competition and participant-number range — never returns a row outside it.
2. **Left-page tracking.** The player's gameplay client (Unit 07's active-round screen) reports a page-visibility-leave event during an active round; the server increments `RoundParticipation.leftAnswerPageCount`. No penalty, no effect on scoring.
3. **Single-student restart.** A judge triggers a restart for one of their assigned students. The server checks the round is `ACTIVE` or `PAUSED` for that participant; if not, rejects with a specific reason (round not running). On success: mark the current `Attempt.isArchived = true`, create a new `Attempt` (`attemptNumber` + 1, blank), clear the student's working grid in Redis for that round, increment `RoundParticipation.attemptCount`, and reset the participation to active play on the round's unchanged shared remaining time.
4. **Frontend.** A judge dashboard (`frontend/src/features/judge/`) listing assigned students' status, with a restart action per student, and a visible restart count.

### Inputs

- Restart: `participantId` (must be inside the judge's own assigned range on their own assigned competition).

### Expected Behavior

- A judge logs in and sees a list of only their assigned students, each with connection status, round-participation state, and how many times they've left the answer page.
- A judge restarts a student mid-round: the student's screen clears to a blank grid, the round's timer is unaffected, and the restart count for that student increases by one; the earlier attempt's answers are preserved, archived, not visible to the student anymore.
- A judge who tries to view or restart a participant outside their assigned range is rejected.
- A restart attempted on a round that hasn't started yet or has already finished is rejected, naming the reason.

### Components Involved

- **Backend (`orchestrator` module):** `restart.service.ts` (the archive-and-restart operation, single-student scope for this unit; reused at wider scope by Unit 11).
- **Backend (`identity` module):** reuses Unit 06's scoping check, called from the judge-status and restart endpoints.
- **Backend (`gameplay` module):** the small addition for `leftAnswerPageCount` capture.
- **Frontend:** the judge dashboard.

### API Contract (Working Position for this unit)

- `GET /api/judge/students` — returns status rows for the authenticated judge's own assigned range only.
- `POST /api/judge/students/:participantId/restart` — restarts that student's current round; `409` if the round isn't running or the participant is outside the judge's range.
- Realtime: the player client emits a page-visibility-leave event during an active round; the server increments the counter server-side (not client-trusted for the count value itself beyond the leave signal).

### Error Cases

- **Restart for a participant outside the judge's assigned range or competition:** rejected — same scoping check as every other judge-facing action (Unit 06).
- **Restart for a round that is `WAITING`, `PREPARATION` or `FINISHED`:** rejected, naming the round isn't running; the remedy (replay) is out of this unit's scope.
- **Restart with no controller approval required** [C] (SUB-008): not an error case — explicitly, no approval gate exists to bypass.

### Security Considerations

- Every endpoint in this unit requires a valid `JUDGE` session (Unit 02) and passes through Unit 06's authority-scoping check — a judge can never read or act on a participant outside their own assigned range, even by guessing an ID [C] (U-55).
- A judge cannot edit `Participant` rows, change a score, or write to `ScoreCorrection` — this unit builds no endpoint that would allow either, consistent with the documented access rules (`../data-model.md`, "Access rules").

### Constraints

- No schema change — every entity this unit touches already exists from Unit 1.
- Does not build whole-round replay, or any controller action — that's Unit 11 (see the flagged inconsistency above, resolved conservatively: no replay trigger of any kind is built here).
- Does not build the live-ranking panel in the judge view — wired in once Unit 09 exists, not a dependency this unit waits on.
- Does not build the team-stage judge view — Units 13/14, reusing this unit's scoping check.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Build the archive-and-restart operation (step 3) as a function the Orchestrator module exposes publicly, parameterized by scope (one participant here; Unit 11 will call the same function at a wider scope for reset/rematch) — avoids Unit 11 re-implementing the archiving rule.
- The round-running check ("`ACTIVE` or `PAUSED`") is an interpretation of "while the round is running," since the documents don't define the term precisely — flagged here for review, not treated as silently decided.

### Related Features

- **Depends on:** Unit 06 (judge list, range assignment, the scoping check), Unit 07 (active-round state, the shared round timer), Unit 08 (`Attempt`/`RoundParticipation` model, attempt archiving semantics it finalizes).
- **Depended on by:** Unit 11 (the controller's reset/rematch command reuses this unit's archive-and-restart operation at a wider scope), Units 13/14 (the team-stage judge view reuses this unit's scoping check).

## Acceptance Criteria

1. A judge sees status rows (connection, round-participation state, left-page count) only for participants inside their own assigned range and competition.
2. A judge restarts one student's round while it's running: the earlier attempt is archived (not deleted), the student's grid is blank, the round's shared remaining time is unaffected, and the restart count increases.
3. A judge's restart request for a participant outside their assigned range is rejected.
4. A judge's restart request for a round that isn't currently running (`WAITING`, `PREPARATION`, or `FINISHED`) is rejected with a specific reason.
5. A restart requires no controller approval and can be repeated as many times as needed while the round runs.
6. A non-judge session cannot call any endpoint this unit adds.
7. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Whole-round replay, and every controller command (pause, resume, end a round early, finish, reset/rematch at any scope beyond one student, judge takeover, cancel) — Unit 11.
- The live-ranking panel in the judge view — added once Unit 09 exists.
- The team-stage judge view (Units 13, 14) — reuses this unit's scoping check once built.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
