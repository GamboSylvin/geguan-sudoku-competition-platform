> **[CONTEXT FEEDER NOTE]** Archived source document, already merged into the requirements and decisions and, from there, into `context/`. Kept for reference only; do NOT use it to decide what to build. It is not maintained: the only edits are this note and the updated folder paths.

# ARCHITECTURE_REQUIREMENTS.md

# Architecture Requirements

**Status:** Working Draft — team decision, recorded; details open
**Scope:** MVP
**Method:** Problem → Requirements → Domain/System Model → Architecture Analysis → Architecture Decision → Technology Analysis → Stack Decisions → Detailed Design → Coding
**Related documents:** `PROJECT_ANALYSIS_UPDATED.md`, `FLOW_REQUIREMENTS.md`, `STAGE_REQUIREMENTS.md`, `PLAYER_REQUIREMENTS.md`, `ORGANIZATION_ADMIN_REQUIREMENTS.md`, `SUPER_ADMIN_REQUIREMENTS.md`, `JUDGE_REQUIREMENTS_PROPOSAL.md`, `client-view.md`, `context-feeders/decisions/project-decisions.md`, `context-feeders/decisions/unmade-decisions.md`

> This document records the **architectural style** the development team has chosen for the MVP: a **modular monolith**, with **event-driven communication at the level of the competition/game subsystem**.
>
> It is a requirements-level document. It does **not** select backend frameworks, database technology, real-time transport, or deployment tooling — those remain open and are listed in §11.

---

## 0. Relationship to Existing Decision Records (Read First)

This document **changes the status** of a previously deferred decision. That change is deliberate and must remain visible.

### 0.1 What the existing documentation said

| Source | Statement | Status before this document |
|---|---|---|
| `project-decisions.md` §8 | "**Status: No architecture decisions have been made.**" System architecture is listed among the explicitly undecided items. | Confirmed as undecided |
| `project-decisions.md` §8 | Architecture decisions "must be **derived from the requirements and system characteristics**, not selected in advance." | Confirmed process rule |
| `project-decisions.md` §11 | "**Backend architecture**" and "**WebSocket/event architecture**" listed as **deliberately deferred**, must not be prematurely decided. | Deferred |
| `unmade-decisions.md` ARCH-1 | "Overall system architecture (monolith, modular monolith, microservices, event-driven, etc.)." | **Open** |
| `project-decisions.md` NF-007 | "Event-oriented behavior" — identified as a characteristic; "**no architectural decision made yet**." | Identified / Open |
| Every role/flow/stage requirements document | Closes with "Do not proceed directly to architecture." | Working guidance |

### 0.2 What this document now records

The **development team** has chosen an architectural style ahead of full requirements validation, for delivery reasons: the team is **two developers**, and the priority is to avoid deployment and operational complexity while keeping the code maintainable as it grows.

### 0.3 Divergence — recorded, not silently resolved

- **Divergence D-1:** The process rule in `project-decisions.md` §8 required architecture to be *derived* from requirements. This style choice was instead made **by team preference and team-size constraints**. This is an explicit, acknowledged deviation from the stated process rule.
- **Divergence D-2:** ARCH-1 in `unmade-decisions.md` moves from **Open** to **partially resolved** (style chosen; technology still open).
- **Divergence D-3:** NF-007 "Event-oriented behavior" moves from **Identified / Open** to **realized at the game-subsystem level** as an architectural decision.

**Consequence to keep honest:** the remaining requirements are still unstable (see the unresolved scoring model, lifecycle lock point, team round types, category placement, and access mechanism in `unmade-decisions.md`). Choosing a style now does **not** validate those requirements. The style must remain revisable if requirements contradict it.

---

## 1. Scope

### ARC-000 — MVP scope
This architecture applies to the **MVP**: multi-tenant Sudoku competition platform, realizing the **Individual** and **Team** stages (PK deferred — CS-010 / CS-016), for a supervised physical venue, with real-time competition supervision and display.

---

## 2. Architectural Style — Modular Monolith

### ARC-001 — Single deployable system
The platform is built as **one system** with **one deployment unit** for the MVP. There are no separately deployed services, no distributed runtime, and no cross-service network calls between internal components.

*(Working Position — team decision. Rationale: a two-developer team cannot absorb the operational cost of a distributed system.)*

### ARC-002 — Modular monolith, not a flat monolith
The codebase is organized into **explicit modules with defined boundaries**. The goal is not merely to build one application, but to keep the code **clear, maintainable, and able to grow**, because it will be maintained and extended after the MVP and will need to scale later.

