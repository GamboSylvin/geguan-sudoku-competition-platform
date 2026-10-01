> **[CONTEXT FEEDER NOTE]** Working file of the requirements process (interview record, open questions, question pack). It FEEDS the `context/` folder and contains superseded statements. Do NOT read it to decide what to build.

# Open Questions — to ask again before the context files are final

> Questions from the pre-build interview that were **not answered, or answered only with an assumption**.
> Purpose: bring these back to the stakeholders (and settle the team-only ones) so the context files
> are complete enough to code from. The README rule applies: a coding agent that meets an unanswered
> question will guess, so none of these may stay open once specs are written.
>
> The stakeholder-facing items are collected in `_stakeholder-question-pack.md` (46 questions plus a re-confirmation table).
> Answers received go back into this file first, and then into the draft context files (`project-overview.md`, `competition-rules.md`, `architecture.md`, `ui-context.md`, `progress-tracker.md`, ...), which are updated as answers arrive.
>
> Source: `_interview-notes.md`. IDs in brackets (U-03, I-06, ...) are references from the user's
> answers only; each question is written in plain words so this file stands on its own.
> **RULE (set by the user): assume nothing.** Ask until the answer is clear; if it stays unclear, it is kept here
> and revisited at the end. A "suggestion on record" is what someone wrote down, NOT an answer, and is not used.
> Status: OPEN = no clear answer yet · ANSWERED = clear answer recorded below.
>
> When a question is answered: write the answer and date in its "Answer" line, set status to ANSWERED,
> and update the matching section of `_interview-notes.md` and the final context files.
> A question is marked RESOLVED only when the answer is clear enough for a developer to build from it. Its status tag
> (stakeholder-confirmed, or team decision awaiting confirmation) is always recorded with it.

## Resolved items

Resolved points were moved out of this file on 2026-09-26. The decisions are in `competition-rules.md` (tagged [T], not client-confirmed); the client's confirmation of them is carried by rows R15 to R28 of `_stakeholder-question-pack.md`.
On 2026-09-30, Part 1's remaining five items (A1c, A4d, A5f, A6d, A10b) were answered directly by the client's stakeholder (marked ✅) or given as team working positions where the stakeholder's answer was unclear or missing (marked 🔶). ✅ items are tagged [C]; 🔶 items are tagged [T]. Their decisions are in `competition-rules.md`; client confirmation of the ✅ items is carried by rows R30 to R34 of `_stakeholder-question-pack.md`.

**2026-10-01, full cleanup pass.** Went through every item in this file (sections A to K) and checked, one by one, whether it was answered and whether the answer was correctly carried into `context/`. Items that were both answered and correctly reflected were deleted from this file (the content lives in `context/` now, no need to track it here too). Items answered but not yet reflected were fixed in `context/` first, then deleted here. Items still genuinely unanswered were kept, trimmed to the essentials. This removed roughly 30 entries, most of them resolved weeks ago (by the other track) and never cleared from this tracker. See `progress-tracker.md`'s Context change log for the full before/after list.

Last updated: 2026-10-01. All interview steps asked; readiness check passed (coding gate open, see `progress-tracker.md`).

---

## A. Still open — stakeholder

**A10b. Regulation numbers for the second team round (TEM-006 to TEM-008)** — OPEN, stakeholder
- The puzzle count (3), total time (30 min) and points per puzzle (20) are working positions, not read from any source. Replace with the 4th Zhejiang league regulation's actual numbers once available (pack ref R9). Not blocking — every value is fully customizable, so real numbers just get typed in later, no rebuild.
- Answer: _

---

## B. Still open — venue, hosting

**B4. Where the server runs on the event day (I-03, U-46)** — OPEN, stakeholder, deliberately deferred
- Who sets it up and runs it, and whether an on-site fallback server is wanted. Deliberately deferred to closer to the event date (see `architecture.md`, "Devices and network") — not blocking. The separate near-term demo-hosting plan (Railway, BLD-031) is already resolved and built against.
- Answer: _

---

## C. Still open — team / project owner (not the stakeholder)

**C5. Session length (I-16)** — OPEN, team/project owner
- How long should a login session last, and what happens on idle? Not decided anywhere in the documents.
- Answer: _

---

## D. Still open — stakeholder, technical and legal

**D6. Backup plan for the event day (U-61, tied to U-46)** — OPEN, stakeholder, deliberately deferred
- Is there a backup plan (on-site server, paper, or anything else) if the venue network fails? Deferred together with B4/U-46 (where the server runs) rather than answered twice.
- Answer: _

