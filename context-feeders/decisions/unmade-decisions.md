> **[CONTEXT FEEDER NOTE]** This file is part of the decision register. It FEEDS the `context/` folder; it is NOT what a coding agent builds from - build from `context/`. Look up decision IDs (U-xx, I-xx, SCR-xx and so on) here when a context file points to one. It is maintained under the documentation rules in the root `CLAUDE.md`.

# Sudoku Competition Platform — Unmade Decisions & Open Questions

**Document Status:** live list of open decisions (cleaned 2026-10-01)
**Purpose:** everything that is still open, assumed or waiting for an answer. It is the companion to [`project-decisions.md`](./project-decisions.md), which records what has been settled. Only open items are kept here; when one is answered it moves to `project-decisions.md` and leaves this file.
**History:** the earlier body of this file (sections 1–15, with every resolved row) is archived unchanged in [`../archive/unmade-decisions-history.md`](../archive/unmade-decisions-history.md).
**2026-10-07 cleanup, first pass:** U-22 (SCR-020), U-97 (PAR-011) and U-98 (PAR-012) were resolved by the project owner and verified written into `context/` before removal. **U-99 was removed as a duplicate, not as newly resolved** — at the time, it looked like it had already been answered by BLD-027 (2026-09-30: the folder grouping is just how that sample happened to be organized; the real scheme is U6–U20). U-100 was resolved the same day (BLD-040).
**2026-10-07 cleanup, second pass, same day:** **the BLD-027 answer cited above was itself reversed a few hours later, by BLD-041** — a direct stakeholder follow-up ("年龄组") confirmed the real scheme actually *is* the 3-group folder structure (grades 1–2, 3–4, 5–6), not U6–U20, once the real production question files repeated the same grouping U-99 had originally flagged. So U-99's underlying question was a genuine, valid catch after all — it was just answered one way first (BLD-027, superseded) and then the other (BLD-041, current). Also resolved this pass: **U-101** (question-audio column, BLD-042, ignored), **U-94** (BLD-043, OCR adopted as a temporary, project-owner-accepted exception — explicitly not the target state, revisit once text-based input is possible), **U-96** (BIZ-001, setup under 1 hour). **U-01 stays open**, the stakeholder confirmed (2026-10-07) there is currently no real participant data or past results sheet to send — no new default, keep building against the assumed format.
**2026-10-08 note:** U-65 and U-66 stay open (the stakeholder's actual visual/layout preference is still unconfirmed) but their timing is now fixed by **UI-008**: the project owner decided, given the ~2-day time budget left, that no dedicated design pass will happen before the MVP/event — the current functional, Tailwind-default screens ship as the MVP's look, revisited only after the event.
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
| U-01 | **Real sample files were not sent:** the question PDF (with points), the participant Excel, and a past results sheet. **Partly received 2026-10-07:** `context/samples/选手信息.xlsx` (the participant file's real column template — no data rows; its no-Team-column and pre-filled-number quirks are resolved, PAR-011/PAR-012) and 12 real question files across 3 grade-group folders (the pool-vs-round question resolved, BLD-040; the grade-group folders turned out to be the real category scheme after all, BLD-041; the given-cells-as-image problem resolved for now via a temporary OCR exception, BLD-043; the audio column resolved, ignored, BLD-042). **Confirmed still missing, 2026-10-07:** the stakeholder has no real participant data or a past results sheet to send right now. No new default — keep building importers against the assumed format, as already planned; revisit if real data arrives later. | Build the importers against an assumed format and keep them easy to change. | No — but obtain early; it affects only the import module |
| U-02 | **Exact numbers:** 10 rooms × ~30 + 1 room × ~300 is about 600, not the stated 720. How many students, teams (one per school per category), schools, categories and rooms exactly? Does one room mix categories? **Noted 2026-09-30 (Q20):** the project owner explicitly chose to keep the documented estimates as the working position rather than supply exact numbers now — confirms this stays non-blocking, not an oversight. **Resolved 2026-10-01 (Q41, see EVT-005):** the room/category sub-question has no design impact either way — the exact-numbers part of this row stays open. | Design for about 800 clients; rooms are just groups of participant numbers; a room may mix categories. | No — the design covers either answer |
| U-06 | **Devices and network:** exact model of the learning tablets, Quark version, a test unit, devices for judges/controller/screens, Wi-Fi capacity for 300 tablets in one room. **Noted 2026-09-30 (Q22, see ARCH-027):** the device/browser-version part no longer blocks anything — the app is built as a broadly cross-platform responsive web app, not tied to one tablet model or Quark version. Still open: whether a test tablet can be obtained before the event, and the Wi-Fi capacity question (carried to U-46/Q23). | Assume a modern Chromium-based Android browser; test on a real tablet early; load-test with about 800 simulated clients. | No — but the biggest real-world risk |
| U-40 | **PARTLY ANSWERED 2026-10-01, pending builder review and a stakeholder follow-up — see PAR-008.** Participant file columns. The participant file needs Name, School, Category and Team (PAR-004). The client's flow document also listed age, city or province and other classification parameters. Are any of them needed, and what should the import do with extra columns? (old row OA-1) Stakeholder's reply (2026-10-01) read as: extra columns may exist; the system ignores them, no error. Being confirmed. | None. | Not yet assessed |
| U-46 | **Venue network, internet and hosting.** Is there internet access at the venue? How good is the Wi-Fi in each room (one room has about 300 tablets), and how many devices can it handle at once? May the team bring its own router or an on-site server? Who provides and runs the server on the day, and where must the data live (school premises, a cloud server in China, elsewhere)? Is an on-site fallback server wanted? Related: U-06 (devices and Wi-Fi capacity), I-03 (hosting and infrastructure). **Noted 2026-09-30 (Q23, Q24):** the project owner explicitly deferred the whole item — venue network/router (internet availability, Wi-Fi strength) and hosting/server-location (school server, cloud, on-site fallback) alike — to closer to the event date, once the real venue and date are known. Deliberately not blocking: the current build phase only needs the app reachable from any computer, phone or tablet for testing and demoing features (it already runs locally via Docker), not a decided production hosting target. **Closed 2026-10-01 (BLD-034) for the "who sets it up / on-site fallback" part (B4):** this is not a stakeholder question at all — the team decides it at deployment time via BLD-031 Phase 2. **Still genuinely open, for the stakeholder, closer to the event:** the actual venue-network facts (real internet access, real Wi-Fi strength in the ~300-tablet room). | No default yet; I-03 keeps the option of an on-site server on the venue network as a fallback, and the design target is about 800 clients (I-05, resolved). | Blocks the deployment choice, not the first build units |
| U-65 | **Look and feel, school brand.** The documents describe no visual style and mention no school brand, colors or logo. **Noted 2026-10-01 (Q31, see UI-004):** a default working-position style (light theme, minimal, friendly-professional, blue/gray palette, Tailwind CSS defaults, no school brand yet) is in active use for building, proposed by the project owner — stays open until the stakeholder sees it and either accepts it or asks for a change. **Timing fixed 2026-10-08 (UI-008):** no dedicated design pass will happen before the MVP/event — the current Tailwind-default look ships as the MVP's visual baseline; the stakeholder's actual preference is still unconfirmed and stays open to revisit after the event. | Light theme, minimal, friendly-professional, blue primary, neutral grays (Tailwind defaults) — now shipping as-is for the MVP, not a placeholder awaiting a design pass. | No — ships as-is for the MVP (UI-008); revisit after the event |
| U-66 | **Main screens and layouts.** The answer screen is described (UI-001); the judge, controller, big-screen, login, competition-room, preparation, waiting and results screens are not. **Noted 2026-10-01 (Q33):** the project owner confirmed this is deliberately left to the design phase (after the first slice, BLD-009) — not an oversight, not blocking now. **Timing fixed 2026-10-08 (UI-008):** that design phase will not happen before the MVP/event — every screen built so far keeps its functional, minimally-styled layout as the MVP's final layout; still genuinely open for a real layout pass after the event. | None yet — functional layouts already built per unit stay as-is. | No — ships as-is for the MVP (UI-008); revisit after the event |
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
| LIB-1 | **Reusable cross-competition puzzle bank.** Raised by the project owner 2026-10-07: today, questions are imported fresh per competition and per category (`QuestionSet` belongs to one `Competition` + one `Category`, BLD-005/BLD-028) — nothing persists them beyond that competition for reuse. The idea: every puzzle ever imported is kept in a durable library, classified (category, difficulty, grid shape, etc.), so a controller setting up a *new* competition could pick existing puzzles from the library instead of re-importing a file every time. This depends on the single-tenant MVP boundary (ENV-007) — a true cross-competition (and eventually cross-organization) library is a multi-tenant concept, the same deferred territory as SA-*/ORG-* above. Not designed, not scoped, no entity proposed yet. |
