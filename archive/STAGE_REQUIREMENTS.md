# STAGE_REQUIREMENTS.md

# Stage Requirements

**Status:** Working Draft — requirements-level; nothing is confirmed unless explicitly marked
**Scope:** MVP
**Related documents:** `FLOW_REQUIREMENTS.md` (flow), `client-view.md` (client vision), `decisions/project-decisions.md`, `decisions/unmade-decisions.md`

> **Update (2026-09-24, stakeholder answers — `decisions/project-decisions.md` §15):** the Team stage has **two modes only**: rotation and "齐心协力" (working together); the buzzer-style mode is dropped, and rotation is built first. Rotation defaults are **10 questions** and **60 seconds**, both customizable. Team rounds have **no early-finish bonus** (the bonus exists only in the Individual stage). Each school has exactly one team per category, and a **school total ranking** is required (individual × 0.6 + team). The rules of "齐心协力" are not yet defined.
>
> This document defines the **competition stages**. The MVP realizes the **Individual** and **Team** stages. The **PK** stage is **deferred** and not realized in the MVP.
>
> When a requirement diverges from the client's `client-view.md`, the divergence is explicitly identified and left open for client validation.

---

## 1. Stage Composition

### STG-001 — MVP stage set: Individual + Team
For the MVP, the competition realizes **two stages**: **Individual** and **Team**. *(Confirmed — MVP scope decision.)*

### STG-002 — PK stage deferred (not in MVP)
The **PK** stage is **not realized in the MVP**. The PK algorithm and its mechanics will not be designed for now, because the client has stated that PK is not needed in the competition for now. *(Confirmed — MVP scope decision.)*

Supporting evidence in `client-view.md`:
- §2.1: "重要：实际赛制只有个人赛 + 团体赛（无 PK 赛）。" — the actual format is only Individual + Team, **no PK**.
- §2.5: PK is titled "预留能力，正式比赛未启用" — **reserved capability, not enabled in official competitions**.

The earlier working position of "three stages (Individual, Team, PK)" is **superseded for the MVP**.

### STG-003 — Each stage is defined separately
Each stage type has its own definition, requirements, and configuration. *(Working Position)*

---

## 2. Per-Stage Rankings (No Combined Final Ranking)

### STG-010 — Each stage produces its own final ranking
Each stage has its **own final ranking** at its end. *(Working Position)*

### STG-011 — No combined cross-stage final ranking
There is **no final ranking that combines all stages** of the competition. Rankings are **per-stage only**. *(Working Position)*

**Divergence note vs `client-view.md`:** `client-view.md` §2.1 defines a **team total** formula that aggregates individual-stage scores (×0.6) with team-stage scores. STG-011 states there is no combined cross-stage ranking. These are not strictly contradictory — the formula aggregates into a *team total*, not a *cross-stage individual ranking* — but the relationship must be clarified:
- Does "no combined final ranking" apply to **individual** standings, **team** standings, or **both**?
- How does it relate to the `client-view.md` team-total formula, if at all?

---

## 3. Individual Stage

### 3.1 Purpose
In the Individual stage, **each player is evaluated on their own**, regardless of any team the player belongs to. The stage is purely about the individual player.

### IND-001 — Individual scoring basis
In the Individual stage, **each player receives questions and is scored individually**, independently of the team (if any) to which the player belongs. *(Working Position)*

### IND-002 — Team membership is irrelevant to individual scoring
Team membership does **not** affect scoring, ranking, or storage in the Individual stage. What matters is the **player as an individual**. *(Working Position)*

### IND-003 — Scores stored per player
Scores in the Individual stage are stored **per player as an individual**. *(Working Position)*

### IND-004 — Individual stage final ranking
The Individual stage ends with its **own final ranking** of individual players. *(Working Position — see STG-010 / STG-011.)*

### 3.2 Questions

### IND-010 — Question types are defined later
The **types of questions** used in the Individual stage **will be defined** later. *(Open)*

### IND-011 — Questions come through import
Questions for the Individual stage arrive through **import**. *(Working Position — matches `project-decisions.md` QB-003 / `ORGANIZATION_ADMIN_REQUIREMENTS.md` OA-042.)*

### IND-012 — Validation approach (initial developer vision — needs confirmation)
The initial vision for validating submitted answers:
1. Use a **recognition algorithm** (the "recognizer") on the imported puzzle.
2. Represent each question as a **grid with the given solution** — i.e., the **initial state** and the **solution state**.
3. Validate by a **completion algorithm** that checks the submitted grid against the solution.
4. If this is confirmed, the system does **not** need to determine what *type* a question is. It only needs the **initial state** and the **solution state**, then uses **completion** to check the answer.

*(Proposed — **not confirmed**; may not match what the client expects. Must be validated with the client.)*

**Open question:** Confirm whether the recognizer + solution-grid + completion-check approach is acceptable for validating answers in the Individual stage.

### IND-013 — Fallback scoring when completion is not used
If the completion algorithm is **not** used, a **scoring system must be defined per question type** for:
- the Individual stage, and
- **all rounds** of the Individual stage.

*(Open — depends on the confirmation of IND-012.)*

### 3.3 Grid Shapes (Aside)

### IND-020 — Puzzle shapes may vary
Equations/puzzles can have **different shapes**. Examples under discussion: **9×9** grids, **9×6** grids (exact set to be confirmed). The system must account for shape variation. *(Working Position / Open — exact shapes to confirm.)*

