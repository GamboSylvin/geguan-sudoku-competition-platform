# Unit 12: Results, corrections, export and purge — APPROVED (2026-10-08)

> **Approved spec** [T] (BLD-046, blanket project-owner approval for the final build push). This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it — build plan: "**No open items remain** — export format (U-08) and purge scope (U-59, U-62) are both resolved."

## Goal

The controller views results, corrects a score with a mandatory reason (which recalculates ranking and is logged), and exports scores/rankings/answers to Excel; 15 days after the competition ends, answers, scores, student accounts, archived attempts, the correction log and the uploaded participant Excel are permanently deleted, while setup, questions and judges are kept.

Goal in one testable sentence: **a controller corrects a participant's round score with a reason; the change is logged, the ranking recalculates, and the export reflects it; a competition that reached its 15-day mark has its answers, scores, student accounts and related personal data deleted, with setup, questions and judges still present; results and export are never available for a cancelled competition.**

## Context

- **What already exists:** Unit 08's finalized `IndividualRoundResult`/`Attempt`/`Answer`, and Unit 09's ranking and `RankingSnapshot`. **This unit adds no new tables** — `ScoreCorrection`, `PurgeSchedule`, `AuditLog` and `StoredFile` already exist from Unit 1 (`../data-model.md`).
- **Where this lives:** results viewing, corrections and the purge belong to the **Results** module (`../architecture.md`, "System boundaries") — backend code goes in `backend/src/modules/results/`.
- **Results view, controller-only** [T]/[C]: the controller is the only role with results/correction/export access — consistent with the documented access rules (`../data-model.md`, "Access rules": "only the controller may write `Participant` and `ScoreCorrection`"). **Never available for a `CANCELLED` competition** — Unit 11 explicitly defers this to this unit: "no score is computed or finalized from that point on... Unit 12's results/export must treat a `CANCELLED` competition as having nothing to show." This unit enforces that check.
- **Score correction** [P] (RES-003): a mandatory `reason`, logged (`ScoreCorrection` + `AuditLog`), and **ranks recalculate automatically** after a correction — this unit calls back into Unit 09's ranking recompute for the affected category. **A wrong stored solution found after scoring, resolved** [T] (RES-010): no new workflow — the controller corrects the affected students' scores through this same mechanism, nothing additional is built.
- **Correction scope, built generically now, fully exercisable later:** `ScoreCorrection.targetType` is `PARTICIPANT`/`TEAM`/`SCHOOL`. **Only `PARTICIPANT` is testable at this point** — team and school scores don't exist until Units 13/14/15. The schema and the correction/recalculation logic are built for all three scopes now; `TEAM`/`SCHOOL` corrections become exercisable once those units land, with no rebuild of this unit's mechanism.
- **Export** [C] (U-08, resolves export format): Excel (`.xlsx`), containing scores, ranks and the answer per question. No specific layout or column list is imposed — the exact columns are an easy-to-adjust implementation detail, not a system rule. Stored as `StoredFile` (`kind = EXPORT`).
- **15-day purge, resolved in full** [P]/[C] (RES-004, RES-005, RES-009): 15 days after the competition ends, permanently delete: `Answer`, `Attempt` (including archived ones), `IndividualRoundResult`, `TeamRoundResult`, `RankingSnapshot`, `ScoreCorrection` (the correction log), the rest of that competition's `AuditLog` entries [T] (RES-011), student (`PLAYER`-role) `Participant`/`Account`/`Device` rows, the uploaded participant Excel `StoredFile` [C] (RES-009), and — by the same reasoning (student data embedded in it) — any `EXPORT`-kind `StoredFile` generated for that competition. **Kept:** `Competition`/`Stage`/`Round`/`RoundSettings`/`ScoringConfiguration` (setup), `QuestionSet`/`Question` (questions, including the question Excel `StoredFile`), and `Judge`/`CompetitionJudgeAssignment`/judge `Account` rows (judges are never deleted by this schedule).
- **No special legal protection required** [C] (RES-008): the 15-day rule stands as-is, with no extra compliance layer.
- **Purge trigger timing, an implementation note, not a separate decision:** `PurgeSchedule.purgeAt = Competition end + 15 days`. "Competition end" is `finishedAt` for a normal or early finish. A `CANCELLED` competition was never scored and releases no results, so for consistency this unit also starts its purge countdown from `cancelledAt` — nothing in the decided rules distinguishes the two cases, and there's no stated reason to retain a cancelled competition's student data any longer than a finished one's.

## Implementation Details

