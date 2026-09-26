# Sudoku Arena — Project Overview (DRAFT v1, 2026-09-26)

> Status tags: [C] client-confirmed · [P] approved in blanket answer · [S] stated in client's document · [T] team/project-owner decision, not client-confirmed · [A] assumed · [O] open · [L] later. See `README.md`.

## Overview

**Sudoku Arena** (working name [T]) is a web application that runs a school Sudoku competition digitally, following the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League [S].
Many Sudoku competitions in China are still largely paper-based: printing and distributing materials, preparing rooms, collecting answer sheets, and correcting and ranking by hand. That brings human error and little real-time view of progress, and it gets worse as the number of participants grows [S].

The aim is to **digitalize the operational process of running a competition**. It is not an online Sudoku game [S].
The MVP serves **one organizing institution** (a school or university). It is not a multi-tenant platform [C]. Multi-tenant SaaS is the long-term vision and is deferred, not cancelled [L].

## Goals

These are recorded from the documents and are to be confirmed. Measurable goals and success criteria are OPEN (see below).

1. Digitalize the operational process of a live, in-person competition, from setup to final results, without paper [S].
2. Validation, scoring, results and ranking are automatic [C] (EX-001 to EX-004).
3. Give organizers a real-time view of progress [S].
4. Reduce the organizers' effort (the business goal recorded in the documents).

## Target users

Four ends [S]:

- **Players**: students, in person, on the school's learning tablets (学练机) with Quark Browser [C]. They solve puzzles in timed rounds; their work is saved automatically.
- **Controller (控制员)**: runs the event. Assumed to be the same as the administrator [A] (U-11). Several controller accounts are allowed [C] (BLD-004). Sets up the competition and controls it live.
- **Judges**: at least 30, each with a range of participant numbers [C]. They supervise their own students' status and can restart one student's round [P].
- **Big screens**: 10 of them, passive displays for rankings and close-ups [C].

**OPEN:** which end is the primary user is not documented (U-52). Names and roles of the two developers, the business lead and the project owner: **TBD — to be decided by the project owner** (I-17).

## Client and team

