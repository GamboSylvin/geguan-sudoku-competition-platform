# Fill before coding — checklist for the person who completes the context (v2, 2026-09-26)

**Purpose.** A person goes through **all** the context files, finds what is marked as missing and needed before coding, fills it in, and only then starts coding.
While that person works, the requirements questions keep being answered and the context builder keeps updating the context files (see "How to work in parallel").

**Who fills.** The person completing this checklist may **decide the items marked "project owner"** as well as the "team" items. Values decided here are tagged **[T]** (team or project-owner decision).

## How to find the blanks

Search the whole `context/` folder for these markers. Each one has a blank (`________`) and an owner:

- `[[FILL-BEFORE-CODING: ... ]]` — required **before the first coding unit**.
- `[[FILL-BEFORE-UNIT: ... ]]` — required before the named unit only.
- `[[FILL-BEFORE-DEPLOYMENT: ... ]]` — needed to deploy, not to start coding.

The descriptions of the markers in this file, `README.md`, the root `CLAUDE.md` and `ai-workflow-rules.md` are not blanks. The real blanks are in `architecture.md`, `code-standards.md`, `project-overview.md`, `ui-context.md` and `samples/README.md`.
`TBD — to be decided by the project owner` marks a value left blank on purpose; it is filled through a marker above.
Placeholders: `samples/` is an empty structure to fill.
Items tagged `[O]` or written `OPEN (U-xx)` that are **not** in this checklist are **waiting for stakeholder answers**: do **not** fill them (see section D).

## A. Required before the first coding unit — `FILL-BEFORE-CODING`

| # | What to fill | Where | Owner | Done |
|---|---|---|---|---|
| A1 | **Backend language and framework** = **Node.js with TypeScript, Express.js** [T] (I-02) | `architecture.md` Stack table; `code-standards.md` Language and Framework | Project owner | [x] |
| A2 | **Developers' skills** = recorded 2026-09-27 (I-18): both junior — Sylvin (a little more React, a little Express, some PostgreSQL, a little Redis); Louise (a little Express and React, more PostgreSQL). Real-time: both little, Socket.io the tool they know best | `project-overview.md` Client and team | Project owner | [x] |
| A3 | **Names and roles** of developer 1, developer 2, project owner, business lead; **who builds what** = recorded 2026-09-27 (I-17, I-23): Sylvin (developer 1), Louise (developer 2), project owner the Sudoku team, business lead Ma Laoshi; work split by module, ~70/30 (Sylvin backend-leaning, Louise frontend-leaning), contract first | `project-overview.md` Client and team | Project owner | [x] |
| A4 | **I-14 and I-15**: what they are and how they are resolved = both are already resolved by decisions confirmed 2026-09-26. **I-14 = answer check:** the submitted grid is compared with the stored solution, no rule checker per variant (BLD-010; leaves U-90, unique solutions, to the stakeholder). **I-15 = grid model:** generic rows/columns/regions, never 9x9 (BLD-011; the shapes follow the sample PDF, U-01). Recorded in `architecture.md`, Technical decision records | `architecture.md` Technical decision records | Project owner | [x] |
| A5 | **Development environment** = decided 2026-09-29 [T]: **Docker with Docker Compose** — the whole codebase containerized, so development and deployment share one environment (PostgreSQL and Redis as Compose services); **npm with `package-lock.json` committed**; versions pinned (Node.js LTS, PostgreSQL 16, Redis 7); `.env.example` committed, real `.env` git-ignored. **Created in Unit 1** (I-24) | `architecture.md` Development environment | Team | [x] |
| A6 | **Data model and schema**, filled and approved (I-01), keeping the model ready for team rotation | `data-model.md` and the marker in `architecture.md` | Team | [x] |
| A7 | **Build plan** and the **Unit 1 spec**, for the first slice (Individual stage, end to end). **Unit 1 is the foundation only** (repository, environment, CI, skeleton) = approved 2026-09-30 [T] (A7) | `specs/00-build-plan.md` and `specs/01-foundation.md` | Team | [x] |

