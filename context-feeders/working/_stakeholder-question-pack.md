> **[CONTEXT FEEDER NOTE]** Working file of the requirements process (interview record, open questions, question pack). It FEEDS the `context/` folder and contains superseded statements. Do NOT read it to decide what to build.

# Stakeholder Question Pack — Sudoku Arena

Prepared 2026-09-26 for the stakeholder round.

## Purpose and how to answer

We are preparing the written specification that the developers will build from. Some rules are still missing, and we do not want the developers to guess them.
Each question below has a short "what we already know" so you can correct us if it is wrong.

- Please answer in your own words, or pick from the choices where we give them.
- If you do not know, please write **"don't know"**. If someone else can answer, please tell us who. Please do not guess: an honest gap is better than a wrong rule.
- If you can only answer some questions now, that is fine. We will come back to the rest.
- Questions that already have a clear answer are marked **RESOLVED** and keep the answer beneath them. Where the answer came from the project owner answering in your role, it says so and is listed in Part 6 for your confirmation.
- Questions are ordered by how much they affect the design. **Part 1 matters most**, because it changes how scores and submissions are stored, which is expensive to change later.

Every question ends with a short reference (for example *ref U-03*) for our own tracking. You can ignore it.

---

## Part 1 — Scoring and round rules (highest priority) — CLOSED 2026-09-30

Every question in this part now has either a confirmed answer or a working position in active use. Nothing here still blocks building. Team/project-owner decisions from this part are listed for your confirmation in Part 6 (R15 to R29); five items you answered yourself directly on 2026-09-30 are already confirmed and need no round-trip (see the note above R15).

**Corrected while closing this part: the question import file is Excel (.xlsx), not PDF.** Every earlier reference to a "question PDF" in this pack was wrong and is now Excel throughout.

Two items are being **re-asked** to you directly, because your first reply either didn't fully answer the question or showed the scenario wasn't clear. They are carried forward as **Q37** and **Q38**, after Part 7, rather than left here, so Part 1 can close.

---

## Part 2 — Roles and event-day operation — CLOSED 2026-09-30

Every question in this part was answered directly by the stakeholder and confirmed **[C]**. Nothing here still blocks building.

- **Q9** (primary user): the controller — U-52.
- **Q11** (big screens, slips and tablets on the day): out of scope for product design — U-54.
- **Q12** (what each role can see and change): access rules resolved — U-55, U-63.
- **Q15** (server stops during a round): no fixed tolerable-interruption duration — U-49.
- **Q17** (anti-cheating): confirmed as-is, nothing added — U-37 (SEC-001).
- **Q18** (failure tolerance and backup plan): failure-tolerance part resolved, same answer as Q15/U-49; the backup-plan part was **not** answered here — it was deliberately carried forward into **Q24** (Part 3, U-46) rather than answered twice, so it is not a gap in this part's closure, just a question that lives under a different number now.
- **Q19** (biggest risks): venue Wi-Fi confirmed as the biggest real-world risk — U-56. No design change; one UI-copy addition (advisory note to the controller). Also pre-confirmed pack row R13 in Part 6.

All seven answers are recorded in `context/` (`project-overview.md`, `architecture.md`, `ui-context.md`, `data-model.md`) and in `progress-tracker.md`'s Context change log, with the full wording kept there and in `context-feeders/working/_open-questions.md`.

---

## Part 3 — Numbers, venue and technical facts — CLOSED 2026-10-01

Every question in this part has an answer; some deliberately leave a piece open rather than force one.

