> **Provenance and status, added 2026-10-15 — read before the rest of the file.** This report was produced by an external AI agent at the project owner's request, by analysing the public repository `tianyim568-cyber/sudoku_arena` (another Sudoku project, React + Tailwind) to extract its design system (palette, gradients, radii, shadows, animations, per-screen-type conventions). The project owner judged it visually more polished than the current state of this project and asked that it be used as inspiration. **Adopted as the design reference 2026-10-15** (see `BLD-054` in `context-feeders/decisions/project-decisions.md`, which explicitly acknowledges that this **revises UI-008** — "no dedicated design pass before the event" — at the project owner's direct and explicit request). **The report's original language was French; it was translated into English on 2026-10-21. All code blocks, class strings, counters and file paths were preserved byte-identical through the translation; the prose is a translation, not a verbatim reproduction.** For how to apply it to **this** project specifically (which screen goes in which A/B/C mood, which brand colours to substitute), see `context/ui-context.md`'s new section "Visual design system (adopted 2026-10-15)" — this file gives the recipe, that one gives the mapping onto our actual screens.
>
> **Two known inconsistencies in the source report, which must NOT be reproduced** (the report itself says so in section 8): the `FINISHED` badge is red in one source file and blue in two others — pick **one single colour** (blue, recommended by the report) for our project; and the `sm:w-13`/`md:h-13` classes cited in section 3.13 do not exist in Tailwind's default scale and would be silently ignored — use `w-12`/`w-14` instead.

---

# Report — Design system of the `tianyim568-cyber/sudoku_arena` repository (client)

**Purpose**: describe precisely how this repository's graphical interface was built, so that an agent can apply **the same look** to another project.

**Absolute constraint for the agent applying this report**: modify **only** the appearance — colours, gradients, radii, shadows, spacing, text sizes, `hover`/`focus`/`disabled` states, animations, general layout. **No content, no data, no label, no behaviour, no route, no network call may change.** No new functional component, no new business-logic dependency. If a visual element has no equivalent in the target project, leave it as it is rather than inventing one.

---

## 1. What you must know first: there is almost no CSS

Finding verified file by file in the source repository:

| File | Actual contents |
|---|---|
| `client/src/index.css` | **61 lines**: `@import "tailwindcss";`, `body` reset, `#root`, **5 keyframes** + 5 utility classes |
| `client/src/App.css` | **1 comment line** — empty |
| `client/src/print.css` | 17 lines, only an `@media print` block |
| `client/tailwind.config.js` | **does not exist** (404) |
| `client/postcss.config.js` | **does not exist** (404) |

Conclusion: **Tailwind CSS v4 in "CSS-first" mode**, enabled by the Vite plugin (`@tailwindcss/vite ^4.3.2`), declared in `vite.config.js` as `plugins: [react(), tailwindcss()]`. **No `@theme` block** → the repository runs on Tailwind v4's **default palette and scale**, with no token customisation at all. The entire visual identity therefore lives in **the utility class strings hard-written in the JSX** (1108 `className="…"` attributes and 75 `className={`…`}` across 42 analysed files, ~6000 tokens).

**Implication for the target project**: if the target project already uses Tailwind, this report applies almost as-is (class lists). If it does not use Tailwind, the tokens in section 3 must be turned into CSS variables (`--color-primary`, etc.) reproducing the same values — the source repository itself defines **no** CSS variables, so nothing prevents creating them in the target project.

Stack, for context: React 19.2.7, react-router-dom 7.18.1, Vite 8.1.1, plain JavaScript (no TypeScript), **no icon library** (hand-written inline SVG, `stroke="currentColor"`), **no animation library** (no framer-motion — everything is hand-written keyframes), **no state manager** (hooks only).

---

## 2. The only CSS file to reproduce (verbatim)

This is the heart of the report. This 61-line block is **the entirety** of the repository's non-Tailwind CSS. It can be copied as-is:

