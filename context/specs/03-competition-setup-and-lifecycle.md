# Unit 03: Competition setup and lifecycle — APPROVED (2026-10-02)

> **Approved Unit 3 spec.** Approved 2026-10-02 by the project owner. This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (`../specs/00-build-plan.md`, "Units that cannot be specified").
> **Finalized 2026-10-02 before building (two gaps closed):** the four rounds' `durationSeconds` values are now stated below — the schema requires the field with no default, so Unit 3 must supply a value for each round at structure-creation time; and the publish wording now matches the schema's token defaults — `entryLinkToken`/`bigScreenLinkToken` are generated when the competition row is created (the schema's `@default(uuid())`), so publish surfaces and returns them rather than creating them (no schema change either way).
> Approved 2026-10-02 and now being built (builder: Sylvin).

## Goal

A controller creates a competition with one or more categories — the fixed Individual/Team, 2-rounds-each structure is generated automatically for every category — and publishes it once the readiness conditions pass. Publishing locks the structure, generates the entry link/QR and the big-screen link, and moves the competition into `WAITING`.

Goal in one testable sentence: **a controller creates a competition with at least one category, the system auto-creates its two stages and four rounds with default settings; publish is refused with a specific reason while any readiness condition fails, and succeeds once they all pass, at which point the structure is locked, both links exist, and the competition's status is `PUBLISHED` then `WAITING`.**

## Context

- **What already exists:** the full schema (`Competition`, `CompetitionCategory`, `Stage`, `Round`, `RoundSettings`, `ScoringConfiguration`, and every other entity in `../data-model.md`) was migrated in full in Unit 1. Unit 02 built login, sessions and the auth middleware every endpoint in this unit sits behind. **This unit adds no new tables or migration** — it builds the creation/publish logic on top of what already exists.
- **Where this lives:** `Competition`, `CompetitionCategory`, `Stage`, `Round` and `RoundSettings` belong to the **Competition** module (`../architecture.md`, "System boundaries") — this unit's backend code goes in `backend/src/modules/competition/`. `ScoringConfiguration` also belongs here (it's a 1:1 on `Competition`).
- **Only the controller** can create, configure and publish a competition [C] (ROL-002). This unit's endpoints sit behind Unit 02's auth middleware, scoped to the `CONTROLLER` role.
- **The structure is fixed, not admin-defined** [P] (CS-020, SCR-005): every category automatically gets exactly two stages (Individual, then Team) [C] (CS-010), and every stage gets exactly two rounds [C]. The controller cannot add, remove or reorder stages or rounds — only create categories (before publish) and set each round's numeric values. This unit auto-creates the fixed 2×2 structure for every category at competition-creation time; it does not let the controller design a custom structure.
- **Round defaults** (`RoundSettings`, resolved — see `../data-model.md`): preparation countdown 60s [C] (RND-001), early bonus rate 3 points/whole minute [C] (SCR-008), no bonus cap by default [C] (SCR-009), team rotation defaults (10 questions, 10 points each, 60s rotation period) [C] (TEM-004), the "total is not 100" warning threshold defaulting to 100 [C] (SCR-006). All are **whole numbers** except the school coefficient; times and counts must be above zero (SCR-012). **Editable only before that round's preparation begins** [C] (RND-002, RND-004) — this unit creates the defaults; enforcing the edit cutoff is Unit 07's job (round runtime), since "preparation begins" is a runtime event this unit doesn't build. For this unit, round settings are simply editable any time before the *competition* is published, and after publish per the existing SCR-005 rule (which this unit does not need to enforce at the per-round-preparation granularity yet).
- **Round duration (`RoundSettings.durationSeconds`), decided 2026-10-02** [T]: the schema requires this field on every `RoundSettings` row with **no default**, so Unit 3 must supply a value per round when it auto-creates the structure. The values come straight from the round durations the regulations already fix (`../competition-rules.md` §1, [S]): Individual round 1 **20 minutes (1200s)**, Individual round 2 **30 minutes (1800s)**; Team round 1 (rotation relay) **30 minutes (1800s)** — a working position consistent with `partitionTotalTimeSeconds` and anchored to the Individual variant round, matching Unit 13's spec; Team round 2 (partition collaboration) **30 minutes (1800s)**, matching `partitionTotalTimeSeconds`'s default (TEM-007). Every one is **controller-editable before that round's preparation begins**, exactly like every other round number (RND-002/RND-004/SCR-005) — these are the *starting* values, not fixed. Note the two Team-stage rounds carry the same 1800s starting value: that is a deliberate starting default, not a duplication bug, and the controller can change each independently.
- **`ScoringConfiguration` defaults:** `schoolCoefficient` = 0.6 (decimal, customizable) [C] (SCR-012/SCR-013), `rankingCycleSeconds` = 180 (the big-screen ranking cycle) [T]. Created once per competition, at creation time.
- **Publish, resolved** [C] (CA-004, cited in `context/` as CMP-100, re-confirmed 2026-10-01, Part 6 R10): publishing **locks the structure** (no more categories, stages or rounds can be added, removed or reordered) and **generates the entry link/QR and the big-screen link**. The general rule is no editing of structure after publish; numeric round values stay editable per the existing cutoff rule (RND-002/RND-004), and participants stay editable at any time (PAR-003) — **this unit only locks the structure**, not numeric values or participants, which belong to other modules anyway.
- **Publish is refused if anything is missing** [C] — the exact documents never enumerated the checklist beyond this general rule. Operationalized here, from what the surrounding flow already requires to exist before an event can run: at least one category; every category has at least one participant; every category has a complete question set assigned to both of its Individual-stage rounds; judge ranges cover every participant number. **The latter three checks query tables that exist in the schema (`Participant`, `QuestionSet`, `CompetitionJudgeAssignment`) but whose own import/management units (04, 05, 06) aren't built yet** — this unit implements the checks against the real tables and uses seeded test data for its own verification, the same pattern Unit 02 used for accounts.
- **Entry link vs. big-screen link:** the entry link (`Competition.entryLinkToken`) identifies the competition for the login flow's role picker [T] (ARCH-030) — Unit 02 already built the login page itself; this unit only generates the token. The big-screen link (`Competition.bigScreenLinkToken`) is a separate, no-login link [C] (BSC-001). Both are plain tokens generated on publish; QR rendering from the entry link is a frontend detail, not a schema concern.
- **Venue Wi-Fi advisory note** [C] (U-56): the competition-creation screen shows a UI-copy-only reminder to check the venue Wi-Fi — no validation, no blocking behavior.
- **The "total is not 100" warning** [C] (SCR-006, SCR-016): shown per category and per Individual round on the setup screen (updated as points are typed) and as a summary when starting a stage. This unit shows the setup-screen version (no questions exist yet to compute real totals against until Unit 05, so the warning is wired to show $0$ until then); the "summary when starting a stage" version is Unit 11's job (that's when a stage actually starts).

