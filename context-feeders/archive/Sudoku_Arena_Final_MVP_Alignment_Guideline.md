> **[CONTEXT FEEDER NOTE]** Archived source document, already merged into the requirements and decisions and, from there, into `context/`. Kept for reference only; do NOT use it to decide what to build. It is not maintained: the only edits are this note and the updated folder paths.

# Sudoku Arena — Final MVP Alignment & Engineering Guideline

**Document status:** Final pre-implementation alignment  
**Purpose:** Single working guideline for the remaining 15-day MVP implementation  
**Planning principle:** Build the smallest complete system that satisfies the agreed competition flow. Do not introduce new product scope, architecture, or configuration complexity unless a blocking requirement appears.

---

# 1. Project Objective

Sudoku Arena is a real-time online Sudoku competition platform for the current client competition.

The MVP is **not** a fully generic SaaS competition engine. It should provide a reliable end-to-end competition experience for:

- Administrators
- Judges
- Players
- Big-screen display

The current team is two developers with approximately **15 days remaining**. The implementation therefore prioritizes:

1. Correct competition execution
2. Server-authoritative state and timing
3. Reliable autosave/reconnection
4. Automatic scoring and ranking
5. Judge control
6. Big-screen display
7. Simple deployment and maintenance

Generic configurability and future platform capabilities are deliberately deferred.

---

# 2. Planning Sets and Final Alignment

The planning was organized into several large questions.

## Q1 — Competition Execution

Resolved.

Covers:

- Competition hierarchy
- Player entry and login
- Stage/round flow
- Judge controls
- Player gameplay
- Autosave
- Submission
- Auto-submit
- Disconnection/reconnection
- Pause/resume
- Early ending
- Competition completion

## Q2 — Competition Creation and Lifecycle

Resolved.

Covers:

- Competition creation
- Participant Excel import
- Player account generation
- Question PDF import
- Judge assignment
- Publish readiness
- Publish locking
- Pause/resume
- Finish/cancel behavior
- Post-competition access

## Q3 — Results and Ranking

Resolved.

Covers:

- Scoring
- Ranking
- Tie-breaking
- Provisional rankings
- Final rankings
- Big-screen ranking
- Player/team projection
- Result persistence
- Result immutability

## Remaining planning topics

The following are intentionally reduced to implementation-level decisions rather than additional long planning sessions:

- Question/content implementation details
- Authentication and access control
- Module boundaries
- API/WebSocket contracts
- 15-day implementation sequence

These are defined in this document at the minimum level required to start implementation.

---

# 3. Product Scope for This MVP

## Included

- Competition creation
- One competition/category
- Individual stage
- Team stage
- Predefined rounds
- Participant Excel import
- Player account generation
- Judge assignment
- Competition question PDF import
- Question Bank persistence
- Competition-specific question pack
- Publish/lock
- Competition-specific player/judge entry
- Player gameplay
- Autosave
- Manual submission
- Automatic submission at timer expiration
- Server-authoritative timing
- Disconnection/reconnection
- Global competition pause/resume
- Judge stage/round control
- Automatic scoring
- Provisional ranking
- Final ranking
- Big-screen ranking
- Individual player projection
- Team projection
- Competition finish
- Admin post-competition results

## Explicitly out of scope

Do not implement these unless the client explicitly changes scope:

- Microservices
- Generic configurable competition engine
- Admin-configurable stage/round definitions
- Configurable scoring formulas
- Configurable ranking rules
- PK mode
- Payment system
- Manual score editing
- Manual ranking editing
- Result dispute workflow
- Score correction/audit system
- Detailed move analytics
- Long-term final-grid history
- Player final-results dashboard
- Combined individual + team ranking
- Detailed post-competition analytics
- Generic multi-tenant SaaS features
- Complex configuration/template marketplace
- OCR-based question extraction

---

# 4. Competition Hierarchy

The MVP uses the following model:

```text
Competition
└── Category
    ├── Individual Stage
    │   ├── Round 1
    │   ├── Round 2
    │   └── ...
    │
    └── Team Stage
        ├── Round 1
        ├── Round 2
        └── ...
```

A competition represents one category.

Example:

```text
Competition: Zhejiang Sudoku Championship — U14

Category: U14

Stages:
- Individual
- Team
```

Different categories are separate competitions:

```text
U12 → Competition A
U14 → Competition B
U16 → Competition C
```

The MVP does not create a single competition containing multiple categories.

---

# 5. Competition Lifecycle

