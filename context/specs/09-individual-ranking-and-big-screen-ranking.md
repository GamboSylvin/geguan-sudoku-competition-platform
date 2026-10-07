# Unit 09: Individual ranking and big-screen ranking — APPROVED (2026-10-07)

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it. **U-22 is now fully resolved** (SCR-020, 2026-10-07, project-owner decision: the tie-break submission-time extension sums across both rounds for an individual) — after this unit was already built and approved. The code's `breakTie` function still implements the pre-SCR-020 shared-rank fallback described below; bringing it in line with SCR-020 is a pending follow-up for whoever codes next, not yet done.
> Present this spec for review before starting the unit, per the methodology.

## Goal

As each participant's Individual-round result finalizes (Unit 08), their category's provisional cumulative ranking updates immediately, without waiting for anyone else; once every participant in a category finishes both Individual rounds, the stage's final ranking is computed and stored; the big screen automatically cycles through category rankings on a server-driven timer and never computes a rank itself.

Goal in one testable sentence: **a finalized Individual-round result updates its category's provisional ranking within 2 seconds; a category's final stage ranking is computed once every participant in it has finished both rounds, with a genuine score tie resolved to shared rank (not guessed); the big screen receives a pushed ranking display every `rankingCycleSeconds` and renders only what the server sends.**

## Context

- **What already exists:** Unit 03's `Competition`/`CompetitionCategory`/`ScoringConfiguration` (`rankingCycleSeconds`, default 180) and the big-screen link (`bigScreenLinkToken`), and Unit 08's finalized `IndividualRoundResult` rows, which this unit reads. **This unit adds no new tables** — `RankingSnapshot` already exists from Unit 1 (`../data-model.md`).
- **Where this lives:** cumulative score, tie-breaking and provisional/final ranking belong to the **Ranking** module; the rotating display and the fact that it never calculates belong to the **Big Screen** module (`../architecture.md`, "System boundaries") — backend code goes in `backend/src/modules/ranking/` and `backend/src/modules/big-screen/`.
- **Scope is Individual-stage only.** The team stage (rotation relay, partition collaboration — Units 13, 14) and the school total/ranking (Unit 15) don't exist yet; this unit ranks participants within a category on their two Individual-round scores only. Team and school ranking are explicitly later units' builds, not this one's.
- **Categories are ranked separately, never mixed** [P] (EVT-002) — every ranking computation and every big-screen leaderboard is scoped to one category at a time.
- **Provisional ranking updates immediately per finalized round, not batched** [T] (`../architecture.md`, "Data flow"): "a provisional ranking updates immediately when a round result is finalized, without waiting for every participant." Performance target [C] (U-58): within 2 seconds of the triggering submission.
- **Tie-break — the confirmed part and the genuinely open part** [T]/[C] (SCR-017, narrows U-22): the stakeholder confirmed that **earlier submission time wins a tie, superseding the client document's "rank by round 1 score" rule** — but *how* "submission time" combines across an individual's **two** rounds is the team's proposed extension, explicitly **not yet confirmed** (sent back to the stakeholder, still open in `unmade-decisions.md` §1, U-22). **This unit does not guess that aggregation.** A genuine tie in cumulative score (after both rounds) receives **shared rank**, and each round's `submittedAt` (already stored by Unit 08's `Attempt`/`IndividualRoundResult`) stays available so the tie-break can be upgraded to use it, in whatever combination gets confirmed, without a rebuild.
- **Students never see their own score or rank before `FINISHED`** [C] (SUB-007, BLD-029) — this unit computes and stores ranking data and pushes it to the **big screen** and (later) the **controller's** view; it does **not** expose any ranking or score to a player-facing endpoint. The player-facing score reveal at competition `FINISHED` is Unit 12's concern (results), not this unit's.
- **Big screen never computes a rank** [T] (invariant 8): it receives whatever the server pushes and renders it; all computation happens in the Ranking module.
- **Ranking cycle** [T]/[C] (BSC-002): every `rankingCycleSeconds` (default 180, customizable per competition via `ScoringConfiguration`), the big screen automatically rotates through category leaderboards. After a stage finishes, its final ranking continues to appear in the cycle while the competition waits for the controller to start the next stage [C] (RND-006) — the big screen does not go blank between stages.
- **Controller-driven display switching is out of scope here.** `BigScreenDisplayState.mode` (`RANKING`/`PLAYER_CLOSEUP`/`TEAM_SPLIT`/`PAUSED`/`FINAL`) already exists in the schema; this unit only drives the default, automatic `RANKING` mode. Manually switching to a one-student or team close-up, or to the paused/finished displays, is a controller command — Unit 11's build ("control the big screens"), not this one's.

## Implementation Details

1. **Provisional ranking update.** Triggered by Unit 08 finalizing an `IndividualRoundResult`: recompute the triggering participant's category cumulative score (sum of finalized `IndividualRoundResult.totalScore` for that participant's stage so far) and re-sort that category's provisional ranking. Push the update over WebSocket. Do not wait for any other participant.
2. **Final stage ranking.** Once every participant in a category has a finalized `IndividualRoundResult` for both Individual rounds, compute that category's final ranking: sort descending by cumulative `totalScore`; a genuine tie (equal cumulative score) is broken by **the sum of both rounds' submission times, earlier wins** [T] (SCR-020, resolves U-22, confirmed 2026-10-07 — a project-owner working position, revisable if the stakeholder answers differently). **Not yet implemented in the live code**, which still returns shared rank for every tie — see the header note. Store as a `RankingSnapshot` (`scope = INDIVIDUAL`, `isFinal = true`) per category.
3. **Big-screen push cycle.** A server-side timer (per competition, length = `ScoringConfiguration.rankingCycleSeconds`) rotates through each category's current ranking (provisional if the stage is still running, final once it's finished) and pushes the next one to every connected big-screen client. Paginate when a category's leaderboard doesn't fit one screen (participant count varies; the exact per-page threshold is an implementation detail, not a decided rule).
4. **Big-screen client.** Connects via the `bigScreenLinkToken` route (already built, Unit 03), no login [C] (BSC-001); renders exactly what's pushed (rank, player name, score, completion time per `../ui-context.md`, "Big screen" columns) and performs no computation of its own.
5. **Frontend:** the big-screen ranking display component under `frontend/src/features/big-screen/`.

