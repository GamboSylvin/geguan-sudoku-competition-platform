# Competition and Scoring Rules (DRAFT v1, 2026-09-26)

> Status tags: [C] confirmed by the client's stakeholder · [P] approved in the blanket answer · [S] stated in the client's document · [T] team decision, not client-confirmed · [A] assumed · [O] open · [L] later.
> **Status note.** The rules decided on 2026-09-26 are tagged [C]: confirmed by the stakeholder on that date (confirmed again by the project owner). The stakeholder can change a confirmed rule later; if so, update this file and add a line to `progress-tracker.md`, "Context change log".
> OPEN items are not decided. Do not implement them. IDs in brackets (SCR-006, U-03, ...) are pointers into the project's decision register.

## Terms

- An **event** (competition) has **categories** (U6 to U20 [T]). **Exact numbers, resolved 2026-09-30** [T] (U-02): the stakeholder did not supply exact student/team/school/room counts and confirmed this is deliberate, not a gap — the documented estimates (about 600–720 students, 11 rooms, at least 30 judges, 10 big screens, one team per school per category, all categories U6 to U20 in use) stay the working position; the design already handles either answer and needs no rebuild if real numbers arrive later. **Whether a room mixes categories, resolved 2026-10-01** [C] (EVT-005): no design impact either way — the system doesn't model "room" as an entity tied to category, a room is simply a physical grouping of participant numbers. Whichever way organizers assign rooms, nothing changes in what gets built.
- A category has two **stages**: Individual and Team. Each stage has **2 rounds**. An Individual round has **6 puzzles**.
- Structure (stages, rounds, order) is predefined and not admin-defined [C] (SCR-005, re-confirmed 2026-10-01, Part 6 R7).

## 1. Structure from the regulations [S]

- **Individual stage**
  - Round 1: standard Sudoku, 6 questions, 20 minutes, 100 points.
  - Round 2: variant Sudoku (diagonal, killer, jigsaw), 6 questions, 30 minutes, 100 points.
- **Team stage**: teams of 4 on tablets.
  - Round 1: rotation relay [C] (TEM-001).
  - Round 2: partition collaboration ("齐心协力"): one puzzle split into blocks, one block per tablet/member, each member seeing and editing only their own block [C] (TEM-005, resolves TEM-003, U-21, U-05). The earlier guess of a shared full-grid board is dropped.
    - **Block split** [C] (TEM-005, resolves U-91): the grid is cut into contiguous horizontal row-bands, one band per active member (2 to 6), as equal as possible; extra rows go to the first bands. Works for any grid shape or variant, never assuming 9x9.
    - **Puzzles per round:** 3, customizable [T] (TEM-006), a working position built from surrounding patterns, **not read from any source**. The real number should come from the 4th Zhejiang league regulation (pack ref R9). **Flag for replacement once the regulation numbers arrive.**
    - **Total round time:** 30 minutes, customizable [T] (TEM-007), a working position anchored to the Individual stage's 30-minute variant round, **not read from any source**. Flag for replacement.
    - **Points:** the controller sets one "points per puzzle" value for the whole round, default 20, customizable [T] (TEM-008), a working position following the same one-value-per-round pattern as rotation, **not read from any source**. Flag for replacement.
    - **Scoring:** all-or-nothing per puzzle once the blocks are combined, no early bonus, the same rules as everywhere else [C] (SCR-001, SCR-002).
    - **Needed on the event day:** yes, because the school total counts both team rounds. Rules are needed by about day 8 of the build if required on competition day.
- **School total** = individual part x coefficient + team part [C] (SCR-004). Each school has exactly one team per category [C]. **The individual part, resolved 2026-10-01** [T] (SCR-018, resolves U-04): counts **all** of the school's players in that category, not only the team's members — "school total" reflects the school's overall performance in the category, not a subset.

## 2. Points, totals and the values the controller can set

