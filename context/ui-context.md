# UI Context (DRAFT v0, 2026-09-26)

> **Partial draft.** Behaviour and content of the screens are documented; the visual design is not. Do not invent colours, layouts, fonts or component choices.
> Status tags: [C] client-confirmed · [S] client's document · [T] team/project-owner decision, not client-confirmed · [O] open. See `README.md`.

## Theme

**OPEN (U-65).** No visual language is documented: not dark or light, not minimal or rich, and no school brand, colours or logo. The stakeholder has to answer.

## Visual references

None recorded.

## Colors, typography, border radius, spacing

**OPEN.** Depend on the visual language (U-65). No tokens exist yet. When defined, every component must use named tokens, never raw values.

## Component library and icons

**OPEN (I-20).** [[FILL-BEFORE-UNIT: first UI unit — UI component library = ________ ; icon set = ________ ; fonts (including Chinese) = ________ ; owner: the person completing the context]] The frontend is React with TypeScript [T]. No UI library, icon set or font is documented (team decision). Chinese text rendering on the tablets is undocumented and depends on the tablet model and Quark version (U-06); font and Chinese-display requirements: **OPEN (U-70).**

## Layout patterns

- **Answer screen [C] (UI-001):** landscape; the puzzle on the left, a number pad on the right; previous, next and question-number buttons; a delete button that clears the selected cell; a clear-all button that starts the puzzle over. Delete and clear-all ask for confirmation. Each question's point value is shown [S].
- Layouts of the judge, controller and big-screen views, and of the login, competition room, preparation, waiting and results screens: **OPEN (U-66).**

## Responsive rules

- The student answer screen is landscape; a "please rotate your device" screen appears when the tablet is held upright [C] (UI-001, PAR-006).
- Screen sizes and orientations for the learning tablets, the judges' and controller's devices, and the big screens: **OPEN (U-67, with U-06).**

## Interaction patterns

- Autosave: every move is saved [C]. What the student sees when an autosave fails: **OPEN (U-69).**
- Before the final submit the student is asked to confirm; the confirmation states how many puzzles are blank [T]. After submitting, the student sees "accepted" and no immediate score [T].
- The pause notice for players is a blocking message [T]. On resume, a "3, 2, 1, Start" shows first [T].
- The controller's warning when a round's points do not add up to 100 (Individual rounds): shown on the setup screen next to the points, updated as typed, and as a summary when starting the stage; never blocking [T].
- Touch target sizes, contrast and keyboard use: **OPEN (U-69).**

## Language

The interface is **English and Chinese**, not one or the other; the translation mechanism must be planned in from the start [C] (ARCH-026). Messages such as the pause notice are written in both languages [T]. Whether the language is per user, per event or both shown at once, and the default: **OPEN (U-68).**

## Screens and states

### Player
- **States [T]:** competition room; preparation room (the round's rules and a countdown); active round; read-only after submitting; waiting.
- Waiting for the next stage: a message that the stage is over and the next stage is coming, with no score or rank [T]. When students see their own score and rank: **OPEN (U-24, U-88).**

### Judge
- Content (not layout): the status of their own students, the stage, round and remaining time, and the live ranking. Also how many times a student left the answer page, as information only, with no penalty [P]. Can restart one student's round [P]. Judge powers beyond that: **OPEN (U-55).**

### Controller
- Content (not layout): the command list (start a stage, pause, resume, end a round early, finish, reset or rematch, correct scores, control the big screens) [C]; all progress in real time; setup screens for the competition, points and numeric values; assigning judge ranges during setup (changeable during the event) [C] (BLD-008); the "total is not 100" warning per category and round on the setup screen and as a summary when starting the stage [C]; results and export.

### Big screen
- A ranking cycle every 3 minutes, paginated when it does not fit [T]. It includes the final ranking of the stage that just ended while waiting for the next stage [T].
- A one-student close-up and a team view, which splits into 2 to 6 sections [T].
- "Competition Paused" and finished displays.
- The controller can show a category leaderboard, the school ranking or a close-up, with optional rotation between categories, and can switch display at any time [C] (BSC-002).
- Columns: individuals: rank, player name, score, completion time; teams: rank, team name, score, completion time; school ranking: rank, school, total (shown with its decimals [T]).
- After the competition the big screen becomes read-only [T].

## Accessibility requirements

**OPEN (U-69).** Nothing documented.

## Icons

**OPEN (I-20).**