## Implementation Details

1. **Create competition.** Accepts name, description, and one or more categories (code + name, e.g. `U8`, `U12`). Creates the `Competition` row (`status = CREATED`), one `CompetitionCategory` row per category, and the 1:1 `ScoringConfiguration` with defaults. For each category, auto-creates the fixed structure: two `Stage` rows (`INDIVIDUAL` then `TEAM`, `sequence` 1 and 2), each with two `Round` rows (`sequence` 1 and 2), each `Round` with its `RoundSettings` row at the documented defaults — **including `durationSeconds`, which the schema requires with no default**: 1200 for Individual round 1, 1800 for Individual round 2, 1800 for Team round 1, 1800 for Team round 2 (see Context).
2. **Edit competition (pre-publish).** The controller can add/remove categories and edit round settings while `status = CREATED`. Editing after publish is out of scope for the structure (locked) — round-settings editing after publish, at the per-round-preparation granularity, is Unit 07's concern, not this unit's.
3. **Publish readiness check.** A service function that evaluates the four conditions above and returns either "ready" or a list of specific unmet conditions (not just a boolean) — the controller needs to know *what* is missing, consistent with "refuses if anything is missing" being a specific, actionable rejection, not a silent one.
4. **Publish action.** If the readiness check passes: **set `status = PUBLISHED` then immediately `WAITING`** (the steady state until a stage is started, which is a later unit's command) and **set `publishedAt`**. The two tokens — `entryLinkToken` and `bigScreenLinkToken` — are **already generated when the `Competition` row is created** (the schema gives both `@default(uuid())`, so a unique unguessable token exists from creation and never needs a separate write); publish **surfaces and returns** them (the entry link/QR and the big-screen link become usable once the competition is published, which is the point the spec's "generates the link" wording intends) and does not regenerate them. If the readiness check fails: reject with the specific unmet conditions, no state change.
5. **Structure lock enforcement.** Once `status` is past `CREATED` (i.e. `PUBLISHED` or later), category/stage/round creation, removal and reordering endpoints all reject. Round settings and participants are explicitly **not** locked by this rule (see Context).
6. **Frontend:** a competition-creation form (name, description, categories) under `frontend/src/features/competition/`, with the Wi-Fi advisory note (UI copy only) and the round-settings defaults shown and editable per round. A publish action that shows the specific unmet conditions if the backend refuses, or the generated entry link/QR and big-screen link on success.