*(Working Position — team decision.)*

### ARC-003 — Modularity is a first-class requirement
Module boundaries must be **explicit and enforced by convention and code structure**, not left implicit. A module's internal implementation must not be reachable by another module except through its public interface.

*(Working Position.)*

### ARC-004 — Rationale (recorded for future maintainers)
- **Team size (2 developers):** minimizes coordination and deployment overhead.
- **Deployment simplicity:** one artifact to build, ship, and run.
- **Maintainability:** clear module boundaries make the codebase readable and changeable.
- **Future growth:** modules give a natural seam for later extraction or scaling **if and when** it is actually needed.
- **Avoided risk:** microservices would add network, versioning, observability, and operational burden with no MVP justification.

*(Working Position.)*

### ARC-005 — Scaling posture
Scaling is a **later concern**. The modular structure must not prevent scaling, but the MVP must not be designed around speculative scale. Extraction of a module into a separate service is explicitly **not** planned for the MVP and is not a design goal.

*(Working Position.)*

### ARC-006 — Technology neutrality preserved
This decision fixes the **style only**. Backend language/framework, frontend framework, database, real-time transport, caching, authentication implementation, and deployment tooling remain **Open** and must still be derived from the requirements (see §11).

*(Working Position.)*

---

## 3. Module Boundaries

### ARC-010 — Modules are derived from the domain, not from technology
Module boundaries must follow the **domain and responsibilities already described in the requirements documents**, not a technical layering chosen in advance.

*(Working Position.)*

### ARC-011 — Tenant isolation is a module-level concern — **[Moot for the current MVP, 2026-09-23]**
**Tenant data isolation (ENV-002 / NF-005) is a fundamental requirement** and must be enforced structurally. No module may expose tenant-owned data across tenant boundaries, and isolation must not depend on every developer remembering to add a filter.

*(Confirmed requirement, reflected architecturally — but the current MVP is deliberately single-tenant (ENV-007), so there is nothing to isolate right now. This remains the design target for the later multi-tenant growth phase.)*

### ARC-012 — Candidate modules (Proposed — requires validation)
The following module candidates are **derived from the existing requirements** as a starting point. They are a **proposal**, not a settled decomposition, and must be validated against the domain model once the open requirements are resolved.

| Candidate module | Derived from |
|---|---|
| Identity & Access | Roles (§4 actors), competition access/entry links (CA-001…CA-003), participant/judge credentials (PT-004, JM-004). **Update 2026-09-23: authentication resolved to username/password for Player/Judge/Admin (PT-006); Big Screen auth remains Open — `unmade-decisions.md` §15.2.** |
| Tenant / Organization | ENV-001…ENV-002, SA-010…SA-013, OA-001…OA-003, ORG-*. **Update 2026-09-23: moot for the current single-tenant MVP (ENV-007) — relevant only to the later multi-tenant phase.** |
| Competition Configuration | CS-001…CS-009, OA-010…OA-024. **Update 2026-09-23: structure is fixed in code, not admin-configurable (CS-020); lock point resolved — publish = lock (CA-004).** |
| Question Bank & Import | QB-001…QB-005, OA-040…OA-044, PDF import (technology Open — ARCH-11). **Update 2026-09-23: surfaced a new incoherence between per-question point values and the flat scoring rule — `unmade-decisions.md` §15.1.** |
| Participants & Teams | PT-001…PT-005, OA-050…OA-053, team derivation from import data |
| Judge Management | JM-001…JM-004, OA-060…OA-063 |
| Competition Execution (Game Engine) | EX-001…EX-011, J-002…J-007, NF-004, NF-009, NF-010 — stage/round lifecycle and timers |
| Answer Validation & Scoring | EX-001…EX-004, EX-010, SC-* (scoring model still **Open** — `unmade-decisions.md` §14.3) |
| Team Rotation | CS-014, TEAM-010…TEAM-015 |
| Results & Analytics | RA-001…RA-005, OA-130…OA-134. **Update 2026-09-23: MVP scope narrowed to final ranking + scores only; export feature possibly dropped — `unmade-decisions.md` §15.4.** |
| Live Monitoring & Presentation | NF-002, J-008, J-010…J-014, Big Screen (client-view §4) |
| Audit / Configuration Versioning | **Update 2026-09-23: resolved as: not required.** No audit/versioning system exists anywhere in the MVP (DP-011). This module candidate can likely be dropped. |

**Open question:** this decomposition is provisional. It must be revisited once the domain model exists, because several requirements that drive the boundaries are themselves unresolved.