Coding may start when every A item is ticked **and** the approvals in section E are done.

## B. Required before a specific unit — `FILL-BEFORE-UNIT` (the person can fill these)

| # | What to fill | Unit | Where | Done |
|---|---|---|---|---|
| B1 | **Sample files placed** in `context/samples/`: `participants-sample.xlsx` and `question-sample.xlsx` (**Excel, not PDF** — corrected 2026-09-30) | Import units | `samples/README.md`; marker in `architecture.md` (Import formats) | [ ] |
| B2 | From the samples: **extra participant Excel columns** — Working Position (U-40, pending confirmation; see pack Q44): any extra columns are ignored, no error. **Unique solution guaranteed for every puzzle**: confirmed yes (U-90) | Import; answer check | marker in `architecture.md` (Import formats) | [x] |
| B3 | **Session length** — resolved 2026-10-01 (I-16, AUTH-001): the whole event day, no idle-timeout expiry. **Judge and controller credential format** — resolved 2026-10-01 (I-30, BLD-037): same pattern as participants, system-generated username + short random password | Authentication | marker in `architecture.md` (Auth and access model) | [x] |
| B4 | **UI component library** = **Headless UI**; **icon set** = **Heroicons** (resolved 2026-10-01, BLD-035) ; **fonts, including Chinese** = resolved 2026-10-01 (U-70) — see `ui-context.md`, "Typography" (I-20, now resolved in full) | First UI unit | marker in `ui-context.md` | [x] |
| B5 | **Found 2026-10-01, during a methodology completeness check (not previously tracked anywhere):** **border radius scale** and **spacing scale** — both sections exist in `ui-context.md` (as the methodology's own template requires) but were left blank with no owner and no marker since the file was first drafted. **Resolved 2026-10-08** [T] (UI-008): since no dedicated design pass is happening before the MVP/event, the candidate default (Tailwind CSS's own scales, the same "Working Position" treatment already given to Theme/Colors, U-65) is now the value actually in use — see `ui-context.md`, "Border Radius / Rounding" and "Spacing Scale". | First UI/design unit (after BLD-009) — **moot, no such unit is coming before the MVP (UI-008)** | markers in `ui-context.md` ("Border Radius / Rounding", "Spacing Scale") | [x] |

## C. Required to deploy, not to start coding — `FILL-BEFORE-DEPLOYMENT`

| # | What to fill | Where | Owner | Done |
|---|---|---|---|---|
| C1 | **Where the server runs on the event day** = ________ (I-03, U-46): the real venue-network facts stay for the stakeholder, closer to the event. **Who sets it up and runs it, and whether an on-site fallback is wanted, is closed as a team/deployment-time call, not a stakeholder question** [T] (B4, BLD-034) — the team decides it itself once the venue, date and budget are known, using Phase 2 of the hosting proposal (BLD-031) | `architecture.md` Stack table (Hosting) | Team (not the stakeholder) | [ ] |
| C2 | **Found 2026-10-01, during a methodology completeness check:** an **automated-review CI step** (AI code review or static analysis, the methodology's Layer 1/CI step 5) has never actually been set up — it was flagged once, in prose, as "later phase, not in the MVP" (`architecture.md`, "Development environment and workflow"; this checklist's own quality-chain row in section E below), and project-owner-approved to proceed without it for now, but was never turned into a tracked item with an owner and a deadline. CI today runs lint, type check, tests and build only (BLD-002) — no automated review. **Does not block coding** (the project owner already approved proceeding without it); tracked here so it isn't forgotten before a real deployment, consistent with the methodology's "all three quality layers are mandatory" guidance. | `architecture.md` (Development environment and workflow; CI pipeline) | Team | [ ] |

## D. Waiting for stakeholder answers — do NOT fill

These are still open. They are being answered through the question process, and the context builder updates the files. Do not fill them. If a unit depends on one, stop and report it.