### Inputs

- No direct user input — this unit is driven entirely by Unit 08's finalized results and the competition's `rankingCycleSeconds` setting (already configurable from Unit 03).

### Expected Behavior

- The moment one participant's round result finalizes, their category's ranking updates and reflects their new position — participants who haven't finished yet aren't blocked on.
- Once every participant in a category finishes both Individual rounds, that category's final ranking is fixed and stored.
- Two participants with the exact same cumulative score after both rounds share the same rank; no guess is made about which "finished first."
- The big screen, with no login, shows a rotating leaderboard that changes automatically every `rankingCycleSeconds`, cycling through each category in turn; it keeps showing a finished stage's final ranking while the next stage hasn't started yet.

### Components Involved

- **Backend (`ranking` module):** `ranking.service.ts` (provisional recompute on each finalized result, final-ranking computation, the shared-rank tie handling), `ranking.repository.ts` (`RankingSnapshot`).
- **Backend (`big-screen` module):** `big-screen.service.ts` (the rotation timer, pushing the current category's ranking), reading `ScoringConfiguration.rankingCycleSeconds`.
- **Realtime:** the handler that listens for Unit 08's round-finalization signal and triggers step 1; the big-screen push channel, scoped by `bigScreenLinkToken`.
- **Frontend:** the big-screen ranking display.

### API Contract (Working Position for this unit)

- WebSocket (big screen, scoped by `bigScreenLinkToken`): `ranking:update` — pushes `{ categoryId, scope: 'INDIVIDUAL', isFinal, rows: [{ rank, participantName, score, completionTimeSeconds }] }` on each cycle tick.
- `GET /api/competitions/:id/categories/:categoryId/ranking` — the controller-facing read (for later units to build on, e.g. Unit 11's live view); returns the current provisional or final ranking.

### Error Cases

- **A category with zero finalized results:** shows as empty/not-yet-ranked in the cycle, not an error.
- **Big-screen connection with an invalid or regenerated token** (Unit 03's `bigScreenLinkToken`): rejected — consistent with the token being the only gate on a no-login endpoint [C] (BSC-001).

### Security Considerations

- The big-screen channel is gated only by the unguessable `bigScreenLinkToken` [C] (BSC-001) — no ranking data more granular than what's documented for the big screen (rank, name, score, completion time) is ever pushed to it; no player-identifying data beyond name is exposed.
- No endpoint in this unit returns a player's own score or rank to a player session — that reveal happens only at competition `FINISHED`, which is Unit 12's build.

### Constraints

- No schema change — `RankingSnapshot` already exists from Unit 1.
- **Tie-break now confirmed** (SCR-020, resolves U-22, 2026-10-07) — sum of both rounds' submission times, earlier wins. The live code does not implement this yet; it still returns shared rank for every tie. Bringing `breakTie` in line with SCR-020 is a pending code follow-up, not a context-folder gap.
- Does not build team or school ranking — Units 13/14 (team results) and 15 (school total and ranking) build on top of this unit's pattern.
- Does not build controller-driven big-screen display switching (one-student close-up, team split, paused/finished modes) — Unit 11.
- Does not reveal any score or rank to a player session — Unit 12.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- The tie-break is a single, named function (`breakTie(a, b)`) — exactly so that implementing SCR-020 (sum of both rounds' submission times) only means changing that one function, not the surrounding ranking computation. It currently still returns "shared" and needs updating.
- At ~800 concurrent clients (U-60), recomputing a whole category's ranking on every single finalized result should stay cheap (sort within one category, not the whole competition) — categories are ranked separately specifically so this stays small.

### Related Features

- **Depends on:** Unit 03 (`ScoringConfiguration.rankingCycleSeconds`, the big-screen link), Unit 08 (`IndividualRoundResult`, the source of every ranking computation).
- **Depended on by:** Unit 11 (controller-driven big-screen display switching builds on this unit's ranking data and the `RANKING` mode it drives by default), Unit 12 (results/export read the final `RankingSnapshot`), Unit 15 (school ranking is computed on top of this unit's individual ranking plus the team stage's results).

## Acceptance Criteria

1. When one participant's Individual-round result finalizes, their category's provisional ranking updates within 2 seconds, without waiting for other participants in the category.
2. Once every participant in a category has finished both Individual rounds, that category's final ranking is computed and stored (`RankingSnapshot`, `isFinal = true`).
3. Two participants with an equal cumulative score after both rounds are ranked by the sum of their submission times across both rounds, earlier wins (SCR-020) — **currently unmet by the live code**, which still returns shared rank; tracked as a pending follow-up, not a spec gap.
4. The big screen receives a ranking push every `rankingCycleSeconds` (default 180, controller-customizable) and performs no ranking computation of its own.
5. Categories are never mixed in a single ranking or leaderboard.
6. A finished stage's final ranking remains visible in the big-screen cycle while the competition waits for the next stage.
7. A big-screen connection with an invalid or stale link token is rejected.
8. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Team ranking and school ranking (Units 13, 14, 15).
- Controller-driven big-screen display switching: one-student close-up, team split view, the paused and finished displays (Unit 11).
- Revealing any score or rank to a player session before `FINISHED` (Unit 12).
- ~~The unconfirmed submission-time tie-break extension (U-22)~~ — now confirmed (SCR-020); implementing it in `breakTie` is in scope as a follow-up, not out of scope.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
