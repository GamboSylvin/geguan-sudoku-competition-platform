# Sudoku Competition Platform — Project Decisions

**Document Status:** Working Decisions Register  
**Date:** 2026-09-16  
**Purpose:** Consolidate every requirement decision that has been settled to date, across product vision, scope, roles, functional behavior, non-functional characteristics, architecture, and database. Open items are intentionally kept out of this document and live in [`unmade-decision.md`](./unmade-decision.md).  
**Source Documents:**
- `PROJECT_ANALYSIS_UPDATED.md` — overall project analysis (confirmed items listed in §6)
- `PLAYER_REQUIREMENTS.md` — player role requirements (working draft)
- `ORGANIZATION_ADMIN_REQUIREMENTS.md` — organization admin requirements (working draft, MVP scope)
- `SUPER_ADMIN_REQUIREMENTS.md` — super administrator requirements (working draft, MVP scope)
- `JUDGE_REQUIREMENTS_PROPOSAL.md` — judge role proposal (explicitly **not** final)

---

## 1. Decision Status Legend

| Status | Meaning |
|---|---|
| **Confirmed** | Explicitly settled in a source document; treated as a binding requirement. |
| **Working Position** | Settled for the current MVP drafting phase, but explicitly flagged as revisable during requirements validation with client/developers. |
| **Proposed** | Put forward in a source document (primarily the Judge proposal) but not yet accepted as final. |
| **Deferred / Not Decided** | Recorded as intentionally postponed; decision must be derived from requirements later. |

---

## 2. Project Overview

### 2.1 Product Vision

- The product is a **digital platform for organizing and conducting Sudoku competitions**, operated as a **multi-tenant Software-as-a-Service (SaaS)** offering. *(Confirmed)*
- Each organization using the platform is a **tenant**. *(Confirmed)*
- The platform is **reusable across many organizations**, not built for a single competition or single organization. *(Confirmed)*
- The objective is **not to provide an online Sudoku game**. The objective is to **digitalize the operational process of running a Sudoku competition**. *(Confirmed)*

### 2.2 Problem Being Solved

- A large share of the current Sudoku competition process in Chinese schools and organizations is **paper-based**, which causes:
  - Printing and preparing large volumes of competition materials.
  - Physical distribution and collection of answer sheets.
  - Managing physical competition spaces.
  - Manual correction of answer sheets.
  - Manual ranking calculation and verification.
  - Risk of human error in correction and ranking.
  - Difficulty supervising competitions and getting a real-time view of progress.
- These problems scale with participant count. *(Confirmed context)*

### 2.3 Proposed Solution Scope

The platform should **digitize and automate**, wherever appropriate:
- Competition configuration.
- Distribution of Sudoku problems.
- Collection of participants' answers.
- Automatic answer validation.
- Result calculation.
- Ranking calculation.
- Real-time competition monitoring.
- Real-time ranking display.
- Post-competition access to competition data. *(Confirmed)*

### 2.4 Business Objectives

- **Reduce material costs** — fewer printed materials and physical resources.
- **Reduce organizational effort** — faster and easier preparation, execution, and result processing.
- **Reduce correction time** — automatic validation and calculation.
- **Reduce human error** — software-based validation and calculation.
- **Improve real-time visibility** — judges/organizers can observe live competition state and display information in real time.
- **Provide a reusable platform** — multi-tenant SaaS usable by many organizations. *(Confirmed)*

---

## 3. Operating Model & Environment Decisions

| ID | Decision | Status |
|---|---|---|
| ENV-001 | The platform operates as a **multi-tenant SaaS**; each organization is a tenant. | Confirmed |
| ENV-002 | **Tenant data isolation is a fundamental requirement.** Each tenant has isolated access to its own users, competitions, participants, competition data, results, and other tenant-owned resources. A tenant must never access another tenant's data. | Confirmed |
| ENV-003 | The **initial competition environment is a supervised physical venue** (classroom or competition venue). | Confirmed |
| ENV-004 | Participants use **organization-provided computers and/or tablets**. | Confirmed |
| ENV-005 | The initial version does **not** solve remote-competition security problems. Out of scope: camera-based supervision, environmental monitoring, camera-based identity verification, remote-proctoring mechanisms, and other anti-cheating mechanisms for unsupervised home environments. | Confirmed |
| ENV-006 | The **backend/server is authoritative for competition state and important operations.** This is a conceptual principle, **not** an architecture decision. | Working Position |

