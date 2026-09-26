# Competition and Scoring Rules (DRAFT v1, 2026-09-26)

> Status tags: [C] confirmed by the client's stakeholder · [P] approved in the blanket answer · [S] stated in the client's document · [T] team decision, not client-confirmed · [A] assumed · [O] open · [L] later.
> **Status note.** The rules decided on 2026-09-26 are tagged [C]: confirmed by the stakeholder on that date (confirmed again by the project owner). The stakeholder can change a confirmed rule later; if so, update this file and add a line to `progress-tracker.md`, "Context change log".
> OPEN items are not decided. Do not implement them. IDs in brackets (SCR-006, U-03, ...) are pointers into the project's decision register.

## Terms

- An **event** (competition) has **categories** (U6 to U20 [T]; how many are used is OPEN, U-02).
- A category has two **stages**: Individual and Team. Each stage has **2 rounds**. An Individual round has **6 puzzles**.
- Structure (stages, rounds, order) is predefined and not admin-defined [P] (SCR-005).

## 1. Structure from the regulations [S]

- **Individual stage**
  - Round 1: standard Sudoku, 6 questions, 20 minutes, 100 points.
  - Round 2: variant Sudoku (diagonal, killer, jigsaw), 6 questions, 30 minutes, 100 points.
- **Team stage**: teams of 4 on tablets.
  - Round 1: rotation relay [C] (TEM-001).
  - Round 2: partition collaboration, very probably the stakeholder's "齐心协力". **OPEN (U-05, U-21): what it is, how it is scored, how many puzzles, what time limit. Do not implement.**
- **School total** = individual part x coefficient + team part [C] (SCR-004). Each school has exactly one team per category [C].

## 2. Points, totals and the values the controller can set

- The **controller defines the points of each question**, before that round's preparation begins. No default split of the 100 is imposed. Points are **whole numbers of at least 1**; negative and zero points are not allowed [C] (SCR-006, SCR-014).
- A round's total is **the sum of its question points**, calculated and never stored as a fixed 100 [C] (SCR-006).
- If an **Individual** round does not total 100, the controller sees a **warning**, never a block. The check is made **per category and per round**, names the category and the round, and is shown in two places: on the **setup screen** (updated as points are typed) and as a **summary when starting the stage** [C] (SCR-006, SCR-016).
- **Team rounds:** no fixed maximum, and no warning. In the rotation round the controller sets **one** "points per question" value for the whole round (default 10). A team's score is the number of correct answers times that value; 4 correct answers give 40 with the defaults [C] (SCR-007, SCR-015).
- **Editable numbers:** points, the bonus rate and counts are whole numbers, so scores are stored as integers. Zero is allowed for the bonus (no bonus). Times and question counts must be above zero. The school coefficient accepts decimals (default 0.6). No maximum, except the optional bonus cap [C] (SCR-012).
- **When values can change** [C] (RND-002, RND-004): "before a round starts" means before that round's **preparation begins**. Once it has begun, no numeric value of that round can be changed, including the countdown length; a change applies to the next round. A later round's values can be changed at any time before its preparation begins; for round 2 that includes while round 1 is running, and the window closes when round 1 ends.
- **Values are set once per round for the whole event, not per category** (20 minutes applies to both U8 and U12). Question points belong to the questions, so they follow each category's question set [C] (RND-005).
- **OPEN (U-03, second part):** whether the question PDF also carries the points. The sample PDF is still to be sent (U-01). **Do not assume the PDF carries points.**
- **OPEN (U-32):** whether each category has its own question file. The data model is per category regardless (see `architecture.md`).

## 3. Lifecycle and timing

- The controller starts a stage. One command starts all categories together [T]/[P]. Only the controller starts a stage [P] (ROL-003).
- **Preparation** before every round: a countdown of **60 seconds by default**, changeable per round. The screen shows the round's rules and the countdown [C] (RND-001).
  - When it reaches zero, the **puzzles appear and the round timer starts immediately**, with no extra "3, 2, 1, Start". A **pause during preparation** stops the countdown; on resume the "3, 2, 1, Start" shows first, and then the countdown **continues from where it stopped**. The "3, 2, 1, Start" uses neither round time nor preparation time [C] (RND-001).
  - The controller **cannot end the preparation early**; a shorter wait is set with a shorter length beforehand [C] (RND-003).
- **Rounds inside a stage** follow each other automatically, with no human action [T].
- **After a stage ends** the next stage does **not** start by itself. Players see "waiting for the next stage"; the controller starts it with the same start command, which starts all categories together. While waiting, the tablets show a waiting message and no score; the big screens keep the ranking cycle, which now includes the final ranking of the stage that just ended, and the controller can switch to any other display [C] (RND-006).
- **A round has no automatic end** when everyone has submitted. It runs until its timer ends or the controller ends it [C] (SUB-004).
- **Pause and resume** [C]: pausing stops the timer and preserves the exact state.
- **Ending a round early** cannot be undone [T]. The students' latest saved state is submitted automatically, with no bonus.
- **Finishing:** after the last round of the last stage the competition **finishes by itself**, once that round's scoring is final. The controller's "finish" command is for finishing **early** [C] (RND-006).
  - **Finishing early:** the running round is ended the same way as an early end, then the competition finishes. Unplayed rounds have no scores and add nothing (the same as counting them as 0); the school total is the individual part x the coefficient plus the team part actually played. The running round is scored on the students' latest saved state. The results and the export carry a visible **"finished early"** mark. It is in the same finished state as a normal finish: the controller keeps access to the results and can export them. It **cannot be resumed**; for an interruption such as a fire alarm the controller uses **pause** (stops the timer, preserves the exact state) and then resumes [C] (RND-007).
  - **OPEN (U-89, U-27):** whether awards apply after an early finish, and whether a reset can still be applied to a finished competition.

