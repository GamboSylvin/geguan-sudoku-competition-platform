# UI Context (DRAFT v1, 2026-09-26)

> **Partial draft.** Behaviour and content of the screens are documented; the visual design is not. Do not invent colours, layouts, fonts or component choices.
> Status tags: [C] client-confirmed · [S] client's document · [T] team/project-owner decision, not client-confirmed · [O] open. See `README.md`.

## Theme

**Default visual style, resolved 2026-10-01** [T] (U-65, **Working Position — not yet a confirmed stakeholder preference**): light theme, minimal (not rich), friendly-but-professional tone, blue primary color with neutral grays (matches Tailwind CSS defaults, already the decided styling tool, BLD-023).
**School brand (colours, logo): none yet — a placeholder slot is kept for one.** This is not the same as deciding there is no brand; if the stakeholder supplies one later, or dislikes this default once shown, it changes then. Build with this working position in the meantime.

## Visual references

None recorded. A school brand slot is kept open (see "Theme" above).

The design comes **after the first slice** (the Individual stage, end to end) [C] (BLD-009). A default visual style is now a working position (U-65, above); the token tables below fill in that default, not a stakeholder-confirmed final design. When defined, every component must use named tokens, never raw values.

## Colors

**Default tokens, resolved 2026-10-01** [T] (U-65, Working Position, Tailwind CSS defaults — light theme, blue primary, neutral grays). Subject to change once shown to the stakeholder.

| Role | Variable name | Value |
|---|---|---|
| Page background | `--color-bg` | Tailwind `white` / `gray-50` |
| Surface | `--color-surface` | Tailwind `white` |
| Primary text | `--color-text` | Tailwind `gray-900` |
| Muted text | `--color-text-muted` | Tailwind `gray-500` |
| Primary accent | `--color-primary` | Tailwind `blue-600` |
| Border | `--color-border` | Tailwind `gray-200` |
| Error | `--color-error` | Tailwind `red-600` |
| Success | `--color-success` | Tailwind `green-600` |

(Add levels and states as the UI needs them: background layers, text levels, hover and selected variants, warning and info.)

## Typography

**Font stack, resolved 2026-10-01** [C] (U-70): not a bare `system-ui`. An explicit stack — generic sans-serif first (Latin/English), then CJK fallbacks in order: **PingFang SC** (macOS/iOS), **Hiragino Sans GB** (older macOS), **Microsoft YaHei** (Windows), **Noto Sans CJK SC** (Android/Linux), then `sans-serif`. All already installed on-device — **no custom web-font download**, which matters given the venue Wi-Fi risk (U-56). **Still OPEN (I-20):** the UI component library and icon set.

| Role | Font | Variable |
|---|---|---|
| UI text | `sans-serif, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` (generic sans-serif first for Latin/English, named CJK fallbacks in the given order, generic `sans-serif` as the final catch-all) | `--font-sans` |
| Code / mono | ________ | ________ |

## Border Radius / Rounding

**OPEN.**

| Context | Value |
|---|---|
| Inline / small UI | ________ |
| Cards / panels | ________ |
| Modals / overlays | ________ |

## Spacing Scale

**OPEN.**

| Scale | Variable | Value |
|---|---|---|
| Extra small | ________ | ________ |
| Small | ________ | ________ |
| Medium | ________ | ________ |
| Large | ________ | ________ |
| Extra large | ________ | ________ |

## Component Library

**OPEN (I-20).** [[FILL-BEFORE-UNIT: first UI unit — UI component library = ________ ; icon set = ________ ; fonts (including Chinese) = ________ ; owner: the person completing the context]] The frontend is React with TypeScript [T]. **The styling approach is decided: Tailwind CSS** [T] (BLD-023, decided 2026-09-30) — utility-first classes; every component uses the named design tokens defined above (U-65, Working Position), never raw values scattered through the markup. **The frontend build tool is Vite** [T] (BLD-023). No UI component library or icon set is documented yet (team decision). Chinese text rendering must work broadly, since there is **no fixed device or browser target** [C] (U-06, resolved 2026-09-30 — see `architecture.md`, "Devices and network"); **font and Chinese-display requirements, resolved 2026-10-01** [C] (U-70): an explicit font stack with on-device CJK fallbacks, no web-font download — see "Typography" above.

## Layout patterns

- **Answer screen [C] (UI-001):** landscape; the puzzle on the left, a number pad on the right; previous, next and question-number buttons; a delete button that clears the selected cell; a clear-all button that starts the puzzle over. Delete and clear-all ask for confirmation. Each question's point value is shown [S].
- Layouts of the judge, controller and big-screen views, and of the login, competition room, preparation, waiting and results screens: **deliberately left to the design phase, confirmed 2026-10-01** [C] (U-66) — not blocking now. No mockups or layout preferences given yet; scheduled for after the first slice, same timing already set for the visual design generally [C] (BLD-009).

## Responsive rules