---

## 4. Actor / Role Decisions

### 4.1 Actor Set

- The system identifies **four primary actors**: Super Administrator, Organization Administrator, Judge, and Player. *(Confirmed)*

### 4.2 Super Administrator

| ID | Decision | Status |
|---|---|---|
| SA-001 | Represents the **owner/operator of the SaaS platform**. | Confirmed |
| SA-002 | Operates at the **platform level**, not within a single tenant. | Confirmed |
| SA-003 | Exact responsibilities and permissions are **not yet fully defined**; a working MVP scope now exists in `SUPER_ADMIN_REQUIREMENTS.md` (tenant overview, competition overview, tenant revocation). Remaining details (participant/result access, billing, deletion semantics) stay open. | Working Position |

### 4.3 Organization Administrator

| ID | Decision | Status |
|---|---|---|
| OA-001 | An Organization Admin represents **one organization (tenant)**. | Confirmed |
| OA-002 | **MVP: one tenant has exactly one Organization Admin.** Multiple admins and admin invitation/delegation are out of scope for MVP. | Working Position |
| OA-003 | Operates only within the scope of their own organization. | Confirmed |
| OA-004 | Responsible for **competition preparation and post-competition analysis**; a large independent organization-management module is not currently required. | Working Position |
| OA-005 | Can **create multiple competitions** for the organization. | Confirmed |
| OA-006 | Can configure competition **name, description**, and other basic information. | Confirmed |
| OA-007 | The **Organization Admin has no control rights over the Big Screen**; Big Screen control is reserved for the Judge. | Working Position (differs from client proposal — see §10) |
| OA-008 | Is **not** the routine live competition operator; normal live control belongs to the Judge. The Admin should not routinely perform round-by-round control, player live control, Big Screen control, routine puzzle rotation, or routine scoring/ranking calculation. | Working Position |
| OA-009 | Can **view and export post-competition results and analytics**; does not manually calculate rankings. | Confirmed / Working Position |
| OA-010 | Can **create and remove judges** and **assign judges to competitions**. | Working Position |
| OA-011 | Can **import participants** (envisioned via Excel). | Working Position |
| OA-012 | Has independent management access to the **organization-level question bank** (currently the only role with such access). | Working Position |
| OA-013 | Live access to competition data during the event is **undecided** (see open questions). | Open |

### 4.4 Judge

| ID | Decision | Status |
|---|---|---|
| J-001 | The Judge is the **operator and supervisor of a specific live competition**, not the engine that calculates/manages every internal operation. | Confirmed (guiding principle) |
| J-002 | The Judge **starts the competition/stage**; the Judge starts the competition state, not an individual signal to each player. | Proposed |
| J-003 | **Rounds normally progress automatically** after a stage starts (round waiting → countdown → round start → round end → next round). | Proposed |
| J-004 | The Judge can **manually start a round** as an **exception path**, not the normal workflow. | Proposed |
| J-005 | The Judge can **pause** the competition when an operational problem requires it. Exact pause semantics are open. | Proposed |
| J-006 | The Judge can **prematurely end** a round/stage (e.g., all participants submitted). Exact behavior for unfinished players is open. | Proposed |
| J-007 | The Judge can **monitor participants in real time** (connected/disconnected, submitted/not submitted, possibly elapsed time/progress). Connectivity has clear operational purpose. | Proposed |
| J-008 | The Judge **controls what appears on the public display (Big Screen)**: leaderboard/ranking, individual player board, team boards, PK/head-to-head boards, stage/final results. | Proposed / Client-derived |
| J-009 | The Judge may view **real-time rankings**, but only if there is a genuine operational reason; the Judge never calculates or manually modifies rankings. | Open / Under discussion |
| J-010 | The Judge is **not responsible** for automatic team puzzle rotation, puzzle assignment/replenishment, or team scoring — these are system responsibilities. | Proposed |
| J-011 | Whether the Judge and Management can **both** control the Big Screen, and priority rules, is **open** (client design suggests both). | Open |

### 4.5 Player