- The **controller defines the points of each question**, before that round's preparation begins. No default split of the 100 is imposed. Points are **whole numbers of at least 1**; negative and zero points are not allowed [C] (SCR-006, SCR-014).
- A round's total is **the sum of its question points**, calculated and never stored as a fixed 100 [C] (SCR-006).
- If an **Individual** round does not total 100, the controller sees a **warning**, never a block. The check is made **per category and per round**, names the category and the round, and is shown in two places: on the **setup screen** (updated as points are typed) and as a **summary when starting the stage** [C] (SCR-006, SCR-016).
- **Team rounds:** no fixed maximum, and no warning. In the rotation round the controller sets **one** "points per question" value for the whole round (default 10). A team's score is the number of correct answers times that value; 4 correct answers give 40 with the defaults [C] (SCR-007, SCR-015).
- **Editable numbers:** points, the bonus rate and counts are whole numbers, so scores are stored as integers. Zero is allowed for the bonus (no bonus). Times and question counts must be above zero. The school coefficient accepts decimals (default 0.6). No maximum, except the optional bonus cap [C] (SCR-012).
- **When values can change** [C] (RND-002, RND-004): "before a round starts" means before that round's **preparation begins**. Once it has begun, no numeric value of that round can be changed, including the countdown length; a change applies to the next round. A later round's values can be changed at any time before its preparation begins; for round 2 that includes while round 1 is running, and the window closes when round 1 ends.
- **Values are set once per round for the whole event, not per category** (20 minutes applies to both U8 and U12). Question points belong to the questions, so they follow each category's question set [C] (RND-005).
- **Question import format** [C] (BLD-024, resolves U-93): the question import file is **Excel (.xlsx), not PDF**. Replaces every earlier "PDF, strictly predefined format" statement. No-OCR still holds: structured fields (instructions, category, points, dimensions, blank-cell answers) are read from cells, never recognized from an image. The file **does** carry a points value per question, but that is only a starting value: points stay **fully customizable** by the controller everywhere they appear, including to reach the 100-per-round total [C] (BLD-025, resolves U-92).
- **One question file per category, not a shared pool** [C] (BLD-028, resolves U-32): each category (for example U8, U12) is uploaded and imported separately, even when they run the same round in parallel.
- **Categories: U6 to U20, the original scheme** [C] (BLD-027, resolves U-95).
- **Missing complete-solution column — the problem runs deeper, found 2026-10-01:** see `architecture.md`, Data model. The given (pre-filled) cells exist only as an embedded picture in the real sample files, not as text, and OCR is ruled out — there is no way today to build an interactive, correctly-locked grid from the files as they stand. **OPEN (U-94):** carried back to the stakeholder to ask whether production files can supply the given cells as structured text. Interim plan (BLD-026): hand-transcribe a small starter set meanwhile; general automated import stays blocked.

## 3. Lifecycle and timing

- The controller starts a stage. One command starts all categories together [C] (re-confirmed 2026-10-01, Part 6 R1). Only the controller starts a stage [C] (ROL-003, re-confirmed 2026-10-01, Part 6 R3).
- **Preparation** before every round: a countdown of **60 seconds by default**, changeable per round. The screen shows the round's rules and the countdown [C] (RND-001).
  - When it reaches zero, the **puzzles appear and the round timer starts immediately**, with no extra "3, 2, 1, Start". A **pause during preparation** stops the countdown; on resume the "3, 2, 1, Start" shows first, and then the countdown **continues from where it stopped**. The "3, 2, 1, Start" uses neither round time nor preparation time [C] (RND-001).
  - The controller **cannot end the preparation early**; a shorter wait is set with a shorter length beforehand [C] (RND-003).
- **Rounds inside a stage** follow each other automatically, with no human action [T]. **No manual individual-round start exists, sanity-checked and confirmed by the project owner 2026-10-01** [T] (CS-022, resolves U-38): the judge/controller only starts a **stage**; preparation, round start, round end at timer expiry, and advancing to the next round all happen automatically. This narrows an earlier judge proposal that treated a manual round start as a needed exception path — nothing reviewed since suggests a real need for it; recovery from a stuck state is already covered by reset, rematch and replay (ROL-005).
- **After a stage ends** the next stage does **not** start by itself. Players see "waiting for the next stage"; the controller starts it with the same start command, which starts all categories together. While waiting, the tablets show a waiting message and no score; the big screens keep the ranking cycle, which now includes the final ranking of the stage that just ended, and the controller can switch to any other display [C] (RND-006).
- **A round has no automatic end** when everyone has submitted. It runs until its timer ends or the controller ends it [C] (SUB-004).
- **Pause and resume** [C]: pausing stops the timer and preserves the exact state.
- **Ending a round early** cannot be undone [T]. The students' latest saved state is submitted automatically, with no bonus.
- **Finishing:** after the last round of the last stage the competition **finishes by itself**, once that round's scoring is final. The controller's "finish" command is for finishing **early** [C] (RND-006).
  - **Finishing early:** the running round is ended the same way as an early end, then the competition finishes. Unplayed rounds have no scores and add nothing (the same as counting them as 0); the school total is the individual part x the coefficient plus the team part actually played. The running round is scored on the students' latest saved state. The results and the export carry a visible **"finished early"** mark. It is in the same finished state as a normal finish: the controller keeps access to the results and can export them. It **cannot be resumed**; for an interruption such as a fire alarm the controller uses **pause** (stops the timer, preserves the exact state) and then resumes [C] (RND-007).
  - **Reset after finishing: settled, not open.** A finished competition, early or not, **cannot continue** — this is the rule already stated above (RND-007, from REQUIREMENTS §7.7), not a separate open question.
  - **Awards after an early finish, resolved 2026-10-01** [C] (U-89, narrowed): whether to grant awards after an early finish is entirely a human, on-site decision by the organizers — not the system's concern. The system's only responsibility is to clearly mark the result "finished early" and correctly calculate the scores of the rounds actually played (already built, RND-007). **No special award-tier computation or marking is needed for this case** — showing the computed scores and ranking is enough for the organizers to decide whether to award, re-run, or do something else. This narrows the earlier working position (BLD-030), which assumed the system would still compute award tiers.
  - **Award tiers, general case, resolved 2026-10-01** [C] (RES-007, resolves U-27, extends BLD-030): no award-tier computation needed, for any finish (normal or early). The system shows computed scores and the final ranking — that's sufficient for the school to apply its own award regulation (top 8 certificate, top 3 medal, etc.) by hand. The system doesn't need to know or encode the award rules, which can change independently of the product.