### IND-021 — Shape-aware import
Import is envisioned with a **normal PDF parser**, using documents that have **specific shapes**. **Specific shapes should be defined for each type of question.** *(Proposed — noted as an aside from the main Individual-stage definition.)*

**Open question:** Define the set of supported puzzle shapes (e.g., 9×9, 9×6) and how shape relates to question type.

---

## 4. Team Stage

### 4.1 Purpose
In the Team stage, players compete **as teams**. Team membership comes from the imported participant data (matches `PT-003` / `OA-052`). The most emphasized and best-defined team round is the **rotation round**; other round types are listed in `client-view.md` with a one-line description each but are not further specified.

### 4.2 Team round types (working)

### TEAM-001 — Multiple team round types were mentioned earlier
At the start, **many types of team rounds** were discussed. Today, the **rotation round** is the one that has been **most emphasized**. The other types are not being emphasized further. *(Working Position)*

### TEAM-002 — Round types listed in client-view.md
`client-view.md` §2.4 lists **three** team rounds:
1. **轮转接力 (Rotation relay)** — the rotation round, detailed below.
2. **分区协作 (Partition collaboration)** — "同一题拆成多区块，多平板联动各负责一块，整题完成即团队得分" (one puzzle split into blocks, multiple tablets cooperate, full puzzle completion scores the team).
3. **抢答夺分 (Quick-answer scoring)** — "全队看同一题抢答，先答对得全分，答错扣分或转移答题权" (whole team sees one puzzle and answers fast; first correct gets full points; wrong answers deduct or transfer answering rights).

Only the **rotation round** has detailed mechanics. The other two are **listed but not further defined**. *(Working Position / Open — confirm which team round types are in scope for MVP.)*

### 4.3 The rotation round (emphasized round)

### TEAM-010 — Team size 2–6, generally 4
A rotation team has **2 to 6 players**, generally **4**. *(Working Position — matches `client-view.md` §3.3 default `n=4`, range 2–6.)*

### TEAM-011 — Questions rotate among teammates
The questions **rotate among the players of a particular team** after a set interval (a couple of minutes; `client-view.md` §3.3 default `t=60` seconds). *(Working Position)*

### TEAM-012 — The team must finish all puzzles
The team must solve **all** the puzzles in the round. A typical example mentions **16 puzzles**; `client-view.md` §3.4's worked example uses **10**. *(Working Position / Open — confirm the intended puzzle count.)*

### TEAM-013 — Deal one puzzle per player, then rotate and replenish
The round works as follows:
1. **Initial deal:** each player receives **1 puzzle**.
2. **Rotation:** puzzles rotate among the players after the interval.
3. **On completion:** when a player finishes a puzzle, it is **moved out** (to the judge/system for validation) and **replaced with a new one**.
4. **Continue** until **all puzzles are solved** (or the round's total time is reached).

*(Working Position — matches `client-view.md` §3.2/§3.3 rotation + replenish loop and ending condition "全部题目答完 · 或 · 达到比赛总时长".)*

### TEAM-014 — Configurable parameters
The rotation round's core parameters are **configurable**: player count (2–6), total puzzle count, per-puzzle points, rotation period, total round duration. *(Working Position — matches `client-view.md` §3.1/§3.3.)*

### TEAM-015 — Scoring
Points accumulate per correctly solved puzzle toward the **team total**. *(Working Position — matches `client-view.md` §3.3 "答对累加计分 / 团队总分排名". Exact scoring, early-completion bonus, and any penalties remain to be confirmed — see `FLOW_REQUIREMENTS.md` §5 and `unmade-decisions.md` SC-1…SC-7.)*

### 4.4 Other team round types — status
分区协作 and 抢答夺分 are listed in `client-view.md` but have **no detailed rules** in the current documentation. Whether they are in scope for the MVP is **open**. *(Open)*

---

## 5. PK Stage — Deferred (Not in MVP)

### 5.1 Decision
The **PK stage is not realized in the MVP**. The PK algorithm and mechanics will not be designed for now. *(Confirmed — MVP scope decision.)*

### 5.2 Rationale
`client-view.md` states that PK is **not needed in the competition for now**:
- §2.1: the actual competition format is only Individual + Team (**no PK**).
- §2.5: PK is a **reserved capability, not enabled in official competitions**.

### 5.3 What client-view.md documents about PK (for future reference only)
Recorded so the concept is not lost, but **explicitly out of MVP scope**:

- PK is a **head-to-head (1v1) duel**, matched **online** (client-view §2.5, §1.1 "PK赛（在线匹配）").
- Three PK rounds are listed (§2.5):
  1. **同题竞速** — both sides solve the same puzzle; first correct completion wins; winner full points, loser scored by progress; opponents matched online.
  2. **道具对战** — items interfere during play (add time / mask / change puzzle); correct answer plus item-strategy bonus.
  3. **积分擂台** — multi-round arena; cumulative win/loss points; ranked by cumulative points.
- Big Screen: "PK 双人对战同屏" (two boards side by side), selectable by Judge/Admin.
- Config center: a competition-type toggle for Individual/Team/PK and "PK online-matching parameters" — the client's config concept, not an accepted MVP requirement.

*(These are recorded as client-proposal content only. No PK requirement is active.)*
