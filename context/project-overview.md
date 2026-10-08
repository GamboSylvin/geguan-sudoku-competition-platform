# Sudoku Arena — Project Overview (DRAFT v1, 2026-09-26)

> Status tags: [C] client-confirmed · [P] approved in blanket answer · [S] stated in client's document · [T] team/project-owner decision, not client-confirmed · [A] assumed · [O] open · [L] later. See `README.md`.

## Overview

**Sudoku Arena** (working name [T]) is a web application that runs a school Sudoku competition digitally, following the regulations of the 4th Zhejiang Provincial Intelligence Sports Sudoku Inter-school League [C] (re-confirmed 2026-10-01, Part 6 R9).
Many Sudoku competitions in China are still largely paper-based: printing and distributing materials, preparing rooms, collecting answer sheets, and correcting and ranking by hand. That brings human error and little real-time view of progress, and it gets worse as the number of participants grows [S].

The aim is to **digitalize the operational process of running a competition**. It is not an online Sudoku game [C] (re-confirmed 2026-10-01, Part 6 R11).
The MVP serves **one organizing institution** (a school or university). It is not a multi-tenant platform [C]. Multi-tenant SaaS is the long-term vision and is deferred, not cancelled [L].

## Goals

These are recorded from the documents and are to be confirmed. Measurable goals and success criteria are OPEN (see below).

1. Digitalize the operational process of a live, in-person competition, from setup to final results, without paper [S].
2. Validation, scoring, results and ranking are automatic [C] (EX-001 to EX-004).
3. Give organizers a real-time view of progress [S].
4. Reduce the organizers' effort (the business goal recorded in the documents).

## Target users

Three user roles, plus a passive display target [S]:

- **Players**: students, in person, on the school's learning tablets (学练机) with Quark Browser [C] as the primary real-world device. They solve puzzles in timed rounds; their work is saved automatically. **No fixed device or browser target** [C] (U-06, resolved 2026-09-30): the app is built as a standard responsive web app, not locked to one tablet model or browser version — see `architecture.md`, "Devices and network".
- **Controller (控制员) — the primary user** [C] (U-52, resolved 2026-09-30): runs the event. **Confirmed 2026-10-01** [C] (U-11, Part 6 R12): **the controller is the administrator.** No role exists above the controller in this MVP version — the Super Administrator is a separate, later multi-tenant-phase role (SA-005), not part of this version. Several controller accounts are allowed [C] (BLD-004). Sets up the competition and controls it live.
- **Judges**: at least 30, each with a range of participant numbers [C]. They supervise their own students' status and can restart one student's round [P].
- **Big screens**: 10 of them, **not a user in the same sense as the other three roles** [C] (U-52). A passive architectural end (see `architecture.md`, "Hub-and-spoke"): it only receives server-pushed state and displays it — no person operates it as an actor. Treat it as a display target, not a fourth user persona.

**Primary user, resolved [C] (U-52, 2026-09-30):** the controller. The product is mainly built for the controller — the event organizer — per the documented business goal of reducing organizer effort (see "Business goal" below), and because the controller is the only role that touches setup, live control, score corrections and export. Names and roles are recorded (I-17, recorded 2026-09-27): see "Client and team".

## Client and team

- **Client side:** one stakeholder answers the business questions. They gave the second-round answers, approved the team's proposals as a whole (the "blanket answer", which makes those items [P]), and set the working principle **"make customizable whatever can be customized, and operate the rest directly"** [C].
- **Project owner:** the **Sudoku team** [T] (I-17, named 2026-09-27). Made the single-tenant decision [C] (ENV-007). Some answers were later given by the project owner in the stakeholder's role; those are [T] (see `competition-rules.md`).
- **Team:** two developers, about 15 days, a junior team, so the design must stay easy to understand [T]. **Sylvin** (developer 1) and **Louise** (developer 2) [T] (I-17, recorded 2026-09-27); the numbering is cosmetic. The team is called Alpha (informal). **Business lead:** Ma Laoshi.
- **Work split** [T] (I-23, recorded 2026-09-27): ownership is **by module, one owner per module**, so neither developer waits on the other's code. Roughly **70/30** — Sylvin's way on the backend, Louise's way on the frontend; a guide, not a strict rule (the frontend has 8 feature folders, so it lands near 60/40). **Backend** — Sylvin: Competition, Stage/Round, Orchestrator, Gameplay/Player State, Scoring, Big Screen, Judge/Corrections; Louise: Participant/Identity, Question, Ranking. **Frontend** — Louise: player, gameplay, judge, admin, ranking; Sylvin: auth, competition, big-screen. Cross-help is allowed where skills differ, and not knowing a skill does not exempt anyone from a task. **Contract first:** every module that must talk to another (frontend↔backend, API↔API, module↔module) has its contract agreed before either side starts, following dependency inversion. **The module list is now final** (I-01, resolved 2026-10-01, BLD-032 — ten modules including a new Results module; see `architecture.md`, "System boundaries"); this split's module names ("Judge/Corrections") are an informal grouping for ownership, not the canonical list — judge ranges sit in Participant/Identity, judge-takeover in Orchestrator, corrections in Results.
- **Developers' skills** [T] (I-18, recorded 2026-09-27): the team is junior. **Sylvin** — a little more React experience than Louise, a little Express, some PostgreSQL, a little Redis. **Louise** — a little Express and a little React, more PostgreSQL experience than Sylvin. **Real-time (WebSocket / Socket.io):** both have little experience; Socket.io is the tool they know best. Louise's Redis experience: not stated.