The competition lifecycle is server-controlled.

```text
CREATED
   │
   │ publish
   ▼
PUBLISHED / WAITING
   │
   │ judge starts stage
   ▼
PREPARATION
   │
   │ countdown completes
   ▼
ROUND_ACTIVE
   │
   ├───────────────┐
   │               │
   │ timer ends    │ judge ends round
   │               │
   └───────┬───────┘
           ▼
     ROUND_FINISHED
           │
           │ more rounds?
           ├──────── yes ───────► PREPARATION
           │
           └──────── no ────────► STAGE_FINISHED
                                      │
                                      │ more stages?
                                      ├── yes ──► PREPARATION
                                      │
                                      └── no ───► FINISHED
```

Global interruption states:

```text
ACTIVE
  ↕
PAUSED

ACTIVE → FINISHED
ACTIVE → CANCELLED
```

## Publish

Publishing:

- Generates the competition entry link/QR.
- Locks competition configuration.
- Requires all publish-readiness conditions to pass.
- Ensures player accounts already exist.
- Makes the competition available to players/judge.

After publication, normal competition configuration cannot be edited.

## Pause

Pause is **global**, not round-level.

When paused:

- Competition timer stops.
- Players cannot edit.
- Players receive a blocking notification.
- Big screen displays `Competition Paused`.
- No round transition occurs.
- No preparation countdown progresses.
- No scoring progression occurs.
- Current state is preserved.

Resume:

```text
3 → 2 → 1 → Start
```

The countdown does not consume competition/round time.

## Finish

Competition becomes `FINISHED` when:

1. The final round of the final stage ends normally, or
2. The judge finishes the competition early.

Once finished:

- Competition cannot continue.
- Judge no longer has operational competition control.
- Final rankings/results become read-only.
- The judge becomes available for another competition.

## Cancel

Cancellation is exceptional.

It is used when the competition has become invalid due to a problem.

Cancellation:

- Does not preserve/release final results.
- Does not require final scoring.
- Stops competition execution.
- Marks competition as `CANCELLED`.
- Allows the administrator to create a new competition.

---

# 6. Competition Creation

Admin creates a competition using:

- Competition name
- Description
- Category (`U6`–`U20`)
- Participant Excel
- Competition question PDF

The server generates:

- Creation timestamp
- Competition identifiers
- Player identifiers
- Player credentials

No manual venue or organizer-name fields are required for the MVP.

Stages, rounds, preparation times, durations, and rules are predefined in code/configuration.

---

# 7. Participant Import

Participant Excel contains:

- Name
- Category
- Team

The system generates:

- Player ID
- Username
- Password
- Team records where applicable

Preferred workflow:

```text
Excel upload
    ↓
Validate entire file
    ↓
Create participants
    ↓
Create teams
    ↓
Create player accounts
    ↓
Generate credentials
    ↓
Export credentials
```

## Validation

Import is atomic.

If the file is invalid, no partial participant dataset is committed.

Examples:

- Missing name → reject entire file
- Invalid category → reject
- Invalid team size → reject
- Same person in conflicting teams → reject
- Exact duplicate rows → may be cleaned automatically, keeping one

The system may clean exact duplicates, but must never silently resolve contradictory data.

Error messages should identify the problem where possible:

```text
Missing name — row 17.
```

## Re-upload before publish

Admin may replace the participant Excel before publication.

The replacement must be fully validated first.

If valid:

- New dataset replaces old dataset.
- Teams are synchronized.
- Accounts are synchronized.
- Credentials are synchronized.

If invalid:

- Existing valid dataset remains untouched.

After publication:

- Participant re-upload is disabled.

Participant changes are treated as participation-identity changes, not casual profile edits.

---

# 8. Judge Assignment

Exactly **one judge** is assigned to each competition.

The judge:

- Must belong to the organization.
- Must be assigned before publication.
- May be selected from existing judges.
- May be created during competition setup.

A judge may be reused across competitions over time.

However:

> A judge assigned to an unfinished competition cannot simultaneously be assigned to another ongoing competition.

When the competition finishes or is cancelled, the judge becomes available again.

---

# 9. Question Management

The competition receives a competition-level question pack.

Current MVP input:

```text
Admin
  ↓
Upload predefined-format PDF
  ↓
Validate format
  ↓
Extract questions
  ↓
Classify/assign to predefined rounds
  ↓
Store competition question pack
  ↓
Persist reusable questions in Question Bank
```

