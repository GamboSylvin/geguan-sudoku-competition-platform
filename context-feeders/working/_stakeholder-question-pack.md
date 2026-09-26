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

## Part 1 — Scoring and round rules (highest priority)

*Q1 to Q4 were answered on 2026-09-26 by the project owner, answering in the stakeholder's role. They are decisions to build from and are **not yet confirmed by the client's stakeholder**. Please confirm them with Yes / No / Change in Part 6 (R15 to R21).*

**Q1c. Still to answer: do the question PDFs carry the points?**
- The project owner will come back with a sample PDF. Please do not assume the PDF carries points.
Your answer: _______________ *(ref U-03, second part; U-01, the sample files)*

*Q1 (points and total), Q2 (submission), Q3 (early-finish bonus), Q4 (late submit) and Q4b (team rotation timing) were answered by the project owner and are clear. They are listed in Part 6 for your confirmation (R15 to R19, R21 to R27). Only their open sub-questions remain in this part.*

**Q4c. Still to answer: when may students see their score?**
Students see their own score and rank after the results are published; right after a submit they see no score.
- What does "publish results" mean, and when exactly do results count as published?
Your answer: _______________ *(ref U-24, U-88)*

**Q5b. Still to answer: question files per category**
- Does each category have its own question file? *(ref U-32)*
Your answer: _______________

**Q6b. Still to answer: finishing the competition early**
If the controller finishes the competition early, the results carry a visible "finished early" mark (see R28).
- Do awards apply to a competition that was finished early? *(ref U-27, U-89)*
- Can the controller reset (rematch) after the competition has finished? *(ref U-89)*
Your answer: _______________

**Q7. The second team round ("齐心协力")**
The team stage has a rotation round first. Your own words suggest a shared board where the whole team sees and edits each other's entries. The client's document describes a partition round: one puzzle split into blocks, one tablet per block, and the team scores when the whole puzzle is complete.
- Are these the same round, or two different ones?
- How is it played, how is it scored, how many puzzles, and how much time?
- Is it needed on the event day?
Your answer: _______________ *(ref U-05, U-21)*

---

## Part 2 — Roles and event-day operation

**Q9. Who is the primary user?**
There are four ends: players, controller, judges, big screens.
- Which one is the primary user of the product, the one it is mainly built for?
Your answer: _______________ *(ref U-52)*

**Q11. Big screens, slips and tablets on the day**
All big screens open from one shared link.
- Who opens the link on the screens?
- Who hands out the printed credential slips and the tablets to the students?
Your answer: _______________ *(ref U-54)*

**Q12. What each role can see and change**
We know: a judge sees their own students' status and can restart one student's round; the controller can do everything a judge can, plus setup, rules, score corrections, and control of the big screens; a player cannot start or control anything.
- Beyond that, what else can a judge do or see?
- Can a player see only their own answers?
- Can a judge see students outside their range?
- Who may edit participants during the event?
- Can a judge change a score?
Your answer: _______________ *(ref U-55, U-63)*

**Q15. If the server stops during a round**
After a restart the competition comes back paused, and the controller chooses to resume or replay the round. A replay is acceptable.
- How long an interruption during a round can the event tolerate?
Your answer: _______________ *(ref U-49)*

**Q17. Anti-cheating**
We know: the server decides time and scores; one active device per account; the judge sees how many times a student left the answer page (information only, no penalty); remote-competition security and proctoring are out of scope.
- Do you want anything more to prevent cheating?
Your answer: _______________ *(ref U-37)*

**Q18. Failure tolerance and backup plan**
- How much failure can the event tolerate on the day?
- Is there a backup plan (for example an on-site server, or paper)?
Your answer: _______________ *(ref U-61)*

**Q19. Biggest risks**
- Which parts of the event do you consider the most risky or the most likely to go wrong?
Your answer: _______________ *(ref U-56)*

---

## Part 3 — Numbers, venue and technical facts

