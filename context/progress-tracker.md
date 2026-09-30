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
- 2026-09-30: Part 1 of the pack closed out — its remaining five items answered. **Question import format corrected from PDF to Excel** [C] (BLD-024, resolves U-93): every earlier "question PDF" statement is replaced. Points stay fully customizable regardless of what the file carries [C] (BLD-025, resolves U-92). Categories confirmed as U6 to U20, the original scheme [C] (BLD-027, resolves U-95). One question file per category, not shared [C] (BLD-028, resolves U-32). Students see scores only when the whole competition reaches `FINISHED` [C] (BLD-029, resolves U-24, U-88). Reset after finishing is settled — never, already documented (REQUIREMENTS §7.7) — and awards after an early finish is narrowed to a working position pending a clearer re-ask (U-89, U-27; BLD-030). The complete-solution column is missing from the source files; a working position asks the source to add one, with hand-transcription as a stopgap (BLD-026, U-94 open, re-asking). TEM-006 to TEM-008 (second team round numbers) got no reply and stay as working positions **now treated as usable for building**, since working positions (and even stakeholder-confirmed rules) can be revised later without a rebuild. Recorded across `competition-rules.md`, `architecture.md`, `data-model.md`, `project-overview.md`, `ui-context.md`, `code-standards.md`, `README.md`, `samples/README.md`, `specs/00-build-plan.md`, `FILL-BEFORE-CODING.md` and the working files.
- 2026-09-29: Q7 of the pack (the second team round, "齐心协力") answered. It is the client document's partition collaboration: one puzzle split into row-band blocks, one block per member (2 to 6), each editing only their own block, scored all-or-nothing once combined, no early bonus. Which mode and the block split are a direct answer [C] (TEM-005, resolves TEM-003, U-21, U-05, U-91). Puzzle count (3), total time (30 min) and points per puzzle (20/puzzle) are **working positions, not sourced** [T] (TEM-006 to TEM-008); flag for replacement once the 4th Zhejiang league regulation numbers arrive (pack ref R9). Needed on the event day, since the school total counts both team rounds; needed by about day 8 of the build if required on competition day. Recorded in `competition-rules.md` §1 and §8, and `architecture.md` (Data model).

## In Progress

- Answering the rest of the pack: Parts 2 to 7, minus what the 2026-09-26 decisions already answered. Q7 (the second team round) was answered 2026-09-29, see Completed.

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
| Sample participant Excel and question Excel placed in `context/samples/` (question file is **Excel, not PDF**, corrected 2026-09-30); extra participant Excel columns (U-40) | Setup and import units |
| Format of judge and controller credentials (I-30); session length (I-16) | Authentication unit |
| Unique solution of every puzzle (U-90); the missing complete-solution column (U-94, re-asking) | Question, answer check and runtime units |
| Awards after an early finish (U-89 narrowed, U-27) — reset is settled: never | Results and finish units |
| Replace the working-position numbers (TEM-006 to TEM-008) with the regulation's real puzzle count, time and points, once available (pack ref R9) — **not blocking**, they are in use for building now | Team stage (later slice) |
| Hosting (**TBD — to be decided by the project owner**, U-46); names, roles and who builds what (**TBD — to be decided by the project owner**, I-17, I-23) | Deployment; assignment of units. Not needed to start coding |
| Client confirmation of the requirements in writing (methodology Step 8, A14) | The methodology makes it mandatory before specs are written (see `FILL-BEFORE-CODING.md`, section E). Whether it can wait until after Unit 1 is a decision for the project owner |

## Next Up

1. The project owner supplies items 1 and 2 above (backend language and framework; what I-14 and I-15 are).
2. I draft the **data model**, the **build plan** and the **Unit 1 spec** for the team to approve. First slice: the **Individual stage, end to end** [C] (BLD-009), keeping the model ready for team rotation.
3. Place the sample participant Excel and the sample question Excel (**not PDF**) in `context/samples/`.
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
- 2026-09-29: Q7 (the second team round) answered by the user; recorded in `competition-rules.md`, `architecture.md`, `context-feeders/working/_open-questions.md` and `_stakeholder-question-pack.md`. No follow-up questions were needed.
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
- U-40: extra participant Excel columns.
- U-90: unique solutions. U-94: the missing complete-solution column (re-asking, first reply too short).
- U-89, U-27: awards after an early finish (narrowed; reset is settled: never).
- TEM-006 to TEM-008: no reply on the real numbers yet; working positions stay in use for building, no rebuild needed when they arrive.
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

2026-09-30: Part 1 of the pack closed out (five remaining items answered: import format corrected PDF to Excel, points customizable, categories confirmed, one file per category, score visibility, awards narrowed, solution column open). Q1c, Q4c, Q5b, Q6b, Q7b removed from the pack; the five items the stakeholder answered directly need no confirmation round-trip; the solution column and awards carry forward as Q37 and Q38 for a clearer stakeholder re-ask; the second team round's numbers stay a working position, already in use, tracked via R29.
2026-09-29: Q7 (the second team round) recorded across `competition-rules.md`, `architecture.md` and `progress-tracker.md`.
2026-09-26: context folder updated to v1 with the 2026-09-26 decisions (scoring and round rules; build and engineering decisions). `decisions-for-the-context-builder.md` transferred and removed.
