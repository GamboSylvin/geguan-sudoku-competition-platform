# Data Model and Schema — APPROVED (2026-09-30)

> **Approved data model and schema.** Approved 2026-09-30 by the team / project owner (checklist item A6, section E of `FILL-BEFORE-CODING.md`). This replaces the `FILL-BEFORE-CODING` marker that stood here. The schema is expressed in Prisma (I-31) and the `data-model.md` entities below are its concrete form.
> Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [O] open. See `README.md`. The decisions below are the constraints the model must respect; they come from `competition-rules.md` and `architecture.md`.
> **Fields that depend on an open item are marked `OPEN (U-xx)` or `[O]` on purpose. Do not implement an `OPEN` field.** They are listed with their IDs in "Open points flagged in this model".

## Status

- **Drafted:** 2026-09-30, from the constraints already recorded in `competition-rules.md` and `architecture.md`, and from the initial data-model draft of the same day (see "Reconciled against the initial draft").
- **Revised:** 2026-09-30 (v2 complete). All entities and fields the decided rules imply are present; the fields that depend on an open item are listed with their ID in "Open points flagged in this model" and are **not** to be implemented.
- **Approved:** yes, 2026-09-30, by the team / project owner (checklist item A6). The approval line is signed at the end of this file.
- **Scope:** the MVP. Multi-tenancy and the Super Administrator are deferred (ENV-007, SA-005) and are **not** in this model. The second team round (齐心协力 / partition collaboration) is **decided** (TEM-005 to TEM-008, 2026-09-30): a puzzle split into row-band blocks, one per active member. It is modelled below (`TeamPartitionState`); its numeric defaults (puzzle count, time, points) are working positions, not sourced.

## Constraints the model must respect (from the decided rules)

- The event has categories; a category has two stages (Individual, Team); each stage has 2 rounds; an Individual round has 6 puzzles [C].
- **Round settings** (times, points, bonus rate and cap, countdown length, counts) are set **once per round for the whole event**, not per category [C]. Question points belong to the questions [C].
- **Questions are modelled one file per category, not a shared pool** [C] (BLD-028, resolves U-32): each category (e.g. U8, U12) is uploaded and imported separately, even when categories run the same round in parallel.
- **Grid model is generic** (rows, columns, regions), never assuming 9x9 [C] (BLD-011). The **solution is stored with the question**; the answer check compares against it [C] (BLD-010); this relies on a unique solution, **confirmed 2026-10-01** [C] (U-90): every puzzle has exactly one valid solution.
- **Scores are whole numbers**; the **school total is an exact decimal**, neither rounded nor truncated [C] (SCR-013). The round score includes the bonus and can exceed the round maximum [C] (SCR-010).
- **Attempts are archived, never deleted**, on a judge restart or rematch, and the number of restarts stays visible [C]/[P] (SUB-005, SUB-008, ROL-005).
- **One role per account**; several controller accounts allowed; one person with several roles is two accounts [C] (BLD-004). Participant username = participant number; the password is a short random code [C] (BLD-003).
- **Judge ranges** are assigned by the controller during setup and can change during the event [C] (BLD-008).
- **Score corrections** need a mandatory reason and a change log [P] (RES-003). Commands are traceable (logged) [S] (BSC-002).
- **Purge:** 15 days after the competition, answers, scores and student accounts are permanently deleted; setup, questions and judges are kept [P] (RES-004). **Archived scores and the correction log, resolved 2026-10-01** [C] (RES-005): also deleted after 15 days, same as the other student data. **Legal/school rules, resolved 2026-10-01** [C] (RES-008): no special protection required, organizer assumes no legal liability, the 15-day plan stands as-is. Still open: whether the uploaded participant Excel follows it (U-62, narrowed).
- **Durable results in PostgreSQL**, never only in Redis; working grids in Redis with persistence on [T]/[C] (BLD-007).
- **The schema is expressed in Prisma** [T] (I-31): the Prisma schema is the single source of truth for the database and the migrations are versioned in the repository (see `architecture.md` and `code-standards.md`). The model below is written as entities and fields; the Prisma schema is the concrete form of it.
- **Keep the model ready for team rotation**, although the Individual stage is built first [C] (I-01).
- **Single-tenant MVP** [C] (ENV-007): there is no Organization / Tenant entity and no Super Administrator role. The long-term multi-tenant target (ENV-001/002, SA-005) is not modelled here.

