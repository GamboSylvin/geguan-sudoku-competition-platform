# Judge Requirements Proposal

**Project:** Sudoku Competition Platform\
**Status:** Proposal for discussion --- NOT final requirements\
**Audience:** Client, product stakeholders, and development team

## 1. Purpose

This document proposes how the **Judge** role could operate the Sudoku
competition platform. It is intentionally a proposal rather than a
finalized requirements specification.

The goal is to discuss: - what the Judge actually needs to do; - what
the system should automate; - which actions are exceptional
interventions; - which proposed features have genuine operational
value; - which points require client/developer clarification.

After discussion, accepted requirements should become
`JUDGE_REQUIREMENTS.md`.

## 2. Guiding Principle

> **The Judge is the operator and supervisor of a specific live
> competition, not the engine that calculates or manually manages every
> internal competition operation.**

The platform should automate deterministic operations whenever possible.

The Judge should: - control the competition when human intervention is
genuinely required; - supervise the live event; - intervene when
necessary; - control public presentation.

The system should: - execute normal competition progression; - validate
answers; - calculate scores, results, and rankings; - persist
competition state and results.

Features should not be added merely because they are technically
possible or visually impressive.

## 3. Proposed Judge Requirements

### J-001 --- Competition-Specific Judge Access

**Status:** Proposed / Open

A Judge should enter through a **competition-specific link**. The link
establishes the competition context, after which the Judge authenticates
and the system verifies that they are authorized for that particular
competition.

A Judge authorized for another competition must not automatically gain
access.

**Open questions:** Who assigns Judges? Can there be multiple Judges?
What authentication mechanism is used? What exactly does the link
establish?

### J-002 --- View Competition State

**Status:** Open

The Judge may need to see the current stage, round, timing, and
participant state.

This should remain a requirement only if it provides real operational
value.

**Key question:** What decision or action does the Judge make
differently because this information is visible?

### J-003 --- Start Stage / Competition

**Status:** Proposed

The Judge should be able to start the relevant stage.

The Judge starts the competition state; they are not conceptually
sending an individual start signal to every player.

### J-004 --- Automatic Round Progression

**Status:** Proposed

Once a stage starts, rounds should normally progress automatically:

``` text
Judge starts stage
→ Round waiting state
→ Countdown
→ Round starts automatically
→ Round ends
→ Next round waiting state
→ Countdown
→ Next round starts automatically
→ ...
```

### J-005 --- Manual Round Start

**Status:** Proposed / Open

The Judge should be able to manually start a round when exceptional
intervention is necessary. This is an exception path, not the normal
workflow.

### J-006 --- Pause

**Status:** Proposed

The Judge should be able to pause the competition when an operational
problem requires it.

**Open questions:** Does pause affect all participants? Does the timer
stop? Can the Judge resume? Does participant state remain unchanged?

### J-007 --- Premature End

**Status:** Proposed / Open

The Judge may need to end a round or stage before its configured end,
for example when all participants have submitted.

**Open questions:** What can be ended? What happens to unfinished
players? Does early ending auto-submit unfinished states? Can the action
be reversed?

### J-008 --- Real-Time Participant Monitoring

**Status:** Proposed

The Judge should be able to monitor useful participant state,
especially: - connected / disconnected; - submitted / not submitted; -
possibly elapsed time; - possibly progression/completion.

Connectivity has a clear operational purpose: a Judge can investigate a
device/network problem or contact the participant.

Do not expose metrics merely because the system can measure them.

### J-009 --- Real-Time Ranking

**Status:** Open / Under Discussion

The Judge may be able to view rankings during the competition, but this
should be retained only if there is a real operational reason.

The Judge does **not** calculate or manually modify rankings.

### J-010 --- Public Display Control

**Status:** Proposed / Client-derived

The Judge should control what competition information appears on the
public Big Screen.

Possible content: - leaderboard/ranking; - individual player board; -
team boards; - PK/head-to-head display; - stage/final results.