## 4. Player rules (Individual stage)

- **Autosave:** every move is autosaved [C]. About 2 grid saves per second per player [T]. Autosave never triggers scoring [T].
- **Submission** [C] (SUB-001, SUB-002): **once for the whole round.** Until then the student moves freely between the 6 puzzles and edits any of them (no live correctness feedback [T]). After submitting, all puzzles of the round are read-only and the submission is final. The student **confirms** before the final submit and **may submit with blank puzzles** (they score 0); the confirmation says how many are blank. A repeated submission never changes the result [C] (PL-009).
- **Late submit** [C] (SUB-003): the **server clock decides.** A manual submit arriving after the timer ended is not counted as manual; the student's latest autosaved answers are submitted automatically, as at any time expiry. **No grace period.** The student sees the same state as any student whose time expired (read-only, submission received, no score), with **no separate message**. This is for the Individual rounds.
- **Time expiry** [T]: the latest saved state for the whole round is submitted automatically. An empty grid scores 0. No penalty for a zero score, no moves, never submitting, or disconnection.
- **Reconnection** [T]: the saved grid is restored and the timer keeps running. A student whose tablet fails can continue on another tablet with the same login, keeping saved answers and remaining time [P] (PAR-005). One active device per account; the newest login takes over [P].
- **Seeing scores** [C] (SUB-007): students see their own score and rank after the results are published. Right after a submit the student sees "submission accepted" and no score. **OPEN (U-24, U-88):** when results count as "published", and whether that is after each round, each stage or only at the end.

## 5. Scoring

- **All-or-nothing per puzzle:** a wrong or blank cell means 0 for that puzzle [C] (SCR-001). Points are set per question, by difficulty [C] (SCR-003). Scores are stored as integers.
- **Answer check** [C] (BLD-010): the submitted grid is compared with the **solution stored with the question**, with no rule checker per variant. This relies on every puzzle having a **unique solution**, which is **OPEN (U-90)**.
- **Early-finish bonus** (Individual stage only; team rounds have none [C]) [C] (SCR-008 to SCR-011):
  - Applies in **both Individual rounds** at **3 points per whole minute** early, customizable by the controller.
  - Earned when the student **submits before time ends** with **every puzzle of the round fully correct**, counted in whole minutes (1 min 30 s early counts as 1).
  - **No cap by default.** The controller may set an optional maximum, in points, separately for each Individual round; empty means no cap.
  - The bonus is **part of the round score**, so a round can exceed its maximum. The individual ranking (the total of the two rounds) and the school total use that round score.
  - **Measured on the server round timer**, which stops during a pause. Fixed at the student's own manual submit. An **automatic submission** (time expiry, or the controller ending the round early) gets **no bonus**. A student who submitted earlier keeps their bonus.
- **School total** [C] (SCR-013): individual sum x coefficient + team scores, stored as an **exact decimal** (never floating point), **not rounded or truncated**. Schools are ranked on the exact value and it is shown with its decimals.
- **Team rotation round** [C] (TEM-002, TEM-004, SUB-006): 10 questions of 10 points each by default, rotation every 60 seconds; ends when the queue is empty or an optional total time is reached; all customizable. The rotation period is **not a deadline** for answering. When a question moves to the next teammate, its **partly filled grid goes with it**. A submit for a question the tablet no longer holds is **rejected**, and the member sees the new question. If a total round time is set, when it ends only answers already submitted and correct count. A member submits a single question and the answer is checked at once. No early bonus in team rounds.

## 6. Judge restart of one student

- A judge can restart one student's round [P] (ROL-003) **only while the round is running**, **as many times as needed**, with no controller approval [C] (SUB-005, SUB-008).
- The earlier attempt is **archived, not deleted** [P] (ROL-005). The student restarts with a **blank grid** and the **remaining round time** on the shared server timer. Any bonus is measured on the round timer. Each restart archives the attempt, so the number of restarts stays visible.
- If a restart would come too late to be useful, the remedy is the **replay of the round**, which the judge or the controller can trigger [C] (ROL-005). This differs from a tablet failure, where the student continues on another tablet with saved answers and remaining time.

## 7. Results, visibility and retention

- The judge sees the status of their students, the stage, round and remaining time, and the live ranking; the judge does not determine or calculate rankings [C] (EX-005). The judge also sees how many times a student left the answer page, as information only, with no penalty [P].
- Scores change only through a **controller correction with a mandatory reason and a change log** [P] (RES-003). The controller can export scores, rankings and answers [P]/[C] (RES-002). Export format assumed `.xlsx` [A] (U-08).
- **15 days** after the competition, answers, scores and student accounts are permanently deleted; the setup, the questions and the judges are kept [P] (RES-004). **OPEN (U-62, U-59):** whether archived scores and the correction log, and the uploaded participant Excel, follow the 15-day deletion of student data.

## 8. Open items that block implementation of these rules

| Item | Open point |
|---|---|
| U-03 (second part), U-01 | Does the question PDF carry the points? The sample question PDF and participant Excel have not been sent |
| U-05, U-21 | The second team round: what it is, scoring, puzzles, time |
| U-24, U-88 | What "publish results" means and when students see their score |
| U-27, U-89 | Awards after an early finish; reset of a finished competition |
| U-32 | Whether each category has its own question file |
| U-90 | Whether every puzzle has a unique solution |
| U-59, U-62 | Whether archived scores, the correction log and the uploaded participant Excel follow the 15-day deletion |
| U-49 | How long an interruption during a round is acceptable |