## Entities

Casing follows BLD-019 (`camelCase` fields, `PascalCase` entities, `UPPER_SNAKE_CASE` enum values). Every table has an `id` (UUID) primary key unless noted. "U" columns mean unique constraints. "OPEN" in a field's note means the field's shape depends on an open decision and must not be implemented yet.

### Competition and structure

| Entity | Fields | Relationships | Notes |
|---|---|---|---|
| Competition (event) | id; name; description; status (`CREATED`/`PUBLISHED`/`WAITING`/`PREPARATION`/`ROUND_ACTIVE`/`PAUSED`/`ROUND_FINISHED`/`STAGE_FINISHED`/`FINISHED`/`CANCELLED`); createdAt; publishedAt (nullable); startedAt (nullable); finishedAt (nullable); cancelledAt (nullable); finishedEarly (bool); entryLinkToken; bigScreenLinkToken; copiedFromCompetitionId (nullable) | has many Category, Stage, School, Team, Participant, QuestionSet, JudgeAssignment, StoredFile, ImportBatch, ScoreCorrection, PurgeSchedule, AuditLog; has one ScoringConfiguration | Lifecycle in `REQUIREMENTS.md` §7.1. `finishedEarly` carries the RND-007 mark. **Awards after an early finish, resolved 2026-10-01** [C] (U-89, narrowed): purely a human, on-site decision by the organizers, not the system's concern — the system just marks `finishedEarly` and computes the scores of the rounds actually played; no special award-tier field or computation is added for this case. **Award tiers, resolved 2026-10-01** [C] (RES-007, resolves U-27): none needed for any finish, normal or early. Scores and final ranking are shown; the school applies its own award regulation by hand. No schema field added. Publish generates the entry link/QR and the separate big-screen link (§7.2.8). Copy keeps settings/questions/judges, not results (CMP-100); what exactly is copied is partly open (U-10). The overall duration is **derived from the rounds, not configured** (CS-006). Cancel semantics and data fate OPEN (U-31). |
| CompetitionCategory | id; competitionId; code (e.g. `U6`..`U20`); name; sequence | belongs to Competition; has many QuestionSet, Team, Participant, RoundParticipation | U (competitionId, code). Categories run in parallel and are ranked separately [P] (EVT-002). **Exact numbers resolved 2026-09-30** [T] (U-02): documented estimates (all categories U6 to U20) stay the working position, no rebuild needed if real numbers arrive later. **Whether a room mixes categories, resolved 2026-10-01** [C] (EVT-005, narrows U-02): no design impact either way — the system doesn't model "room" as an entity tied to category; a room is simply a physical grouping of participant numbers. Whichever way organizers assign rooms, nothing changes in what gets built. |
| Stage | id; competitionId; type (`INDIVIDUAL`/`TEAM`); sequence; status (`WAITING`/`PREPARATION`/`ACTIVE`/`PAUSED`/`FINISHED`); startedAt; endedAt | belongs to Competition; has many Round | Exactly two per event: Individual, Team [C] (CS-010). Structure fixed, not admin-defined [P] (CS-020). The next stage never starts by itself (§7.1). |
| Round | id; stageId; sequence; name; status (`WAITING`/`PREPARATION`/`ACTIVE`/`PAUSED`/`FINISHED`); earlyEnded (bool); startedAt; endedAt | belongs to Stage; has one RoundSettings; has many Question, RoundParticipation, TeamRoundResult, IndividualRoundResult, TeamRotationState | Two per stage. Status changes are durable in PostgreSQL (BLD-007). An early end cannot be undone (§7.4). |
| RoundSettings | roundId (PK/FK); durationSeconds; preparationSeconds (default 60); earlyBonusRate (default 3); earlyBonusCap (nullable); teamPointsPerQuestion (default 10); rotationPeriodSeconds (default 60); teamQuestionCount (default 10); teamTotalTimeSeconds (nullable); individualTotalWarning (nullable, default 100) | on Round (1:1) | **Once per round for the whole event, not per category** [C] (RND-005). Editable only before that round's preparation begins (RND-002, RND-004). Whole numbers except the school coefficient (SCR-012); times and counts must be above zero. `earlyBonusRate` = 3 points per whole minute (SCR-008); `earlyBonusCap` empty = no cap (SCR-009); `individualTotalWarning` triggers a warning only, never a block (SCR-006/016). Team defaults from TEM-004/SCR-015. |

