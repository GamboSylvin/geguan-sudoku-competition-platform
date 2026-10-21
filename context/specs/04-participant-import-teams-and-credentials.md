# Unit 04 — Participant import, teams and credentials

> **Status: APPROVED (2026-10-11).** Approved by the project owner in conversation, on
> the strength of three answers recorded in §8 — Q3 (store both event flags per the file's
> own rule), Q7 (usernames easy for people to write) and Q9 (build now), plus Q10 (leave
> teams alone for now, individual first). Q1/Q2/Q4/Q8 build to their provisional defaults;
> Q5/Q6/Q10's team-formation half is deferred to a later unit and, for the random-team
> proposal, carried to the stakeholder because it contradicts SCR-004 [C]. ~~**Caveat
> recorded, not hidden:** Docker Desktop is started but its engine returns `500` on every
> API call including `/_ping` (§7), so this unit is being **written without the ability to
> compile, typecheck, migrate or test** — the same state Unit 14 is in. Verification steps
> are listed in §7 and must be run the moment the engine serves.~~ **Caveat UPDATE
> 2026-10-11 (later the same day): the Docker engine became reachable.** `prisma migrate
> status` confirms migration `20261011000000_add_participant_event_flags` is **applied and
> live**, and `prisma generate` (Prisma Client v5.22.0) has been run — that generate +
> `docker compose restart backend` was in fact the **fix** for the live participant-import
> `500` (`Unknown field 'individualEvent' … on model 'Participant'`), whose real cause was a
> **stale generated client** in the `backend-node-modules` volume, not a missing migration.
> §7's steps 1–2 are therefore DONE; what genuinely remains is §7 step 3 — the four suite
> runs (lint/typecheck/test/build), including `tests/participant.test.tsx`, which has still
> never been executed — plus a populated-file import (U-01 has no data rows).
>
> Builder: **Louise**. Depends on: **Unit 03** (competition setup and lifecycle — the
> competition and its `CompetitionCategory` rows must exist before participants can be
> attached to them). Uses: **Unit 02** (identity — `generateUsername`, `generatePassword`,
> `hashPassword`), **Unit 05** (question — the zero-dependency `.xlsx` reader and
> multipart parser, reused not rewritten).

---

## 1. Goal

Give the controller the only missing path from a real student spreadsheet to a
publishable competition: upload the participant `.xlsx`, have it validated as a whole,
and on success create the schools, the teams, the participants, their player accounts
and their printable credentials. Until this unit exists, `competition.service.ts`'s
publish-readiness check demands participants that **no supported flow can create**
(`competition.readiness.participantsRequired`, `competition.service.ts:308`) — every
existing test hand-seeds them, which is exactly how the 2026-10-08
`RoundParticipation` bug stayed hidden.

## 2. Context — the real file

`context/samples/选手信息.xlsx` is present in the repository (9,671 bytes, modified
2026-10-08 22:28) and was read on 2026-10-11. One worksheet, `Sheet1`, **12 columns,
one header row, no data rows**. Exactly as written:

| Col | Header | Meaning | Used by this unit |
|---|---|---|---|
| A | `比赛名称` | competition name | see Open question Q1 |
| B | `选手编号` | participant number, pre-filled | **ignored** — the system always generates its own (**[T] PAR-012**, resolves U-98) |
| C | `姓名` | name | **required** |
| D | `年龄` | age | ignored (**[O] U-40** working position) |
| E | `省` | province | ignored |
| F | `市` | city | ignored |
| G | `区（县）` | district/county | ignored |
| H | `学校名称` | school name | **required** — drives `School` and the school total (Unit 15) |
| I | `组别` | category/group | **required** — must match an existing `CompetitionCategory` |
| J | `个人赛` | individual-event flag | see Q3 |
| K | `团队赛` | team-event flag | **drives team derivation** (**[T] PAR-011**, resolves U-97) |
| L | `备注` | remark | ignored |

Row 2 of column L carries the file's own instruction, which is the authority for J and
K: **`个人赛团队赛参加填写1，未参加空白或者是2`** — "for the individual and team events,
write 1 if taking part; if not taking part leave it blank or write 2". So both flags
read: **`1` = participating; blank or `2` = not participating.** Any other value is a
validation error (see §4.3, V6).

