# Rapport — Système de design du dépôt `tianyim568-cyber/sudoku_arena` (client)

**Objet** : décrire précisément comment l'interface graphique de ce dépôt a été construite, afin qu'un agent puisse appliquer **le même look** à un autre projet.

**Contrainte absolue pour l'agent qui applique ce rapport** : ne modifier **que l'apparence** — couleurs, dégradés, rayons, ombres, espacements, tailles de texte, états `hover`/`focus`/`disabled`, animations, disposition générale. **Aucun contenu, aucune donnée, aucun libellé, aucun comportement, aucune route, aucun appel réseau ne doit changer.** Pas de nouveau composant fonctionnel, pas de nouvelle dépendance de logique métier. Si un élément visuel n'a pas d'équivalent dans le projet cible, on le laisse tel quel plutôt que d'inventer.

---

## 1. Ce qu'il faut savoir avant tout : il n'y a presque pas de CSS

Constat vérifié fichier par fichier dans le dépôt source :

| Fichier | Contenu réel |
|---|---|
| `client/src/index.css` | **61 lignes** : `@import "tailwindcss";`, reset `body`, `#root`, **5 keyframes** + 5 classes utilitaires |
| `client/src/App.css` | **1 ligne de commentaire** — vide |
| `client/src/print.css` | 17 lignes, uniquement une `@media print` |
| `client/tailwind.config.js` | **n'existe pas** (404) |
| `client/postcss.config.js` | **n'existe pas** (404) |

Conclusion : **Tailwind CSS v4 en mode « CSS-first »**, activé par le plugin Vite (`@tailwindcss/vite ^4.3.2`), déclaré dans `vite.config.js` par `plugins: [react(), tailwindcss()]`. **Aucun bloc `@theme`** → le dépôt tourne sur la **palette et l'échelle par défaut de Tailwind v4**, sans aucune personnalisation de tokens. Toute l'identité visuelle tient donc dans **les chaînes de classes utilitaires écrites en dur dans le JSX** (1108 attributs `className="…"` et 75 `className={`…`}` sur 42 fichiers analysés, ~6000 tokens).

**Implication pour le projet cible** : si le projet cible utilise déjà Tailwind, ce rapport s'applique presque tel quel (liste de classes). S'il n'utilise pas Tailwind, il faut traduire les tokens de la section 3 en variables CSS (`--color-primary`, etc.) et reproduire les mêmes valeurs — le dépôt source lui-même ne définit **aucune** variable CSS, donc rien n'empêche d'en créer dans le projet cible.

Stack pour contexte : React 19.2.7, react-router-dom 7.18.1, Vite 8.1.1, JavaScript pur (pas de TypeScript), **aucune librairie d'icônes** (SVG inline à la main, `stroke="currentColor"`), **aucune librairie d'animation** (pas de framer-motion — tout est en keyframes écrites à la main), **aucun gestionnaire d'état** (hooks uniquement).

---

## 2. Le seul fichier CSS à reproduire (verbatim)

C'est le cœur du rapport. Ce bloc de 61 lignes est **la totalité** du CSS non-Tailwind du dépôt. Il peut être recopié tel quel :

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

