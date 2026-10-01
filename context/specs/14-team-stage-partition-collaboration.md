# Unit 14: Team stage — partition collaboration (second round) — DRAFT, awaiting approval

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it — build plan: "**Waits:** nothing blocking — the real regulation numbers for TEM-006 to TEM-008 can replace the working positions later without a rebuild."
> **A data-model gap was found while drafting this spec, and is now fixed.** `RoundSettings` had no field for this round's puzzle count, total time or points-per-puzzle (TEM-006–TEM-008), unlike the rotation round's `teamQuestionCount`/`teamTotalTimeSeconds`/`teamPointsPerQuestion`. **Resolved 2026-10-01, directed by the project owner:** `partitionPuzzleCount`/`partitionTotalTimeSeconds`/`partitionPointsPerPuzzle` added to `RoundSettings` in `../data-model.md` (see its "Amendment: partition-round settings added" note) — this unit no longer waits on anything.
> Present this spec for review before starting the unit, per the methodology.

## Goal

A team of 2–6 runs the Team stage's second round ("齐心协力"): each of the round's puzzles (default 3) is split into contiguous row-bands, one per active member, with extra rows going to the first bands; each member can edit only their own band; a puzzle scores only once every band is combined into a fully correct grid, with no early bonus; the round ends once every puzzle is solved or its total time (default 30 minutes) runs out.

Goal in one testable sentence: **a 4-member team's first puzzle is split into 4 row-bands (extra rows to the first bands if the row count doesn't divide evenly); each member can edit only their own band; the puzzle scores `partitionPointsPerPuzzle` (default 20) the moment the combined grid is fully correct, and the team moves to the next puzzle; after 3 puzzles (default) or 30 minutes (default), whichever comes first, the round ends and the team's score is solved-puzzle-count × `partitionPointsPerPuzzle`.**

## Context