**Q20. Exact numbers**
On record: about 600–720 students; 11 rooms (10 of about 30 students and 1 of about 300, which comes to about 600, not 720); at least 30 judges; 10 big screens; one team per school per category; categories go from U6 to U20.
- How many students, teams, schools and rooms exactly?
- Which categories are used?
Your answer: _______________ *(ref U-02)*

**Q21. Maximum number of devices**
The team is planning for about 800 devices connected at once.
- Is that the maximum for this version, or should the system be ready for more?
Your answer: _______________ *(ref U-60)*

**Q22. Tablets and browser**
Students use Quark Browser on learning tablets (学练机).
- Which tablet model and which Quark version?
- Can we get a test tablet before the event?
Your answer: _______________ *(ref U-06)*

**Q23. Venue network**
- Does the venue have internet?
- How strong is the Wi-Fi in the room with about 300 tablets, and how many devices can it handle at once?
- May we bring our own router or an on-site server?
Your answer: _______________ *(ref U-06, U-46)*

**Q24. Where the system runs**
- Where will the server run on the day: a school server on the venue network, a cloud server in China, or somewhere else?
- Who sets it up and runs it?
- Do you want an on-site fallback server?
Your answer: _______________ *(ref U-46)*

**Q25. Connections to other systems**
The system currently connects only to tablets, the judges' and controller's devices, and the big screens.
- Does it need to connect to anything else (for example SMS, email, a school student-ID system)?
Your answer: _______________ *(ref U-57)*

**Q26. Speed requirements**
- After a student submits, how quickly must the ranking update?
- How quickly must all tablets start a round together?
- Any other time requirement?
Your answer: _______________ *(ref U-58)*

**Q27. Student data**
The plan is to delete answers, scores and student accounts 15 days after the event, after the controller has exported what it needs.
- Are there legal or school rules for storing student data (names, answers, accounts)?
- Are archived scores (after a rematch) and the score-correction log also deleted after 15 days?
- Who must approve the deletion rule?
Your answer: _______________ *(ref U-59, U-62)*

**Q28. Export**
We plan to export scores, rankings and answers as Excel `.xlsx` files.
- Is that right? Is a specific layout or list of columns required?
Your answer: _______________ *(ref U-08)*

---

## Part 4 — Scope and language

**Q29. Creating puzzles**
Questions come from a predefined PDF, with no OCR.
- Should the app ever create, generate or edit puzzles, or is that out of scope for this version?
Your answer: _______________ *(ref U-45)*

**Q30. Languages**
The interface is English and Chinese.
- Is any other language needed?
- Is the language chosen per user, per event, or are both shown at the same time? Which is the default?
Your answer: _______________ *(ref U-51, U-68)*

---

## Part 5 — Design

**Q31. Look and brand**
- Should the interface be light or dark, minimal or rich, technical or friendly?
- Is there a school brand (colours, logo) that must be used?
Your answer: _______________ *(ref U-65)*

**Q32. Fonts and Chinese display**
- Are there requirements about fonts or how Chinese text must be displayed?
Your answer: _______________ *(ref U-70)*

**Q33. Screen layouts**
We know the answer screen (landscape, puzzle left, number pad right) and what the big screens show. The layouts of the judge screen, the controller screen, the login, waiting, preparation and results screens are not defined.
- Do you have preferences, examples or mock-ups for these screens?
Your answer: _______________ *(ref U-66)*

**Q34. Screen sizes and orientations**
The student answer screen is landscape, with a "please rotate your device" message when the tablet is upright.
- What screen sizes and orientations must the judges' and controller's devices and the big screens support?
Your answer: _______________ *(ref U-67)*

**Q35. Accessibility and error feedback**
- Are there requirements for button sizes, contrast or keyboard use?
- What should a student see if an automatic save fails?
Your answer: _______________ *(ref U-69)*

---

## Part 6 — Please re-confirm what we already have