| ID | Decision | Status |
|---|---|---|
| PL-001 | The Player is a competition participant. The Player is **not** responsible for operating the competition, controlling progression, calculating rankings, or managing configuration. | Confirmed |
| PL-002 | The Player **accesses the appropriate competition** through some entry point (mechanism open). | Confirmed (requirement), Open (mechanism) |
| PL-003 | The Player **waits for the competition/stage to begin**; the Player does not start the stage themselves. | Confirmed |
| PL-004 | The Player **enters a round waiting state** before each round, seeing **round rules** and a **countdown**. | Confirmed |
| PL-005 | The Player **makes Sudoku moves during the active round** and may continue modifying the current solution until submission or time expiry. | Confirmed |
| PL-006 | **Player moves are automatically saved** during the active round. | Confirmed |
| PL-007 | The Player can **submit early** when finished before the time limit. | Confirmed |
| PL-008 | If the time limit expires first, the system **automatically submits the player's current saved state**, regardless of completeness. | Confirmed |
| PL-009 | **Repeated submission does not change the player's result** (idempotency). | Confirmed |
| PL-010 | After a round ends, the Player proceeds to the **next round waiting state**; after all rounds of a stage, the Player **waits for the next stage**. Progression is sequential. | Confirmed |
| PL-011 | **Team-based rounds** are a recognized possible category, but detailed interaction rules are not defined. | Category identified; details open |

---

## 5. Functional Decisions — Competition Structure & Configuration

### 5.1 Competition Structure

| ID | Decision | Status |
|---|---|---|
| CS-001 | A competition consists of **one or more stages**; each stage consists of **one or more rounds**. | Confirmed |
| CS-002 | Structure model: `Competition → Stage(s) → Round(s)`. | Confirmed |
| CS-003 | **Stage types** currently identified: **Individual, Team, PK**. These may be refined during requirements analysis. | Working Position |
| CS-004 | No fixed MVP number of stages/rounds; the admin adds stages and rounds until the desired structure is defined. | Working Position |
| CS-005 | Per-round configuration includes at minimum: **round name, round duration, round type information, questions assigned to the round**, plus category-related configuration pending clarification. | Working Position |
| CS-006 | **Competition-level overall duration is not manually configured**; total duration emerges from configured stages, rounds, round durations, progression, and judge-controlled operations. A competition-level duration should be introduced only if a concrete business requirement exists. | Working Position |
| CS-007 | The admin can **edit a competition while it is still being prepared**. | Confirmed |
| CS-008 | The intended general rule is **no modification after the competition has started**, subject to future definition of exceptional operations. | Working Position |
| CS-009 | **Full competition duplication is not required for MVP** (may be considered later). | Working Position |

### 5.2 Question Bank & PDF Import

| ID | Decision | Status |
|---|---|---|
| QB-001 | The organization has a **reusable question bank** available across competitions. | Confirmed |
| QB-002 | When configuring a round, the admin **selects questions from the question bank**; the system presents/filters questions relevant or compatible with the configured round type. Exact filtering rules are open. | Working Position |
| QB-003 | The admin may **import a PDF directly** while configuring a round; the system extracts question information and assigns questions to the round. | Working Position |
| QB-004 | **Questions extracted from an imported PDF are preserved in the question bank** for reuse. | Working Position |
| QB-005 | The admin can **manage the question bank independently of any competition**; exact operations (create/edit/delete/archive/version) are open. | Working Position |

### 5.3 Participants & Teams

| ID | Decision | Status |
|---|---|---|
| PT-001 | The admin can **import competition participants**, currently envisioned via an **Excel file**. Data may include participant information, origin/source, age category, team information, and other competition-specific information. | Working Position |
| PT-002 | Imported participants are **associated with the specific competition** being prepared. | Working Position |
| PT-003 | The admin does **not** manually form teams as a routine import operation. **Team information is contained in the imported participant data**, and the **system derives/creates teams and groupings** from it. | Working Position |
| PT-004 | The system should provide **competition-specific participant access credentials** (potentially OTP, one-time credential, or account credential). Exact mechanism is undecided. | Working Position |
| PT-005 | The category (age group) placement is **unresolved**: whether a competition is single-category or multi-category, and where category belongs in the domain model. | Open |

### 5.4 Judge Management (by Organization Admin)

| ID | Decision | Status |
|---|---|---|
| JM-001 | The admin can **create/register judges** for the organization. | Working Position |
| JM-002 | The admin can **remove judges** from the organization; implications for judges already assigned to active/future competitions are open. | Working Position |
| JM-003 | The admin can **assign a judge to a particular competition**; a judge's authority is **competition-specific**. | Working Position |
| JM-004 | The system should provide assigned judges with **competition-specific access credentials** (potentially OTP or other one-time credential). Exact mechanism undecided. | Working Position |

