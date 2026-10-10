# Project Instructions

> **If you are a new AI agent being introduced to this project, read the matching hand-off file at the repository root first, in full, before this one:** `AI-HANDOFF-CONTEXT.md` if you are the context-keeping agent (never writes `backend/`/`frontend/` code), or `AI-HANDOFF-CODE.md` if you are the coding agent. Either file explains the role, the hard rules, and how the project owner works — this file and the rest of `context/` describe the project itself, not how to behave on it. (Both hand-off files are local-only, listed in `.gitignore` by the project owner's choice — they may not exist in every checkout.)

## Application Building Context

**Before anything else, read `context/FILL-BEFORE-CODING.md`.** Search `context/` for the blanks it describes: `FILL-BEFORE-CODING` (blocks all coding), `FILL-BEFORE-UNIT` (blocks only the unit it names), `FILL-BEFORE-DEPLOYMENT` (blocks deployment, not coding). **None of today's open rows block coding** — see "Current status" below for exactly what's open and why it doesn't block.

Read the following files in order before implementing or making any architectural decision:

1. `context/README.md` — what the files are, the status tags, the reading rules
2. `context/project-overview.md` — product definition, goals, features, and scope
3. `context/competition-rules.md` — the decided competition and scoring rules, and the open ones
4. `context/architecture.md` — system structure, boundaries, storage model, and invariants
5. `context/ui-context.md` — screens, states, and interaction rules
6. `context/code-standards.md` — implementation rules and conventions
7. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
8. `context/progress-tracker.md` — the living current-state document: current phase, what's built, what's in progress, what's next, blockers, open questions. **This is the single most current file in the project — read it in full.** Its chronological history (the full dated logs) is in `context/progress-tracker-history.md`; read that only when you need the history. If anything in this `CLAUDE.md` file ever disagrees with `progress-tracker.md`, trust `progress-tracker.md` and fix this file.
9. `context/data-model.md` — the data model and schema, **approved 2026-09-30**, amended several times since (2026-10-01: `RoundSettings` fields for the second Team round; 2026-10-07: `Question.roundId` made nullable, migrated 2026-10-08; 2026-10-08: `QuestionSet` reading corrected, OCR exception withdrawn)
10. `context/specs/00-build-plan.md` — full build order with dependencies, **approved 2026-09-30**, 15 units

Before starting any unit, read its spec at `context/specs/NN-unit-name.md` for that unit's goal, implementation details, acceptance criteria, and scope. **Check the spec file's own header line.** It says either `APPROVED` or `DRAFT, awaiting approval`. **If it still says draft, stop and get the project owner's explicit approval before writing any code for that unit** — this applies per unit, separately from the one-time gate below, and it is a real, current requirement, not leftover boilerplate. See "Current status" for exactly which specs exist today and their approval state.

### Keeping the documents current (mandatory)

**`progress-tracker.md` is a living current-state document, not an append-only log.** It must always reflect what is being built, what is done, what is next and what is blocked. Update it after each meaningful implementation change. Keep it short: **replace stale lines, do not just append** — a file that only grows stops being readable and stops telling you the actual state. When you need to record a dated entry, append it to the matching section at the bottom of `progress-tracker-history.md` (the archive), and keep only the current state in `progress-tracker.md`. Never delete history — move it to the archive.

**Every document behind a concluded decision must be brought up to date.** When a decision, rule, scope or data-model change is concluded, do not update only the requirement or decision register: update **every concerned document** so the project state is consistent and current — the `context/` files, the affected specs, the data model **and its concrete form** (`backend/prisma/schema.prisma` and migrations), and any other artifact that encodes the change. A decision is not "done" until every document that describes it matches. If two documents disagree, do not silently pick one — identify the difference and ask which is authoritative, then reconcile the rest to it.

If implementation changes the architecture, scope, or standards documented in the context files, ask, then update the relevant file before continuing.

**Open-item gate.** Anything tagged **[O]** or marked OPEN is not decided. Do not implement it and do not guess it. If a unit depends on an open item, stop and report it.
**Status gate.** **[C]** means the client's stakeholder confirmed it (on the date shown; a confirmed rule can change later, and the change is logged in `context/progress-tracker.md`). **[T]** decisions were made by the team or the project owner and are not stakeholder-confirmed.

Open items not yet answered live in `context-feeders/decisions/unmade-decisions.md`. (The earlier working files under `context-feeders/working/` — the interview record and the question pack — were removed 2026-10-01 once fully answered; everything they held is reflected in `context-feeders/decisions/` and `context/`, see `context-feeders/README.md`.)

---

## Current status (last checked 2026-10-11 — if this section looks out of date, `context/progress-tracker.md` is always the authority; update this section to match it)

**Phase: build complete, pending verification and deployment — the event is ~1 day away.** The one-time coding gate passed 2026-09-30. The project owner gave the explicit go-ahead to build on 2026-10-01. Requirements were refined in parallel through the stakeholder process throughout — that is normal and did not block building. **No dedicated UI/visual design pass will happen before the event** (UI-008, 2026-10-08): every screen ships with its current functional, Headless UI + Heroicons + Tailwind-default styling; do not spend build time on visual polish.

**The two contributors' branches were merged 2026-10-11.** `sylvin` carried Units 13 and 14 (both Team rounds); `louise` carried the `RoundParticipation` fix, Unit 12, Unit 15 and the BLD-048 deployment track. A merge of `louise` into `sylvin` is still in progress: the project owner resolved the six conflicted files by keeping *both* sides, and this file — along with the rest of `context/` — has been reconciled so each topic has one current statement instead of two contradictory ones. `backend/src/app.ts` was the one file still holding literal conflict markers (so the backend could not compile) and is resolved as a **union** of both sides, because each had added a different hook to `installListeners()`.

**What's actually built (14 of the 15 planned units — every unit except `04`):** `01` Foundation, `02` Authentication and accounts, `03` Competition setup and lifecycle, `05` Question import and question sets, `06` Judges and ranges, `07` Round runtime and autosave, `08` Submission/answer check/scoring, `09` Individual ranking and big-screen ranking, `10` Judge supervision and single-student restart, `11` Controller live commands, `12` Results, corrections, export and purge, `13` Team stage rotation relay, `15` School ranking and competition copy — all **verified live under Docker** when built (the latest full-suite counts recorded are backend **170/170 across 14 suites**, frontend **49/49 across 9 suites**, from Unit 15's run). `14` Team stage partition collaboration (齐心协力) is **built but NOT verified**: Docker Desktop was down for its entire build (2026-10-09) and is still not reachable as of 2026-10-11, so nothing in it has been compiled, linted, typechecked, tested or built, and its migration `20261009000000_add_team_partition_state` is **written but not confirmed applied** — see `context/progress-tracker.md`'s "In Progress" for the exact four verification steps, and "Blocked" (the one current blocker is Docker Desktop itself, which the sandbox cannot start). **`04` (participant import) has no code at all** — no module, no endpoint, no spec. Full detail for each unit (modules touched, endpoints, test counts) is in `context/progress-tracker.md`'s "What's Built" table — read that instead of a summary here, which would only go stale again.