### Questions

| Entity | Fields | Relationships | Notes |
|---|---|---|---|
| QuestionSet | id; competitionId; categoryId (not null); name; sourceFileId | belongs to Competition and Category (one file per category); has many Question | **One file per category, not shared** [C] (BLD-028, resolves U-32): `categoryId` is required, not nullable — every category is uploaded and imported separately. |
| Question (puzzle) | id; questionSetId; roundId; sequence; type (`STANDARD`/`VARIANT` — sub-types OPEN); gridRows; gridColumns; regions (json); startingGrid (json); solution (json, **incomplete today**); points (int >= 1) | belongs to QuestionSet, Round | **Generic grid** (rows, columns, regions), never 9x9 [C] (BLD-011). **Solution stored with the question** [C] (BLD-010) — but the real sample files only give the answers for the blank cells; the pre-filled given cells exist only in an embedded picture, not as text. Interim plan: ask the source for a complete text solution; hand-transcribe a small starter set meanwhile; general automated import of `solution` **stays blocked** [T] (BLD-026). **OPEN (U-94):** re-asking the stakeholder for a clearer answer. Points per question, whole number >= 1 (SCR-014); points belong to the question, so they follow the category's set (RND-005); **fully customizable regardless of what the import file carries** [C] (BLD-025, resolves U-92). Whether the file carries the points is OPEN (U-03). Supported shapes and the shape↔type link OPEN (U-01, IND-4). The check relies on a unique solution, **confirmed 2026-10-01** [C] (U-90): every puzzle has exactly one. |
| ImportBatch | id; competitionId; kind (`PARTICIPANT_EXCEL`/`QUESTION_EXCEL`); fileId; status (`VALIDATED`/`REJECTED`/`COMMITTED`); errors (json); importedAt | belongs to Competition, StoredFile | **Validation is atomic:** an invalid file commits nothing, and errors name the problem and the row (§7.2.3–4, §7.2.6). Re-upload replaces only on full validity (§7.2.4). The import file is **Excel (`.xlsx`), not PDF** [C] (BLD-024, resolves U-93). Whether the original file is kept and whether extracted questions can be edited in-app is OPEN (U-43). Whole-file re-upload after publish OPEN (U-36). |
| TeamPartitionState | roundId; teamId; blockAssignments (json — participantId → row range); puzzleIndex; startedAt | belongs to Round, Team | **Team-round-2 block split** (partition collaboration, "齐心协力") [C] (TEM-005): the grid is cut into contiguous horizontal row-bands, one band per active member (2 to 6, as equal as possible, extra rows to the first bands); `blockAssignments` holds which member owns which band. Each member edits only their own band; the puzzle is scored all-or-nothing once the bands are combined (settled result in `TeamRoundResult`, reused). Puzzle count (default 3), total time (default 30 min) and points per puzzle (default 20) are **working positions** [T] (TEM-006 to TEM-008), not sourced from the regulation. Fast-changing state lives in Redis, like `TeamRotationState`. |

### People and access