Points de discipline à conserver :
- **Aucune police web chargée** : pile système uniquement (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`). Pas de Google Fonts, pas de `@font-face`.
- **Pas de mode sombre** : il n'existe aucune stratégie `dark:` ni classe `dark`. Le « sombre » du dépôt n'est pas un thème — ce sont des **écrans délibérément sombres** (voir section 4), codés en dur.
- **Pas de variables CSS**, pas de couche `@layer`, pas de `@theme`.
- `fill mode: both` partout sauf pour la pulsation (`infinite`).
- Les couleurs des keyframes sont **exactement** les Tailwind par défaut : `rgb(34 197 94)` = `green-500`, `rgb(168 85 247)` = `purple-500`, `rgb(234 179 8)` = `yellow-500`. À réutiliser telles quelles.

### Où chaque animation est utilisée (déclencheur exact)

| Classe | Fichier | Déclencheur |
|---|---|---|
| `animate-letter-reveal` | `pages/Round1View.jsx:57` | une case du tableau d'indices passe à `isRevealed` → la case devient `bg-purple-600 text-white shadow-lg shadow-purple-600/30` et « pop » |
| `animate-correct-flash` | `components/SudokuGrid.jsx:149` | à chaque saisie d'un chiffre : la clé `row-col` est ajoutée à un `Set` `flashingCells`, retirée par un `setTimeout` de **500 ms** (= durée exacte de l'animation) |
| `animate-unlock-pulse` | `pages/Round1View.jsx:109` | le panneau « puzzle final » passe de `bg-gray-800 border-gray-70/50` à `bg-green-900/30 border-green-600/40` + halo violet pulsant |
| `animate-slide-in` | `pages/PlayerGamePage.jsx:473` | bannière de message ; l'élément porte `key={message.text}` pour que React le **remonte** et rejoue l'animation à chaque nouveau texte |
| `animate-rank-highlight` | `components/RankingView.jsx:224` et `:284` | appliqué uniquement aux lignes de **rang ≤ 3** (podium) |
| `animate-spin` (natif Tailwind) | `ParticipantImport.jsx:143,234`, `Round2View.jsx:64` | spinner de chargement : `rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600` |
| `animate-pulse` (natif) | `BroadcastView.jsx:31` | pastille « en direct » `w-3 h-3 bg-blue-400 rounded-full` |

**Règle d'or à transmettre** : les animations ne sont **jamais décoratives** — chacune est branchée sur un changement d'état précis et dure ≤ 1,6 s. Ne pas en ajouter d'autres.

### Le CSS d'impression (`print.css`, 17 lignes)

```css
@media print {
  aside, .print\:hidden { display: none !important; }
  main { margin: 0 !important; padding: 0 !important; }
  .max-w-7xl { max-width: 100% !important; }
}
```

Il révèle deux choses sur la structure : la navigation est un **`<aside>`** (sidebar) et le conteneur de page est **`max-w-7xl mx-auto`**. Importé dans `main.jsx` à côté de `index.css`.

---

## 3. Les tokens de design (extraits par comptage réel sur 42 fichiers)

Comptages bruts des tokens les plus fréquents — c'est la preuve de ce qui constitue « le style » : `text-xs` ×268, `flex` ×183, `text-sm` ×160, `sm:text-sm` ×144, `items-center` ×127, `rounded` ×124, `px-3` ×119, `text-white` ×117, `py-2` ×109, `rounded-lg` ×101, `border` ×94, `text-gray-400` ×92, `text-gray-500` ×90, `font-medium` ×84.

### 3.1 Palette

**La couleur de marque est l'indigo, avec le violet en accent.** Aucune couleur custom : ce sont les Tailwind par défaut.

| Rôle | Classes |
|---|---|
| Primaire (actions principales) | `bg-indigo-600` → `hover:bg-indigo-500`, texte `text-white` |
| Primaire variante « auth » | `bg-purple-600` → `hover:bg-purple-500` (bouton de connexion) |
| Succès | `bg-green-600` → `hover:bg-green-500` |
| Danger | `bg-red-600` → `hover:bg-red-500` |
| Secondaire / neutre | `bg-gray-200 text-gray-700 hover:bg-gray-300` (annuler), ou `border border-gray-300 text-gray-700 hover:bg-gray-100` |
| Avertissement | `bg-yellow-500`, `bg-yellow-600`, `bg-amber-700`, `bg-orange-600` |
| Information | `bg-blue-600` → `hover:bg-blue-500` |
| Texte sur fond clair | `text-gray-900` (titres), `text-gray-800`, `text-gray-700` (corps), `text-gray-600`, `text-gray-500` (secondaire), `text-gray-400` (tertiaire/désactivé) |
| Texte sur fond sombre | `text-white` (principal), `text-gray-300`, `text-gray-400` (secondaire), `text-gray-500` / `text-gray-600` (discret), `text-purple-200` / `text-purple-300` (accent) |
| Mise en avant numérique | `text-yellow-400 font-bold` (scores, titres de podium) |

**Règle de lecture importante** : `text-gray-400` (×92) et `text-gray-500` (×90) sont les deux classes les plus utilisées après la typo. L'interface est **peu contrastée sur le texte secondaire** : un seul élément par zone a droit au blanc/noir franc, tout le reste est en gris moyen.

### 3.2 Les trois dégradés (tous les `bg-gradient-*` du dépôt — 14 occurrences au total)

1. **Dégradé d'authentification / pages publiques** (le plus identitaire, 6 occurrences : `LoginPage`, `RegisterPage`, `CompetitionJoinPage` ×3, et le fond `min-h-screen`) :
   ```
   bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800
   ```
   Toujours en `min-h-screen … flex items-center justify-center p-4`.
2. **Dégradé de l'en-tête d'application** (2 occurrences : `DashboardLayout.jsx:48`, `CompetitionListPage.jsx:89`) :
   ```
   bg-gradient-to-r from-indigo-700 to-purple-700 text-white … shadow-lg
   ```
3. **Dégradé des grands écrans de classement** (5 occurrences : `RankingView`, `RoundRankingView`, `DisplayStageRankingView`, `DisplayFinalRankingView`, `BroadcastView`) :
   ```
   bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white
   ```

Il existe aussi deux micro-dégradés ponctuels dans `BroadcastView` : une carte `bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg`, et un avatar circulaire `bg-gradient-to-br from-blue-400 to-purple-500 rounded-full`.

**Direction : `to-br` pour les fonds de page, `to-r` pour les barres horizontales. Jamais `to-b` ni `to-tr`.**

### 3.3 Rayons (`rounded-*`)

| Usage | Classe | Fréquence |
|---|---|---|
| Boutons compacts, badges, pastilles de statut | `rounded` (4 px) | 124 |
| Boutons normaux, panneaux, champs de saisie | `rounded-lg` | 101 |
| Pastilles / médailles / avatars circulaires | `rounded-full` | 40 |
| Cartes et tableaux de bord, listes sur écran géant | `rounded-xl` | 25 |
| Cartes « verre » des pages de connexion | `rounded-2xl` | 4 |
| Rare | `rounded-md`, `rounded-sm` | 6 / 2 |

### 3.4 Ombres

`shadow-lg` ×18 (en-têtes, médailles), `shadow` ×15 (cartes blanches du tableau de bord), `shadow-2xl` ×5 (cartes de connexion en verre), `shadow-xl` ×5 (modales), `shadow-sm` ×3. Deux ombres **colorées** seulement : `shadow-lg shadow-purple-600/30` (case d'indice révélée) et `shadow-red-600/40`. `hover:shadow-md` et `transition-shadow` apparaissent une fois chacun.

### 3.5 Cartes — les deux formules exactes

**Carte claire (tableau de bord, juge, panels)** — c'est le motif le plus répandu, à reproduire en priorité :
```
bg-white rounded-xl shadow p-4 sm:p-6
```
Variantes rencontrées : `bg-white rounded-lg shadow p-4 sm:p-6 space-y-4` (`ParticipantImport`), et `bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden` pour les listes (`DashboardPage`).

**Carte sombre (écrans géants, panels de jeu)** :
```
bg-white/5 border border-white/10 rounded-xl overflow-hidden
```
avec des séparateurs internes `divide-y divide-white/5`, et `border-yellow-50/20` à la place de `border-white/10` pour encadrer le podium. Dans les vues de jeu : `bg-gray-800 rounded-lg p-4` et `bg-gray-700/50`.

**Panneaux colorés thématiques** (toujours le même schéma `bg-{hue}-900/30 border border-{hue}-700/30 rounded-lg p-4` + titre `text-sm font-semibold text-{hue}-300 mb-3`) : violet pour les indices, jaune pour l'explication du round, vert pour le succès, rouge pour l'erreur.

### 3.6 Boutons — recettes exactes

```
Primaire   : px-3 py-1.5 bg-indigo-600 text-white rounded text-xs sm:text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
Primaire L : px-4 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed
Succès     : bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm sm:text-base font-medium transition-colors
Danger     : bg-red-600 hover:bg-red-500 text-white rounded-lg / rounded text-sm
Annuler    : px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300
Contour    : px-5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium
Icône seule: p-2 rounded-lg hover:bg-white/10 transition-colors   (sur fond coloré)
```

`disabled:opacity-50` apparaît 18 fois — **c'est la convention unique de désactivation** (parfois complétée par `disabled:cursor-not-allowed`). Aucun bouton n'utilise `disabled:bg-gray-300`.

**Boutons « verre » sur fond dégradé** (connexion, en-tête) :
```
px-3 sm:px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition-colors text-white
```

### 3.7 Champs de saisie

**Sur fond dégradé (connexion / inscription)** :
```
w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm sm:text-base
```

**Sur fond clair (tableau de bord)** : le motif dominant est `border border-gray-300 rounded … focus:outline-none focus:ring-2 focus:ring-indigo-400`. `focus:ring-2` ×10 et `focus:outline-none` ×10 : **le focus est toujours un anneau, jamais une bordure colorée**, et l'anneau suit la teinte du contexte (violet sur fond dégradé, indigo sur fond clair).

### 3.8 Listes et tableaux

Le dépôt utilise **très peu** de vraies balises `<table>` : la liste principale de `ParticipantImport` seulement, avec un masquage progressif des colonnes — `hidden sm:table-cell`, `hidden md:table-cell`, `hidden lg:table-cell` (×22 / ×8 / ×8), en-têtes `px-1 sm:px-2 py-1 text-left`.

Partout ailleurs, ce sont des **listes en `div`** :
```
<ul className="divide-y divide-gray-100">
  <li className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group">
```
Lignes sombres : `border-b border-gray-700/50 hover:bg-gray-700/50`, ou `hover:bg-white/5 transition-colors` sur écran géant. En-têtes de section de liste : `px-5 py-3 border-b border-gray-200 bg-gray-50` + `text-sm font-semibold text-gray-700`.

### 3.9 Badges / pastilles de statut

Formule générale : `px-2 py-0.5 rounded text-xs font-medium` + une paire de couleurs. **Deux systèmes coexistent, à respecter selon le fond** :

- **Sur fond clair** (pastilles douces, teinte 100 + texte 800) — `CompetitionListPage.jsx:70-75`, `DashboardCompetitionsPage.jsx:74-79` :
  ```js
  { DRAFT: 'bg-yellow-100 text-yellow-800',
    PUBLISHED: 'bg-blue-100 text-blue-800',
    RUNNING: 'bg-green-100 text-green-800',
    FINISHED: 'bg-gray-100 text-gray-800' }
  ```
- **Sur fond sombre / écran géant** (pastilles pleines, teinte 500) — `RankingView.jsx:27-33`, `RoundRankingView.jsx:36-41`, `DisplayStageRankingView.jsx:44-48`, `CompetitionJoinPage.jsx:98-103` :
  ```js
  { PENDING/NOT_STARTED/WAITING: 'bg-gray-500',
    IN_PROGRESS/RUNNING: 'bg-green-500',
    PAUSED: 'bg-yellow-500',
    FINISHED: 'bg-red-500' (RankingView) | 'bg-blue-500' (les autres) }
  ```
  ⚠️ **Incohérence réelle du dépôt** : `FINISHED` est rouge dans `RankingView` et bleu dans `RoundRankingView`/`DisplayStageRankingView`. Dans le projet cible, **choisir une seule valeur** (bleu recommandé, c'est la plus fréquente) et l'appliquer partout.
- Pastilles sombres de l'en-tête juge (`JudgeControlPage.jsx:135-14`) : teintes 600 pleines — `bg-yellow-600` (prêt à démarrer), `bg-green-600` (en cours), `bg-orange-600` (en pause), `bg-gray-600` (autre).
- Badges de difficulté (`SudokuGrid.jsx:102-106`) : `EASY: bg-green-600 text-green-100`, `MEDIUM: bg-yellow-600 text-yellow-100`, `HARD: bg-red-600 text-red-100`, repli `bg-gray-600 text-gray-100`, en `px-2 py-1 rounded text-xs font-bold`.
- Petits badges de lettre/état en contexte sombre : `bg-purple-700/50 text-purple-300 px-2 py-0.5 rounded text-xs`, `bg-green-700/50 text-green-300 …`, `bg-green-800/50 text-green-300 …`.

### 3.10 Typographie

- **Échelle mobile-first systématique** : presque chaque taille est doublée — `text-xs sm:text-sm` (×144), `text-sm sm:text-base`, `text-base sm:text-lg`, `text-lg sm:text-xl`, `text-xl sm:text-2xl`, `text-2xl sm:text-3xl`, jusqu'à `text-4xl sm:text-6xl` sur les écrans géants. **C'est la signature typographique du dépôt** : la valeur mobile est toujours la plus petite des deux.
- Poids : `font-medium` pour le corps, `font-semibold` pour les titres de section, `font-bold` pour les titres de page et les nombres. Jamais `font-black`, jamais `font-light`.
- Nombres : **`tabular-nums` (×11)** sur tout ce qui est un score, un chrono ou un classement ; `font-mono` (×10) pour les codes et les comptes à rebours.
- Titres de section en capitales espacées : `text-xs sm:text-sm uppercase tracking-wide text-gray-500` (`TransitionScreen`, `WaitingScreen`) ; le titre de l'en-tête géant utilise `tracking-tight`.
- Titres récurrents exacts : `text-sm font-semibold text-gray-300 mb-3` (×15, panels sombres), `text-xl font-bold text-gray-900` (×4), `text-2xl sm:text-3xl font-bold` (×4), `text-base sm:text-lg font-semibold mb-3 sm:mb-4` (×5).
- Troncature : `truncate` (×17) + `min-w-0` (×15) + `break-words` sur les noms longs.

### 3.11 Espacements et conteneurs

- Page : `max-w-7xl mx-auto` (×12) dans le layout, `max-w-6xl mx-auto` pour la console juge, `max-w-5xl mx-auto` pour le détail d'une compétition, `max-w-4xl` pour une carte de diffusion, `max-w-md` / `max-w-lg` pour les modales.
- Padding de page : `p-4 sm:p-6` (le couple standard). Padding interne de carte : `p-4 sm:p-6` ou `p-6`.
- Empilement : `space-y-4` (×14), `space-y-3`, `space-y-6` entre sections, `space-y-1` dans la navigation, `space-y-1.5` dans une liste de boutons.
- Gouttières flex : `gap-2` (×69) puis `gap-3`, `gap-4`, `gap-1` ; version responsive `gap-2 sm:gap-3`, `gap-3 sm:gap-4`, `gap-3 sm:gap-6`.
- Marges verticales de texte : `mb-3` (×47), `mb-4`, `mb-2`, `mb-1`, `mt-1`, `mt-2`, `mt-3`.

### 3.12 Responsive

**Un seul breakpoint est vraiment utilisé : `sm:`** (×144 sur `text-sm` seul). Viennent ensuite `lg:` pour la bascule de layout (sidebar, colonnes) et `md:` pour la taille des cellules de grille et quelques colonnes de tableau. Aucun `xl:` ni `2xl:`.

Motif de bascule standard : `flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3`.
Sidebar : `hidden lg:block absolute lg:static inset-y-0 left-0 z-30 w-56 shrink-0` + tiroir mobile avec voile `lg:hidden absolute inset-0 bg-black/30 z-20`.
Grille de statistiques : `grid grid-cols-2 lg:grid-cols-4 gap-4`.

### 3.13 Transitions

`transition-colors` ×42 est **la** transition du dépôt — sur quasiment tout élément interactif. Suivent `transition-all` ×4 (cases du tableau d'indices, cartes statistiques avec `scale-[1.01]`/`scale-[1.02]`), `transition-opacity` ×2, `transition-shadow` ×1, et `duration-1000` une seule fois (la barre de progression du chrono, en `transition-all`). Aucune durée explicite ailleurs : on laisse le 150 ms par défaut de Tailwind.

---

## 4. Les trois « ambiances » — la règle structurelle la plus importante

Le dépôt n'a pas de thème global : il a **trois traitements visuels distincts**, choisis selon le rôle de l'écran. Un agent qui applique ce rapport doit d'abord classer chaque écran du projet cible dans l'une de ces trois catégories, puis appliquer le traitement correspondant.

### A. Pages publiques d'authentification — « verre sur dégradé »
`LoginPage`, `RegisterPage`, `CompetitionJoinPage`.
```
Fond    : min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4
Carte   : bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-white/20
Titre   : text-2xl sm:text-3xl font-bold text-white text-center mb-2
Sous-t. : text-purple-200 text-center mb-6 sm:mb-8 text-sm sm:text-base
Champs  : bg-white/10 border-white/20 text-white placeholder-purple-300 focus:ring-purple-400
Bouton  : w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors
Erreur  : text-red-300 text-xs sm:text-sm text-center
Lien    : text-purple-300 hover:text-white text-xs sm:text-sm transition-colors
```
**`backdrop-blur-lg` n'est utilisé qu'ici** — c'est ce qui donne l'effet « verre dépoli ».

### B. Back-office / administration — « clair, sobre, cartes blanches »
`DashboardLayout` + toutes les pages `Dashboard*`, `JudgeControlPage`, `CompetitionListPage`, `CompetitionDetailPage`, `ErrorPage`.
```
Coquille : h-screen flex flex-col bg-gray-50
En-tête  : bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 sm:px-6 py-4 shadow-lg shrink-0 z-20
           titre text-lg sm:text-xl font-bold + sous-titre text-purple-200 text-xs hidden sm:block
Sidebar  : w-56 bg-indigo-800 text-white p-4 overflow-y-auto, nav en space-y-1
Lien nav : flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
           actif   → bg-indigo-600 text-white
           inactif → text-indigo-100 hover:bg-indigo-500/30
Contenu  : flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 > div.max-w-7xl.mx-auto
Cartes   : bg-white rounded-xl shadow p-4 sm:p-6
Boutons  : indigo-600 / gray-200 / red-600 (voir 3.6)
Modales  : voile fixed inset-0 bg-black/40 (Modal) ou bg-black bg-opacity-50 (ConfirmDialog)
           + z-50 p-4 flex items-center justify-center
           panneau bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200
           titre text-lg font-semibold text-gray-900 mb-4
Toasts   : fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm
           succès bg-green-50 text-green-700 border-green-200
           erreur bg-red-50 text-red-700 border-red-200
           info   bg-gray-100 text-gray-700 border-gray-200
Cartes stats : bg-white border-gray-200 hover:border-gray-300, actif bg-gray-50 border-gray-500
           + hover:shadow-sm hover:scale-[1.01] / actif shadow-md scale-[1.02]
           chiffre text-3xl sm:text-4xl font-bold tabular-nums, libellé text-sm font-medium mt-2 opacity-80
           déclinaisons colorées : green-50/green-200/green-700, amber-50/amber-200/amber-700, purple-50/purple-200/purple-700
```
Note utile : `Modal.jsx` porte un commentaire qui explicite la règle — les pages du tableau de bord sont passées à un thème clair (`bg-gray-50` + cartes blanches), donc les modales du tableau de bord sont blanches, tandis que `ConfirmDialog` (pages publiques) l'est aussi. **Le dépôt ne mélange jamais une carte blanche dans un écran sombre.**

### C. Jeu et écrans géants — « sombre, grand, lisible du fond de la salle »
`PlayerGamePage`, `AdminDashboardPage`, `DisplayPage`, `RankingView`, `RoundRankingView`, `DisplayStageRankingView`, `DisplayFinalRankingView`, `BroadcastView`, `Round1/2/3View`, `WaitingScreen`, `TransitionScreen`, `StageFinishedScreen`.
```
Fond page de jeu : min-h-screen bg-gray-900 text-white
Fond écran géant : min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white flex flex-col
Barre supérieure : bg-gray-800 px-3 sm:px-6 py-2 sm:py-3
En-tête géant    : border-b border-white/10 px-6 py-4, contenu max-w-7xl mx-auto
Pied géant       : border-t border-white/10 px-6 py-3 text-center text-gray-600 text-xs
Panneaux         : bg-gray-800 rounded-lg p-4, titre text-sm font-semibold text-gray-300 mb-3
Cartes           : bg-white/5 border border-white/10 rounded-xl overflow-hidden + divide-y divide-white/5
Lignes           : px-6 py-6 (podium) / py-3 (reste) + hover:bg-white/5 transition-colors
Scores           : tabular-nums font-bold text-4xl sm:text-5xl (podium) / text-3xl
Médailles        : w-16 h-16 rounded-full text-3xl font-bold shadow-lg
                   or bg-yellow-500 text-gray-900 · argent bg-gray-300 text-gray-900 · bronze bg-amber-700 text-white
                   rangs 4+ : text-gray-400 text-3xl font-semibold pl-3
État vide        : text-center text-gray-500 py-20 + emoji text-6xl mb-4 (🏆 📊 📋) + text-2xl font-semibold text-gray-300
Bannières msg    : animate-slide-in mb-4 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-center
                   succès bg-green-900/50 text-green-300 · alerte bg-yellow-900/50 text-yellow-300
                   erreur bg-red-900/50 text-red-300 · info bg-blue-900/50 text-blue-300
Boutons sur gris : bg-gray-700 hover:bg-gray-600 text-white rounded-lg (numéros de la grille)
```

La grille de sudoku elle-même (`SudokuGrid.jsx`) mérite d'être relevée car c'est le seul « composant dessiné » du dépôt :
```
Conteneur : inline-block border-2 border-gray-600 bg-gray-700 overflow-x-auto max-w-full
Cellule   : w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 flex items-center justify-center
            text-base md:text-lg font-medium border border-gray-600 transition-colors cursor-pointer
Blocs 3×3 : border-b-2 border-b-gray-400 / border-r-2 border-r-gray-400 (calculés par ri % 3 === 2)
États     : donnée initiale bg-gray-800 text-white cursor-default
            sélectionnée    bg-indigo-600 text-white
            remplie validée bg-green-900/40 text-green-300
            proposition     bg-yellow-900/20 text-yellow-300
            libre           bg-gray-700 text-gray-200 hover:bg-gray-600
Proposition : surcouche absolute inset-0 border-2 border-dashed border-yellow-500/60 + valeur text-yellow-400 text-xs font-bold opacity-70
Mini-boutons accepter/refuser : w-4 h-4 rounded-full text-[8px] leading-none, bg-green-600 hover:bg-green-500 / bg-red-600 hover:bg-red-500, positionnés absolute -top-1 -right-1 z-10
Pastilles de présence joueur : w-2 h-2 rounded-full, palette tournante
            bg-blue-500, bg-purple-500, bg-pink-500, bg-orange-500, bg-cyan-500, bg-lime-500, bg-rose-500, bg-amber-500
Pavé numérique : w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 bg-gray-700 hover:bg-indigo-600 text-white rounded-lg font-bold transition-colors
                 (variante round 1 : bg-indigo-700 hover:bg-indigo-600), bouton effacer bg-red-800 hover:bg-red-700
Légende : mt-3 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-500
```
⚠️ `sm:w-13` / `md:h-13` **n'existent pas** dans l'échelle Tailwind par défaut (pas de `13`) — ces classes sont silencieusement ignorées. À ne pas recopier : utiliser `w-12`/`w-14`.

Le seul endroit où des couleurs sont posées en **`style` inline** et non en classes est `TimerDisplay.jsx`, qui calcule une couleur selon le pourcentage restant :
```js
const color = percent > 50 ? '#4caf50' : percent > 20 ? '#ff9800' : '#f44336';
// barre : <div className="relative w-full h-6 sm:h-8 bg-gray-200 rounded overflow-hidden">
//         <div className="absolute top-0 left-0 h-full transition-all duration-1000" style={{ width: `${percent}%`, backgroundColor: color }} />
//         <span className="relative z-10 flex items-center justify-center h-full font-bold text-xs sm:text-sm"
//               style={{ color: percent > 50 ? '#fff' : '#333' }}>
```
Ces trois hexadécimaux sont du Material Design, **pas** du Tailwind — la seule entorse du dépôt à sa propre palette. À remplacer par `green-500` / `amber-500` / `red-500` dans le projet cible pour rester cohérent.

---

## 5. Conventions transverses à respecter

1. **Icônes** : aucune librairie. SVG inline écrits à la main, toujours `fill="none" stroke="currentColor" viewBox="0 0 24 24"` avec `strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}` et une taille `w-5 h-5` / `w-20 h-20 text-gray-400`. Les pictogrammes simples sont des **entités HTML** (`&#10003;` ✓, `&#10007;` ✗, `&#128274;` 🔒) ou des **emoji bruts** (🏆 📊 📋) — jamais une image.
2. **`currentColor`** : les SVG et les états héritent toujours de la couleur du texte parent, ce qui permet de ne pas dupliquer de classes de couleur.
3. **Z-index figés** : `z-20` (en-tête), `z-30` (sidebar + voile mobile), `z-50` (modales, toasts). Rien au-delà.
4. **Accessibilité présente mais minimale** : `role="dialog"` + `aria-modal="true"` + `aria-labelledby` sur les modales, `role="alert"` sur les toasts, `aria-label` sur le bouton de bascule de la sidebar. À conserver tel quel, sans en ajouter davantage (cela toucherait au comportement).
5. **États vides et états de chargement toujours explicites** : jamais un écran blanc. Chargement = `flex items-center justify-center h-screen p-4 text-center text-sm sm:text-base` ou le spinner `animate-spin rounded-full border-b-2 border-blue-600`. Erreur = carte `bg-red-50 border border-red-200 rounded-xl p-6 text-center` avec `text-red-800 text-sm font-medium` puis le détail en `text-red-600 text-xs mt-2`.
6. **Un seul style par rôle** : la règle non écrite du dépôt est qu'un même rôle visuel a toujours exactement les mêmes classes d'un fichier à l'autre (les cartes `bg-white rounded-xl shadow p-4 sm:p-6` sont littéralement identiques dans 6 fichiers). Les commentaires du code source insistent dessus : *« same language as RoundRankingView and RankingView so the room does not see a style break when the judge switches modes »*. **Ne pas introduire de variante locale.**

