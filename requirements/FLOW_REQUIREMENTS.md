# FLOW_REQUIREMENTS.md

# Competition Flow Requirements

**Status:** Working Draft — Client Vision (Not Confirmed)
**Scope:** MVP
**Method:** Problem → Requirements → Domain/System Model → Architecture Analysis → Architecture Decision → Technology Analysis → Stack Decisions → Detailed Design → Coding

> This document captures the **client's vision of the competition flow and system mechanics** as described in discussion. Nothing here is confirmed. Items that match existing requirements or decisions are marked as **matching — still unconfirmed**. Items that diverge from existing documents are marked **[Check with client]** and are also recorded in `decisions/unmade-decisions.md`. This document is a working draft for client validation, not a binding specification.

---

## 1. Purpose

This document describes how a competition **flows** through the system: from creation, through publication and access, into live execution, and to completion. It also captures the **scoring model**, **question mechanics**, and **participant import mechanics** as envisioned by the client.

---

## 2. High-Level Competition Flow (Client Vision)

The client envisions the following flow:

```text
1. Organization Admin creates the competition and publishes it.
2. System generates a link (and/or QR code) for players and judges to connect.
3. System generates a separate link/token for the Big Screen to connect.
4. Participants who registered for the competition connect and enter via the link.
5. The Judge starts the competition; rounds progress until the competition is over.
```

Each step is detailed below. **All items in this section are the client's vision and are unconfirmed.**

### FLW-001 — Competition creation and publication
- Only the **Organization Admin** has the right to create a competition. *(Matches OA-005 / OA-010 — still unconfirmed for the Flow.)*
- Creating a competition is followed by **publishing** it.
- **Publication** is the point at which the competition becomes accessible to other people.

**[Check with client]** — What exactly does "publishing" generate? Does it generate the player/judge links automatically, or is publishing a separate step from generating access links?

### FLW-002 — Player and Judge access link
- After publication, the system provides a **link** (and/or QR code) that allows **players and judges** to connect to the competition.
- Players who have put their name to the competition can connect and enter via this link.

**[Check with client]** — Are player and judge access the same link, or separate? Does the link itself identify the user, or is additional authentication required?

### FLW-003 — Big Screen access
- A **separate link or token** is provided for the **Big Screen** to connect to the system.

*(Matches the existing Big Screen access concept — CA-003 — still unconfirmed.)*

### FLW-004 — Player entry
- When the links are out, players can connect and enter the competition they have registered for.

**[Check with client]** — What exactly happens when a player who is **not registered** attempts to enter?

### FLW-005 — Judge starts and runs the competition
- The Judge starts the competition (or stage).
- Rounds progress — the Judge activates the next round, and so on, until the whole competition is over.

**[Check with client]** — Which transitions are Judge-controlled vs automatic? (Matches the open question in the Judge proposal — J-004 automatic round progression vs J-003/J-005 manual start.)

---

## 3. What a Competition Is (Structure)

The client describes a competition as having:

- A **name**
- A **description**
- **Stages** — which can be an **Individual** stage, a **Team** stage, or a **PK** stage.

Each **stage** has:

- **Rounds**

Each **round** has:

- A **name**
- A **duration**
- A **type**
- A **set of equations (Sudoku puzzles)**

*(This matches the existing competition structure model — Competition → Stages → Rounds, CS-001/CS-002, CS-005 — still unconfirmed for the Flow.)*

### FLW-010 — Competition fields
- **Name** *(Matches OA-011 — unconfirmed.)*
- **Description** *(Matches OA-011 — unconfirmed.)*

### FLW-011 — Stage types
- **Individual**
- **Team**
- **PK**

*(Matches CS-003 stage types — unconfirmed. Note: the current working position lists these three types but the actual competition regulations referenced in client-view only use Individual + Team, with PK as a reserved capability.)*

**[Check with client]** — Is PK in scope for the MVP, or reserved for later?

### FLW-012 — Round fields
Each round has:
- **Name**
- **Duration**
- **Type**
- **Set of equations (puzzles)**

*(Matches CS-005 round configuration — unconfirmed.)*

---

## 4. Competition Lifecycle (Setting → Published → Locked)

The client describes a **lifecycle** for a competition:

### FLW-020 — Setting (draft) stage
- Before publication, the competition is in a **setting** stage where things are still editable/available.

### FLW-021 — Published stage
- There is a **published** state, meaning the competition is **accessible to other people**.
- When published, the competition is **immutable / locked**.

**[Check with client]** — This is a key divergence to reconcile. The existing decision register records the configuration lock point as **unresolved** (publication vs first access vs start). The client's vision here suggests **publication = lock**. This must be confirmed with the client.

### FLW-022 — Post-publication editing
- The client's vision implies the competition **cannot be edited once published** (it is locked).

**[Check with client]** — Is there **any** exceptional path to modify a published competition? (This matches the open CMP-7 / CMP-8 questions.)

---

## 5. Scoring System (Client Vision)

The client describes a **recognition-based scoring system**:

### FLW-030 — Recognition-based scoring
- Each Sudoku has a **question grid** and a **solution grid**.
- When a player submits, the system compares the **number of grids (cells) the player filled correctly** against the solution grid.
- Points are awarded **according to the percentage of correct cells**.