## PDF requirements

The PDF format must be strictly predefined.

The MVP does **not** implement OCR.

If:

- Structure is wrong
- Parsing fails
- Extraction fails
- Classification fails

then the complete import is rejected.

No partial question set is committed.

The admin must correct the PDF or use the Question Bank.

## Question Bank

Successfully imported questions are also stored in a global Question Bank.

Future competitions may obtain questions from:

- New PDF import
- Existing Question Bank

The Question Bank is reusable content storage, not a full configurable competition engine.

---

# 10. Publish Readiness

A competition may be published only when:

- Competition information is valid.
- Participant Excel is valid.
- Participants exist.
- Teams are valid.
- Player accounts exist.
- Player credentials are generated.
- Question PDF import is complete.
- Questions are successfully extracted.
- Questions are assigned to predefined rounds.
- Fixed stages/rounds are valid.
- Exactly one judge is assigned.

If any requirement fails, publication is rejected.

---

# 11. Player Entry and Authentication

The player enters through the competition-specific link/QR.

There is no global competition-selection screen.

The entry link identifies the competition.

The player authenticates using the generated player credentials.

After login, the player enters the competition room directly.

The player sees:

- Competition
- Category
- Stages
- Current competition state

Players cannot participate unless they belong to the competition's participant dataset.

---

# 12. Player Runtime Flow

The normal player flow is:

```text
Competition Link / QR
        ↓
Login
        ↓
Competition Room
        ↓
Wait for Judge
        ↓
Stage Starts
        ↓
Preparation Room
        ↓
Countdown
        ↓
Round Active
        ↓
Solve
        ↓
Autosave continuously
        ↓
Manual Submit
        OR
Timer Expiration → Auto-submit
        ↓
Evaluation
        ↓
Score
        ↓
Waiting for next round
        ↓
Next Preparation
        ↓
Next Round
```

After manual submission:

- Puzzle becomes read-only.
- Duplicate submissions have no additional effect.
- Player sees that submission was accepted.
- Player waits for the next round.
- The player does not need to see the score immediately.

---

# 13. Gameplay and Autosave

Player moves do not directly affect scoring.

The gameplay path is:

```text
Player Move
    ↓
Server receives move/state
    ↓
Current grid state saved
    ↓
Player continues
```

There is no immediate correctness feedback.

The player can freely edit the puzzle.

The complete puzzle is evaluated only when submitted.

---

# 14. Submission Rules

Each player has at most one effective submission per puzzle/round.

## Manual submission

```text
Submit
 ↓
Lock puzzle
 ↓
Evaluate
 ↓
Calculate score
 ↓
Persist result
 ↓
Update ranking
```

## Timer expiration

At timer expiration:

```text
Round timer reaches zero
        ↓
Use latest saved state
        ↓
Auto-submit
        ↓
Evaluate
        ↓
Calculate score
        ↓
Persist result
        ↓
Update ranking
```

An empty/default grid produces zero points.

No penalty is applied for:

- Zero score
- No moves
- Never manually submitting
- Network disconnection

---

# 15. Disconnection and Reconnection

The server is authoritative for time.

Example:

```text
Round duration = 10 min

Player disconnects after 2 min
        ↓
Server timer continues
        ↓
Player reconnects after 2 min
        ↓
8 min remain
```

The latest saved grid is restored.

If the round ends while the player is disconnected:

```text
Round expires
    ↓
Latest saved state is auto-submitted
    ↓
Score is calculated
```

The player remains a valid participant.

There is no separate inactive/absent status in the MVP.

If the player reconnects after the round has ended, the client simply enters the current system state:

- Next preparation → preparation
- Next active round → current round
- Finished stage → stage results/state

---

# 16. Judge Controls

The judge controls competition execution.

## Stage control

- Start stage

Preparation countdown is automatic.

## Round control

During an active round the judge can:

- Pause the whole competition
- End the current round early

A round normally ends automatically when its timer expires.

## Competition control

The judge can:

- Pause competition
- Resume competition
- Finish competition early

## Big screen control

The judge controls the big screen.

The admin does not operate the big screen during active competition in this MVP.

---

# 17. Early Round End

If the judge ends an active round early:

```text
Judge ends round
       ↓
Stop round
       ↓
Auto-submit latest saved state for all players
       ↓
Evaluate submissions
       ↓
Calculate scores
       ↓
Update ranking
       ↓
Continue to next round/stage as appropriate
```

If the judge finishes the entire competition early during an active round:

