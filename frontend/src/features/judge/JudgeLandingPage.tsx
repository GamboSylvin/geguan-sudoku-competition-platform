import { useEffect, useState } from "react";
import { useLocale } from "../../i18n/locale-context";
import { clearSession, loadSession } from "../auth/session";
import { fetchJudgeMe, type JudgeMeView } from "./judgeApi";
import { useNavigate } from "react-router-dom";

/**
 * The judge's minimal landing (Unit 06, spec Implementation Details 6): after login,
 * the judge sees a confirmation of their own assignment — which competition, which
 * participant-number range — or a "not yet assigned" note. The full supervision
 * dashboard (status view, single-student restart) is Unit 10, not this unit.
 *
 * Visuel : ambiance B « clair, sobre, cartes blanches » (BLD-054, révise U-66).
 * Aucun élément ajouté à l'arbre : la carte repose sur les `li` qui existaient déjà.
 */
export function JudgeLandingPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = loadSession();

  const [me, setMe] = useState<JudgeMeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJudgeMe()
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch(() => {
        if (!cancelled) setError(t("judge.genericError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onLogout(): Promise<void> {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <h1 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">{t("judge.landingTitle")}</h1>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      {!me && !error && <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>}

      {me && me.assignments.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-xs text-gray-500 shadow sm:text-sm">{t("judge.notAssigned")}</p>
      )}

      {me && me.assignments.length > 0 && (
        <ul className="flex w-full max-w-md flex-col gap-2">
          {me.assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="rounded-xl border border-gray-200 bg-white p-4 text-xs shadow transition-colors hover:border-gray-300 hover:shadow-sm sm:text-sm"
            >
              <p className="font-medium text-gray-900">
                {t("judge.assignedTo")} {assignment.competitionName}
              </p>
              <p className="mt-1 text-xs text-gray-700 sm:text-sm">
                {t("judge.range")}
                {assignment.fromParticipantNumber} – #{assignment.toParticipantNumber}
              </p>
            </li>
          ))}
        </ul>
      )}

      {session && (
        <p className="text-xs text-gray-400">
          {t("auth.landing.signedInAs")} {session.accountId}
        </p>
      )}

      <button
        type="button"
        className="rounded border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
        onClick={onLogout}
      >
        {t("auth.logout")}
      </button>
    </main>
  );
}