**[Check with client — Important divergence]**
This is a **partial-credit / proportional** scoring model. The existing client-view.md competition rules describe a different model: individual rounds worth 100 points, full-correct submissions earn +3/min early bonus, wrong/blank answers score 0. These two models need to be **reconciled**: is scoring per-cell proportional, all-or-nothing per puzzle, or a hybrid? Also, how do time bonuses and puzzle-difficulty weighting fit in?

### FLW-031 — Per-question point value and type
- Each type of question has a **particular point value**.
- Since each round is a specific type, the round type can either:
  - Give the time for the round **directly**, or
  - Allow the time to be **set manually** for the round.

**[Check with client]** — Should per-question points be assigned individually, or per-type? And is round duration driven by the question type or set manually?

### FLW-032 — Scoring parameters
- Parameters include: **score, difficulty, type** of the puzzle.

**[Check with client]** — What is the exact weighting between correctness percentage, question difficulty, and time bonus?

---

## 6. Questions / Equation Bank

### FLW-040 — Equation bank (question bank)
- The system has an **equation bank** (question bank).

### FLW-041 — Adding questions to a round
- When uploading a question to a round, the admin can either:
  1. **Choose from the question bank**, or
  2. **Upload directly from a file** (PDF).

### FLW-042 — Uploaded files are saved to the bank
- When a file is uploaded, it is **also saved to the question bank** for future reuse.

*(Matches QB-001, QB-003, QB-004 — unconfirmed.)*

### FLW-043 — Question document contents
- A question document (PDF) contains:
  - The **questions**
  - The **solutions**
  - **Parameters** — score, difficulty, type of puzzle.

**[Check with client — noted as pending requirement]**
The expected answers / solutions in the upload are **a requirement to be sent later**. The exact PDF structure, whether solutions are required at upload time, and how solution validation works must be defined.

### FLW-044 — Reuse from the bank
- Future competitions/rounds can **reuse questions** by choosing from the question bank by type.

*(Matches QB-001 — unconfirmed.)*

---

## 7. Participants (Client Vision)

### FLW-050 — Excel import
- Participants are **mostly imported via an Excel file**.

### FLW-051 — Participant fields
- Details are set in the file. Candidate fields (not finalized):
  - Name
  - School
  - Category
  - Team (maybe)
  - Age (maybe)
  - City / Province
  - Other classification parameters

### FLW-052 — Classification purpose
- These fields help **classify players** and determine **which players are on the same team**.
- Team membership is determined by a **same-team value in the Excel file**.

### FLW-053 — Team management
- The client describes team management as: check if players are on the same team in the Excel file. That is the current extent of team management.

**[Check with client]** — Exact participant fields and team-detection rules need confirmation. The existing record (PT-001, PT-003) matches the Excel-import and system-derives-teams vision — still unconfirmed.

---

## 8. Open Points to Check with Client

This section consolidates every **[Check with client]** marker from above:

| # | Question | Related existing question |
|---|---|---|
| FLW-Q1 | What exactly does "publishing" generate? Does it auto-generate player/judge links? | CMP-2 |
| FLW-Q2 | Are player and judge access the same link, or separate? Does the link identify the user or require additional auth? | PL-1, JD-8 |
| FLW-Q3 | What happens when an unregistered/unauthorized player attempts entry? | PL-6 |
| FLW-Q4 | Which competition transitions are Judge-controlled vs automatic? | SR-7, J-003/J-004/J-005 |
| FLW-Q5 | Is PK in scope for MVP, or reserved for later? | SR-3 |
| FLW-Q6 | **Scoring model:** is scoring per-cell proportional, all-or-nothing per puzzle, or hybrid? How do time bonuses and difficulty weighting fit? | SC-1…SC-7 |
| FLW-Q7 | Per-question points: assigned individually or per-type? | SC-3 |
| FLW-Q8 | Round duration: driven by question type or set manually? | CS-005 |
| FLW-Q9 | **Lifecycle:** is publication = lock? Is there any post-publication edit path? | CMP-3, CMP-7, CMP-8 |
| FLW-Q10 | Question document: what exactly is in the PDF? Are solutions required at upload? | OA-9, OA-11 |
| FLW-Q11 | Participant fields: which are required? How exactly is team membership detected from the file? | PT-1, OA-1 |

---

## 9. Status Summary

| Item | Status |
|---|---|
| Competition → stages → rounds structure | Client vision, matches existing working position, **unconfirmed** |
| Stage types: Individual / Team / PK | Client vision, matches existing working position, **unconfirmed** |
| Round fields: name, duration, type, questions | Client vision, matches existing working position, **unconfirmed** |
| Organization Admin creates competitions | Client vision, matches existing confirmed OA-005, **unconfirmed for Flow** |
| Link/QR for players + judges; separate Big Screen token | Client vision, matches existing working position, **unconfirmed** |
| Setting (draft) → Published → Locked lifecycle | Client vision — **diverges from/refines existing open question**; check with client |
| Recognition-based proportional scoring | Client vision — **new/diverging from client-view rules**; check with client |
| Question bank + direct upload + saved to bank | Client vision, matches existing working position, **unconfirmed** |
| Excel participant import + team-from-file | Client vision, matches existing working position, **unconfirmed** |
| Solutions in question upload | **Requirement to be sent later** |

---

## 10. Next Step

1. Validate the flow and mechanics with the client.
2. Resolve the divergences in §8 (especially scoring model and lifecycle/lock point).
3. Record accepted items in `requirements/` as confirmed requirements and in `decisions/project-decisions.md` only after explicit client confirmation.
4. Continue to domain/system modeling and architecture analysis only after the flow is stable.