**The build order was deliberately reordered twice, and both reorders are now finished.** The project owner instructed: build Unit 13 for Sylvin, then Unit 14; Louise does Unit 12 — so 13 and 14 preceded 12, and 15 was built in parallel with them. This breaks nothing: the dependency runs the *other* way (Unit 12 **consumes** the team rounds' `TeamRoundResult`, and Unit 15's school total reads both of them); 13 depends on Units 07, 08 and 11, and 14 on 13, 08 and 11. All three specs (12/14/15) read `APPROVED (2026-10-08)`, cleared in one blanket project-owner approval (BLD-046) given the time left. **There is no next unit to build.** What remains: verify Unit 14 on the merged tree, conclude and commit the merge, build Unit 04 if U-01 ever resolves, and deploy. Unit 12's inherited obligations are all discharged: results hidden for a `CANCELLED` competition (ROL-009, U-31), readable for one that finished early (`Competition.finishedEarly`), and `TeamRoundResult` rows readable and exportable for a finished Team round.

**Findings, by origin — all in `context/progress-tracker.md`'s Known Issues, all open, non-blocking, and needing a project-owner answer:** Unit 11 **six** (logged in the decision register as `I-33`–`I-38`, plus Unit 05's `题目`-column sibling), Unit 12 **two**, Unit 13 **one**, Unit 14 **two**, the `RoundParticipation` fix pass **one**, Unit 15 **nine**, and the BLD-048 deployment track **four**. Each is a spec-underspecified point implemented to the most defensible reading and flagged in the code where it lives. The headline ones: Finding 7 (Unit 13) — an **incorrect submit leaves the question in circulation**, isolated in `team-rotation.service.ts`'s `keepIncorrectSubmitInCirculation()`. **Finding 8** (Unit 14) — a three-way disagreement over whether `TeamPartitionState` already existed: the spec said "no new tables", `schema.prisma`'s header said only `TeamRotationState` exists, but the 2026-09-30-approved `data-model.md` had defined it all along; per this file's own rule the approved data model was treated as authoritative and the other two reconciled to it, and the table **was added** (the build's only new table) with the alternative reading (Redis-only, delete it) spelled out in the Finding for ratification — decided rather than stalled because two confirmation popups timed out with ~1 day to the event. **Finding 9** (Unit 14) — the two flagged assumptions, the row-band split computed once per team and reused across every puzzle, and the other members' bands shown **read-only, not hidden**, each isolated in a named seam (`reuseSplitAcrossPuzzles()`, `showOtherBandsReadOnly()`), deliberately *not* logged in `unmade-decisions.md` because the spec itself already states the resolution; they are defaults open to revision, not open items. Note what is deliberately **not** a Finding: a team round emits no `round:started` — the spec never mentions it, and BLD-040 settles it (a team round never sets `Question.roundId`, so `GET /api/gameplay/:roundId/state` finds nothing for one by design; the pool is drawn from the category's `QuestionSet`s instead).

