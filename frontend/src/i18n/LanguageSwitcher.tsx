import { useLocation } from "react-router-dom";
import { useLocale } from "./locale-context";
import { LOCALES, type Locale } from "./index";

/**
 * The language switcher (BLD-053). Until now the platform was bilingual only on
 * paper: the catalogues existed, `setLocale` existed, but nothing on screen let
 * anyone change the language.
 *
 * Two placement constraints, both deliberate:
 * - **Fixed position, bottom-left.** There is no shared header in this application,
 *   so the control is rendered once, near the root, and floats above every screen.
 *   The bottom-left corner is the least-used of the four: this project's existing
 *   screens' main actions sit at the top or centered.
 * - **Absent from the gameplay and big-screen routes.** A player on a tablet who
 *   tapped this control mid-round would see all their text flip language in the
 *   middle of a grid — nothing would break, but it would be a bad surprise. The big
 *   screen, for its part, is a shared passive display: its language should not be
 *   within reach of the first passer-by.
 *
 * Persisting the choice is handled by `readStoredLocale` / `writeStoredLocale` below,
 * used by `App.tsx` to initialize the provider.
 *
 * Visuel (BLD-054) : ce contrôle flotte au-dessus de **tous** les écrans, il n'appartient
 * donc à aucune ambiance en particulier. Il est traité comme une carte de l'ambiance B
 * (blanc, `shadow-lg`, bouton actif indigo) parce qu'il n'est présent que sur les écrans
 * clairs — il disparaît justement des routes joueur et grand écran, qui sont les seules
 * en ambiance C sombre. Un seul style par rôle visuel (§6/6) : le bouton actif reprend la
 * recette indigo des boutons primaires de l'ambiance B.
 */

const STORAGE_KEY = "sudoku-arena.locale";

/** Labels are each in their own language: "English" is recognized written in English. */
const LABELS: Record<Locale, string> = { en: "English", zh: "中文" };

/**
 * The route prefixes where the switcher must NOT appear: the player's gameplay and
 * the big screen. See the file header for why.
 */
const HIDDEN_ROUTE_PREFIXES = ["/player", "/big-screen"];

/**
 * The saved locale, if it's valid. An inaccessible `localStorage` (private mode,
 * storage disabled) must not stop the app from starting: it simply falls back to the
 * default locale.
 */
export function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored !== null && (LOCALES as readonly string[]).includes(stored)
      ? (stored as Locale)
      : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisting is not a blocking error: the language stays active for this
    // session, only a reload will forget it.
  }
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const { pathname } = useLocation();

  // On gameplay and big-screen routes, this simply renders nothing: the control isn't
  // "disabled" there, it isn't present.
  if (HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <div
      className="fixed bottom-3 left-3 z-50 flex gap-1 rounded-lg border border-gray-300 bg-white p-1 shadow-lg"
      role="group"
      aria-label="Language / 语言"
    >
      {LOCALES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          // `aria-pressed` rather than a plain button: the active state must be
          // readable without relying on color alone.
          aria-pressed={candidate === locale}
          onClick={() => {
            writeStoredLocale(candidate);
            setLocale(candidate);
          }}
          className={
            candidate === locale
              ? "rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors"
              : "rounded px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
          }
        >
          {LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}