### J-011 --- Display Ranking / Leaderboard

**Status:** Proposed

The Judge should be able to make system-generated ranking information
visible on the Big Screen.

The exact moments for publication require confirmation.

### J-012 --- Display Individual Player Board

**Status:** Proposed / Client-derived

For an individual competition, the Judge should be able to select a
participant and display that participant's Sudoku board.

### J-013 --- Display Team Boards

**Status:** Proposed / Client-derived

For a team competition, the Judge should be able to select a team and
display the relevant team members' boards.

For example, a four-player team could be shown in four screen areas.

### J-014 --- Display PK / Head-to-Head Boards

**Status:** Proposed / Client-derived

For a PK/head-to-head competition, the Judge may select two competitors
and display their boards side by side.

### J-015 --- Multiple Roles Controlling the Big Screen

**Status:** Open

The client design indicates that Judge and Management may both control
the Big Screen.

Clarify: - whether both roles can control it; - priority when both
act; - whether "later operation wins" is required; - whether actions
should be auditable/reviewable.

### J-016 --- Automatic Answer Validation

**Status:** Proposed

The system should automatically determine whether submitted Sudoku
answers are correct using the configured puzzle solutions.

The Judge should not manually check every answer during normal
operation.

### J-017 --- Automatic Score Calculation

**Status:** Proposed

The system should calculate scores according to the competition rules,
including team scoring where applicable.

### J-018 --- Automatic Result Calculation

**Status:** Proposed

The system should calculate and save results from submissions,
correctness, timing, and configured scoring rules.

### J-019 --- Automatic Ranking Calculation

**Status:** Proposed

The system should calculate rankings according to configured competition
rules.

The Judge should never be responsible for manually determining rankings.

### J-020 --- Publish Results

**Status:** Open

The meaning of "publish results" must be clarified.

Current proposal: for the Judge, publishing primarily means making
system-generated results/rankings visible through the Big Screen.

The client may instead mean finalizing/locking results, officially
releasing them, exporting them, or another action.

### J-021 --- Result Confirmation

**Status:** Optional / Open

A human confirmation step should exist only if there is a concrete
operational need, such as resolving an exceptional case or confirming
official competition completion.

It should not mean manually checking every answer or recalculating
scores.

## 4. Team Competition --- Judge Boundary

### J-T-001 --- Automatic Puzzle Rotation

**Status:** Not a Judge responsibility

Normal puzzle rotation should be handled automatically by the system.

### J-T-002 --- Automatic Puzzle Assignment / Replenishment

**Status:** Not a Judge responsibility

Routine puzzle assignment/replenishment should be handled by the system.

### J-T-003 --- Team Scoring

**Status:** Not a Judge responsibility

Team scores should be calculated by the system.

### J-T-004 --- Team Progress Monitoring

**Status:** Open

The Judge may need team progress information, but only if it supports a
real operational decision.

## 5. Normal vs Exceptional Control

### Normal operation

``` text
Judge starts stage
→ System begins stage
→ Round waiting state
→ Countdown
→ Round starts automatically
→ Players compete
→ Early submission OR time expires and system auto-submits
→ Round ends
→ System advances to next round
→ ...
```

### Exceptional operation

``` text
Normal competition
→ operational problem / abnormal state
→ Judge intervention
→ pause / manual start / premature end / approved intervention
```

**Principle:** Automation is the normal path; Judge intervention is the
exception path.

## 6. Judge/System Responsibility Boundary

  Function                               Judge   System
  ------------------------------------ ------- --------
  Competition-specific access                ✓        ✓
  Judge authentication/authorization       ---        ✓
  Start stage                                ✓        ✓
  Normal round progression                 ---        ✓
  Exceptional manual round start             ✓        ✓
  Pause                                      ✓        ✓
  Premature end                              ✓        ✓
  Monitor participant connectivity           ✓        ✓
  Monitor submission/completion              ✓        ✓
  Validate Sudoku answers                  ---        ✓
  Calculate scores                         ---        ✓
  Calculate results                        ---        ✓
  Calculate rankings                       ---        ✓
  Control public display                     ✓        ✓
  Display individual board                   ✓        ✓
  Display team boards                        ✓        ✓
  Display PK boards                          ✓        ✓
  Routine team puzzle rotation             ---        ✓
  Routine puzzle assignment                ---        ✓
  Team score calculation                   ---        ✓