**The one BLOCKING bug is FIXED and verified (2026-10-08) — nothing blocks anything now.** No application code ever created a `RoundParticipation` row (only five test files hand-seeded one), and nothing ever transitioned one to `ACTIVE` except the orchestrator's single-participant restart — so the real player flow 403s, and `gameplay.service.ts`'s round-ended auto-submit sweep (which queries `state: "ACTIVE"`) would silently do nothing even once creation existed. Both halves shared one fix point and are closed there: `round.service.ts`'s `startActivePhaseFromTimer` now runs `openParticipationsForRound` just before starting the round timer, fetching every `active: true` `Participant` of the competition — **across every category**, since a `Stage`/`Round` is per-competition — and **upserting** one row each (`state: "ACTIVE"`, the participant's own `categoryId`) on the schema's `@@unique([roundId, participantId])`, via two new `round.repository.ts` functions (`listActiveParticipants`, `upsertActiveParticipation`). No `Attempt` is written there and nothing was built for the Team stage. The missing regression test now exists in `backend/tests/round.test.ts` (3 cases, hand-seeding nothing — it shortens `RoundSettings` and lets the real timer hook do the transition); backend **154/154**, frontend untouched at **43/43**, plus a six-step live reproduction over HTTP against the Docker stack (rows 0 → 2 × `ACTIVE`, autosave 200, reconnect 200, judge restart 200, both rows `AUTO_SUBMITTED`, round `FINISHED`). No schema change, no new dependency, no new error code. **One new Finding came out of it** and needs a project-owner answer, not a unilateral fix: a judge/controller restart leaves a non-archived placeholder `Attempt` that Unit 08's idempotent finalize returns as-is, so the restarted participant gets no `IndividualRoundResult` and silently drops out of the ranking — pre-existing, only reachable now that real participation rows exist. Detail is in `context/progress-tracker.md`'s "In Progress" and "Known Issues".