| Entity | Fields | Relationships | Notes |
|---|---|---|---|
| School | id; competitionId; name; sequence | belongs to Competition; has many Team, Participant | Needed for the school total and school ranking [C] (SCR-004). U (competitionId, name). |
| Team | id; competitionId; categoryId; schoolId; name; sequence | belongs to Competition, Category, School; has many Participant | **Exactly one team per school per category** [C] (SCR-004). U (competitionId, categoryId, schoolId). Team size 2–6, default 4 [S] (CS-014). Teams are derived from the file's Team column, not formed by hand [S] (PT-003). **Changing a team after import, resolved 2026-10-01** [C] (PAR-007, resolves U-41): no special feature needed — moving a student to a different team is just editing that participant's `Team` field, already covered by the controller's standing permission to add, edit or replace participants at any time (PAR-003). No dedicated team-management screen. |
| Participant | id; competitionId; categoryId; schoolId; teamId (nullable); name; participantNumber (int); sequence; active (bool) | belongs to Competition, Category, School, Team; has one Account; has many RoundParticipation | Fields from PAR-004 (Name, School, Category, Team). **participantNumber generated**: schools in file order, students in row order, unique across the event, a team's numbers consecutive [P] (PAR-001). U (competitionId, participantNumber). `active` reflects removal from the active set (§7.2.4). **Extra columns, resolved as a Working Position 2026-10-01** [T] (PAR-008, narrows U-40): any columns beyond Name/School/Category/Team are ignored on import, no error. Matching across file versions OPEN (I-09). New slip for an added/replaced student OPEN (U-17). |
| Account | id; username (U); passwordHash; role (`CONTROLLER`/`JUDGE`/`PLAYER`); participantId (nullable); judgeId (nullable); isActive (bool); createdAt; lastLoginAt (nullable); sessionExpiresAt (nullable); activeDeviceId (nullable) | belongs to Participant or Judge; has many Device | **One role per account; several controller accounts allowed** [C] (BLD-004). Player username = participant number, short random password [C] (BLD-003). **One active device per account**, newest login takes over [P] (PAR-005). Session length and idle behaviour OPEN (I-16). Failed/rejected login display OPEN (I-13). Judge and controller credential format OPEN (I-30). |
| Device | id; accountId; deviceLabel; userAgent; firstSeenAt; lastSeenAt; isActive | belongs to Account | Supports **one active device per account** [P] (PAR-005): a student continues on another tablet, saved answers and remaining time carry over. Runtime/connection state lives in Redis (BLD-007); the durable part is which account is on which device. |
| Judge | id; name; active (bool); createdAt | reusable list; has many JudgeAssignment | Reusable list created by the admin [T]. Removal of a judge on an unfinished competition OPEN (I-12). |
| CompetitionJudgeAssignment | id; competitionId; judgeId; fromParticipantNumber; toParticipantNumber; assignedAt; assignedByAccountId | belongs to Competition, Judge, Account | **Range assigned by the controller during setup, changeable during the event** [C] (BLD-008). U (competitionId, judgeId). A judge's authority is limited to the competition they are assigned to (§7.2.5), and strictly to their assigned range — no visibility outside it, and no powers beyond status viewing and single-student restart [C] (U-55, resolved 2026-09-30; see "Access rules"). **What a judge sees in the team stage, resolved 2026-10-01** [C] (ROL-008): same scope as the Individual stage, no expansion. |

### Participation, attempts and scoring

| Entity | Fields | Relationships | Notes |
|---|---|---|---|
| RoundParticipation | id; roundId; participantId; categoryId; state (`WAITING`/`ACTIVE`/`SUBMITTED`/`AUTO_SUBMITTED`/`RESTARTED`); currentAttemptId (nullable); attemptCount (int); leftAnswerPageCount (int) | belongs to Round, Participant; has many Attempt | U (roundId, participantId). `attemptCount` keeps the number of restarts visible (SUB-008). `leftAnswerPageCount` is the judge-visible, info-only counter with no penalty [P] (PAR-005). Connection status is runtime (Redis). |
| Attempt | id; roundParticipationId; attemptNumber (int); isArchived (bool); submissionType (`MANUAL`/`TIMEOUT`/`CONTROLLER_END`/`AUTO`); submittedAt; autoFilled (bool); score (int); bonus (int); totalScore (int); completionTimeSeconds (int) | belongs to RoundParticipation; has many Answer | **Archived, never deleted**, on restart or rematch [C]/[P] (SUB-005, ROL-005). One effective submission per round (PL-009); a restart archives the earlier attempt and the student restarts blank on the shared remaining time. `autoFilled` marks data lost and filled as wrong (RES-001). `bonus` is part of `totalScore` (SCR-010). Note: §9 says **whether a submission was manual or automatic is not kept long term** — `submissionType` is used transiently and its long-term retention is a retention detail (see PurgeSchedule). |
| Answer | id; attemptId; questionId; submittedGrid (json); correct (bool); pointsAwarded (int); autoFilled (bool) | belongs to Attempt, Question | U (attemptId, questionId). Unanswered stored as wrong (RES-001). All-or-nothing per puzzle (SCR-001). Kept and exported, then purged after 15 days (RES-001, RES-004). |
| IndividualRoundResult | id; roundId; participantId; categoryId; attemptId; score (int); bonus (int); totalScore (int); submissionType; submittedAt; completionTimeSeconds (int) | belongs to Round, Participant, Attempt | The **finalized** result of a player's round (stage, round, player, score, completion time) [T] (§5). Separate from the working attempts so that archiving an attempt on restart/rematch never loses the settled result (ROL-005). Ranking is derived from these. |
| TeamRoundResult | id; roundId; teamId; categoryId; correctCount (int); score (int); completionTimeSeconds (nullable) | belongs to Round, Team | Team score = correct answers x points per question (SCR-007, SCR-015). Rotation round only in the first build. |
| ScoreCorrection | id; competitionId; targetType (`PARTICIPANT`/`TEAM`/`SCHOOL`); targetId; roundId (nullable); oldScore; newScore; reason (required); correctedByAccountId; correctedAt | belongs to Competition, Account | **Mandatory reason and a change log** [P] (RES-003). Ranks recalculate automatically after a correction. Also logged in AuditLog. |
| RankingSnapshot | id; competitionId; stageId; categoryId; scope (`INDIVIDUAL`/`TEAM`/`SCHOOL`); isFinal (bool); payload (json, ordered ranks); computedAt | belongs to Competition, Stage, Category | Ranking is **derived**; this is an optional stored snapshot for a finalized stage ranking (it "keeps its stage", §5). Can be dropped if ranking stays purely computed. School total is an exact decimal (SCR-013). **Tie-break, resolved as a Working Position 2026-10-01** [T]/[C] (SCR-017, narrows U-22): the core rule is stakeholder-confirmed — earlier submission time wins, superseding the client document's "rank by round 1 score" rule. **Proposed extension, not yet confirmed:** for an individual (ranked on two rounds), use the combined submission time of both; for a school, use the sum of submission times of all that school's players in the category. One consistent "shortest total time wins" rule at every level. Being sent back to the stakeholder for confirmation of the extension. **When students see the score, resolved 2026-09-30** [C] (BLD-029, resolves U-24, U-88): only when the whole competition reaches `FINISHED` — this note was stale and not updated when that was decided. |
| ScoringConfiguration | id; competitionId; schoolCoefficient (decimal, default 0.6); rankingCycleSeconds (default 180) | belongs to Competition (1:1) | Coefficient customizable, decimals allowed (SCR-004, SCR-012). `rankingCycleSeconds` is the big-screen ranking cycle, a customizable numeric value (SCR-005). Per-round numbers live on RoundSettings. |