## 4. Player rules (Individual stage)

- **Autosave:** every move is autosaved [C]. About 2 grid saves per second per player [T]. Autosave never triggers scoring [T].
- **Submission** [C] (SUB-001, SUB-002): **once for the whole round.** Until then the student moves freely between the 6 puzzles and edits any of them (no live correctness feedback [T]). After submitting, all puzzles of the round are read-only and the submission is final. The student **confirms** before the final submit and **may submit with blank puzzles** (they score 0); the confirmation says how many are blank. A repeated submission never changes the result [C] (PL-009).
- **Late submit** [C] (SUB-003): the **server clock decides.** A manual submit arriving after the timer ended is not counted as manual; the student's latest autosaved answers are submitted automatically, as at any time expiry. **No grace period.** The student sees the same state as any student whose time expired (read-only, submission received, no score), with **no separate message**. This is for the Individual rounds.
- **Time expiry** [T]: the latest saved state for the whole round is submitted automatically. An empty grid scores 0. No penalty for a zero score, no moves, never submitting, or disconnection.
- **Reconnection** [T]: the saved grid is restored and the timer keeps running. A student whose tablet fails can continue on another tablet with the same login, keeping saved answers and remaining time [C] (PAR-005, re-confirmed 2026-10-01, Part 6 R4). One active device per account; the newest login takes over [C] (re-confirmed 2026-10-01, Part 6 R4).
- **Seeing scores** [C] (SUB-007, narrowed by BLD-029, resolves U-24, U-88): students see their own score and rank **only when the whole competition reaches `FINISHED`** — not after each round, not after each stage. Right after a submit, and for the rest of the competition until it finishes, the student sees "submission accepted" and no score.
  Whether a separate manual "publish" click by the controller is also wanted at that same moment was **not addressed** by this answer; treat as a minor residual detail, not blocking.

## 5. Scoring

- **All-or-nothing per puzzle:** a wrong or blank cell means 0 for that puzzle [C] (SCR-001). Points are set per question, by difficulty [C] (SCR-003). Scores are stored as integers.
- **No unscored or practice puzzles, confirmed 2026-10-01** [T] (SCR-019, resolves U-83): every puzzle in a round counts toward the score. This is a different question from the already-settled "no warm-up round" (CMP-106, which closed the round-level question — whether a whole extra round exists — not this puzzle-level one — whether any single puzzle within a round could be unscored).
- **Answer check** [C] (BLD-010): the submitted grid is compared with the **solution stored with the question**, with no rule checker per variant. **Unique solution, resolved 2026-10-01** [C] (U-90): every puzzle has exactly one valid solution, confirmed directly by the stakeholder.
- **Early-finish bonus** (Individual stage only; team rounds have none [C]) [C] (SCR-008 to SCR-011):
  - Applies in **both Individual rounds** at **3 points per whole minute** early, customizable by the controller.
  - Earned when the student **submits before time ends** with **every puzzle of the round fully correct**, counted in whole minutes (1 min 30 s early counts as 1).
  - **No cap by default.** The controller may set an optional maximum, in points, separately for each Individual round; empty means no cap.
  - The bonus is **part of the round score**, so a round can exceed its maximum. The individual ranking (the total of the two rounds) and the school total use that round score.
  - **Measured on the server round timer**, which stops during a pause. Fixed at the student's own manual submit. An **automatic submission** (time expiry, or the controller ending the round early) gets **no bonus**. A student who submitted earlier keeps their bonus.
