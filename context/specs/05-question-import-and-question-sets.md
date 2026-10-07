# Unit 05: Question import and question sets — DRAFT, awaiting approval

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> **This unit is no longer gated** (`../specs/00-build-plan.md`: removed from "Units that cannot be specified" 2026-10-07) — its three open items are all resolved: **U-94** (BLD-043, temporary OCR exception), **U-99** (BLD-041, the real category scheme), **U-101** (BLD-042, the audio column is ignored). Real question files exist (`context/samples/`).
> **Two new findings surfaced while drafting this spec — flagged below, not silently resolved.** (1) The real files show **several files per category** (one per puzzle variant), which the approved `data-model.md` describes as "one file per category" (BLD-028) — a proposed, not-yet-confirmed reinterpretation is in Context. (2) The **irregular/jigsaw ("不规则") variant's region shapes cannot be extracted from the current file format** — BLD-043's OCR exception covers given cells and the solution, not custom region boundaries. This unit scopes irregular-variant import explicitly **out of scope** until that is resolved — see Out of Scope and Implementation Notes.
> Present this spec for review before starting the unit, per the methodology.

## Goal

A controller imports a category's question file(s) — each a pool of 30–100 questions for one puzzle variant — into `Question` rows with a generic grid, points, and (for non-irregular variants) a complete solution extracted via a temporary, isolated OCR step. Before publish, the controller manually selects exactly 6 pool questions for each of that category's two Individual rounds.

Goal in one testable sentence: **importing a real question file commits every row as a `Question` in the category's pool (`roundId = null`), with `startingGrid`/`solution` correctly reconstructed from the text answer column plus OCR on the embedded grid image for non-irregular variants; any row failure rejects the whole file; the controller then selects 6 pool questions per Individual round, which locks in at that round's preparation (same cutoff as `RoundSettings`), and Unit 03's existing publish check sees a complete assignment.**

## Context