- **What already exists:** Unit 13's rotation-round pattern (team-round preparation reuse, server-authoritative timing, puzzle evaluation reused from Unit 08) and the auto-advance hook it left for this round. **This unit adds no new tables** — `TeamPartitionState` already exists from Unit 1. **It needed new fields on `RoundSettings`, now added** — see below.
- **Where this lives:** the block-split and per-member edit-restriction state belongs to the **Gameplay** module, which explicitly owns "team rotation queue and **partition-block state** (TEM-004, **TEM-005**)" (`../architecture.md`, "System boundaries") — backend code goes in `backend/src/modules/gameplay/`, reusing `backend/src/modules/scoring/` for the combined-grid check.
- **`RoundSettings` amendment, applied 2026-10-01:** `partitionPuzzleCount` (int, default 3, TEM-006), `partitionTotalTimeSeconds` (int, default 1800 = 30 min, TEM-007), `partitionPointsPerPuzzle` (int, default 20, TEM-008) — now in `../data-model.md` ("Amendment: partition-round settings added"). Named distinctly from the rotation round's `team*` fields to avoid conflating two different rounds' numeric values on the same `RoundSettings` row. **All three remain controller-customizable per competition, same as every other round value, and are explicitly working positions — not sourced from the real regulation** [T] (TEM-006–TEM-008) — "closed, no stakeholder question coming" per `competition-rules.md` §8: these are controller-configurable, so whoever sets up a real competition enters the regulation's real numbers directly, once they have them.
- **Block split** [C] (TEM-005, resolves U-91): the puzzle's grid is cut into **contiguous horizontal row-bands**, one per **active** team member (2 to 6), **as equal as possible, with extra rows going to the first bands** — e.g. a 9-row grid split 4 ways is `[3, 2, 2, 2]`, not `[2, 2, 2, 3]`. Works for any grid shape, never assumes 9×9 [C] (BLD-011). **An assumed, flagged detail:** the split is computed once per team at round start and reused for every puzzle in the round (nothing in the documents says to reshuffle it between puzzles) — a reasonable, low-risk default, not a hard rule.
- **Edit restriction** [C] (TEM-005): each member can edit **only their own band**. **An assumed, flagged detail:** the rest of the grid is shown **read-only, not hidden** (so the team can see the whole puzzle for context) — nothing in the documents specifies either way; this is a reasonable UI default, not a decided rule, and easy to flip later.
- **Scoring, all-or-nothing per puzzle, no early bonus** [C] (SCR-001, SCR-002): a puzzle scores `partitionPointsPerPuzzle` only once **every** band is filled and the **combined** grid is fully correct — reusing Unit 08's puzzle-evaluation logic (BLD-010) against the combined grid rather than one member's submission. **A resolved interpretation, flagged because there's no explicit "submit" described for this round** (unlike the rotation round's per-question submit): the server re-checks the combined grid automatically as members autosave (reusing Unit 07's autosave pattern per member, extended to a shared puzzle); there is no individual "I'm done" action — the puzzle simply scores the instant the combined grid becomes fully correct.
- **Round end condition, mirroring Unit 13's pattern:** the round ends once every puzzle in the round (`partitionPuzzleCount`, default 3) has scored, **or** `partitionTotalTimeSeconds` (default 1800) elapses, whichever comes first. A puzzle never reached, or left incomplete/incorrect when time runs out, contributes 0 — only puzzles that reached a fully correct combined state count, consistent with the all-or-nothing rule and with Unit 13's "only answers already submitted and correct count" pattern for a timed-out team round.
- **Scheduled right after Unit 13** [T] — "the school total needs both team rounds," per `../specs/00-build-plan.md`. This round's `TeamRoundResult` and Unit 13's are both inputs to Unit 15's school total.
- **This is the Team stage's last round.** Once it finalizes for every team in every category, Unit 11's generic "automatic whole-competition finish" check (extended from Unit 08's per-stage check) is what actually completes — this unit triggers that check, it doesn't re-implement it.

## Implementation Details

1. **Round start, puzzle 1.** After preparation (Unit 07's sequence, unchanged), compute the active-member row-band split for the team (as equal as possible, extra rows to the first bands) and store it in `TeamPartitionState` (`puzzleIndex = 0`). Deliver the puzzle to every member's client, each with only their own band editable.
2. **Per-member editing.** Reuses Unit 07's autosave pattern per member, scoped to their own band only — the server rejects any edit to a cell outside the member's assigned row range.
3. **Combined-grid check.** After each autosave, check whether every band is filled; if so, evaluate the full combined grid against the puzzle's solution (Unit 08's logic, BLD-010). If fully correct: award `partitionPointsPerPuzzle` to the team's running score, advance `puzzleIndex`, and deliver the next puzzle with the **same** row-band split (see the flagged assumption above). If this was the last puzzle (`puzzleIndex = partitionPuzzleCount`), finalize the round (step 4).
4. **Round end and finalize.** Triggered by completing `partitionPuzzleCount` puzzles, or by `partitionTotalTimeSeconds` elapsing first. Finalize `TeamRoundResult` (`correctCount` = puzzles solved, `score = correctCount × partitionPointsPerPuzzle`, `completionTimeSeconds` set only if ended by completing every puzzle, not by timeout).
5. **Stage/competition completion.** Once every team's round-2 result is finalized across every category, call into Unit 11's extended "automatic whole-competition finish" check — this round is the last one in the fixed structure.
6. **Frontend.** The partition-round tablet view: the full grid with only the member's own band editable, the rest shown read-only; a visible indicator of puzzle progress (e.g. "puzzle 2 of 3").

### Inputs

- Per-member grid edits, scoped to cells inside that member's assigned row range only.

### Expected Behavior

- A 4-member team sees puzzle 1 split into 4 row-bands; each member edits only their own rows and can see the rest of the grid but not change it.
- The puzzle scores the moment the combined grid (all four bands together) is fully correct — no one has to click a separate "submit."
- The team moves immediately to puzzle 2 with a fresh grid, same band assignment.
- After 3 puzzles (default) are solved, or 30 minutes (default) pass, the round ends; the team's score is `(puzzles solved) × partitionPointsPerPuzzle`.

### Components Involved

- **Backend (`gameplay` module):** `team-partition.service.ts` (block-split computation, per-member edit scoping, combined-grid check, round-end finalize), reusing `scoring.service.ts` from Unit 08.
- **Frontend:** the partition-round tablet view under `frontend/src/features/gameplay/`.

### API Contract (Working Position for this unit)

- WebSocket: `partition:deal` (puzzle + this member's band), `partition:puzzle-solved` (advances to the next puzzle), `partition:round-ended`.
- Autosave reuses Unit 07's endpoint/channel, scoped so a member can only write cells inside their band.

### Error Cases

- **An edit to a cell outside the member's assigned band:** rejected.
- **A team with fewer than 2 or more than 6 active members at round start:** flagged, not scored in this unit's own tests — team size is validated elsewhere (Unit 04's import); this unit assumes a valid team size as an input.

### Security Considerations

- Edit scoping is enforced server-side per cell, not just hidden client-side — a member cannot write outside their band even by bypassing the UI.
- The combined-grid check and scoring are entirely server-side; no member's client reports "my band is correct."

### Constraints

- Builds and tests against seeded `Team`/`Question` data (Units 04/05 are still gated) — same precedent as Unit 13.
- Does not build team or school results/export (Units 12/15).
- No early-finish bonus — not applicable to this round.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Isolate the "same split reused across puzzles" and "rest of the grid read-only, not hidden" assumptions in clearly named functions/flags, so either can be changed without touching the rest of the round logic if the stakeholder clarifies otherwise.
- Reuse Unit 08's puzzle-evaluation function unchanged — the only difference here is that the grid being checked is assembled from several members' bands, not one player's full submission.

### Related Features

- **Depends on:** Unit 13 (the Team stage's round 1, scheduled immediately before this one), Unit 08 (puzzle-evaluation logic), Unit 11 (the whole-competition-finish check this unit's completion triggers).
- **Depended on by:** Unit 15 (school total needs both team rounds' `TeamRoundResult`), Unit 12 (results/export, once `TEAM` scope is exercisable).

## Acceptance Criteria

1. A team's puzzle is split into contiguous row-bands, one per active member (2–6), as equal as possible, with extra rows going to the first bands.
2. A member can edit only their own band; an edit to any other row is rejected.
3. A puzzle scores `partitionPointsPerPuzzle` the instant the combined grid (every member's band together) is fully correct, with no separate submit action and no early bonus.
4. The team advances to the next puzzle immediately after the current one scores, using the same row-band split.
5. The round ends once `partitionPuzzleCount` puzzles are solved or `partitionTotalTimeSeconds` elapses, whichever comes first; an incomplete or unreached puzzle scores 0.
6. The team's final round score is `(puzzles solved) × partitionPointsPerPuzzle`.
7. Once every team's result for this round is finalized, the whole-competition-finish check (Unit 11) is triggered.
8. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Team and school results/export/correction exercised for real (Units 12, 15).
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
- Resolving the two flagged UI/behavior assumptions (band-split reuse across puzzles, read-only visibility of other bands) as anything more than a reasonable default — open to revision if clarified later.
