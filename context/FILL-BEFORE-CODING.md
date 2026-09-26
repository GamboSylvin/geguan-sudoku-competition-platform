# Fill before coding — checklist for the person who completes the context (v2, 2026-09-26)

**Purpose.** A person goes through **all** the context files, finds what is marked as missing and needed before coding, fills it in, and only then starts coding.
While that person works, the requirements questions keep being answered and the context builder keeps updating the context files (see "How to work in parallel").

**Who fills.** The person completing this checklist may **decide the items marked "project owner"** as well as the "team" items. Values decided here are tagged **[T]** (team or project-owner decision).

## How to find the blanks

Search the whole `context/` folder for these markers. Each one has a blank (`________`) and an owner:

- `[[FILL-BEFORE-CODING: ... ]]` — required **before the first coding unit**.
- `[[FILL-BEFORE-UNIT: ... ]]` — required before the named unit only.
- `[[FILL-BEFORE-DEPLOYMENT: ... ]]` — needed to deploy, not to start coding.

The descriptions of the markers in this file, `README.md`, `ENTRY_POINT.md` and `ai-workflow-rules.md` are not blanks. The real blanks are in `architecture.md`, `code-standards.md`, `project-overview.md`, `ui-context.md`, `data-model.md`, `specs/00-build-plan.md` and `samples/README.md`.
`TBD — to be decided by the project owner` marks a value left blank on purpose; it is filled through a marker above.
Placeholders: `data-model.md`, `specs/00-build-plan.md` and `samples/` are empty structures to fill.
Items tagged `[O]` or written `OPEN (U-xx)` that are **not** in this checklist are **waiting for stakeholder answers**: do **not** fill them (see section D).

## A. Required before the first coding unit — `FILL-BEFORE-CODING`

| # | What to fill | Where | Owner | Done |
|---|---|---|---|---|
| A1 | **Backend language and framework** = ________ (I-02) | `architecture.md` Stack table; `code-standards.md` Language and Framework | Project owner | [ ] |
| A2 | **Developers' skills** = ________ (I-18): what each knows well; experience with real-time apps, PostgreSQL, Redis | `project-overview.md` Client and team | Project owner | [ ] |
| A3 | **Names and roles** of developer 1, developer 2, project owner, business lead; **who builds what** = ________ (I-17, I-23) | `project-overview.md` Client and team | Project owner | [ ] |
| A4 | **I-14 and I-15**: what they are and how they are resolved = ________. **Where to look:** `requirements/REQUIREMENTS.md` §12 and `decisions/unmade-decisions.md` (search for I-14 and I-15) | `architecture.md` Open technical decisions | Project owner | [ ] |
| A5 | **Development environment** = ________ (I-24): reproducible setup, dependency lock files, `.env.example`, containers if the stack needs them | `architecture.md` Development environment | Team | [ ] |
| A6 | **Data model and schema**, filled and approved (I-01), keeping the model ready for team rotation | `data-model.md` (placeholder) and the marker in `architecture.md` | Team | [ ] |
| A7 | **Build plan** and the **Unit 1 spec**, for the first slice (Individual stage, end to end). **Unit 1 is the foundation only** (repository, environment, CI, skeleton) | `specs/00-build-plan.md` (placeholder), then `specs/01-...` | Team | [ ] |

Coding may start when every A item is ticked **and** the data model and the Unit 1 spec are approved.

## B. Required before a specific unit — `FILL-BEFORE-UNIT` (the person can fill these)

| # | What to fill | Unit | Where | Done |
|---|---|---|---|---|
| B1 | **Sample files placed** in `context/samples/`: `participants-sample.xlsx` and `question-sample.pdf` | Import units | `samples/README.md`; marker in `architecture.md` (Import formats) | [ ] |
| B2 | From the samples: **extra Excel columns** = ________ (U-40); **does the question PDF carry the points** = ________ (U-03); **grid shapes** in the PDF = ________ (U-01); **is a unique solution guaranteed for every puzzle** = ________ (U-90) | Import; answer check | marker in `architecture.md` (Import formats) | [ ] |
| B3 | **Session length** = ________ (I-16); **judge and controller credential format** = ________ (I-30) | Authentication | marker in `architecture.md` (Auth and access model) | [ ] |
| B4 | **UI component library** = ________ ; **icon set** = ________ ; **fonts, including Chinese** = ________ (I-20) | First UI unit | marker in `ui-context.md` | [ ] |

## C. Required to deploy, not to start coding — `FILL-BEFORE-DEPLOYMENT`

