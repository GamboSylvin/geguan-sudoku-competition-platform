# Unit 05: Question import and question sets — APPROVED (2026-10-08)

> **Approved spec.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> **This unit is no longer gated** (`../specs/00-build-plan.md`: removed from "Units that cannot be specified" 2026-10-07) — its three open items are all resolved: **U-94** (**BLD-047**, the given cells/solution are read from an added text column, no OCR — a short-lived OCR exception, BLD-043, was adopted and withdrawn within the same day once the stakeholder's real, corrected reply arrived), **U-99** (BLD-041, the real category scheme), **U-101** (BLD-042, the audio column is ignored). Real question files exist (`context/samples/`), though not yet carrying the new text column — see Context.
> **The two findings surfaced while drafting this spec are now resolved by the project owner (2026-10-08):** (1) **BLD-044** — a category may have several `QuestionSet` rows, one per imported file/variant, correcting `data-model.md`'s "one file per category" prose; no schema change. (2) **BLD-045** — the irregular/jigsaw ("不规则") variant's import stays explicitly **out of scope** for this unit, since its region shapes aren't extractable from the current file format (neither OCR nor BLD-047's text column reads region shapes) — revisit if a way to supply them is found later. Approved for build as part of the project owner's final 2-day build push (see `progress-tracker.md`).
> **Correction, 2026-10-08:** this spec originally described a temporary OCR step (BLD-043) for the given cells/solution. That exception was withdrawn the same window, before any code was written against it — the real stakeholder reply (BLD-047) confirmed the given cells/solution are read from **an added text column**, exactly BLD-026's original plan, never actually requiring OCR. Every OCR reference below is replaced with the text-column approach; nothing else in this spec (region computation, the manual round-selection step, the pool/`QuestionSet` model) changes.

## Goal

A controller imports a category's question file(s) — each a pool of 30–100 questions for one puzzle variant — into `Question` rows with a generic grid, points, and (for non-irregular variants) a complete solution reconstructed from two plain-text columns. Before publish, the controller manually selects exactly 6 pool questions for each of that category's two Individual rounds.

Goal in one testable sentence: **importing a real question file commits every row as a `Question` in the category's pool (`roundId = null`), with `startingGrid`/`solution` correctly reconstructed from the given-cells text column plus the existing blank-cells text column for non-irregular variants; any row failure rejects the whole file; the controller then selects 6 pool questions per Individual round, which locks in at that round's preparation (same cutoff as `RoundSettings`), and Unit 03's existing publish check sees a complete assignment.**

## Context