- **What already exists:** Unit 03's `Competition`/`CompetitionCategory`/`Stage`/`Round` (built, live) already auto-creates the fixed 2×2 structure and already runs a publish-readiness check that requires "a complete question set assigned to both of its Individual-stage rounds" — this unit is what actually makes that condition real; it was previously satisfied only by seeded test data. Unit 07/08 (built, live) already consume `Question.solution`/`startingGrid` against hand-transcribed seed data (BLD-026) — this unit replaces that seed data with a real pipeline, without changing Unit 07/08's contract.
- **Where this lives:** question import, validation and round assignment belong to the **Question** module (`../architecture.md`, "System boundaries": "Question import and validation, question packs, **assignment of questions to rounds**, per-question points" — the module boundary already anticipated a separate assignment step). Backend code goes in `backend/src/modules/question/` (currently a skeleton).
- **Real files received 2026-10-07** (`context/samples/`): 12 question files across 3 category folders (一二年级组, 三四年级组, 五六年级组), each category folder holding **several files**, one per puzzle variant (e.g. 一二年级组 has `六宫标准100`, `四宫标准60`, `四宫不规则30`, `四宫对角线30`). Each file has 9 columns: `题目` (instructions), `题目配图` (unused, empty), `题目音频` (unused, empty — **ignored**, BLD-042), `*类目` (variant name, e.g. "四宫标准数独"), `*分数` (points), `*数独底图` (the grid image, `DISPIMG`-embedded), `*水平长度`/`*垂直长度` (grid width/height), `*正确答案` (the blank cells' answers only, as a row-by-row array with gaps at the given-cell positions).
- **Finding #1, flagged, proposed resolution not yet confirmed: `QuestionSet` becomes one per category *per imported file*, not one per category.** The approved `data-model.md` describes `QuestionSet` as "one file per category" (BLD-028) — but the real files show a category needing several files (one per variant) to cover both Individual rounds' worth of puzzle types. **BLD-028's actually-confirmed fact is narrower than that inference**: "each category is uploaded and imported separately" (no sharing *across* categories) — it never said *exactly one file total*. This unit's proposed reading: a `CompetitionCategory` has **one or more** `QuestionSet` rows, each tied to one imported file; `QuestionSet.name` stores that file's variant label (from `*类目` or the filename) so multiple sets under one category stay distinguishable. **No schema change needed** (`QuestionSet.categoryId` already allows many rows per category — nothing currently enforces "exactly one"), but this reading should be confirmed by the project owner before this unit is built, since it revises what BLD-028's own prose implied.
- **Finding #2, flagged, scoped out rather than guessed: the irregular ("不规则") variant's regions cannot be extracted today.** `Question.regions` (BLD-011) needs each puzzle's block/region shape. For **standard, diagonal (对角线), size-comparison (大小), fortress (堡垒) and anti-knight (无马)** variants, the regions are the ordinary N×N box partition, computable directly from `gridRows`/`gridColumns` — no image reading needed (and BLD-010's "no rule checker per variant" means the extra constraint these variants add — diagonal, comparison, adjacency — is never validated by the system anyway; it only compares the final submitted grid against the stored solution). **The irregular variant's region shapes are genuinely custom per puzzle and are not derivable from dimensions alone** — extracting them would mean reading non-rectangular boundaries out of the same embedded image BLD-043 already stretches OCR to cover for given-cell digits, a materially harder computer-vision problem BLD-043's own wording ("the given cells and solution") does not claim to solve. **This unit does not import irregular-variant files** — see Out of Scope. This is a new, narrower gap than U-94 (now resolved); worth its own tracked question if the project owner wants irregular puzzles built later.
- **OCR, isolated and swappable, per BLD-043's explicit build instruction:** given cells (for `startingGrid`) and the full solution (for `solution`) come from running OCR on `*数独底图`'s embedded image, merged with `*正确答案`'s blank-cell values (empirically: every row's image-given positions are exactly `*正确答案`'s blank positions, and the two together cover the whole grid with no overlap — checked across all 12 real files). **This unit isolates the extraction behind one function/interface** (e.g. `extractGivenCells(image, gridRows, gridColumns): GivenCellMap`) that the import service calls — not spread across the import pipeline — so replacing it with a text-based reader later (BLD-043's stated intent) touches one place. **Explicitly temporary and risk-accepted** [T] (BLD-043): a misread digit is a real risk for all-or-nothing scoring (SCR-001); this unit should log/flag low-confidence OCR reads for the controller to review, not silently trust every result (an implementation detail, not a new decision — reasonable defensive engineering, consistent with BLD-043's own risk framing).
- **Category scheme, resolved** [C] (BLD-041, resolves U-99, supersedes BLD-027): categories are the 3 real age-pair groups — grades 1–2, 3–4, 5–6 — not "U6 to U20." `CompetitionCategory.code` was already a free string (no schema change); this unit's import simply reads whatever category the controller already created in Unit 03 (already built) and attaches the file(s) to it.
- **One question file per category, not shared across categories** [C] (BLD-028, resolves U-32, re-read per Finding #1 above): still true — a category's files are never shared with another category's, even when both run the same round type in parallel [P] (EVT-002).
- **The pool/round-assignment split** [T] (BLD-040, resolves U-100): imported questions sit in the pool (`roundId = null`); this unit also builds the **manual round-selection step** — the controller picks exactly 6 pool questions for a given Individual round. **Timing, inferred from Unit 03's existing readiness check:** Unit 03 (already built) requires "a complete question set assigned to both of its Individual-stage rounds" to publish — so the initial 6-per-round selection must be done **before publish**. After publish, the selection can still change, under the same cutoff `RoundSettings` already uses: editable until that specific round's preparation begins (RND-002/RND-004), never after. **Does not apply to Team rounds** — the rotation round already draws 10 questions at random from the category's whole pool (SCR-015/TEM-004), and the partition round addresses puzzles by `puzzleIndex`; neither ever sets `roundId`.
- **Cross-unit follow-up, not built here:** Unit 03's live publish-readiness check was built 2026-10-02, before `Question.roundId` became nullable (2026-10-07). Whoever builds this unit should verify Unit 03's actual check still means "6 questions with `roundId` set per Individual round," not something that silently stopped checking anything meaningful once `roundId` became optional.
- **Points, generic grid, original file kept — all already decided, unaffected by anything above:** the file supplies a starting points value, controller-customizable regardless [C] (BLD-025/BLD-038); the grid model is generic, never assumes 9×9 [C] (BLD-011) — confirmed by the real files themselves (4×4, 6×6, 9×9 all present); the original file is kept, no in-app question editor [T] (BLD-039) — a mistake is fixed by correcting the Excel and re-importing.
- **Unique solution, confirmed** [C] (U-90): every puzzle has exactly one valid solution — the answer check (Unit 08, already built) relies on this holding for every imported question, not only the hand-transcribed seed set it was built and tested against.

## Implementation Details

1. **File upload and validation.** Controller uploads one Excel file (`.xlsx`) for one category; the 9 columns are read per row. Whole-file validation is atomic: any row's failure (missing required field, unparseable grid dimensions, OCR confidence too low to proceed — see step 3) rejects the entire import, naming the row and the problem. A successful import creates one `QuestionSet` (`categoryId` = the target category, `name` = the file's variant label from `*类目`) and one `Question` row per file row, plus an `ImportBatch` row (`kind = QUESTION_EXCEL`, `status = VALIDATED`/`REJECTED`/`COMMITTED`) and a `StoredFile` row (the original file, kept for audit, BLD-039).
2. **Column mapping.** `题目` → an instructions field (not currently in the schema as a named column — store on `Question` or alongside it; flagged as an implementation detail, not a decision, since no rule requires a specific storage shape for free-text instructions). `题目配图`/`题目音频` → ignored (BLD-042 covers the audio column explicitly; the image column has been empty in every real file seen and carries no documented purpose). `*类目` → the variant label, stored on `QuestionSet.name`; also used to pick the region-computation path (standard partition, or reject if irregular — step 4). `*分数` → `Question.points`, the starting value (BLD-038), controller-editable after (BLD-025). `*水平长度`/`*垂直长度` → `gridColumns`/`gridRows`.
3. **Given-cell and solution extraction (the isolated OCR step, BLD-043).** For every row: run the isolated OCR function against `*数独底图`'s embedded image to read the given cells' values and positions; parse `*正确答案`'s blank-cell values and positions. Build `startingGrid` (the OCR-read given values at their positions, blank elsewhere) and `solution` (every position filled: OCR's given value where the text was blank, the text's value where it had one). **Validate the two sources are complementary** (every image-given position is a text-blank position and vice versa, covering the whole grid with no overlap) — if they disagree for a row, that row fails validation (step 1's atomic rejection), rather than silently guessing which source to trust.
4. **Region computation.** For `*类目` values recognized as standard/diagonal/size-comparison/fortress/anti-knight, compute `regions` as the ordinary box partition from `gridRows`/`gridColumns` (no image reading needed — see Context, Finding #2). **For the irregular ("不规则") variant, reject the whole file at validation** (step 1) with a clear message that irregular-variant import isn't supported yet — not a silent skip, not a guess at the region shape.
5. **Manual round-selection.** A new controller-facing screen/endpoint: for a given category's Individual round (round 1 or round 2), list that category's pool questions (across all its `QuestionSet`s) and let the controller pick exactly 6, setting their `roundId`. Re-selecting while the round hasn't started yet replaces the previous 6 (their `roundId` reverts to `null`, back in the pool). Locked once that round's preparation begins (same cutoff as `RoundSettings`, RND-002/RND-004) — this unit's endpoint rejects a selection change after that point, same pattern Unit 07 already established for its own timer-governed cutoffs.
6. **Frontend.** A question-import screen under `frontend/src/features/question/` (new feature folder) — file upload, the pool view per category (grouped by variant/`QuestionSet`), and the round-selection screen (pick 6 for round 1, pick 6 for round 2, per category) reachable from the competition setup flow Unit 03 already built.

### Inputs

- File upload: one `.xlsx` file, one `categoryId` (an existing `CompetitionCategory` from Unit 03).
- Round selection: `categoryId`, `roundId` (one of that category's two Individual rounds), the 6 chosen `questionId`s from that category's pool.

### Expected Behavior

- A controller uploads a real question file for a category; every row becomes a pool question with a correctly reconstructed starting grid and solution (for supported variants), or the whole file is rejected with a specific row-level reason.
- A controller uploads a second file (a different variant) for the same category; both now contribute to that category's pool, as separate `QuestionSet`s.
- Before publish, the controller selects 6 pool questions for Individual round 1 and 6 for round 2, per category; Unit 03's existing publish check now passes once every category has done this.
- After publish, the controller can still change which 6 are selected for a round, until that round's preparation begins — after that, the selection is locked, same as any other round-level setting.
- Uploading an irregular-variant file is rejected outright, with a message naming that the variant isn't supported yet.

### Components Involved

- **Backend (`question` module):** `question.controller.ts` (upload, pool listing, round-selection endpoints), `question.service.ts` (validation, the isolated OCR extraction call, region computation, round assignment — the public interface other modules call), `question.repository.ts` (`QuestionSet`/`Question` Prisma access), `question.types.ts`, and an isolated `ocr-extractor.ts` (or equivalent adapter) implementing the swappable given-cell extraction.
- **Frontend:** the question-import screen, the pool view, the round-selection screen, all under a new `features/question/`.

### API Contract (Working Position for this unit)

- `POST /api/competitions/:id/categories/:categoryId/questions/import` — multipart file upload. `200` with the created `QuestionSet` summary (row count, variant name) on success; `422` naming the failing row(s) and reason on validation failure.
- `GET /api/competitions/:id/categories/:categoryId/questions/pool` — lists pool questions (unassigned and assigned), grouped by `QuestionSet`.
- `POST /api/competitions/:id/categories/:categoryId/rounds/:roundId/select-questions` — body: `{ questionIds: string[6] }`. `200` on success; `409` if that round's preparation has already begun; `400` if not exactly 6 ids, or any id isn't in that category's pool.

### Error Cases

- **A row with inconsistent given-cell/blank-cell coverage** (OCR and text answer don't exactly complement each other): the whole file is rejected, naming the row.
- **An irregular-variant file:** rejected outright at validation, naming the unsupported variant.
- **Selecting fewer or more than 6 questions for a round, or a question not in that category's pool:** rejected.
- **Changing a round's question selection after its preparation has begun:** rejected, same cutoff as `RoundSettings`.
- **Importing a file for a category that doesn't exist yet, or that belongs to a different competition:** rejected.

### Security Considerations

- Every endpoint in this unit requires a valid `CONTROLLER` session (Unit 02's auth middleware), consistent with every other setup action [C] (ROL-002).
- The OCR step runs server-side only, on the uploaded file's own embedded image — no external OCR service call leaves the server unless a specific provider is chosen at build time, in which case the file-privacy implications (sending puzzle images to a third party) should be weighed and, if it's a real external call, flagged for the project owner — not assumed silently.

### Constraints

- No schema change required for the main import path — `Question.roundId` nullable and `QuestionSet` allowing several rows per category are both already compatible with the existing schema (the latter was never actually constrained to one row, only described that way in prose).
- Does not import irregular-variant ("不规则") files — out of scope until region-shape extraction is solved.
- Does not build a general-purpose puzzle editor or author new puzzles — out of scope (CMP-102), unaffected by the temporary OCR step.
- Does not change Unit 07/08's contract — they already consume `Question.solution`/`startingGrid` exactly as this unit produces them.
- The OCR step is explicitly temporary (BLD-043) — do not design the rest of the import pipeline around OCR being permanent; the swap to text-based input must stay a one-function change.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Keep the OCR extraction function's interface narrow: given an image and grid dimensions, return a map of cell position → given value (or "not given"). Everything else in the import pipeline should be unaware OCR is involved at all.
- Low-confidence OCR reads should be surfaced to the controller (e.g. a warning on the import result), not silently accepted — consistent with BLD-043's own stated risk (a misread digit breaks all-or-nothing scoring).
- The region-computation path (step 4) should be a small, named function per variant family, easy to extend if the irregular variant's extraction is solved later.
- Finding #1 (several `QuestionSet`s per category) and Finding #2 (irregular variant out of scope) are both flagged for the project owner's confirmation — this spec proceeds on the proposed reading, but should be revisited if either is answered differently.

### Related Features

- **Depends on:** Unit 03 (`CompetitionCategory` to attach questions to; its publish-readiness check is what this unit's round-selection step satisfies).
- **Depended on by:** Unit 07/08 (already built against seed data, now against this unit's real pipeline, no contract change), Units 13/14 (team rounds draw from this unit's pool, never from `roundId`-assigned questions), Unit 04 (no dependency either way — the two import units are independent of each other).

## Acceptance Criteria

1. Importing a real, supported-variant question file creates one `QuestionSet` and one `Question` per row, each with a correctly reconstructed `startingGrid` and `solution`.
2. A row where the OCR-read given cells and the text answer's blanks don't exactly complement each other causes the whole file to be rejected, naming the row.
3. An irregular-variant file is rejected outright, naming the unsupported variant.
4. A category can hold more than one `QuestionSet` (one per imported file/variant), all contributing to the same pool.
5. The controller selects exactly 6 pool questions for a given Individual round; Unit 03's existing publish-readiness check recognizes this as complete.
6. Changing a round's question selection is accepted before that round's preparation begins and rejected after.
7. A non-controller session cannot import a file, read the pool, or change a round's question selection.
8. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Irregular ("不规则") variant import — region shapes aren't extractable from the current file format (Finding #2); revisit once solved.
- A general puzzle editor, puzzle authoring or generation (CMP-102).
- Replacing the temporary OCR step with text-based input — tracked for whenever a text-based source becomes available (BLD-043's own stated intent), not this unit's job to anticipate further than keeping the step swappable.
- Verifying or fixing Unit 03's live publish-readiness-check implementation against the new nullable `roundId` — flagged as a cross-unit follow-up, not built here.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