These were proposed by the team and approved in your general answer, or come from the client's original document, or are our assumptions. Please tell us **Yes**, **No** or **Change**, so that we can treat them as confirmed.
*Note: a later document of 2026-09-26 states that the rules in rows R15 to R28 were confirmed by the stakeholder. The rows are kept until the project owner verifies that.*

| # | Statement | Yes / No / Change |
|---|---|---|
| R1 | One event can hold several categories at once, and one command starts all of them together. | |
| R2 | The participant Excel creates participants, teams and accounts, and generates each participant's number and credentials. | |
| R3 | A judge can restart one student's round. | |
| R4 | One active device per account: a new login takes over the old one. A student whose tablet fails can continue on another tablet with the same login, keeping saved answers and remaining time. | |
| R5 | The controller can correct scores with a mandatory reason, and a change log records it. Scores change no other way. | |
| R6 | A rematch archives the old scores. It does not delete them. | |
| R7 | Only numeric values (for example points and times) can be changed, only by the controller, and only before a round starts. Stages, rounds and rules stay fixed. | |
| R8 | 15 days after the competition, answers, scores and student accounts are permanently deleted. The setup, the questions and the judges are kept. | |
| R9 | The competition follows the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League, including the round times, question counts and points. | |
| R10 | Publishing an event generates the entry link/QR code and the big-screen link, and locks the event structure. | |
| R11 | The product digitalizes the running of a competition. It is not an online Sudoku game. | |
| R12 | The controller is the administrator (see Q14). | |
| R13 | The venue Wi-Fi in the room with about 300 tablets is the biggest real-world risk (see Q19). | |
| R14 | Later, not now: several organizing institutions on one platform (multi-tenant), a head-to-head "PK" stage, and a reusable question bank. | |
| R15 | (Q1) The controller defines the points of the puzzles before a round; no default split of the 100 points is imposed. The round total is the sum of the question points, calculated, not fixed at 100. For individual rounds the controller sees a warning before the round if the total is not 100 (not blocked). Team rounds have no fixed maximum and no warning. In a team rotation round the controller sets one "points per question" value for the whole round (default 10); a team's score is the number of correct answers times that value (4 correct answers give 40 with the default). | |
| R16 | (Q2) A student submits once for the whole round; free movement and editing across the 6 puzzles until then; after submitting all puzzles are read-only and final. The student confirms before the final submit, may submit with blank puzzles (score 0, the confirmation says how many are blank), and sees "accepted" and no immediate score. | |
| R17 | (Q3) Bonus: 3 points per whole minute early, changeable by the controller before a round, in both individual rounds, none in team rounds. Earned when the student submits before time ends with every puzzle of the round fully correct. Optional maximum bonus in points per individual round (empty = no cap). The bonus is part of the round score (which can exceed the round maximum) and is used in the individual ranking and the school total. Measured on the server round timer, which stops during a pause; fixed at the student's own manual submit; automatic submissions (time expiry, or the controller ending the round early) get no bonus. | |
| R18 | (Q4) The server clock decides. A manual submit reaching the server after the round timer has ended is not counted as manual; the latest autosaved answers are submitted automatically instead. No grace period. The student sees the same as any expired student, with no separate lateness message. Individual rounds only. | |
| R19 | (Q4b) Team rotation: the 60 seconds is the interval for moving questions to the next seat, not a deadline. A partly filled grid goes with the question. A submit for a question the tablet no longer holds is rejected. If a total round time is set, only answers already submitted and correct count when it ends. | |
| R20 | (Q4c) Students see their own score and rank after the results are published; right after a submit they see no score. | |
| R21 | (Q2) A judge's restart of one student is a one-person rematch: the earlier submission and score are archived, not deleted; a judge can restart a student only while the round is running; the restarted round starts with a blank grid and the remaining round time on the shared server timer (same deadline as everyone), and the bonus is measured on the round timer as for everyone else. If a restart would come too late, the remedy is the replay of the round. A judge may restart the same student as many times as needed while the round is running, with no separate limit and no controller approval; each restart archives the earlier attempt, so the number of restarts stays visible, and the remaining round time keeps getting shorter. A round has no automatic end when everyone has submitted; it runs until its timer ends or the controller ends it. Controller-entered values are whole numbers (a question's points are at least 1; the bonus rate may be 0; times and counts above 0); the school coefficient may have decimals (default 0.6). The school total is stored as an exact decimal, neither rounded nor truncated, and schools are ranked on the exact value. | |
| R22 | (Q5) The preparation countdown before each round lasts 60 seconds by default. The controller can change it for each round before that round starts. The preparation screen shows the round's rules and the countdown. The "3, 2, 1, Start" countdown after a pause is separate and does not use round time. When the countdown reaches zero the puzzles appear immediately and the round timer starts (no extra "3, 2, 1, Start"). A pause during preparation stops the countdown; on resume the "3, 2, 1, Start" shows first and then the countdown continues from where it stopped, not from the beginning. The controller cannot end the preparation early: the countdown always runs to zero, and a shorter wait is set with a shorter countdown length for that round. | |
| R23 | (Q5) Numeric values (points, bonus, times, counts, countdown length) can be changed only before that round's preparation begins. Once the preparation countdown has started, no numeric value of that round can be changed; a change applies to the next round. | |
| R24 | (Q5) The controller can change round 2's values at any time before round 2's preparation begins, including before the stage starts and while round 1 is running. The window closes the moment round 1 ends (by its timer, or because the controller ended it early), since round 2's preparation then begins automatically. | |
| R25 | (Q5) The round time, the preparation length, the bonus rate and its cap, and the other numeric values are set once per round for the whole event, not per category (20 minutes applies to both U8 and U12). Question points belong to the questions themselves and follow each category's question set. | |
| R26 | (Q5) The "total is not 100" warning is checked per category and per round (individual rounds only) and names the category and the round. The controller sees it on the setup screen, next to the points and updated as they are typed, and as a summary when starting the stage, listing every category and round whose total is not 100. It never blocks; the controller can start anyway. | |
| R27 | (Q6) The next stage does not start by itself. When a stage finishes, players see the "waiting for the next stage" state and the controller starts the next stage with the same start command, which starts all categories together. Rounds inside a stage follow each other automatically. After the last round of the last stage, the competition finishes by itself once that round's scoring is final; the controller does not need to press Finish at the normal end (the "finish" command exists for finishing early, ending the running round the same way). While waiting for the next stage, students see a waiting message with no score or rank, and the big screens keep the ranking cycle, now including the final ranking of the stage that just ended. | |
| R28 | (Q6) If the competition is finished early: unplayed rounds have no scores and add nothing; the school total is the individual part x 0.6 plus the team part actually played (0 if the team stage never started); the running round is scored on the students' latest saved state; the results and the export carry a visible "finished early" mark. It counts as a normal finished competition (the controller keeps access to the results and can export them). A finished competition cannot continue; for an interruption such as a fire alarm the controller uses pause and then resume. | |

---

## Part 7 — Approval

**Q36. Written approval**
Once the answers are in, we will send you a written summary of the requirements.
- Will you approve it in writing before development starts?
- Who signs, and by when?
Your answer: _______________ *(ref A14)*

---

## For the project owner (not the stakeholder)

Two facts are missing from the project records and only the project owner can supply them:
1. **Names and roles** of the two developers, the business/client lead and the project owner. *(ref I-17)*
2. **What the two developers know well**, and their experience with real-time applications, PostgreSQL and Redis. *(ref I-18)*

---

## Tracking

When answers come back, they are recorded in `_open-questions.md` (with the date and the exact wording), the matching items are marked ANSWERED, and `_interview-notes.md` is updated. Nothing is treated as decided until an answer is recorded.