```css
@import "tailwindcss";   /* uniquement si le projet cible est en Tailwind v4 */

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

#root {
  min-height: 100vh;
}

/* ── Micro-animation keyframes ────────────────────────────────────── */

/* Letter reveal pop on Round 1 clue board */
@keyframes letter-reveal {
  0%   { transform: scale(0.4) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(3deg);  opacity: 1; }
  100% { transform: scale(1) rotate(0);        opacity: 1; }
}

/* Brief green flash when a cell is correctly filled */
@keyframes correct-flash {
  0%   { background-color: rgb(34 197 94 / 0.6); transform: scale(1.12); }
  100% { background-color: transparent;          transform: scale(1); }
}

/* Pulsing glow when the final puzzle unlocks */
@keyframes unlock-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(168 85 247 / 0.5); }
  50%       { box-shadow: 0 0 20px 6px rgb(168 85 247 / 0.35); }
}

/* Slide-in from the right for message banners */
@keyframes slide-in {
  0%   { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0);    opacity: 1; }
}

/* Golden flash when a ranking row enters the podium */
@keyframes rank-highlight {
  0%   { background-color: rgb(234 179 8 / 0.25); }
  100% { background-color: transparent; }
}

/* ── Utility classes ──────────────────────────────────────────────── */
.animate-letter-reveal  { animation: letter-reveal 0.4s ease-out both; }
.animate-correct-flash  { animation: correct-flash 0.5s ease-out both; }
.animate-unlock-pulse   { animation: unlock-pulse 1.6s ease-in-out infinite; }
.animate-slide-in       { animation: slide-in 0.3s ease-out both; }
.animate-rank-highlight { animation: rank-highlight 1.2s ease-out both; }
```