### Inputs

- Competition: `name`, `description`, one or more `categories` (`code`, `name`).
- Round settings edits (optional, per round): any `RoundSettings` field, within the decided constraints (whole numbers, times/counts above zero).

### Expected Behavior

- A controller creates a competition with at least one category and immediately sees the auto-generated structure: two stages per category, two rounds per stage, each round's settings at their defaults.
- Attempting to publish before participants, questions or judge ranges exist is refused, naming which of the four conditions aren't met.
- Once all four conditions pass (using seeded test data for this unit's own verification), publish succeeds: the structure becomes locked, `entryLinkToken` and `bigScreenLinkToken` both exist, and the competition's status is `WAITING`.
- After publish, attempting to add, remove or reorder a category, stage or round is rejected. Editing a round's numeric settings still succeeds (this unit doesn't enforce the per-round-preparation cutoff — that's Unit 07's).

### Components Involved

- **Backend (`competition` module):** `competition.controller.ts` (create, edit, publish endpoints), `competition.service.ts` (structure auto-creation, the readiness check, publish logic — the public interface other modules call into), `competition.repository.ts` (Prisma access to `Competition`/`CompetitionCategory`/`Stage`/`Round`/`RoundSettings`/`ScoringConfiguration`), `competition.types.ts`.
- **Frontend (`competition` feature):** the creation form, the category/round-settings editor, the publish action and its readiness-failure / success display.
- **Seed data:** for this unit's own testing, seeded `Participant`, `QuestionSet` and `CompetitionJudgeAssignment` rows (not built through any real UI — those come in Units 04–06). Scratch/dev tooling, not a deliverable feature, same pattern as Unit 02's seeded accounts.

### API Contract (Working Position for this unit — not yet a cross-module contract)

