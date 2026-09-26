> **[CONTEXT FEEDER NOTE]** Archived source document, already merged into the requirements and decisions and, from there, into `context/`. Kept for reference only; do NOT use it to decide what to build. It is not maintained: the only edits are this note and the updated folder paths.

# Unmade decisions — history (sections 1–15)

**Archived on 2026-09-25 and not edited.** This is the old body of `context-feeders/decisions/unmade-decisions.md`: the open-questions register as it grew from 2026-09-16 to 2026-09-24, with each row marked *Resolved*, *Superseded*, *Moot* or *Tracked as …* when it was closed. It is kept so that nothing is lost and so that the old row IDs (PL-*, JD-*, OA-*, SC-*, FL-*, ARCH-* and so on) can still be looked up.

The **live list** of open decisions is `../decisions/unmade-decisions.md`. What the old text calls *section 16* is now the whole of that file (its sections 1 to 4). Where a resolved row points to `project-decisions.md`, that file and `../requirements/REQUIREMENTS.md` hold the answer.

---

# Sudoku Competition Platform — Unmade Decisions & Open Questions

**Document Status:** Open Questions Register  
**Date:** 2026-09-16  
**Purpose:** Collect every requirement question that has been raised but not yet answered, organized by topic for client/developer discussion. This is the companion to [`project-decisions.md`](./project-decisions.md), which records the decisions that *have* been settled.  
**Guidance:** All questions below must be resolved against the client before the domain model is finalized. The source documents warn against making architecture or technology decisions while requirements are still unstable. **Note:** the architectural *style* has since been decided by the team (see `project-decisions.md` §8.1) — that deviation is recorded there, and the requirements below still need resolving.

> **Note on Flow requirements:** `context-feeders/archive/FLOW_REQUIREMENTS.md` captures the client's vision of the competition flow and system mechanics. Nothing there is confirmed; divergences are recorded in the section "13. Flow Requirements — Client Vision (To Check with Client)" below.

> **Note on Stage requirements:** `context-feeders/archive/STAGE_REQUIREMENTS.md` captures the working definitions of the competition stages. MVP realizes **Individual + Team**; **PK is deferred** (CS-010 / CS-016). Open points are consolidated in section "3.3 Stage Composition & Per-Stage Rankings", "3.4 Individual Stage — Validation & Scoring", and "3.5 Team Stage — Rotation & Other Round Types" below.

> **Note on the new Sudoku Arena MVP documents (flagged 2026-09-23, updated 2026-09-23):** Three new documents were added at the project root — `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`, `context-feeders/archive/Sudoku Arena MVP — Question 2 Decision Summary.md`, `context-feeders/archive/Sudoku_Arena_MVP_Q3_Decision_Summary.md` — outside the `context-feeders/requirements/`/`context-feeders/decisions/` structure described in `CLAUDE.md`. They read as a later, more concrete engineering-planning document for a 15-day MVP sprint. Section 14 below tracks where they conflict with earlier documents: §14.1/§14.2/§14.5 are **resolved** (direct project-owner decision or no real conflict found); §14.3/§14.4/§14.6 remain **genuine open conflicts**, reserved for direct colleague/client review, not to be resolved by this document's author.

> **Note on the stakeholder's second answers (2026-09-24):** the stakeholder resolved most open points. Confirmed decisions are in `project-decisions.md` §15, and what is still open or assumed is in section 16 below. Rows in sections 1–15 marked *Resolved 2026-09-24* or *Superseded 2026-09-24* reflect this.

> **Note on the 2026-09-23 final pre-implementation review:** section 15 below is a separate, later pass — a full re-read of every requirements/decisions document against every other one, specifically hunting for anything not yet captured anywhere. It surfaces gaps and one new incoherence that section 14's Arena-document comparison didn't cover. Sections 1–11 above were each individually reconciled against the Arena documents as part of the same pass (see the "Status note" at the top of each section).

---

## 1. Super Administrator

**Status note (updated 2026-09-23):** The Super Administrator role, and multi-tenancy generally, is **deferred for the current single-tenant MVP** — a deliberate, time-driven scope decision, not a cancellation (see `project-decisions.md` SA-005 / ENV-007, and §14.1 above). The questions below are **not active MVP questions**; they are retained for when the multi-tenant phase is built. A working MVP-era scope for the Super Administrator exists in `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` (tenant overview, competition overview, tenant revocation) for that future phase.