Discipline points to keep:
- **No web font loaded**: system stack only (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`). No Google Fonts, no `@font-face`.
- **No dark mode**: there is no `dark:` strategy and no `dark` class anywhere. The repository's "dark" is not a theme — those are **deliberately dark screens** (see section 4), hard-coded.
- **No CSS variables**, no `@layer`, no `@theme`.
- `fill mode: both` everywhere except for the pulse (`infinite`).
- The keyframe colours are **exactly** the Tailwind defaults: `rgb(34 197 94)` = `green-500`, `rgb(168 85 247)` = `purple-500`, `rgb(234 179 8)` = `yellow-500`. Reuse them as-is.

### Where each animation is used (exact trigger)

| Class | File | Trigger |
|---|---|---|
| `animate-letter-reveal` | `pages/Round1View.jsx:57` | a cell of the clue board switches to `isRevealed` → the cell becomes `bg-purple-600 text-white shadow-lg shadow-purple-600/30` and "pops" |
| `animate-correct-flash` | `components/SudokuGrid.jsx:149` | on every digit entered: the `row-col` key is added to a `flashingCells` `Set`, removed by a **500 ms** `setTimeout` (= the exact animation duration) |
| `animate-unlock-pulse` | `pages/Round1View.jsx:109` | the "final puzzle" panel goes from `bg-gray-800 border-gray-70/50` to `bg-green-900/30 border-green-600/40` + pulsing purple halo |
| `animate-slide-in` | `pages/PlayerGamePage.jsx:473` | message banner; the element carries `key={message.text}` so that React **remounts** it and replays the animation for every new text |
| `animate-rank-highlight` | `components/RankingView.jsx:224` and `:284` | applied only to rows of **rank ≤ 3** (podium) |
| `animate-spin` (native Tailwind) | `ParticipantImport.jsx:143,234`, `Round2View.jsx:64` | loading spinner: `rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600` |
| `animate-pulse` (native) | `BroadcastView.jsx:31` | "live" dot `w-3 h-3 bg-blue-400 rounded-full` |

**Golden rule to pass on**: the animations are **never decorative** — each one is wired to a precise state change and lasts ≤ 1.6 s. Do not add any others.

### The print CSS (`print.css`, 17 lines)

```css
@media print {
  aside, .print\:hidden { display: none !important; }
  main { margin: 0 !important; padding: 0 !important; }
  .max-w-7xl { max-width: 100% !important; }
}
```

It reveals two things about the structure: the navigation is an **`<aside>`** (sidebar) and the page container is **`max-w-7xl mx-auto`**. Imported in `main.jsx` alongside `index.css`.

---

## 3. The design tokens (extracted by real counting over 42 files)

Raw counts of the most frequent tokens — this is the evidence of what constitutes "the style": `text-xs` ×268, `flex` ×183, `text-sm` ×160, `sm:text-sm` ×144, `items-center` ×127, `rounded` ×124, `px-3` ×119, `text-white` ×117, `py-2` ×109, `rounded-lg` ×101, `border` ×94, `text-gray-400` ×92, `text-gray-500` ×90, `font-medium` ×84.

### 3.1 Palette

**The brand colour is indigo, with purple as the accent.** No custom colour: these are all Tailwind defaults.

| Role | Classes |
|---|---|
| Primary (main actions) | `bg-indigo-600` → `hover:bg-indigo-500`, text `text-white` |
| Primary "auth" variant | `bg-purple-600` → `hover:bg-purple-500` (login button) |
| Success | `bg-green-600` → `hover:bg-green-500` |
| Danger | `bg-red-600` → `hover:bg-red-500` |
| Secondary / neutral | `bg-gray-200 text-gray-700 hover:bg-gray-300` (cancel), or `border border-gray-300 text-gray-700 hover:bg-gray-100` |
| Warning | `bg-yellow-500`, `bg-yellow-600`, `bg-amber-700`, `bg-orange-600` |
| Information | `bg-blue-600` → `hover:bg-blue-500` |
| Text on light background | `text-gray-900` (headings), `text-gray-800`, `text-gray-700` (body), `text-gray-600`, `text-gray-500` (secondary), `text-gray-400` (tertiary/disabled) |
| Text on dark background | `text-white` (main), `text-gray-300`, `text-gray-400` (secondary), `text-gray-500` / `text-gray-600` (subtle), `text-purple-200` / `text-purple-300` (accent) |
| Numeric emphasis | `text-yellow-400 font-bold` (scores, podium titles) |

**Important reading rule**: `text-gray-400` (×92) and `text-gray-500` (×90) are the two most used classes after typography. The interface is **low-contrast on secondary text**: only one element per area gets pure white/black, everything else is mid-grey.

### 3.2 The three gradients (all the `bg-gradient-*` in the repository — 14 occurrences in total)

1. **Authentication / public pages gradient** (the most identifying, 6 occurrences: `LoginPage`, `RegisterPage`, `CompetitionJoinPage` ×3, and the `min-h-screen` background):
   ```
   bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800
   ```
   Always as `min-h-screen … flex items-center justify-center p-4`.
2. **Application header gradient** (2 occurrences: `DashboardLayout.jsx:48`, `CompetitionListPage.jsx:89`):
   ```
   bg-gradient-to-r from-indigo-700 to-purple-700 text-white … shadow-lg
   ```
3. **Big ranking screen gradient** (5 occurrences: `RankingView`, `RoundRankingView`, `DisplayStageRankingView`, `DisplayFinalRankingView`, `BroadcastView`):
   ```
   bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white
   ```

There are also two one-off micro-gradients in `BroadcastView`: a card `bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg`, and a circular avatar `bg-gradient-to-br from-blue-400 to-purple-500 rounded-full`.

**Direction: `to-br` for page backgrounds, `to-r` for horizontal bars. Never `to-b`, never `to-tr`.**

### 3.3 Radii (`rounded-*`)

| Usage | Class | Frequency |
|---|---|---|
| Compact buttons, badges, status dots | `rounded` (4 px) | 124 |
| Normal buttons, panels, input fields | `rounded-lg` | 101 |
| Circular dots / medals / avatars | `rounded-full` | 40 |
| Cards and dashboards, big-screen lists | `rounded-xl` | 25 |
| "Glass" cards on login pages | `rounded-2xl` | 4 |
| Rare | `rounded-md`, `rounded-sm` | 6 / 2 |

### 3.4 Shadows

`shadow-lg` ×18 (headers, medals), `shadow` ×15 (white dashboard cards), `shadow-2xl` ×5 (glass login cards), `shadow-xl` ×5 (modals), `shadow-sm` ×3. Only two **coloured** shadows: `shadow-lg shadow-purple-600/30` (revealed clue cell) and `shadow-red-600/40`. `hover:shadow-md` and `transition-shadow` appear once each.

### 3.5 Cards — the two exact formulas

**Light card (dashboard, judge, panels)** — this is the most widespread pattern, the first to reproduce:
```
bg-white rounded-xl shadow p-4 sm:p-6
```
Variants encountered: `bg-white rounded-lg shadow p-4 sm:p-6 space-y-4` (`ParticipantImport`), and `bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden` for lists (`DashboardPage`).

**Dark card (big screens, game panels)**:
```
bg-white/5 border border-white/10 rounded-xl overflow-hidden
```
with internal separators `divide-y divide-white/5`, and `border-yellow-50/20` instead of `border-white/10` to frame the podium. In the game views: `bg-gray-800 rounded-lg p-4` and `bg-gray-700/50`.

**Thematic coloured panels** (always the same scheme `bg-{hue}-900/30 border border-{hue}-700/30 rounded-lg p-4` + title `text-sm font-semibold text-{hue}-300 mb-3`): purple for clues, yellow for the round explanation, green for success, red for error.

### 3.6 Buttons — exact recipes

```
Primaire   : px-3 py-1.5 bg-indigo-600 text-white rounded text-xs sm:text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
Primaire L : px-4 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed
Succès     : bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm sm:text-base font-medium transition-colors
Danger     : bg-red-600 hover:bg-red-500 text-white rounded-lg / rounded text-sm
Annuler    : px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300
Contour    : px-5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium
Icône seule: p-2 rounded-lg hover:bg-white/10 transition-colors   (sur fond coloré)
```

`disabled:opacity-50` appears 18 times — **it is the single disabling convention** (sometimes completed by `disabled:cursor-not-allowed`). No button uses `disabled:bg-gray-300`.

**"Glass" buttons on a gradient background** (login, header):
```
px-3 sm:px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition-colors text-white
```

### 3.7 Input fields

**On a gradient background (login / registration)**:
```
w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm sm:text-base
```

**On a light background (dashboard)**: the dominant pattern is `border border-gray-300 rounded … focus:outline-none focus:ring-2 focus:ring-indigo-400`. `focus:ring-2` ×10 and `focus:outline-none` ×10: **focus is always a ring, never a coloured border**, and the ring follows the hue of the context (purple on a gradient background, indigo on a light background).

### 3.8 Lists and tables

The repository uses **very few** real `<table>` tags: only the main list of `ParticipantImport`, with progressive column hiding — `hidden sm:table-cell`, `hidden md:table-cell`, `hidden lg:table-cell` (×22 / ×8 / ×8), headers `px-1 sm:px-2 py-1 text-left`.

Everywhere else these are **`div` lists**:
```
<ul className="divide-y divide-gray-100">
  <li className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group">
```
Dark rows: `border-b border-gray-700/50 hover:bg-gray-700/50`, or `hover:bg-white/5 transition-colors` on the big screen. List section headers: `px-5 py-3 border-b border-gray-200 bg-gray-50` + `text-sm font-semibold text-gray-700`.

### 3.9 Badges / status dots

General formula: `px-2 py-0.5 rounded text-xs font-medium` + a colour pair. **Two systems coexist, to be respected according to the background**:

- **On a light background** (soft dots, hue 100 + text 800) — `CompetitionListPage.jsx:70-75`, `DashboardCompetitionsPage.jsx:74-79`:
  ```js
  { DRAFT: 'bg-yellow-100 text-yellow-800',
    PUBLISHED: 'bg-blue-100 text-blue-800',
    RUNNING: 'bg-green-100 text-green-800',
    FINISHED: 'bg-gray-100 text-gray-800' }
  ```
- **On a dark background / big screen** (solid dots, hue 500) — `RankingView.jsx:27-33`, `RoundRankingView.jsx:36-41`, `DisplayStageRankingView.jsx:44-48`, `CompetitionJoinPage.jsx:98-103`:
  ```js
  { PENDING/NOT_STARTED/WAITING: 'bg-gray-500',
    IN_PROGRESS/RUNNING: 'bg-green-500',
    PAUSED: 'bg-yellow-500',
    FINISHED: 'bg-red-500' (RankingView) | 'bg-blue-500' (les autres) }
  ```
  ⚠️ **Real inconsistency in the repository**: `FINISHED` is red in `RankingView` and blue in `RoundRankingView`/`DisplayStageRankingView`. In the target project, **pick a single value** (blue recommended, it is the most frequent) and apply it everywhere.
- Dark dots of the judge header (`JudgeControlPage.jsx:135-14`): solid hue 600 — `bg-yellow-600` (ready to start), `bg-green-600` (running), `bg-orange-600` (paused), `bg-gray-600` (other).
- Difficulty badges (`SudokuGrid.jsx:102-106`): `EASY: bg-green-600 text-green-100`, `MEDIUM: bg-yellow-600 text-yellow-100`, `HARD: bg-red-600 text-red-100`, fallback `bg-gray-600 text-gray-100`, as `px-2 py-1 rounded text-xs font-bold`.
- Small letter/state badges in a dark context: `bg-purple-700/50 text-purple-300 px-2 py-0.5 rounded text-xs`, `bg-green-700/50 text-green-300 …`, `bg-green-800/50 text-green-300 …`.

### 3.10 Typography

- **Systematic mobile-first scale**: nearly every size is doubled — `text-xs sm:text-sm` (×144), `text-sm sm:text-base`, `text-base sm:text-lg`, `text-lg sm:text-xl`, `text-xl sm:text-2xl`, `text-2xl sm:text-3xl`, up to `text-4xl sm:text-6xl` on the big screens. **This is the repository's typographic signature**: the mobile value is always the smaller of the two.
- Weights: `font-medium` for body text, `font-semibold` for section titles, `font-bold` for page titles and numbers. Never `font-black`, never `font-light`.
- Numbers: **`tabular-nums` (×11)** on everything that is a score, a chrono or a ranking; `font-mono` (×10) for codes and countdowns.
- Section titles in spaced capitals: `text-xs sm:text-sm uppercase tracking-wide text-gray-500` (`TransitionScreen`, `WaitingScreen`); the giant header title uses `tracking-tight`.
- Exact recurring titles: `text-sm font-semibold text-gray-300 mb-3` (×15, dark panels), `text-xl font-bold text-gray-900` (×4), `text-2xl sm:text-3xl font-bold` (×4), `text-base sm:text-lg font-semibold mb-3 sm:mb-4` (×5).
- Truncation: `truncate` (×17) + `min-w-0` (×15) + `break-words` on long names.

### 3.11 Spacing and containers

- Page: `max-w-7xl mx-auto` (×12) in the layout, `max-w-6xl mx-auto` for the judge console, `max-w-5xl mx-auto` for a competition's detail, `max-w-4xl` for a broadcast card, `max-w-md` / `max-w-lg` for modals.
- Page padding: `p-4 sm:p-6` (the standard pair). Card inner padding: `p-4 sm:p-6` or `p-6`.
- Stacking: `space-y-4` (×14), `space-y-3`, `space-y-6` between sections, `space-y-1` in the navigation, `space-y-1.5` in a button list.
- Flex gutters: `gap-2` (×69) then `gap-3`, `gap-4`, `gap-1`; responsive versions `gap-2 sm:gap-3`, `gap-3 sm:gap-4`, `gap-3 sm:gap-6`.
- Vertical text margins: `mb-3` (×47), `mb-4`, `mb-2`, `mb-1`, `mt-1`, `mt-2`, `mt-3`.

### 3.12 Responsive

**Only one breakpoint is really used: `sm:`** (×144 on `text-sm` alone). Then come `lg:` for the layout switch (sidebar, columns) and `md:` for grid cell size and a few table columns. No `xl:`, no `2xl:`.

Standard switch pattern: `flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3`.
Sidebar: `hidden lg:block absolute lg:static inset-y-0 left-0 z-30 w-56 shrink-0` + mobile drawer with veil `lg:hidden absolute inset-0 bg-black/30 z-20`.
Statistics grid: `grid grid-cols-2 lg:grid-cols-4 gap-4`.

### 3.13 Transitions

`transition-colors` ×42 is **the** transition of the repository — on virtually every interactive element. Then `transition-all` ×4 (clue-board cells, stat cards with `scale-[1.01]`/`scale-[1.02]`), `transition-opacity` ×2, `transition-shadow` ×1, and `duration-1000` exactly once (the chrono progress bar, as `transition-all`). No explicit duration anywhere else: Tailwind's 150 ms default is left in place.

---

## 4. The three "moods" — the most important structural rule

The repository has no global theme: it has **three distinct visual treatments**, chosen according to the screen's role. An agent applying this report must first classify every screen of the target project into one of these three categories, then apply the corresponding treatment.

### A. Public authentication pages — "glass on a gradient"
`LoginPage`, `RegisterPage`, `CompetitionJoinPage`.
```
Background : min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4
Card       : bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-white/20
Title      : text-2xl sm:text-3xl font-bold text-white text-center mb-2
Subtitle   : text-purple-200 text-center mb-6 sm:mb-8 text-sm sm:text-base
Fields     : bg-white/10 border-white/20 text-white placeholder-purple-300 focus:ring-purple-400
Button     : w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors
Error      : text-red-300 text-xs sm:text-sm text-center
Link       : text-purple-300 hover:text-white text-xs sm:text-sm transition-colors
```
**`backdrop-blur-lg` is used only here** — this is what produces the "frosted glass" effect.

### B. Back office / administration — "light, sober, white cards"
`DashboardLayout` + all the `Dashboard*` pages, `JudgeControlPage`, `CompetitionListPage`, `CompetitionDetailPage`, `ErrorPage`.
```
Shell     : h-screen flex flex-col bg-gray-50
Header    : bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 sm:px-6 py-4 shadow-lg shrink-0 z-20
            title text-lg sm:text-xl font-bold + subtitle text-purple-200 text-xs hidden sm:block
Sidebar   : w-56 bg-indigo-800 text-white p-4 overflow-y-auto, nav in space-y-1
Nav link  : flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
            active   → bg-indigo-600 text-white
            inactive → text-indigo-100 hover:bg-indigo-500/30
Content   : flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 > div.max-w-7xl.mx-auto
Cards     : bg-white rounded-xl shadow p-4 sm:p-6
Buttons   : indigo-600 / gray-200 / red-600 (see 3.6)
Modals    : veil fixed inset-0 bg-black/40 (Modal) or bg-black bg-opacity-50 (ConfirmDialog)
            + z-50 p-4 flex items-center justify-center
            panel bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200
            title text-lg font-semibold text-gray-900 mb-4
Toasts    : fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm
            success bg-green-50 text-green-700 border-green-200
            error   bg-red-50 text-red-700 border-red-200
            info    bg-gray-100 text-gray-700 border-gray-200
Stat cards : bg-white border-gray-200 hover:border-gray-300, active bg-gray-50 border-gray-500
             + hover:shadow-sm hover:scale-[1.01] / active shadow-md scale-[1.02]
             figure text-3xl sm:text-4xl font-bold tabular-nums, label text-sm font-medium mt-2 opacity-80
             coloured variants: green-50/green-200/green-700, amber-50/amber-200/amber-700, purple-50/purple-200/purple-700
```
Useful note: `Modal.jsx` carries a comment spelling out the rule — the dashboard pages were moved to a light theme (`bg-gray-50` + white cards), so the dashboard modals are white, and `ConfirmDialog` (public pages) is too. **The repository never mixes a white card into a dark screen.**

### C. Game and big screens — "dark, large, readable from the back of the room"
`PlayerGamePage`, `AdminDashboardPage`, `DisplayPage`, `RankingView`, `RoundRankingView`, `DisplayStageRankingView`, `DisplayFinalRankingView`, `BroadcastView`, `Round1/2/3View`, `WaitingScreen`, `TransitionScreen`, `StageFinishedScreen`.
```
Game page background  : min-h-screen bg-gray-900 text-white
Big screen background : min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white flex flex-col
Top bar               : bg-gray-800 px-3 sm:px-6 py-2 sm:py-3
Giant header          : border-b border-white/10 px-6 py-4, content max-w-7xl mx-auto
Giant footer          : border-t border-white/10 px-6 py-3 text-center text-gray-600 text-xs
Panels                : bg-gray-800 rounded-lg p-4, title text-sm font-semibold text-gray-300 mb-3
Cards                 : bg-white/5 border border-white/10 rounded-xl overflow-hidden + divide-y divide-white/5
Rows                  : px-6 py-6 (podium) / py-3 (rest) + hover:bg-white/5 transition-colors
Scores                : tabular-nums font-bold text-4xl sm:text-5xl (podium) / text-3xl
Medals                : w-16 h-16 rounded-full text-3xl font-bold shadow-lg
                        gold bg-yellow-500 text-gray-900 · silver bg-gray-300 text-gray-900 · bronze bg-amber-700 text-white
                        ranks 4+: text-gray-400 text-3xl font-semibold pl-3
Empty state           : text-center text-gray-500 py-20 + emoji text-6xl mb-4 (🏆 📊 📋) + text-2xl font-semibold text-gray-300
Message banners       : animate-slide-in mb-4 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-center
                        success bg-green-900/50 text-green-300 · warning bg-yellow-900/50 text-yellow-300
                        error   bg-red-900/50 text-red-300 · info bg-blue-900/50 text-blue-300
Buttons on grey       : bg-gray-700 hover:bg-gray-600 text-white rounded-lg (grid numbers)
```

The sudoku grid itself (`SudokuGrid.jsx`) deserves to be singled out, because it is the repository's only "drawn component":
```
Container : inline-block border-2 border-gray-600 bg-gray-700 overflow-x-auto max-w-full
Cell      : w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 flex items-center justify-center
            text-base md:text-lg font-medium border border-gray-600 transition-colors cursor-pointer
3×3 blocks: border-b-2 border-b-gray-400 / border-r-2 border-r-gray-400 (computed by ri % 3 === 2)
States    : initial given data bg-gray-800 text-white cursor-default
            selected          bg-indigo-600 text-white
            filled & validated bg-green-900/40 text-green-300
            proposal          bg-yellow-900/20 text-yellow-300
            free              bg-gray-700 text-gray-200 hover:bg-gray-600
Proposal  : overlay absolute inset-0 border-2 border-dashed border-yellow-500/60 + value text-yellow-400 text-xs font-bold opacity-70
Mini accept/reject buttons : w-4 h-4 rounded-full text-[8px] leading-none, bg-green-600 hover:bg-green-500 / bg-red-600 hover:bg-red-500, positioned absolute -top-1 -right-1 z-10
Player presence dots : w-2 h-2 rounded-full, rotating palette
            bg-blue-500, bg-purple-500, bg-pink-500, bg-orange-500, bg-cyan-500, bg-lime-500, bg-rose-500, bg-amber-500
Numeric pad : w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 bg-gray-700 hover:bg-indigo-600 text-white rounded-lg font-bold transition-colors
              (round 1 variant: bg-indigo-700 hover:bg-indigo-600), erase button bg-red-800 hover:bg-red-700
Legend : mt-3 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-500
```
⚠️ `sm:w-13` / `md:h-13` **do not exist** in Tailwind's default scale (no `13`) — these classes are silently ignored. Do not copy them: use `w-12`/`w-14`.

The only place where colours are set with **inline `style`** rather than classes is `TimerDisplay.jsx`, which computes a colour from the remaining percentage:
```js
const color = percent > 50 ? '#4caf50' : percent > 20 ? '#ff9800' : '#f44336';
// barre : <div className="relative w-full h-6 sm:h-8 bg-gray-200 rounded overflow-hidden">
//         <div className="absolute top-0 left-0 h-full transition-all duration-1000" style={{ width: `${percent}%`, backgroundColor: color }} />
//         <span className="relative z-10 flex items-center justify-center h-full font-bold text-xs sm:text-sm"
//               style={{ color: percent > 50 ? '#fff' : '#333' }}>
```
Those three hexadecimals are Material Design, **not** Tailwind — the repository's single breach of its own palette. Replace them with `green-500` / `amber-500` / `red-500` in the target project to stay consistent.

---

## 5. Cross-cutting conventions to respect

1. **Icons**: no library. Hand-written inline SVG, always `fill="none" stroke="currentColor" viewBox="0 0 24 24"` with `strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}` and a size `w-5 h-5` / `w-20 h-20 text-gray-400`. Simple pictograms are **HTML entities** (`&#10003;` ✓, `&#10007;` ✗, `&#128274;` 🔒) or **raw emoji** (🏆 📊 📋) — never an image.
2. **`currentColor`**: the SVGs and the states always inherit the parent's text colour, which avoids duplicating colour classes.
3. **Fixed z-index values**: `z-20` (header), `z-30` (sidebar + mobile veil), `z-50` (modals, toasts). Nothing beyond that.
4. **Accessibility present but minimal**: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on modals, `role="alert"` on toasts, `aria-label` on the sidebar toggle button. Keep as-is, without adding any more (that would touch behaviour).
5. **Empty states and loading states always explicit**: never a blank screen. Loading = `flex items-center justify-center h-screen p-4 text-center text-sm sm:text-base` or the spinner `animate-spin rounded-full border-b-2 border-blue-600`. Error = card `bg-red-50 border border-red-200 rounded-xl p-6 text-center` with `text-red-800 text-sm font-medium` then the detail in `text-red-600 text-xs mt-2`.
6. **One single style per role**: the repository's unwritten rule is that a given visual role always has exactly the same classes from one file to the next (the `bg-white rounded-xl shadow p-4 sm:p-6` cards are literally identical in 6 files). The source code comments insist on it: *"same language as RoundRankingView and RankingView so the room does not see a style break when the judge switches modes"*. **Do not introduce a local variant.**