---

## E. Statements on record that are not confirmed

Superseded 2026-10-01: every item that used to be tracked here (team decisions, stakeholder [P]/[S] statements, assumptions, later-phase items, Step 5 invariants) has since been confirmed — most recently via Part 6 (R1 to R14) of the stakeholder pack, which re-confirmed the scoring/round rules, the roles, and the product scope line by line. See `competition-rules.md` and `project-overview.md` for the confirmed `[C]` versions.
**Still open from this section:** R15 to R29 of the pack — not new questions, but the project owner has not yet verified the 2026-09-26 document's claim that the stakeholder already confirmed them.

---

## F. Ask log

Which questions were re-asked, and the outcome. A question stays OPEN until a clear answer is recorded.

- **2026-09-25, group 1 (team):** asked C3 (names and roles), C1 (developers' skills), E1 (confirm the [T] team decisions), C2 (backend language and framework). **No answer given. All four remain OPEN.** To ask again at the end.
- **2026-09-25, group 2 (scoring and round rules):** asked A1 (round total), A2 (submission unit), A3 (early-finish bonus details), A4 (late submission). **Answered later, same day, with "don't know" where unknown.**
  - Still OPEN: A1 (round total), A2 (per round or per puzzle), A3 (value per minute, which rounds, cap), A4 (late submission).
  - New facts recorded, none of them resolving the four questions: see the "Known" and "Answered" lines under each.
  - Two new stakeholder items named by the user: cap of the early bonus (U-47) and the fairness rule for late submits (U-48).
  - To ask the stakeholder at the end.
- **2026-09-25, group 3 (event behaviour):** asked A5 to A10. **Answered, with "don't know" where unknown.**
  - Answered: next round inside a stage starts by itself [T] (part of A6); after a network or server failure the round is replayed, triggered by judge or controller [C] (part of A8).
  - Still OPEN at the time: A5 (countdown length), A6 (next stage), A7 (event-day features), A8 (exact continuation, tolerable interruption), A9 (question delivery risk), A10 (what 齐心协力 is and its scoring). A10 was later resolved 2026-09-29 (see above).
  - Two new stakeholder items named by the user: tolerable interruption length (U-49) and accepted early-viewing risk (U-50).
  - To ask the stakeholder at the end.
- **2026-09-25, corrections received from the user:** many earlier statements withdrawn (see "Corrections received" in `_interview-notes.md`).
  New OPEN items added: A15 third language (U-51), A16 primary user (U-52), A17 who assigns judges' ranges (U-53), A18 who opens the big-screen link and hands out slips and tablets (U-54),
  A19 judge powers beyond their own students (U-55), and file storage as internal item I-19 (C4).
  A3 now also asks which rounds and what "everything correct" means. IDs to verify: U-45 (authoring, earlier U-43) and U-47 (earlier cited for the cap).
- **2026-09-25, team questions re-asked (C1 to C5, E1):** answers received. **No team decision was given; every item stays OPEN.**
  - Names and roles (C3, I-17) and developers' skills (C1, I-18): not in the documents; the project owner or the developers must supply them.
  - Team decisions (E1): register statuses recorded (see E1); the team and the project owner must say what, if anything, stays open.
  - Backend language (C2, I-02), file storage (C4, I-19), session length (C5, I-16): not decided.
  - One active device per account: [P], not an explicit stakeholder decision.
  - Group 4 (venue) was on hold for these answers and is now being asked.
- **2026-09-26, group 4 (venue and facts):** asked B1 to B4. **Answered: none settled, all need the stakeholder.**
  - B1 numbers (U-02): still open; new facts recorded (teams rule [C], categories U6 to U20 [T], the 600 vs 720 mismatch).
  - B2 tablets and browser (U-06), B3 venue network (U-06, U-46), B4 hosting (U-46, I-03): still open.
  - To verify: the answer lists the 800-client target under [C] (EVT-001); earlier it was recorded as a suggestion. Which is it?
  - To ask the stakeholder at the end.
- **2026-09-26, group 5 (Step 4: technical complexity and non-functional requirements):** asked D1 to D6 in neutral wording. **Answered: none settled, all need the stakeholder.**
  - New stakeholder items: risks (U-56), external systems (U-57), performance targets (U-58), data protection (U-59), scale ceiling (U-60), failure tolerance and backup plan (U-61). Anti-cheating beyond the documented points: U-37.
  - New documented facts recorded: autosave about 2 per second [T], 3-minute ranking cycle [T], server-side authority [T], judge sees page-leave count [P], remote security and proctoring out of scope [S].
  - Still to reconcile: the 800-client target is listed as [C] (EVT-001) and the load target is listed as open (I-05).
  - To ask the stakeholder at the end.
- **2026-09-26, group 6 (Step 5: boundaries and rules):** asked system boundaries, invariants, access control, roles. **Answered with documented content; the module list is not final and the access rules are not written.**
  - Recorded in section H. New stakeholder items: archived scores and the correction log after 15 days (U-62), read/change rules per role (U-63, with U-55), one person in several roles (U-64), and more than one controller (U-11, conflicts with the older "exactly one admin" rule, OA-002).
  - Team items: the final module list (I-01), events vs direct calls (I-08).
  - To ask the stakeholder and the team at the end.
- **2026-09-26, group 7 (Step 6: design):** asked visual language, component library, main screens, responsive rules, bilingual UI, accessibility. **Answered with documented content; almost all of the visual design is open.**
  - Recorded in section I. New stakeholder items: visual language and school brand (U-65), Chinese/font requirements (U-70), screen layouts (U-66), screen sizes and orientations (U-67), language switching (U-68), accessibility and save-failure feedback (U-69).
  - New team item: component library, icons and fonts (I-20).
  - To ask the stakeholder and the team at the end.
- **2026-09-26, group 8 (Step 7 and workflow items):** asked buildable units, order, definition of done, who builds what, environment, git, CI, review, team sync. **Answered with documented content; nothing decided.**
  - Recorded in section J. New team items: units (I-21, with U-07 from the stakeholder), definition of done (I-22), who builds what (I-23), environment (I-24), git (I-25), CI (I-26), review (I-27), team sync (I-28).
  - I-14 and I-15 are named as needed before coding but were not described in the answer.
  - All interview steps have now been asked. Readiness check not passed.
  - To ask the team and the project owner at the end.

- **2026-09-26, Part 1 of the pack (Q1 to Q6) answered on the project side.** All resolved entries were removed from this log. The decisions are in `competition-rules.md` ([T], not client-confirmed) and their client confirmation is carried by pack rows R15 to R28. The open items that came out of them stay in the sections above (A1c, A4d, A5f, A6d).
- **2026-09-26, decisions file transferred (`decisions-for-the-context-builder.md`, removed after transfer).** It stated that Q1 to Q6 and the builder's blocking questions were **confirmed by the stakeholder** on 2026-09-26, which reverses their earlier [T] status; the context files now carry them as [C]. Verify with the project owner.
  - Resolved and removed from this file: essential features on the event day (first slice = Individual stage), the server-restart behaviour except its duration (U-49 stays), question delivery, judge ranges, file storage, live-state placement, roles (one role per account, several controllers), workflow and CI.
  - New open items (section K): sample files (U-01), extra Excel columns (U-40), unique solutions (U-90), judge and controller credentials (I-30), what I-14 and I-15 are, and the scope of the 15-day deletion (U-59, U-62). (K1 later resolved 2026-09-30: question file is Excel, not PDF.)
  - Left blank on purpose (TBD — to be decided by the project owner): backend language and framework, developers' skills, names and roles, who builds what, where the server runs on the event day.

---

## G. Who can answer what's still open

Working rule (set by the user): if an answer is unclear and the user can clarify it, ask a follow-up before moving on.
If the stakeholder or the venue must clarify it, log it here and return to it at the end. Assume nothing.

**Project owner / team (not the stakeholder):**
- B4/I-03: where the server runs on the event day — deliberately deferred, not blocking
- C5/I-16: session length and idle behaviour
- H1/I-01: the final module list (revised alongside the build plan, still not closed) · I-08: events vs direct calls between modules
- I2/I-20: UI component library and icon set (styling approach and fonts are already decided)
- J9/I-28: team meeting rhythm
- K4/I-30: format of judge and controller credentials

**Only the stakeholder can settle it:**
- A10b: regulation numbers for the second team round (TEM-006 to TEM-008, pack ref R9) — working positions already in use, not blocking
- D6/U-61: backup plan for the event day — deliberately deferred together with B4/U-46
- K3b/U-94: given cells as structured text — the 2026-10-01 reply didn't answer this; needs asking again, more precisely
- K6/U-62: whether the uploaded participant Excel follows the 15-day deletion (scores/correction-log and legal-rules parts are already resolved)
- R15 to R29 of the pack: not new questions — the project owner needs to verify the 2026-09-26 document's claim that the stakeholder already confirmed these

**Working Positions awaiting the stakeholder's confirmation (usable now, not blocking):**
- K2/U-40 (PAR-008): extra participant Excel columns are ignored on import
- K8/U-22 (SCR-017): tie-break = earliest submission time; the combined/sum extension for individuals and schools isn't yet confirmed

**Action items, not questions:**
- U-01: the sample participant Excel and a past results sheet still haven't been sent (the question-file samples did arrive, 2026-09-29) — once sent, place them in `context/samples/` (see `FILL-BEFORE-CODING.md`, item B1)

**Deliberately deferred, don't chase these now:**
- U-65: default visual style is a Working Position only, not yet shown to or confirmed by the stakeholder — revisit when the design phase starts (after the first slice, BLD-009)
- U-66: screen layouts — deferred to the same design phase

---

## H. Step 5: boundaries and rules

### H1. System boundaries — OPEN (I-01, I-08)
- **Still open, team:** the final module list (the documented list predates the stakeholder's answers — no module for team rotation, corrections, purge, import/export, copy, numbering, judge ranges/takeover, or several big screens; partially revised alongside the build plan, not fully closed). Whether modules talk through events or direct calls (I-08).
- Everything else in this area (backend language, folder structure, frontend structure) is decided — see `architecture.md`.

### H2. Invariants — RESOLVED 2026-10-01 via Part 6 (R1 to R8)
All the invariants listed here (server authority, one owner per state, score corrections with reason and log, rematch archives, numeric values customizable before a round, 15-day deletion, structure predefined) are now stakeholder-confirmed `[C]` — see `competition-rules.md` and `architecture.md`, "Invariants".

### H3. Access control — RESOLVED 2026-09-30 (U-63, U-55), U-39 resolved 2026-10-01 (ROL-008)
Recorded in `architecture.md` (Auth and access model), `ui-context.md` (Judge content), `data-model.md` ("Access rules").

---

## I. Step 6: design

### I2. Component library and icon set — OPEN (I-20, team)
The styling approach (Tailwind CSS) and the font stack are decided; no UI component library or icon set is documented yet. Team decision, not stakeholder.

---

## J. Step 7 and workflow items

### J9. Team meeting rhythm — OPEN (I-28, team)
Not documented anywhere. The plan says "integrate every day", which is not a meeting rule.

---

## K. Remaining items from the 2026-09-26 decisions

**K1. Sample files, physical placement** — OPEN (U-01), action item not a question
The question Excel format is resolved (BLD-012/BLD-024). The physical sample files (participant Excel + a past results sheet) still haven't been sent, and once they are, they need placing in `context/samples/` (see `FILL-BEFORE-CODING.md`, item B1).

**K2. Extra participant Excel columns (U-40)** — RESOLVED as a Working Position 2026-10-01, pack Q44
- **Answer** [T] (PAR-008): read as — the real file may carry columns beyond Name/School/Category/Team, but the system simply ignores them, no error. Being sent back to the stakeholder to confirm this reading is correct; not blocking in the meantime.

**K3b. The missing complete-solution column (U-94)** — STILL OPEN (2026-10-01 reply did not answer the question)
- The source files have no column for the complete solved grid, and the given (pre-filled) cells exist only as an embedded picture, not as text — OCR is ruled out, so there is no way today to build an interactive, correctly-locked grid from the files as they stand.
- **2026-10-01:** a reply came back but addresses display, not the source file — it doesn't answer the real question. **No new decision; U-94 remains open.** Interim plan unchanged [T] (BLD-026): hand-transcribe a small starter set; general automated import stays blocked.
- **Question to ask again, more precisely next time:** can the real production files include the given (pre-filled) cells as structured text — the same way the answer column already is — not just as an embedded image?
- Answer: _

**K4. Format of judge and controller credentials (I-30)** — OPEN, team
- Participants use the participant number and a short random password. What do judges and controllers use?
- Answer: _

**K6. Does the 15-day deletion cover the uploaded participant Excel? (U-62, narrowed)** — OPEN, stakeholder
- Archived scores and the correction log DO follow the 15-day deletion [C] (RES-005, resolved via pack Q27). Legal/school rules are also resolved — no special protection required [C] (RES-008, resolves U-59). Only the participant Excel question remains open here.
- Answer: _

**K8. Tie-break rule (U-22)** — RESOLVED as a Working Position 2026-10-01, pack Q42
- **Answer** [T]/[C] (SCR-017): core rule stakeholder-confirmed — earliest submission time wins, superseding the client document's "rank by round 1 score" rule. **Proposed extension, not yet confirmed:** for an individual, combined time of both rounds; for a school, sum of all that school's players' submission times in the category. Being sent back to the stakeholder to confirm the extension; not blocking in the meantime.

---

## Not yet asked

Nothing. All 7 interview steps and the workflow items from the README checklist have been asked. Step 8 (written requirements confirmation, A14) was asked and resolved 2026-10-01 (pack Q36): informal process, no formal signature. The skeleton checkpoint is done too (Unit 1 scaffold built 2026-09-30).

---

## Pack answer log (historical — do not edit)

Chronological record of answers received through the stakeholder pack, oldest first. Kept for audit; not a list of open items.

- **2026-10-01, five more answers received (Q39, Q27's data-protection part, Q42, Q44, Q37 re-attempt):** unique solutions confirmed [C] (BLD-010, U-90) — every puzzle has exactly one. Legal/school data rules resolved [C] (RES-008, U-59) — no special protection needed, participants provide data voluntarily, organizer assumes no legal liability, the 15-day plan stands as-is; who formally approves it wasn't asked separately but is treated as answered in substance (the stakeholder answering is the one who'd approve it). Tie-break rule resolved as a Working Position [T]/[C] (SCR-017, narrows U-22) — core rule (earliest submission time) confirmed, the combined/sum extension for individuals/schools not yet confirmed. Extra participant Excel columns resolved as a Working Position [T] (PAR-008, narrows U-40) — ignored on import, no error, pending confirmation. Q37's re-ask attempt did **not** get a real answer — the reply addressed display, not the source file; U-94 stays open, interim plan (BLD-026) unchanged. All matched the decisions register (BLD-010, RES-008, SCR-017, PAR-008). Recorded in `architecture.md`, `competition-rules.md`, `data-model.md`, `samples/README.md`, `specs/00-build-plan.md`, `FILL-BEFORE-CODING.md`.
- **2026-10-01, five Part 8 answers received (Q40, Q41, Q43, Q45, Q46):** judge in the team stage, same scope as Individual, no expansion [C] (ROL-008, U-39); room mixing categories, no design impact, "room" never modelled as an entity [C] (EVT-005, U-02); award tiers, none needed for any finish [C] (RES-007, U-27); changing a team after import, no special feature, just editing the Team field (PAR-003 already covers it) [C] (PAR-007, U-41); regenerating the big-screen link, yes, with a clear invalid-link message on the old one [C] (BSC-003, U-15). All five matched the decisions register exactly (ROL-008/EVT-005/RES-007/PAR-007/BSC-003, all "Confirmed 2026-10-01"). Recorded in `competition-rules.md`, `data-model.md`, `ui-context.md`, `architecture.md`. Still awaited: Q39, Q42, Q44, and the Q37 re-ask.
- **2026-09-29, answer to pack Q7 (the second team round) received:** resolved (A10). Which mode and the block split are a direct answer [C] (TEM-005, resolves TEM-003, U-91). Puzzle count, total time and points are working positions, not sourced [T] (TEM-006 to TEM-008); new item A10b tracks replacing them with the regulation's real numbers (pack ref R9). No follow-up questions were needed. Recorded in `competition-rules.md`, `architecture.md`, `progress-tracker.md` and the pack (Q7 replaced by a resolved summary and new Q7b).
- **2026-10-01, pack Q27 (student data) received:** archived scores and the correction log confirmed [C] (RES-005, resolves U-62's scores/log part) — also deleted after 15 days, same as other student data. **Legal/school data rules and who approves the deletion rule: explicitly left open** [O] (U-59) — the stakeholder classified these as genuine unknowns, not a team decision. A proposed daily-email reminder to the controller in the last 3 days before deletion was flagged as conflicting with ARCH-028 ("no external system integration... no email", Q25). Recorded in `competition-rules.md` §7/§8, `architecture.md` (Storage model), `data-model.md` (`PurgeSchedule`, `AuditLog`).
- **2026-10-01, Parts 3, 4 and 5 of the pack (Q20 to Q35) closed on the project side.** Re-verified every answer against `context/` (no stale OPEN tags found); genuinely-still-open narrowed items (U-02 room mixing, U-46 venue/hosting, U-59 legal rules, U-62 participant Excel, U-65 not stakeholder-confirmed, U-66 deferred to design) are correctly flagged, not dropped. The pack's sixteen question blocks were replaced with three closure summaries.
- **2026-10-01, pack Q38 (awards after an early finish) received:** resolved [C] (U-89, narrowed) — entirely a human, on-site decision by the organizers; the system's only job is to mark "finished early" and compute scores for the rounds actually played (already built, RND-007), no special award-tier computation. Narrows the earlier BLD-018/BLD-030 working position. **Does not resolve U-27** (whether the system computes award tiers at all for a normal finish) — stays open, separate. No follow-up questions were needed. Recorded in `competition-rules.md` (§3), `data-model.md` (`Competition.finishedEarly`), `FILL-BEFORE-CODING.md`, `specs/00-build-plan.md`.
- **2026-10-01, pack Q37 (missing solution column) re-examined — still open, not resolved.** Technical finding: no way to build an interactive, correctly-locked grid from the sample files as they stand — the given (pre-filled) cells exist only as an embedded picture, not text, and OCR is ruled out. Deeper than the originally-asked "missing solution column" alone. Carried back to the stakeholder with a refined question: can production files supply the given cells as structured text too? Interim plan unchanged (BLD-026): hand-transcribe a starter set; general automated import stays blocked. Recorded in `architecture.md`, `competition-rules.md`, `data-model.md`, `samples/README.md`, and K3b above.
- **2026-10-01, pack Q36 (written approval, Part 7) received:** informal process, no formal signature required [C] (A14) — approval happens as the project owner validates each answer along the way, consistent with the existing `FILL-BEFORE-CODING.md` section E row (already marked done). No follow-up questions were needed. Recorded in `FILL-BEFORE-CODING.md` (section E last row, and header note) and `progress-tracker.md` ("Minimum to start coding").
- **2026-10-01, pack Q35 (accessibility and error feedback) received:** no formal accessibility standard imposed, confirmed [C] (U-69) — no WCAG requirement, reasonable practice for the age range (U6–U20) and touch-first devices: ~44px touch targets, high contrast, no keyboard dependency. Autosave-failure feedback: a discreet, non-blocking "reconnecting..." indicator, not an alarming error, while the system retries in the background. No follow-up questions were needed. Recorded in `ui-context.md` (Interaction patterns, Accessibility requirements).
- **2026-10-01, pack Q34 (screen sizes and orientations) received:** fully responsive design, no fixed screen-size list, confirmed [C] (U-67) — consistent with ARCH-027/U-06. Student answer screen stays landscape-only (existing rule); judge/controller screens impose no fixed orientation; big screens are landscape by nature, no special rule needed. No follow-up questions were needed. Recorded in `ui-context.md` (Responsive rules).
- **2026-10-01, pack Q33 (layouts) received:** left to the design phase, deliberately not blocking now [C] (U-66) — no mockups or layout preferences given yet for the judge, controller, login, waiting, preparation or results screens; scheduled for after the first slice (BLD-009), same timing already set for the visual design generally. No follow-up questions were needed. Recorded in `ui-context.md` (Layout patterns) and `FILL-BEFORE-CODING.md`.
- **2026-10-01, pack Q32 (fonts and Chinese display) received:** font stack confirmed [C] (U-70) — not a bare `system-ui`; explicit stack with generic sans-serif first then named CJK fallbacks in order (PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC), then `sans-serif`. All on-device already, no web-font download — relevant given the venue Wi-Fi risk (U-56, Q19). No follow-up questions were needed. Recorded in `ui-context.md` (Typography, Component Library) and `architecture.md` (I-20 row).
- **2026-10-01, pack Q31 (look and brand) received:** default visual style set as a **Working Position, explicitly not yet a confirmed stakeholder preference** [T] (U-65): light theme, minimal, friendly-but-professional, blue primary with neutral grays (Tailwind CSS defaults). No school brand/colors/logo yet — a placeholder slot kept, not the same as deciding there is none. Revisable once shown to the stakeholder. No follow-up questions were needed. Recorded in `ui-context.md` (Theme, Visual references, Colors table filled with Tailwind-default tokens) and `architecture.md` (I-20 row).
- **2026-10-01, pack Q30 (third language) received:** no third language needed beyond English and Chinese [C] (U-51). Also resolves the bilingual-UI question (U-68, raised separately in section I but answered together here): language is chosen per user, not fixed per event and not shown simultaneously — matches the i18n scaffold already built in Unit 01; default language Chinese. No follow-up questions were needed. Recorded in `ui-context.md` (Language), `project-overview.md` (Open scope questions), `specs/01-foundation.md` (confirming the existing scaffold needs no change).
- **2026-10-01, pack Q29 (creating puzzles) received:** puzzle authoring/generation/editing confirmed out of scope [C] (U-45) — only pre-made questions are imported (Excel, per category); same later-phase category as the reusable Question Bank. No follow-up questions were needed. Recorded in `project-overview.md` ("Out of scope", "Open scope questions"). While here, also corrected a stale cross-reference in the same list: the second team round line still said "OPEN (U-05, U-21)" though it was resolved 2026-09-29 (TEM-005) — fixed.
- **2026-10-01, pack Q28 (export) received:** export format confirmed [C] (U-08) — Excel (.xlsx), with scores, ranks and the answer per question, as already planned. No specific layout or column list imposed; the exact columns stay an easy-to-adjust detail, not a system rule. No follow-up questions were needed. Recorded in `competition-rules.md` §7 and `data-model.md` (`StoredFile`, and removed from "Open points flagged in this model").
- **2026-10-01, the email-reminder flag withdrawn:** the project owner clarified the email-reminder idea was their own (not the stakeholder's) and withdrew it, parking it as a possible later-phase [L] addition. No conflict remains; ARCH-028 stands unchanged.
- **2026-10-01, pack Q26 (speed requirements) received:** ranking updates within 2 seconds of a submission; all tablets start a round together within 1 second of each other [C] (U-58). No other timing requirement identified. No follow-up questions were needed. Recorded in `architecture.md` (Non-functional requirements, Performance).
- **2026-09-30, pack Q25 (external systems) received:** no external system integration for this version, confirmed [C] (ARCH-028, resolves U-57) — the system connects only to its own four ends (tablets, judge/controller devices, big screens); no SMS, email or external student-ID system; credentials generated and printed internally. No follow-up questions were needed. Recorded in `architecture.md` ("External services").
- **2026-09-30, pack Q24 (where the system runs) received:** two-phase hosting proposal [T] (BLD-031, Working Position, separate from U-46) — Phase 1 (now, free): deploy to Railway for a shareable demo/test link, stays awake 24/7 unlike Render's free tier. Phase 2 (event day, paid, ~800+ clients): a dedicated VM (DigitalOcean/Hetzner), same `docker-compose.yml`, billed hourly. Phase 1 starts immediately; the final Phase 2 choice stays open until U-46 is answered — does not resolve U-46, a separate near-term need. No follow-up questions were needed. Recorded in `architecture.md` (Stack table — new Hosting (demo/testing) row, Open technical decisions).
- **2026-09-30, pack Q23 (venue network) received:** deferred to closer to the event date, deliberately non-blocking [C] (U-46) — not needed for the current build phase; the priority right now is that the system be reachable from any computer, phone or tablet for testing and demoing, not the real venue's network conditions. The router/on-site-server sub-question carried to Q24 (hosting). Does not hold up construction at all. No follow-up questions were needed. Recorded in `architecture.md` (Devices and network) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q22 (tablet model and browser) received:** no fixed device or browser target [C] (U-06) — the player-facing app must work broadly across platforms, built as a standard responsive web app using only widely-supported web APIs. Replaces the earlier "modern Chromium-based Android browser" working assumption. Testing on a real tablet before the event, if available, is still worthwhile, just no longer a blocking unknown. No follow-up questions were needed. Recorded in `architecture.md` (Devices and network, Risks, and removed from the open technical decisions table), `project-overview.md` (Target users), `ui-context.md` (Component Library, Responsive rules) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q21 (maximum number of devices) received:** 800 simultaneous clients confirmed as the ceiling for this version [C] (U-60) — not the client document's original 1000+ devices / 3000 concurrent users, which targeted the full multi-tenant platform vision, deferred to a later phase. The real known event scale (~600–720 students) fits comfortably under 800, so the existing load-test target stays as-is (~800 clients at ~2 grid saves/second). Also reconciles I-05's "listed both as [C] and as open" flag. No follow-up questions were needed. Recorded in `architecture.md` (Scalability, and removed from the open technical decisions table) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q20 (exact numbers) received:** exact numbers not provided; documented estimates kept as the working position deliberately, not a gap — the design already handles either answer (rooms are just groups of participant numbers, the system is built to ~800 clients regardless of the split). No design changes needed; real numbers can be supplied later with no rebuild. Narrows U-02 to just "whether a room mixes categories," which stays open. No follow-up questions were needed. Recorded in `competition-rules.md`, `data-model.md` and `progress-tracker.md` (Known Issues).
- **2026-09-30, pack Q19 (biggest risks) received:** the venue Wi-Fi (room with ~300 tablets) confirmed as the biggest real-world risk [C] (U-56). Does not change the system design — already designed and load-tested for ~800 clients. Only addition: an advisory reminder note to the controller when creating a competition, telling them to ask their network/IT team to configure the venue Wi-Fi properly. UI copy only, not a functional requirement. Also pre-confirmed pack row R13 (Part 6) directly, no separate round-trip needed there. No follow-up questions were needed. Recorded in `architecture.md` (Risks) and `ui-context.md` (Controller content, new advisory-note line).
- **2026-09-30, pack Q18 (failure tolerance and backup plan) received:** failure-tolerance part answered by pointing to the U-49/Q15 answer (no fixed limit, resume and replay always available, organizer decides on the day) — same decision, not a new one. Backup-plan part (on-site server, paper, etc.) deliberately deferred to Q24 (Part 3, U-46), which asks it in more depth alongside where the server runs on the day; will be answered once there, not twice. No follow-up questions were needed. Recorded in `architecture.md` (Reliability, split into a resolved failure-tolerance line and a still-open backup-plan line) and `FILL-BEFORE-CODING.md`.
- **2026-09-30, pack Q17 (anti-cheating) received:** confirmed as-is, nothing added [C] (SEC-001, resolves U-37) — server-owned time and answers, one active device per account, the judge's page-leave count (informational, no penalty) are enough; no camera, no remote proctoring, no additional lockdown, since the competition is in-person and physically supervised by 30+ judges in the room. No follow-up questions were needed. Recorded in `architecture.md` (Security and student data).
- **2026-09-30, pack Q15 (server stops during a round — tolerable interruption length) received:** no fixed limit [C] (U-49) — the stakeholder deliberately declined to set a time cap; the controller decides, on the day, whether to resume or replay based on the event's schedule at that moment, regardless of how long the interruption lasted. Hard constraint: both resume and replay must always stay available to the controller; the system must never impose a timeout that disables either path. No schema change. No follow-up questions were needed. Recorded in `architecture.md`, `competition-rules.md`, `data-model.md`.
- **2026-09-30, pack Q12 (what each role can see and change) received:** access rules resolved [C] (U-63, and the general part of U-55): player reads only own answers; judge strictly limited to assigned range, no powers beyond status viewing and single-student restart; only the controller edits participants during the event or corrects a score. `U-39` (judge view in the team stage) stays open. No follow-up questions were needed. Recorded in `architecture.md`, `ui-context.md`, `data-model.md` (new "Access rules" section).
- **2026-09-30, pack Q11 (big screens, slips and tablets on the day) received:** out of scope for product design — pure event-day staffing logistics, no screen, role or permission accounts for it [C] (U-54). No follow-up questions were needed. Recorded in `project-overview.md` (flow step 8).
- **2026-09-30, pack Q9 (primary user, Part 2) received:** the controller, per the business goal and the roles only it touches (setup, live control, corrections, export) [C] (U-52). The big screen clarified as a passive display target, not a fourth user persona. No follow-up questions were needed. Recorded in `project-overview.md`, `architecture.md`, `progress-tracker.md`.
- **2026-09-30, Part 1's remaining five items received (import format, points, solution column, categories, question files per category, score visibility, awards/reset for an early finish, second team round numbers):**
  - ✅ **Resolved, [C], stakeholder-confirmed:** question import format is Excel not PDF (A1c, BLD-012, U-93); points stay fully customizable everywhere (BLD-013, U-92); categories are U6 to U20, the original scheme (BLD-015, U-95); one question file per category, not shared (A5f, BLD-016, U-32); students see scores only when the competition reaches `FINISHED` (A4d, BLD-017, U-24, U-88); reset after finishing is never allowed, already documented, not actually open (part of A6d).
  - 🔶 **Working position, [T], not confirmed — re-asking:** the missing complete-solution column, stakeholder's reply too short (K3b, BLD-014, U-94); awards after an early finish, stakeholder didn't understand the question, re-asked with a scenario (A6e, BLD-018, U-89 narrowed, U-27).
  - **Unchanged working position, no reply, now in active use for building:** the second team round's puzzle count, time and points (A10b, TEM-006 to TEM-008).
  - Recorded across `competition-rules.md`, `architecture.md`, `data-model.md`, `project-overview.md`, `ui-context.md`, `code-standards.md`, `README.md`, `samples/README.md`, `specs/00-build-plan.md`, `progress-tracker.md`, `FILL-BEFORE-CODING.md`.
- **2026-09-29, Q7 (the second team round) recorded across `competition-rules.md`, `architecture.md`.**