- **What already exists:** Unit 03's `Competition`/`CompetitionCategory`/`Stage`/`Round` (built, live) already auto-creates the fixed 2×2 structure and already runs a publish-readiness check that requires "a complete question set assigned to both of its Individual-stage rounds" — this unit is what actually makes that condition real; it was previously satisfied only by seeded test data. Unit 07/08 (built, live) already consume `Question.solution`/`startingGrid` against hand-transcribed seed data (BLD-026) — this unit replaces that seed data with a real pipeline, without changing Unit 07/08's contract.
- **Where this lives:** question import, validation and round assignment belong to the **Question** module (`../architecture.md`, "System boundaries": "Question import and validation, question packs, **assignment of questions to rounds**, per-question points" — the module boundary already anticipated a separate assignment step). Backend code goes in `backend/src/modules/question/` (currently a skeleton).
- **Real files received 2026-10-07** (`context/samples/`): 12 question files across 3 category folders (一二年级组, 三四年级组, 五六年级组), each category folder holding **several files**, one per puzzle variant (e.g. 一二年级组 has `六宫标准100`, `四宫标准60`, `四宫不规则30`, `四宫对角线30`). Each file has 9 columns: `题目` (instructions), `题目配图` (unused, empty), `题目音频` (unused, empty — **ignored**, BLD-042), `*类目` (variant name, e.g. "四宫标准数独"), `*分数` (points), `*数独底图` (the grid image, `DISPIMG`-embedded), `*水平长度`/`*垂直长度` (grid width/height), `*正确答案` (the blank cells' answers only, as a row-by-row array with gaps at the given-cell positions).
- **These 12 real files predate BLD-047 and do not yet carry the new given-cells text column.** They were received 2026-10-07, before the OCR-vs-text question was answered; the real organizer (主办方) will supply production files with the new column later (BLD-047). **Until then, building and testing Unit 05's import against real multi-variant data requires hand-transcribing the given-cells column onto local copies of these 12 files** (reading the values off `*数独底图`'s embedded image by eye, once, the same one-time manual step BLD-026 always described) — a data-prep task for whoever builds this unit, not a project-owner question. Unit 05's own automated tests can use a small, fully hand-made fixture file instead and don't need to wait on this.
- **`QuestionSet` is one per category *per imported file*, not one per category — confirmed** [T] (BLD-044, 2026-10-08). The approved `data-model.md` describes `QuestionSet` as "one file per category" (BLD-028) — but the real files show a category needing several files (one per variant) to cover both Individual rounds' worth of puzzle types. **BLD-028's actually-confirmed fact is narrower than that inference**: "each category is uploaded and imported separately" (no sharing *across* categories) — it never said *exactly one file total*. Confirmed reading: a `CompetitionCategory` has **one or more** `QuestionSet` rows, each tied to one imported file; `QuestionSet.name` stores that file's variant label (from `*类目` or the filename) so multiple sets under one category stay distinguishable. **No schema change needed** (`QuestionSet.categoryId` already allows many rows per category — nothing currently enforced "exactly one").
- **The irregular ("不规则") variant's regions cannot be extracted today — confirmed out of scope** [T] (BLD-045, 2026-10-08). `Question.regions` (BLD-011) needs each puzzle's block/region shape. For **standard, diagonal (对角线), size-comparison (大小), fortress (堡垒) and anti-knight (无马)** variants, the regions are the ordinary N×N box partition, computable directly from `gridRows`/`gridColumns` — no image reading needed (and BLD-010's "no rule checker per variant" means the extra constraint these variants add — diagonal, comparison, adjacency — is never validated by the system anyway; it only compares the final submitted grid against the stored solution). **The irregular variant's region shapes are genuinely custom per puzzle and aren't derivable from dimensions alone, and neither OCR nor BLD-047's text column reads them either** — a region shape was never part of what either extraction method covers (both only ever targeted the given-cells/solution values, never the block boundaries). **This unit does not import irregular-variant files** — see Out of Scope. This is a new, narrower gap than U-94 (now resolved); worth its own tracked question if the project owner wants irregular puzzles built later.
- **Given cells and solution, from a text column, confirmed** [C] (BLD-047, resolves U-94, no OCR needed): a new column (working position, e.g. `*给定数字`, exact header to be confirmed when the real organizer supplies it) holds the given cells' values and positions as plain text, in the **same row-by-row array-with-gaps format already used by `*正确答案`** (BLD-026's original plan) — the given-cells column has gaps at the blank-cell positions, `*正确答案` has gaps at the given-cell positions. Build `startingGrid` (the given-cells column's values at their positions, blank elsewhere) and `solution` (every position filled: the given-cells column's value where `*正确答案` is blank, `*正确答案`'s value where it has one). **Validate the two columns are complementary** (every given-cells position is a `*正确答案`-blank position and vice versa, covering the whole grid with no overlap) — if they disagree for a row, that row fails validation, rather than silently guessing which source to trust. No image reading, no OCR, no confidence scoring — this is a plain text parse, like every other column.
- **Category scheme, resolved** [C] (BLD-041, resolves U-99, supersedes BLD-027): categories are the 3 real age-pair groups — grades 1–2, 3–4, 5–6 — not "U6 to U20." `CompetitionCategory.code` was already a free string (no schema change); this unit's import simply reads whatever category the controller already created in Unit 03 (already built) and attaches the file(s) to it.
- **One question file per category, not shared across categories** [C] (BLD-028, resolves U-32, re-read per Finding #1 above): still true — a category's files are never shared with another category's, even when both run the same round type in parallel [P] (EVT-002).
- **The pool/round-assignment split** [T] (BLD-040, resolves U-100): imported questions sit in the pool (`roundId = null`); this unit also builds the **manual round-selection step** — the controller picks exactly 6 pool questions for a given Individual round. **Timing, inferred from Unit 03's existing readiness check:** Unit 03 (already built) requires "a complete question set assigned to both of its Individual-stage rounds" to publish — so the initial 6-per-round selection must be done **before publish**. After publish, the selection can still change, under the same cutoff `RoundSettings` already uses: editable until that specific round's preparation begins (RND-002/RND-004), never after. **Does not apply to Team rounds** — the rotation round already draws 10 questions at random from the category's whole pool (SCR-015/TEM-004), and the partition round addresses puzzles by `puzzleIndex`; neither ever sets `roundId`.
- **Cross-unit follow-up — done 2026-10-08, ahead of this unit's own feature code.** Unit 03's live publish-readiness check was built 2026-10-02, before `Question.roundId` became nullable (2026-10-07); it now requires exactly 6 `Question` rows with `roundId` set per Individual round per category (`competition.service.ts`'s `INDIVIDUAL_ROUND_QUESTION_COUNT`), so it no longer passes vacuously now that `roundId` is optional.
- **Points, generic grid, original file kept — all already decided, unaffected by anything above:** the file supplies a starting points value, controller-customizable regardless [C] (BLD-025/BLD-038); the grid model is generic, never assumes 9×9 [C] (BLD-011) — confirmed by the real files themselves (4×4, 6×6, 9×9 all present); the original file is kept, no in-app question editor [T] (BLD-039) — a mistake is fixed by correcting the Excel and re-importing.
- **Unique solution, confirmed** [C] (U-90): every puzzle has exactly one valid solution — the answer check (Unit 08, already built) relies on this holding for every imported question, not only the hand-transcribed seed set it was built and tested against.

## Implementation Details

1. **File upload and validation.** Controller uploads one Excel file (`.xlsx`) for one category; the columns are read per row (the 9 already-seen columns, plus the new given-cells text column, BLD-047). Whole-file validation is atomic: any row's failure (missing required field, unparseable grid dimensions, the given-cells/blank-cells columns not complementary — see step 3) rejects the entire import, naming the row and the problem. A successful import creates one `QuestionSet` (`categoryId` = the target category, `name` = the file's variant label from `*类目`) and one `Question` row per file row, plus an `ImportBatch` row (`kind = QUESTION_EXCEL`, `status = VALIDATED`/`REJECTED`/`COMMITTED`) and a `StoredFile` row (the original file, kept for audit, BLD-039).
2. **Column mapping.** `题目` → an instructions field (not currently in the schema as a named column — store on `Question` or alongside it; flagged as an implementation detail, not a decision, since no rule requires a specific storage shape for free-text instructions). `题目配图`/`题目音频` → ignored (BLD-042 covers the audio column explicitly; the image column has been empty in every real file seen and carries no documented purpose — `*数独底图` itself is likewise not read by this unit now that BLD-047 reads the given cells from text, not the image). `*类目` → the variant label, stored on `QuestionSet.name`; also used to pick the region-computation path (standard partition, or reject if irregular — step 4). `*分数` → `Question.points`, the starting value (BLD-038), controller-editable after (BLD-025). `*水平长度`/`*垂直长度` → `gridColumns`/`gridRows`.
3. **Given-cell and solution reconstruction, from text (BLD-047).** For every row: parse the given-cells column's values and positions, and `*正确答案`'s blank-cell values and positions — both plain text, same array-with-gaps format. Build `startingGrid` (the given-cells column's values at their positions, blank elsewhere) and `solution` (every position filled: the given-cells value where `*正确答案` was blank, `*正确答案`'s value where it had one). **Validate the two columns are complementary** (every given-cells position is a `*正确答案`-blank position and vice versa, covering the whole grid with no overlap) — if they disagree for a row, that row fails validation (step 1's atomic rejection), rather than silently guessing which source to trust. No image is read and no OCR runs anywhere in this unit.
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

- **Backend (`question` module):** `question.controller.ts` (upload, pool listing, round-selection endpoints), `question.service.ts` (validation, the given-cells/solution text parsing, region computation, round assignment — the public interface other modules call), `question.repository.ts` (`QuestionSet`/`Question` Prisma access), `question.types.ts`. No OCR/image-processing dependency of any kind.
- **Frontend:** the question-import screen, the pool view, the round-selection screen, all under a new `features/question/`.

### API Contract (Working Position for this unit)

- `POST /api/competitions/:id/categories/:categoryId/questions/import` — multipart file upload. `200` with the created `QuestionSet` summary (row count, variant name) on success; `422` naming the failing row(s) and reason on validation failure.
- `GET /api/competitions/:id/categories/:categoryId/questions/pool` — lists pool questions (unassigned and assigned), grouped by `QuestionSet`.
- `POST /api/competitions/:id/categories/:categoryId/rounds/:roundId/select-questions` — body: `{ questionIds: string[6] }`. `200` on success; `409` if that round's preparation has already begun; `400` if not exactly 6 ids, or any id isn't in that category's pool.

### Error Cases

- **A row with inconsistent given-cell/blank-cell coverage** (the given-cells column and `*正确答案` don't exactly complement each other): the whole file is rejected, naming the row.
- **An irregular-variant file:** rejected outright at validation, naming the unsupported variant.
- **Selecting fewer or more than 6 questions for a round, or a question not in that category's pool:** rejected.
- **Changing a round's question selection after its preparation has begun:** rejected, same cutoff as `RoundSettings`.
- **Importing a file for a category that doesn't exist yet, or that belongs to a different competition:** rejected.

### Security Considerations

- Every endpoint in this unit requires a valid `CONTROLLER` session (Unit 02's auth middleware), consistent with every other setup action [C] (ROL-002).
- No external service call of any kind is involved in reading the given cells/solution (BLD-047 removed the one scenario — OCR — that might have needed one).

### Constraints

- No schema change required for the main import path — `Question.roundId` nullable and `QuestionSet` allowing several rows per category are both already compatible with the existing schema (the latter was never actually constrained to one row, only described that way in prose).
- Does not import irregular-variant ("不规则") files — out of scope until region-shape extraction is solved.
- Does not build a general-purpose puzzle editor or author new puzzles — out of scope (CMP-102).
- Does not change Unit 07/08's contract — they already consume `Question.solution`/`startingGrid` exactly as this unit produces them.
- No OCR, no image reading, no computer-vision dependency anywhere in this unit (BLD-047 withdrew the one scenario, BLD-043, that would have needed one) — the given-cells/solution reconstruction is a plain text parse, same as every other column.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- The region-computation path (step 4) should be a small, named function per variant family, easy to extend if the irregular variant's region-shape problem is solved later.
- Before this unit can be tested end-to-end against real multi-variant data, the 12 real sample files in `context/samples/` need the given-cells column hand-transcribed onto local copies (see Context) — a one-time data-prep task, not part of this unit's own code or tests.
- Several `QuestionSet`s per category (BLD-044) and the irregular variant being out of scope (BLD-045) are both confirmed project-owner decisions (2026-10-08), not open questions — build against them as settled.

### Related Features

- **Depends on:** Unit 03 (`CompetitionCategory` to attach questions to; its publish-readiness check is what this unit's round-selection step satisfies).
- **Depended on by:** Unit 07/08 (already built against seed data, now against this unit's real pipeline, no contract change), Units 13/14 (team rounds draw from this unit's pool, never from `roundId`-assigned questions), Unit 04 (no dependency either way — the two import units are independent of each other).

## Acceptance Criteria

1. Importing a real, supported-variant question file creates one `QuestionSet` and one `Question` per row, each with a correctly reconstructed `startingGrid` and `solution`.
2. A row where the given-cells column and `*正确答案`'s blanks don't exactly complement each other causes the whole file to be rejected, naming the row.
3. An irregular-variant file is rejected outright, naming the unsupported variant.
4. A category can hold more than one `QuestionSet` (one per imported file/variant), all contributing to the same pool.
5. The controller selects exactly 6 pool questions for a given Individual round; Unit 03's existing publish-readiness check recognizes this as complete.
6. Changing a round's question selection is accepted before that round's preparation begins and rejected after.
7. A non-controller session cannot import a file, read the pool, or change a round's question selection.
8. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Irregular ("不规则") variant import — region shapes aren't extractable from the current file format (BLD-045); revisit once solved.
- A general puzzle editor, puzzle authoring or generation (CMP-102).
- OCR or any image-based extraction — withdrawn before use (BLD-047 supersedes BLD-043); not this unit's concern at all.
- Hand-transcribing the given-cells column onto the 12 real sample files — a one-time data-prep task for whoever builds/tests this unit (see Implementation Notes), not code this unit ships.
- ~~Verifying or fixing Unit 03's live publish-readiness-check implementation against the new nullable `roundId`~~ — done 2026-10-08, see Context.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