```text
Judge Finish Competition
        ↓
End current round
        ↓
Auto-submit latest saved states
        ↓
Calculate scores
        ↓
Update ranking
        ↓
Finish competition
```

Final results are preserved.

---

# 18. Scoring

Scoring is automatic.

The judge does not calculate scores manually.

Scores are immutable in the MVP.

The scoring path is:

```text
Submission
    ↓
Evaluation
    ↓
Score
    ↓
Persist finalized result
```

The client rules are predefined.

For the documented competition rules:

## Individual

Each question:

- 100 points for a correct result
- 0 points for wrong/missing
- Early all-correct completion receives the defined time bonus

The client documentation specifies:

- 6 questions per individual round
- Standard Sudoku: 20 minutes
- Variant Sudoku: 30 minutes
- +3 points per minute early for all-correct completion

## Team

The client documentation defines team scoring using the agreed team formula.

The team scoring formula is fixed for the MVP and is not configurable through the admin UI.

---

# 19. Ranking

Ranking is calculated by the Ranking module.

The judge does not manually calculate or modify rankings.

## Ranking scope

Rankings are separate by stage.

```text
Individual Stage
    → Individual Player Ranking

Team Stage
    → Team Ranking
```

There is no combined individual + team ranking.

## Intermediate ranking

After every completed round:

```text
Completed round
    ↓
Finalize scores
    ↓
Update cumulative stage scores
    ↓
Generate provisional ranking
```

The ranking is therefore cumulative across completed rounds.

The final ranking of a stage is the latest provisional ranking when the stage finishes.

## Tie-breaking

Primary:

1. Higher final score

If scores are equal:

2. Faster completion/submission time

If the time is exactly equal to the second:

3. Alphabetical player name

Alphabetical comparison is case-insensitive.

The actual completion/submission timestamp must therefore be retained for ranking purposes.

---

# 20. Result Persistence

A finalized round result retains only the information needed by the MVP:

- Stage
- Round
- Player or Team
- Score
- Completion/submission timestamp

Do not retain long-term:

- Final grid
- Final answers
- Detailed move history
- Manual-vs-auto submission type

The grid is temporary runtime/scoring state.

Once scoring is finalized, the long-term result is the score + required ranking metadata.

---

# 21. Result Immutability

Once a score is finalized:

- It cannot be edited through the MVP.
- Ranking cannot be manually changed.
- No result correction UI exists.
- No dispute workflow exists.
- No audit/revision system exists.

If a problem is discovered, it is handled outside the system for this MVP.

---

# 22. Big Screen

The big screen is a separate display client.

It receives competition state and ranking information from the backend.

## Normal mode

The normal ranking cycle:

- Runs on a fixed 3-minute timer.
- Displays the full ranking.
- Uses pagination when necessary.
- Does not restart the timer when ranking data changes.

Ranking updates are therefore independent of the display timer.

## Individual projection

The judge may project a specific player at any time.

This:

- Suspends the normal ranking cycle.
- Shows the selected player's projection.
- Remains until the judge stops projection.

Stopping projection returns to normal ranking mode using the latest ranking.

## Team projection

During a team stage, the judge may project a complete team.

The big screen supports a split view for 2–6 team members.

---

# 23. Core Runtime Architecture

The backend is a **modular monolith**.

There is one deployable backend application.

Modules are separated logically and own their responsibilities, but they are not independently deployed services.

Recommended conceptual modules:

```text
Competition
Participant / Identity
Question
Stage / Round
Gameplay / Player State
Orchestrator
Scoring
Ranking
Big Screen
```

The exact folder/package naming may change during implementation.

---

# 24. Module Responsibilities

## Competition Module

Owns:

- Competition creation
- Competition metadata
- Competition lifecycle
- Publish state
- Pause/resume state
- Finish/cancel state

## Participant / Identity Module

Owns:

- Players
- Teams
- Player accounts
- Judge accounts
- Participant membership
- Competition-specific access

## Question Module

Owns:

- Question import
- Question validation
- Question Bank
- Competition question packs
- Question-to-round assignment

## Stage / Round Module

Owns:

- Stage definitions
- Round definitions
- Round timing
- Round state
- Preparation state

## Gameplay / Player State Module

Owns:

- Current puzzle/grid state
- Autosave
- Reconnection state
- Submission state
- Player runtime state

## Orchestrator

Owns the high-level execution sequence:

- Start stage
- Start preparation
- Start round
- End round
- Move to next round
- Move to next stage
- Finish competition

