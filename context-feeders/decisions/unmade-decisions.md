> **[CONTEXT FEEDER NOTE]** This file is part of the decision register. It FEEDS the `context/` folder; it is NOT what a coding agent builds from - build from `context/`. Look up decision IDs (U-xx, I-xx, SCR-xx and so on) here when a context file points to one. It is maintained under the documentation rules in the root `CLAUDE.md`.

# Sudoku Competition Platform — Unmade Decisions & Open Questions

**Document Status:** live list of open decisions (cleaned 2026-10-01)
**Purpose:** everything that is still open, assumed or waiting for an answer. It is the companion to [`project-decisions.md`](./project-decisions.md), which records what has been settled. Only open items are kept here; when one is answered it moves to `project-decisions.md` and leaves this file.
**History:** the earlier body of this file (sections 1–15, with every resolved row) is archived unchanged in [`../archive/unmade-decisions-history.md`](../archive/unmade-decisions-history.md).
**2026-10-01 cleanup:** every row marked "ANSWERED... pending builder review" was checked against `context/` before removal — its content had to be actually present there (not just claimed), under either its new decision ID or the original U-xx/I-xx ID it resolves. ~40 rows were removed this way (full list in `context/progress-tracker.md`'s Context change log). Rows kept below are either genuinely still open, or only *partly* answered with a real remaining gap (marked accordingly).
**Rule:** any question the project files cannot answer is recorded here with the next free ID and a source note. Nothing is guessed or decided in its place.

| Prefix | Meaning |
|---|---|
| **U-** | For the stakeholder, or a low-risk team assumption waiting for confirmation. |
| **I-** | Internal: for the team or the project owner, not for the stakeholder. |
| **SA-, ORG-, PK-, IND-** | Later-phase or detail questions kept from the older register (section 4). |

The stakeholder answered most questions on 2026-09-24 and approved the team's proposals as a whole; the confirmed results are in `project-decisions.md` §15. Each item below shows the default the team can build on and whether it blocks coding.

The "assumed default" column in section 1 holds earlier team proposals. They are **not decisions** and must never be used to answer a question; an item marked "None" has no proposal at all.

---

## 1. Needs the stakeholder

| ID | Open point | Assumed default until answered | Blocks coding? |
|---|---|---|---|
| U-01 | **Real sample files were not sent:** the question PDF (with points), the participant Excel, and a past results sheet. | Build the importers against an assumed format and keep them easy to change. | No — but obtain early; it affects only the import module |
| U-02 | **Exact numbers:** 10 rooms × ~30 + 1 room × ~300 is about 600, not the stated 720. How many students, teams (one per school per category), schools, categories and rooms exactly? Does one room mix categories? **Noted 2026-09-30 (Q20):** the project owner explicitly chose to keep the documented estimates as the working position rather than supply exact numbers now — confirms this stays non-blocking, not an oversight. **Resolved 2026-10-01 (Q41, see EVT-005):** the room/category sub-question has no design impact either way — the exact-numbers part of this row stays open. | Design for about 800 clients; rooms are just groups of participant numbers; a room may mix categories. | No — the design covers either answer |
| U-06 | **Devices and network:** exact model of the learning tablets, Quark version, a test unit, devices for judges/controller/screens, Wi-Fi capacity for 300 tablets in one room. **Noted 2026-09-30 (Q22, see ARCH-027):** the device/browser-version part no longer blocks anything — the app is built as a broadly cross-platform responsive web app, not tied to one tablet model or Quark version. Still open: whether a test tablet can be obtained before the event, and the Wi-Fi capacity question (carried to U-46/Q23). | Assume a modern Chromium-based Android browser; test on a real tablet early; load-test with about 800 simulated clients. | No — but the biggest real-world risk |
| U-22 | **PARTLY ANSWERED 2026-10-01, pending builder review and a stakeholder follow-up — see SCR-017.** Tie-break rule. The client document says: same score → rank by round 1 score; if both rounds are equal → shared rank. The team's plan recorded earliest submission time, then alphabetical name. The stakeholder never confirmed either. Stakeholder's direct reply (2026-10-01): earlier submission time wins, superseding the above. **Still being confirmed:** how "submission time" applies to an individual's two-round total and to a school's multi-player total — the team's proposed extension (combined/summed time) is sent back for confirmation. | The client document's rule (round 1, then shared rank); keep the submission time stored. | No |
| U-40 | **PARTLY ANSWERED 2026-10-01, pending builder review and a stakeholder follow-up — see PAR-008.** Participant file columns. The participant file needs Name, School, Category and Team (PAR-004). The client's flow document also listed age, city or province and other classification parameters. Are any of them needed, and what should the import do with extra columns? (old row OA-1) Stakeholder's reply (2026-10-01) read as: extra columns may exist; the system ignores them, no error. Being confirmed. | None. | Not yet assessed |
| U-46 | **Venue network, internet and hosting.** Is there internet access at the venue? How good is the Wi-Fi in each room (one room has about 300 tablets), and how many devices can it handle at once? May the team bring its own router or an on-site server? Who provides and runs the server on the day, and where must the data live (school premises, a cloud server in China, elsewhere)? Is an on-site fallback server wanted? Related: U-06 (devices and Wi-Fi capacity), I-03 (hosting and infrastructure). **Noted 2026-09-30 (Q23, Q24):** the project owner explicitly deferred the whole item — venue network/router (internet availability, Wi-Fi strength) and hosting/server-location (school server, cloud, on-site fallback) alike — to closer to the event date, once the real venue and date are known. Deliberately not blocking: the current build phase only needs the app reachable from any computer, phone or tablet for testing and demoing features (it already runs locally via Docker), not a decided production hosting target. **Closed 2026-10-01 (BLD-034) for the "who sets it up / on-site fallback" part (B4):** this is not a stakeholder question at all — the team decides it at deployment time via BLD-031 Phase 2. **Still genuinely open, for the stakeholder, closer to the event:** the actual venue-network facts (real internet access, real Wi-Fi strength in the ~300-tablet room). | No default yet; I-03 keeps the option of an on-site server on the venue network as a fallback, and the design target is about 800 clients (I-05, resolved). | Blocks the deployment choice, not the first build units |
| U-65 | **Look and feel, school brand.** The documents describe no visual style and mention no school brand, colors or logo. **Noted 2026-10-01 (Q31, see UI-004):** a default working-position style (light theme, minimal, friendly-professional, blue/gray palette, Tailwind CSS defaults, no school brand yet) is in active use for building, proposed by the project owner — stays open until the stakeholder sees it and either accepts it or asks for a change. | Light theme, minimal, friendly-professional, blue primary, neutral grays (Tailwind defaults). | No — design phase only, after the first slice (BLD-009) |
| U-66 | **Main screens and layouts.** The answer screen is described (UI-001); the judge, controller, big-screen, login, competition-room, preparation, waiting and results screens are not. **Noted 2026-10-01 (Q33):** the project owner confirmed this is deliberately left to the design phase (after the first slice, BLD-009) — not an oversight, not blocking now. | None yet. | No — design phase only (BLD-009) |
| U-94 | **The sample files hold no clean, complete solution as text — the puzzle's given cells exist only as a picture, conflicting with BLD-010 and the "no OCR" rule.** Checked directly: in one sample row, the embedded image's given cells are exactly the blank positions of the "正确答案" (correct answer) text field — image-givens plus text-answers cover the whole grid with no overlap, but neither field alone is the full solution. BLD-010 decided the answer check compares the submitted grid with "the solution stored with the question", assuming a full text solution exists. Building one from this sample would mean reading the given values out of the embedded picture, which conflicts with the no-OCR rule (REQUIREMENTS §7.2, ARCHITECTURE I-04). Does the real production format include a full text solution per question, or must givens be extracted from an image some other way? Team's interim plan while waiting for a clearer stakeholder answer: see BLD-026. Source: folder review, 2026-09-29. **Noted 2026-10-01 (Q37, re-asked):** the project owner confirmed there is no way to build an interactive, correctly-locked Sudoku grid using only what the sample files provide today (the given cells exist only as a picture, and OCR is ruled out) — this genuinely needs to go back to the stakeholder, to ask whether the real production files can include the given cells as structured text (not just the image). The interim plan (BLD-026, manual transcription for a small starter set) stays in use while waiting. | None. | Not yet assessed |
| U-96 | **A measurable business goal.** `project-overview.md`'s Business Goal section records only the qualitative version — "reduce the organizers' effort in running a competition" — and explicitly flags that a measurable metric was never defined (no target number: e.g. setup time cut from X to Y, or N participants processed with zero manual correction). **Found 2026-10-01** during a methodology completeness check: the `building-with-ai` template requires this section, and it was never actually asked. Only the stakeholder/project owner can meaningfully set a target here. | None — qualitative goal only, no number. | No — does not block any unit; the per-unit definition of done (I-22, `specs/00-build-plan.md`) already defines "done" without needing this metric |

## 2. Assumed by the team, low risk (confirm when convenient)

Nothing left — every item in this section (U-11 through U-38) is resolved as of 2026-10-01. See `project-decisions.md` and `context/progress-tracker.md`'s Context change log.

## 3. Internal (not for the stakeholder)

| ID | Open point |
|---|---|
| I-03 | Deployment and infrastructure, including whether to run an on-site server on the venue network as a fallback (ARCH-8/9). **Who sets it up is resolved (B4, BLD-034) — not a stakeholder question.** The venue facts the team still needs from the stakeholder are U-46. |
| I-04 | **Excel extraction approach** (ARCH-11; the format is now confirmed as `.xlsx`, not PDF, BLD-024). Reading the structured columns is straightforward; the unresolved part is the puzzle's given cells, which exist only as an embedded picture with no matching text — see U-94 for the underlying gap and BLD-026 for the team's interim plan. |

## 4. Still open in the older register (later phases and detail)

Not needed to start coding. The old architecture rows ARCH-2 and ARCH-8 to ARCH-11 are tracked as I-03 and I-04 (I-02 is now decided — BLD-012 language, BLD-020 folder structure), and ARCH-14 to ARCH-16 as I-01 (resolved).

| # | Question |
|---|---|
| SA-1 | What exactly can a Super Administrator do? *(Partially answered — MVP working scope in `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-2 | What are the Super Administrator's responsibilities and permissions at platform level? *(Partially answered — see `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-3 | Does the Super Administrator manage tenants (organizations), billing, platform configuration, or something else? *(Tenant overview/revocation: yes. Billing deferred — no payment system. Platform configuration: open.)* |
| SA-4 | Is there any tenant-level overlap between Super Admin and Organization Admin responsibilities? *(Still open — recorded in `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md` §7.)* |
| SA-5 | Should the Super Administrator be able to view competition results of a particular organization? *(Open.)* |
| SA-6 | Should the Super Administrator be able to access competition participants? *(Open — current lean: out of scope.)* |
| SA-7 | What exactly happens when a tenant is revoked/deleted? *(Open — deletion semantics.)* |
| SA-8 | Should Super Administrator access be read-only except for revocation, or can they edit tenant/competition info? *(Open.)* |
| SA-9 | What exactly counts as "basic information" for a tenant and for a competition? *(Open; from question 3 of `context-feeders/archive/SUPER_ADMIN_REQUIREMENTS.md`.)* |
| SA-10 | What analytics, if any, should the Super Administrator see? *(Open; question 4.)* |
| SA-11 | Can a revoked tenant be restored, and can the Super Administrator suspend or block one organization admin without deleting the tenant? *(Open; questions 6 and 7.)* |
| SA-12 | Should Super Administrator actions be auditable, and when a payment system exists, what billing management should the role have? *(Open; questions 10 and 11.)* |
| ORG-1 | Can an organization have multiple administrators in the future (beyond the MVP one-admin model)? |
| ORG-2 | Is there a future need for organization-level permissions or role hierarchies? |
| ORG-3 | Can the Organization Admin change organization information? |
| ORG-4 | What organization information is required in the MVP? |
| ORG-5 | Can an organization be deactivated? |
| ORG-6 | What happens to an organization's competitions and data after deactivation? |
| IND-3 | **Question types** for the Individual stage are to be defined. Which types exist, and how are they determined? |
| IND-4 | What **puzzle shapes** are supported (e.g., 9×9, 9×6)? How does shape relate to question type? |
| PK-1 | Is PK always random pairing? |
| PK-2 | Random among whom: all eligible participants, a category, a stage, or another scope? |
| PK-3 | Are there pairing eligibility constraints? |
| PK-4 | What happens with an odd number of eligible participants? |
| PK-5 | Can a participant appear in multiple PK rounds? |
| PK-6 | Can pairings be regenerated? |
| PK-7 | Who or what determines the final pairing? |
