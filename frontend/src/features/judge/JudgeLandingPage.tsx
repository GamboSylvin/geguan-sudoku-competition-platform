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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-slate-800">
      <h1 className="text-2xl font-semibold">{t("judge.landingTitle")}</h1>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!me && !error && <p className="text-sm text-slate-600">{t("common.loading")}</p>}

      {me && me.assignments.length === 0 && (
        <p className="text-sm text-slate-600">{t("judge.notAssigned")}</p>
      )}

      {me && me.assignments.length > 0 && (
        <ul className="flex w-full max-w-md flex-col gap-2">
          {me.assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="rounded-md border border-slate-200 bg-white p-3 text-sm"
            >
              <p className="font-medium">
                {t("judge.assignedTo")} {assignment.competitionName}
              </p>
              <p className="text-slate-700">
                {t("judge.range")}
                {assignment.fromParticipantNumber} – #{assignment.toParticipantNumber}
              </p>
            </li>
          ))}
        </ul>
      )}

      {session && (
        <p className="text-xs text-slate-400">
          {t("auth.landing.signedInAs")} {session.accountId}
        </p>
      )}

      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={onLogout}
      >
        {t("auth.logout")}
      </button>
    </main>
  );
}