- **Q20** (exact numbers): deliberately not provided — documented estimates stay the working position, no rebuild needed later. Narrows **U-02** to just "whether a room mixes categories," which **stays open**.
- **Q21** (max devices): 800 simultaneous clients confirmed as the ceiling — **U-60**.
- **Q22** (tablets/browser): no fixed device or browser target, standard responsive web app — **U-06**.
- **Q23** (venue network): **deliberately deferred** to closer to the event date, not blocking — **U-46 stays open** (by design, not an oversight).
- **Q24** (hosting): two-phase plan (**BLD-031**, Working Position) — Phase 1 (Railway, now) resolved; Phase 2 (event day) **stays open until U-46 is answered**.
- **Q25** (external systems): none needed, confirmed — **U-57**.
- **Q26** (speed): response-time targets confirmed (ranking ≤2s, tablets start together ≤1s) — **U-58**.
- **Q27** (student data): archived scores/correction log also purged after 15 days (**RES-005**) — narrows **U-62** to just the participant Excel, which **stays open**; **U-59** (legal rules, approval) **stays open**, explicitly classified as a genuine unknown. A proposed email-reminder add-on was raised and then withdrawn by the user (their own idea, not the stakeholder's) — parked as a later-phase maybe, no conflict remains.
- **Q28** (export): Excel format confirmed, no fixed column list — **U-08**.

**Still open after this part:** U-02 (room mixing), U-46 (venue network / event-day hosting, Phase 2), U-59 (legal data rules), U-62 (narrowed to the participant Excel). All deliberate, none a gap.

---

## Part 4 — Scope and language — CLOSED 2026-10-01

Both questions fully resolved, nothing left open.

- **Q29** (creating puzzles): out of scope for this version, confirmed — **U-45**.
- **Q30** (languages): no third language needed; language chosen per user, default Chinese, matching the existing i18n scaffold — **U-51, U-68**.

---

## Part 5 — Design — CLOSED 2026-10-01

Every question answered; two are explicitly Working Positions or deferrals rather than stakeholder-final answers, by design (the visual design comes after the first slice, BLD-009).

- **Q31** (look and brand): default visual style set as a **Working Position, not yet stakeholder-confirmed** — light, minimal, blue/gray, Tailwind defaults; no school brand yet, placeholder kept — **U-65**.
- **Q32** (fonts and Chinese display): explicit font stack confirmed, on-device CJK fallbacks, no web-font download — **U-70**.
- **Q33** (screen layouts): **deliberately left to the design phase**, confirmed not blocking — **U-66 stays open** (by design).
- **Q34** (screen sizes and orientations): fully responsive, no fixed list, consistent with ARCH-027 — **U-67**.
- **Q35** (accessibility and error feedback): no formal standard (no WCAG), reasonable touch-first practice; autosave failure shown as a discreet indicator, not an alarm — **U-69**.

**Still open after this part:** U-65 (not yet stakeholder-confirmed, a Working Position only) and U-66 (deliberately deferred to the design phase). Neither blocks building now.

---

## Part 6 — Please re-confirm what we already have

These were proposed by the team and approved in your general answer, or come from the client's original document, or are our assumptions. Please tell us **Yes**, **No** or **Change**, so that we can treat them as confirmed.
*Note: a later document of 2026-09-26 states that the rules in rows R15 to R28 were confirmed by the stakeholder. The rows are kept until the project owner verifies that.*
*Note: five answers given directly by you on 2026-09-30 do not appear as rows below, because they are already confirmed and need no round-trip — the question import file is Excel not PDF; points stay fully customizable; categories are U6 to U20; each category has its own question file; and students see their score only once the whole competition finishes. See `competition-rules.md` for the exact wording if you'd like to double-check any of them.*
*Note, added 2026-10-01: R1–R11 and R14 confirmed as a batch, no underlying decision changed; R12 confirmed with the extra administrator detail (see its row); R13 was already confirmed separately via Q19. Behind these: EVT-002, PAR-001, PAR-002, ROL-003, PAR-005, RES-003, RES-004, ROL-005, SCR-005, CMP-100, NF-001, CMP-101 and U-11 are now stakeholder-confirmed `[C]`. The single canonical statement for each was updated in `context/`; other mentions of the same decision ID elsewhere in `context/` carry the identical confirmed status even where an inline tag still reads `[P]`/`[T]`/`[S]` — those weren't individually rewritten, to avoid a large low-value edit sweep over facts whose content didn't change, only their provenance. R15 to R29 are untouched by this and still await the project owner's verification (see the note above).*

| # | Statement | Yes / No / Change |
|---|---|---|
| R1 | One event can hold several categories at once, and one command starts all of them together. | Yes — confirmed 2026-10-01, no change |
| R2 | The participant Excel creates participants, teams and accounts, and generates each participant's number and credentials. | Yes — confirmed 2026-10-01, no change |
| R3 | A judge can restart one student's round. | Yes — confirmed 2026-10-01, no change |
| R4 | One active device per account: a new login takes over the old one. A student whose tablet fails can continue on another tablet with the same login, keeping saved answers and remaining time. | Yes — confirmed 2026-10-01, no change |
| R5 | The controller can correct scores with a mandatory reason, and a change log records it. Scores change no other way. | Yes — confirmed 2026-10-01, no change |
| R6 | A rematch archives the old scores. It does not delete them. | Yes — confirmed 2026-10-01, no change |
| R7 | Only numeric values (for example points and times) can be changed, only by the controller, and only before a round starts. Stages, rounds and rules stay fixed. | Yes — confirmed 2026-10-01, no change |
| R8 | 15 days after the competition, answers, scores and student accounts are permanently deleted. The setup, the questions and the judges are kept. | Yes — confirmed 2026-10-01, no change |
| R9 | The competition follows the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League, including the round times, question counts and points. | Yes — confirmed 2026-10-01, no change |
| R10 | Publishing an event generates the entry link/QR code and the big-screen link, and locks the event structure. | Yes — confirmed 2026-10-01, no change |
| R11 | The product digitalizes the running of a competition. It is not an online Sudoku game. | Yes — confirmed 2026-10-01, no change |
| R12 | The controller is the administrator (see Q14). | Yes — confirmed 2026-10-01: no role exists above the controller in this MVP version; the Super Administrator is a separate, later multi-tenant-phase role, not part of this version |
| R13 | The venue Wi-Fi in the room with about 300 tablets is the biggest real-world risk (see Q19). | Yes — confirmed directly in Q19, 2026-09-30 |
| R14 | Later, not now: several organizing institutions on one platform (multi-tenant), a head-to-head "PK" stage, and a reusable question bank. | Yes — confirmed 2026-10-01, no change |

| R15 | (Q1) The controller defines the points of the puzzles before a round; no default split of the 100 points is imposed. The round total is the sum of the question points, calculated, not fixed at 100. For individual rounds the controller sees a warning before the round if the total is not 100 (not blocked). Team rounds have no fixed maximum and no warning. In a team rotation round the controller sets one "points per question" value for the whole round (default 10); a team's score is the number of correct answers times that value (4 correct answers give 40 with the default). | |
| R16 | (Q2) A student submits once for the whole round; free movement and editing across the 6 puzzles until then; after submitting all puzzles are read-only and final. The student confirms before the final submit, may submit with blank puzzles (score 0, the confirmation says how many are blank), and sees "accepted" and no immediate score. | |
| R17 | (Q3) Bonus: 3 points per whole minute early, changeable by the controller before a round, in both individual rounds, none in team rounds. Earned when the student submits before time ends with every puzzle of the round fully correct. Optional maximum bonus in points per individual round (empty = no cap). The bonus is part of the round score (which can exceed the round maximum) and is used in the individual ranking and the school total. Measured on the server round timer, which stops during a pause; fixed at the student's own manual submit; automatic submissions (time expiry, or the controller ending the round early) get no bonus. | |
| R18 | (Q4) The server clock decides. A manual submit reaching the server after the round timer has ended is not counted as manual; the latest autosaved answers are submitted automatically instead. No grace period. The student sees the same as any expired student, with no separate lateness message. Individual rounds only. | |
| R19 | (Q4b) Team rotation: the 60 seconds is the interval for moving questions to the next seat, not a deadline. A partly filled grid goes with the question. A submit for a question the tablet no longer holds is rejected. If a total round time is set, only answers already submitted and correct count when it ends. | |
| R20 | (superseded by R33 below — students see their own score and rank only once the whole competition finishes) | |
| R21 | (Q2) A judge's restart of one student is a one-person rematch: the earlier submission and score are archived, not deleted; a judge can restart a student only while the round is running; the restarted round starts with a blank grid and the remaining round time on the shared server timer (same deadline as everyone), and the bonus is measured on the round timer as for everyone else. If a restart would come too late, the remedy is the replay of the round. A judge may restart the same student as many times as needed while the round is running, with no separate limit and no controller approval; each restart archives the earlier attempt, so the number of restarts stays visible, and the remaining round time keeps getting shorter. A round has no automatic end when everyone has submitted; it runs until its timer ends or the controller ends it. Controller-entered values are whole numbers (a question's points are at least 1; the bonus rate may be 0; times and counts above 0); the school coefficient may have decimals (default 0.6). The school total is stored as an exact decimal, neither rounded nor truncated, and schools are ranked on the exact value. | |
| R22 | (Q5) The preparation countdown before each round lasts 60 seconds by default. The controller can change it for each round before that round starts. The preparation screen shows the round's rules and the countdown. The "3, 2, 1, Start" countdown after a pause is separate and does not use round time. When the countdown reaches zero the puzzles appear immediately and the round timer starts (no extra "3, 2, 1, Start"). A pause during preparation stops the countdown; on resume the "3, 2, 1, Start" shows first and then the countdown continues from where it stopped, not from the beginning. The controller cannot end the preparation early: the countdown always runs to zero, and a shorter wait is set with a shorter countdown length for that round. | |
| R23 | (Q5) Numeric values (points, bonus, times, counts, countdown length) can be changed only before that round's preparation begins. Once the preparation countdown has started, no numeric value of that round can be changed; a change applies to the next round. | |
| R24 | (Q5) The controller can change round 2's values at any time before round 2's preparation begins, including before the stage starts and while round 1 is running. The window closes the moment round 1 ends (by its timer, or because the controller ended it early), since round 2's preparation then begins automatically. | |
| R25 | (Q5) The round time, the preparation length, the bonus rate and its cap, and the other numeric values are set once per round for the whole event, not per category (20 minutes applies to both U8 and U12). Question points belong to the questions themselves and follow each category's question set. | |
| R26 | (Q5) The "total is not 100" warning is checked per category and per round (individual rounds only) and names the category and the round. The controller sees it on the setup screen, next to the points and updated as they are typed, and as a summary when starting the stage, listing every category and round whose total is not 100. It never blocks; the controller can start anyway. | |
| R27 | (Q6) The next stage does not start by itself. When a stage finishes, players see the "waiting for the next stage" state and the controller starts the next stage with the same start command, which starts all categories together. Rounds inside a stage follow each other automatically. After the last round of the last stage, the competition finishes by itself once that round's scoring is final; the controller does not need to press Finish at the normal end (the "finish" command exists for finishing early, ending the running round the same way). While waiting for the next stage, students see a waiting message with no score or rank, and the big screens keep the ranking cycle, now including the final ranking of the stage that just ended. | |
| R28 | (Q6) If the competition is finished early: unplayed rounds have no scores and add nothing; the school total is the individual part x 0.6 plus the team part actually played (0 if the team stage never started); the running round is scored on the students' latest saved state; the results and the export carry a visible "finished early" mark. It counts as a normal finished competition (the controller keeps access to the results and can export them). A finished competition cannot continue; for an interruption such as a fire alarm the controller uses pause and then resume. | |
| R29 | (Q7) The second team round is the client document's partition round: one puzzle split into row-band blocks, one block per member (2 to 6), each editing only their own block, scored all-or-nothing once combined, no early bonus. It is needed on the event day. The puzzle count (3), total time (30 minutes) and points per puzzle (20) are working positions, not taken from the regulation, and are already in use for building; if you have the real numbers from the 4th Zhejiang league regulation, please give them and we will swap them in. | |