| # | Question |
|---|---|
| SA-1 | What exactly can a Super Administrator do? *(Partially answered — MVP working scope in `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-2 | What are the Super Administrator's responsibilities and permissions at platform level? *(Partially answered — see `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-3 | Does the Super Administrator manage tenants (organizations), billing, platform configuration, or something else? *(Tenant overview/revocation: yes. Billing deferred — no payment system. Platform configuration: open.)* |
| SA-4 | Is there any tenant-level overlap between Super Admin and Organization Admin responsibilities? *(Still open — recorded in `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` §7.)* |
| SA-5 | Should the Super Administrator be able to view competition results of a particular organization? *(Open.)* |
| SA-6 | Should the Super Administrator be able to access competition participants? *(Open — current lean: out of scope.)* |
| SA-7 | What exactly happens when a tenant is revoked/deleted? *(Open — deletion semantics.)* |
| SA-8 | Should Super Administrator access be read-only except for revocation, or can they edit tenant/competition info? *(Open.)* |
| SA-9 | What exactly counts as "basic information" for a tenant and for a competition? *(Open; from question 3 of `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-10 | What analytics, if any, should the Super Administrator see? *(Open; question 4.)* |
| SA-11 | Can a revoked tenant be restored, and can the Super Administrator suspend or block one organization admin without deleting the tenant? *(Open; questions 6 and 7.)* |
| SA-12 | Should Super Administrator actions be auditable, and when a payment system exists, what billing management should the role have? *(Open; questions 10 and 11.)* |

---

## 2. Organization / Tenant Model

**Status note (updated 2026-09-23):** Deferred with §1 above — the MVP has exactly one organization, so multi-org questions are not active MVP questions. Retained for the future multi-tenant phase.

| # | Question |
|---|---|
| ORG-1 | Can an organization have multiple administrators in the future (beyond the MVP one-admin model)? |
| ORG-2 | Is there a future need for organization-level permissions or role hierarchies? |
| ORG-3 | Can the Organization Admin change organization information? |
| ORG-4 | What organization information is required in the MVP? |
| ORG-5 | Can an organization be deactivated? |
| ORG-6 | What happens to an organization's competitions and data after deactivation? |
| ORG-7 | **Resolved 2026-09-24 — answers, scores and student accounts are deleted 15 days after the competition (RES-004).** Earlier question: Is data retention limited (e.g., 1 year, 5 years)? If so, what is the retention policy? |
| ORG-8 | **Moot 2026-09-25 — nothing is kept beyond 15 days, and long-term history and detailed analytics are out of scope (`context-feeders/requirements/REQUIREMENTS.md` §11).** Earlier question: Are historical competitions searchable/filterable by the admin? |

---

## 3. Competition Model & Lifecycle

**Status note (2026-09-23):** the Arena Alignment Guideline resolves this whole section in one stroke: **the competition structure (stages, rounds, counts) is fixed in code for the MVP, not admin-configurable at all.** That single decision resolves or moots most of CMP-9 through CMP-14.

| # | Question |
|---|---|
| CMP-1 | **Resolved.** Competition = name, description, category, participants, questions, organized as Competition → Category → Stages → Rounds (Alignment §4, §6). |
| CMP-2 | **Resolved (2026-09-23):** publish generates the entry link/QR and locks configuration. See `project-decisions.md` CA-004. |
| CMP-3 | **Resolved (2026-09-23):** configuration becomes immutable at publication. See `project-decisions.md` CA-004. |
| CMP-4 | **Resolved.** Yes — publication alone locks it (Alignment §5). |
| CMP-5 | **Moot** — access only exists after publish anyway (the entry link doesn't exist beforehand), so this collapses into CMP-4. |
| CMP-6 | **Resolved as: no.** There is no editable "published but not started" window — publish locks immediately (§5). **Partly superseded 2026-09-24:** numeric values stay editable by the controller until each round starts, and participants can be edited at any time (`project-decisions.md` SCR-005, PAR-003). |
| CMP-7 | **Resolved as: no.** Nothing is modifiable once the competition starts (consistent with CMP-6). **Partly superseded 2026-09-24** — see CMP-6. |
| CMP-8 | **Resolved as: no exceptions.** No exceptional post-publication edit path is described anywhere. |
| CMP-9 | **Resolved as: no.** No audit/versioning system exists (see DP-5). |
| CMP-10 | **Moot.** Stages/rounds are predefined in code, not admin-configured — there's nothing to reorder (Q2.1). |
| CMP-11 | **Moot** — same reason as CMP-10. |
| CMP-12 | **Moot** — same reason as CMP-10. |
| CMP-13 | **Resolved.** Fixed: 2 stages (Individual, Team), each with predefined rounds — not admin-adjustable. |
| CMP-14 | **Moot** — same reason as CMP-10; questions are assigned to fixed predefined rounds via PDF import, not manually restructured. |

### 3.1 Stages & Rounds

| # | Question |
|---|---|
| SR-1 | **Resolved.** See CMP-1 and `context-feeders/archive/STAGE_REQUIREMENTS.md` for the full stage/round definitions. |
| SR-2 | **Resolved for Individual/Team** (see §3.4/§3.5 below); **moot for PK** (deferred). |
| SR-3 | **Resolved.** Fixed for the MVP — Individual + Team only, structure predefined in code, not extensible via the admin UI (Q2.1). |
| SR-4 | **Partially resolved.** Individual: 2 rounds (standard + variant, per `context-feeders/archive/client-view.md` §2.1). Team: the rotation round is confirmed in scope; whether the other two client-listed team round types (分区协作, 抢答夺分) are also in scope is **still open** — see TEAM-1 below. |
| SR-5 | **Resolved as: no** — fixed set only for the MVP, no additional round types. |
| SR-6 | **Resolved 2026-09-25 — the scoring model is settled (SCR-001…SCR-004) and the rotation rules are settled (TEM-004).** Earlier note: **Open — depends on §14.3** (scoring model conflict) for Individual, and on TEAM-5/§13.4 (rotation implementation gap) for Team. |
| SR-7 | **Resolved.** Judge manually starts each **stage** only; everything after that (preparation countdown, round start, round end at timer expiry, advancing to the next round/stage) is automatic. **Manual round start is not supported** — see JD-13/JD-14 in §5.2. |

### 3.2 Category (Age Group) Placement

| # | Question |
|---|---|
| CAT-1 | **Resolved (2026-09-23):** each competition is dedicated to a single category (e.g. `U6`–`U20`). See `project-decisions.md` PT-005. |
| CAT-2 | **Resolved (2026-09-23):** category belongs at the competition level. See `project-decisions.md` PT-005. |

### 3.3 Stage Composition & Per-Stage Rankings

| # | Question |
|---|---|
| STG-2 | **Resolved 2026-09-25 (by earlier answers) —** each stage keeps its own ranking (SC-022) and a school total ranking is required (SCR-004). Earlier question: "No combined final ranking" — does it apply to **individual** standings, **team** standings, or **both**? |
| STG-3 | **Resolved 2026-09-25 —** the school total (individual × 0.6 + team) is a separate school ranking, not a combined individual ranking (SCR-004). Earlier question: How does "no combined cross-stage final ranking" relate to the `context-feeders/archive/client-view.md` **team-total formula** (individual-stage scores ×0.6 + team-stage scores)? |
| STG-4 | **Resolved 2026-09-25 —** yes, each stage ends with its own final ranking (SC-020, SC-022). Earlier question: Does each stage indeed end with its **own final ranking**, with no cross-stage aggregation? |

*(STG-1 — "is the stage set Individual + Team + PK confirmed, or is PK reserved?" — is now **resolved**: MVP realizes Individual + Team; PK is deferred. Recorded as CS-010 / CS-016 in `project-decisions.md`.)*

### 3.4 Individual Stage — Validation & Scoring

| # | Question |
|---|---|
| IND-1 | **Answered in the build 2026-09-25 (team decision, not reviewed by the stakeholder) —** the submitted grid is compared with the solution stored from the PDF (`context-feeders/requirements/REQUIREMENTS.md` §3, EX-010); the remaining edge case is I-14. Earlier question: Is the **recognizer + solution grid + completion-check** approach acceptable for validating answers in the Individual stage? (Proposed by the developer; must be confirmed with the client.) *(Entangled with the open scoring-model conflict at §14.3 — a pure completion-check fits the all-or-nothing model; the proportional/per-cell model would need per-cell recognition instead.)* |
| IND-2 | **Moot 2026-09-25 —** scoring is all-or-nothing per question with points set per question (SCR-001, SCR-003), so no per-type scoring is needed. Earlier question: If completion is **not** used, what is the **per-question-type scoring system** for the Individual stage and all its rounds? *(Same dependency on §14.3.)* |
| IND-3 | **Question types** for the Individual stage are to be defined. Which types exist, and how are they determined? |
| IND-4 | What **puzzle shapes** are supported (e.g., 9×9, 9×6)? How does shape relate to question type? |

### 3.5 Team Stage — Rotation & Other Round Types

| # | Question |
|---|---|
| TEAM-1 | **Resolved 2026-09-24 — two modes: rotation and "齐心协力" (`project-decisions.md` TEM-001); the buzzer mode is dropped.** Earlier question: Is the **rotation round** the only team round type in MVP scope, or are 分区协作 (partition collaboration) and 抢答夺分 (quick-answer scoring) also in scope? |
| TEAM-2 | **Resolved 2026-09-24 — 10 by default, customizable (TEM-002).** Earlier question: What is the **total puzzle count** for the rotation round — the `context-feeders/archive/client-view.md` example uses 10; a typical discussion mentions 16? |
| TEAM-3 | **Resolved 2026-09-24 — 60 seconds by default, customizable (TEM-002).** Earlier question: What is the exact **rotation interval** (`context-feeders/archive/client-view.md` default is 60s; "a couple of minutes" was mentioned)? |
| TEAM-4 | **Resolved 2026-09-24/25 —** points s per correct question, no early bonus in team rounds (SCR-002), rotation rules TEM-004, ranking per SCR-004; the tie-break is U-22. Earlier question: What is the exact **scoring/ranking model** for the rotation round (per-puzzle points, early-completion bonus, penalties, tie-breaks)? |
| TEAM-5 | **Resolved 2026-09-24 —** the system checks the answer automatically (EX-001) and the member's tablet is refilled immediately from the queue (TEM-004). Earlier question: What happens when a puzzle is completed — who validates it, and how does replacement from the remaining pool behave (replenish immediately vs at next rotation)? |

---

## 4. Player Role

**Status note (2026-09-23 final pre-implementation review):** most of this section is now answered by `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`. Resolved items are marked inline; genuinely still-open items remain as questions.

### 4.1 Competition Access & Identity

| # | Question |
|---|---|
| PL-1 | **Resolved.** Competition-specific link/QR (generated at publish); player logs in with a system-generated username/password (Alignment §11, Q2.4). |
| PL-2 | **Resolved.** Yes — login with personal credentials identifies the player. |
| PL-3 | **Resolved.** Via the competition's participant dataset, created from the Excel import. |
| PL-4 | **Resolved.** Yes to both — authentication is required, and every player has a system-generated account (no anonymous/guest access). |
| PL-5 | **Resolved 2026-09-24 — credentials are printed slips (`project-decisions.md` PAR-002).** Earlier note: The admin can *generate and export* the username/password list (Q2.4), but **how those credentials physically reach each student is not specified anywhere** (printed handout? teacher relay? email? nothing said). Needs an answer before the competition-day process can be planned. |
| PL-6 | **Partially resolved.** "Players cannot participate unless they belong to the competition's participant dataset" (Alignment §11) — but the exact error/UX shown to a rejected login attempt is not specified. Low priority. |

### 4.2 Device & Session Behavior

| # | Question |
|---|---|
| PL-7 | **Resolved 2026-09-24 — one active device per account (PAR-005).** Earlier note: Concurrent multi-device/multi-tab login by the same player is never addressed — is a second simultaneous session blocked, allowed, or does it kick the first? |
| PL-8 | **Resolved.** A page refresh is functionally a reconnect: the server is timer-authoritative and restores the latest saved grid (§15). |
| PL-9 | **Resolved** — same mechanism as PL-8. |
| PL-10 | **Resolved 2026-09-24 — a device swap is allowed and the new login takes over (PAR-005).** Earlier note: same underlying question as PL-7 (does logging in from a new device end the old session, or can both be active?). |
| PL-11 | **Partially resolved.** State recovers correctly within the same login/session (§15). Whether that extends cleanly across a genuine device change (not just a reconnect) is untested by the documents. |

### 4.3 Network Failure

| # | Question |
|---|---|
| PL-12 | **Resolved** (Alignment §15). |
| PL-13 | **Resolved** — latest saved grid restored, server timer continues regardless (§15). |
| PL-14 | **Resolved** — if the round ends while disconnected, the latest saved state is auto-submitted and scored exactly as if connected (§15). |

### 4.4 Round Behavior & UI

| # | Question |
|---|---|
| PL-15 | **Partially resolved.** The competition room shows Competition, Category, Stages, and current state (§11) — but the exact visual layout/detail is undefined. Low priority (UI detail). |
| PL-16 | **Resolved 2026-09-25 — the preparation room shows the round's rules and a countdown (`context-feeders/requirements/REQUIREMENTS.md` §7.3, PL-004).** Earlier note: **Still open** — the flow names a "Preparation Room" and "Countdown" (§12) but never describes what's actually displayed there (rules text? just a timer?). |
| PL-17 | **Resolved.** Yes — the player can freely edit the puzzle until submission (§13). |
| PL-18 | **Resolved.** Submission is confirmed as accepted; puzzle becomes read-only; player does not see their score immediately (§12). |
| PL-19 | **Resolved.** No — the puzzle is locked/read-only after submission (§12, §14). |
| PL-20 | **Resolved for Individual** (standard submit/score/rank flow). **Still open for Team** — depends on the unresolved rotation-mechanic implementation gap (§13.4). |
| PL-21 | **Resolved.** No real-time correctness feedback is shown (§13). |
| PL-22 | **Resolved.** No player-facing results screen; results are presented only via the Big Screen (Q2.14, Q3.17). |
| PL-23 | **Resolved.** Only via the Big Screen — players do not get their own final-results view (Q2.14, Q3.17). |

### 4.5 Team Rounds

| # | Question |
|---|---|
| PL-24 | **Resolved** — see `context-feeders/archive/STAGE_REQUIREMENTS.md` §4.3 (TEAM-010…TEAM-015) and `context-feeders/archive/client-view.md` §3, confirmed as still authoritative (§13.4). |
| PL-25 | **Resolved** — same source: puzzles rotate ~every 60s, replenished from a shared pool on completion. |
| PL-26 | **Resolved 2026-09-24 — no in-system communication between teammates (TEM-002).** Earlier note: no document anywhere addresses whether teammates can communicate through the platform (chat, voice, etc.) during a round. |
| PL-27 | **Resolved** — same source (team progress = pool depletion + per-teammate current puzzle). |
| PL-28 | **Resolved** — same source (team finishes when the puzzle pool is exhausted or time runs out). |
| PL-29 | **Resolved for the mechanic** (accumulate points per solved puzzle); **the exact formula question is separately tracked as an open conflict at §14.4.** |

---

## 5. Judge Role

**Status note (2026-09-23 final pre-implementation review):** most of this section is now answered by `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`. Big Screen authentication (§5.5) is the one area still largely unaddressed even by the newest documents — flagged as a real gap, not just an open question, in §15 below.

### 5.1 Access & Authentication

| # | Question |
|---|---|
| JD-1 | **Resolved.** Organization Admin creates/assigns; only the judge's **name** is required (Q2.10). |
| JD-2 | **Resolved** — same as JD-1: just a name. |
| JD-3 | **Resolved.** Yes — judges exist at the organization level (a reusable judge list) and are then assigned to a specific competition (Q2.10). |
| JD-4 | **Superseded 2026-09-24** — see JD-5. Whether a judge may serve several events over time is no longer addressed and not needed now. |
| JD-5 | **Superseded 2026-09-24:** at least 30 judges are needed, each assigned a range of participant numbers. See `project-decisions.md` §15.2 ROL-003. |
| JD-6 | **Resolved.** Standard username/password login (`POST /auth/judge/login`); credentials are system-generated at judge creation and shown to the admin in a modal (Q2.10). This **supersedes** the earlier "potentially OTP" language in `project-decisions.md` JM-004/PT-004 — no OTP appears anywhere in the Arena documents, just password login. |
| JD-7 | **Partially resolved.** The admin sees the credentials immediately (Q2.10) — but exactly how they get **from the admin to the actual judge** (verbally? printed? messaged?) is not specified. Same open gap as PL-5. |
| JD-8 | **Resolved differently than originally framed.** There isn't a special "access link that establishes context" — it's ordinary role-based login (username/password), scoped to the one competition the judge is assigned to. |
| JD-9 | **Tracked as I-13 (rejected login message) from 2026-09-25.** Earlier note: **Still open** — no document describes the error/UX for a failed or unauthorized judge login attempt. Low priority (standard auth failure handling). |
| JD-10 | **Assumed answered 2026-09-24** — the controller manages judge assignments (ROL-002/ROL-003); to confirm in §16. |
| JD-11 | **Resolved 2026-09-24** — the controller can do everything a judge can and takes over when a judge is missing or disconnected (`project-decisions.md` ROL-002/ROL-004). |

### 5.2 Competition Control

| # | Question |
|---|---|
| JD-12 | **Resolved.** "Start" at stage level = judge triggers the stage; it becomes active and preparation begins automatically (Alignment §5, Flow C). |
| JD-13 | **Resolved, and narrower than originally proposed.** The Judge's documented commands (Alignment §16, §27) are: start stage, pause, resume, end round early, finish competition, cancel. **There is no "manually start an individual round" command anywhere in the Arena documents** — rounds always progress automatically once a stage is started. |
| JD-14 | **Resolved as: not supported in the MVP.** `context-feeders/archive/JUDGE_REQUIREMENTS_PROPOSAL.md` J-005 (manual round start as an exception path) does not appear in the Arena command list at all. **Worth an explicit confirmation that dropping this exception path was intentional**, since the original Judge proposal treated it as a real operational need (e.g., recovering from a stuck automatic transition). |
| JD-15 | **Resolved.** Pause is global: timer stops, all players blocked, all state preserved, big screen shows "Paused" (Q2.17–19). |
| JD-16 | **Resolved.** Yes — judge resumes with a 3-2-1-Start countdown that does not consume round time (Q2.20). |
| JD-17 | **Resolved.** Yes, unchanged (Q2.17). |
| JD-18 | **Resolved.** "Premature end" applies at the round level: judge ends the current round early (Alignment §17). |
| JD-19 | **Resolved.** Yes — auto-submits every player's latest saved state, evaluates, scores, updates ranking, then proceeds normally (Alignment §17). |
| JD-20 | **Resolved (implicitly).** No reversal/undo mechanism is described anywhere — treat as not reversible. |

### 5.3 Monitoring & Display

| # | Question |
|---|---|
| JD-21 | **Resolved, and narrower than originally proposed.** "There is no separate inactive/absent status in the MVP" (Alignment §15) — the Judge does **not** get a distinct connected/disconnected indicator per player. **Worth confirming this simplification is acceptable**, since the original Judge proposal (J-008) treated connectivity monitoring as operationally valuable (e.g., to investigate a stuck device). |
| JD-22 | **Resolved as: no.** No per-participant elapsed-time display is described. |
| JD-23 | **Resolved as: no.** No per-participant progress/completion indicator is described — consistent with "no immediate correctness feedback" applying to the Judge's view too, not just the player's. |
| JD-24 | **Resolved as: nothing special.** Since there's no disconnect status (JD-21), there's no judge action tied to it — the server handles reconnection transparently. |
| JD-25 | **Still open** — depends on the unresolved team-rotation implementation gap (§13.4); no team-specific monitoring view is described. |
| JD-26 | **Resolved.** None needed — ranking is simply always visible to the Judge in real time (`RANKING_UPDATES` pushed continuously, Alignment §28), not gated behind a decision. |
| JD-27 | **Resolved** — same as JD-26: always visible, updated after every finalized round. |

### 5.4 Results & Publication

| # | Question |
|---|---|
| JD-28 | **Resolved.** There is no separate manual "publish" action — results finalize automatically on submission/scoring and become visible via the Big Screen immediately (Alignment §18–21). |
| JD-29 | **Resolved.** Yes — finalization = immutability, automatically, with no separate lock step. |
| JD-30 | **Resolved as: no.** No human confirmation step exists anywhere in the MVP design (Alignment §21: "No result correction UI exists... no dispute workflow"). |
| JD-31 | **Resolved.** Immediately upon each round's finalization (Alignment §19, Q3.4). |

### 5.5 Big Screen

| # | Question |
|---|---|
| JD-32 | **Resolved (PK modes excluded, deferred).** Normal ranking cycle (paginated, 3-min rotation), individual player projection, team projection (Alignment §22). |
| JD-33 | **Resolved 2026-09-24** — one screen: judge and controller; several screens: controller only (`project-decisions.md` BSC-002). |
| JD-34 | **Resolved 2026-09-24** — last action wins when both may control (BSC-002). |
| JD-35 | **Tracked as I-07 (screen command log) from 2026-09-25; the client document requires screen commands to be traceable.** Earlier note: **Still open**, likely "no" by pattern (the MVP has no audit system anywhere — see DP-5), but never explicitly stated for Big Screen actions specifically. |
| JD-36 | **Resolved.** Yes — the judge can switch the projected target at any time (Alignment §22). |
| JD-37 | **Resolved 2026-09-24** — one shared link, no per-screen login (`project-decisions.md` BSC-001). |
| JD-38 | **Tracked as U-15 (the big-screen link can be regenerated) from 2026-09-25.** Earlier note: **Still open (minor)** — whether the shared link can expire or be regenerated; assumed yes, see §16. |
| JD-39 | **Resolved 2026-09-24** — yes, 10 screens show the same content from one link (BSC-001). |
| JD-40 | **Assumed** — the controller opens the link on the screens; see §16. |

---

## 6. Organization Admin — Open Functional Questions

**Status note (2026-09-23 final pre-implementation review):** most of this section is now answered by `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`. A few resolutions are actually **scope narrowings** worth an explicit sanity check (marked below), and two areas (question point-values, competition/config reuse) surfaced a genuinely new incoherence/gap — see §15.

### 6.1 Participants / Teams

| # | Question |
|---|---|
| OA-1 | **Resolved.** Name, Category, Team (Alignment §7). Narrower than the candidate field list in `context-feeders/archive/FLOW_REQUIREMENTS.md` FLW-051 (which also considered School, Age, City/Province) — worth confirming nothing else is actually needed. |
| OA-2 | **Resolved.** Missing name/invalid category/invalid team size/conflicting team membership → reject the whole file; exact duplicate rows may be auto-cleaned (§7). |
| OA-3 | **Superseded 2026-09-24 — adding, editing and replacing individual students is now required, before, during and after the competition (`project-decisions.md` PAR-003).** Earlier answer: there was no "add one participant" operation anywhere — only whole-file re-upload before publish (Q2.5). **Worth confirming this is intentional** — a single late registration currently means re-uploading the entire Excel file. |
| OA-4 | **Superseded 2026-09-24** — individual edit and replace are now required (PAR-003). Earlier answer: no individual edit, only full-file replace (Q2.6–2.7). |
| OA-5 | **Resolved.** A "team" value/column in the participant Excel (§7). |
| OA-6 | **Resolved** for the stated case (same person in conflicting teams → reject the file). |
| OA-7 | **Resolved as: no** — implied by the "conflicting teams → reject" rule. |
| OA-8 | **Resolved.** Only before publish, via full re-upload; locked after publish (§7). |

### 6.2 Question Bank / PDF

| # | Question |
|---|---|
| OA-9 | **Partially resolved — and surfaced a new incoherence, see §15.1.** A question = puzzle + solution + parameters (score, difficulty, type) per the PDF structure (`context-feeders/archive/FLOW_REQUIREMENTS.md` FLW-043). **But** per-question "score" as a PDF field conflicts with the confirmed flat 100-points-per-question scoring rule — see §15.1. |
| OA-10 | **Tracked from 2026-09-25 as U-01 (real sample question file not received) and IND-3 (question types): the rule that classifies a question into a round depends on the real file format.** Earlier note: **Still open** — "classify/assign to predefined rounds" is mentioned (Alignment §9) but the actual compatibility rule is never defined. |
| OA-11 | **Resolved.** Yes — a PDF is expected to contain the whole question pack for a competition (§9). |
| OA-12 | **Resolved as: no accuracy threshold — all-or-nothing.** Any structural/parsing/extraction/classification failure rejects the entire import (§9). |
| OA-13 | **Resolved** — same as OA-12: full rejection, no partial commit, admin must fix the PDF or use the Question Bank instead. |
| OA-14 | **Tracked as U-43 from 2026-09-25 (assumption: the original PDF is kept with the competition).** Earlier note: **Still open** — whether the original PDF file itself is retained after successful import is never stated. |
| OA-15 | **Resolved by design 2026-09-25 — extracted questions are not edited in the app; the admin corrects the PDF and imports it again (`context-feeders/requirements/REQUIREMENTS.md` §7.2 step 6).** Earlier note: **Still open** — no edit capability for extracted questions is described. |
| OA-16 | **Later (CMP-101): question deletion and archiving belong to the reusable question bank.** Earlier note: **Still open** — no delete/archive capability for questions is described. |
| OA-17 | **Resolved.** Yes — the Question Bank exists specifically for reuse across competitions (§9). |
| OA-18 | **Later (CMP-101): question versioning belongs to the reusable question bank.** Earlier note: **Still open** — no versioning concept is described. |

### 6.3 Competition Reuse

| # | Question |
|---|---|
| OA-19 | **Resolved 2026-09-24 — a copy button is required (`project-decisions.md` CMP-100).** Earlier note: None of the three new Arena documents mention reusing/duplicating a whole competition configuration at all — not even in their "explicitly out of scope" list, so it's unclear whether this was cut or simply not yet planned. |
| OA-20 | **Resolved 2026-09-24** — the copy keeps settings, questions and judges (CMP-100). |
| OA-21 | **Resolved 2026-09-24** — results are not copied; students are kept only within the 15-day retention (CMP-100, RES-004). |
| OA-22 | **Resolved 2026-09-24 — copy is now required (CMP-100).** Earlier note: the older `project-decisions.md` CR-001/CR-002 (Working Position, "not required for MVP but may be considered") predates the Arena documents and was never reconciled with their silence on the topic. |

### 6.4 Analytics & Results

| # | Question |
|---|---|
| OA-23 | **Resolved — and narrowed.** Final ranking + final scores only (Q2.15). Explicitly **not** included: individual grids, per-question answers, timestandard breakdowns, move history (Q2.15). |
| OA-24 | **Resolved as: overall/final only** — no round-level or stage-level breakdown is exposed to the admin, only the final stage ranking (Q2.15, Q3.16–17). |
| OA-25 | **Resolved 2026-09-24/25 — the team scoring is the rotation rule with s points per correct question (TEM-004) and the school total (SCR-004).** Earlier note: **Open conflict — see §14.4 / SC-4.** |
| OA-26 | **Resolved 2026-09-24 — export of scores, rankings and answers is required (`project-decisions.md` RES-002); the file format is still open (§16).** Earlier note: `project-decisions.md` OA-134/RA-005 confirm the admin should be able to export results, but the Arena documents' minimum API (§27) has **no export endpoint at all** — only `GET .../results` and `GET .../ranking`, presumably for on-screen display. Whether an actual file-export feature is still planned is unclear. |
| OA-27 | **Partly resolved 2026-09-24** — the export holds scores, rankings and answers (RES-002); the exact columns are open (§16). |

### 6.5 Live Admin Access

| # | Question |
|---|---|
| OA-28 | **Superseded 2026-09-24 — the controller needs a real-time view of all progress and can take over (`project-decisions.md` ROL-004).** Earlier answer: no. The Arena documents give the Admin only HTTP setup/results endpoints (§27) — no WebSocket channel exists for the Admin (only Player, Judge, Big Screen do, §28). No live view during an active competition. |
| OA-29 | **Moot** — resolved as OA-28: no live access is planned, so no operational decision needs it. |
| OA-30 | **Moot** — same as OA-29. |
| OA-31 | **Resolved.** Yes, by a wide margin — the Admin currently sees nothing live, versus the Judge's full real-time channel. |

### 6.6 Competition Access Model

| # | Question |
|---|---|
| OA-32 | **Resolved for Player/Judge.** One entry link/QR is generated at publish (Alignment §5); Player and Judge each then authenticate separately via role-specific username/password logins. **Still open for Big Screen — see §15.2.** |
| OA-33 | **Resolved.** Yes, generated automatically at publish (§5, Q2.8). |
| OA-34 | **Resolved for Player/Judge** (ordinary role-based login, scoped to the one assigned competition). **Still open for Big Screen — see §15.2.** |

---

## 7. PK (Head-to-Head) Rounds

**Status: Deferred — out of MVP scope.** The PK stage is not realized in the MVP (see CS-016 in `project-decisions.md`). The questions below are retained for a future version and are **not** active MVP questions.

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

**Status note (2026-09-23):** the ranking *mechanism* (independent of which scoring model wins) is now resolved. The scoring *model itself* (all-or-nothing vs. proportional) is a genuine open conflict — see §14.3 — and everything entangled with it stays open too.

| # | Question |
|---|---|
| SC-1 | **Resolved.** Per-round scores accumulate into a cumulative stage score, which produces the provisional/final stage ranking (Q3.1, §19). |
| SC-2 | **Resolved 2026-09-24 — all-or-nothing (`project-decisions.md` SCR-001).** Earlier note: Whether "completed" means 100% correct (all-or-nothing) or a proportional percentage of correct cells is exactly the unresolved conflict at §14.3. |
| SC-3 | **Resolved 2026-09-24 — the early bonus exists in the Individual stage only, counts whole minutes, and needs a fully correct round (SCR-002).** Earlier note: `context-feeders/archive/client-view.md`'s +3-points-per-minute-early bonus only makes sense for the all-or-nothing model; if the proportional model is chosen instead, the time-bonus mechanic needs to be redefined. |
| SC-4 | **Resolved 2026-09-24 — formula confirmed, coefficient customizable, school ranking required (SCR-004).** |
| SC-5 | **Resolved.** Tie-break order: higher score → earlier completion/submission time → case-insensitive alphabetical name (Q3.1). |
| SC-6 | **Resolved.** Round scores aggregate to a per-stage cumulative score; there is **no** cross-stage combined ranking (Individual and Team stay separate) — Q3.2, STG-011. |
| SC-7 | **Resolved 2026-09-24 — a wrong or blank cell means 0 for the puzzle (SCR-001).** Earlier note: The effect of a wrong/blank cell is exactly what's undecided between the two scoring models. |

---

## 9. Reliability & Failure Scenarios

| # | Question |
|---|---|
| FL-1 | **Resolved.** Server-authoritative timer keeps running regardless; latest saved state is preserved and used for auto-submit if the round ends before reconnection (Alignment §15). |
| FL-2 | **Resolved 2026-09-24 — the controller sees progress live and takes over (`project-decisions.md` ROL-004).** Earlier note: nowhere was Judge disconnection addressed. Does the competition auto-pause? Can the Admin (who has no live channel per OA-28) intervene at all? Combined with JD-11 (judge removal mid-competition), **there is currently no judge-failure story of any kind.** For a live, one-shot school event this is a meaningful operational risk worth resolving before build. |
| FL-3 | **Partly resolved 2026-09-24 — a failure means the round is replayed as a rematch (ROL-005); technical recovery details remain open.** Earlier note: No document addresses what happens to in-flight competition state if the server process crashes/restarts mid-competition. |
| FL-4 | **Partly resolved 2026-09-24** — see FL-3: the recovery procedure is to replay the round (ROL-005). |
| FL-5 | **Tracked as U-37 from 2026-09-25 (assumption: anti-cheating is kept light).** Earlier note: **Still open**, likely acceptable to leave for later — physical-venue anti-cheating is mostly a human/process matter (proctoring, seating) rather than a software requirement, but worth a conscious "not needed for MVP" confirmation rather than silence. |
| FL-6 | **Substantially resolved.** Server owns the authoritative round timer; clients render a local countdown purely for display and never treat it as truth (Alignment §30). The exact sync *protocol* (how often the server pushes time, drift correction) is an implementation detail, not a requirements gap. |

---

## 10. Data & Persistence Questions

| # | Question |
|---|---|
| DP-1 | **Resolved.** Long-term (PostgreSQL): competition config, participants/teams/accounts, judges, stages/rounds, questions, finalized results/scores/ranking data. **Not** retained long-term: final grids, detailed move history, manual-vs-auto submission flag (Alignment §20, §33). Pre-finalization runtime state (grid, in-progress moves) lives only in Redis. No audit trail (see DP-5). |
| DP-2 | **Resolved.** Competition/stage/round/timer state and ranking updates, pushed over WebSocket to Player, Judge, and Big Screen (Alignment §28). |
| DP-3 | **Resolved.** Continuous per-move grid saves over WebSocket, rate-limited to roughly 2 updates/second per player (Alignment §28, `PLAYER_GRID_UPDATE`). |
| DP-4 | **Resolved 2026-09-24 — 15 days, then permanent deletion (`project-decisions.md` RES-004).** Earlier note: no retention period was stated anywhere. Worth resolving given this is student data from a school competition (possible institutional/privacy retention expectations). |
| DP-5 | **Resolved as: no.** No audit/versioning system exists anywhere in the MVP (explicit out-of-scope: "Score correction/audit system"; publish locks configuration so there's nothing to audit post-publish, and pre-publish draft edits aren't tracked either). |
| DP-6 | **Still open** — depends on the unresolved team-rotation implementation gap (§13.4); no team-progress data model is described beyond the overall team score. |

---

## 11. Architecture, Technology & Infrastructure

**Status: Substantially resolved as of the 2026-09-23 review.** The architectural *style* was already decided (`project-decisions.md` §8.1 / `context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md`). The Arena `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` goes further and **names concrete technology choices that were previously listed as fully Open** — these were not yet reflected in the decision tracker before this review.

> **Divergence notice (unchanged):** the style decisions were made by **development-team preference** (two-developer team, deployment simplicity), deviating from the process rule that architecture be *derived from* requirements. Recorded, not silent.

**Newly resolved by the Arena Alignment Guideline (2026-09-23 — should be moved into `project-decisions.md` §8/§9):**

| ID | Formerly Open Decision | Resolution |
|---|---|---|
| ARCH-3 | Frontend technology / framework. | **Resolved.** React (with TypeScript) — Alignment §34, §40. |
| ARCH-4 | Database technology and data modeling. | **Resolved.** PostgreSQL for durable business data; Redis for fast-changing runtime state (Alignment §33). A concrete minimum domain model is also given (§32) — see ARCH-15. |
| ARCH-5 | Real-time communication technology. | **Resolved.** WebSocket (Alignment §28, §40) — not SSE or polling. |
| ARCH-6 | Caching / state-management technology. | **Resolved** — Redis, same as ARCH-4. |
| ARCH-7 | Authentication and authorization implementation. | **Resolved — and this changes an earlier assumption.** Plain username/password login for Player/Judge/Admin (`POST /auth/{role}/login`). **No OTP** appears anywhere in the Arena documents, which supersedes the "potentially OTP or one-time credential" language in `project-decisions.md` PT-004/JM-004. Big Screen authentication is the one exception — still fully open, see §15.2. |
| ARCH-14 | API design. | **Substantially addressed, not final.** A concrete minimum REST + WebSocket contract is given (Alignment §27–28), explicitly labeled as a starting point rather than a locked spec. |
| ARCH-15 | The detailed competition domain model. | **Substantially addressed, not final.** A minimum relational model is given (Alignment §32): Competition → Category/Judge/Participants/Stages/QuestionPack; Participant → Player/Team; Round → Questions/PlayerRoundState; RoundResult; StageRanking. |
| ARCH-16 | Module decomposition. | **Substantially addressed, not final.** The Alignment Guideline's modules (§23–26: Competition, Participant/Identity, Question, Stage/Round, Gameplay, Orchestrator, Scoring, Ranking, Big Screen) closely match `context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md` ARC-012's candidate list. |

**Still genuinely Open:**

| # | Open Decision |
|---|---|
| ARCH-2 | **Backend language/framework — still not explicitly named.** The React/TypeScript frontend choice suggests (but does not confirm) a Node.js/TypeScript backend for a small team; this is an inference, not a stated decision. Needs an explicit answer before coding starts. |
| ARCH-8 | Deployment architecture — Alignment §36 (Day 15) mentions "production deployment, environment configuration" but names no hosting provider or infrastructure. |
| ARCH-9 | Infrastructure (cloud provider, hosting, scaling). |
| ARCH-10 | External dependencies and libraries. |
| ARCH-11 | PDF extraction technology — Alignment §9 confirms **no OCR**, a "predefined format" with the "narrowest parser necessary," but names no specific library/approach. |
| ARCH-12 | Dynamic rules engine / plugin architecture — explicitly **not** part of the MVP (Alignment §3, non-goals). |
| ARCH-13 | Configuration distribution architecture — explicitly **not** part of the MVP (Alignment §3, non-goals). |
| ARCH-17 | **Both lists now sit in `context-feeders/requirements/ARCHITECTURE.md` (§5 candidate events, §6 messages); their cross-check belongs to I-01 (2026-09-25).** Earlier note: Event catalog — the Alignment Guideline's WebSocket message list (§28) serves a similar purpose but wasn't cross-checked against `context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md` ARC-027's candidate event catalog. |
| ARCH-18 | Structural tenant-isolation mechanism — **moot for the current MVP** (single-tenant, ENV-007); remains relevant only for the later multi-tenant phase. |
| ARCH-19 | **Tracked as I-10 (server restart mid-round, with the durability of events) from 2026-09-25.** Earlier note: Event durability (in-process vs. must-survive-restart) — still open, related to FL-3/FL-4 (server failure recovery). |

**Note on the client proposal:** the client's "unified configuration distribution engine" and "dynamic/marketplace-style logic upload" concepts remain **not accepted** — the Alignment Guideline confirms this explicitly (§3, §6 non-goals).

---

## 12. Priority Open Questions (Suggested Discussion Order) — updated 2026-09-23

**Update 2026-09-24: superseded — the stakeholder's second answers resolved most of the list below; the current open points are in §16.** The list is kept for history.

**Earlier note (2026-09-23):** most of the original list was resolved by then, and what still blocked a clean start to coding was a much shorter list:

1. **Scoring model** (§14.3) — all-or-nothing per question vs. proportional per-cell credit. Blocks the domain model, the Scoring module, and the question-PDF schema (see also §15.1's point-value incoherence).
2. **Team scoring formula** (§14.4) — confirm the `context-feeders/archive/client-view.md` formula is still the agreed one, or get the real one.
3. **Big Screen control** (§14.6) — Judge-only vs. Judge + Admin shared control.
4. **Big Screen authentication** (§15.2) — no mechanism is defined anywhere; blocks building that client at all.
5. **Judge failure/replacement path** (§15.5) — no story exists for judge disconnection or mid-competition replacement.
~~6. UI language/localization~~ **Resolved 2026-09-23: bilingual English + Chinese.**
7. **Expected scale/concurrency for the real event** (§15.8) — the old "1000+ devices" numbers likely no longer apply; the real number was never stated.
8. **Backend language/framework** (ARCH-2, §11) — the only major technology choice still genuinely unnamed.
9. **Credential delivery mechanism** (PL-5/JD-7, §4.1/§5.1) — how generated usernames/passwords physically reach players and the judge.
10. **Per-question point-value incoherence** (§15.1) — reconcile the PDF's per-question "score/difficulty" fields against the flat 100-point rule.
11. **Results export** (§15.4) — confirm whether a real export/download feature is still in scope, or on-screen viewing is sufficient.
12. **Server failure / recovery** (FL-3/FL-4, §9) — still completely unaddressed; a real risk for a live one-shot event.

Everything else in §1–11 that was previously on this list — stage/round type definitions, category placement, publish/lock semantics, player access mechanism, persistence granularity — **is now resolved** and doesn't need further discussion unless someone has new information. Items 13 and beyond in the earlier §1–11 detail (team-round parameters, question-bank management, competition reuse, multi-device sessions, data retention, anti-cheating policy) are real but lower-priority — worth answering, but they won't block starting to code the core flow.

---

## 13. Flow Requirements — Client Vision (To Check with Client)

**Status note:** `context-feeders/archive/FLOW_REQUIREMENTS.md` captures the client's vision of the competition flow and system mechanics. Nothing there is confirmed. Items marked **[Check with client]** in that document are consolidated here so they are tracked as open points. Some overlap with earlier questions in this register; the FLW-* entries below are the flow-specific formulations.

| # | Question | Related existing |
|---|---|---|
| FLW-Q1 | **Resolved (2026-09-25 note; answer from 2026-09-23):** publishing generates the entry link/QR and the big-screen link, and locks the structure (CA-004). Earlier question: What exactly does "publishing" generate? Does it auto-generate player/judge links? | CMP-2 |
| FLW-Q2 | **Resolved:** one competition entry link, then separate role logins (username and password); the big screens use one shared link with no login (BSC-001). Earlier question: Are player and judge access the same link, or separate? Does the link identify the user or require additional auth? | PL-1, JD-8 |
| FLW-Q3 | **Still open — tracked as I-13 (rejected login message).** What happens when an unregistered/unauthorized player attempts entry? | PL-6 |
| FLW-Q4 | **Resolved:** the controller starts a stage; everything else in the sequence is automatic (CS-022, ROL-003). Earlier question: Which competition transitions are Judge-controlled vs automatic? | SR-7, J-003/4/5 |
| FLW-Q5 | Is PK in scope for MVP, or reserved for later? *(Resolved — PK deferred, out of MVP. See CS-016.)* | SR-3 |
| FLW-Q6 | **Resolved 2026-09-24 — all-or-nothing per puzzle (SCR-001).** Earlier question: **Scoring model:** is scoring per-cell proportional, all-or-nothing per puzzle, or hybrid? How do time bonuses and difficulty weighting fit? | SC-1…SC-7 |
| FLW-Q7 | **Resolved 2026-09-24 — points are set per question by difficulty and are customizable (SCR-003); whether a round's total is fixed is U-03.** Earlier question: Per-question points: assigned individually or per-type? | SC-3 |
| FLW-Q8 | **Resolved:** durations are predefined, and as numeric values they are customizable by the controller (SCR-005). Earlier question: Round duration: driven by question type or set manually? | CS-005 |
| FLW-Q9 | **Resolved:** publication locks the structure (CA-004), with the partial later edits of SCR-005 and PAR-003. Earlier question: **Lifecycle:** is publication = lock? Is there any post-publication edit path? | CMP-3, CMP-7, CMP-8 |
| FLW-Q10 | **Resolved:** the PDF holds the questions with their solutions (points and difficulty: SCR-003, U-03). Earlier question: Question document: what exactly is in the PDF? Are solutions required at upload? | OA-9, OA-11 |
| FLW-Q11 | **Resolved:** Name, School, Category and Team (PAR-004; extra columns U-40); the team comes from the Team column. Earlier question: Participant fields: which are required? How exactly is team membership detected from the file? | PT-1, OA-1 |

**Primary divergences to reconcile with the client (from context-feeders/archive/FLOW_REQUIREMENTS.md §9):**

- **Scoring model:** the client's described "recognition-based / percentage of correct cells" proportional model vs the existing `context-feeders/archive/client-view.md` rules (rounds worth 100 points, all-or-nothing, +3/min early bonus). These are two different scoring philosophies and must be reconciled.
- **Lifecycle / lock point:** the client's vision implies publication = immutable lock, whereas the existing decision register leaves the lock point unresolved (publication vs first access vs start).
- **PK stage:** the client lists PK as a stage type, but the referenced competition regulations use only Individual + Team, with PK reserved. **Resolved for MVP: PK is deferred** (CS-010 / CS-016).

---

## 14. Sudoku Arena MVP Alignment Documents — New Conflicts & Open Points (flagged 2026-09-23)

**Status note:** Three new documents were added at the project root — outside the `context-feeders/requirements/`/`context-feeders/decisions/` structure described in `CLAUDE.md` — on 2026-09-23:
- `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md`
- `context-feeders/archive/Sudoku Arena MVP — Question 2 Decision Summary.md`
- `context-feeders/archive/Sudoku_Arena_MVP_Q3_Decision_Summary.md`

These read as a later, more concrete internal engineering-planning document for a 15-day implementation sprint. Several of their statements **conflict with, or silently resolve, decisions already marked Confirmed or Open in `project-decisions.md`**. Per `CLAUDE.md`, conflicts must be identified and left open for explicit client/developer confirmation rather than silently accepted.

**Update 2026-09-24:** the stakeholder resolved §14.3, §14.4 and §14.6 (see `project-decisions.md` §15), and superseded parts of §14.1, §14.2 and §14.5 where noted. **Original note (2026-09-23):** §14.3, §14.4, and §14.6 below are **genuine unresolved conflicts** between the original `context-feeders/archive/client-view.md` and the newer Arena documents — these need your judgment call. §14.1 and §14.2 were already decided directly by the project owner (Louise) and are **not** open for re-litigation unless you have a reason to revisit them. §14.5 lists items that had no real conflict (the new documents just answered previously-open questions) and are already accepted.

### 14.1 Multi-tenancy / Super Administrator — RESOLVED (2026-09-23, deferred, not abandoned)

**Resolution (project owner, 2026-09-23):** the team originally planned the full multi-tenant SaaS platform ("the house"), but given the current time constraint has deliberately chosen to build the MVP as a **single-tenant "studio arena" for one company only**. This is an explicit, intentional scope decision — **not** a cancellation. The multi-tenant SaaS vision, tenant isolation, and the Super Administrator role remain the confirmed long-term product direction and are planned for a later growth phase once the MVP ships. Recorded in `project-decisions.md` as ENV-007 and SA-005.

| # | Existing documentation | New Arena documents | Status |
|---|---|---|---|
| ARENA-1 | `project-decisions.md` ENV-001/ENV-002 (**Confirmed**, long-term): platform is multi-tenant SaaS; tenant data isolation is a fundamental requirement. `context-feeders/archive/ARCHITECTURE_REQUIREMENTS.md` ARC-011: tenant isolation enforced structurally at module level. | `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §1/§3: "The MVP is **not** a fully generic SaaS competition engine"; lists **"Generic multi-tenant SaaS features"** as explicitly out of scope. Its domain model (§32) and DB schema (§33) have **no Organization/Tenant entity**. | **Resolved.** MVP is deliberately single-tenant (ENV-007). Multi-tenancy deferred to a later phase, not abandoned. |
| ARENA-2 | `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` (Working Draft): Super Administrator is one of 4 platform actors, with tenant overview/revocation as MVP working scope (`project-decisions.md` SA-001…SA-003, §12 summary row). | The Super Administrator role is **never mentioned** anywhere in the three new Arena documents. Roles are listed only as "Administrators, Judges, Players, Big-screen display" (§1). | **Resolved.** Role deferred with multi-tenancy (SA-005). `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` is retained as-is for when that phase is built — not deleted, not contradicted. |
| ARENA-3 | `context-feeders/archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-001/OA-002: Organization Admin represents one tenant among potentially many; multi-tenant model assumed throughout. | Arena docs use "Admin" generically and describe competition creation, participants, judges, and questions without framing them relative to an organization/tenant boundary, beyond "the judge must belong to the organization" (§8). | **Resolved.** MVP has exactly one organization; "Admin" in the Arena docs is that organization's admin. Multi-org support deferred with ARENA-1. |

### 14.2 Team stage — RESOLVED (2026-09-23, no conflict; implementation gap noted)

**Resolution (project owner, 2026-09-23):** the team-mode description is **unchanged**. `context-feeders/archive/STAGE_REQUIREMENTS.md` §4.3 (TEAM-010…TEAM-015) and `context-feeders/archive/client-view.md` §3 remain the authoritative description of the rotation mechanic. The Arena Alignment Guideline simply does not redescribe it — that is silence, not a contradiction or a scope cut.

| # | Existing documentation | New Arena documents | Status |
|---|---|---|---|
| ARENA-4 | `context-feeders/archive/STAGE_REQUIREMENTS.md` §4.3 (TEAM-010…TEAM-015) and `context-feeders/archive/client-view.md` §3: detailed live puzzle-rotation mechanic — 2–6 players per team, puzzles rotate among teammates every ~60s, a finished puzzle is validated and replaced from a shared pool, round ends when the pool is exhausted or time runs out. | `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §12 (Player Runtime Flow), §14 (Submission Rules), the Gameplay module (§24), and the REST/WebSocket API (§27–28) describe **every round identically**: one player solves their own puzzle and submits it. No rotation, replenishment, or shared-pool mechanic appears anywhere. The only team-specific content is the team scoring formula (§18) and big-screen team projection (§22). | **Resolved — no requirements conflict.** `context-feeders/archive/STAGE_REQUIREMENTS.md`/`context-feeders/archive/client-view.md` stand as the description of the Team stage. **Remaining implementation-planning gap (not a requirements question):** before Days 7–9 of the build (Competition Runtime), the Alignment Guideline's runtime flow, module design, and API/WebSocket contracts need to be extended to actually implement rotation/replenishment — they currently only describe the Individual-stage-style single-puzzle flow. |

### 14.3 Scoring model — RESOLVED by the stakeholder (2026-09-24): all-or-nothing

**Status update (2026-09-23):** the project owner initially asked to apply an "oldest document wins" default to this conflict, then reconsidered — that default is **retracted**. This is now an **open conflict for direct client/colleague review**, not something resolved by document-precedence rules.

| # | Existing documentation | New Arena documents | Status |
|---|---|---|---|
| ARENA-5 | `context-feeders/archive/client-view.md` §2.1 (oldest source): all-or-nothing per question — 100 pts correct, 0 pts wrong/blank, +3 pts/minute early-completion bonus. | `context-feeders/archive/FLOW_REQUIREMENTS.md` FLW-030 attributes a **proportional/per-cell** model to "the client's vision" instead — points awarded by percentage of correctly filled cells. `context-feeders/archive/Sudoku_Arena_MVP_Q3_Decision_Summary.md` Q3.18 / `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §18 go back to the all-or-nothing model. | **Resolved 2026-09-24: all-or-nothing (`project-decisions.md` SCR-001); the proportional model is discarded.** Earlier open question — which model is correct: all-or-nothing (100/0 + time bonus) or proportional per-cell credit? Did the client's position change between documents, or did `context-feeders/archive/FLOW_REQUIREMENTS.md` mischaracterize it? FLW-Q6 / SC-1…SC-7 depend on this. |

### 14.4 Team scoring formula — RESOLVED by the stakeholder (2026-09-24)

| # | Existing documentation | New Arena documents | Status |
|---|---|---|---|
| ARENA-6 | `context-feeders/archive/client-view.md` §2.1 gives a concrete formula: `team total = (individual two-round sum) × 0.6 + (team two-round sum)`. | `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §18 / Q3.18 reference "the client's predefined team scoring formula" / "the agreed team formula" **without restating it**. | **Resolved 2026-09-24: the `context-feeders/archive/client-view.md` formula is confirmed, with a customizable coefficient and a required school ranking (`project-decisions.md` SCR-004).** Earlier question — is the Arena documents' "agreed formula" the same as the `context-feeders/archive/client-view.md` §2.1 formula above, or was a different formula agreed at some point that isn't written down anywhere? SC-4 depends on this. |

### 14.5 Points resolved 2026-09-23 (no conflict found — not part of the colleague review)

These were previously **open/undecided** questions (not conflicts — no prior document took a firm position), which the new Arena documents answered unopposed. Reviewed against all other documentation with no contradiction found, and accepted as Confirmed:

| Item | Resolution | Recorded at |
|---|---|---|
| CAT-1 / CAT-2 / PT-005 (category placement) | One competition = one category; different categories are separate competitions (e.g. `U6`–`U20`) — **modified 2026-09-24: an event holds several categories running in parallel** | `project-decisions.md` PT-005, EVT-002 |
| CMP-2 / CMP-3 / FLW-Q9 (configuration lock point) | Publish generates the entry link/QR **and** locks configuration; no exceptional post-publish edit path | `project-decisions.md` CA-004 |
| JD-4 / JD-5 (single vs multiple judges) | Exactly one judge per competition; a judge cannot be assigned to more than one *ongoing* competition at a time — **superseded 2026-09-24: at least 30 judges are needed** | `project-decisions.md` JM-005, ROL-003 |

### 14.6 Big Screen control — RESOLVED by the stakeholder (2026-09-24)

**Status update (2026-09-23):** previously resolved in favor of the oldest document under a now-retracted default; reopened as a direct conflict for colleague/client review.

| # | Existing documentation | New Arena documents | Status |
|---|---|---|---|
| ARENA-7 | `context-feeders/archive/client-view.md` §4.1/§4.3 **explicitly** states Judge and Admin/Management have **synchronized** Big Screen control ("裁判端控制 / 管理端同步控制"). | `context-feeders/archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-007/OA-080/OA-081 and `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §16 both say **only the Judge** controls the Big Screen; the Admin does not operate it during an active competition. | **Resolved 2026-09-24: one screen — judge and controller both control it; several screens — only the controller (`project-decisions.md` BSC-002).** Earlier question — should the Admin retain Big Screen control alongside the Judge (per the client's original document), or is Judge-only correct for the MVP (per the two later documents)? See `project-decisions.md` §10 and OA-007/OA-080/OA-081. |

### 14.7 Documentation redundancy risk

`context-feeders/archive/Sudoku Arena MVP — Question 2 Decision Summary.md` and `context-feeders/archive/Sudoku_Arena_MVP_Q3_Decision_Summary.md` are near-total subsets of `context-feeders/archive/Sudoku_Arena_Final_MVP_Alignment_Guideline.md` §5–22 (large verbatim overlaps, e.g. pause/resume/cancel/ranking behavior). Not a contradiction today, but three documents now carry the same facts; if one is edited later without the others, they will silently drift apart. Consider designating the Alignment Guideline as the single source of truth and the two Decision Summaries as historical/superseded.

---

## 15. Final Pre-Implementation Review (2026-09-23) — Newly Identified Gaps & Incoherences

A full re-read of every requirements and decision document (old and new) against each other, specifically looking for anything not yet captured anywhere in this file. Sections 1–11 above were also individually reconciled against the Arena documents as part of this pass (see the "Status note" at the top of each). The items below are **new** — not previously flagged in any form.

### 15.1 Per-question point values vs. the flat scoring rule — RESOLVED 2026-09-24: points are set per question by difficulty (SCR-003)

`context-feeders/archive/FLOW_REQUIREMENTS.md` FLW-031/FLW-043 and the question-PDF description say each question carries its own **"score, difficulty, type"** as parameters — implying **variable, per-question point values**. But the confirmed scoring rule (`context-feeders/archive/client-view.md` §2.1, matched by the Arena documents) is a **flat 100 points per question** for the Individual stage, with no mention of difficulty-weighted scoring anywhere in the actual competition-rules documents. These two pictures don't fit together: either the PDF's "score" field is unused/vestigial, or the flat-100-points rule needs revisiting for questions of different difficulty. **Needs a decision:** does every question in a round really score the same regardless of its stated "score"/"difficulty," or should the PDF's per-question score actually drive scoring (which would reopen the scoring-model conflict at §14.3 further)?

### 15.2 Big Screen authentication — RESOLVED 2026-09-24: one shared link, no login (BSC-001)

No document — old or new — describes **how the Big Screen actually connects and authenticates**. Player and Judge both get `POST /auth/{role}/login` with generated credentials (Alignment §27); there is **no equivalent for the Big Screen anywhere**: no endpoint, no token concept, no mention of expiry/revocation, no mention of whether multiple Big Screens can display the same competition. This is a real gap for a browser-based Big Screen client — without an answer, that piece of the web app cannot be built. Covers the previously-listed JD-37 through JD-40, OA-32/34's Big-Screen half, and CA-003.

### 15.3 Competition/configuration reuse — RESOLVED 2026-09-24: a copy button is required (CMP-100)

`project-decisions.md` CR-001 (Working Position, pre-Arena) said the admin "should ideally" be able to reuse a previous competition's configuration for a new one. The three Arena documents **never mention this at all** — not as a supported feature, and not in their explicit "out of scope" list either (which does list many other cut features by name). It's unclear whether this was silently dropped or just not yet written down. Given the competition structure is now fixed in code (§3 above), the practical need for "reuse a configuration" may be much smaller than originally imagined — but that should be an explicit call, not an accidental omission. Covers OA-19 through OA-22.

### 15.4 Results export — RESOLVED 2026-09-24: export is required (RES-002); file format still open (§16)

`project-decisions.md` OA-134/RA-005 (both currently Working Position) confirm the admin should be able to **export** competition results, with format/fields left open. The Arena documents' minimum API (§27) provides `GET /competitions/:id/results` and `GET .../ranking` — which reads as on-screen display data, not a file export. No export format, no export endpoint, no mention of "export" as a capability anywhere in the 2101-line Alignment Guideline. Given how minimal the post-competition data already is (final ranking + final scores only, Q2.15), it's worth explicitly confirming whether a real export/download feature is still planned for the MVP, or whether "the admin can view results on screen" is now considered sufficient. Covers OA-26/OA-27.

### 15.5 Judge failure/replacement — RESOLVED 2026-09-24: the controller sees everything live and takes over (ROL-004)

Three separate threads converge on the same hole: JD-10 (can a judge be swapped before start?), JD-11 (what happens if the judge needs replacing mid-competition?), and FL-2 (what happens if the judge simply loses network connectivity?). **None of these are addressed by any document.** Given the Judge is the single point of control for starting stages, pausing, and ending rounds — and the Admin has no live channel at all during an active competition (§6.5 above) — a judge going offline or needing replacement appears to have **no defined recovery path whatsoever**. For a live, one-shot school event where the whole competition runs through one judge account, this is worth resolving before build, not after.

### 15.6 Clarification, not a conflict: authentication model has simplified from "OTP" to "password"

Several older documents (`project-decisions.md` PT-004, JM-004; `context-feeders/archive/ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-053, OA-063) speculated about OTP or one-time-credential access for players and judges. The Arena documents settle on ordinary system-generated username/password accounts instead — no OTP anywhere. Not a conflict (the older documents only ever said "potentially OTP," never committed to it), but worth recording explicitly as the actual answer rather than leaving the old "potentially OTP" language sitting there unresolved. See ARCH-7 in §11.

### 15.7 UI language/localization — **RESOLVED (2026-09-23, by product owner)**

**Resolved: the UI must support both English and Chinese (bilingual).** Not Chinese-only, not English-only. This is a real product requirement — i18n/translation must be planned as part of the frontend architecture from the start, not bolted on later.

### 15.8 Expected scale — PARTLY RESOLVED 2026-09-24: real numbers given (600–720 students, 11 rooms, 30+ judges, 10 screens), but they are inconsistent (EVT-001; see §16)

`context-feeders/archive/client-view.md` (the original, full-platform vision) states hard scale targets throughout: **"≥1000 devices online"**, **"3000 concurrent users"**, **"low bandwidth"** — these numbers drove the original architecture thinking (light instructions only, no video, etc.). Since the MVP scope narrowed to **one school's single competition** (ENV-007/ENV-008), it's very unlikely those numbers still apply as-is — but **no document states what the real expected number of participants, judges, and Big Screens for the actual MVP competition day actually is.** The Arena Alignment Guideline's only mention of performance anywhere in its 2101 lines is a single unquantified line on Day 15: "Performance sanity test." This directly affects real architecture decisions already being made (is a single-process modular monolith with one Postgres + one Redis instance actually sufficient? does the WebSocket approach need to handle 50 concurrent players, or 500?) — exactly the kind of assumption that, if wrong, forces rework after coding has started. **Needs an explicit number** (even a rough one: "this MVP needs to handle roughly N students, M judges, K big screens") before implementation.

### 15.9 Summary table

| # | Topic | Type | Severity |
|---|---|---|---|
| 15.1 | Per-question point values vs. flat scoring | Incoherence between documents | **Resolved 2026-09-24** |
| 15.2 | Big Screen authentication undefined | Missing requirement | **Resolved 2026-09-24** |
| 15.3 | Competition/config reuse unaddressed | Silent scope gap | **Resolved 2026-09-24** |
| 15.4 | Results export possibly dropped | Silent scope gap | **Resolved 2026-09-24** (format open) |
| 15.5 | No judge failure/replacement path | Missing requirement | **Resolved 2026-09-24** |
| 15.6 | OTP → password simplification | Clarification only | Low — already effectively answered |
| 15.7 | UI language/localization | **Resolved (2026-09-23)** — bilingual English + Chinese | — |
| 15.8 | Expected scale/concurrency for the real event undefined | Missing requirement | **Partly resolved 2026-09-24** — numbers given but inconsistent |
