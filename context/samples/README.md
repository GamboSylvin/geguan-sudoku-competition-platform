# Samples — real files received

**Received 2026-10-07**, replacing the earlier placeholder instructions below. These are real files from the client, read and analyzed in full — see `context-feeders/decisions/project-decisions.md` (PAR-011, PAR-012, BLD-041, BLD-042, BLD-047) for how they were resolved, and `unmade-decisions.md` (U-01) for what's still open. **Still missing:** a participant file with actual data rows, and a past results sheet — the stakeholder confirmed 2026-10-07 there's currently nothing more to send for either. **Also still missing (2026-10-08):** these 12 question files predate BLD-047's new given-cells text column — they need it hand-transcribed onto local copies before they can test the real Unit 05 import end-to-end (see `specs/05-question-import-and-question-sets.md`).

| File / folder | What it is | Status |
|---|---|---|
| `选手信息.xlsx` | The real participant-file **column template**: `比赛名称`, `选手编号`, `姓名`, `年龄`, `省`, `市`, `区（县）`, `学校名称`, `组别`, `个人赛`, `团队赛`, `备注`. No data rows. | Structure resolved — **no explicit Team column** (PAR-011, resolves U-97): team membership is School+Category+`团队赛`=1; **the pre-filled `选手编号` column is ignored** (PAR-012, resolves U-98), the system always generates its own. Still missing: a copy with real data rows. |
| `一二年级组/` | 4 real question files for grades 1–2 (4×4 and 6×6 grids): standard, irregular, diagonal variants. | Real data; given cells are image-only today — **resolved via a new text column, no OCR** (BLD-047; a short-lived OCR exception, BLD-043, was withdrawn before use); **the grade-pair folders ARE the real category scheme** (BLD-041, confirmed 2026-10-07, reversing the earlier BLD-027 answer) |
| `三四年级组/` | 4 real question files for grades 3–4 (6×6 and 9×9 grids): standard, irregular, size-comparison variants. | Same as above |
| `五六年级组/` | 4 real question files for grades 5–6 (6×6 and 9×9 grids): standard, fortress, anti-knight variants. | Same as above |

Every question file shares the same 9 columns: `题目` (instructions), `题目配图` (question image, empty), `题目音频` (question audio, empty — **ignored at import**, BLD-042), `*类目` (variant name), `*分数` (points — confirms BLD-038), `*数独底图` (the base-grid image, `DISPIMG`-embedded — **not read at all; kept only for human reference**, BLD-047 superseded the short-lived OCR exception BLD-043 before it was ever used), `*水平长度`/`*垂直长度` (grid width/height — confirms BLD-011's generic grid model: real files use 4×4, 6×6 **and** 9×9), `*正确答案` (correct answer — **blank cells only**; the given cells will come from a **new text column**, same array-with-gaps format, per BLD-047 — these 12 files don't have it yet and need it hand-transcribed, see above). Row counts per file range from 30 to 100, far more than "6 questions per round" — **resolved** (BLD-040, resolves U-100): each file is a pool; Unit 05 imports it whole, a separate manual step selects 6 per Individual round. The 3 grade-pair folders (1–2, 3–4, 5–6) **are the real category scheme** (BLD-041, confirmed 2026-10-07).

**Privacy:** these files were checked for real student names before being added — the participant file is a blank template, and the question files contain no participant data. If a future sample ever does contain real names, replace them with fake ones before adding it here; this folder is part of the context and may be read by an agent.

---

<details>
<summary>Original placeholder instructions (superseded 2026-10-07, kept for reference)</summary>

The person completing the context provides two sample files and places them **in this folder**, with exactly these names:

| File to place here | What it is | Needed for |
|---|---|---|
| `participants-sample.xlsx` | A sample participant Excel (columns Name, School, Category, Team, and any extra columns) | The participant import unit; the participant numbering and credentials |
| `question-sample.xlsx` | A sample question Excel (**not PDF** — the question import format was corrected from PDF to Excel on 2026-09-30, see `../competition-rules.md` §2) | The question import unit; the grid shapes; the answer check |

**Resolved 2026-10-01:** extra participant Excel columns (U-40) — Working Position, pending confirmation: the import ignores any column beyond Name/School/Category/Team, no error. Every puzzle has a unique solution, confirmed [C] (U-90).

Already known from an earlier look at sample material (recorded in `../competition-rules.md`, not blocking): the question file carries a points-per-question column, but points stay controller-customizable regardless; a complete-solution column is **missing** from the source files today, and **the given (pre-filled) cells exist only as an embedded picture, not as text** — OCR is ruled out, so there is no way today to build an interactive, correctly-locked grid from the files as they stand (U-94, still open, carried back to the stakeholder 2026-10-01) — a starter set is hand-transcribed in the meantime (BLD-026).

</details>