---

## Part 7 — Approval — CLOSED 2026-10-01

**Q36. Written approval — RESOLVED (2026-10-01).**
Answer: Informal process, no formal signature required. The stakeholder/project owner does not sign a formal written requirements document with a deadline — approval happens informally, as the project owner validates each answer along the way (as already done throughout this pack). This is consistent with the existing `FILL-BEFORE-CODING.md` section E row, already marked done.
*(ref A14)*

---

## Part 1, carried forward — two answers we'd like made clearer

Your first replies on these two didn't quite answer what we asked. Nothing is blocked by them — we're building with a stopgap in the meantime — but we'd like a clearer answer when you have a moment.

**Q37. The missing solution column — STILL OPEN, question refined 2026-10-01 (not yet re-sent/answered).**
Technical finding: there is no way to build an interactive, correctly-locked Sudoku grid using only what the sample files provide today. The given (pre-filled) cells exist only as an embedded picture, not as text — and OCR is ruled out by project rule. This is being carried back to the stakeholder, to ask whether the real production files can include the given cells as structured text (the same way the answer column already is), not just the image.
Interim plan stays in place while waiting (BLD-026): manual transcription of the given cells for a small starter set, to build and test the answer-check unit. The general automated import stays blocked until a clear answer comes back.
**Refined question to send:** can the real production files include the given (pre-filled) cells as structured text — the same way the answer column already is — not just as an embedded image?
Your answer: _______________ *(ref U-94)*