### ARC-013 — Module ownership and interfaces
Each module exposes a **public interface** and hides its internals. Modules may not read another module's internal data structures or database tables directly.

*(Working Position.)*

---

## 4. Event-Driven Architecture — Competition/Game Subsystem

### ARC-020 — Event-driven scope
Event-driven communication is introduced **at the level of the competition/game subsystem**, where many components need to speak to each other. This is the subsystem covering stage/round lifecycle, player actions, validation, scoring, and team rotation.

**This decision is deliberately narrower than "event-driven everywhere."** Modules outside the game subsystem may communicate through direct in-process calls via their public interfaces.

*(Working Position — team decision. Rationale: the game subsystem has genuine many-to-many notification needs; the rest of the system does not, and a blanket event bus would add indirection without benefit.)*

### ARC-021 — Events are in-process
For the MVP, events are **in-process**. No external message broker, message queue, or event-streaming infrastructure is introduced.

*(Working Position — team decision. Rationale: deployment simplicity for a two-developer team. This may be revisited only if a concrete requirement demands durability or cross-process delivery.)*

### ARC-022 — Rationale
- Many components need to react to the same competition occurrence (a round ending affects players, the judge view, the Big Screen, scoring, and rotation).
- Direct pairwise calls between those components would tightly couple them and multiply change impact.
- Events let a component announce **what happened** without knowing who cares.
- This keeps the game subsystem maintainable as round types and team mechanics grow — which the requirements anticipate (only the rotation round is currently detailed; other team round types are listed but undefined — TEAM-002 / §4.4).

*(Working Position.)*

### ARC-023 — Events express domain facts, not commands
Events describe something that **has happened** in the competition domain. They are not a mechanism for one module to instruct another to do work.

*(Working Position.)*

### ARC-024 — Events must not bypass tenant isolation
Every event carries the tenant context it belongs to. A subscriber must never process an event across a tenant boundary. This preserves ARC-011.

*(Derived from ENV-002 / NF-005 — Confirmed requirement.)*

### ARC-025 — Authoritative state remains server-side
The conceptual principle that the **backend is authoritative for competition state (ENV-006)** is not changed by this decision. Events announce changes to authoritative state; they do not make any client authoritative.

*(Consistent with ENV-006 — Working Position.)*

### ARC-026 — Timing consistency is not solved by this decision
Keeping round timers consistent across server, judge, and player views (**FL-6**) remains an **Open** question. This architecture does not resolve it.

*(Open.)*

### ARC-027 — Event catalog (Proposed — requires validation)
The following events are **derived from the existing requirements**. They are a starting point, not a settled catalog.

| Candidate event | Derived from |
|---|---|
| Stage started / stage ended | J-003, NF-004, CS-001 |
| Round waiting entered / countdown started | PL-004, FR-PLAYER-004/005, J-004 |
| Round started / round ended | J-004, NF-009, NF-010 |
| Competition paused / resumed | J-006 (semantics **Open** — JD-15, JD-16) |
| Round ended prematurely | J-007 (semantics **Open** — JD-18, JD-19) |
| Player move saved | PL-006, FR-PLAYER-007, EX-009 |
| Player submitted | PL-007, FR-PLAYER-008 |
| Player auto-submitted at expiry | PL-008, FR-PLAYER-009 |
| Answer validated (correct / incorrect) | EX-001, EX-010 |
| Score calculated | EX-002, EX-003 |
| Ranking updated | EX-004, NF-002 |
| Team puzzle assigned / replenished / rotated | EX-006, EX-007, TEAM-013 |
| Participant connected / disconnected | J-008, JD-21 |
| Big Screen display target changed | J-010…J-014, JD-32 |
| Results published / made visible | J-020 (meaning **Open** — JD-28) |

**Open question:** the event catalog must be validated against the resolved requirements. Several events above depend on decisions that are not yet made (pause semantics, premature-end semantics, publish semantics, scoring model).

---

## 5. Inherited Constraints

These are **existing requirements** this architecture must respect. They are restated here for architectural awareness; their authority remains with their source documents.