**This settles the PAR-011 vs. PT-003 contradiction.** `REQUIREMENTS.md` §7.2 item 2
still says "The Team value decides which players are on the same team … team
information comes from the file" **[S]** (PT-003), which reads as an explicit Team
column. The real file has **no Team column** — it has the `团队赛` boolean plus
`学校名称` and `组别`. PAR-011's reading is the one the file supports: **a team is
School + Category + `团队赛`=1**, and `Team.@@unique([competitionId, categoryId,
schoolId])` in `schema.prisma` already encodes exactly that (one team per school per
category, SCR-004). PT-003's wording is to be corrected in `REQUIREMENTS.md` as part of
this unit's documentation pass, not silently overridden.

**U-01 is only partly discharged by this file.** The docs record U-1 as needing "a
real participant file **with data rows**, plus a **past results sheet**", and
`context/samples/README.md` records both as still missing. The file supplies the
**column structure** (which was already known and recorded on 2026-10-07) and still has
**zero data rows**; no past results sheet exists in the repository. So: the *structure*
half of U-01 is met — enough to specify and build this unit — the *data-rows* and
*past-results-sheet* halves are not. Nothing here claims otherwise.

## 3. Schema — mostly already present, plus one new migration

Every table this unit writes already exists in `backend/prisma/schema.prisma`, created by
`0_init`, and every participant-related enum value is **reserved but never written by any
code today**:

- `School` (`@@unique([competitionId, name])`, `sequence`)
- `Team` (`@@unique([competitionId, categoryId, schoolId])`, `name`, `sequence`)
- `Participant` (`@@unique([competitionId, participantNumber])`, `name`,
  `participantNumber`, `sequence`, `active`, nullable `teamId`)