- The student answer screen is landscape; a "please rotate your device" screen appears when the tablet is held upright [C] (UI-001, PAR-006).
- **Screen sizes and orientations, resolved 2026-10-01** [C] (U-67): **fully responsive design, no fixed screen-size list** — consistent with `ARCH-027`/U-06 (no fixed device target). The **student answer screen stays landscape-only** (existing rule, UI-001/PAR-006). **Judge/controller screens impose no fixed orientation.** **Big screens are landscape by nature, no special rule needed.**

## Interaction patterns

- Autosave: every move is saved [C]. **Autosave failure feedback, resolved 2026-10-01** [C] (U-69): a discreet, non-blocking indicator (e.g. "reconnecting...") — not an alarming error — while the system retries in the background, consistent with the existing reconnection behavior.
- Before the final submit the student is asked to confirm; the confirmation states how many puzzles are blank [T]. After submitting, the student sees "accepted" and no immediate score [T].
- The pause notice for players is a blocking message [T]. On resume, a "3, 2, 1, Start" shows first [T].
- The controller's warning when a round's points do not add up to 100 (Individual rounds): shown on the setup screen next to the points, updated as typed, and as a summary when starting the stage; never blocking [T].
- **Touch target sizes, contrast and keyboard use, resolved 2026-10-01** [C] (U-69): no formal accessibility standard imposed (no WCAG requirement) — just reasonable practice for the age range (U6–U20) and touch-first devices: touch targets/buttons sized for comfortable tapping (~44px minimum), high contrast, no keyboard dependency.

## Language

The interface is **English and Chinese**, not one or the other; the translation mechanism must be planned in from the start [C] (ARCH-026). Messages such as the pause notice are written in both languages [T]. **Language selection, resolved 2026-10-01** [C] (U-68): **per user**, not fixed per event and not shown simultaneously — matches the i18n scaffold already built in Unit 01. **Default language: Chinese.**
**No third language needed, resolved 2026-10-01** [C] (U-51): English and Chinese stay the only two locales.

## Pages / Screens

### Player
- **States [T]:** competition room; preparation room (the round's rules and a countdown); active round; read-only after submitting; waiting.
- Waiting for the next stage: a message that the stage is over and the next stage is coming, with no score or rank [T]. Students see their own score and rank **only when the whole competition reaches `FINISHED`** — not after each round, not after each stage [C] (BLD-029, resolves U-24, U-88). Whether the controller also gets a separate manual "publish" action at that moment is a minor residual detail, not addressed yet.

### Judge
- Content (not layout): the status of their own students, the stage, round and remaining time, and the live ranking. Also how many times a student left the answer page, as information only, with no penalty [P]. Can restart one student's round [P]. **No powers beyond that** [C] (U-55, resolved 2026-09-30): visibility is strictly limited to the judge's assigned range; no participant-editing access; cannot change a score. **Judge's view in the Team stage, resolved 2026-10-01** [C] (ROL-008, resolves U-39): same scope as the Individual stage, no expansion. The judge sees the status (connected, in progress) of their assigned teams, nothing more — no per-member detail (for example, which teammate currently holds a question during rotation).

### Controller
- Content (not layout): the command list (start a stage, pause, resume, end a round early, finish, reset or rematch, correct scores, control the big screens) [C]; all progress in real time; setup screens for the competition, points and numeric values; assigning judge ranges during setup (changeable during the event) [C] (BLD-008); the "total is not 100" warning per category and round on the setup screen and as a summary when starting the stage [C]; results and export.
- **Venue Wi-Fi advisory note, resolved 2026-09-30** [C] (U-56): when creating a competition, the controller sees an advisory reminder telling them to ask their network/IT team to properly configure the venue Wi-Fi before the event, to avoid connectivity problems (the venue Wi-Fi, in a room with about 300 tablets, is confirmed as the biggest real-world risk). **UI copy only** — no validation, no blocking behavior, not a functional requirement.

### Big screen
- A ranking cycle every 3 minutes, paginated when it does not fit [T]. It includes the final ranking of the stage that just ended while waiting for the next stage [T].
- A one-student close-up and a team view, which splits into 2 to 6 sections [T].
- "Competition Paused" and finished displays.
- The controller can show a category leaderboard, the school ranking or a close-up, with optional rotation between categories, and can switch display at any time [C] (BSC-002).
- Columns: individuals: rank, player name, score, completion time; teams: rank, team name, score, completion time; school ranking: rank, school, total (shown with its decimals [T]).
- After the competition the big screen becomes read-only [T].
- **Link regeneration, resolved 2026-10-01** [C] (BSC-003, resolves U-15): the controller can regenerate the shared big-screen link after publish, as a safeguard against a leaked link. A screen still open on the old link shows a clear "this link is no longer valid, ask the controller for the new one" message, rather than silently freezing with no explanation.

## Accessibility requirements

**Resolved 2026-10-01** [C] (U-69): no formal accessibility standard imposed (no WCAG requirement) — just reasonable practice for the age range (U6–U20) and touch-first devices. Touch targets/buttons sized for comfortable tapping (~44px minimum); high contrast; no keyboard dependency. See "Interaction patterns" above for the autosave-failure indicator.

## Icons

**OPEN (I-20).** No icon set is documented. The styling approach is decided (Tailwind CSS, BLD-023); the icon set is not.
