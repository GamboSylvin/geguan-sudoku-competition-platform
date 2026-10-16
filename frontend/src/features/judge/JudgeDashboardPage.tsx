import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { StudentsSupervisionPanel } from "./StudentsSupervisionPanel";

/**
 * The judge's supervision dashboard (Unit 10). The table, its polling and the
 * restart confirmation live in `StudentsSupervisionPanel`, which Unit 11 reuses on
 * the controller's live-command dashboard (judge-equivalent student-status access,
 * spec Detail 6). This page adds only what is the judge's own: the page header and
 * the logout action.
 *
 * Visuel : ambiance B « clair, sobre, cartes blanches » (BLD-054, révise U-66).
 * §4.B du rapport nomme explicitement cet écran (« JudgeControlPage »), donc il
 * n'y a pas de doute sur l'ambiance à appliquer ici.
 */
export function JudgeDashboardPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 p-4 text-gray-900 sm:p-6">
      {/* Bandeau d'en-tête de l'ambiance B : dégradé indigo→violet (§3.2/2), avec le
          bouton « verre » de §3.6. Ce div existait déjà ; rien n'est ajouté à l'arbre. */}
      <div className="mb-4 -mx-4 -mt-4 flex justify-end bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-3 text-white shadow-lg sm:-mx-6 sm:-mt-6 sm:px-6">
        <button
          type="button"
          className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/20 sm:text-sm"
          onClick={onLogout}
        >
          {t("auth.logout")}
        </button>
      </div>
      <StudentsSupervisionPanel showHeader />
    </main>
  );
}