| Constraint | Source | Implication for this architecture |
|---|---|---|
| Multi-tenant with strong isolation | ENV-001, ENV-002, NF-005 | Isolation enforced structurally at module level (ARC-011, ARC-024) |
| Real-time state, progress, rankings | NF-002 | The game subsystem must publish changes as they occur |
| Interactive, concurrent users | NF-003 | Many components react to the same occurrence — motivates ARC-020 |
| State-driven progression | NF-004 | The game subsystem owns the competition lifecycle |
| Automatic validation/scoring/ranking | EX-001…EX-004, NF-006 | Deterministic operations belong to the system, not to the Judge |
| Low-bandwidth environment | client-view §1.1, §4.3 | Lightweight events/instructions; no video streaming |
| Timed rounds, auto-submit, idempotent submission | NF-009, PL-007…PL-009 | Execution module owns timers and submission idempotency |
| Automatic player state persistence | NF-008, EX-009 | Per-move persistence requirement; **mechanism still Open** |
| Backend authoritative | ENV-006 | No client-authoritative state (ARC-025) |

---

## 6. Non-Goals (MVP)

Explicitly **not** part of this architecture:

- Microservices or separately deployed services.
- External message broker / event streaming infrastructure.
- A general-purpose dynamic rules engine or plugin architecture (the client's "Steam-like" upload concept is **not accepted** — `project-decisions.md` §8, §10).
- The client's "unified configuration distribution engine" as an architecture concept — **not accepted** until the underlying business variation is understood.
- Event-driven communication across the entire monolith (see ARC-020).
- Multi-region, high-availability, or auto-scaling design.
- Remote-competition / anti-cheating architecture (ENV-005).

---

## 7. Open Questions Raised by This Document

| # | Question |
|---|---|
| ARCQ-1 | Is the candidate module decomposition in ARC-012 correct once the domain model exists? Which modules should merge or split? |
| ARCQ-2 | Should the game subsystem's event scope be widened to also feed real-time client push, or should push be a separate concern? |
| ARCQ-3 | What is the required durability of events — is in-process delivery sufficient, or must some events survive a restart? |
| ARCQ-4 | How is tenant isolation enforced structurally (ARC-011) without depending on developer discipline? |
| ARCQ-5 | What happens to in-flight competition state and events if the server fails mid-competition? (Relates to FL-3, FL-4 — still Open.) |
| ARCQ-6 | Should configuration changes be audited/versioned (CMP-9, DP-5), and does that require a dedicated module? |
| ARCQ-7 | Does the low-bandwidth constraint change how events reach client devices versus how they propagate internally? |
| ARCQ-8 | How is round-timer consistency achieved across server, judge, and player views? (FL-6 — Open.) |

---

## 8. What This Document Does Not Decide

> **Update (2026-09-24):** the stakeholder gave the real scale — about 600–720 students, 11 rooms, at least 30 judges, 10 synchronized big screens — and several new functions (per-question points, configurable values, score corrections with a log, archived scores on rematch, answers kept then purged after 15 days, participant numbering, copy). The architecture style is unchanged, but the domain model, API and plan in the Alignment Guideline must be revised before coding (`context-feeders/decisions/unmade-decisions.md` §16, I-01).
>
> **Update (2026-09-23):** several of these have since been named by `Sudoku_Arena_Final_MVP_Alignment_Guideline.md` and recorded in `context-feeders/decisions/project-decisions.md` §14.4 — struck through below. Backend language/framework is now the one major technology choice still genuinely unnamed.

Still **Open** and still to be derived from requirements:

- **Backend technology / language / framework — still genuinely open** (the only major one left; see `context-feeders/decisions/unmade-decisions.md` §12).
- ~~Frontend technology / framework.~~ **Resolved: React with TypeScript.**
- ~~Database technology and data modeling.~~ **Resolved: PostgreSQL (durable) + Redis (runtime/cache).**
- ~~Real-time communication technology.~~ **Resolved: WebSocket.**
- ~~Caching / state-management technology.~~ **Resolved: Redis.**
- Authentication and authorization implementation — **partially resolved**: username/password for Player/Judge/Admin; Big Screen auth still fully undefined (`context-feeders/decisions/unmade-decisions.md` §15.2).
- Deployment architecture and infrastructure — still open.
- External dependencies and libraries — still open.
- PDF/OCR/extraction technology — **partially resolved**: no OCR, predefined format, narrowest parser needed; specific library still open.
- API design — **substantially addressed, not final**: a minimum REST + WebSocket contract is given (Alignment §27–28).
- The detailed competition domain model — **substantially addressed, not final**: a minimum relational model is given (Alignment §32).

---

## 9. Next Step

1. Validate this architectural style with both developers and record acceptance.
2. Resolve the requirements that block the domain model (see `unmade-decisions.md` §12 priority list) — the module boundaries in ARC-012 depend on them.
3. Build the domain/system model.
4. Revisit ARC-012 and ARC-027 against that model; correct the decomposition and event catalog.
5. Only then proceed to technology analysis and stack decisions.