- **Client side:** one stakeholder answers the business questions. They gave the second-round answers, approved the team's proposals as a whole (the "blanket answer", which makes those items [P]), and set the working principle **"make customizable whatever can be customized, and operate the rest directly"** [C].
- **Project owner:** made the single-tenant decision [C] (ENV-007). Some answers were later given by the project owner in the stakeholder's role; those are [T] (see `competition-rules.md`).
- **Team:** two developers, about 15 days, a junior team, so the design must stay easy to understand [T]. Names, roles and skills: **TBD — to be decided by the project owner** (I-17, I-18). [[FILL-BEFORE-CODING: developer 1 = ________ ; developer 2 = ________ ; project owner = ________ ; business lead = ________ ; each developer's skills = ________ ; who builds what = ________ ; owner: project owner]]

## Business goal

Reduce the organizers' effort in running a competition (as recorded in the documents). A measurable business goal is OPEN.

## Core user flow

The event flow (not a list of build units).

**Setup (controller)**
1. Log in with username and password [T].
2. Create the competition: name, description, categories, participant Excel, question PDF [T]. One event can hold several categories at once [P].
3. Validate the participant Excel as a whole; an invalid file commits nothing [T]. The system then creates participants, teams and accounts and generates participant numbers and credentials [T]/[P]. The Excel columns are Name, School, Category, Team; the participant number is generated (schools in Excel order, then students in row order, unique across the event, a team's numbers consecutive); the username is the participant number and the password a short random code [C] (BLD-003). Extra columns: **OPEN (U-40)**; the sample files are still to be sent (U-01).
4. Export the credential slips, which are printed [C].
5. Import the question PDF: strict predefined format, no OCR; any failure rejects the whole import [T].
6. Judges (at least 30) each get a range of participant numbers [C]/[P]. The **controller assigns them during setup, before publishing, and can change them during the event** [C] (BLD-008).
7. Publish. The system refuses if anything is missing. Publishing generates the entry link/QR and the big-screen link, and locks the structure [T]/[S].

**Event day**
8. All big screens open from one shared link, no login [C]. Who opens it, and who hands out slips and tablets: **OPEN (U-54)**.
9. Each player opens the link/QR, logs in with the printed credentials, and waits in the competition room [T].
10. The controller starts a stage. One command starts all categories together [T]/[P].
11. Each round begins with a preparation screen (rules and countdown); then the round runs (see `competition-rules.md`) [T].
12. The player solves, with every move autosaved [C]; the server owns the time [T]. The player submits once for the whole round, or the latest saved state is submitted at expiry [T].
13. The system checks, scores and ranks. Big screens show rankings; the controller can project one student or a whole team [T]/[C].
14. Judges watch their students and can restart one student's round. The controller sees all progress and can pause, resume, end a round early, take over from a disconnected judge, and replay a round [C].
15. Rounds inside a stage follow each other automatically. The next stage waits for the controller to start it [T]. After the last round of the last stage the competition finishes by itself [T].
16. The team stage runs the same way, with the rotation round first [C].
17. Final rankings and the school total are produced; the competition becomes `FINISHED` [T]/[C].

**After the event**
18. The controller views the results, can correct scores with a reason, and exports scores, rankings and answers [P]/[C].
19. Fifteen days later, answers, scores and student accounts are permanently deleted. The setup, the questions and the judges are kept [P].

## Features (capabilities)

**Competition setup**
- Controller login
- Competition creation with several categories
- Participant Excel import with whole-file validation
- Participant, team and account creation with generated numbers and credentials; credential slip export
- Question PDF import in a strict format
- Judge accounts with participant ranges
- Publish with completeness check, entry link/QR, big-screen link, structure lock

**Live competition**
- Competition room, preparation screen with rules and countdown
- Answer screen with autosave, free movement between puzzles, single final submit
- Reconnection: the saved grid is restored and the timer keeps running; a student can continue on another tablet with the same login [T]/[P]
- Automatic scoring, early-finish bonus, ranking (individual, team, school)
- Controller commands: start a stage, pause, resume, end a round early, finish, reset or rematch, correct scores, control the big screens [C]
- Judge supervision and single-student restart
- Big screens: rotating ranking, one-student and team close-ups, paused and finished displays

**Results**
- Score correction with a mandatory reason and a change log [P]
- Export of scores, rankings and answers
- 15-day purge of answers, scores and student accounts [P]

**Cross-cutting**
- English and Chinese interface, planned in from the start [C]

## Scope

### In scope
Everything in the features above, for one organizing institution.

### Out of scope
- Multi-tenant SaaS and the Super Administrator role: deferred [C]/[L]
- PK stage and matching, and a reusable question bank [L]
- Buzzer mode: dropped [C]
- Configuration center and logic-template upload: rejected
- Payment
- Remote or home competitions, camera supervision, proctoring [S]
- Detailed analytics and comparison reports
- Generic configurable competition engines, and microservices
- A long-term results archive: none; deleted after 15 days, after the controller exports [P]/[C]

### Open scope questions (do not assume)
- Puzzle authoring or generation inside the app: **OPEN (U-45)**
- Any third language beyond English and Chinese: **OPEN (U-51)**
- The second team round ("齐心协力"): what it is and how it is scored: **OPEN (U-05, U-21)**
- Which features are essential on the event day: the first slice is the **Individual stage, end to end**; the team stage and the design come later [C] (BLD-009). The data model must stay ready for team rotation.

## Important decisions

- One organizing institution, single-tenant [C].
- The server owns time, state, validity, scoring, ranking and eligibility; the client is never trusted [T]. See `architecture.md`.
- PostgreSQL for durable data and Redis for runtime state; WebSocket for real-time; modular monolith [T].
- The decided competition and scoring rules are in `competition-rules.md`. Most were decided by the project owner in the stakeholder's role and are **[T], not client-confirmed**.

## Success criteria

**OPEN (I-22).** No per-unit acceptance rule exists. What is documented: an MVP acceptance scenario and a failure and edge-case test list [T], plus an extended scenario with the stakeholder's additions [A] (REQUIREMENTS §13; not yet copied here).
The edge cases include disconnect and reconnect, timer expiry, duplicate submission, pause and resume, many players at once, tie-breaks and invalid files. The stakeholder's additions still to add are rematch, takeover, corrections, several categories and the 15-day purge.

## Scale (documented)

About 600–720 students (the figures do not add up: 11 rooms, 10 of about 30 and one of about 300, is about 600; exact numbers OPEN, U-02), at least 30 judges, 10 big screens [C]; one team per school per category [C]; categories run from U6 to U20 [T]; a design and test target of about 800 clients is listed [C] but is also listed as an open point (I-05), so it is **not reconciled** (U-60). The client's original document aimed at 1000+ devices and 3000 concurrent users for the full platform [S]. See `architecture.md`, "Non-functional requirements".
