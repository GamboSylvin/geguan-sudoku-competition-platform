# UI Context (DRAFT v1, 2026-09-26)

> ~~**Partial draft, ships as the MVP's final look (UI-008, 2026-10-08).**~~ **REVISED 2026-10-15 (BLD-054): a visual design pass is happening after all, at the project owner's direct request** — see "Visual design system (adopted 2026-10-15)" below. `UI-008` is superseded, not deleted: it correctly describes what shipped *until* this reversal. Behaviour and content of the screens are unaffected — only colours, gradients, radii, shadows, spacing, typography and a handful of state-driven animations change, per `context/design/RAPPORT-CSS-sudoku_arena.md`'s own absolute constraint (styling only, nothing functional).
> Status tags: [C] client-confirmed · [S] client's document · [T] team/project-owner decision, not client-confirmed · [O] open. See `README.md`.

## Theme

~~**Default visual style, resolved 2026-10-01** [T] (U-65, **Working Position**): light theme, minimal (not rich), friendly-but-professional tone, blue primary color with neutral grays~~ **SUPERSEDED 2026-10-15 (BLD-054):** the project owner adopted a richer reference design (see below) over `U-65`'s plain blue/gray working position. **New primary: indigo, with purple as accent** (`indigo-600`/`hover:indigo-500` for primary actions, `purple-600`/`hover:purple-500` for the auth/login screen specifically) — still Tailwind defaults, no custom hex anywhere, consistent with this project's existing "no custom colours" practice. Still light/neutral-gray for the back-office screens; the big-screen and gameplay screens are now **deliberately dark** (see "Visual design system" below), which `U-65`'s "light theme" line never anticipated.
**School brand (colours, logo): none yet — a placeholder slot is kept for one.** This is not the same as deciding there is no brand; if the stakeholder supplies one later, or dislikes this default once shown, it changes then. Build with this working position in the meantime.

## Visual references

None recorded. A school brand slot is kept open (see "Theme" above). **2026-10-15: a concrete visual reference now exists** — see "Visual design system" below.

~~**No dedicated design pass before the MVP/event, project owner decision (UI-008, 2026-10-08):**~~ **REVERSED 2026-10-15 (BLD-054) — see the top of this file.** Every component must still use named tokens, never raw values; the tokens themselves are updated below to match the adopted reference.

## Visual design system (adopted 2026-10-15, BLD-054)