### 5.5 Competition Access / Entry Links

| ID | Decision | Status |
|---|---|---|
| CA-001 | After preparation, the admin may generate/obtain access information (a **link and/or QR code** is envisioned) allowing authorized players and judges to enter the competition. | Working Position |
| CA-002 | The access mechanism should establish the **appropriate competition context** without navigating through unrelated competitions. Exact authentication/authorization is undecided. | Working Position |
| CA-003 | A **separate mechanism for the Big Screen** may be required (a competition-specific link/token was previously considered). Exact mechanism unresolved. | Open |

### 5.6 Post-Competition Results & Analytics

| ID | Decision | Status |
|---|---|---|
| RA-001 | After a competition, the admin can **access its results**. | Confirmed |
| RA-002 | The admin can **view system-generated rankings**; the admin does not manually calculate rankings. | Confirmed |
| RA-003 | The admin can access **competition reports/statistics**; exact analytics intentionally not finalized. Possible dimensions: overall results, stage-level results, round-level results, individual results, team scoring, rankings, other basic statistics. | Working Position |
| RA-004 | The admin can access **team scoring information**; the exact team scoring formula must be defined separately. | Working Position |
| RA-005 | The admin can **export competition results**; exact formats and fields are open. | Working Position |

### 5.7 Competition Reuse

| ID | Decision | Status |
|---|---|---|
| CR-001 | The admin should ideally **reuse a previous competition configuration** for a new competition. Exact mechanism (duplicate, template, copy selected config) is undefined. | Working Position |
| CR-002 | **Full competition duplication is not required for MVP** (may be considered later). | Working Position |

---

## 6. Functional Decisions — Competition Execution (System-Side Automation)

The following automatic behaviors are settled as **system responsibilities** (not manual, not judge-performed):

| ID | Decision | Status |
|---|---|---|
| EX-001 | **Automatic answer validation** — the system determines whether submitted Sudoku answers are correct using configured puzzle solutions. | Confirmed |
| EX-002 | **Automatic score calculation** — the system calculates scores according to competition rules, including team scoring where applicable. | Confirmed |
| EX-003 | **Automatic result calculation** — the system calculates and saves results from submissions, correctness, timing, and configured scoring rules. | Confirmed |
| EX-004 | **Automatic ranking calculation** — the system calculates rankings according to configured rules. | Confirmed |
| EX-005 | The **Judge does not** determine or manually calculate participant rankings. The Judge controls when and how resulting rankings are displayed. | Confirmed |
| EX-006 | **Automatic team puzzle rotation** during team rounds is a system responsibility. | Proposed |
| EX-007 | **Automatic puzzle assignment/replenishment** for team rounds is a system responsibility. | Proposed |
| EX-008 | **Automatic team scoring** is a system responsibility. | Proposed |
| EX-009 | **Automatic saving of player moves** during an active round is a confirmed behavior; the persistence mechanism is not yet decided. | Confirmed behavior, open mechanism |

---

## 7. Non-Functional System Characteristics

The following system characteristics have emerged from the problem description and are treated as **confirmed characteristics** (not technology decisions):

| ID | Characteristic | Description | Status |
|---|---|---|---|
| NF-001 | **Multi-tenant** | Multiple independent organizations use the same platform. | Confirmed |
| NF-002 | **Real-time** | Competition state, participant progress, and rankings may need to be updated and displayed in real time. | Confirmed |
| NF-003 | **Interactive** | Multiple users interact with the same competition simultaneously. | Confirmed |
| NF-004 | **State-driven** | A competition progresses through defined stages and rounds; the system coordinates transitions. | Confirmed |
| NF-005 | **Data isolation** | Tenant data must be strongly isolated. | Confirmed |
| NF-006 | **Automated processing** | The system automatically validates answers and calculates results. | Confirmed |
| NF-007 | **Event-oriented behavior** | Actions by participants/judges cause changes that must propagate to other users. Identified as a characteristic; **no architectural decision made yet**. | Identified / Open |
| NF-008 | **Automatic player state persistence** | Player moves auto-save during active rounds. Mechanism not decided. | Confirmed behavior / Open mechanism |
| NF-009 | **Timed round execution** | Rounds have a time limit; early manual submission and automatic submission at expiry are both supported; repeated submission does not alter results. | Confirmed |
| NF-010 | **Sequential round/stage flow** | Player participation proceeds sequentially through round waiting, execution, and next-round waiting; exact lifecycle and transition authority are open at the domain level. | Confirmed behavior / Open lifecycle |

