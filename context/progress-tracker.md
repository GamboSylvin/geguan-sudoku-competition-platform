# Progress Tracker (DRAFT v1, 2026-09-26)

Update this file after every meaningful change.

## Current Phase

**Pre-build: context files and requirements confirmation.** No code exists. **Not yet ready to start coding**: see "Minimum to start coding" below.

## Current Goal

Close the few blockers left, draft the data model and the build plan for approval, and start the first unit (Individual stage, end to end).

## Completed

- The pre-build interview (all seven steps and the workflow items) was run; the record is in `context-feeders/working/_interview-notes.md`.
- Open questions were collected in `context-feeders/working/_open-questions.md`; the client-facing questions are in `context-feeders/working/_stakeholder-question-pack.md`.
- Part 1 of the pack (Q1 to Q6, scoring and round rules) and the builder's blocking questions were answered on 2026-09-26. The answers were transferred from `decisions-for-the-context-builder.md` (removed after transfer) into these files. That file stated they were **confirmed by the stakeholder**, which reverses their earlier [T] status.
- First draft of the context folder written and updated to v1.

## In Progress

- Answering the rest of the pack: Q7 (the second team round, "齐心协力") and Parts 2 to 7, minus what the 2026-09-26 decisions already answered.

## Minimum to start coding

The full checklist, with the blanks to fill and who owns each, is `FILL-BEFORE-CODING.md`. Search `context/` for `FILL-BEFORE-CODING` to find every blank. Another person fills them while the requirements questions continue to be answered.

**Still required before Unit 1 (foundation):**

| # | Item | Who |
|---|---|---|
| 1 | **Backend language and framework: TBD — to be decided by the project owner** (I-02). Also the developers' skills (I-18) | Project owner |
| 2 | **I-14 and I-15**: the requirements list them as needed before coding; their content is not described in these files | Project owner: what are they? |
| 3 | **Development environment** (I-24): reproducible setup, lock files, `.env.example`, containers if needed | Team |
| 4 | Approve the **data model** (I-01), which has still to be drafted (skeleton checkpoint), and the **build plan and Unit 1 spec** | I draft; the team approves |

**Required before specific units (not before Unit 1):**

| Item | Blocks |
|---|---|
| Sample participant Excel and question PDF (U-01); extra Excel columns (U-40); whether the PDF carries points (U-03) | Setup and import units |
| Format of judge and controller credentials (I-30); session length (I-16) | Authentication unit |
| Unique solution of every puzzle (U-90); grid shapes from the sample PDF (U-01) | Question, answer check and runtime units |
| When students see scores (U-24, U-88); awards and reset after an early finish (U-89, U-27) | Results and finish units |
| The second team round (U-05, U-21); question files per category (U-32) | Team stage (later slice) |
| Hosting (**TBD — to be decided by the project owner**, U-46); names, roles and who builds what (**TBD — to be decided by the project owner**, I-17, I-23) | Deployment; assignment of units. Not needed to start coding |
| Client confirmation of the requirements in writing (methodology Step 8, A14) | The methodology makes it mandatory before specs are written (see `FILL-BEFORE-CODING.md`, section E). Whether it can wait until after Unit 1 is a decision for the project owner |

## Next Up

1. The project owner supplies items 1 and 2 above (backend language and framework; what I-14 and I-15 are).
2. I draft the **data model**, the **build plan** and the **Unit 1 spec** for the team to approve. First slice: the **Individual stage, end to end** [C] (BLD-009), keeping the model ready for team rotation.
3. Send the sample participant Excel and question PDF (U-01).
4. Continue the pack (Q7 and Parts 2 to 7), updating these files as answers arrive.

## Blocked

Coding is blocked by items 1 to 4 of "Minimum to start coding". Nothing else blocks Unit 1.

## Reference material (out of date, [T]; not a plan to follow)

- **Earlier 15-day plan**, kept "for reference" and "to be reworked" (ARCHITECTURE §9 of the source documents): 1 Foundation; 2 Competition setup and imports; 3 Question system; 4 Runtime; 5 Scoring and ranking; 6 Big screen; 7 Integration and failure cases; 8 Stabilization, with no new features.
  It puts an "authentication foundation" in days 1 to 2 and setup and imports (days 3 to 6) before runtime (days 7 to 9), as a reference, not a rule. It predates the stakeholder's answers, so it has no team rotation, several categories, judge ranges, corrections, purge, export or copy (I-01).
- **Reference work split** (ARCHITECTURE §9): one developer takes the competition lifecycle, orchestrator, judge and controller APIs, WebSocket state and the server timer; the other takes the player UI, gameplay grid, submission UI, scoring and ranking, and the big screen; both share the database model, authentication, integration and testing. It predates the stakeholder's answers; who builds what is **TBD — to be decided by the project owner** (I-23).
- **Needed before coding** (REQUIREMENTS §12): I-01, I-06, I-10, I-14, I-15. I-06 and I-10 are now decided (BLD-006, BLD-007); I-11 is covered by the late-submit rule; **I-14 and I-15 are not described here.**

## Context change log