- ~~The missing complete-solution column (U-94)~~ **Resolved 2026-10-07** [T] (BLD-043) — a temporary OCR exception, explicitly not the target state; see `data-model.md`'s `Question` entity note. **U-62 (whether the participant Excel follows the 15-day deletion) is now resolved in full** — yes (RES-009), closing both the scores/correction-log part (RES-005) and the participant-Excel part.
- The venue network (U-46) — deliberately deferred to closer to the event date, not blocking (see `architecture.md`, "Devices and network") · reliability (U-61's backup-plan part — the failure-tolerance part is resolved, see `architecture.md`). **The "who sets it up / on-site fallback" sub-question of U-46 is closed, B4 (BLD-034) — not a stakeholder question; the team decides at deployment time.**
- Layouts (U-66) — originally deliberately left to the design phase after the first slice (BLD-009); **that design phase is now not happening before the MVP/event, project owner decision (UI-008, 2026-10-08)** — each unit's functional layout ships as-is; still not blocking, still open to revisit after the event
- Real numbers for the second team round (TEM-006 to TEM-008): working positions are already in use for building. **Closed, A10b (TEM-009): no stakeholder question is needed at all** — these are controller-configurable per competition (SCR-005), exactly like round time and bonus rate; whoever sets up the real competition enters the real regulation's numbers directly in the setup form, if they have them.

## E. Approvals before coding (the methodology's gate)

The methodology says each context file is shown for review and approved, and that coding starts only when all files and specs are approved. Record who approved and when.
The rows below were approved by the **project owner (the Sudoku team)** on **2026-09-30** (recorded on that date; no other date was given). The project owner is not the client's stakeholder, so these approvals are **[T]**, not stakeholder confirmations. **The last row (A14, the stakeholders' written confirmation) is different: it is now directly stakeholder-confirmed** [C], answered 2026-10-01 via pack Q36 — see that row for the exact answer.

| What is approved | Approved by | Date | Done |
|---|---|---|---|
| `project-overview.md` filled and approved | project owner (Sudoku team) | 2026-09-30 | [x] |
| `competition-rules.md` | project owner (Sudoku team) | 2026-09-30 | [x] |
| `architecture.md` | project owner (Sudoku team) | 2026-09-30 | [x] |
| `code-standards.md` | project owner (Sudoku team) | 2026-09-30 | [x] |
| `ai-workflow-rules.md` | project owner (Sudoku team) | 2026-09-30 | [x] |
| `ui-context.md`: the behaviour parts now; the visual parts (tokens, layouts) ship as their working-position defaults — **no dedicated design pass before the MVP/event** (UI-008, 2026-10-08) | project owner (Sudoku team) | 2026-09-30, timing fixed 2026-10-08 | [x] |
| **Data model and schema** (`data-model.md`): the skeleton checkpoint | team / project owner | 2026-09-30 | [x] |
| `specs/00-build-plan.md` and `specs/01-foundation.md` | team / project owner | 2026-09-30 | [x] |
| **Quality chain agreed**: AI review, then automated checks, then human review. The decided workflow states CI and the other developer's review; it does not state an AI review step. **Now tracked as item C2 above** (2026-10-01), so the missing AI-review CI step isn't forgotten before a real deployment | project owner (Sudoku team) | 2026-09-30 | [x] |
| **Requirements confirmed in writing by the stakeholders** (methodology Step 8, mandatory for client projects; question Q36 of the stakeholder question pack). The methodology places it before the specs are written. **Resolved 2026-10-01** [C] (A14): **informal process, no formal signature required** — the stakeholder/project owner does not sign a formal written requirements document with a deadline; approval happens informally, as the project owner validates each answer along the way (as already done throughout this pack). Consistent with this row already being marked done. | project owner (Sudoku team); stakeholder-confirmed 2026-10-01 | 2026-09-30 / 2026-10-01 | [x] |