The Orchestrator coordinates modules; it should not become the owner of every domain rule.

## Scoring Module

Owns:

- Puzzle evaluation
- Score calculation
- Bonus calculation
- Finalized round score

## Ranking Module

Owns:

- Cumulative stage score
- Tie-breaking
- Provisional ranking
- Final ranking

## Big Screen Module

Owns:

- Big-screen state
- Ranking projection
- Player projection
- Team projection
- Display mode

---

# 25. Module Communication

Do not build an event-driven architecture everywhere.

Default communication:

```text
Module A
   ↓
Service/contract
   ↓
Module B
```

Use direct internal calls where the operation is synchronous and naturally coupled.

Events are appropriate only where they provide a clear benefit.

The most obvious event-like flow is player state/move recording:

```text
Player Move
    ↓
Gameplay
    ↓
Persist state
    ↓
Optional state/move event
```

Scoring should not react to every move.

Instead:

```text
Submission
    ↓
Scoring
    ↓
Ranking
```

This keeps the architecture understandable for a two-person junior development team.

---

# 26. Data Ownership Principle

Each major piece of state should have one clear owner.

Examples:

```text
Competition state      → Competition module
Player membership      → Participant module
Question data          → Question module
Round state            → Stage/Round module
Current grid           → Gameplay module
Final score            → Scoring module
Ranking                → Ranking module
Big-screen projection  → Big Screen module
```

Avoid multiple modules independently modifying the same domain state.

---

# 27. Minimum REST API

The following is the **minimum conceptual API**, not a requirement that these exact URL names must be used.

## Authentication

```http
POST /auth/player/login
POST /auth/judge/login
POST /auth/admin/login
```

## Admin — competition setup

```http
POST /competitions
GET  /competitions/:competitionId
POST /competitions/:competitionId/participants
POST /competitions/:competitionId/questions/import
POST /competitions/:competitionId/judge
POST /competitions/:competitionId/publish
```

## Admin — results

```http
GET /competitions/:competitionId/results
GET /competitions/:competitionId/stages/:stageId/ranking
```

## Judge — competition control

```http
POST /competitions/:competitionId/start-stage
POST /competitions/:competitionId/pause
POST /competitions/:competitionId/resume
POST /competitions/:competitionId/finish
POST /competitions/:competitionId/cancel
```

## Judge — round control

```http
POST /stages/:stageId/start
POST /rounds/:roundId/end
```

## Judge — big screen

```http
POST /competitions/:competitionId/display/player
POST /competitions/:competitionId/display/team
POST /competitions/:competitionId/display/normal
```

## Player

```http
GET  /competitions/:competitionId/me
GET  /rounds/:roundId/state
POST /rounds/:roundId/submit
```

Autosave/move state should primarily use the WebSocket connection rather than requiring a REST request for every move.

---

# 28. Minimum WebSocket Boundaries

WebSocket is primarily for real-time competition state.

Recommended conceptual channels:

```text
Player WebSocket
Judge WebSocket
Big Screen WebSocket
```

They may use one physical WebSocket endpoint with authenticated roles, or separate endpoints if that is simpler.

## Player → Server

Minimum messages:

```text
PLAYER_CONNECT
PLAYER_GRID_UPDATE
PLAYER_SUBMIT
```

`PLAYER_GRID_UPDATE`:

- Saves current puzzle state.
- Does not trigger scoring.
- Should be rate-limited.
- The previously agreed target is approximately no more than 2 grid updates/second per player.

## Server → Player

```text
COMPETITION_STATE
STAGE_STARTED
PREPARATION_STARTED
ROUND_STARTED
ROUND_STATE
COMPETITION_PAUSED
COMPETITION_RESUMED
ROUND_FINISHED
STAGE_FINISHED
SUBMISSION_ACCEPTED
COMPETITION_FINISHED
```

The exact event names are implementation details; the semantics are what matter.

## Judge → Server

The judge may send commands through REST or WebSocket.

Commands include:

```text
START_STAGE
END_ROUND
PAUSE_COMPETITION
RESUME_COMPETITION
FINISH_COMPETITION
CANCEL_COMPETITION
PROJECT_PLAYER
PROJECT_TEAM
RETURN_TO_NORMAL_DISPLAY
```

## Server → Judge

Judge receives authoritative:

```text
COMPETITION_STATE
STAGE_STATE
ROUND_STATE
PLAYER/TEAM COUNTS
RANKING_UPDATES
DISPLAY_STATE
```