## Business goal

Reduce the organizers' effort in running a competition (as recorded in the documents). **First measurable target, confirmed 2026-10-07** [C] (BIZ-001, resolves U-96): **preparing a competition should take under 1 hour.** Direct stakeholder reply: "筹备比赛的时间可以做到 1 小时内完成." The exact scope of "setup" (the full configuration flow — participants, questions, judges, publish — or only part of it) is not yet broken down; narrow further if a more precise breakdown is needed later. Does not block any unit.

## Core user flow

The event flow (not a list of build units).

**Setup (controller)**
1. Log in with username and password [T].
2. Create the competition: name, description, categories, participant Excel, question Excel [T]. One event can hold several categories at once [C] (re-confirmed 2026-10-01, Part 6 R1).
3. Validate the participant Excel as a whole; an invalid file commits nothing [T]. The system then creates participants, teams and accounts and generates participant numbers and credentials [C] (re-confirmed 2026-10-01, Part 6 R2). The Excel columns read are Name, School, Category, plus `个人赛`/`团队赛` participation flags — **not an explicit Team column** [T] (PAR-011, resolves U-97, 2026-10-07): a school's team in a category is every participant from that school+category with `团队赛` set. The participant number is generated (schools in Excel order, then students in row order, unique across the event, a team's numbers consecutive) — **a pre-filled participant-number column in the real file is ignored** [T] (PAR-012, resolves U-98, 2026-10-07); the username is the participant number and the password a short random code [C] (BLD-003). **Extra columns, resolved as a Working Position 2026-10-01** [T] (PAR-008): ignored on import, no error; pending the stakeholder's confirmation.
4. Export the credential slips, which are printed [C].
5. Import the question Excel (**not PDF** [C], BLD-024, resolves U-93): structured fields read from cells — **including the given cells/solution, read from an added text column** [C] (BLD-047, resolves U-94, no OCR exception needed after all — BLD-024's no-OCR principle holds without exception); the team hand-transcribes text for the real sample files on hand until the real organizer supplies it that way for production; any failure rejects the whole import [T]. One file per category, not shared [C] (BLD-028). Points are customizable regardless of what the file carries [C] (BLD-025). **Categories: 3 age-pair groups — grades 1–2, 3–4, 5–6** [C] (BLD-041, resolves U-99, confirmed 2026-10-07, supersedes the earlier "U6 to U20" scheme, BLD-027). **Each file is a pool of questions (30–100), not a ready-made round** [T] (BLD-040, resolves U-100, 2026-10-07): a separate, manual controller step selects the 6 used by a given Individual round, before it starts; the Team rotation round is unaffected, since it already draws at random (SCR-015).
6. Judges (at least 30) each get a range of participant numbers [C]/[P]. The **controller assigns them during setup, before publishing, and can change them during the event** [C] (BLD-008).
7. Publish. The system refuses if anything is missing. Publishing generates the entry link/QR and the big-screen link, and locks the structure [C] (CMP-100, re-confirmed 2026-10-01, Part 6 R10).

**Event day**
8. All big screens open from one shared link, no login [C]. Who physically opens the link, and who hands out printed slips and tablets, is **out of scope for product design** [C] (U-54, resolved 2026-09-30): pure event-day staffing logistics, not a product decision. The system's behaviour does not depend on who performs these actions — the link works identically regardless of who opens it, and slips/tablets are distributed before login, entirely outside the app. No screen, role or permission accounts for it.
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
- Question Excel import, one file per category (not PDF)
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
- PK stage and matching, a reusable question bank, and puzzle authoring/generation/editing inside the app [C] (U-45, resolved 2026-10-01) [L]
- **No qualifiers list or qualification to a next round, confirmed** [T] (CMP-105, resolves U-26): no elimination mechanic exists anywhere in the confirmed structure — every stage and round is fixed and sequential, every participant plays all of them. A leftover from the client's early document, superseded by the full structure already decided.
- **No warm-up or practice round, confirmed** [T] (CMP-106, resolves U-29): the confirmed structure has exactly two Individual-stage rounds, never three.
- **Candidate-number (pencil) marks on the answer screen: not in this version, confirmed** [T] (CMP-104, resolves U-25): a nice-to-have addition, addable later with no architectural impact; not a priority ahead of correct competition execution.
- Buzzer mode: dropped [C]
- Configuration center and logic-template upload: rejected
- Payment
- Remote or home competitions, camera supervision, proctoring [S]
- Detailed analytics and comparison reports
- Generic configurable competition engines, and microservices
- A long-term results archive: none; deleted after 15 days, after the controller exports [P]/[C]

### Open scope questions (do not assume)
- **Puzzle authoring, generation or editing, resolved 2026-10-01** [C] (U-45): out of scope for this version, confirmed. The system only imports pre-made questions (Excel, per category). No puzzle-authoring or puzzle-editing feature is built — same later-phase category as the reusable Question Bank (see "Scope", "Out of scope" above).
- **Any third language beyond English and Chinese, resolved 2026-10-01** [C] (U-51): none needed. Language is chosen **per user** (not per event, not shown simultaneously), default **Chinese** — matches the i18n scaffold already built in Unit 01 (U-68, resolved the same day; see `ui-context.md`, "Language").
- The second team round ("齐心协力"): resolved 2026-09-29, partition collaboration, see "Core user flow" / `competition-rules.md` [C] (TEM-005). *(Stale cross-reference corrected — this line predated that answer.)*
- Which features are essential on the event day: the first slice is the **Individual stage, end to end**; the team stage and the design come later [C] (BLD-009). The data model must stay ready for team rotation.

## Important decisions

- One organizing institution, single-tenant [C].
- The server owns time, state, validity, scoring, ranking and eligibility; the client is never trusted [T]. See `architecture.md`.
- PostgreSQL for durable data and Redis for runtime state; WebSocket for real-time; modular monolith [T].
- The decided competition and scoring rules are in `competition-rules.md`. Most were decided by the project owner in the stakeholder's role and are **[T], not client-confirmed**.

## Success criteria

**Per-unit rule resolved** [T] (I-22, stale note corrected 2026-10-01 during a methodology completeness check): a unit is done when (1) its own acceptance criteria pass, (2) the project-wide failure and edge-case list relevant to it passes, (3) lint, type check, tests and build pass in CI (BLD-002), (4) the other developer has reviewed the pull request, (5) no invariant in `architecture.md` is violated, and (6) `progress-tracker.md` reflects the work — see `specs/00-build-plan.md`, "Definition of done (project-wide)". This note previously said "OPEN (I-22)"; it was simply never updated once the build plan resolved it.
The **MVP acceptance scenario** and the **failure and edge-case test list** [T] live in `context-feeders/requirements/REQUIREMENTS.md` §13 (deliberately not duplicated here — see the build plan's own note). The scenario's edge cases include disconnect and reconnect, timer expiry, duplicate submission, pause and resume, many players at once, tie-breaks and invalid files. **The extended scenario with the stakeholder's additions is still marked `[A]`, "to confirm," in `REQUIREMENTS.md`** — not yet formally approved as a whole, even though every individual item it lists (rematch/ROL-005, judge takeover/ROL-004, score corrections/RES-003, several categories, the 15-day purge/RES-004) has since been separately confirmed elsewhere in `context/`. Not blocking any unit.

## Scale (documented)

About 600–720 students (the figures do not add up: 11 rooms, 10 of about 30 and one of about 300, is about 600; exact numbers OPEN, U-02), at least 30 judges, 10 big screens [C]; one team per school per category [C]; **categories are 3 age-pair groups — grades 1–2, 3–4, 5–6** [C] (BLD-041, resolves U-99, confirmed 2026-10-07, supersedes the earlier "U6 to U20" working position, BLD-027); a design and test target of about 800 clients is listed [C] but is also listed as an open point (I-05), so it is **not reconciled** (U-60). The client's original document aimed at 1000+ devices and 3000 concurrent users for the full platform [S]. See `architecture.md`, "Non-functional requirements".
