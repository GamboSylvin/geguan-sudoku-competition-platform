# Sudoku Competition Platform — Unmade Decisions & Open Questions

**Document Status:** Open Questions Register  
**Date:** 2026-09-16  
**Purpose:** Collect every requirement question that has been raised but not yet answered, organized by topic for client/developer discussion. This is the companion to [`project-decision.md`](./project-decision.md), which records the decisions that *have* been settled.  
**Guidance:** All questions below must be resolved against the client before the domain model and architecture are finalized. The source documents explicitly warn against making architecture or technology decisions while requirements are still unstable.

---

## 1. Super Administrator

**Status note:** A working MVP scope for the Super Administrator now exists in `SUPER_ADMIN_REQUIREMENTS.md` (tenant overview, competition overview, tenant revocation). The questions below that remain open are captured there and in `project-decisions.md` SA-003.

| # | Question |
|---|---|
| SA-1 | What exactly can a Super Administrator do? *(Partially answered — MVP working scope in `SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-2 | What are the Super Administrator's responsibilities and permissions at platform level? *(Partially answered — see `SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-3 | Does the Super Administrator manage tenants (organizations), billing, platform configuration, or something else? *(Tenant overview/revocation: yes. Billing deferred — no payment system. Platform configuration: open.)* |
| SA-4 | Is there any tenant-level overlap between Super Admin and Organization Admin responsibilities? *(Still open — recorded in `SUPER_ADMIN_REQUIREMENTS.md` §7.)* |
| SA-5 | Should the Super Administrator be able to view competition results of a particular organization? *(Open.)* |
| SA-6 | Should the Super Administrator be able to access competition participants? *(Open — current lean: out of scope.)* |
| SA-7 | What exactly happens when a tenant is revoked/deleted? *(Open — deletion semantics.)* |
| SA-8 | Should Super Administrator access be read-only except for revocation, or can they edit tenant/competition info? *(Open.)* |

---

## 2. Organization / Tenant Model

| # | Question |
|---|---|
| ORG-1 | Can an organization have multiple administrators in the future (beyond the MVP one-admin model)? |
| ORG-2 | Is there a future need for organization-level permissions or role hierarchies? |
| ORG-3 | Can the Organization Admin change organization information? |
| ORG-4 | What organization information is required in the MVP? |
| ORG-5 | Can an organization be deactivated? |
| ORG-6 | What happens to an organization's competitions and data after deactivation? |
| ORG-7 | Is data retention limited (e.g., 1 year, 5 years)? If so, what is the retention policy? |
| ORG-8 | Are historical competitions searchable/filterable by the admin? |

---

## 3. Competition Model & Lifecycle

| # | Question |
|---|---|
| CMP-1 | What exactly constitutes a "competition" (top-level definition)? |
| CMP-2 | What exactly does "publish competition" mean? What does publishing generate? |
| CMP-3 | At what exact point does competition configuration become immutable/locked? |
| CMP-4 | Is publication sufficient to lock configuration? |
| CMP-5 | Does first participant/judge access lock configuration? |
| CMP-6 | Can a published but not-yet-started competition be edited? |
| CMP-7 | Can anything be modified after the competition starts? |
| CMP-8 | Are exceptional post-publication/post-start changes allowed? Under what conditions? |
| CMP-9 | Should configuration changes be audited and/or versioned? |
| CMP-10 | Can stages/rounds be reordered after configuration? |
| CMP-11 | Can stages/rounds be deleted after configuration? |
| CMP-12 | Can an empty stage/round be saved? |
| CMP-13 | Are there minimum/maximum stage or round counts? |
| CMP-14 | What happens to assigned questions when a round is changed or deleted? |

### 3.1 Stages & Rounds

| # | Question |
|---|---|
| SR-1 | What is a "stage" exactly? What is a "round" exactly? |
| SR-2 | What exactly defines the stage types **Individual**, **Team**, and **PK**? |
| SR-3 | Are these three stage types fixed for the MVP, or will new types be added? |
| SR-4 | Which round types are valid within each stage type? |
| SR-5 | What types of Sudoku rounds exist beyond the current categories? |
| SR-6 | What exactly constitutes "completion" for each round type? |
| SR-7 | Which competition transitions are explicitly Judge-controlled, and which are automatic? |

### 3.2 Category (Age Group) Placement

| # | Question |
|---|---|
| CAT-1 | Can one competition contain participants from multiple categories, or is each competition dedicated to a single category? |
| CAT-2 | Where does category belong in the domain model: competition, stage, round, participant, or another structure? |

---

## 4. Player Role

### 4.1 Competition Access & Identity

| # | Question |
|---|---|
| PL-1 | What exact mechanism does a player use to access a competition (QR code, direct link, code entry, other)? |
| PL-2 | Does the access action itself identify the player? |
| PL-3 | How is a player associated with a specific competition? |
| PL-4 | Is authentication required for players? Is a player account required? |
| PL-5 | How and when are participant credentials delivered to players? |
| PL-6 | What happens when an unauthorized or unknown player attempts access? |

### 4.2 Device & Session Behavior

| # | Question |
|---|---|
| PL-7 | Can a player use more than one device during a competition? |
| PL-8 | What happens if the player refreshes the page? |
| PL-9 | What happens if the player accidentally closes the page? |
| PL-10 | What happens if the player changes devices mid-competition? |
| PL-11 | Is player state recoverable across devices/sessions? |

### 4.3 Network Failure

| # | Question |
|---|---|
| PL-12 | What happens if a player's network connection is temporarily lost? |
| PL-13 | How is player state recovered after reconnection? |
| PL-14 | What happens if the connection is lost near the exact moment of submission or time expiry? |

### 4.4 Round Behavior & UI

| # | Question |
|---|---|
| PL-15 | What exactly is shown on the pre-stage / pre-competition waiting screen? |
| PL-16 | What exactly is shown on the round waiting screen (rules, countdown, other info)? |
| PL-17 | Can a player review or modify the board immediately before submitting? |
| PL-18 | What is displayed after manual submission? |
| PL-19 | Can the player continue interacting after submission? |
| PL-20 | Are there different submission rules for different round types? |
| PL-21 | What feedback (if any) is shown for correct/incorrect entries? |
| PL-22 | What does the player see after the final round / final stage? |
| PL-23 | Are final rankings/results immediately visible to players, or only via the Big Screen? |

### 4.5 Team Rounds

| # | Question |
|---|---|
| PL-24 | What are the exact team-round rules? |
| PL-25 | How are puzzles assigned and rotated among team members? |
| PL-26 | Can teammates communicate through the platform? |
| PL-27 | How is team progress represented? |
| PL-28 | How is team completion determined? |
| PL-29 | How are team results and rankings calculated? |

---

## 5. Judge Role

### 5.1 Access & Authentication

| # | Question |
|---|---|
| JD-1 | Who assigns judges to competitions (confirmed: Organization Admin creates/assigns — but what info is required)? |
| JD-2 | What information is required to create a Judge? |
| JD-3 | Is a Judge an organization-level entity before being assigned to a competition? |
| JD-4 | Can one Judge serve multiple competitions? |
| JD-5 | Can multiple Judges serve one competition? |
| JD-6 | What exact Judge authentication mechanism is required? |
| JD-7 | Who distributes Judge credentials, and how? |
| JD-8 | What exactly does the competition-specific access link establish? |
| JD-9 | What happens when an unauthorized Judge attempts access? |
| JD-10 | Can a Judge be removed from a competition before it starts? |
| JD-11 | What happens if a Judge is removed during an active competition? |

### 5.2 Competition Control

| # | Question |
|---|---|
| JD-12 | What exactly does "start" mean at the stage level? |
| JD-13 | Which levels can the Judge manually start (stage, round, competition)? |
| JD-14 | When is a manual round start allowed? |
| JD-15 | What does pause affect — all participants? Does the timer stop? |
| JD-16 | Can the Judge resume after a pause, and how? |
| JD-17 | Does participant state remain unchanged while paused? |
| JD-18 | What exactly does "premature end" mean — which levels can be ended? |
| JD-19 | What happens to unfinished players when a round ends early? Does it auto-submit their current state? |
| JD-20 | Can a premature end be reversed? |

### 5.3 Monitoring & Display

| # | Question |
|---|---|
| JD-21 | Which participant states are operationally useful for the Judge (connected/disconnected, submitted, elapsed time, progress, other)? |
| JD-22 | Does the Judge need elapsed time per participant? |
| JD-23 | Does the Judge need per-participant progress? |
| JD-24 | What should the Judge do when a participant disconnects? |
| JD-25 | Is team progress monitoring operationally different from individual monitoring? |
| JD-26 | What decision or action does the Judge take differently because live ranking is visible? |
| JD-27 | When should ranking be visible to the Judge? |

### 5.4 Results & Publication

| # | Question |
|---|---|
| JD-28 | What exactly does "publish results" mean for the Judge — display only, finalize/lock, official release, export, or another action? |
| JD-29 | Does publishing finalize/lock the results? |
| JD-30 | Is a human result-confirmation step necessary, and under what conditions (e.g., exceptional cases, official completion)? |
| JD-31 | At what exact moments should rankings/results be made visible on the Big Screen? |

### 5.5 Big Screen

| # | Question |
|---|---|
| JD-32 | Which Big Screen display modes are required (leaderboard, individual board, team boards, PK boards, stage/final results)? |
| JD-33 | Who can control the Big Screen: Judge only, Management only, or both? |
| JD-34 | If both roles can control it, who has priority, and is "later operation wins" the required behavior? |
| JD-35 | Should Big Screen display actions be recorded/auditable? |
| JD-36 | Can the displayed target be changed at any time? |
| JD-37 | How does the Big Screen authenticate? Does it receive a dedicated token/session? |
| JD-38 | Can Big Screen access expire or be revoked? |
| JD-39 | Can multiple Big Screens display one competition simultaneously? |
| JD-40 | Who initializes Big Screen access? Does the Admin facilitate setup even without control rights? |

---

## 6. Organization Admin — Open Functional Questions

### 6.1 Participants / Teams

| # | Question |
|---|---|
| OA-1 | What exact participant fields are required in the Excel import? |
| OA-2 | How are invalid or duplicate rows handled during import? |
| OA-3 | Can participants be added individually after import? |
| OA-4 | Can participants be edited/removed after import? |
| OA-5 | What exactly identifies a team in the data? |
| OA-6 | What happens when team data is inconsistent? |
| OA-7 | Can a participant belong to multiple teams? |
| OA-8 | Can teams change after import? |

### 6.2 Question Bank / PDF

| # | Question |
|---|---|
| OA-9 | What exactly is a "question" in the question bank — only the puzzle, or puzzle + solution + metadata + source file? |
| OA-10 | How is question compatibility with a round type defined? |
| OA-11 | What happens when a PDF contains multiple puzzles? |
| OA-12 | What extraction accuracy is required from PDFs? |
| OA-13 | What happens when PDF extraction fails? |
| OA-14 | Must the original PDF always be preserved? |
| OA-15 | Can extracted questions be edited? |
| OA-16 | Can questions be deleted/archived? |
| OA-17 | Can the same question be reused across competitions/rounds? |
| OA-18 | Is question versioning required? |

### 6.3 Competition Reuse

| # | Question |
|---|---|
| OA-19 | What does "reuse a previous configuration" mean exactly? |
| OA-20 | Should reuse copy stages/rounds only, or also question assignments and rules? |
| OA-21 | Should reuse exclude participants, judges, credentials, results, and historical data? |
| OA-22 | Is full competition duplication worth including in the MVP after all? |

### 6.4 Analytics & Results

| # | Question |
|---|---|
| OA-23 | What exact statistics are required post-competition? |
| OA-24 | Which statistics are required at round level, stage level, and overall? |
| OA-25 | What is the exact team scoring formula? |
| OA-26 | Which reports must be exportable, and in which formats? |
| OA-27 | What fields must the results export contain? |

### 6.5 Live Admin Access

| # | Question |
|---|---|
| OA-28 | Should the Organization Admin see live competition data? |
| OA-29 | What operational decision would that live access enable? |
| OA-30 | If enabled, should Admin live access be read-only? |
| OA-31 | Should the Admin see less live information than the Judge? |

### 6.6 Competition Access Model

| # | Question |
|---|---|
| OA-32 | Is there one competition link, or separate Player/Judge/Big Screen access? |
| OA-33 | Should QR codes be generated automatically? |
| OA-34 | What exactly does the access mechanism establish (identity, authorization, context)? |

---

## 7. PK (Head-to-Head) Rounds

| # | Question |
|---|---|
| PK-1 | Is PK always random pairing? |
| PK-2 | Random among whom: all eligible participants, a category, a stage, or another scope? |
| PK-3 | Are there pairing eligibility constraints? |
| PK-4 | What happens with an odd number of eligible participants? |
| PK-5 | Can a participant appear in multiple PK rounds? |
| PK-6 | Can pairings be regenerated? |
| PK-7 | Who or what determines the final pairing? |

---

## 8. Scoring & Ranking Rules

| # | Question |
|---|---|
| SC-1 | How exactly are rankings calculated? |
| SC-2 | What exactly constitutes a completed/correct Sudoku for each round type (full completion, partial credit, timing tie-breaks)? |
| SC-3 | How is scoring affected by early submission vs. time expiry? |
| SC-4 | What is the exact team scoring formula? |
| SC-5 | How are ties resolved in rankings? |
| SC-6 | Are round scores aggregated to stage scores and overall scores, and how? |
| SC-7 | What is the effect of incorrect entries on scoring, if any? |

---

## 9. Reliability & Failure Scenarios

| # | Question |
|---|---|
| FL-1 | What happens when a participant loses network connectivity (state recovery, resume behavior)? |
| FL-2 | What happens when a Judge loses network connectivity? |
| FL-3 | What happens if the server fails during an active competition? |
| FL-4 | What is the expected recovery procedure after server failure (resume, restart round, etc.)? |
| FL-5 | What are the exact anti-cheating requirements inside a physical venue, if any? |
| FL-6 | How is the round timer kept consistent across server, judge, and player views? |

---

## 10. Data & Persistence Questions

| # | Question |
|---|---|
| DP-1 | What competition information must be persisted (configuration, questions, participants, submissions, per-move state, results, audit trail)? |
| DP-2 | What information must be updated/displayed in real time? |
| DP-3 | What granularity of player state must be saved (every move, final state, snapshot + delta)? |
| DP-4 | How long must competition data be retained? |
| DP-5 | Are configuration changes audited/versioned? |
| DP-6 | What exactly does the system do with team progress data during live monitoring? |

---

## 11. Architecture, Technology & Infrastructure (Deferred)

**Status: Deliberately deferred — must not be decided prematurely. The source documents state that these must be *derived from* the requirements rather than selected in advance.**

| # | Open Decision |
|---|---|
| ARCH-1 | Overall system architecture (monolith, modular monolith, microservices, event-driven, etc.). |
| ARCH-2 | Backend technology / language / framework. |
| ARCH-3 | Frontend technology / framework. |
| ARCH-4 | Database technology and data modeling. |
| ARCH-5 | Real-time communication technology (WebSockets, SSE, polling, other). |
| ARCH-6 | Caching / state-management technology (e.g., Redis). |
| ARCH-7 | Authentication and authorization implementation. |
| ARCH-8 | Deployment architecture. |
| ARCH-9 | Infrastructure (cloud provider, hosting, scaling). |
| ARCH-10 | External dependencies and libraries. |
| ARCH-11 | PDF/OCR/extraction technology for question import. |
| ARCH-12 | Dynamic rules engine / plugin architecture (if the client's "Steam-like" upload concept is ever accepted). |
| ARCH-13 | Configuration distribution architecture (client's "unified distribution engine" — not accepted yet). |
| ARCH-14 | API design. |
| ARCH-15 | The detailed competition domain model. |

**Note on the client proposal:** the client's "unified configuration distribution engine" and "dynamic/marketplace-style logic upload" concepts should not be accepted as architecture decisions until the underlying business variation is understood.

---

## 12. Priority Open Questions (Suggested Discussion Order)

The following questions most directly block the domain model and should be resolved first:

1. What exactly defines the stage types Individual / Team / PK, and which round types are valid in each?
2. Where does category (age group) belong, and can one competition mix categories?
3. At what point does competition configuration lock (publication, first access, start, stage/round start)?
4. What exactly does "publish results" mean, and does it finalize/lock results?
5. What is the exact player competition-access and authentication mechanism?
6. Who controls the Big Screen (Judge only vs. Judge + Admin), and what is the priority model?
7. What is the exact team scoring formula and team-round completion rule?
8. What is the exact scoring/ranking calculation model (partial credit, tie-breaks, timing effects)?
9. What are the requirements for network/server failure recovery during a live competition?
10. What exactly must be persisted and what must be real-time, at what granularity?