Record here every change to the context that a unit might depend on: a confirmed rule that changed, a blank that was filled, a conflict that was raised and how it was resolved. One line per change: date, what changed, files touched, who.
The person completing the context and the context builder both add lines. If two changes conflict, do not overwrite: raise it and ask the project owner which to keep.

- 2026-09-26: context folder created (v1). Working files moved out to `context-feeders/working/`. Sample files folder `samples/` added.
- 2026-09-26: `requirements/`, `decisions/`, `archive/` and the working files were moved into one transit folder, `context-feeders/` (with `working/` for the working files). 307 paths inside the documents were updated, a role note was added at the top of each of the 23 files, and `context-feeders/README.md` was added. Contents were not changed otherwise. A full backup was taken before the move.
- 2026-09-26: the entry point was merged into the root `CLAUDE.md` (as the methodology requires). The documentation-phase rules of the previous `CLAUDE.md` were kept in full; the "do not implement" line now says coding needs an explicit request and the coding gate. Backup of the previous file: `context-feeders/working/CLAUDE.documentation-phase.backup.md`. `context/ENTRY_POINT.md` was removed.

## Known Issues

- The module list and schema (I-01) predate the stakeholder's answers: no module for team rotation, corrections, purge, import/export, copy, numbering, judge ranges and takeover, or several big screens.
- The load target of about 800 clients is listed as [C] (EVT-001) and also as an open point (I-05). Not reconciled.
- The participant figures do not add up: 11 rooms (10 of about 30 and one of about 300) is about 600, not 600–720 (U-02).
- Question delivery now differs from the client's original document, which preloads questions on the tablets (decision BLD-006: fetch at the round start).
- IDs to verify against the register: U-45 (puzzle authoring, earlier cited as U-43) and U-47.

## Withdrawn or corrected statements (do not reintroduce)

- The controller is **not** recorded as the primary user (U-52 open). No feature table of "must exist first" exists; the first slice is the Individual stage end to end (BLD-009).
- Puzzle authoring is **not** declared out of scope (U-45 open). A third language is **not** declared out of scope (U-51 open).
- No backend language is recommended; Node.js is only suggested by the register and is not decided (I-02).
- No plan requirement to add a "compatibility check": the documents say only that a test on a real tablet was proposed as a team default (U-06).
- No session-length constraint is stated (I-16). No stated product constraint on last-second fairness beyond the late-submit rule.
- Corrected: a judge restart gives the **remaining** round time, not the full round time. The late-submit rule applies to the **Individual rounds** only; the team rotation's 60 seconds is an interval for moving questions, not a deadline.
- The full history is in `context-feeders/working/_interview-notes.md`, "Corrections received". Keep or archive it before deleting that file.

## Open Questions

Full list: `context-feeders/working/_open-questions.md`. The client-facing subset: `context-feeders/working/_stakeholder-question-pack.md`. Highest impact now:

- I-14 and I-15: what are they?
- U-01, U-03, U-40: the sample files, points in the PDF, extra Excel columns.
- U-90: unique solutions.
- U-24, U-88: when students see their score. U-89, U-27: awards and reset after an early finish.
- U-05, U-21: the second team round. U-32: question files per category.
- U-62, U-59: what the 15-day deletion covers. U-49: acceptable interruption length.
- U-63, U-55: access rules. I-30: judge and controller credentials. I-16: session length.
- U-06, U-46: tablets, Quark version, venue network.

## Architecture Decisions

React with TypeScript, PostgreSQL + Redis (persistence on), WebSocket, modular monolith, server authority [T]; files on the server's disk [C]; questions fetched at the round start [C]; replay acceptable after a restart, competition returns paused [C]; one role per account [C]; generic grid model [C]. See `architecture.md`. The backend language is **TBD — to be decided by the project owner**.

## Recent Decisions (2026-09-26, stated as confirmed by the stakeholder, [C])

The scoring and round rules (`competition-rules.md`), plus: files on the server's disk; one branch per unit, a pull request before every merge, CI with lint, type check, tests and build, and the other developer reviews each PR; participant username = participant number with a short random password; Excel columns Name, School, Category, Team with a generated number; one role per account with several controller accounts allowed; question sets per category; questions fetched at the round start; replay acceptable after a restart; the controller assigns judge ranges during setup and can change them during the event; first slice = the Individual stage end to end; answer check against the stored solution; generic grid model.

## Current Architecture State

Nothing is built. There is no repository structure, no framework and no schema.

## Current Database State

No database exists. The schema is not designed (I-01).

## Session Notes

- Assume nothing. Anything marked **TBD — to be decided by the project owner** must stay blank until the project owner decides.
- The working files (in `context-feeders/working/`, outside this folder) are the record of the requirements process. Answers are recorded there first, then reflected here.
- The root `CLAUDE.md` governs `context-feeders/requirements/`, `context-feeders/decisions/` and `context-feeders/archive/`; their content was not changed while drafting this folder (they were only moved into `context-feeders/`, with paths updated and a role note added at the top of each file).
- Runtime environment facts (versions, environment variables, commands): none yet.

## Last Updated

2026-09-26: context folder updated to v1 with the 2026-09-26 decisions (scoring and round rules; build and engineering decisions). `decisions-for-the-context-builder.md` transferred and removed.
