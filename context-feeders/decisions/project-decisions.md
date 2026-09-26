> **[CONTEXT FEEDER NOTE]** This file is part of the decision register. It FEEDS the `context/` folder; it is NOT what a coding agent builds from - build from `context/`. Look up decision IDs (U-xx, I-xx, SCR-xx and so on) here when a context file points to one. It is maintained under the documentation rules in the root `CLAUDE.md`.

# Sudoku Competition Platform — Project Decisions

**Document Status:** Working Decisions Register  
**Date:** 2026-09-16  
**Purpose:** Consolidate every requirement decision that has been settled to date, across product vision, scope, roles, functional behavior, non-functional characteristics, architecture, and database. Open items are intentionally kept out of this document and live in [`unmade-decisions.md`](./unmade-decisions.md).  
**Source Documents:**
- `context-feeders/archive/PROJECT_ANALYSIS_UPDATED.md` — overall project analysis (confirmed items listed in §6); merged into `context-feeders/requirements/REQUIREMENTS.md` 2026-09-25
- `context-feeders/archive/PLAYER_REQUIREMENTS.md` — player role requirements (working draft); merged into `context-feeders/requirements/REQUIREMENTS.md` 2026-09-25
- `context-feeders/archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` — organization admin requirements (working draft, MVP scope); merged into `context-feeders/requirements/REQUIREMENTS.md` 2026-09-25
- `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` — super administrator requirements (working draft; later phase); merged into `context-feeders/requirements/REQUIREMENTS.md` §11 and rows SA-006…SA-033 below, 2026-09-25
- `context-feeders/archive/JUDGE_REQUIREMENTS_PROPOSAL.md` — judge role proposal (explicitly **not** final); merged into `context-feeders/requirements/REQUIREMENTS.md` 2026-09-25
- `context-feeders/archive/STAGE_REQUIREMENTS.md` — stage definitions, starting with the Individual stage (working draft); merged into `context-feeders/requirements/REQUIREMENTS.md` 2026-09-25
- `context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md` — architectural style (modular monolith + game-subsystem event-driven), recorded as a team decision (working draft)
- `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`, `context-feeders/archive/Sudoku Arena MVP — Question 2 Decision Summary.md`, `context-feeders/archive/Sudoku_Arena_MVP_Q3_Decision_Summary.md` — later internal engineering-planning documents for the 15-day MVP sprint (added 2026-09-23, at project root). **Reconciled as of 2026-09-23** (see §13, §14): most conflicts and previously-open questions are resolved and recorded below; the remaining genuine conflicts (scoring model, team scoring formula, Big Screen control) are deliberately left open for direct colleague/client review — see `context-feeders/archive/unmade-decisions-history.md` §14.3, §14.4, §14.6.

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
| ENV-001 | The platform operates as a **multi-tenant SaaS**; each organization is a tenant. | Confirmed (long-term vision) — **deferred for MVP**, see ENV-007 |
| ENV-002 | **Tenant data isolation is a fundamental requirement.** Each tenant has isolated access to its own users, competitions, participants, competition data, results, and other tenant-owned resources. A tenant must never access another tenant's data. | Confirmed (long-term vision) — **deferred for MVP**, see ENV-007 |
| ENV-003 | The **initial competition environment is a supervised physical venue** (classroom or competition venue). | Confirmed |
| ENV-004 | Participants use **organization-provided computers and/or tablets**. | Confirmed |
| ENV-005 | The initial version does **not** solve remote-competition security problems. Out of scope: camera-based supervision, environmental monitoring, camera-based identity verification, remote-proctoring mechanisms, and other anti-cheating mechanisms for unsupervised home environments. | Confirmed |
| ENV-006 | The **backend/server is authoritative for competition state and important operations.** This is a conceptual principle, **not** an architecture decision. | Working Position |
| ENV-007 | **MVP scope is single-tenant.** Due to the current time constraint, the team has deliberately decided to build the MVP for **one organization only**, rather than the full multi-tenant SaaS platform. This is an explicit scope decision by the project owner (2026-09-23), **not** an abandonment of the multi-tenant vision: ENV-001/ENV-002 (multi-tenant SaaS, tenant isolation) remain the **confirmed long-term product vision** and are planned for a later growth phase once the MVP ships. The current build (including `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`) intentionally omits tenant/organization isolation. | Confirmed (2026-09-23) — resolves the conflict at §13.1 |
| ENV-008 | **Client identity clarification (2026-09-23):** the single "organization" for this MVP is a **school or university acting as competition organizer** — not a commercial company. The competition is held **between students**; the client is the organizing institution. This does not change any other decision, but clarifies terminology: "the organization" = the hosting school/university; "participants" = students, who may themselves originate from multiple schools (the `context-feeders/archive/client-view.md` competition is inter-school, "校际联赛"). The single-tenant MVP (ENV-007) represents this one organizing institution's event. | Confirmed (2026-09-23) |

---

## 4. Actor / Role Decisions

### 4.1 Actor Set

- The system identifies **four primary actors**: Super Administrator, Organization Administrator, Judge, and Player. *(Confirmed)*

### 4.2 Super Administrator

| ID | Decision | Status |
|---|---|---|
| SA-001 | Represents the **owner/operator of the SaaS platform**. | Confirmed |
| SA-002 | Operates at the **platform level**, not within a single tenant. | Confirmed |
| SA-003 | Exact responsibilities and permissions are **not yet fully defined**; a working MVP scope now exists in `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` (tenant overview, competition overview, tenant revocation). Remaining details (participant/result access, billing, deletion semantics) stay open. | Working Position — **role deferred for the current MVP**, see SA-005; **the working scope now lives in `context-feeders/requirements/REQUIREMENTS.md` §11 and rows SA-006…SA-033 below** (noted 2026-09-25) |
| SA-005 | **The Super Administrator role is deferred for the current MVP**, along with the rest of the multi-tenant platform (ENV-007). Because the MVP serves a single company, there is no platform-level "above all tenants" role to build yet. This does **not** cancel the role — `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` remains the working spec for when the multi-tenant phase is built. | Confirmed (2026-09-23) — resolves the conflict at §13.2 |
| SA-006 | **One Super Administrator account** for the platform (from `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` SA-003, renumbered because SA-003 above already exists). Delegation among platform administrators is out of scope. | Working Position — **later phase** (SA-005) |
| SA-010 | The Super Administrator can **view a list of every tenant** (organization). | Working Position — later phase |
| SA-011 | For each tenant, **basic information** (at least the organization name and basic registration or activity data); the exact fields are not finalized (`unmade-decisions.md` SA-9). | Working Position — later phase |
| SA-012 | The Super Administrator can see each tenant's **representative** (the organization admin or admins) and all administrative people across tenants. | Working Position — later phase |
| SA-013 | The Super Administrator can **watch over** all tenants: a platform-level overview of the organizations using the platform. | Working Position — later phase |
| SA-020 | The Super Administrator can see the **number of competitions** on the platform and the number created by each organization. | Working Position — later phase |
| SA-021 | The Super Administrator can view the **names and some basic details** of competitions created by organizations; the set of "basic details" is not finalized (SA-9). | Working Position — later phase |
| SA-022 | Access to "all information in the app" includes some competition analytics; which analytics is not defined (SA-10). | Open — later phase |
| SA-023 | Whether the Super Administrator has access to competition **participants** is undecided; the current lean is out of scope (SA-6). | Open — later phase |
| SA-024 | Whether the Super Administrator can view a competition's **results** is undecided (SA-5). | Open — later phase |
| SA-030 | The Super Administrator can **revoke a tenant** for any reason; in the first version this is implemented as **deleting** the tenant. | Working Position — later phase |
| SA-031 | The consequences of revoking or deleting a tenant are **not defined**: immediate or deferred; what happens to its competitions and data; whether its users lose access at once; whether it can be reversed (SA-7, SA-11). | Open — later phase |
| SA-032 | **No manual tenant creation:** organizations register themselves on their own portal; the Super Administrator does not add them. | Working Position — later phase |
| SA-033 | **Deferred beyond the first multi-tenant version:** billing and payments (no payment system exists); suspending one organization admin without deleting the tenant; platform-level configuration; an audit log of Super Administrator actions (SA-12); reactivating a deleted tenant. | Deferred |

### 4.3 Organization Administrator