- `POST /api/competitions` — body: `{ name, description, categories: [{ code, name }] }`. Response: the created competition with its auto-generated structure.
- `PATCH /api/competitions/:id` — edits name/description/categories (pre-publish only) or round settings (any time, within this unit's scope).
- `POST /api/competitions/:id/publish` — `200` with `entryLinkToken`/`bigScreenLinkToken` on success; `422` with the list of unmet readiness conditions on failure.

### Error Cases

- **Publish with an unmet condition:** rejected, naming every condition still unmet (not just the first one found) — the controller should not have to retry repeatedly to discover each gap one at a time.
- **Structure edit after publish** (add/remove/reorder a category, stage or round): rejected — the structure is locked.
- **Create with zero categories:** rejected — at least one category is required.
- **Round settings outside the decided constraints** (zero or negative time/count, non-whole number where a whole number is required): rejected.

### Security Considerations

- Every endpoint in this unit requires a valid `CONTROLLER` session (Unit 02's auth middleware) — no judge or player action can create, edit or publish a competition [C] (ROL-002).
- `entryLinkToken` and `bigScreenLinkToken` must be unguessable (the big-screen link in particular has no login behind it at all, so the token itself is the only gate) [C] (BSC-001).

### Constraints

- No schema change and no new migration — every entity this unit touches already exists from Unit 1.
- Does not build the actual participant import, question import, or judge-range-assignment features — this unit only *checks* that their data exists (using seed data for its own testing). Those are Units 04, 05 and 06.
- Does not build round-runtime behavior (preparation countdown, round timer, the per-round-preparation edit cutoff) — that's Unit 07.
- Does not build the "start a stage" command or any other controller live command (pause, resume, end early, finish, reset/rematch, cancel, big-screen-link regeneration) — that's Unit 11 (and the big-screen link's regeneration specifically belongs to the Big Screen module per `../architecture.md`, not this unit).
- Does not build the actual competition-copy feature (duplicating a finished competition) — despite `copy [C] (CMP-100)` appearing in this unit's one-line build-plan description, the build plan's own dependency graph assigns the copy *feature* to Unit 15 (which depends on 09/13/14 — the ranking and both team rounds — needed to copy a competition that has actually been run). This unit leaves `Competition.copiedFromCompetitionId` alone.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Design the readiness check as a list of named conditions, not a single boolean — later units (04, 05, 06) will each need to plug their own condition into the same check without this unit needing to be revisited.
- Keep the API contract simple and easy to change, consistent with `ARCH-023` (the project-wide API contract is explicitly a Working Position).
- The seed data used for this unit's own testing is scratch/dev tooling, not a deliverable feature — do not wire it into any user-facing flow.

### Related Features

- **Depends on:** Unit 02 (authentication — every endpoint here needs a controller session).
- **Depended on by:** Units 04, 05, 06 (participant import, question import, judges — each needs a `Competition`/`CompetitionCategory` to attach to, and each will extend this unit's readiness check), and every later unit that needs a published competition to run against (07 onward).

## Acceptance Criteria

1. A controller creates a competition with at least one category; the two stages and four rounds (two per stage) are auto-created with their documented default settings.
2. Creating a competition with zero categories is rejected.
3. Publishing before participants, a complete question set, or full judge-range coverage exist is refused, and the response names every unmet condition.
4. Once all four readiness conditions pass (via seeded test data), publish succeeds: `entryLinkToken` and `bigScreenLinkToken` both exist (generated at creation) and are returned by the publish response, and the competition's status becomes `WAITING`.
5. After publish, adding, removing or reordering a category, stage or round is rejected; editing a round's numeric settings still succeeds.
6. A non-controller session (or no session) cannot create, edit or publish a competition.
7. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Participant import, question import, judge-range assignment (Units 04, 05, 06) — this unit only checks their data exists, using seed data for its own tests.
- Round-runtime behavior: the preparation countdown, the round timer, and the per-round-preparation numeric-edit cutoff (Unit 07).
- Starting a stage, pausing/resuming, ending a round early, finishing, reset/rematch, cancel, and big-screen-link regeneration (Unit 11; link regeneration specifically belongs to the Big Screen module).
- The actual competition-copy feature (Unit 15) — this unit leaves `copiedFromCompetitionId` untouched.
- The "total is not 100" warning's stage-start summary (shown when a stage actually starts) — Unit 11.
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