---

## 8. Architecture Decisions

**Status: No architecture decisions have been made.**

- The following are explicitly **not yet decided**: system architecture, backend technology, frontend technology, database technology, real-time communication technology, caching/state-management technology, authentication and authorization implementation, deployment architecture, infrastructure, external dependencies and libraries, and the detailed competition domain model. *(Confirmed as undecided)*
- These decisions **must be derived from the requirements and system characteristics**, not selected in advance. *(Confirmed as a process rule)*
- The client's proposed **"unified configuration distribution engine"** and **"dynamic/marketplace-style logic (Steam-like) upload"** concepts are **not accepted as architecture decisions** until the actual business variation is understood. *(Working Position)*
- The **"backend is authoritative"** principle (§3, ENV-006) is a conceptual principle, not yet an architecture/event-model/synchronization decision. *(Working Position)*

## 9. Database Decisions

**Status: No database decisions have been made.**

- No database technology has been selected.
- The only settled constraints are **functional/data requirements** that any database design must satisfy:
  - Strong **tenant data isolation** (multi-tenant boundaries).
  - Persistence of competition structure (stages, rounds), questions, participants, teams, judges, credentials, submissions, results, rankings, and post-competition analytics data (the precise set of what must be persisted is still being finalized).
  - Support for **automatic per-move saving** of player state during active rounds (mechanism/format open).
  - Post-competition data access, reporting, and export.
- Questions such as retention policy, schema shape, versioning of configuration, and auditability of configuration changes remain open (see `unmade-decision.md`).

---

## 10. Client Proposal vs. Current Vision — Recorded Differences

These are open points of reconciliation; the current project vision diverges from the client proposal as follows:

| Topic | Client Proposal | Current Project Vision | Status |
|---|---|---|---|
| Big Screen control | Management/Admin may potentially control the Big Screen. | Only the Judge controls the Big Screen. | Open — needs client validation |
| Group/team formation | Includes grouping/management. | Imported participant data contains team info; system derives teams; admin does not manually form teams routinely. | Working Position |
| Competition time | Includes a competition time field. | Overall duration is not directly configured; round durations contribute to total duration. | Working Position |
| Configuration distribution | Emphasizes a unified configuration distribution engine. | Backend is authoritative and central; distribution concept not accepted as architecture yet. | Working Position |
| Dynamic logic upload | "Steam-like" logic/template upload concept. | Not accepted as an architecture decision until the actual business variation is understood. | Working Position |

---

## 11. Explicitly Deferred Decisions

The following are **deliberately deferred** to later project phases and must **not** be prematurely decided:

- Authentication technology and OTP implementation.
- Link/QR code implementation.
- Big Screen authentication mechanism.
- Backend architecture.
- WebSocket/event architecture.
- Database structure.
- Redis / caching / infrastructure.
- PDF/OCR/extraction technology.
- Dynamic rules engine / plugin architecture.
- Configuration distribution architecture.
- Deployment architecture.
- API design.

---

## 12. Decision Status Summary

| Area | Confirmed | Working Position / Proposed | Open / Not Decided |
|---|---|---|---|
| Product model | Multi-tenant SaaS; not an online game; digitalize operations; Super Admin tenant overview + revocation (MVP working scope) | — | Super Admin participant/result access, billing, deletion semantics |
| Environment | Physical venue; org-provided devices; no remote proctoring | Backend authoritative (principle) | Anti-cheating details in venue |
| Roles | 4 actors; system calculates results/rankings; Judge controls display; Super Admin: tenant overview + revocation (MVP working scope) | 1 admin/tenant (MVP); Judge operations (proposed) | Multiple admins/judges; admin live access; Super Admin participant/result access |
| Competition structure | Competition → Stages → Rounds | Stage types Individual/Team/PK; no competition-level duration | Stage/round type definitions; category placement |
| Player flow | Access → wait → rules+countdown → play → auto-save → submit/auto-submit → next | — | Access mechanism; session/device behavior; post-submit UI |
| Results | Auto validation/scoring/ranking; idempotent submission | Admin can view/export results | Scoring formulas; publication semantics; analytics specifics |
| Non-functional | Multi-tenant, real-time, interactive, state-driven, isolated, automated, timed rounds | Event-oriented (identified) | Persistence/real-time mechanism details |
| Architecture / DB | — | — | Everything (explicitly deferred) |