**Q38. Awards after an early finish — RESOLVED (2026-10-01).**
Answer: Whether to grant awards after an early finish is entirely a human, on-site decision by the organizers — not the system's concern. The system's only responsibility: clearly mark the result "finished early", and correctly calculate the scores of the rounds actually played (already built, RND-007). No special award-tier computation or marking is needed for this case — showing the computed scores and ranking is enough for the organizers to decide whether to award, re-run, or do something else.
This narrows the earlier working position (BLD-030), which assumed the system would still compute award tiers. It does not resolve the separate, general question (U-27) of whether the system computes award tiers at all for a normal finish — that stays open.
*(ref U-89, U-27)*

---

## Part 8 — New items found while reviewing this pack (added 2026-10-01)

These were never sent as numbered questions. Each was noted along the way as "ask the stakeholder" and set aside for later; this is that later. None of them block building right now — they affect specific units, listed under each question.

**Q39. Unique solutions**
The answer check compares a student's submitted grid with the solution stored with the question; it does not run a rule-checker per Sudoku variant (BLD-010). This only gives the right result if every puzzle has exactly one valid solution.
- Can you confirm every puzzle used in the competition has a unique solution? Or should we assume some might not, and handle that case?
Your answer: _______________ *(ref U-90)*

**Q40. What a judge sees in the team stage**
We've confirmed what a judge sees and can do in the Individual stage: their assigned students' status, and a single-student restart, nothing more (U-55, U-63).
- Is it the same in the Team stage — status of their assigned teams, nothing more — or does the judge need something specific to team play (for example, which teammate currently holds a question during rotation, or status per team member rather than per team)?
Your answer: _______________ *(ref U-39)*