## How to work in parallel

- The requirements questions are still being answered. New answers are now recorded directly: resolved items go into `context-feeders/decisions/project-decisions.md`, still-open ones stay listed in `context-feeders/decisions/unmade-decisions.md`, and the context builder reflects each into the context files from there. (Through 2026-10-01, answers were staged first in `context-feeders/working/`, since removed — see `context-feeders/README.md`.)
- **The person filling this checklist edits only the marked blanks** and ticks the boxes here. Everything else in the context files may change as new answers arrive.
- When a blank is filled: replace the marker with the value, keep the status tag (`[T]` for a team or project-owner decision), and add a line to `progress-tracker.md`, "Context change log".
- **Conflicts:** if a fill contradicts something already in the context files, or a new answer contradicts your fill, do not overwrite silently. Note the conflict in the "Context change log" and ask the project owner which to keep.
- Before coding starts, search the folder once more for `FILL-BEFORE-CODING`. If any marker remains, coding must not start.

## Prompt for your agent (copy and paste)

```text
You are helping me complete the context folder of the project "Sudoku Arena" before any coding starts. Do NOT write code.

Read, in this order: the root CLAUDE.md, context/README.md, context/FILL-BEFORE-CODING.md, then every other file in context/ (including context/samples/README.md and the specs in context/specs/).
Do NOT read the folder context-feeders/working/. It holds superseded notes. Do NOT edit context-feeders/requirements/, context-feeders/decisions/ or context-feeders/archive/ (you may READ context-feeders/requirements/REQUIREMENTS.md section 12 and context-feeders/decisions/unmade-decisions.md only to look up items I-14 and I-15).

Step 1. Search all of context/ for these markers (ignore the DESCRIPTIONS of markers in FILL-BEFORE-CODING.md, README.md, the root CLAUDE.md and ai-workflow-rules.md; they are not blanks) and list them ALL in a table with columns: number, marker type, file, section, what is needed, owner, what it blocks (first coding unit / a named unit / deployment):
  [[FILL-BEFORE-CODING: ...]]   [[FILL-BEFORE-UNIT: ...]]   [[FILL-BEFORE-DEPLOYMENT: ...]]
Also list every "TBD — to be decided by the project owner". Then list, separately and without asking me to fill them, the items tagged [O] or written "OPEN (U-xx)" that are waiting for stakeholder answers.

Step 2. Ask me for the values, one group at a time (do not dump every question at once). Suggested groups: (a) backend language and framework, developers' skills, names and roles, who builds what; (b) I-14 and I-15 (tell me where to look); (c) development environment; (d) the data model and the build plan; (e) the sample files (Excel, not PDF), extra participant Excel columns, unique solutions; (f) session length and judge and controller credential format; (g) UI library, icons, fonts; (h) hosting on the event day.
Never invent a value. If I say I do not know, leave the marker in place and tell me what it blocks.

Step 3. For the data model and the build plan, propose a draft based ONLY on the constraints already written in the context files, and wait for my explicit approval. Never mark anything approved yourself. The first unit is the foundation only (repository, environment, CI, skeleton).

Step 4. When I give a value, show me the exact replacement, then edit ONLY that marker location: replace the marker with the value, keep the status tag [T] for team or project-owner decisions, tick the box in context/FILL-BEFORE-CODING.md, and add one line to context/progress-tracker.md under "Context change log" (date, what changed, files touched, who).

Step 5. If a value conflicts with anything already written in the context files, STOP. Do not overwrite. Describe the conflict and ask me which to keep. Note it in the "Context change log".

Step 6. Do not edit anything else. Do not resolve items waiting for stakeholder answers.

Step 7. At the end, search context/ again for FILL-BEFORE-CODING and report the markers that remain. Coding may start only if none remain AND I have approved the items in section E of context/FILL-BEFORE-CODING.md (including the data model and the Unit 1 spec). Follow the "Coding gate" in context/ai-workflow-rules.md.
```