---

## 6. Recommended procedure for the agent applying this

1. **Read this section before writing anything.** Do not start by recolouring at random.
2. Check whether the target project has Tailwind. If not: create a single stylesheet containing section 2's 5 keyframes + a set of CSS variables carrying section 3's tokens, and apply the equivalents in plain CSS. **Do not add Tailwind to a project that does not have it** without explicit agreement — that is an architecture change, not a style change.
3. Classify every screen of the target project into mood **A**, **B** or **C** of section 4, and note that classification before modifying anything.
4. Handle **one screen at a time**, in this order: shell/background → cards and panels → buttons → fields → badges → typography → animations last.
5. For each screen, change **only** the class/style attributes. Forbidden: renaming a component, moving an element in the tree, altering a display condition, a `key`, an event handler, a text, a route or an API call.
6. Animations must only be wired to state changes that **already exist** in the target project. If no equivalent state exists, do not add the animation.
7. After each screen: verify that nothing changed functionally (same texts, same displayed data, same interactions) before moving to the next one.
8. Report explicitly, without correcting them on your own initiative: any inconsistency between this report and the target project, and the known `FINISHED` inconsistency (section 3.9).

---

## 7. Sources

Public repository `https://github.com/tianyim568-cyber/sudoku_arena`, branch `main`. 49 files downloaded and analysed (42 style-carrying components/pages + 7 dashboard pages and entry files), complete inventory of 105 files under `client/src/**` verified as not truncated. All the counts cited (class frequencies, gradient occurrences) come from a regex extraction over these files' real `className` attributes, not from an estimate. The code citations are verbatim.