---

## 6. Marche à suivre recommandée pour l'agent qui applique ceci

1. **Lire cette section avant d'écrire quoi que ce soit.** Ne pas commencer par recolorier au hasard.
2. Vérifier si le projet cible a Tailwind. Sinon : créer une feuille de style unique contenant les 5 keyframes de la section 2 + un jeu de variables CSS reprenant les tokens de la section 3, et appliquer les équivalents en CSS classique. **Ne pas ajouter Tailwind à un projet qui ne l'a pas** sans accord explicite — c'est un changement d'architecture, pas de style.
3. Classer chaque écran du projet cible dans l'ambiance **A**, **B** ou **C** de la section 4, et noter ce classement avant de modifier quoi que ce soit.
4. Traiter **un écran à la fois**, dans cet ordre : coquille/fond → cartes et panneaux → boutons → champs → badges → typographie → animations en dernier.
5. Pour chaque écran, ne changer **que** les attributs de classe/style. Interdiction de renommer un composant, de déplacer un élément dans l'arbre, de modifier une condition d'affichage, un `key`, un gestionnaire d'événement, un texte, une route ou un appel API.
6. Les animations ne doivent être branchées que sur des changements d'état **déjà existants** dans le projet cible. Si aucun état équivalent n'existe, on n'ajoute pas l'animation.
7. Après chaque écran : vérifier que rien n'a changé fonctionnellement (mêmes textes, mêmes données affichées, mêmes interactions) avant de passer au suivant.
8. Signaler explicitement, sans les corriger de sa propre initiative : toute incohérence du présent rapport avec le projet cible, et l'incohérence connue sur `FINISHED` (section 3.9).

---

## 7. Sources

Dépôt public `https://github.com/tianyim568-cyber/sudoku_arena`, branche `main`. 49 fichiers téléchargés et analysés (42 composants/pages porteurs de style + 7 pages de tableau de bord et fichiers d'entrée), inventaire complet de 105 fichiers sous `client/src/**` vérifié non tronqué. Tous les comptages cités (fréquences de classes, occurrences de dégradés) proviennent d'une extraction regex sur les attributs `className` réels de ces fichiers, pas d'une estimation. Les citations de code sont verbatim.