**Unit 05's three code-side follow-ups are all done in code** (2026-10-08): `Question.roundId` is nullable with its migration (BLD-040); `ranking.service.ts`'s `breakTie` implements SCR-020's individual-level tie-break; and Unit 03's publish-readiness check now requires exactly 6 assigned questions per Individual round, so it no longer passes vacuously. **SCR-020's school-level half is now built too** — Unit 15's own `schoolBreakTie`, a separate function, not a call into the individual one (its reading of "counted players" is Unit 15 Finding 5). **One follow-up remains, not blocking** (in `context/progress-tracker.md`'s "Known Issues"): Unit 05's importer parses the `题目` instruction column but never persists it — `Question` has no such column — which needs a project-owner call, not a guess. (The other one, backend Jest's `--runInBand` requirement, was closed at the end of Unit 11: the flag is now in `backend/package.json`'s `test` script.)

**Deployment is designed and its files exist (BLD-048, decided 2026-10-09) — the server itself is not created.** A single Alibaba Cloud ECS instance, Mainland China region, reached by public IP (no domain, so no ICP备案 yet and no HTTPS either — both flagged for a pre-event revisit, I-39/I-40), manual redeploy by choice. It **supersedes BLD-031's Railway two-phase plan**, on a fact that plan didn't know: the students are in mainland China with no VPN. Production does **not** run the existing `docker-compose.yml` — that file and both `Dockerfile`s are the live development setup and were left untouched; production runs a separate `docker-compose.prod.yml` + `backend/Dockerfile.prod`, serving the built frontend same-origin from Express on **one** port (`backend/src/static-frontend.ts`, gated on `FRONTEND_DIST`). The runbook is `DEPLOY.md`. Execution — creating the instance and walking the runbook — stays with the project owner.

**Unit 05 reads the given cells/solution from a text column, never OCR.** A temporary OCR exception (BLD-043) was adopted 2026-10-07 and withdrawn the same window, before any code used it — the real stakeholder reply (BLD-047) confirmed a text column instead (BLD-026's original plan). The 12 real sample files in `context/samples/` predate this column and need it hand-transcribed onto local copies before they can test the real import end-to-end — see `context/specs/05-question-import-and-question-sets.md`'s Context section.

**What's blocked right now:** (1) **Docker Desktop is not running** — still not reachable as of 2026-10-11. The sandbox cannot start it ("Access is denied"), and there is no host-side fallback because host `npx`/`node` silently no-op (see "Session Notes" in `context/progress-tracker.md`). This blocks all Unit 14 verification, and now also blocks verifying the merged `app.ts`; the user must start Docker Desktop by hand, then the four steps in "In Progress" can run. (2) Unit `04` (participant import) has **no spec at all** and waits on the stakeholder, not the team: **U-01**, a real participant file with data rows and a past results sheet — neither sent, confirmed still unavailable 2026-10-07. Do not start or guess it. Nothing else is blocked; the coding gate is passed.

**Open items that do NOT block building right now** (do not wait on these): a default visual style not yet stakeholder-confirmed (U-65) and screen layouts (U-66) — both now explicitly shipping as-is for this build, UI-008; extra participant-Excel columns (U-40); a missing CI automated-review step (`FILL-BEFORE-CODING.md` row C2, needed before a real deployment, not before coding); where the event-day server runs (row C1, needed only before deployment). The full, current list is `context/progress-tracker.md`'s "Open Questions" section and `context-feeders/decisions/unmade-decisions.md`.

**Two sets of documents.** `context/` is what an agent builds from. `context-feeders/requirements/`, `context-feeders/decisions/` and `context-feeders/archive/` are the requirements record, governed by the rules below — they feed `context/`, they are not what gets built from. If the two differ, do not resolve it silently: identify the difference and ask.

---

## Project Documentation

The project root contains:

```text
CLAUDE.md            this file: the entry point
context/             the deliverable: what an agent builds from
building-with-ai/    the methodology (reference — still used during the build, not just to write context/: see its README for the per-unit workflow cycle, quality layers, and CI/CD shape)
context-feeders/     transit folder: files that only FEED context/
    requirements/    the two live requirement documents
    decisions/       the decision register
    archive/         merged source documents
```

* `context/` — the context folder, read first (see above).
* `context-feeders/` — everything that feeds `context/`. It is **not** what a coding agent builds from. Each file starts with a short note saying its role. See `context-feeders/README.md` for what each subfolder holds, including the `working/` folder's removal.

### `context-feeders/requirements/`

Contains the two live requirement documents:

* `REQUIREMENTS.md` — what the product must do: competition rules, roles, flows, screens, data, later phases, open items.
* `ARCHITECTURE.md` — how it is built: style, stack, modules, data model, real-time design, API, scale, deployment, open technical decisions.

Every statement in them carries a status tag and, where it exists, a decision ID:

* **[C]** confirmed by the stakeholder
* **[P]** proposed by the team and approved in the stakeholder's blanket answer ("accepted proposal" in the register)
* **[S]** stated in the client's original document, not contradicted, not re-confirmed
* **[T]** team decision from the engineering guideline, not reviewed by the stakeholder
* **[A]** assumed by the team, awaiting confirmation
* **[O]** open (see `context-feeders/decisions/unmade-decisions.md`)
* **[L]** later phase, not in the MVP

Requirements may be proposals unless tagged [C].

### `context-feeders/decisions/`

Contains the current decision tracking:

* `project-decisions.md` — history and current status of project decisions (rows with IDs such as SCR-001, ROL-003, PAR-005).
* `unmade-decisions.md` — decisions that are still open, deferred, or otherwise require confirmation. The file holds only open items (U-* for the stakeholder or assumptions, I-* internal, and a few later-phase rows); once an item is answered it moves to `project-decisions.md` and leaves this file. The old body, with all resolved rows, is archived in `context-feeders/archive/unmade-decisions-history.md`. Any question the project files cannot answer is recorded here, never guessed.

Decision statuses must always be respected.

### `context-feeders/archive/`

Holds the source documents whose content has already been merged into `context-feeders/requirements/` and `context-feeders/decisions/`, and `CONSOLIDATION_LOG.md`, the record of how each source was merged and checked. It is kept for reference and is not edited. `context-feeders/archive/README.md` lists each file and where it was merged.

`context-feeders/archive/client-view.md` contains the client's proposals, expectations, and vision for the project. It is the primary reference for understanding what the client has requested or proposed. Its content is merged into `context-feeders/requirements/REQUIREMENTS.md` and `context-feeders/requirements/ARCHITECTURE.md` (statements tagged **[S]**).

---

## Mandatory Documentation Review

Whenever creating, modifying, reviewing, or discussing a requirements or decision document (in `context-feeders/requirements/` or `context-feeders/decisions/`):

1. Read `context-feeders/requirements/REQUIREMENTS.md` and `context-feeders/requirements/ARCHITECTURE.md`.
2. Read both files in `context-feeders/decisions/`.
3. Read `context-feeders/archive/client-view.md`.
4. Compare the new information with the existing documentation before proposing changes.

Do not rely only on the most recently discussed information.

(The `context/` folder has its own rules: `context/ai-workflow-rules.md`.)

---

## Requirement Conflicts

Whenever a new requirement or proposal conflicts with existing documentation:

* Clearly identify the conflict.
* State what the existing documentation says.
* State what the new proposal says.
* Do not silently replace the existing requirement.
* Do not resolve the conflict without explicit confirmation.

When writing new requirements, always compare them against the client's `context-feeders/archive/client-view.md` and clearly identify any divergence.

---

## Decision Tracking

Treat `context-feeders/decisions/` as a **live decision-tracking system**.

**Every time a new requirement, proposal, constraint, or other project information is added or modified, check whether it creates, changes, confirms, reopens, or invalidates any project decision. Update the decision files accordingly.**

When a decision changes:

* Update its status appropriately.
* If an open/unmade decision becomes confirmed, remove it from `unmade-decisions.md` and record/update it in `project-decisions.md`.
* If a confirmed decision becomes open, deferred, or otherwise unconfirmed, update `project-decisions.md` and add it to `unmade-decisions.md` when appropriate.
* If a new requirement introduces a decision that did not previously exist, add that decision to the appropriate decision-tracking file.
* If a new or modified requirement makes an existing decision obsolete or changes its scope, update the affected decision and its status.
* Keep `project-decisions.md` and `unmade-decisions.md` consistent at all times.

**Do not treat updating the requirement document as sufficient when the change also affects a project decision. The corresponding decision-tracking files must also be updated.**

Do not silently change the status of a decision.

---

## Status Integrity

Always distinguish between:

* **Confirmed** — explicitly decided ([C]).
* **Working Proposal** — accepted for the MVP but may change ([P], [T], [A]).
* **Deferred** — intentionally postponed ([L]).
* **Open / Unmade** — no final decision has been made ([O]).

Never present a proposal, working proposal, or open decision as a confirmed requirement.

---

## General Rule

**Compare first. Update second. Assume nothing.**

The goal is to maintain consistency between:

```text
Client View (context-feeders/archive/client-view.md)
     ↓
Requirements (context-feeders/requirements/)
     ↓
Decisions (context-feeders/decisions/project-decisions.md)
     ↓
Unmade Decisions (context-feeders/decisions/unmade-decisions.md)
```

and to make every divergence or unresolved decision visible before documentation is changed.