| ID | Decision | Status |
|---|---|---|
| OA-001 | An Organization Admin represents **one organization (tenant)**. | Confirmed |
| OA-002 | **MVP: one tenant has exactly one Organization Admin.** Multiple admins and admin invitation/delegation are out of scope for MVP. | Working Position — **tension noted 2026-09-25:** the team's assumption U-11 (`unmade-decisions.md` §2) says there may be more than one controller (控制员, assumed to be the admin, ROL-001). Both stayed as they were until the stakeholder confirmed; **superseded 2026-09-26 by BLD-004: several controller accounts are allowed.** |
| OA-003 | Operates only within the scope of their own organization. | Confirmed |
| OA-004 | Responsible for **competition preparation and post-competition analysis**; a large independent organization-management module is not currently required. | Working Position |
| OA-005 | Can **create multiple competitions** for the organization. | Confirmed |
| OA-006 | Can configure competition **name, description**, and other basic information. | Confirmed |
| OA-007 | The **Organization Admin has no control rights over the Big Screen**; Big Screen control is reserved for the Judge. | **Superseded 2026-09-24** by the stakeholder's answer — see §15.3 (BSC-002): with one screen, judge and controller both control it; with several screens only the controller does |
| OA-008 | Is **not** the routine live competition operator; normal live control belongs to the Judge. The Admin should not routinely perform round-by-round control, player live control, Big Screen control, routine puzzle rotation, or routine scoring/ranking calculation. | Working Position — Big Screen clause superseded by §15.3; controller powers extended by §15.2 (ROL-002/ROL-004) |
| OA-009 | Can **view and export post-competition results and analytics**; does not manually calculate rankings. | Confirmed / Working Position |
| OA-010 | Can **create and remove judges** and **assign judges to competitions**. | Working Position |
| OA-011 | Can **import participants** (envisioned via Excel). | Working Position |
| OA-012 | Has independent management access to the **organization-level question bank** (currently the only role with such access). | Working Position |
| OA-013 | Live access to competition data during the event is **undecided** (see open questions). | Open — **superseded 2026-09-24 by ROL-004: the controller sees all progress in real time and can take over**; noted 2026-09-25 |

### 4.4 Judge

| ID | Decision | Status |
|---|---|---|
| J-001 | The Judge is the **operator and supervisor of a specific live competition**, not the engine that calculates/manages every internal operation. | Confirmed (guiding principle) |
| J-002 | The Judge **starts the competition/stage**; the Judge starts the competition state, not an individual signal to each player. | Proposed — **since 2026-09-24 the controller (not the judge) starts a stage** (ROL-003) |
| J-003 | **Rounds normally progress automatically** after a stage starts (round waiting → countdown → round start → round end → next round). | Proposed — **confirmed as the build rule by CS-022 (rounds are automatic; the controller starts stages)**; noted 2026-09-25 |
| J-004 | The Judge can **manually start a round** as an **exception path**, not the normal workflow. | Proposed — **not carried into the build; recovery is reset/rematch/replay (ROL-005). Recorded as assumption U-38 (2026-09-25).** |
| J-005 | The Judge can **pause** the competition when an operational problem requires it. Exact pause semantics are open. | Proposed — pause is global (J-030) and belongs to the controller (ROL-003) |
| J-006 | The Judge can **prematurely end** a round/stage (e.g., all participants submitted). Exact behavior for unfinished players is open. | Proposed — behavior confirmed by J-031; the controller ends rounds (ROL-003) |
| J-007 | The Judge can **monitor participants in real time** (connected/disconnected, submitted/not submitted, possibly elapsed time/progress). Connectivity has clear operational purpose. | Proposed — **partly confirmed by ROL-003: judges see connected and submitted status of their students; no elapsed time or progress display (JD-22, JD-23)**; noted 2026-09-25 |
| J-008 | The Judge **controls what appears on the public display (Big Screen)**: leaderboard/ranking, individual player board, team boards, PK/head-to-head boards, stage/final results. | Proposed / Client-derived — **resolved by BSC-002: the controller controls the screens (the judge too when there is one screen); PK boards are later**; noted 2026-09-25 |
| J-009 | The Judge may view **real-time rankings**, but only if there is a genuine operational reason; the Judge never calculates or manually modifies rankings. | Open / Under discussion — **resolved: ranking is always visible to the judge (J-034)** |
| J-010 | The Judge is **not responsible** for automatic team puzzle rotation, puzzle assignment/replenishment, or team scoring — these are system responsibilities. | Proposed — **confirmed in substance by TEM-004 and EX-001 (automatic rotation, refill, checking and scoring)**; noted 2026-09-25 |
| J-011 | Whether the Judge and Management can **both** control the Big Screen, and priority rules, is **open** (client design suggests both). | Open — **resolved 2026-09-24 by BSC-002: one screen, judge and controller, last action wins; several screens, controller only**; noted 2026-09-25 |

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
| CS-003 | **Stage types** identified: **Individual, Team, PK**. For the MVP, only **Individual and Team** are realized; **PK is deferred**. | Working Position (PK deferred — see CS-016) |
| CS-010 | **MVP stage set:** the competition realizes **Individual + Team** stages. | Confirmed |
| CS-016 | **PK stage deferred:** PK is **not realized in the MVP**; the PK algorithm and mechanics are not designed for now, because the client states PK is not needed in the competition for now. `context-feeders/archive/client-view.md` §2.1 ("only Individual + Team, no PK") and §2.5 ("reserved capability, not enabled") support this. | Confirmed |
| CS-011 | **Each stage produces its own final ranking.** | Working Position |
| CS-012 | **There is no combined cross-stage final ranking.** Rankings are per-stage only. | Working Position |
| CS-013 | **Individual stage:** each player receives questions and is scored **individually**, independently of team membership; scores are stored **per player**. | Working Position |
| CS-014 | **Team stage — emphasized round:** the **rotation round** (questions rotate among 2–6 players, generally 4; a finished puzzle is replaced with a new one until all puzzles are solved or total time is reached). | Working Position |
| CS-015 | **Team stage — other round types:** 分区协作 (partition collaboration) and 抢答夺分 (quick-answer scoring) are listed in `context-feeders/archive/client-view.md` §2.4 with one-line descriptions only; detailed rules are **not defined** and MVP scope is **open**. | Open — **partly resolved 2026-09-24: buzzer dropped, partition collaboration is very probably the stakeholder's "齐心协力" (TEM-001, TEM-003); its rules are U-21**; noted 2026-09-25 |
| CS-004 | No fixed MVP number of stages/rounds; the admin adds stages and rounds until the desired structure is defined. | Working Position — **superseded 2026-09-23 by CS-020** (fixed structure); noted 2026-09-25 |
| CS-005 | Per-round configuration includes at minimum: **round name, round duration, round type information, questions assigned to the round**, plus category-related configuration pending clarification. | Working Position — **superseded by CS-020: rounds are predefined; only numeric values are customizable (SCR-005)**; noted 2026-09-25 |
| CS-006 | **Competition-level overall duration is not manually configured**; total duration emerges from configured stages, rounds, round durations, progression, and judge-controlled operations. A competition-level duration should be introduced only if a concrete business requirement exists. | Working Position |
| CS-007 | The admin can **edit a competition while it is still being prepared**. | Confirmed |
| CS-008 | The intended general rule is **no modification after the competition has started**, subject to future definition of exceptional operations. | Working Position — **partly superseded 2026-09-24: numeric values stay editable by the controller until each round starts (SCR-005) and participants are editable at any time (PAR-003)**; noted 2026-09-25 |
| CS-009 | **Full competition duplication is not required for MVP** (may be considered later). | Working Position — **superseded 2026-09-24 by CMP-100: a copy button is required** (as CR-002); noted 2026-09-25 |

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
| PT-004 | The system should provide **competition-specific participant access credentials** (potentially OTP, one-time credential, or account credential). Exact mechanism is undecided. | Working Position — **superseded by PT-006: plain username and password, no OTP**; noted 2026-09-25 |
| PT-005 | **Resolved (2026-09-23):** one competition represents **one category** (e.g. `U6`–`U20`). Different categories are separate competitions. Category is set at competition-creation time. Source: `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §4, §6 — reviewed by project owner, no conflicting prior decision found. | **Modified 2026-09-24** — an event can now contain several categories running in parallel, each ranked separately (§15.2 EVT-002); still to confirm whether one room mixes categories |

### 5.4 Judge Management (by Organization Admin)

| ID | Decision | Status |
|---|---|---|
| JM-001 | The admin can **create/register judges** for the organization. | Working Position |
| JM-002 | The admin can **remove judges** from the organization; implications for judges already assigned to active/future competitions are open. | Working Position — **implications are still open, now tracked as I-12** (`unmade-decisions.md` §3); noted 2026-09-25 |
| JM-003 | The admin can **assign a judge to a particular competition**; a judge's authority is **competition-specific**. | Working Position |
| JM-004 | The system should provide assigned judges with **competition-specific access credentials** (potentially OTP or other one-time credential). Exact mechanism undecided. | Working Position — **superseded by PT-006 / JD-6: plain username and password, no OTP**; noted 2026-09-25 |
| JM-005 | **Resolved (2026-09-23):** exactly **one judge per competition**. A judge can be reused across competitions over time but cannot be assigned to more than one **ongoing** competition at once; becomes available again once that competition finishes/is cancelled. Source: `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §8, Q2.10–11 — reviewed by project owner, no conflicting prior decision found. | **Superseded 2026-09-24** — the real event needs at least 30 judges, each assigned a range of participant numbers (§15.2 ROL-003) |