| # | What to fill | Where | Owner | Done |
|---|---|---|---|---|
| C1 | **Where the server runs on the event day** = ________ (I-03, U-46): who sets it up and runs it; on-site fallback server or not | `architecture.md` Stack table (Hosting) | Project owner | [ ] |

## D. Waiting for stakeholder answers — do NOT fill

These are still open. They are being answered through the question process, and the context builder updates the files. Do not fill them. If a unit depends on one, stop and report it.

- When students see their score (U-24, U-88) · awards and reset after an early finish (U-27, U-89)
- The second team round (U-05, U-21) · question files per category (U-32) · acceptable interruption length (U-49) · scope of the 15-day deletion (U-59, U-62)
- Access rules (U-63, U-55) · the venue network and tablets (U-06) · risks, external systems, performance targets, scale ceiling, reliability (U-56 to U-61)
- Look and brand, layouts, screen sizes, language switching, accessibility (U-65 to U-70) · authoring and a third language (U-45, U-51)

## How to work in parallel

- The requirements questions are still being answered. New answers are recorded first in the working files (`context-working/`, **outside this folder; do not read them to decide what to build**), then reflected in the context files by the context builder.
- **The person filling this checklist edits only the marked blanks** and ticks the boxes here. Everything else in the context files may change as new answers arrive.
- When a blank is filled: replace the marker with the value, keep the status tag (`[T]` for a team or project-owner decision), and add a line to `progress-tracker.md`, "Context change log".
- **Conflicts:** if a fill contradicts something already in the context files, or a new answer contradicts your fill, do not overwrite silently. Note the conflict in the "Context change log" and ask the project owner which to keep.
- Before coding starts, search the folder once more for `FILL-BEFORE-CODING`. If any marker remains, coding must not start.

## Prompt for your agent (copy and paste)

```text
You are helping me complete the context folder of the project "Sudoku Arena" before any coding starts. Do NOT write code.

Read, in this order: context/ENTRY_POINT.md, context/README.md, context/FILL-BEFORE-CODING.md, then every other file in context/ (including context/samples/README.md and the placeholders context/data-model.md and context/specs/00-build-plan.md).
Do NOT read the folder context-working/. It holds superseded notes. Do NOT edit requirements/, decisions/ or archive/ (you may READ requirements/REQUIREMENTS.md section 12 and decisions/unmade-decisions.md only to look up items I-14 and I-15).

Step 1. Search all of context/ for these markers (ignore the DESCRIPTIONS of markers in FILL-BEFORE-CODING.md, README.md, ENTRY_POINT.md and ai-workflow-rules.md; they are not blanks) and list them ALL in a table with columns: number, marker type, file, section, what is needed, owner, what it blocks (first coding unit / a named unit / deployment):
  [[FILL-BEFORE-CODING: ...]]   [[FILL-BEFORE-UNIT: ...]]   [[FILL-BEFORE-DEPLOYMENT: ...]]
Also list every "TBD — to be decided by the project owner". Then list, separately and without asking me to fill them, the items tagged [O] or written "OPEN (U-xx)" that are waiting for stakeholder answers.

Step 2. Ask me for the values, one group at a time (do not dump every question at once). Suggested groups: (a) backend language and framework, developers' skills, names and roles, who builds what; (b) I-14 and I-15 (tell me where to look); (c) development environment; (d) the data model and the build plan; (e) the sample files, extra Excel columns, whether the question PDF carries points, grid shapes, unique solutions; (f) session length and judge and controller credential format; (g) UI library, icons, fonts; (h) hosting on the event day.
Never invent a value. If I say I do not know, leave the marker in place and tell me what it blocks.

Step 3. For the data model and the build plan, propose a draft based ONLY on the constraints already written in the context files, and wait for my explicit approval. Never mark anything approved yourself. The first unit is the foundation only (repository, environment, CI, skeleton).

Step 4. When I give a value, show me the exact replacement, then edit ONLY that marker location: replace the marker with the value, keep the status tag [T] for team or project-owner decisions, tick the box in context/FILL-BEFORE-CODING.md, and add one line to context/progress-tracker.md under "Context change log" (date, what changed, files touched, who).

Step 5. If a value conflicts with anything already written in the context files, STOP. Do not overwrite. Describe the conflict and ask me which to keep. Note it in the "Context change log".

Step 6. Do not edit anything else. Do not resolve items waiting for stakeholder answers.

Step 7. At the end, search context/ again for FILL-BEFORE-CODING and report the markers that remain. Coding may start only if none remain AND I have approved the data model and the Unit 1 spec. Follow the "Coding gate" in context/ai-workflow-rules.md.
```