- `Account` (`role: PLAYER`, `participantId` unique, `username` unique, `passwordHash`)
- `StoredFile` (`kind: PARTICIPANT_EXCEL` for the uploaded original — kept for audit,
  BLD-039's reasoning; `kind: CREDENTIAL_SLIPS` for the export)
- `ImportBatch` (`kind: PARTICIPANT_EXCEL`, `status: VALIDATED | REJECTED | COMMITTED`,
  `errors Json?`)

Path template for stored files, per the `StoredFile` comment:
`{STORAGE_ROOT}/competitions/{competitionId}/{kind}/{fileId}-{originalName}`.

**The gap, and its resolution.** `Participant` had **no column for the `个人赛` / `团队赛`
flags** — team membership is derivable from `teamId != null`, but "registered for the
individual event" was stored nowhere. **Resolved by the project owner 2026-10-11** (Q3):
follow the file's rule and store both flags. This unit adds
`20261011000000_add_participant_event_flags` — `individualEvent Boolean @default(true)`
and `teamEvent Boolean @default(false)` on `Participant` — and the two one-line read
filters listed in Q3, without which storing the flag would leave a category ranking that
can never become final.

## 4. Implementation details

### 4.1 Endpoint surface

```
POST   /api/competitions/:id/participants/import     multipart, one .xlsx part
GET    /api/competitions/:id/participants            list, grouped/filterable
PATCH  /api/competitions/:id/participants/:pid       individual edit (PAR-003)
POST   /api/competitions/:id/participants            individual add (PAR-003)
DELETE /api/competitions/:id/participants/:pid       deactivate (active=false, never a hard delete)
GET    /api/competitions/:id/participants/credentials  credential-slip export
```

Controller-only (`AccountRole.CONTROLLER`), matching the existing
`competitionRouter`/`questionRouter` guard style. A new module folder
`backend/src/modules/participant/` with the usual split
(`participant.controller.ts`, `participant.service.ts`, `participant.repository.ts`,
`participant-parse.ts`, `participant.types.ts`, `index.ts`), mounted in `src/routes.ts`.

### 4.2 Reading the file — reuse, do not rewrite

**The project owner's integration requirement, 2026-10-11: "this should be done as an
independent module that will be integrated with whatever is already there. The frontend
part should also be built and integrated with the frontend that is already built right
now."** That is what this spec does, and it is worth stating exactly how far "independent"
goes, because this unit is not read-only — §8 Q3's two filters *do* touch two existing
files, and those edits are the whole of it:

- **New, nothing existing touched:** `backend/src/modules/participant/` (six files, listed
  in §4.1), and the frontend participant screens plus their i18n keys.
- **Existing files edited, all additive:** `backend/src/routes.ts` (mount the new router —
  the same one-line pattern every other router uses), `backend/prisma/schema.prisma` plus
  one new migration folder (Q3's two columns), and the two `where` clauses Q3 names
  (`round.repository.ts`'s `listActiveParticipants`, `ranking.repository.ts`'s
  `listActiveCategoryParticipants`). No existing behaviour is rewritten; each filter
  narrows a query that today over-selects.
- **No existing module is refactored.** In particular the `.xlsx` reader is **imported from
  `question/`, not moved**: §4.2's earlier proposal to lift `question-xlsx.ts` and
  `question-multipart.ts` into `backend/src/shared/xlsx/` is **withdrawn**, because moving
  a file that Unit 05's 170-test suite imports would touch verified code for no functional
  gain a day before the event. The participant module imports the two functions directly.
  If `code-standards.md`'s boundary rules forbid a cross-module import, the fallback is a
  **copy** into `modules/participant/participant-xlsx.ts` with a comment pointing at the
  original — still zero new dependencies, still nothing existing disturbed.

`question/question-xlsx.ts` already reads an `.xlsx` (OPC zip → `sharedStrings.xml` +
`sheet1.xml`) with **zero dependencies**, and `question/question-multipart.ts` already
splits a buffered multipart body — so this unit adds **no new npm package**, matching the
tree's zero-dependency house style (`backend/package.json` has no xlsx, no multer, no
exceljs). The header row is matched **by header text, not by column position**, so a
reordered or padded file still imports; an unrecognised header set is V1 below.

### 4.3 Validation — atomic, whole-file, row-named

Validation runs over every row **before anything is written**. Any error rejects the
whole file: an `ImportBatch` row is written with `status: REJECTED` and
`errors: [{ row, column, code, message }]`, **no** `School`/`Team`/`Participant`/
`Account` row is created, and the previously imported dataset (if any) is left
untouched. Errors name the row. The checks:

1. **V1 header** — the required headers (`姓名`, `学校名称`, `组别`) are present.
2. **V2 empty file** — zero data rows is an error, not a silent success.
3. **V3 required cells** — `姓名` and `学校名称` non-empty; whitespace-only is empty.
4. **V4 category** — `组别` matches an existing `CompetitionCategory` of this
   competition, by `name` **or** by `code`, trimmed. No match → error naming the row
   and listing the categories that do exist. (The real scheme is the three grade-pair
   groups — 一二年级组 / 三四年级组 / 五六年级组, BLD-041; the values in `组别` are
   expected to be those names.)
5. **V5 duplicate person** — two rows with the same `姓名` + `学校名称` + `组别`
   (PAR-01's identity key) → error naming **both** rows.
6. **V6 flag values** — `个人赛` / `团队赛` ∈ {`1`, `2`, blank}; anything else → error.
7. **V7 team size — NOT ENFORCED in this unit.** Teams are deferred (Q10), so no
   team-size rule applies. The `团队赛` flag is still value-checked (V6) and stored, and
   the response reports how many rows flagged it per school+category, so the information
   needed to decide team bounds later is not lost.
8. **V8 competition name** — if `比赛名称` is non-blank it must equal this
   competition's name; see Q1 for whether a mismatch rejects or warns.
9. **V9 after publish** — a whole-file import against a competition that is not
   `CREATED` is refused outright (**[C] PAR-009**): 409
   `participant.importNotAllowedAfterPublish`. Only individual edits remain.

### 4.4 Commit — one transaction

Inside a single Prisma `$transaction`, in this order:

1. **Schools**, in first-appearance order in the file, `sequence` = that order index;
   upsert on `@@unique([competitionId, name])` so a re-import keeps the same rows.
2. **Teams — DEFERRED, not built by this unit.** See Q10 below for the full reasoning.
   This unit writes **no `Team` row and leaves every `Participant.teamId` null.** The
   `团队赛` flag is still parsed and still stored (Q3), so the information survives and a
   later team-formation step can read it — but nothing is derived from it here. Consequence
   checked against the code: `Team.@@unique([competitionId, categoryId, schoolId])` is
   only ever written by this step, and the three readers (`team-rotation.repository.ts:149`,
   `orchestrator.repository.ts:162`, `school-ranking.repository.ts:66`) all read the Team
   stage's own data, which no Individual round touches. Publishing does **not** require
   teams — `competition.types.ts:64-67` lists four readiness conditions
   (category, participants, questions, judge ranges) and **none of them is teams**, so
   deferring this does not block the event's Individual rounds.
3. **Participants** — numbering per **[P] PAR-001**: *schools in Excel order, students
   in row order, unique across the whole event, a team's numbers consecutive.* With teams
   deferred (step 2), the "a team's numbers consecutive" clause has nothing to group by,
   so the first three clauses decide on their own: **walk the rows in file order and
   assign consecutive integers from a single competition-wide counter starting at 1**,
   `sequence` = the same index. That is the simplest reading and the one that needs no
   renumbering later. Q6 stays open — when team formation is built, a team's numbers may
   need to become consecutive, and §4.5's "kept participants are not renumbered" rule
   means that would have to be settled before any slip is printed, not after.
4. **Accounts** — one `PLAYER` account per participant. Username: see Q7 (the existing
   `generateUsername(name)` slugs a Chinese name to `""` and falls back to
   `user-<hex>`, which is a poor thing to print on a slip for 200 children). Password:
   `generatePassword()` (8 chars, unambiguous alphabet — already slip-safe). Hash with
   `hashPassword`. **The plaintext password exists only in this transaction's return
   value and in the exported slips file; it is never stored and never returned again by
   any later endpoint.**
5. **StoredFile** (`PARTICIPANT_EXCEL`) for the uploaded original, and **ImportBatch**
   with `status: COMMITTED`.

### 4.5 Re-import before publish

A second import against a still-`CREATED` competition replaces the dataset:

- A row matching an existing participant on **`姓名` + `学校名称` + `组别`** (PAR-010)
  **keeps its account and its credentials** — "participants whose data is unchanged
  keep their accounts" **[T]**.
- A row that matches on that key but whose *other* used fields changed is treated as an
  **identity change** (**[C] PAR-003**): old participation removed (`active = false`,
  the row is never hard-deleted), a new participant created, **new credentials issued**.
- A previously imported participant absent from the new file is set `active = false`
  (**[T]** "removed from the active set") and its account deactivated — not deleted, so
  any result rows already written keep their foreign key.
- Participant numbers are **not** re-shuffled for kept participants; newly added ones
  take the next free numbers. (Renumbering would invalidate already-printed slips.)

### 4.6 Individual edits (before, during and after the competition)

**[C] PAR-003**: participants can be added, edited or replaced individually at any
time. `PATCH` accepts `name`, `categoryId`, `schoolId`, `teamId`, `active`, and
(optionally, per PAR-01's "the admin may adjust it manually") `participantNumber` —
a number change must not collide with `@@unique([competitionId, participantNumber])`.
Editing `teamId` is how a team changes: **no separate team-management screen** exists or
is built (**[C] PAR-007**, resolves U-41). Replacing a student issues new credentials,
which the response returns **once**.

### 4.7 Credential-slip export

`GET …/credentials` produces one file for printing (**[T]/[C] PAR-002**: "exports the
credential list, which is printed"). Format is Q8. Content per slip: participant
number, name, school, category, username, password, and the entry link/QR the publish
step generates. Written to `StoredFile` with `kind: CREDENTIAL_SLIPS` and streamed
back. **This is the only place a plaintext password is ever retrievable**, and it is
controller-only.

### 4.8 Publish readiness

No change to `competition.service.ts`'s check itself — it already requires participants
and teams. This unit is what makes it satisfiable. Verify: with a valid import done,
`readiness.participantsRequired` passes; with zero participants it still fails.

### 4.9 Frontend

`frontend/src/features/competition/CompetitionSetupPage.tsx` already carries the
comment "this screen's publish flow — including a participant import, which Unit 04
owes it" (line 32). Add, in the existing admin feature area: an upload control with the
validation-error table (row + column + message, both languages), the participant list
with per-row edit/deactivate, and a "download credential slips" button. i18n keys added
to **both** `en` and `zh` catalogues — they are shape-checked against each other
(`type MessageCatalogue = DeepString<typeof en>`), so a missing key is a compile error.
Styling stays as-is: **no visual design pass** (UI-008).

## 5. Acceptance criteria

1. A valid file creates participants, their player accounts, and the schools they belong
   to. (Build plan's wording, minus teams — see Q10.)
2. An invalid file commits **nothing** and the error names the row — asserted for each
   of V1–V9, and asserted by counting `School`/`Participant`/`Account` rows before and
   after, not just by the HTTP status.
3. The `个人赛` and `团队赛` flags are parsed per the L2 rule and stored: `1` → `true`,
   blank or `2` → `false`. **No `Team` row is created by this unit and every
   `Participant.teamId` is null** (Q10).
3a. A participant with `individualEvent = false` is **not** dealt into an Individual
   round (no `RoundParticipation` row) and is **not** counted in that category's ranking
   `isFinal` — so a category containing such a participant can still become final. This
   is the regression the two one-line filters in §8 Q3 exist for.
4. The pre-filled `选手编号` column is ignored: a file whose numbers are 9001, 9002,
   9003 still yields generated numbers following PAR-001.
5. `年龄`/`省`/`市`/`区（县）`/`备注` are ignored without error, and an entirely
   unexpected extra column is too (U-40 working position).
6. Credential slips export; the file contains one username+password per participant;
   the plaintext password is **not** in the database and **not** returned by
   `GET /participants`.
7. After publish, a whole-file import is refused (409) and an individual edit succeeds.
8. A re-import before publish keeps the account of an unchanged participant, issues new
   credentials for a changed one, and deactivates an absent one.
9. A file with the three real categories (一二年级组 / 三四年级组 / 五六年级组) imports
   against a competition whose `CompetitionCategory` rows carry those names.
10. With participants imported, the competition publishes; with none, publishing is
    still refused with `competition.readiness.participantsRequired`.
11. Backend suite stays green (170/170 before this unit) and the frontend suite stays
    green (49/49), plus this unit's new cases. **Blocked on Docker Desktop — see §7.**

## 6. Out of scope

- Participant self-registration; a public signup form. (Registration is an admin act.)
- Puzzle authoring or editing (CMP-102).
- Any use of the `年龄`/`省`/`市`/`区（县）`/`备注` columns beyond ignoring them.
- Reading the pre-filled `选手编号` (PAR-012).
- A team-management screen (PAR-007).
- OCR, in this unit or any other (BLD-047).
- The past-results-sheet half of U-01 — it does not exist in the repository and nothing
  here depends on it.
- Visual/UX polish (UI-008).

## 7. Environment status before any code runs

> **RESULT — all four steps below ran on 2026-10-12 and this unit is verified at the
> automated level.** The engine became reachable, `prisma migrate deploy` applied
> **both** `20261009000000_add_team_partition_state` (Unit 14) and this unit's
> `20261011000000_add_participant_event_flags`, `prisma generate` was re-run (client
> v5.22.0) with a backend restart, and `prisma migrate status` now reports
> **"Database schema is up to date!"**. The merged `backend/src/app.ts` **typechecks** —
> the concern raised below is discharged. Backend lint/typecheck/build clean and the
> full suite green at **217/217 across 16 suites** (baseline was 170/170, so no
> regression); frontend lint/typecheck/build clean and **55/55 across 10 suites**,
> including this unit's `tests/participant.test.tsx` (6 cases, **first executed
> 2026-10-12**, passing). **Two things no automated gate covers, and they remain open:**
> this unit has **no backend test at all** (the 17 files in `backend/tests/` include none
> for `participant`, so `participant.service.ts` and the whole hand-rolled `.xlsx` parse
> path are exercised by nothing), and **the importer has never parsed a populated file** —
> the real roster arrived 2026-10-12 and has not been run through it. Also learned during
> the run: an earlier 500 on participant import was **not** a missing migration but a
> stale generated Prisma client inside the `backend-node-modules` named volume, cured by
> `prisma generate` + `restart backend`. What follows is the pre-verification state, kept
> as the record of what was expected and how it was to be checked.

**Updated 2026-10-11, after the project owner reported Docker Desktop running.** It is
**started but not serving.** `Docker Desktop.exe` and `com.docker.backend.exe` are in the
process list, and `docker version` prints the client's `29.8.1` — but **every server-side
API call fails**: `docker ps`, `docker info` and even a raw `GET /_ping` on both
`//./pipe/dockerDesktopLinuxEngine` and `//./pipe/docker_engine` return
`500 Internal Server Error` (or nothing at all), across API versions 1.44 to 1.56 and both
contexts. A 500 on `/_ping` means the Linux engine has not finished starting or has failed
to — this is not a client-version mismatch. **So nothing can be compiled, typechecked,
linted, tested, or migrated yet**, and the same wall Unit 14 hit still stands: it is
**built but never verified**.

This unit now has a migration (§3, Q3), which needs `prisma migrate deploy` against a real
database, so Docker being down is a harder blocker for Unit 04 than it was for Unit 14.

Also still outstanding: the merged `backend/src/app.ts` (union of both branches'
`installListeners` hooks, committed `da9cf4d`) has **never been compiled**. This unit adds
a router to `src/routes.ts`, so `app.ts`'s typecheck is on the critical path and must be
confirmed as part of this unit's verification, not assumed.

**Verification steps, in order, once the engine serves** (the first is Unit 14's backlog,
which must clear before this unit can be trusted):

1. `docker compose up -d`, then `prisma migrate deploy` and `prisma generate` — this both
   confirms Unit 14's unapplied `20261009000000_add_team_partition_state` **and** applies
   this unit's new migration.
2. Backend `npm run lint && npx tsc --noEmit` — the first-ever typecheck of merged
   `app.ts`. Fix whatever it finds **before** writing participant code, so any later error
   is unambiguously this unit's.
3. Backend `npm test` (has `--runInBand`) — must reproduce the verified **170/170 across 14
   suites** before a single new test is added; that is the baseline this unit is measured
   against.
4. Build Unit 04, then re-run lint/typecheck/test plus the frontend suite (**49/49 across
   9 suites**) and both builds.

## 8. Open questions (Q1–Q10) — Q3, Q7, Q9 answered; Q5/Q6/Q10 deferred with teams

> **Asked 2026-10-11 via AskUserQuestion (the four that shape the build): the popup timed
> out after 60s with no answer**, so at that point nothing was assumed and no code was
> written. **The project owner then answered in plain conversation the same day**, which
> is a valid channel — the popup requirement governs *destructive and delete* operations,
> not requirements decisions. Answered: **Q3** (follow the file's `1`/blank/`2` rule and
> store both flags — this unit **does** add a migration), **Q7** (usernames must be easy
> for people to write — `p<number>`), **Q9** (build now, Docker on), and **Q10** (leave
> teams alone, individual first; random-team formation goes to the stakeholder because it
> contradicts SCR-004 [C]). **Q5 and Q6** are moot until team formation is built. **Q1,
> Q2, Q4, Q8** are low-stakes and carry the provisional default below; each is reversible.

**Q1. `比赛名称` (column A).** Reject a mismatch, warn, or ignore the column entirely?
The file has it per row, and the system already knows which competition the upload went
to. Rejecting catches "uploaded the wrong school's file"; ignoring is simpler.
*Provisional default: **warn, do not reject** — surface it in the import response, keep
it out of the error list. A name mismatch on event day is more likely a renamed
competition than a wrong file, and a hard reject there costs more than it catches.*

**Q2. Header language.** Are the real files always Chinese-headed exactly as in the
sample, or should the parser also accept English aliases?

**Q3. `个人赛` (column J) has nowhere to live.** `Participant` has no individual-event
flag. Options: (a) add a `Boolean participatesInIndividual` column (needs a migration);
(b) derive it — every participant competes individually, `团队赛` only adds team
membership; (c) store it in a JSON column. This decides whether Unit 04 touches the
schema, and it affects Unit 09's ranking (should a `个人赛`≠1 participant be excluded
from the individual ranking?) and Unit 15's school total (which sums *individual*
results × 0.6 — over which participants?).
**Resolved by the project owner 2026-10-11: follow the file's rule and store it.** The
project owner read §8 Q3 and answered: *"if the individual competition is filled with 1,
then it means the corresponding participant is participating in the individual
competition. If it's not filled then it's not participating. Same for the team
competition … I think we can follow that rule."* That is option **(a)**, so this unit
**does** add a migration — two nullable-with-default booleans on `Participant`
(`individualEvent`, `teamEvent`). `individualEvent` defaults to `true` and `teamEvent` to
`false`, so every pre-existing row keeps the behaviour the tree was verified with.

**Storing the flag is not enough — two already-built queries must filter on it, or the
individual round breaks.** This is the part that makes Q3 a real decision rather than a
cosmetic column, and it is a consequence the earlier draft did not spell out:

- `ranking.service.ts`'s `isFinal` (Unit 09, verified) is
  `participants.every(p => finalizedRoundsPerParticipant.get(p.id)?.size >= roundCount)`
  over `listActiveCategoryParticipants`. A participant flagged `个人赛`≠1 **never sits an
  Individual round, so never has a finalized result**, so that category's ranking can
  **never** become final. This is not a hypothetical: it is the same shape as the
  2026-10-08 `RoundParticipation` bug — a condition that silently never completes.
- `round.repository.ts`'s `listActiveParticipants` (the 2026-10-08 fix) opens a
  `RoundParticipation` for **every** active participant of the competition. Without a
  filter, a `个人赛`≠1 student is dealt into the Individual round anyway, and Unit 08's
  round-ended auto-submit sweep finalizes an empty `Attempt` for them — which then writes
  an `IndividualRoundResult` of zero and **puts them in the ranking at the bottom**.

So the flag must be honoured at both points: `listActiveParticipants` gains a
`individualEvent: true` filter **for Individual-stage rounds only** (a Team-stage round
must not be filtered by it), and `listActiveCategoryParticipants` gains the same filter.
Both are one-line `where` additions with a comment naming this spec. **`school-ranking`
needs no change**: its individual half already sums *every* player of the school in the
category (SCR-018, `school-ranking.service.ts:13`), and a `个人赛`≠1 player simply
contributes no result rows — which is the correct reading, not a bug.

**One migration, hand-written the way Unit 14's was** (`prisma migrate dev` needs a
reachable database): `20261011000000_add_participant_event_flags`.

**Q4. Team size bounds.** `client-view.md` says n = 2–6, default 4; the competition
rules say 4 per team. What does the validator enforce when a school+category flags 1,
or 5, or 9 players for `团队赛` — reject the file, or accept and let the rotation's
`min(n, m)` / `r < n` self-adaptation (Unit 13, already built) cope?
*Provisional default: **accept anything ≥1, no size check.** Unit 13's rotation already
handles every count through `min(n, m)` and the `r < n` empty-seat rule, and Unit 14's
partition bands are computed per team from whoever is on it. A hard "exactly 4" reject
on the morning of the event turns a school that sent 5 names into a blocked import; a
warning in the response costs nothing. Flagged here because `client-view.md`'s 2–6 is a
client statement, not a rule this system enforces.*

**Q5. Team `name` — moot while teams are deferred (Q10).** `Team.name` is required, and
`"{school} {category}"` was the proposal. Nothing in this unit writes a `Team` row, so it
is decided by whichever unit builds team formation. Carried as open.

**Q6. Numbering when the file interleaves teams — moot for this unit, still open for the
team step.** PAR-001 wants both "students in row order" and "a team's numbers
consecutive". With teams deferred (Q10) only the first clause applies, so this unit
numbers strictly in file order (§4.4 step 3) and the question does not arise. **It comes
back** the moment team formation is built: a team's numbers cannot be made consecutive
afterwards without renumbering, and §4.5 forbids renumbering kept participants because it
would invalidate printed slips. So it must be settled **before** the first slip is
printed, not after. Carried as open.

**Q7. Username format — the project owner's requirement, 2026-10-11: "we need logs, things
that are easy to write for people."** So the username must be short, typeable by a child,
and free of ambiguous characters. `generateUsername("张三")` slugs to `""` and falls back
to `user-4f9a2c`, which is none of those. The existing `generatePassword` alphabet
(`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, already excluding 0/O/1/I) is the model to follow.
*Default, to be ratified: **`p<number>`** (e.g. `p1`, `p2`, … `p207`) — the shortest thing
that is still unique within a competition, matches the printed participant number so the
slip and the login visibly agree, and needs no slug a child has to read off a page.*
**The one risk, and why it must be handled rather than hoped away:** `Account.username` is
`@unique` with **no competition scope** (`schema.prisma`, "Account"), so a bare `p1`
collides the second a second competition is created — and a collision inside the commit
transaction is an **atomic whole-file reject**, i.e. the entire import fails on event day.
Two ways out, and this spec takes the first because it needs no schema change:
**(i)** generate `p<number>` and, on a unique-violation, retry with a per-competition
suffix derived from `competition.id`'s first 4 hex chars (`p1-a3f9`) — deterministic, so
a re-import produces the same usernames and §4.5's "unchanged participants keep their
credentials" still holds; **(ii)** add a scoped uniqueness instead, which is a schema
change to a table Unit 02 owns and verifies. Q8's slip export is what makes either
scheme usable, since the child reads it off paper rather than remembering it.

**Q8. Slip export format.** `.xlsx` (consistent with every other export, and
`results-xlsx.ts` already writes one with zero dependencies), printable HTML, or PDF?
PAR-002 says only "exported … which is printed".
*Provisional default: **`.xlsx`**, reusing `results/results-xlsx.ts`'s zero-dependency
writer — it is the only format in the tree that already works, and it prints.*

**Q9 — original block, ~~unanswered~~ SUPERSEDED 2026-10-11 by the answered version
below.** Kept rather than removed, per this project's standing rule that superseded text
is annotated, not deleted. *It read:* "Do we build it now? Given §7 (Docker down) and the
~1-day runway, is Unit 04 built now, or is the event run with hand-seeded participants (a
script, like the tests use) and Unit 04 built afterwards? This is a project-owner call, not
an engineering one. ***No provisional default — this one cannot be assumed.*** It was the
question that timed out, and the three options put to the project owner were: (a) build now
and verify later, landing unverified like Unit 14; (b) the project owner starts Docker
Desktop by hand first, and the build proceeds with real verification at each step; (c) skip
the unit for the event and write a one-off seed script that reads this Excel and inserts
participants directly, building the real unit afterwards. ~~Work on Unit 04 is paused here
until this is answered — the spec stays `DRAFT` and no code is written.~~" **The pause is
lifted** — see the answered Q9 below.

*(Q2 is likewise low-stakes and can be settled during the build: match by header text,
Chinese exactly as in the sample, no English aliases until a file needs them.)*

**Q9. Do we build it now? — ANSWERED by the project owner 2026-10-11: build now.** *"As
for the Docker Desktop app, it is turned on right now and it's working. The Docker engine
is working. If you need to, you can bring up whatever you need and then start working."*
That is option **(b)** — build with real verification at each step — and it un-pauses this
unit. **The caveat, recorded honestly rather than smoothed over:** §7 shows the engine is
**started but not serving** (`500` on `/_ping`), so step (b)'s precondition is not yet
met in practice. The build proceeds on the assumption the engine comes up; if it is still
500-ing when the first verification step is due, this unit lands in Unit 14's state —
written, unverified — and that is stated in the tracker rather than left implicit. The
seed-script fallback (option (c)) is **not** taken: with the import path buildable, a
one-off script would add a second way to create participants that no test covers, and it is
the same class of shortcut that let the 2026-10-08 `RoundParticipation` bug ship.

**Q10. Team formation — deferred out of this unit, and the proposal conflicts with a
stakeholder-confirmed rule. Recorded, not resolved.**

*What the project owner said 2026-10-11:* "For the formation of teams I would want to say,
for now, let's make it random. We form teams of 4 mostly, and then 2 to 2, but also 2 to 6
members when necessary. **Discuss that with the stakeholders first.** Teams: first of all
leave them like that and still mostly with individual stuff right now."

*What this unit does, following the last sentence:* **nothing about teams.** No `Team` row
is created, `teamId` stays null, and both flags are stored so a later step has the data.
Publishing is unaffected — the four readiness conditions (`competition.types.ts:64-67`)
are category, participants, questions and judge ranges; **teams are not one of them**, so
the Individual rounds can run with zero `Team` rows.

*Why the first half cannot be built as stated, and must go to the stakeholder:* random
team formation contradicts two **[C]** stakeholder-confirmed decisions.

- **SCR-004** [C]: *"Each school has exactly one team per category."* The database enforces
  this — `Team.@@unique([competitionId, categoryId, schoolId])`, with `schoolId` a
  **non-nullable** column. A randomly formed team drawn from several schools has no single
  `schoolId` to put in that column, so it cannot be stored in the existing schema at all.
- **SCR-004** [C] again, the scoring half: *"School total = (sum of the two-round
  individual scores of the school's players in that category) × coefficient + (the
  school's two-round team-stage scores)."* The team half is attributed **to a school**.
  `school-ranking.repository.ts:66` reads exactly that mapping
  (`listTeamsInCategory` → `{ id, schoolId }`). If teams are random and cross-school,
  a team's score has no school to be added to, and **the school total — the event's
  headline ranking — becomes undefined.** Unit 15 is built and verified on the
  one-team-per-school reading.

So random teams are not a small change to this unit; they change SCR-004, the `Team`
table's shape, and Unit 15's arithmetic. Per `CLAUDE.md`'s conflict rule that is
identified and carried to the stakeholder, not decided here, and not silently built.
**Logged in `context-feeders/decisions/unmade-decisions.md`** as a new open item, with
both confirmed decisions quoted, and the two candidate readings spelled out: (a) keep
SCR-004 — teams stay one-per-school-per-category, and "random" then means only *which*
4 of a school's flagged students sit in it (that **is** buildable in the existing schema,
and is what PAR-011 already implies); or (b) genuinely mixed-school random teams — which
requires a schema change, a new SCR-004, and a rebuild of Unit 15.

*Sizes:* "mostly 4, 2 to 6 when necessary" matches `client-view.md`'s n = 2–6 default 4
and `competition-rules.md:18`'s "teams of 4", and Unit 13's rotation already self-adapts
to any count through `min(n, m)` and the `r < n` empty-seat rule, so **no size check is
enforced** (Q4's default stands). Nothing about size is contested; the school-attribution
half is.

**This question does not block the build.** The individual-event half — the import, the
flags, the accounts, the slips — is fully specified and does not depend on the answer.
Team formation is a separate, later unit.