This is a proposal, not a final authorization matrix.

## 7. Client / Developer Discussion Questions

### Access

1.  Who assigns Judges to competitions?
2.  Can one competition have multiple Judges?
3.  How does Judge authentication work?
4.  What exactly does the competition-specific link establish?
5.  What happens when an unauthorized Judge attempts access?

### Competition control

6.  What exactly does "start" mean at stage level?
7.  Which levels can the Judge manually start?
8.  When is manual round start allowed?
9.  What does pause affect?
10. Can the Judge resume?
11. What exactly does "end" mean?
12. What happens to unfinished players when a round ends early?

### Monitoring

13. Which participant states are operationally useful?
14. Does the Judge need elapsed time?
15. Does the Judge need progress?
16. What should the Judge do when a participant disconnects?
17. Is team progress operationally different?

### Ranking/results

18. Why does the Judge need real-time ranking?
19. When should ranking be visible?
20. What exactly does "publish results" mean?
21. Does publishing finalize/lock results?
22. Is human result confirmation necessary?

### Big Screen

23. Which display modes are required?
24. Who can control the Big Screen: Judge, Management, or both?
25. If both, who has priority?
26. Should display actions be recorded?
27. Can the displayed target be changed at any time?

### Team competition

28. Which team operations are automatic?
29. Does the Judge ever need to intervene in puzzle rotation?
30. What team information is genuinely useful during live supervision?
31. What happens when the puzzle queue is exhausted?
32. What happens when some team members finish earlier?

## 8. Preliminary Requirement List

  --------------------------------------------------------------------------
  ID                      Requirement                Status
  ----------------------- -------------------------- -----------------------
  J-001                   Competition-specific Judge Open
                          access/authentication      

  J-002                   View competition state     Open

  J-003                   Start stage/competition    Proposed

  J-004                   Automatic round            Proposed
                          progression                

  J-005                   Manual round start         Proposed

  J-006                   Pause                      Proposed

  J-007                   Premature end              Open

  J-008                   Real-time participant      Proposed
                          monitoring                 

  J-009                   Real-time ranking          Open

  J-010                   Public display control     Proposed

  J-011                   Ranking/leaderboard        Proposed
                          display                    

  J-012                   Individual board display   Proposed

  J-013                   Team board display         Proposed

  J-014                   PK board display           Proposed

  J-015                   Multiple-role Big Screen   Open
                          control                    

  J-016                   Automatic answer           Proposed
                          validation                 

  J-017                   Automatic score            Proposed
                          calculation                

  J-018                   Automatic result           Proposed
                          calculation                

  J-019                   Automatic ranking          Proposed
                          calculation                

  J-020                   Publish results            Open

  J-021                   Result confirmation        Optional/Open

  J-T-001                 Automatic team puzzle      System responsibility
                          rotation                   

  J-T-002                 Automatic team puzzle      System responsibility
                          assignment/replenishment   

  J-T-003                 Automatic team scoring     System responsibility

  J-T-004                 Team progress monitoring   Open
  --------------------------------------------------------------------------

## 9. Next Step

This proposal should be discussed with the client and other developers.

After discussion:

``` text
Proposal
→ Client/developer discussion
→ Resolve open questions
→ Remove unnecessary features
→ Clarify accepted requirements
→ JUDGE_REQUIREMENTS.md
→ Domain/system analysis
→ Architecture analysis
→ Architecture decision
→ Technology analysis
→ Technology decisions
→ Detailed design
→ Implementation
```

Architecture and technology decisions should not be made before the
requirements are sufficiently stable.