### Operations, files and lifecycle

| Entity | Fields | Relationships | Notes |
|---|---|---|---|
| TeamRotationState | roundId; teamId; refillQueue (json); tabletHolds (json); rotationIndex; lastRotationAt | belongs to Round, Team | Keeps the model **ready for team rotation** [C] (I-01): the refill queue and which question each tablet holds. Fast-changing state lives in **Redis** with persistence on (BLD-007); only the settled result is durable (TeamRoundResult). Round 2 (齐心协力) is decided and modelled separately, see `TeamPartitionState` above [C] (TEM-005). |
| CompetitionRuntimeState | competitionId; currentStageId (nullable); currentRoundId (nullable); phase; pausedAt (nullable); remainingSecondsAtPause (nullable); updatedAt | belongs to Competition | Runtime state for the global pause and the automatic progression (RND-006, §7.5). Lives in **Redis** with persistence on (BLD-007); round-state changes are also durable on Round/Stage. **Tolerable interruption length, resolved 2026-09-30** [C] (U-49): no fixed limit, so **no timeout/expiry field is added here** — the controller decides resume vs. replay on the day; `pausedAt` alone is enough to show how long a pause has lasted, it never auto-expires. |
| BigScreenDisplayState | competitionId; mode (`RANKING`/`PLAYER_CLOSEUP`/`TEAM_SPLIT`/`PAUSED`/`FINAL`); targetId (nullable); rotationEnabled (bool) | belongs to Competition | All screens share one link and show the same content [C] (BSC-001/002). Mostly runtime (Redis); the durable part is `Competition.bigScreenLinkToken`. With one screen, judge and controller both control it and the last action wins; with several, only the controller (BSC-002). **Regenerating the link, resolved 2026-10-01** [C] (BSC-003, resolves U-15): the controller can regenerate `Competition.bigScreenLinkToken` after publish — a simple safeguard against a leaked link. A screen already open on the old token shows a clear "this link is no longer valid, ask the controller for the new one" message, rather than silently stopping its updates. |
| StoredFile | id; competitionId; kind (`PARTICIPANT_EXCEL`/`QUESTION_EXCEL`/`CREDENTIAL_SLIPS`/`EXPORT`); path; originalName; mimeType; sizeBytes; checksum; uploadedByAccountId; uploadedAt | belongs to Competition, Account | Files live on the server's disk in a mounted folder [C] (BLD-001). Path template in "Storage conventions". **Export format, resolved 2026-10-01** [C] (U-08): Excel (`.xlsx`), with scores, ranks and the answer per question; no specific layout or column list imposed — the exact columns are an implementation detail, easy to adjust, not a system rule. Whether the participant Excel follows the 15-day deletion is **still OPEN (U-62, narrowed to just this file; U-59 for the legal-rules part)** — the scores/correction-log part of U-62 is resolved, see `PurgeSchedule`. |
| PurgeSchedule | id; competitionId; purgeAt (competition end + 15 days); scope (json); includesArchivedScores; includesCorrectionLog; includesParticipantExcel (nullable); executedAt (nullable); status | belongs to Competition | **Answers, scores and student accounts deleted 15 days after the competition** [P] (RES-004). **`includesArchivedScores` and `includesCorrectionLog`, resolved 2026-10-01** [C] (RES-005): both always `true` — archived scores and the correction log follow the same 15-day deletion as the rest of the student data. **`includesParticipantExcel` stays OPEN (U-62, narrowed).** A daily-email reminder to the controller before the purge was a team idea (not the stakeholder's), **withdrawn 2026-10-01** [L]: parked as a later-phase "maybe", not in this schema, and not a conflict with ARCH-028 since it is not being built now. |
| AuditLog | id; competitionId (nullable); actorAccountId; action; targetType (nullable); targetId (nullable); payload (json); at | belongs to Competition, Account | Commands are **traceable (logged)** [S] (BSC-002), and the correction change log records who changed what [P] (RES-003). Also records controller takeover from a disconnected judge (ROL-004). **The correction log is purged after 15 days, resolved 2026-10-01** [C] (RES-005). |

## Access rules (resolved 2026-09-30, U-63 and the general part of U-55)

Enforced through `Account.role` plus these rules, at the service layer (not new schema fields):

- **Player:** reads only their own `Attempt`/`Answer`/`IndividualRoundResult` rows (scoped by `Account.participantId`). No visibility into another player's data.
- **Judge:** reads only `RoundParticipation`/`Attempt`/status rows for participants inside their own `CompetitionJudgeAssignment` range. No powers beyond status viewing (connected, submitted) and single-student restart — nothing more. Cannot edit `Participant` rows. Cannot write to `ScoreCorrection`.
- **Controller:** full read on the competition; the only role that may write `Participant` (add, edit, replace, at any time — before, during and after the competition, PAR-003) and `ScoreCorrection` (score changes, mandatory reason — already an invariant, RES-003).
- **Judge in the team stage, resolved 2026-10-01** [C] (ROL-008, resolves U-39): same scope as the Individual stage — reads only team-status rows (`TeamRotationState`/`TeamPartitionState`, connected/in-progress) for teams inside their assignment; no per-member detail, no new fields needed.

## Storage conventions

- **File path template:** `{STORAGE_ROOT}/competitions/{competitionId}/{kind}/{fileId}-{originalName}`; the reference column on the parent record is `StoredFile.path`, keyed by `competitionId` and `kind`. `STORAGE_ROOT` is a mounted folder (BLD-001). Participant Excel, question Excel (one per category), credential slips and exports use this template [C] (BLD-028).
- **Redis vs PostgreSQL:** working grids, the round timer, connection/device state, `CompetitionRuntimeState` and the big-screen display state are runtime and live in **Redis with persistence on**; round-state changes, attempts, finalized results, scores, corrections, the audit log and ranking data are **durable in PostgreSQL** and never only in Redis (BLD-007). Pre-submission working grids may stay Redis-only; submitted answers are durable and kept until the purge (RES-001, RES-004).
- **Participant numbering:** `Participant.participantNumber` is assigned on import per PAR-001 and is stable afterwards; the admin may adjust it [A] (U-16). Numbers are not bound to a device.
- **Exact decimals:** the school total (`RankingSnapshot` payload / export) is stored and ranked as an exact decimal, never floating point, not rounded or truncated (SCR-013). Integer scores everywhere else.

## Enumerations

- `Competition.status`: `CREATED`, `PUBLISHED`, `WAITING`, `PREPARATION`, `ROUND_ACTIVE`, `PAUSED`, `ROUND_FINISHED`, `STAGE_FINISHED`, `FINISHED`, `CANCELLED` (§7.1).
- `Stage.type`: `INDIVIDUAL`, `TEAM`. `Stage.status` / `Round.status`: `WAITING`, `PREPARATION`, `ACTIVE`, `PAUSED`, `FINISHED`.
- `Account.role`: `CONTROLLER`, `JUDGE`, `PLAYER` (BLD-004).
- `RoundParticipation.state`: `WAITING`, `ACTIVE`, `SUBMITTED`, `AUTO_SUBMITTED`, `RESTARTED`.
- `Attempt.submissionType`: `MANUAL`, `TIMEOUT`, `CONTROLLER_END`, `AUTO` (transient; see the retention note on `Attempt`).
- `BigScreenDisplayState.mode`: `RANKING`, `PLAYER_CLOSEUP`, `TEAM_SPLIT`, `PAUSED`, `FINAL` (BSC-002).
- `StoredFile.kind` / `ImportBatch.kind`: `PARTICIPANT_EXCEL`, `QUESTION_EXCEL`, `CREDENTIAL_SLIPS`, `EXPORT`.
- `RankingSnapshot.scope`: `INDIVIDUAL`, `TEAM`, `SCHOOL`.

## Open points flagged in this model

None of the following may be implemented until it is answered; the model marks the place where each will land.

| Open item | Where it lands in the model |
|---|---|
| U-03 | whether the question Excel carries points (`Question.points`) |
| U-01 | sample participant Excel and a past results sheet still not sent; supported shapes (`Question.regions`) |
| U-94 | the given cells are image-only, not text — deeper than just the missing solution column (`Question.solution`, `Question.startingGrid`); re-ask refined 2026-10-01, carried back to the stakeholder |
| U-10 | what exactly a copy carries (`Competition.copiedFromCompetitionId`) |
| U-16, U-17 | participant-number adjustment; new slip for an added/replaced student (`Participant`) |
| U-22 | tie-break rule, core confirmed (earliest submission time), the combined/sum extension not yet confirmed (`ScoringConfiguration`, `RankingSnapshot`) |
| U-24, U-88 | what "publish results" means and when students see their score (`RankingSnapshot.isFinal`, `Competition`) |
| U-31 | cancel semantics and data fate (`Competition.status = CANCELLED`) |
| U-36, U-43 | whole-file re-upload after publish; keeping/editing the original file (`ImportBatch`) |
| U-42 | appeals versus the 15-day deletion (`PurgeSchedule`) |
| U-62 | whether the uploaded participant Excel follows the 15-day deletion (scores/correction-log part resolved 2026-10-01, RES-005) (`PurgeSchedule.includesParticipantExcel`) |
| I-09 | how two participant records are matched as the same person (`Participant`) |
| I-12 | removing a judge assigned to an unfinished competition (`Judge`) |
| I-13 | what a failed/rejected login shows (`Account`) |
| I-16 | session length and idle behaviour (`Account.sessionExpiresAt`) |
| I-30 | judge and controller credential format (`Account`, `StoredFile` kind `CREDENTIAL_SLIPS`) |

## Reconciled against the initial draft (2026-09-30)

The initial draft of the same day is broadly kept. Changes made, with the rule that forces them:

- **Removed the Organization entity and the `SUPER_ADMIN` role.** The MVP is single-tenant and the Super Administrator is deferred (ENV-007, SA-005). Roles in the model are `CONTROLLER`, `JUDGE`, `PLAYER`.
- **Split the single Question Pack per competition into per-category QuestionSets** (BLD-005), confirmed as one file per category, not shared (BLD-028, resolves U-32).
- **Added a Question (puzzle) entity** with the generic grid and the stored solution (BLD-011, BLD-010), so the answer check and per-question points (SCR-003) have a home.
- **Added the missing decided entities:** `School` (school total and ranking, SCR-004), the **judge range** fields on `CompetitionJudgeAssignment` (BLD-008), `ScoreCorrection` (RES-003), archived `Attempt` (SUB-005, ROL-005), `PurgeSchedule` (RES-004), `BigScreenDisplayState` (BSC-001/002), `TeamRotationState` (I-01), `StoredFile` (BLD-001).
- **Kept** the good choices from the initial draft: UUID keys, explicit `sequence`, Participant identity separated from Account credentials, `UNIQUE(roundId, participantId)`, the coefficient as configuration not a hard-coded constant, ranking as derived, and runtime state kept out of PostgreSQL.

### Completed in v2 (this revision)

- **Separated the finalized result from the working attempt:** added `IndividualRoundResult`, so archiving an attempt on a restart or rematch never loses the settled round result (ROL-005, §5). `Attempt` keeps the raw history.
- **Moved `leftAnswerPageCount` from `Account` to `RoundParticipation`** — it counts leaving the answer page within a round, which is per round and per participant (PAR-005).
- **Added `IndividualRoundResult` vs `Attempt` clarification** and the `submissionType` retention note (§9).
- **Added `Device`** to make "one active device per account" concrete (PAR-005).
- **Added `ImportBatch`** for the atomic participant/question imports (§7.2.3–4, §7.2.6).
- **Added `CompetitionRuntimeState`** for the global pause and automatic progression (§7.5, RND-006).
- **Added `AuditLog`** for traceable commands and the correction change log (BSC-002, RES-003, ROL-004).
- **Added the `PurgeSchedule.includes*` flags** for the open retention question (U-62) instead of guessing. (U-59 is now resolved, RES-008.)
- **Added `ScoringConfiguration.rankingCycleSeconds`** (the big-screen cycle, SCR-005) and per-round defaults on `RoundSettings`.
- **Added the `Enumerations` section** so every state machine named in the requirements has one home.

### Reconciled with the stakeholder pack's Part 2 answers (2026-09-30)

- **Access rules resolved (U-63, and the general part of U-55):** new "Access rules" section added above; the `CompetitionJudgeAssignment` note and the `U-63`/`U-55` rows in "Open points flagged in this model" updated/removed accordingly. No schema change — enforcement is at the service layer on top of the existing `Account.role`. `U-39` (judge view in the team stage) stays open and is unaffected.
- **Tolerable interruption length resolved (U-49):** no fixed duration; the controller always decides resume vs. replay on the day. No schema change — the `CompetitionRuntimeState` note above records that no timeout/expiry field is added, and the `U-49` row is removed from "Open points flagged in this model".
- **U-02 fully resolved (exact numbers 2026-09-30, room mixing 2026-10-01, EVT-005):** no schema change either time — "room" was never modelled as an entity, so there was nothing to add or remove. The `CompetitionCategory` note was updated and the open-points row removed.
- **Archived scores and correction-log retention resolved (U-62, part; RES-005):** `PurgeSchedule.includesArchivedScores`/`includesCorrectionLog` are now known to be always `true`; no schema change, just the notes. `includesParticipantExcel` and `U-59` stay open. **Withdrawn, not added:** a daily-email reminder to the controller before the purge — the user's own idea, not the stakeholder's, withdrawn 2026-10-01 and parked as a later-phase [L] "maybe". No conflict with ARCH-028, since it is not being built now.

### Reconciled with the stakeholder pack's Part 1 close-out (2026-09-30)

- **Import format corrected to Excel, not PDF:** `QUESTION_PDF` renamed to `QUESTION_EXCEL` on `StoredFile.kind`/`ImportBatch.kind` (BLD-024, resolves U-93).
- **`QuestionSet.categoryId` made required, not nullable:** one question file per category, not a shared pool (BLD-028, resolves U-32).
- **Added `TeamPartitionState`** for the second team round's decided block-split design (TEM-005 to TEM-008), replacing the earlier "not modelled" note.
- **Points confirmed fully customizable** on `Question.points` regardless of what the import file carries (BLD-025, resolves U-92); the flat value seen in the real sample files is not a fixed rule.
- **`Question.solution` flagged incomplete:** the real sample files only give answers for the blank cells, not the full solution (U-94, interim plan BLD-026).

## Completeness check

- Every decided rule that needs storage has an entity or a field: lifecycle and structure (Competition/Stage/Round), per-category questions and generic grids (QuestionSet/Question, one file per category), participants/teams/schools and accounts (Participant/Team/School/Account), judges and their ranges (Judge/CompetitionJudgeAssignment), participation/attempts/answers and finalized results, team rotation and the team-round-2 block split (TeamRotationState/TeamPartitionState), corrections, ranking, big screen, files (Excel, not PDF), import, purge and audit.
- Every open item that touches the model is listed in "Open points flagged in this model" and is **not** implemented.
- **This model is complete for the MVP and approved** (2026-09-30, A6). It is the skeleton the first coding unit builds on; the Prisma schema is its concrete form (I-31).

## Approval

- Reviewed by: team / project owner · Date: 2026-09-30 · Approved: [x]