**Q41. Rooms and categories**
Categories run in parallel and are ranked separately. The room/participant numbers are documented as working estimates (11 rooms, one of about 300 students).
- Does a single room ever hold students from more than one category at the same time, or is every room always exactly one category?
Your answer: _______________ *(ref U-02)*

**Q42. Tie-break rule**
Rankings are derived from scores; the school total is stored and compared as an exact decimal, never rounded.
- If two players, two teams, or two schools end up with the exact same score, what breaks the tie? For example: earlier submission time, earlier completion time, alphabetical order, or no tie-break at all (shared rank)?
Your answer: _______________ *(ref U-22)*

**Q43. Award tiers for a normal finish**
Q38 settled that awards after an *early* finish are a human, on-site decision — the system doesn't compute anything special for that case. This question is about the general case, not just early finishes.
- Does the system need to compute or mark award tiers at all (for example gold/silver/bronze, or a cutoff rank) for a competition that runs to its normal end? Or is showing the computed scores and final ranking always enough, and awarding is entirely up to the school either way?
Your answer: _______________ *(ref U-27)*

**Q44. Extra participant Excel columns**
The confirmed columns are Name, School, Category, Team. The client's original document also mentioned things like age, city or province.
- Will the real production file carry any columns beyond Name, School, Category, Team? If so, which, and what should the system do with them — store them, display them, or ignore them?
Your answer: _______________ *(ref U-40)*

**Q45. Changing a team after import**
Teams are derived automatically from the participant file's Team column at import time, not formed by hand afterward.
- Once a file is imported, can a student be moved to a different team (for example, a late substitution), or are teams fixed from that point on?
Your answer: _______________ *(ref U-41)*

**Q46. Regenerating the big-screen link**
All big screens share one link, generated at publish, with no login (BSC-001/BSC-002).
- Should the controller be able to regenerate that link after publish (for example, if it was shared somewhere it shouldn't have been)? If so, what happens to a screen that's already open on the old link — does it just stop updating, or should it show something?
Your answer: _______________ *(ref U-15)*

---

## For the project owner (not the stakeholder) — CLOSED, stale section corrected 2026-10-01

Both items below were answered on 2026-09-27 and were never removed from this list when they closed — corrected now, not a new gap.
1. ~~Names and roles of the two developers, the business/client lead and the project owner.~~ **Recorded (I-17):** Sylvin (developer 1), Louise (developer 2), project owner the Sudoku team, business lead Ma Laoshi. See `project-overview.md`, "Client and team".
2. ~~What the two developers know well, and their experience with real-time applications, PostgreSQL and Redis.~~ **Recorded (I-18):** both junior; Sylvin a little more React, a little Express, some PostgreSQL, a little Redis; Louise a little Express and React, more PostgreSQL; both little real-time, Socket.io the tool they know best. See `project-overview.md`, "Client and team".

---

## Tracking

When answers come back, they are recorded in `_open-questions.md` (with the date and the exact wording), the matching items are marked ANSWERED, and `_interview-notes.md` is updated. Nothing is treated as decided until an answer is recorded.