**Full recipe: `context/design/RAPPORT-CSS-sudoku_arena.md`** (reproduced verbatim from the source analysis — read it before touching any screen's classes). This section is the **mapping onto this project's actual screens** — the report itself doesn't know our screen names, so this is where that gets decided.

**The report's central rule: three "ambiances," chosen by screen role, never mixed on one screen.** Applying this project's screens to them (file paths under `frontend/src/features/`):

| Ambiance | What it looks like | This project's screens |
|---|---|---|
| **A — glass-on-gradient** (public, unauthenticated) | `min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800`, a `bg-white/10 backdrop-blur-lg rounded-2xl` card | `auth/LoginPage.tsx` (shared by every role — there is no separate register/join screen in this product) |
| **B — light, sober, white cards** (back-office / setup / monitoring) | `bg-gray-50` shell, `bg-gradient-to-r from-indigo-700 to-purple-700` header, `bg-white rounded-xl shadow p-4 sm:p-6` cards | `auth/RoleHomePage.tsx`, `competition/CompetitionSetupPage.tsx`, `controller/ControllerPickerPage.tsx`, `controller/ControllerLivePage.tsx`, `judge/JudgeManagementPage.tsx`, `judge/JudgeDashboardPage.tsx`, `judge/JudgeLandingPage.tsx`, `results/ResultsPage.tsx`, `ranking/SchoolRankingPage.tsx` (this is the *controller's own* reading of the school ranking, not the public big screen — stays light/B, not dark/C) |
| **C — dark, large, readable from the back of the room** (gameplay / public display) | `min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white`, `bg-white/5 border border-white/10 rounded-xl` cards | `big-screen/BigScreenPage.tsx`, `gameplay/ActiveRoundScreen.tsx`, `gameplay/PartitionRoundScreen.tsx`, `gameplay/RotationRoundScreen.tsx`, `player/PlayerPage.tsx` (the shell these three gameplay screens mount into) |

**This mapping is a starting recommendation, not a final ruling** — whoever builds this should sanity-check each screen against the report's section 4 descriptions before applying a treatment, per the report's own step 3 ("classify each screen… before changing anything" — translated from the French original), and should flag here if one doesn't fit cleanly (e.g. if `JudgeDashboardPage` or `SchoolRankingPage` end up wanting dark/C treatment on reflection — both were borderline calls).

**Tokens updated to match (supersede the plain Tailwind defaults below where they conflict):**
- **Primary/accent**: `indigo-600`/`purple-600` (replaces `U-65`'s bare `blue-600` — see "Colors" below).
- **Radii**: the existing three-step scale (`rounded`/`rounded-lg`/`rounded-xl`) stays but gains two more steps the report uses heavily: `rounded-full` (badges, avatars, medals) and `rounded-2xl` (the auth card only, ambiance A). See "Border Radius" below.
- **Shadows**: not previously tokenized at all in this file — add `shadow` (white dashboard cards), `shadow-lg` (headers, medals), `shadow-2xl` (the auth card), `shadow-xl` (modals).
- **Gradients**: three fixed recipes, never invented per-screen — see the report's section 3.2, reproduced in the mapping table above.
- **Animations**: five small, state-triggered keyframes (letter reveal, correct-flash, unlock-pulse, slide-in, rank-highlight) — see the report's section 2. **Only wire one to a state that already exists in this project's code; do not add a new state just to have something to animate.**
- **Typography scale**: the report's "mobile value is always the smaller of a doubled pair" convention (`text-xs sm:text-sm`, etc.) — this project's existing font-stack decision (U-70, CJK fallbacks) is unaffected, this only changes *sizes*, not the font family.

## Colors

~~**Default tokens, resolved 2026-10-01** [T] (U-65, Working Position, Tailwind CSS defaults — light theme, blue primary, neutral grays).~~ **SUPERSEDED 2026-10-15 (BLD-054)** — primary is now indigo/purple, and dark-screen tokens are added for ambiance C (see "Visual design system" above).

| Role | Variable name | Value |
|---|---|---|
| Page background (light screens) | `--color-bg` | Tailwind `white` / `gray-50` |
| Page background (dark screens — gameplay, big screen) | `--color-bg-dark` | Tailwind gradient `from-gray-900 via-slate-900 to-gray-800`, or flat `gray-900` |
| Surface (light) | `--color-surface` | Tailwind `white` |
| Surface (dark) | `--color-surface-dark` | Tailwind `white/5` with `border-white/10` |
| Primary text (light) | `--color-text` | Tailwind `gray-900` |
| Primary text (dark) | `--color-text-dark` | Tailwind `white` |
| Muted text | `--color-text-muted` | Tailwind `gray-500` (light) / `gray-400` (dark) |
| Primary accent | `--color-primary` | Tailwind `indigo-600` → `hover:indigo-500` |
| Secondary accent (auth screen only) | `--color-accent` | Tailwind `purple-600` → `hover:purple-500` |
| Border (light) | `--color-border` | Tailwind `gray-200` |
| Border (dark) | `--color-border-dark` | Tailwind `white/10` |
| Error | `--color-error` | Tailwind `red-600` |
| Success | `--color-success` | Tailwind `green-600` |
| Warning | `--color-warning` | Tailwind `yellow-500`/`amber-700`/`orange-600` (see the design report §3.1 for which context uses which) |
| Info | `--color-info` | Tailwind `blue-600` |

(Add levels and states as the UI needs them: background layers, text levels, hover and selected variants.)

## Typography

**Font stack, resolved 2026-10-01** [C] (U-70): not a bare `system-ui`. An explicit stack — generic sans-serif first (Latin/English), then CJK fallbacks in order: **PingFang SC** (macOS/iOS), **Hiragino Sans GB** (older macOS), **Microsoft YaHei** (Windows), **Noto Sans CJK SC** (Android/Linux), then `sans-serif`. All already installed on-device — **no custom web-font download**, which matters given the venue Wi-Fi risk (U-56). **I-20 resolved in full 2026-10-01** [T] (BLD-035): the UI component library and icon set are Headless UI + Heroicons — see "Component Library" below.

| Role | Font | Variable |
|---|---|---|
| UI text | `sans-serif, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` (generic sans-serif first for Latin/English, named CJK fallbacks in the given order, generic `sans-serif` as the final catch-all) | `--font-sans` |
| Code / mono | **Not applicable, resolved 2026-10-01.** Nothing in this product displays code or monospace content — the Sudoku grid renders numeric digits, not code text, and no developer-facing or log-style view is in scope (`project-overview.md`, "Out of scope"). No token needed. If a future admin/debug view ever needs one, default to the platform's native monospace stack (`ui-monospace, monospace`) rather than adding a web-font download, consistent with the UI-text row's no-download rule. | — |

## Border Radius / Rounding

~~**Resolved 2026-10-08** [T] (UI-008, closes `FILL-BEFORE-CODING.md` row B5)~~ **EXTENDED 2026-10-15 (BLD-054)** — the three-step scale below still holds, with two more steps added from the adopted reference.

| Context | Value |
|---|---|
| Compact buttons, badges, status pills | Tailwind `rounded` (0.25rem / 4px) |
| Normal buttons, cards, panels, inputs (back-office, ambiance B) | Tailwind `rounded-lg` (0.5rem / 8px) |
| Dashboard cards, giant-screen lists (ambiance B/C) | Tailwind `rounded-xl` (0.75rem / 12px) |
| Badges, medals, circular avatars | Tailwind `rounded-full` |
| The auth card only (ambiance A) | Tailwind `rounded-2xl` (1rem / 16px) |

## Spacing Scale

**Resolved 2026-10-08** [T] (UI-008, closes `FILL-BEFORE-CODING.md` row B5): same reasoning as Border Radius above — the candidate default proposed 2026-10-01, Tailwind CSS's own spacing scale (BLD-023, U-65 Working-Position pattern), is now the value actually used since no design pass will happen before the event. Still a working position; revisit after the event.

| Scale | Variable | Value |
|---|---|---|
| Extra small | `--space-xs` | Tailwind `2` (0.5rem / 8px) |
| Small | `--space-sm` | Tailwind `4` (1rem / 16px) |
| Medium | `--space-md` | Tailwind `6` (1.5rem / 24px) |
| Large | `--space-lg` | Tailwind `8` (2rem / 32px) |
| Extra large | `--space-xl` | Tailwind `12` (3rem / 48px) |

## Component Library

**Resolved 2026-10-01** [T] (BLD-035, resolves I-20): **Headless UI + Heroicons.** Both are built by the Tailwind team, so they integrate natively with Tailwind CSS (BLD-023) with no extra configuration or style conflict. Headless UI provides accessible, unstyled interactive components (confirmation dialogs, menus), leaving the visual style fully to Tailwind, consistent with UI-004. Chosen over heavier, opinionated libraries (Material UI, Ant Design) because both developers are junior (I-18) and a low learning curve matters more than feature breadth. The frontend is React with TypeScript [T]. **The styling approach is decided: Tailwind CSS** [T] (BLD-023, decided 2026-09-30) — utility-first classes; every component uses the named design tokens defined above (U-65, Working Position), never raw values scattered through the markup. **The frontend build tool is Vite** [T] (BLD-023). Chinese text rendering must work broadly, since there is **no fixed device or browser target** [C] (U-06, resolved 2026-09-30 — see `architecture.md`, "Devices and network"); **font and Chinese-display requirements, resolved 2026-10-01** [C] (U-70): an explicit font stack with on-device CJK fallbacks, no web-font download — see "Typography" above. **I-20 is now resolved in full**: styling approach (BLD-023), default visual style (U-65, Working Position), font stack (U-70, [C]), and component library/icon set (BLD-035) all decided.

> **Divergence from the built code, found 2026-10-11 — recorded, not silently "fixed".** Headless UI and Heroicons are the *decision*; neither is in the tree. `frontend/package.json`'s dependencies are only `react`, `react-dom`, `react-router-dom` and `socket.io-client` — no `@headlessui/react`, no `@heroicons/react` — and a grep for "headless" across `frontend/src` returns nothing. Tailwind CSS *is* installed and used (BLD-023 holds), so what shipped is: plain HTML elements with Tailwind classes, and confirmation dialogs/menus hand-rolled per screen rather than taken from Headless UI, with no icon components. That is consistent with UI-008's "no dedicated design pass before the MVP/event", but the two documents and the code disagree on whether BLD-035 was carried out. **Not changed unilaterally**: installing the packages and converting every built screen is an unreviewed rewrite of all 11 feature areas with the event about a day away, on a merged tree that is currently unverifiable (Docker Desktop is down — see `progress-tracker.md`, "Blocked"). It needs a project-owner call: ratify the current state as the MVP's look, or schedule the swap for after the event. The same note is recorded in `code-standards.md`, "Framework / library".

**Resolved, 2026-10-15 (BLD-054): ratified, not scheduled.** The visual design reference the project owner adopted (`context/design/RAPPORT-CSS-sudoku_arena.md`) itself uses **no** icon or component library — hand-rolled inline SVGs throughout, the same shape this project already accidentally has. Applying that reference is therefore consistent with staying off Headless UI/Heroicons, not a reason to install them now. `BLD-035`'s decision is left on the books as a historical record of what was *decided*, but the practice going forward matches what was actually built — no plan to add either package.

## Layout patterns

- **Answer screen [C] (UI-001):** landscape; the puzzle on the left, a number pad on the right; previous, next and question-number buttons; a delete button that clears the selected cell; a clear-all button that starts the puzzle over. Delete and clear-all ask for confirmation. Each question's point value is shown [S].
- Layouts of the judge, controller and big-screen views, and of the login, competition room, preparation, waiting and results screens: originally **deliberately left to the design phase, confirmed 2026-10-01** [C] (U-66) — **that design phase is now not happening before the MVP/event** [T] (UI-008, 2026-10-08). Each unit's own functional, minimally-styled layout (built directly from its spec's screen description) ships as the MVP's layout; no mockups or a separate layout pass are coming before the event. Still open to revisit afterward.

## Responsive rules

- The student answer screen is landscape; a "please rotate your device" screen appears when the tablet is held upright [C] (UI-001, PAR-006).
- **Screen sizes and orientations, resolved 2026-10-01** [C] (U-67): **fully responsive design, no fixed screen-size list** — consistent with `ARCH-027`/U-06 (no fixed device target). The **student answer screen stays landscape-only** (existing rule, UI-001/PAR-006). **Judge/controller screens impose no fixed orientation.** **Big screens are landscape by nature, no special rule needed.**

## Interaction patterns

- Autosave: every move is saved [C]. **Autosave failure feedback, resolved 2026-10-01** [C] (U-69): a discreet, non-blocking indicator (e.g. "reconnecting...") — not an alarming error — while the system retries in the background, consistent with the existing reconnection behavior.
- Before the final submit the student is asked to confirm; the confirmation states how many puzzles are blank [T]. After submitting, the student sees "accepted" and no immediate score [T].
- The pause notice for players is a blocking message [T]. On resume, a "3, 2, 1, Start" shows first [T].
- The controller's warning when a round's points do not add up to 100 (Individual rounds): shown on the setup screen next to the points, updated as typed, and as a summary when starting the stage; never blocking [T].
- **Touch target sizes, contrast and keyboard use, resolved 2026-10-01** [C] (U-69): no formal accessibility standard imposed (no WCAG requirement) — just reasonable practice for the age range (**grades 1–6, roughly ages 6–12** — the category scheme reversed 2026-10-07, BLD-041; narrower than the earlier "U6–U20" working position) and touch-first devices: touch targets/buttons sized for comfortable tapping (~44px minimum), high contrast, no keyboard dependency.

## Language

The interface is **English and Chinese**, not one or the other; the translation mechanism must be planned in from the start [C] (ARCH-026). Messages such as the pause notice are written in both languages [T]. **Language selection, resolved 2026-10-01** [C] (U-68): **per user**, not fixed per event and not shown simultaneously — matches the i18n scaffold already built in Unit 01. **Default language: Chinese.**
**No third language needed, resolved 2026-10-01** [C] (U-51): English and Chinese stay the only two locales.
**Bug found and fixed as a decision, 2026-10-15 (BLD-053):** none of this was actually reaching a user. The default locale was hardcoded to English (contradicting this section's own already-decided "default Chinese") and the only switcher code in the tree was never wired into any real screen. The switcher control itself (a small "EN · 中文" toggle) belongs in the shared app shell/header, reachable from every screen regardless of role — not duplicated per screen — and its choice persists across a reload.

## Pages / Screens

### Player
- **States [T]:** competition room; preparation room (the round's rules and a countdown); active round; read-only after submitting; waiting.
- Waiting for the next stage: a message that the stage is over and the next stage is coming, with no score or rank [T]. Students see their own score and rank **only when the whole competition reaches `FINISHED`** — not after each round, not after each stage [C] (BLD-029, resolves U-24, U-88). Whether the controller also gets a separate manual "publish" action at that moment is a minor residual detail, not addressed yet.

### Judge
- Content (not layout): the status of their own students, the stage, round and remaining time, and the live ranking. Also how many times a student left the answer page, as information only, with no penalty [P]. Can restart one student's round [P]. **No powers beyond that** [C] (U-55, resolved 2026-09-30): visibility is strictly limited to the judge's assigned range; no participant-editing access; cannot change a score. **Judge's view in the Team stage, resolved 2026-10-01** [C] (ROL-008, resolves U-39): same scope as the Individual stage, no expansion. The judge sees the status (connected, in progress) of their assigned teams, nothing more — no per-member detail (for example, which teammate currently holds a question during rotation).

### Controller
- Content (not layout): the command list (start a stage, pause, resume, end a round early, finish, reset or rematch, correct scores, control the big screens) [C]; all progress in real time; setup screens for the competition, points and numeric values; assigning judge ranges during setup (changeable during the event) [C] (BLD-008); the "total is not 100" warning per category and round on the setup screen and as a summary when starting the stage [C]; results and export.
- **Venue Wi-Fi advisory note, resolved 2026-09-30** [C] (U-56): when creating a competition, the controller sees an advisory reminder telling them to ask their network/IT team to properly configure the venue Wi-Fi before the event, to avoid connectivity problems (the venue Wi-Fi, in a room with about 300 tablets, is confirmed as the biggest real-world risk). **UI copy only** — no validation, no blocking behavior, not a functional requirement.
- **"Delete competition," decided 2026-10-15 (BLD-050), mandatory warning before the delete can even be attempted.** A destructive action control on the competition picker/setup screen (wherever the controller already sees Cancel/Copy), never a single-click action. Opening it shows a dialog that **names each category of data being permanently destroyed** — not a generic "are you sure?" — e.g. (exact wording is implementation detail, the *content* is not): the competition itself and its structure; every imported question; every judge's assignment to this competition (judges themselves are untouched); every school, team and participant; every student account, attempt, answer and result; every ranking, correction and audit entry — **and that none of this can be recovered afterward**. The delete button itself stays disabled until the controller **types the competition's own name** into a confirmation field, the same deliberate-friction pattern as any irreversible action in this product, stronger than the existing link-regeneration warning (BSC-003) because this one has no undo at all. Available from any competition status.
- **School management, decided 2026-10-15 (BLD-052):** a small panel on the competition setup screen (near `ParticipantPanel`, since schools only ever mattered in that context before now) listing the competition's schools with a rename action and a remove action (disabled/explained when the school still has participants or a team, rather than silently failing).

### Big screen
- A ranking cycle every 3 minutes, paginated when it does not fit [T]. It includes the final ranking of the stage that just ended while waiting for the next stage [T].
- A one-student close-up and a team view, which splits into 2 to 6 sections [T].
- "Competition Paused" and finished displays.
- The controller can show a category leaderboard, the school ranking or a close-up, with optional rotation between categories, and can switch display at any time [C] (BSC-002).
- Columns: individuals: rank, player name, score, completion time; teams: rank, team name, score, completion time; school ranking: rank, school, total (shown with its decimals [T]).
- After the competition the big screen becomes read-only [T].
- **Link regeneration, resolved 2026-10-01** [C] (BSC-003, resolves U-15): the controller can regenerate the shared big-screen link after publish, as a safeguard against a leaked link. A screen still open on the old link shows a clear "this link is no longer valid, ask the controller for the new one" message, rather than silently freezing with no explanation.

## Accessibility requirements

**Resolved 2026-10-01** [C] (U-69): no formal accessibility standard imposed (no WCAG requirement) — just reasonable practice for the age range (grades 1–6, roughly ages 6–12 — BLD-041, 2026-10-07) and touch-first devices. Touch targets/buttons sized for comfortable tapping (~44px minimum); high contrast; no keyboard dependency. See "Interaction patterns" above for the autosave-failure indicator.

## Icons

**Resolved 2026-10-01** [T] (BLD-035, resolves I-20): **Heroicons** — the icon set that pairs with Headless UI, also built by the Tailwind team. See "Component Library" above.
