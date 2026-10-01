# Unit 15: School ranking and competition copy — DRAFT, awaiting approval

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (not listed in `../specs/00-build-plan.md`, "Units that cannot be specified").
> Present this spec for review before starting the unit, per the methodology.

## Goal

Once a category's Individual stage and both Team rounds are finalized, each school's total is computed as an exact decimal (the individual sum of **all** that school's players in the category × the coefficient, plus the team's two-round sum) and schools are ranked on it; separately, the controller can copy a competition's settings, questions and judges into a brand-new one, never carrying over participants or results.

Goal in one testable sentence: **a school's total — (sum of every one of its players' individual two-round totals in the category) × 0.6 (default) + (team round 1 score + team round 2 score) — is stored as an exact, unrounded decimal and schools are ranked on it within the category; copying a competition produces a new `CREATED` competition with the same categories, round settings, scoring configuration, questions and judge list, but zero participants, teams, accounts or results.**

## Context

- **What already exists:** Unit 09's individual ranking and `RankingSnapshot` pattern, Unit 13's rotation-round `TeamRoundResult`, Unit 14's partition-round `TeamRoundResult` (both finalized per team per category). **This unit adds no new tables** — `RankingSnapshot` (`scope = SCHOOL`) and `Competition.copiedFromCompetitionId` already exist from Unit 1.
- **Where this lives:** the school total and school ranking belong to the **Ranking** module, which explicitly owns "the school total" (`../architecture.md`, "System boundaries") — extends `backend/src/modules/ranking/` from Unit 09. Competition copy belongs to the **Competition** module, which explicitly owns "competition copy (CMP-100)" — extends `backend/src/modules/competition/` from Unit 03.
- **School total formula** [C] (SCR-004, SCR-013): `individual sum × schoolCoefficient (default 0.6) + team two-round sum`, stored and ranked as an **exact decimal, never rounded or truncated** — reuses `ScoringConfiguration.schoolCoefficient` (Unit 03).
- **The individual sum counts every one of the school's players in the category, not only the team's members** [T] (SCR-018, resolves U-04): "school total" reflects the school's overall performance in the category, a genuinely different, larger set of players than the 2–6 on the team. This requires summing `IndividualRoundResult.totalScore` (both rounds) across **every** `Participant` with that `schoolId` and `categoryId`, not just `Team.participants`.
- **Team part is the sum of both Team rounds** [C]: `TeamRoundResult.score` from Unit 13 (rotation) + Unit 14 (partition), for that school's one team in the category [C] ("exactly one team per school per category," `../data-model.md`).
- **Computed once the category's data is complete:** the school total for a category needs every one of that school's players' Individual results finalized (Unit 08/09) **and** both Team rounds finalized for that school's team (Units 13, 14) — in practice, this lines up with the category reaching the end of the fixed structure, the same point Unit 11's whole-competition-finish check looks at.
- **School ranking tie-break — same unresolved extension as Unit 09, not guessed here either:** the team's proposed extension (for a school, the sum of submission times of all that school's players) is **not confirmed** (still open, U-22, `unmade-decisions.md` §1). **A genuine tie in school total gets shared rank**, exactly as Unit 09 resolved it for individual ranking — this unit reuses that same tie-break function rather than inventing a school-specific one.
- **Participant/team seed data:** since Units 04/05 remain gated, this unit's own testing uses the same seeded `Participant`/`Team`/`School` data established by earlier units (03, 06, 08, 13, 14).
- **Competition copy, resolved** [C] (CA-004, cited as CMP-100 in `context/`, consistent with Unit 03's citation): copying a competition **keeps settings, questions and judges** — it **never carries over participants, always re-imported fresh** [T] (CMP-103, resolves U-10), "since student data is deleted 15 days after the original competition regardless" (`../data-model.md`). The copy is a **new** `Competition` row (`status = CREATED`, `copiedFromCompetitionId` set to the source), which must go through Unit 03's normal publish flow again, including a fresh participant import (Unit 04) before it can publish.
- **A resolved nuance on "keeps... judges":** the same `Judge` entities get new `CompetitionJudgeAssignment` rows on the copy, carrying over their **ranges as a starting point** — but since participants aren't copied, the new competition's participant numbers will be freshly generated on its next import and may not land on the same counts as the original. **The controller is expected to review and adjust ranges after the new import**, using Unit 06's existing "changeable at any time" range-editing — this unit does not guarantee the copied ranges are still accurate post-import, only that they're copied as a starting point.
- **An assumed, flagged detail:** which competitions can be copied isn't restricted anywhere in the documents — this unit allows copying from a competition in any status (`FINISHED`, `CANCELLED`, or even still in progress), since nothing about the source competition's own state affects what's being copied (settings/questions/judges only — no results or participants carry over either way). A reasonable default, not a decided rule.

## Implementation Details

1. **School total computation.** Triggered once, per category, when every one of that school's players has a finalized `IndividualRoundResult` for both Individual rounds **and** that school's team has finalized `TeamRoundResult` rows for both Team rounds: `schoolTotal = (Σ IndividualRoundResult.totalScore for every Participant with this schoolId/categoryId) × ScoringConfiguration.schoolCoefficient + (rotationResult.score + partitionResult.score)`, stored as an exact decimal (no floating-point rounding).
2. **School ranking.** Sort schools within a category descending by `schoolTotal`; a genuine tie shares rank (reusing Unit 09's tie-break function). Store as `RankingSnapshot` (`scope = SCHOOL`, `isFinal = true`).
3. **Competition copy.** Given a source `competitionId`, create a new `Competition` (`status = CREATED`, `copiedFromCompetitionId` = source). Deep-copy: `CompetitionCategory` rows, the fixed `Stage`/`Round`/`RoundSettings` structure (carrying over the source's customized values, not just defaults), `ScoringConfiguration`, `QuestionSet`/`Question` rows (new rows, scoped to the new competition), and `CompetitionJudgeAssignment` rows (same `Judge` entities, same ranges as a starting point). **Do not copy** `School`/`Team`/`Participant`/`Account` (player), `Attempt`/`Answer`/`IndividualRoundResult`/`TeamRoundResult`, `ScoreCorrection`, `RankingSnapshot`, or any `StoredFile`/`ImportBatch`.
4. **Frontend.** A school-ranking view (reusing Unit 09's big-screen/results display patterns) and a "copy this competition" action on the controller's competition list/detail screen, landing on the new competition's (unpublished) setup screen.

### Inputs

- Copy: `sourceCompetitionId`.

### Expected Behavior

- Once a category's Individual stage and both Team rounds are done, every school in that category has a computed total (exact decimal) and a rank among the other schools in the same category.
- Two schools with an identical total share the same rank.
- Copying a competition produces a new, unpublished competition with the same categories, round settings, scoring configuration, questions and judge list as the source, and nothing else — no participants, no results.
- The copy must be published again through the normal flow (Unit 03), which requires importing participants fresh.

### Components Involved

- **Backend (`ranking` module):** `school-ranking.service.ts` (the school-total computation, reusing Unit 09's tie-break).
- **Backend (`competition` module):** `competition-copy.service.ts` (the deep-copy operation).
- **Frontend:** the school-ranking display, the "copy competition" action.

### API Contract (Working Position for this unit)

- `GET /api/competitions/:id/categories/:categoryId/school-ranking` — returns the category's school ranking (provisional or final, same pattern as Unit 09's individual ranking).
- `POST /api/competitions/:id/copy` — returns the newly created (unpublished) competition.

### Error Cases

- **School-ranking request for a category whose data isn't yet complete:** returns whatever is computable so far, or an explicit "not yet ranked" state — not an error.
- **Copy of a nonexistent competition:** rejected.

### Security Considerations

- Both the school-ranking read and the copy action require a valid `CONTROLLER` session, consistent with every other setup/results action in this project [C] (ROL-002).

### Constraints

- No schema change — every entity this unit touches already exists from Unit 1.
- Does not implement the unconfirmed school-level submission-time tie-break extension (U-22) — reuses Unit 09's shared-rank fallback.
- Does not rebuild Unit 12's export — once `RankingSnapshot(scope=SCHOOL)` rows exist, Unit 12's already-generic export mechanism picks them up with no changes needed here.
- Does not validate or auto-adjust copied judge ranges against the new competition's (not-yet-imported) participant numbers — the controller reviews and adjusts them after the fresh import, using Unit 06's existing range-editing.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Reuse Unit 09's `breakTie()` function directly rather than writing a parallel school-level tie-break — the resolution is identical (shared rank, pending the same open extension).
- The deep-copy operation should be a single transaction — a partially copied competition (e.g. questions copied but judges not) would be a confusing state to debug or clean up.

### Related Features

- **Depends on:** Unit 09 (individual ranking, the tie-break function reused here), Unit 13 (rotation `TeamRoundResult`), Unit 14 (partition `TeamRoundResult`), Unit 03 (the structure/publish flow the copy re-enters), Unit 06 (judge range editing, used post-copy).
- **Depended on by:** Unit 12 (export, once school-level data exists, with no rebuild needed).

## Acceptance Criteria

1. A school's total is computed as an exact decimal: (sum of every one of its players' individual two-round totals in the category) × the coefficient, plus the team's rotation-round score plus its partition-round score.
2. Schools are ranked within each category on that total; a genuine tie shares rank.
3. Copying a competition creates a new `CREATED` competition with the same categories, round settings, scoring configuration, question sets/questions and judge assignments as the source.
4. The copy carries over zero participants, teams, player accounts, attempts, answers, results, corrections, rankings, or files.
5. The copy must be published again through Unit 03's normal flow before it can run.
6. A non-controller session cannot read school rankings or copy a competition.
7. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- The unconfirmed school-level submission-time tie-break extension (U-22) — shared rank is used instead.
- Rebuilding or extending Unit 12's export mechanism — it already picks up school-level data generically.
- Validating or auto-adjusting copied judge ranges against a not-yet-imported participant set.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