## Server → Big Screen

The big screen receives:

```text
COMPETITION_STATE
ROUND_STATE
RANKING_UPDATE
STAGE_FINISHED
DISPLAY_MODE
PLAYER_PROJECTION
TEAM_PROJECTION
```

The big screen should not calculate ranking itself.

---

# 29. Server Authority

The server is authoritative for:

- Competition state
- Stage state
- Round state
- Timer
- Pause/resume
- Submission validity
- Scoring
- Ranking
- Participant eligibility

The client is responsible for:

- Rendering UI
- Capturing player input
- Showing countdowns based on server state
- Sending player actions
- Maintaining temporary local UI state

Never trust the client to decide:

- Whether a round is active
- How much time remains
- Whether submission is valid
- What score was earned
- What rank a player has

---

# 30. Timer Model

The server owns the round timer.

A client may display a countdown, but the client countdown is only a representation of server time.

Conceptually:

```text
roundStartTime
roundDuration
serverNow
```

Remaining time is derived from server-authoritative timestamps.

Do not implement the competition timer as:

```text
setInterval(() => time--, 1000)
```

as the source of truth.

The client may use such a mechanism purely for display.

---

# 31. Main System Flows

## Flow A — Competition Creation

```text
Admin
 ↓
Create competition
 ↓
Upload participants
 ↓
Validate
 ↓
Create players/teams/accounts
 ↓
Upload question PDF
 ↓
Parse/classify questions
 ↓
Create competition question pack
 ↓
Assign judge
 ↓
Check publish readiness
 ↓
Publish
```

## Flow B — Player Entry

```text
Competition QR/link
 ↓
Player login
 ↓
Validate competition membership
 ↓
Competition room
 ↓
Wait
```

## Flow C — Start Stage

```text
Judge starts stage
 ↓
Stage becomes active
 ↓
Preparation begins
 ↓
Countdown
 ↓
Round starts
```

## Flow D — Gameplay

```text
Round active
 ↓
Player edits grid
 ↓
Autosave
 ↓
Player continues
```

## Flow E — Submission

```text
Manual submit
       OR
Timer expires
       OR
Judge ends round
       ↓
Finalize player state
       ↓
Evaluate
       ↓
Calculate score
       ↓
Persist result
       ↓
Update ranking
       ↓
Notify clients
```

## Flow F — Round Transition

```text
Round finished
 ↓
All required scoring finalized
 ↓
Provisional ranking updated
 ↓
Next round?
 ├─ yes → preparation
 └─ no → stage finished
```

## Flow G — Stage Transition

```text
Stage finished
 ↓
Final stage ranking becomes immutable
 ↓
Next stage?
 ├─ yes → wait for judge
 └─ no → competition finished
```

## Flow H — Pause/Resume

```text
Judge pauses
 ↓
Competition PAUSED
 ↓
Timer stops
 ↓
Players blocked
 ↓
Big screen shows paused
 ↓
Judge resumes
 ↓
3 → 2 → 1 → Start
 ↓
Continue exact previous state
```

## Flow I — Disconnection

```text
Player disconnects
 ↓
Server continues competition
 ↓
Saved state remains
 ↓
Round continues
 ↓
Player reconnects
 ↓
Server sends current competition state
 ↓
Restore latest saved grid
```

---

# 32. Final Domain Model — Minimum Version

A minimal relational model should be conceptually close to:

```text
Competition
 ├── Category
 ├── Judge
 ├── Participants
 ├── Stages
 └── QuestionPack

Participant
 ├── Player
 └── Team

Player
 └── Account

Stage
 └── Rounds

Round
 ├── Questions
 └── PlayerRoundState

PlayerRoundState
 ├── CurrentGrid
 ├── SubmissionState
 └── RuntimeState

RoundResult
 ├── Player/Team
 ├── Score
 └── SubmissionTimestamp

StageRanking
 ├── Player/Team
 ├── CumulativeScore
 └── Ranking

Question
 └── QuestionBank
```

The exact table normalization should be decided during implementation based on the existing codebase and ORM/database approach.

---

# 33. Storage Responsibilities

## PostgreSQL

Use PostgreSQL for durable business data:

- Competitions
- Participants
- Teams
- Accounts
- Judges
- Stages
- Rounds
- Questions
- Question Bank
- Question packs
- Finalized submissions/results
- Scores
- Ranking data or ranking source data

## Redis