- **School total** [C] (SCR-013): individual sum x coefficient + team scores, stored as an **exact decimal** (never floating point), **not rounded or truncated**. Schools are ranked on the exact value and it is shown with its decimals.
- **Team rotation round** [C] (TEM-002, TEM-004, SUB-006): 10 questions of 10 points each by default, rotation every 60 seconds; ends when the queue is empty or an optional total time is reached; all customizable. The rotation period is **not a deadline** for answering. When a question moves to the next teammate, its **partly filled grid goes with it**. A submit for a question the tablet no longer holds is **rejected**, and the member sees the new question. If a total round time is set, when it ends only answers already submitted and correct count. A member submits a single question and the answer is checked at once. No early bonus in team rounds.

## 6. Judge restart of one student

- A judge can restart one student's round [C] (ROL-003, re-confirmed 2026-10-01, Part 6 R3) **only while the round is running**, **as many times as needed**, with no controller approval [C] (SUB-005, SUB-008).
- The earlier attempt is **archived, not deleted** [C] (ROL-005, re-confirmed 2026-10-01, Part 6 R6). The student restarts with a **blank grid** and the **remaining round time** on the shared server timer. Any bonus is measured on the round timer. Each restart archives the attempt, so the number of restarts stays visible.
- If a restart would come too late to be useful, the remedy is the **replay of the round**, which the judge or the controller can trigger [C] (ROL-005). This differs from a tablet failure, where the student continues on another tablet with saved answers and remaining time.
- **Tolerable interruption length, resolved 2026-09-30** [C] (U-49): there is no fixed time limit. The stakeholder deliberately declined to set one — the controller decides, on the day, whether to resume or replay an interrupted round based on the event's schedule at that moment, regardless of how long the interruption lasted. Both resume and replay must always stay available to the controller; the system must never impose a timeout that disables either path.

## 6b. Controller reset or rematch

- The controller can reset or rematch the whole event, one round, one person or one team [C] (ROL-005). Resetting a part that already has scores is a **rematch**; the old scores are **archived, not deleted**, same as a judge restart [P] (ROL-005).
- **Rematch mechanics, resolved 2026-10-01** [T] (ROL-005, resolves U-13): a rematch gives students the **full round time again** — **not** the remaining time, which is specific to a judge's single-student restart (§6 above, SUB-005). It erases the student's partial answers for that round, and leaves earlier rounds' scores untouched.

## 7. Results, visibility and retention

- The judge sees the status of their students, the stage, round and remaining time, and the live ranking; the judge does not determine or calculate rankings [C] (EX-005). The judge also sees how many times a student left the answer page, as information only, with no penalty [P].
- Scores change only through a **controller correction with a mandatory reason and a change log** [C] (RES-003, re-confirmed 2026-10-01, Part 6 R5). The controller can export scores, rankings and answers [P]/[C] (RES-002). **Export format, resolved 2026-10-01** [C] (U-08): **Excel (`.xlsx`)**, with scores, ranks and the answer per question — as already planned. No specific layout or column list imposed; the exact columns stay an easy-to-adjust detail, not a system rule.
- **15 days** after the competition, answers, scores and student accounts are permanently deleted; the setup, the questions and the judges are kept [C] (RES-004, re-confirmed 2026-10-01, Part 6 R8).
- **Archived scores and the correction log, resolved 2026-10-01** [C] (RES-005, resolves U-62's scores/log part): also deleted after 15 days, same as the other student data. *(A daily-email reminder to the controller before deletion was considered — the user's own idea, not the stakeholder's — and withdrawn 2026-10-01; parked as a possible later-phase addition, not built now.)*
- **The uploaded participant Excel, resolved 2026-10-01** [C] (RES-009): also deleted after 15 days — it holds the same personal data as the derived accounts and records already scheduled for deletion (RES-004); keeping the raw source file after deleting what it generated would be inconsistent. **U-62 is now closed in full.**
- **Legal/school rules for student data, resolved 2026-10-01** [C] (RES-008): no special protection required — participants provide it voluntarily, the organizer assumes no legal liability. The existing 15-day deletion plan (RES-004) stands as-is.

## 8. Open items that block implementation of these rules

| Item | Open point |
|---|---|
| U-94 | The given cells are image-only, not text — deeper than just the missing solution column; re-ask refined 2026-10-01 |
| TEM-006 to TEM-008 | Working positions (puzzle count 3, time 30 min, points 20/puzzle) for the second team round, not sourced. **Closed 2026-10-01 (A10b, TEM-009): not blocking, no stakeholder question coming** — controller-configurable per competition (SCR-005); whoever sets up the real competition types in the regulation's numbers directly, if they have them |