### 5.5 Competition Access / Entry Links

| ID | Decision | Status |
|---|---|---|
| CA-001 | After preparation, the admin may generate/obtain access information (a **link and/or QR code** is envisioned) allowing authorized players and judges to enter the competition. | Working Position |
| CA-002 | The access mechanism should establish the **appropriate competition context** without navigating through unrelated competitions. Exact authentication/authorization is undecided. | Working Position — **resolved by PT-006: the entry link sets the competition, then a username-and-password login**; noted 2026-09-25 |
| CA-004 | **Resolved (2026-09-23):** publishing a competition **locks its configuration**; the general rule is no editing after publish, with no exceptional edit path currently described. Publishing also generates the competition entry link/QR. Source: `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §5, Q2.8 — reviewed by project owner, no conflicting prior decision found (this supersedes CMP-2/CMP-3/FLW-Q9 as previously open). | **Partly superseded 2026-09-24** — the structure stays fixed, but numeric values stay editable by the controller until each round starts and participants can be edited at any time (§15.1 SCR-005, §15.5 PAR-003) |
| CA-003 | A **separate mechanism for the Big Screen** may be required (a competition-specific link/token was previously considered). Exact mechanism unresolved. | Open — **resolved 2026-09-24 by BSC-001: one shared link, no login; produced at publish (`context-feeders/requirements/REQUIREMENTS.md` §7.2)**; noted 2026-09-25 |

### 5.6 Post-Competition Results & Analytics

| ID | Decision | Status |
|---|---|---|
| RA-001 | After a competition, the admin can **access its results**. | Confirmed |
| RA-002 | The admin can **view system-generated rankings**; the admin does not manually calculate rankings. | Confirmed |
| RA-003 | The admin can access **competition reports/statistics**; exact analytics intentionally not finalized. Possible dimensions: overall results, stage-level results, round-level results, individual results, team scoring, rankings, other basic statistics. | Working Position |
| RA-004 | The admin can access **team scoring information**; the exact team scoring formula must be defined separately. `context-feeders/archive/client-view.md` §2.1 has a candidate formula (`team total = individual two-round sum × 0.6 + team two-round sum`), and the Arena documents reference "the agreed team formula" without restating it — **not yet confirmed these are the same formula.** See §13.6 / `context-feeders/archive/unmade-decisions-history.md` §14.4 (for colleague review). | **Resolved 2026-09-24** — the stakeholder confirmed this formula, with the 0.6 coefficient customizable and a school ranking required (§15.1 SCR-004) |
| RA-005 | The admin can **export competition results**; exact formats and fields are open. | **Confirmed 2026-09-24** — export of final scores, rankings and answers is required (§15.4 RES-002); the file format is still open |

### 5.7 Competition Reuse

| ID | Decision | Status |
|---|---|---|
| CR-001 | The admin should ideally **reuse a previous competition configuration** for a new competition. Exact mechanism (duplicate, template, copy selected config) is undefined. | **Confirmed 2026-09-24** — a "copy" button is required (§15.7 CMP-100) |
| CR-002 | **Full competition duplication is not required for MVP** (may be considered later). | **Superseded 2026-09-24** — copy is now required (§15.7 CMP-100) |

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
| EX-006 | **Automatic team puzzle rotation** during team rounds is a system responsibility. | Proposed — **rotation, refill and team scoring are automatic in the confirmed rotation rules (TEM-004, EX-001)**; noted 2026-09-25 |
| EX-007 | **Automatic puzzle assignment/replenishment** for team rounds is a system responsibility. | Proposed — **rotation, refill and team scoring are automatic in the confirmed rotation rules (TEM-004, EX-001)**; noted 2026-09-25 |
| EX-008 | **Automatic team scoring** is a system responsibility. | Proposed — **rotation, refill and team scoring are automatic in the confirmed rotation rules (TEM-004, EX-001)**; noted 2026-09-25 |
| EX-009 | **Automatic saving of player moves** during an active round is a confirmed behavior; the persistence mechanism is not yet decided. | Confirmed behavior, open mechanism |
| EX-010 | **Individual-stage answer validation** (initial developer vision): use a **recognizer** + **solution grid** (initial state + solution state) and validate by a **completion algorithm**. If confirmed, the system does not need to determine question type. | Proposed — **in the build as a team decision, not reviewed by the stakeholder; edge cases I-14 and I-15**; noted 2026-09-25 |
| EX-011 | If the completion algorithm is **not** used, a **per-question-type scoring system** must be defined for the Individual stage and all its rounds. | Open — **moot: all-or-nothing per question with points set per question (SCR-001, SCR-003)**; noted 2026-09-25 |

---

## 7. Non-Functional System Characteristics

The following system characteristics have emerged from the problem description and are treated as **confirmed characteristics** (not technology decisions):

| ID | Characteristic | Description | Status |
|---|---|---|---|
| NF-001 | **Multi-tenant** | Multiple independent organizations use the same platform. | Confirmed — **long-term; deferred for the MVP (ENV-007)**; noted 2026-09-25 |
| NF-002 | **Real-time** | Competition state, participant progress, and rankings may need to be updated and displayed in real time. | Confirmed |
| NF-003 | **Interactive** | Multiple users interact with the same competition simultaneously. | Confirmed |
| NF-004 | **State-driven** | A competition progresses through defined stages and rounds; the system coordinates transitions. | Confirmed |
| NF-005 | **Data isolation** | Tenant data must be strongly isolated. | Confirmed — **long-term; deferred for the MVP (ENV-007)**; noted 2026-09-25 |
| NF-006 | **Automated processing** | The system automatically validates answers and calculates results. | Confirmed |
| NF-007 | **Event-oriented behavior** | Actions by participants/judges cause changes that must propagate to other users. **Now realized architecturally at the competition/game-subsystem level** (see §8.1, ARC-020). | Working Position (was Identified / Open) |
| NF-008 | **Automatic player state persistence** | Player moves auto-save during active rounds. Mechanism not decided. | Confirmed behavior / Open mechanism — **mechanism now in the build: autosave over WebSocket, about 2 saves per second per player, Redis for runtime state and PostgreSQL for durable results (`context-feeders/requirements/ARCHITECTURE.md` §5); restart recovery is I-10**; noted 2026-09-25 |
| NF-009 | **Timed round execution** | Rounds have a time limit; early manual submission and automatic submission at expiry are both supported; repeated submission does not alter results. | Confirmed |
| NF-010 | **Sequential round/stage flow** | Player participation proceeds sequentially through round waiting, execution, and next-round waiting; exact lifecycle and transition authority are open at the domain level. | Confirmed behavior / Open lifecycle — **the lifecycle is now defined (`context-feeders/requirements/REQUIREMENTS.md` §7.1); the controller starts stages and rounds progress automatically (CS-022, ROL-003)**; noted 2026-09-25 |

---

## 8. Architecture Decisions

**Status: The architectural *style* has been decided. Technology, database, and deployment remain undecided.**

Full detail lives in [`context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md`](../archive/ARCHITECTURE_REQUIREMENTS.md). The decisions below are recorded here for register consistency.

### 8.0 Divergence Notice — Architecture Decided Ahead of Requirements

The existing process rule in this section previously required architecture to be **derived from the requirements and system characteristics**, not selected in advance. The style decisions in §8.1 were instead made by **development-team preference**, driven by team size and delivery simplicity, while the requirements remain unstable (see `unmade-decisions.md`).

This is an **explicit, acknowledged deviation** from the previously stated process rule. It is recorded rather than silently applied. The style remains revisable if requirements contradict it.

### 8.1 Architecture Style Decisions (Working Position — Team-Decided)

| ID | Decision | Status |
|---|---|---|
| ARC-001 | The platform is built as a **single deployable system** — one deployment unit, no separately deployed services, no distributed runtime for the MVP. | Working Position (team decision) |
| ARC-002 | The architecture is a **modular monolith** — explicit modules with defined boundaries, not a flat monolith. | Working Position (team decision) |
| ARC-003 | **Modularity is a first-class requirement.** Boundaries are explicit and enforced by convention and code structure; internals are not reachable except through a module's public interface. | Working Position |
| ARC-004 | **Rationale:** two-developer team; deployment simplicity; maintainability; future growth without premature distribution. | Working Position |
| ARC-005 | **Scaling is a later concern.** The modular structure must not prevent scaling, but the MVP is not designed around speculative scale. Module extraction into a service is **not** an MVP goal. | Working Position |
| ARC-006 | This fixes the **style only**; backend/frontend/database/real-time/caching/auth/deployment technologies remain **Open**. | Working Position — **partly superseded 2026-09-23 by ARCH-020…ARCH-023 (React/TypeScript, PostgreSQL + Redis, WebSocket); backend language is still open (ARCH-024)**; noted 2026-09-25 |
| ARC-011 | **Tenant isolation is enforced structurally at module level**, not by per-developer discipline. | Derived from ENV-002 / NF-005 — **not built in the current MVP** (single-tenant, ENV-007); this remains the design target for the future multi-tenant phase |
| ARC-020 | **Event-driven communication applies to the competition/game subsystem** (stage/round lifecycle, player actions, validation, scoring, team rotation). Modules outside it may use direct in-process calls. | Working Position (team decision) — **narrowed by the later Guideline (direct calls by default, events mainly for recording moves); the choice is open as I-08**; noted 2026-09-25 |
| ARC-021 | **Events are in-process.** No external broker, queue, or event-streaming infrastructure in the MVP. | Working Position (team decision) — **kept if events are used; scope open as I-08**; noted 2026-09-25 |
| ARC-023 | Events express **domain facts** (something that happened), not commands. | Working Position |
| ARC-024 | Events carry tenant context; no subscriber processes an event across a tenant boundary. | Derived from ENV-002 / NF-005 (Confirmed requirement) |
| ARC-025 | Events do not change the **backend-authoritative** principle (ENV-006); no client becomes authoritative. | Consistent with ENV-006 |

### 8.2 Still Undecided

- The following remain **not decided**: backend technology, frontend technology, database technology, real-time communication technology, caching/state-management technology, authentication and authorization implementation, deployment architecture, infrastructure, external dependencies and libraries, and the detailed competition domain model. *(Confirmed as undecided)*
- These decisions **must still be derived from the requirements and system characteristics**. *(Process rule retained for the remaining decisions)*
- The client's proposed **"unified configuration distribution engine"** and **"dynamic/marketplace-style logic (Steam-like) upload"** concepts remain **not accepted as architecture decisions**. *(Working Position)*
- The **"backend is authoritative"** principle (§3, ENV-006) remains a conceptual principle, not an event-model/synchronization decision. *(Working Position)*

### 8.3 Proposed, Not Settled

- **Module decomposition** (ARC-012) and the **event catalog** (ARC-027) in `context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md` are **proposals derived from the requirements**. They must be validated against the domain model, because several requirements driving the boundaries are themselves unresolved. *(Proposed)*

## 9. Database Decisions

**Status: No database decisions have been made.**

- No database technology has been selected.
- The only settled constraints are **functional/data requirements** that any database design must satisfy:
  - Strong **tenant data isolation** (multi-tenant boundaries).
  - Persistence of competition structure (stages, rounds), questions, participants, teams, judges, credentials, submissions, results, rankings, and post-competition analytics data (the precise set of what must be persisted is still being finalized).
  - Support for **automatic per-move saving** of player state during active rounds (mechanism/format open).
  - Post-competition data access, reporting, and export.
- Questions such as retention policy, schema shape, versioning of configuration, and auditability of configuration changes remain open (see `unmade-decisions.md`).

---

## 10. Client Proposal vs. Current Vision — Recorded Differences

These are open points of reconciliation; the current project vision diverges from the client proposal as follows:

| Topic | Client Proposal | Current Project Vision | Status |
|---|---|---|---|
| Big Screen control | `context-feeders/archive/client-view.md` §4.1/§4.3 explicitly states Judge **and** Admin/Management have synchronized control ("裁判端控制 / 管理端同步控制"). | `context-feeders/archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-007/OA-080 and `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §16 both say Judge-only. | **Resolved 2026-09-24 by the stakeholder** — see §15.3 (BSC-002). |
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
- Database structure.
- Redis / caching / infrastructure.
- PDF/OCR/extraction technology.
- Dynamic rules engine / plugin architecture.
- Configuration distribution architecture.
- Deployment architecture.
- API design.

**Removed from this list (decided — see §8.1):**
- ~~Backend architecture~~ → architectural **style** decided: modular monolith (ARC-001 / ARC-002). Backend **technology** remains Open.
- ~~WebSocket/event architecture~~ → **event-driven scope decided** for the competition/game subsystem, in-process (ARC-020 / ARC-021). Real-time **transport technology** remains Open.

---

## 12. Decision Status Summary

| Area | Confirmed | Working Position / Proposed | Open / Not Decided |
|---|---|---|---|
| Product model | Multi-tenant SaaS is the confirmed **long-term** vision; not an online game; digitalize operations. **MVP is single-tenant (ENV-007, 2026-09-23) — one company, multi-tenancy deferred, not abandoned.** | — | Super Admin participant/result access, billing, deletion semantics (for the later multi-tenant phase) |
| Environment | Physical venue; org-provided devices; no remote proctoring; MVP scope = single tenant (ENV-007) | Backend authoritative (principle); anti-cheating kept light (§15.5) | Venue Wi-Fi capacity, especially the 300-student room |
| Roles | System calculates results/rankings; Judge controls display. **MVP realizes Admin/Judge/Player only — Super Administrator deferred with multi-tenancy (SA-005).** | At least 30 judges, each assigned a range of participant numbers; only the controller starts/pauses/ends rounds (§15.2) | The controller (= admin, assumed) sees everything live and can take over; exact judge powers beyond their own students; Super Admin details (later phase) |
| Competition structure | **Fixed, not admin-configurable for MVP** (CS-020/021): exactly 2 stages (Individual, Team), predefined rounds/durations/rules; several categories run in parallel and are ranked separately (§15.2); numeric values customizable, participants editable at any time; PK deferred | Team stage = rotation (10 questions, 60 s) + "齐心协力" (§15.6) | "齐心协力" rules; validation approach and grid shapes; whether a room mixes categories |
| Player flow | Access (link/QR + password login) → wait → rules+countdown → play → auto-save → submit/auto-submit → next; no post-submit results shown to player (Big Screen only) | Credentials printed; one active device per account, device swap allowed (§15.5) | Exact tablet model and Quark version (`unmade-decisions.md`) |
| Judge | Controller starts/pauses/ends rounds; global pause/resume; premature end auto-submits+scores; judges see their assigned students' status and can restart one student's round; controller takes over if a judge disconnects (§15.2) | — | Takeover details (manual vs automatic); exact judge powers beyond assigned students |
| Results | Auto validation/scoring/ranking; idempotent submission; all-or-nothing per puzzle; per-question points by difficulty; whole-minute early bonus in the Individual stage only; school total ranking (individual × 0.6 + team); per-stage ranking with tie-breaks; score corrections with a log; a rematch archives old scores; export of scores, rankings and answers (§15.1, §15.4) | — | Whether a round's total is fixed at 100; which players count in the school total; export file format |
| Non-functional | Multi-tenant vision retained long-term (MVP is single-tenant); real-time, interactive, state-driven, automated, timed rounds; answers kept and exported, then deleted after 15 days (§15.4); real scale about 600–720 students, 11 rooms, 30+ judges, 10 screens (§15.2) | Event-oriented — realized in the game subsystem (ARC-020) | Exact numbers; a failure is handled by replaying the round (ROL-005), technical recovery details open |
| Architecture | **Modular monolith** (ARC-001/002); **event-driven game subsystem, in-process** (ARC-020/021); **React/TypeScript frontend, PostgreSQL+Redis, WebSocket transport** (§14.4) — all Working Position, team-decided | Structural tenant isolation (ARC-011, moot until multi-tenant phase); candidate module decomposition & event catalog | **Backend language/framework — the one major technology choice still unnamed**; deployment/infra; PDF-extraction library |
| DB | PostgreSQL (durable) + Redis (runtime), scope defined (§14.5) | — | The schema must now cover events with several categories, rooms, judge number ranges, per-question points, archived scores, a correction log and the 15-day purge (§15) |

---

## 13. Pending Reconciliation — Sudoku Arena MVP Alignment Documents (flagged 2026-09-23, updated 2026-09-23)

Three new documents were added at the project root on 2026-09-23 (`context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`, `context-feeders/archive/Sudoku Arena MVP — Question 2 Decision Summary.md`, `context-feeders/archive/Sudoku_Arena_MVP_Q3_Decision_Summary.md`), outside the `context-feeders/requirements/`/`context-feeders/decisions/` structure. They function as a later, more concrete internal engineering plan for a 15-day MVP sprint. Several of their statements conflicted with decisions marked Confirmed elsewhere in this document, or silently proposed answers to items still marked Open.

**Process note (2026-09-23):** the project owner briefly asked for a default "oldest document wins" rule for these conflicts, then retracted it. The current policy is: **genuine conflicts (old document takes a firm position, new document contradicts it) are recorded as open questions in `context-feeders/archive/unmade-decisions-history.md` §14 for the colleague/client to decide** — not resolved by document precedence. Items where a new document simply answered a previously-open question (no prior firm position to conflict with) are accepted directly.

| # | Confirmed/Open item here | Arena documents say | Status |
|---|---|---|---|
| 13.1 | ENV-001/ENV-002 (Confirmed): multi-tenant SaaS, tenant isolation is fundamental. ARC-011 (Confirmed): isolation enforced structurally. | "The MVP is **not** a fully generic SaaS competition engine"; "Generic multi-tenant SaaS features" explicitly out of scope; no Organization/Tenant entity in the domain model or DB schema. | **Resolved (2026-09-23) — direct project-owner decision (time constraint), not a document-precedence default.** Deliberate scope decision: build the MVP single-tenant, for one school/university. Multi-tenant SaaS + Super Admin remain the confirmed long-term vision for a later growth phase — **not abandoned**. See ENV-007, ENV-008, SA-005. **Not part of the colleague review below** — the project owner made this call directly. |
| 13.2 | SA-001…SA-003 (Confirmed/Working Position): Super Administrator is one of 4 platform actors. | Super Administrator is never mentioned; roles are only "Administrators, Judges, Players, Big-screen display." | **Resolved (2026-09-23)** — same basis as 13.1. See SA-005. |
| 13.3 | OA-001/OA-002: Organization Admin represents one tenant among potentially many. | "Admin" is used generically; no framing relative to multiple organizations/tenant isolation. | **Resolved (2026-09-23)** — same basis as 13.1. |
| 13.4 | CS-014/TEAM-010…TEAM-015 (Working Position): detailed live puzzle-rotation mechanic for the Team stage (2–6 players, ~60s rotation, replenishment pool). | Player runtime flow, submission rules, module design, and API/WebSocket contracts describe every round identically (solve own puzzle → submit); no rotation/replenishment mechanic appears anywhere. | **Resolved (2026-09-23) — no conflict, so not part of the colleague review.** `context-feeders/archive/STAGE_REQUIREMENTS.md` §4.3 / `context-feeders/archive/client-view.md` §3 remain authoritative; the Arena Alignment Guideline simply doesn't redescribe it. **Remaining implementation-planning gap (not a requirements question):** the Alignment Guideline's runtime flow, module design, and API/WebSocket contracts (§12, §14, §24, §27–28) still need to be extended to actually cover rotation/replenishment before implementation. |
| 13.5 | `context-feeders/archive/client-view.md` §2.1: all-or-nothing scoring, 100 pts/0 pts + time bonus. `context-feeders/archive/FLOW_REQUIREMENTS.md` FLW-030 instead attributed a proportional/per-cell model to "the client's vision." | Q3.18 / Alignment §18: all-or-nothing per-question scoring (100 pts / 0 pts) + time bonus — matches `context-feeders/archive/client-view.md`, not FLW-030. | **Resolved 2026-09-24 by the stakeholder:** all-or-nothing per puzzle, no partial credit (§15.1 SCR-001). The proportional model is discarded. |
| 13.6 | RA-004/SC-4 (Open): exact team scoring formula undefined. | References "the agreed team formula" without restating it. | **Resolved 2026-09-24 by the stakeholder:** the `context-feeders/archive/client-view.md` formula is confirmed (§15.1 SCR-004). |
| 13.7 | `context-feeders/archive/client-view.md` §4.1/§4.3: Judge **and** Admin/Management both control the Big Screen (synchronized). | `context-feeders/archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-007 and `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §16 both say Judge-only. | **Resolved 2026-09-24 by the stakeholder:** neither side wins outright — one screen: judge and controller both control it; several screens: controller only (§15.3 BSC-002). |

**Summary:** 13.1–13.3 (multi-tenancy) stand as the project owner's direct decision. 13.4 (team-mode description) stands as-is with a noted implementation gap. 13.5–13.7 are genuine, unresolved document conflicts, fully detailed in `context-feeders/archive/unmade-decisions-history.md` §14.3, §14.4, §14.6 for the colleague to answer.

---

## 14. Newly Confirmed Decisions — Final Pre-Implementation Review (2026-09-23)

A full reconciliation pass (`context-feeders/archive/unmade-decisions-history.md` §1–11, each section's "Status note") found that the Arena Alignment Guideline answers a large number of previously-Open items with no conflict. Recorded here as Confirmed/Working Position per this document's own decision-tracking rule, rather than left sitting only as inline notes in the open-questions file.

### 14.1 Competition structure is fixed, not admin-configurable

| ID | Decision | Status |
|---|---|---|
| CS-020 | **Superseded: CS-004 (no fixed stage/round count) no longer applies to the MVP.** The competition structure is fully fixed in code: exactly 2 stages (Individual, Team), each with predefined rounds, preparation times, durations, and rules. The admin does **not** configure stages/rounds/durations during competition creation — only name, description, category, participant Excel, and question PDF. | **Partly superseded 2026-09-24** — the structure (stages, rounds, rules) stays fixed, but every numeric value (points, coefficient, bonus, counts, durations) must be customizable (§15.1 SCR-005) |
| CS-021 | Consequently, reordering, deleting, or saving empty stages/rounds (formerly CMP-10…CMP-14) are **moot** — there is no admin-facing structure to modify. | Confirmed (2026-09-23) |
| CS-022 | The Judge manually starts each **stage** only. Preparation countdown, round start, round end at timer expiry, and advancing to the next round/stage are all **automatic**. **There is no manual individual-round start capability** — this narrows the earlier Judge proposal (J-005), which treated manual round start as a needed exception path. Worth an explicit sanity check that dropping it was intentional. | Confirmed (2026-09-23) — now read together with §15.2 ROL-003: the controller starts, pauses and ends rounds; a judge can restart one student's round |

### 14.2 Judge operational semantics

| ID | Decision | Status |
|---|---|---|
| J-030 | **Pause is global**, not per-round: timer stops, all players blocked from editing, big screen shows "Paused," all state preserved exactly. Resume uses a 3-2-1-Start countdown that does not consume round time. | Confirmed (2026-09-23) |
| J-031 | **Premature ("early") round end:** auto-submits every player's latest saved state, evaluates, scores, updates ranking, then proceeds to the next round/stage normally. Not reversible (no undo mechanism is described). | Confirmed (2026-09-23) |
| J-032 | **No per-participant connectivity/progress monitoring for the Judge in the MVP** — "there is no separate inactive/absent status." This narrows the earlier Judge proposal (J-008), which treated connectivity monitoring as operationally valuable. Worth an explicit sanity check. | **Superseded 2026-09-24** — judges now see the status (connected, submitted) of their assigned students (§15.2 ROL-003) |
| J-033 | **"Publish results" has no separate manual step.** Results finalize automatically on scoring and become immutable immediately — no human confirmation step, no correction/dispute workflow exists in the MVP. | **Partly superseded 2026-09-24** — scores can be corrected by the controller with a mandatory reason and a change log, and a reset counts as a rematch (§15.2 ROL-005, §15.4 RES-003) |
| J-034 | Real-time ranking is **always** visible to the Judge (pushed continuously), not gated behind any decision. | Confirmed (2026-09-23) |

### 14.3 Authentication model

| ID | Decision | Status |
|---|---|---|
| PT-006 | **Supersedes the "potentially OTP" language in PT-004/JM-004.** Players, Judges, and Admins all authenticate with ordinary system-generated username/password accounts. No OTP appears anywhere in the newer documents. **Big Screen: resolved 2026-09-24 — one shared link, no per-screen login (§15.3 BSC-001).** | Confirmed (2026-09-23) for Player/Judge/Admin |

### 14.4 Technology choices named by the Arena Alignment Guideline

| ID | Decision | Status |
|---|---|---|
| ARCH-020 | Frontend: **React with TypeScript**. | Confirmed (2026-09-23) — supersedes ARCH-3 as Open |
| ARCH-021 | Database: **PostgreSQL** for durable business data; **Redis** for fast-changing runtime state/caching. | Confirmed (2026-09-23) — supersedes ARCH-4/ARCH-6 as Open |
| ARCH-022 | Real-time transport: **WebSocket** (not SSE or polling). | Confirmed (2026-09-23) — supersedes ARCH-5 as Open |
| ARCH-023 | A minimum REST + WebSocket API contract and a minimum relational domain model are proposed (Alignment §27–28, §32) — explicitly a starting point, not final. | Working Position (2026-09-23) |
| ARCH-024 | **Backend language/framework is still not explicitly named** — the React/TypeScript frontend choice suggests but does not confirm a Node.js backend. This remains the one major technology gap before coding starts. | **Open** — see `context-feeders/archive/unmade-decisions-history.md` §12 priority list |
| ARCH-025 | **Expected scale/concurrency for the real competition is undefined.** `context-feeders/archive/client-view.md`'s original numbers (≥1000 devices, 3000 concurrent) were for the full multi-tenant platform vision and almost certainly don't apply to one school's single event — but no document states the real number, and no architecture decision has been sized against it. | **Partly resolved 2026-09-24** — the stakeholder gave real numbers (§15.2 EVT-001): about 600–720 students, 11 rooms, at least 30 judges, 10 screens. The numbers are inconsistent (600 vs 720); design target ~800 clients. Exact numbers remain open in `unmade-decisions.md` |
| ARCH-026 | **UI language: bilingual — both English and Chinese.** Not Chinese-only, not English-only. i18n must be planned into the frontend architecture from the start. | Confirmed (2026-09-23, by product owner) |

### 14.5 Persistence scope

| ID | Decision | Status |
|---|---|---|
| DP-010 | Long-term storage (PostgreSQL) is limited to: competition config, participants/teams/accounts, judges, stages/rounds, questions, and finalized results/scores/ranking. **Explicitly not retained long-term:** final grids, detailed move history, manual-vs-auto submission flag. Runtime-only state (grid, in-progress moves) lives in Redis and is discarded after finalization. | **Superseded 2026-09-24** — submitted answers must now be kept (and exported) for appeals, then deleted after 15 days (§15.4 RES-001/RES-004). Pre-submission working grids may still be Redis-only |
| DP-011 | No audit/versioning system exists anywhere in the MVP (configuration changes, admin edits, or results). | **Partly superseded 2026-09-24** — a change log is required for score corrections (§15.4 RES-003), and old scores are archived on a rematch (§15.2 ROL-005); no general audit system |
| DP-012 | Data retention period is **still undecided** — worth resolving given this is student data from a school competition. | **Resolved 2026-09-24** — 15 days, then permanent deletion (§15.4 RES-004) |

### 14.6 Scoring/ranking mechanism (independent of the still-open scoring-model conflict)

| ID | Decision | Status |
|---|---|---|
| SC-020 | Ranking = cumulative per-round scores within a stage, producing a provisional ranking after every finalized round and a final ranking when the stage ends. | Confirmed (2026-09-23) |
| SC-021 | Tie-break order: higher score → earlier completion/submission time → case-insensitive alphabetical name. | Confirmed (2026-09-23) |
| SC-022 | No cross-stage combined ranking — Individual and Team stages each produce their own independent final ranking. | **Modified 2026-09-24** — Individual and Team keep separate rankings, but a school total ranking that combines both is now required (§15.1 SCR-004) |
| SC-023 | **What "completed/correct" actually means, and the effect of a wrong entry, remain open** — entangled with the scoring-model conflict at §13.5/`context-feeders/archive/unmade-decisions-history.md` §14.3. | **Resolved 2026-09-24** — a puzzle counts only if fully correct; a wrong or blank cell means 0 for that puzzle (§15.1 SCR-001) |

---

## 15. Stakeholder Answers — Round 2 (2026-09-24)

The stakeholder answered the second round of questions and then approved the team's proposals as a whole ("your suggestions are good"), adding one working principle: **make customizable whatever can be customized; operate the rest directly.** Rows marked *accepted proposal* were proposed by the team and approved in that blanket answer. Several factual questions were **not** answered, and some rows rely on an assumed default — those are tracked in `unmade-decisions.md`. This section supersedes earlier rows wherever they conflict; the affected rows above are marked. In `context-feeders/requirements/REQUIREMENTS.md`, rows marked *accepted proposal* carry the tag **[P]**, and rows marked *Confirmed* carry **[C]** (added 2026-09-25).

### 15.1 Scoring

| ID | Decision | Status |
|---|---|---|
| SCR-001 | A puzzle scores only if it is **fully correct** (all-or-nothing). No partial credit; a wrong or blank cell means 0 for that puzzle. Discards the proportional per-cell model. | Confirmed (2026-09-24) |
| SCR-002 | **Early-finish bonus exists only in the Individual stage**, and only when the round is finished with everything correct. It counts **whole minutes only** (1 min 30 s counts as 1 minute). **Team rounds get no early bonus.** The value per minute is customizable (`context-feeders/archive/client-view.md` default: 3 per minute). | Confirmed (2026-09-24); the per-minute value was assumed — **noted 2026-09-26: rate, rounds and the reading of "everything correct" are set in SCR-008** |
| SCR-003 | **Points are defined per question, according to difficulty, and each question's points are customizable.** This supersedes the earlier answer "same points for every question in a round" and the planning-document rule of a flat 100 per question. | Confirmed (2026-09-24) — whether a round's total is fixed (the original client document says 100 per round) or simply the sum was open — **noted 2026-09-26: the total is the sum, with a warning if an Individual round is not 100 (SCR-006)** |
| SCR-004 | **School total** = (sum of the two-round individual scores of the school's players in that category) × coefficient (default **0.6**, customizable) + (the school's two-round team-stage scores). **Each school has exactly one team per category.** A **school ranking** by this total is required. | Confirmed (2026-09-24); which players count is assumed (all of the school's players in that category) |
| SCR-005 | **Every numeric value is customizable**: points, coefficient, bonus, question counts, times. Only the controller can change them, and only before a round starts. The structure and rules (which stages and rounds exist) stay fixed. | Accepted proposal (2026-09-24) — **noted 2026-09-26: "before a round starts" means before its preparation begins (RND-002)** |

### 15.2 Event structure and roles

| ID | Decision | Status |
|---|---|---|
| EVT-001 | Real scale: about **600–720 students** (the stated numbers do not add up), **11 rooms** (10 of about 30 students + 1 of about 300), **at least 30 judges**, **10 big screens**. Design and test target: about 800 clients. | Confirmed (2026-09-24); exact numbers open |
| EVT-002 | Several categories run **at the same time**; simultaneous sessions are all Individual or all Team. One start command starts all categories together; rankings are computed **per category**. Rooms are simply groups of participant numbers. | Accepted proposal (2026-09-24); whether a room mixes categories is open |
| ROL-001 | The **controller (控制员)** is the administrator. | Assumed — to confirm |
| ROL-002 | The controller can do **everything a judge can**, plus event setup, rules and customization. | Confirmed (2026-09-24) |
| ROL-003 | Only the controller **starts, pauses and ends a round** for everyone. Each judge is assigned a range of participant numbers, sees the status of those students (connected, submitted) and can restart the round of a single student. | Accepted proposal (2026-09-24) — **noted 2026-09-26: what a restart does is set in SUB-005** |
| ROL-004 | The controller sees all progress **in real time** and can **take over** when a judge loses connection. | Confirmed (2026-09-24); manual takeover with last-action-wins is assumed |
| ROL-005 | **Reset / rematch:** the controller can reset the whole event, one round, one person or one team; resetting parts that already have scores is treated as a **rematch**, and the old scores are **archived, not deleted**. After a network or server failure the round is replayed; the judge or the controller can trigger it. The stakeholder believes the network is the most likely cause. | Confirmed (2026-09-24); archiving is an accepted proposal |

### 15.3 Big screens

| ID | Decision | Status |
|---|---|---|
| BSC-001 | All big screens open from **one shared link**, with no per-screen login. They coordinate and show the **same content**. | Confirmed (2026-09-24) |
| BSC-002 | With **one** screen, judge and controller both control it; with **several** screens, only the controller does. Screens show what the controller chooses (a category leaderboard, the school ranking, a close-up of a student or a team), with optional automatic rotation between categories. Final results are shown on the screens at the end. | Confirmed (2026-09-24); the stakeholder also offered "controller only in every case" |

### 15.4 Results, answers and data

| ID | Decision | Status |
|---|---|---|
| RES-001 | **Answers are kept.** Unanswered questions are stored as wrong answers. If a student answered but the system lost the data, it is filled with wrong answers **marked "auto-filled"**; the controller can review and correct it, or order a rematch. | Accepted proposal (2026-09-24) |
| RES-002 | The controller/admin **exports final scores, rankings and answers to a file**; results are also shown on the big screens. | Confirmed (2026-09-24); file format open |
| RES-003 | The controller can **correct scores** with a mandatory reason; ranks are recalculated automatically and a **change log** records who changed what. The stakeholder's earlier "rankings must be editable" is met this way. | Accepted proposal (2026-09-24); the stakeholder's exact intent is open |
| RES-004 | **15 days after the competition** the answers, scores and student accounts are permanently deleted; setup, questions and judges are kept. Copying an old competition after that requires re-importing the student list. | Accepted proposal (2026-09-24) |

### 15.5 Participants and devices

| ID | Decision | Status |
|---|---|---|
| PAR-001 | Participant numbers are **system-generated**: schools in Excel order, then students in row order; unique across the whole event; a team's numbers are consecutive. Printed on the credential slip and stuck on the tablets. | Accepted proposal (2026-09-24) |
| PAR-002 | Usernames and passwords for students and judges are **printed**. | Confirmed (2026-09-24) |
| PAR-003 | Individual students can be **added, edited or replaced before, during and after** the competition, in addition to the Excel upload. | Confirmed (2026-09-24); a new slip for added students is assumed |
| PAR-004 | The participant file needs **Name, School, Category and Team** (the school total requires the school). The number is generated. | Working position |
| PAR-005 | **One active device per account.** A student whose tablet fails can continue on another tablet with the same login (saved answers and remaining time carry over; the new login takes over). The judge sees how many times a student left the answer page — information only, no automatic penalty. | Accepted proposal (2026-09-24) |
| PAR-006 | Students use **Quark Browser on learning tablets (学练机)**. If the tablet is held upright, a "please rotate your device" screen is shown. | Confirmed (2026-09-24); exact model and version open |

### 15.6 Team stage

| ID | Decision | Status |
|---|---|---|
| TEM-001 | **Only two team modes:** rotation and "齐心协力" (working together). The buzzer-style mode is dropped. **Rotation is built first.** | Confirmed (2026-09-24) |
| TEM-002 | Rotation defaults: **10 questions** per round and **60 seconds** per rotation, both customizable. Teammates do not communicate through the system. | Confirmed (2026-09-24) |
| TEM-003 | "齐心协力": the stakeholder's words suggest a shared board where the whole team sees and can edit each other's entries, but the rules are **not defined**. | **Open** — see `unmade-decisions.md` (U-21: very probably the client's "partition collaboration") |
| TEM-004 | **Rotation rules follow the client's mind map** (`context-feeders/archive/client-view.md` §3): parameters n (2–6, default 4), m (default 10), s (default 10 points per correct answer), t (default 60 s), T (total time, custom or unlimited); five steps — initial deal of `min(n, m)`, timed clockwise rotation including empty seats, instant refill on submit, fewer questions than members leaves some waiting, finish when the queue is empty or T is reached. Written out in `context-feeders/requirements/REQUIREMENTS.md` §4.1. | Confirmed (2026-09-24) — the stakeholder said "the rules follow the mind map" |

### 15.7 Competition management and UI

| ID | Decision | Status |
|---|---|---|
| CMP-100 | A **copy button** duplicates a configured competition and restarts it as a new one, keeping settings, questions and judges (not results). | Confirmed (2026-09-24); the stakeholder said "everything stays the same", so what exactly is copied is partly open |
| CMP-101 | **First version: each competition uploads its own questions.** The reusable question bank (edit, delete, archive, versions) comes later. | Confirmed (2026-09-24) |
| UI-001 | Individual answer screen: **landscape**, puzzle on the left, number pad on the right, **previous/next and question-number buttons**, a **delete** button (clears the selected cell) and a **clear-all** button (starts the puzzle over); both ask for confirmation. | Confirmed (2026-09-24) |
| UI-002 | The team answer screen can be built first and refined later; UI details can be iterated. | Confirmed (2026-09-24) |

### 15.8 Scoring and round rules — project owner's answers to Part 1 of the stakeholder question pack (2026-09-26)

These rows answer questions Q1 to Q6 of `context/_stakeholder-question-pack.md` and the context builder's follow-ups. They were answered on 2026-09-26 through the project owner, who answered in the stakeholder's role, and are recorded as **Confirmed** (tag **[C]** in `context-feeders/requirements/REQUIREMENTS.md`). If one changes later, it is treated as the stakeholder changing their mind: a new dated row supersedes it. They apply to the **Individual stage** unless a row says otherwise. Where a row extends an earlier one, both are kept.

| ID | Decision | Status |
|---|---|---|
| SCR-006 | **Points are defined by the controller**, per question, before a round starts; no default split of the 100 is imposed. A round's total is **the sum of its question points**, calculated and not stored as a fixed 100. If an Individual round's total is not 100, the controller sees a **warning** before the round starts, but is not blocked. Resolves the open part of SCR-003. Whether the question PDF also carries points is still open (U-03, U-01: a sample PDF is to be sent). | Confirmed (2026-09-26) |
| SCR-007 | **Team rounds have no fixed maximum.** The team score is the number of correct answers times the points per question (rotation defaults: 10 questions, 10 points, TEM-004). No "total is not 100" warning for team rounds. | Confirmed (2026-09-26) |
| SCR-008 | **Early-finish bonus:** it applies in **both** Individual rounds, at **3 points per whole minute** (customizable, SCR-005). It is earned when the student submits before time ends with **every puzzle of the round fully correct**. Fixes the rate and the rounds left open in SCR-002 and the reading of "everything correct". | Confirmed (2026-09-26) |
| SCR-009 | **Maximum bonus:** no limit by default. The controller may set an optional maximum, in points, separately for each Individual round; empty means no cap. | Confirmed (2026-09-26) |
| SCR-010 | **The bonus is part of the round score**, so a round score can exceed the round maximum. The individual ranking (total of the two rounds) and the school total (SCR-004) use that round score. | Confirmed (2026-09-26) |
| SCR-011 | **How the bonus is measured:** on the server round timer, which stops during a pause, in whole minutes. It is **fixed at the student's own manual submit** and never changed afterwards. An **automatic submission** (time expiry or the controller ending the round early) gets **no bonus**. A student who submitted earlier keeps their bonus. | Confirmed (2026-09-26) |
| SCR-012 | **Allowed values for the controller's numbers:** question points, the bonus rate and counts are **whole numbers**, so scores are stored as integers. Zero is allowed for the bonus (meaning no bonus). Times and question counts must be greater than zero. The school coefficient accepts decimals (default 0.6). No maximum, except the optional bonus cap of SCR-009. Points of a question: see SCR-014. | Confirmed (2026-09-26) |
| SCR-013 | **The school total** (SCR-004) is stored as an **exact decimal**, not a floating-point number, and is **neither rounded nor truncated**. Schools are ranked on the exact value, and it is shown with its decimals. Question and round scores stay whole numbers (SCR-012). | Confirmed (2026-09-26) |
| SCR-014 | **Points of a question:** a whole number of **at least 1**. **Negative** points are not allowed (no negative marking is documented, SCR-001) and **zero** is not allowed either. | Confirmed (2026-09-26) |
| SCR-015 | **Points in the team rotation round:** the controller sets **one** "points per question" value for the whole round (default 10, TEM-004). A team's score is the number of correct answers times that value; for example 4 correct answers give 40 with the defaults. The questions are dealt at random, so one value keeps team scores comparable. | Confirmed (2026-09-26) — extends TEM-004 and SCR-007 |
| SCR-016 | **The "total is not 100" warning (SCR-006) is checked per category and per round**, because question points follow each category's question set (RND-005): for example it is shown for U12's round 1 (90 points) and not for U8's (100). It names the category and the round. The controller sees it in two places: on the **setup screen**, next to the points and updated as they are typed, and as a **summary when starting the stage**, listing every category and round whose total is not 100. It never blocks; the controller can start anyway. It applies to Individual rounds only. | Confirmed (2026-09-26); resolves I-29 |
| SUB-001 | **A student submits once for the whole round.** Until then the student moves freely between the 6 puzzles and can edit any of them. After submitting, all puzzles of the round are read-only and the submission is final. | Confirmed (2026-09-26) |
| SUB-002 | **Confirmation before the final submit** ("are you sure?"), because it cannot be undone. A student **may submit with blank puzzles**, which score 0 (SCR-001); the confirmation states how many puzzles are blank. | Confirmed (2026-09-26) |
| SUB-003 | **Late submit:** the **server clock decides**. A manual submit that reaches the server after the round timer has ended is not counted as a manual submit; the student's latest autosaved answers are submitted automatically instead, as at any time expiry. **No grace period** (the stakeholder role judged it fair, since answers are saved in real time). The student sees the same state as any student whose time expired: puzzles read-only, submission shown as received, no score, and **no separate message** about lateness. This rule is for the Individual rounds; the team rotation is in SUB-006. Closes I-11. | Confirmed (2026-09-26) |
| SUB-004 | **No automatic end of a round** when every student has submitted. A round runs until its timer ends or the controller ends it. | Confirmed (2026-09-26) |
| SUB-005 | **A judge's single-student restart** (ROL-003) is treated as a **one-person rematch** (ROL-005): a restart is allowed **only while the round is running**; the earlier submission and score are **archived, not deleted**; the restarted round starts with a **blank grid** and the **remaining round time**, so the student has the same deadline as everyone and there is one shared server timer; the early bonus (if any) is measured on that round timer (SCR-011). This differs from a tablet failure, where the student continues with the saved answers (PAR-005). If a restart would come too late to be useful, the remedy is the replay of the round, which the judge or the controller can trigger (ROL-005). Known trade-offs: the student has already seen the puzzles, and a late restart leaves little time. | Confirmed (2026-09-26) — **the first version (full round time) was replaced the same day because it conflicted with the shared server timer; resolves U-81** |
| SUB-006 | **Team rotation timing:** the rotation period (TEM-002) is not a deadline for answering. When a question moves to the next teammate, the **partly filled grid goes with it**; a submit for a question the tablet no longer holds is **rejected** and the member sees the new question; if a total round time is set, when it ends **only answers already submitted and correct count**. | Confirmed (2026-09-26) |
| SUB-007 | **Students see their own score and rank after the results are published.** Right after a submit the student sees the submission accepted and no score. When results count as "published" is still open (U-24). | Confirmed (2026-09-26) |
| SUB-008 | **Restarting the same student:** a judge may restart the same student **as many times as needed** while the round is running. There is no separate limit and no controller approval. Each restart archives the earlier attempt (SUB-005), so the number of restarts stays visible afterwards, and the remaining round time keeps getting shorter. Known trade-off: each restart lets the student see the puzzles again. | Confirmed (2026-09-26) |
| RND-001 | **Preparation countdown:** the countdown before each round lasts **60 seconds** by default. The controller can change it for each round before that round starts (SCR-005). The preparation screen shows the round's rules and the countdown. When the countdown reaches zero, the puzzles appear and the round timer starts immediately; there is no extra "3, 2, 1, Start" at that point. A pause during preparation stops the countdown (for example at 35 seconds); on resume the "3, 2, 1, Start" shows first, and then the countdown continues from where it stopped, not from 60. The "3, 2, 1, Start" after a pause is separate and uses neither round time nor preparation time. Replaces the earlier team proposal of 30 seconds, which was never confirmed. | Confirmed (2026-09-26); resolves U-34 |
| RND-002 | **"Before a round starts" (SCR-005) means before that round's preparation begins.** Once the preparation countdown has started, no numeric value of that round can be changed, including the countdown length itself; a change applies to the next round. This covers every numeric value the controller can edit (points, bonus, times, counts), not only the countdown. Students are already reading the rules during preparation. | Confirmed (2026-09-26); resolves U-86 |
| RND-003 | **The controller cannot end the preparation early.** The countdown always runs to zero. A shorter wait is set by giving the countdown a shorter length, per round, before the preparation begins. Follows from the closed list of human actions: start a stage, pause, resume, end a round early, reset (J-003, CS-022). | Confirmed (2026-09-26) |
| RND-004 | **Editing a later round's values:** the controller can change a round's values at any time **before that round's preparation begins**. For round 2 that includes before the stage starts and while round 1 is running. The window closes the moment round 1 ends (by its timer or because the controller ended it early), because round 2's preparation then begins automatically. | Confirmed (2026-09-26); applies SCR-005 and RND-002 |
| RND-005 | **Values are set once per round for the whole event, not per category.** The round time, the preparation length, the bonus rate and its cap, and the other numeric values are the same for every category (for example 20 minutes applies to both U8 and U12). Question points belong to the questions and so follow each category's question set (whether categories have their own question files is open, U-32). | Confirmed (2026-09-26); extends EVT-002 and SCR-005 |
| RND-006 | **After a stage ends, the next stage does not start by itself.** Players see the "waiting for the next stage" state (PL-010) and the controller starts the next stage with the same start command, which starts all categories together (EVT-002). Rounds inside a stage still follow each other automatically (J-003). After the last round of the last stage the competition finishes by itself; the controller's "finish" command is for finishing early (REQUIREMENTS §7.4, §7.7), in which case the running round is ended the same way and the competition then finishes; the controller does not press Finish at the normal end, and the competition finishes once the last round's scoring is final. **While waiting between stages:** the students' tablets show a waiting message saying the stage is over and the next stage is coming, with no score or rank at this point (when students see their score is open, U-24, U-88); the big screens keep the ranking cycle, which now includes the final ranking of the stage that just ended, and the controller can switch to any other display at any time (BSC-002). | Confirmed (2026-09-26); resolves U-35 |
| RND-007 | **Finishing the competition early:** the running round is ended the same way as an early end (RND-006, §7.4) and the competition then finishes. **Results:** unplayed rounds have no scores and add nothing, which is the same as counting them as 0; the school total is the individual part × the coefficient plus the team part actually played (0 if the Team stage never started); the round that was running is scored on the students' latest saved state; the results and the export carry a visible **"finished early"** mark. A competition finished early is in the **same finished state** as a normal one: the controller keeps access to the results and can export them (RES-002). It **cannot be resumed** (a finished competition cannot continue); for an interruption such as a fire alarm the controller uses **pause** (stops the timer, preserves the exact state), then resumes. Whether awards apply and whether a reset can still be applied after finishing are open (U-89, U-27). | Confirmed (2026-09-26) |

### 15.9 Build and engineering decisions — answers to the context builder's questions that block coding (2026-09-26)

Answered on 2026-09-26 through the project owner, in the stakeholder's role, and recorded as **Confirmed**; a later change is treated as the stakeholder changing their mind (a new dated row supersedes it). **Deliberately left blank (to be decided later, and to stay blank in the context files):** the backend language and framework (I-02), what the two developers know (I-18), their names and roles and who builds what (I-17, I-23), and where the server runs on the event day (I-03, U-46).

| ID | Decision | Status |
|---|---|---|
| BLD-001 | **Uploaded and generated files** (participant Excel, question PDF, credential slips, exports) are stored **on the server's disk, in a mounted folder**, not in object storage. Where the server runs on the event day is left blank (I-03, U-46). Whether the participant Excel follows the 15-day deletion of student data is open (U-59, U-62). | Confirmed (2026-09-26); resolves I-19 |
| BLD-002 | **Workflow:** one branch per unit, a **pull request before every merge**, and **lint, type check, tests and build in CI** that must pass before a merge. The other developer reviews each pull request; any additional AI-assisted review is left to the team. | Confirmed (2026-09-26); resolves I-25, I-26, I-27 |
| BLD-003 | **Participant credentials:** the **username is the participant number** (numbering: PAR-001) and the **password is a short random code generated by the system**; both are printed on the slip (PAR-002). The format of judge and controller credentials is still open (I-30). | Confirmed (2026-09-26) |
| BLD-004 | **Roles in the data model:** **one role per account**, **several controller accounts allowed**, and "one person with several roles" is handled as **two accounts for the same person**. Resolves U-64 and the "several controllers" part of U-11, and supersedes the older working position OA-002 (exactly one admin); the one-active-device rule per account (PAR-005) is unaffected. | Confirmed (2026-09-26) |
| BLD-005 | **Question sets:** modelled **per category**; a category may point to a shared set. Works for either answer to U-32 and matches RND-005. | Confirmed (2026-09-26) |
| BLD-006 | **Question delivery:** the questions are fetched **at the start of the round**, with no preloading. Preloading encrypted, with the key released at the start, stays a fallback if the load test of about 800 clients shows a problem (I-05). | Confirmed (2026-09-26); resolves I-06 |
| BLD-007 | **Server restart mid-round:** a **replay is acceptable** (ROL-005). Round state changes are kept in PostgreSQL and the working grids in Redis **with persistence turned on**. After a restart the competition comes back **paused**, so the controller chooses to resume or replay. How long an interruption is acceptable remains open (U-49). | Confirmed (2026-09-26); resolves I-10 |
| BLD-008 | **Judge number ranges:** the **controller assigns them during setup, before publishing, and can change them during the event** (participants can be added or edited at any time, PAR-003; the controller can take over from a judge, ROL-004). | Confirmed (2026-09-26) |
| BLD-009 | **First slice of the build: the Individual stage, end to end** (login, import, runtime, scoring, ranking, big screen). The team stage and the design come later; the data model stays ready for team rotation (I-01). | Confirmed (2026-09-26); resolves U-07; not signed off by the stakeholder |
| BLD-010 | **Answer check:** the submitted grid is **compared with the solution stored with the question**, with no rule checker per Sudoku variant. This relies on every puzzle having a **unique solution**; the stakeholder is asked to confirm it (U-90). A wrong stored solution is a separate open point (U-44). | Confirmed (2026-09-26); resolves I-14 |
| BLD-011 | **Grid model:** generic (rows, columns and regions), never assuming 9×9, across the model, the answer check, the answer screen and the question file format. The shapes supported first are the ones that appear in the sample question PDF, which is still to be sent (U-01); how a shape is written in the PDF and how it relates to the question type follow from that sample. | Confirmed (2026-09-26); resolves I-15 |