Use Redis for fast-changing runtime state where useful:

- Active competition state
- Active round state
- Server-side timing coordination
- Temporary player connection/runtime state
- Pub/sub or WebSocket coordination if required

Do not put durable final results only in Redis.

PostgreSQL remains the durable source for finalized competition data.

---

# 34. Frontend Structure

The frontend can remain one React application with role-based areas.

Conceptually:

```text
/src
  /features
    /auth
    /competition
    /player
    /judge
    /admin
    /big-screen
    /ranking
    /gameplay
```

Do not create separate frontend applications unless deployment requirements make that necessary.

Role-specific routes/views can share common components and state infrastructure.

---

# 35. Implementation Priorities

With only 15 days, implementation should be vertical rather than building every module in isolation.

The first goal is:

> A player can enter a real competition, a judge can start it, a round can run, the player can solve and submit, the system can score and rank, and the big screen can show the result.

Everything else supports this path.

---

# 36. Recommended 15-Day Implementation Sequence

## Days 1–2 — Foundation

Build:

- Backend project structure
- React project structure
- PostgreSQL connection
- Redis connection
- Basic database schema
- Authentication foundation
- Competition/participant/stage/round models
- Basic API structure
- WebSocket infrastructure

Deliverable:

```text
Backend + frontend run
Database connected
User can authenticate
Basic competition can be created
```

## Days 3–4 — Competition Setup

Build:

- Competition creation
- Participant Excel import
- Validation
- Player account generation
- Team creation
- Judge assignment
- Publish readiness
- Publish/lock

Deliverable:

```text
Admin creates a complete competition
and publishes it.
```

## Days 5–6 — Question System

Build:

- PDF validation
- Question extraction
- Question classification/round assignment
- Question Pack
- Question Bank persistence
- Round question retrieval

Deliverable:

```text
Published competition has usable questions.
```

If PDF parsing becomes a major blocker, use the predefined input format and implement the narrowest parser necessary for the actual client document rather than creating a general document-processing engine.

## Days 7–9 — Competition Runtime

Build:

- Stage state machine
- Preparation countdown
- Round timer
- Start/end round
- Pause/resume
- Finish competition
- Player entry
- Player runtime state
- Autosave
- WebSocket synchronization

Deliverable:

```text
A complete competition can run from start to finish.
```

## Days 10–11 — Scoring and Ranking

Build:

- Submission
- Auto-submit
- Puzzle evaluation
- Scoring
- Bonus
- Cumulative ranking
- Tie-breaks
- Final ranking
- Immutable results

Deliverable:

```text
A completed round produces correct ranking.
```

## Day 12 — Big Screen

Build:

- Ranking display
- Pagination
- 3-minute normal cycle
- Player projection
- Team projection
- Pause display
- Final results display

Deliverable:

```text
Competition can be presented publicly.
```

## Days 13–14 — Integration and Failure Cases

Test:

- Disconnect/reconnect
- Timer expiration
- Manual submission
- Duplicate submission
- Pause/resume
- Judge ending round
- Judge finishing competition
- Multiple players
- Team scoring
- Ranking tie-breaks
- Big-screen synchronization
- Invalid participant files
- Invalid question files

Fix integration bugs.

## Day 15 — Stabilization

No new features.

Do:

- End-to-end rehearsal
- Production deployment
- Environment configuration
- Database migration verification
- Logging
- Error handling
- Backup/checks
- Performance sanity test
- Competition-day runbook

---

# 37. Parallel Work Strategy for Two Developers

Do not split work strictly by backend/frontend for the entire 15 days.

Prefer vertical ownership.

Example:

## Developer A

Primary responsibility:

- Competition lifecycle
- Stage/round orchestrator
- Judge APIs
- WebSocket state
- Server timer

## Developer B

Primary responsibility:

- Player UI
- Gameplay/grid
- Submission UI
- Scoring/ranking
- Big screen

Both developers share:

- Database model decisions
- Authentication
- Integration
- Testing

The boundaries should be adjusted based on actual strengths.

The critical rule is:

> Integrate every day. Do not wait until Day 13 to discover that the two halves do not communicate.

---

# 38. Definition of Done for the MVP

The MVP is ready when the following complete scenario works reliably:

```text
Admin creates competition
        ↓
Imports participants
        ↓
Accounts generated
        ↓
Imports questions
        ↓
Assigns judge
        ↓
Publishes
        ↓
Players log in
        ↓
Judge starts stage
        ↓
Preparation countdown
        ↓
Round starts
        ↓
Players solve
        ↓
Grid autosaves
        ↓
Player submits / timer expires
        ↓
System evaluates
        ↓
Scores calculated
        ↓
Ranking updated
        ↓
Big screen updates
        ↓
Next round
        ↓
Next stage
        ↓
Final ranking
        ↓
Competition finishes
        ↓
Admin can view final results
```

If this works reliably, the core MVP works.

---

# 39. Engineering Rules for the Remaining 15 Days

## Rule 1 — Do not expand scope

If a feature is not necessary for the competition flow, defer it.

## Rule 2 — Server authority

The client never decides competition truth.

## Rule 3 — One source of truth

Each major domain state has one owner.

## Rule 4 — Simple module boundaries

Modules are logical boundaries, not microservices.

## Rule 5 — Events only where useful

Do not turn ordinary method calls into events without a reason.

## Rule 6 — Durable results belong in PostgreSQL

Redis is for runtime/fast state, not the only copy of final results.

## Rule 7 — Integrate continuously

Every day should produce an increasingly complete end-to-end flow.

## Rule 8 — Don't generalize prematurely

Hardcode the known competition rules for the MVP.

## Rule 9 — Preserve the critical path

If forced to choose between a fancy admin feature and reliable competition execution, protect competition execution.

## Rule 10 — Freeze architecture unless a real blocker appears

Do not redesign the architecture because a new idea sounds cleaner.

---

# 40. Final Architecture in One View

```text
                         ┌─────────────────────┐
                         │       ADMIN         │
                         │ Competition Setup   │
                         └──────────┬──────────┘
                                    │
                                    │ HTTP
                                    ▼
┌──────────────┐           ┌───────────────────────────────┐
│    PLAYER    │◄─────────►│                               │
│  React/TS    │   WS      │        MODULAR MONOLITH       │
└──────────────┘           │                               │
                           │ Competition                   │
┌──────────────┐           │ Participant / Identity        │
│    JUDGE     │◄─────────►│ Question                      │
│  React/TS    │   WS     │ Stage / Round                 │
└──────────────┘           │ Gameplay / Player State       │
                           │ Orchestrator                  │
┌──────────────┐           │ Scoring                       │
│ BIG SCREEN   │◄─────────►│ Ranking                       │
│  React/TS    │   WS     │ Big Screen                    │
└──────────────┘           │                               │
                           └──────────────┬────────────────┘
                                          │
                         ┌────────────────┴───────────────┐
                         │                                │
                         ▼                                ▼
                  ┌─────────────┐                  ┌─────────────┐
                  │ PostgreSQL  │                  │    Redis    │
                  │ Durable     │                  │ Runtime     │
                  │ Data        │                  │ State       │
                  └─────────────┘                  └─────────────┘
```

---

# 41. The Most Important Runtime Principle

The entire competition can be understood as two connected paths.

## Gameplay path

```text
MOVE
 ↓
SAVE STATE
 ↓
PLAYER CONTINUES
```

## Result path

```text
SUBMIT / TIMEOUT / JUDGE END
 ↓
EVALUATE
 ↓
SCORE
 ↓
RANK
 ↓
DISPLAY
```

And the Orchestrator controls when these paths are allowed to operate:

```text
WAITING
 ↓
PREPARATION
 ↓
ROUND ACTIVE
 ↓
ROUND FINISHED
 ↓
NEXT ROUND / STAGE FINISHED
 ↓
FINISHED
```

This is the core of the system.

Everything else is setup, administration, authentication, or presentation around this core.

---

# 42. Final Decision

**Stop expanding the planning phase. Start implementation now.**

The remaining unknowns should be treated as implementation details unless they directly change:

- the domain model,
- the competition state machine,
- scoring/ranking behavior,
- authentication/access,
- question input format,
- or a critical API/WebSocket contract.

The project should now move from:

```text
"What else should we decide?"
```

to:

```text
"Implement the agreed critical path."
```

The first implementation target is the smallest end-to-end vertical slice:

```text
Create Competition
      ↓
Create Participant
      ↓
Publish
      ↓
Player Login
      ↓
Judge Start
      ↓
Preparation
      ↓
Round Active
      ↓
Player Move + Autosave
      ↓
Submit
      ↓
Score
      ↓
Ranking
      ↓
Big Screen
```

Once this slice works, expand outward into participant import, PDF processing, pause/reconnect, team competition, projections, and administrative polish.