1. **Results view.** A read-only controller screen: per category and stage, each participant's round scores, bonus, total, completion time, submission type, and current ranking (from Unit 09). Rejected/hidden for a `CANCELLED` competition.
2. **Score correction.** Controller selects a target (participant, for now) and a round; submits a new score and a mandatory `reason`. Creates a `ScoreCorrection` row (`oldScore`, `newScore`, `reason`, `correctedByAccountId`, `correctedAt`), writes an `AuditLog` entry, updates the underlying finalized result, and triggers Unit 09's ranking recompute for the affected category.
3. **Export.** Generates an `.xlsx` file with scores, ranks and the per-question answer for the competition; saves it as a `StoredFile` (`kind = EXPORT`); offers it for download. Rejected for a `CANCELLED` competition.
4. **15-day purge job.** A scheduled job that, once `purgeAt` passes for a `FINISHED` or `CANCELLED` competition with `PurgeSchedule.status` not yet `executed`, deletes everything listed in Context's purge scope, in a single transaction, then sets `executedAt`/`status = executed`. Idempotent — running it again for an already-executed schedule is a no-op.
5. **Frontend.** The results screen, the correction form (score + mandatory reason), the export action, and a small "this competition's data will be purged on [date]" notice on the results screen (informational; no interactive purge control is built — the purge is automatic, not controller-triggered).

### Inputs

- Correction: `targetType` (`PARTICIPANT` for now), `targetId`, `roundId`, `newScore`, `reason` (required, non-empty).
- Export: `competitionId`.

### Expected Behavior

- The controller opens the results screen for a finished competition and sees every participant's scores and current rank, per category.
- The controller corrects one participant's round score, is required to enter a reason, and immediately sees the ranking reflect the change; the correction appears in the change log.
- The controller exports an Excel file containing the current scores, ranks and answers.
- Fifteen days after the competition ends (or is cancelled), its answers, scores, student accounts, archived attempts, correction log and uploaded participant Excel are gone; the competition's setup, questions and judges are still there.
- Neither the results screen nor export is available for a cancelled competition.

### Components Involved

- **Backend (`results` module):** `results.service.ts` (results read, correction, export), `results.repository.ts`, `purge.service.ts` (the scheduled job).
- **Frontend:** the results screen, correction form, export action.

### API Contract (Working Position for this unit)

- `GET /api/competitions/:id/results` — `403`/empty for a `CANCELLED` competition.
- `POST /api/competitions/:id/corrections` — body: `{ targetType, targetId, roundId, newScore, reason }`. `400` if `reason` is missing.
- `GET /api/competitions/:id/export` — returns the generated `.xlsx` file or a link to it; `403` for a `CANCELLED` competition.

### Error Cases

- **Correction with no `reason`:** rejected.
- **Correction, results view, or export on a `CANCELLED` competition:** rejected.
- **Correction referencing a `TEAM`/`SCHOOL` target before Units 13/14/15 exist:** rejected (no such target exists yet) — not a design gap, just nothing to correct yet.
- **Purge job running twice for the same schedule:** no-op, not an error.

### Security Considerations

- Results, correction and export endpoints all require a valid `CONTROLLER` session [C] (ROL-002) — no judge or player access.
- The purge job is a system-internal process, never exposed as an endpoint any role can call directly.

### Constraints

- No schema change — every entity this unit touches already exists from Unit 1.
- Builds `TEAM`/`SCHOOL` correction scope generically but doesn't test it — those targets don't exist until Units 13/14/15.
- Does not build a UI control to trigger the purge manually — it is schedule-driven only, per RES-004.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Reuse Unit 09's ranking-recompute function directly after a correction, rather than re-implementing ranking logic here.
- Run the purge job as a single transaction per competition, so a partial purge (some tables cleared, others not) can never be left behind if it fails partway.

### Related Features

- **Depends on:** Unit 08 (`IndividualRoundResult`/`Attempt`/`Answer`, the data this unit corrects and exports), Unit 09 (ranking recompute), Unit 11 (`Competition.status`/`finishedEarly`/`CANCELLED`, which this unit reads to gate results/export).
- **Depended on by:** Unit 15 (school-level results and export build on this unit's pattern once school ranking exists).

## Acceptance Criteria

1. The controller sees a results view with every participant's scores, bonus, total, completion time and current rank, per category and stage.
2. A score correction requires a reason, is logged in `ScoreCorrection` and `AuditLog`, and immediately recalculates the affected category's ranking.
3. The export produces an `.xlsx` file containing scores, ranks and the per-question answer.
4. Fifteen days after a competition's `finishedAt` (or `cancelledAt`), its answers, scores, student accounts, archived attempts, correction log and uploaded participant Excel are permanently deleted; setup, questions and judges remain.
5. Results viewing, correction and export are all rejected for a `CANCELLED` competition.
6. A non-controller session cannot view results, submit a correction, or export.
7. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Team and school results/correction content (Units 13, 14, 15) — the scope is built generically but not exercised until those units exist.
- Any manual purge trigger or override — the purge is schedule-driven only.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
