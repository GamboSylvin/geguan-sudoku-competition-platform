import { useEffect, useState } from "react";
import { useLocale } from "../../i18n/locale-context";
import { clearSession, loadSession } from "../auth/session";
import { fetchJudgeMe, type JudgeMeView } from "./judgeApi";
import { Link, useNavigate } from "react-router-dom";

/**
 * The judge's minimal landing (Unit 06, spec Implementation Details 6): after login,
 * the judge sees a confirmation of their own assignment — which competition, which
 * participant-number range — or a "not yet assigned" note. The full supervision
 * dashboard (status view, single-student restart) is Unit 10, not this unit.
 *
 * Visual: mood B, "light, sober, white cards" (BLD-054, revising U-66).
 * **Redesigned 2026-10-19** (manual test: "no color, no interface"): the original pass
 * left this screen with zero color accent anywhere — every line was some shade of gray,
 * so next to the gradient login screen it read as broken rather than merely sober. An
 * indigo left border and icon on the assignment card, and the controller-title's own
 * indigo badge recipe (already used on `CompetitionSetupPage`), give it one real accent
 * without leaving ambiance B. The "signed in as" line used to print the raw account
 * UUID — now the judge's own name, which `/api/judges/me` carries for exactly this.
 *
 * **Scoped 2026-10-21 (F1)**: the list here is whatever `/api/judges/me` returns, and
 * that is now restricted server-side to the competition the entry link named. A judge
 * assigned to five competitions therefore sees one card, not five — which is what the
 * link is for (ARCH-030). The screen itself filters nothing, because the narrowing has
 * to happen where the authority is, not where the markup is.
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
      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
        {t("judge.landingBadge")}
      </span>
      <h1 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">{t("judge.landingTitle")}</h1>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      {!me && !error && <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>}

      {me && me.assignments.length === 0 && (
        <p className="rounded-xl border-l-4 border-amber-400 bg-white p-4 text-xs text-gray-600 shadow sm:text-sm">
          {t("judge.notAssigned")}
        </p>
      )}

      {me && me.assignments.length > 0 && (
        <>
          <ul className="flex w-full max-w-md flex-col gap-2">
            {me.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded-xl border-l-4 border-indigo-500 bg-white p-4 text-xs shadow transition-colors hover:shadow-md sm:text-sm"
              >
                <p className="font-medium text-gray-900">
                  {t("judge.assignedTo")} <span className="text-indigo-700">{assignment.competitionName}</span>
                </p>
                <p className="mt-1 tabular-nums text-xs text-gray-700 sm:text-sm">
                  {t("judge.range")}
                  {assignment.fromParticipantNumber} – #{assignment.toParticipantNumber}
                </p>
              </li>
            ))}
          </ul>
          {/*
            Hole B (report 2026-10-19): this screen listed the assignments and stopped
            there — Unit 10's supervision dashboard (`/judge/dashboard`) was built,
            routed and tested, but reachable only by typing its URL, so the judge saw
            "no interface to do anything with". One button, not one per assignment: the
            dashboard supervises the judge's own range and is not scoped by a
            competition id in the route — since F1 the scope travels with the session
            token instead, so the dashboard needs no competition argument either.
          */}
          <Link
            to="/judge/dashboard"
            className="w-full max-w-md rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow transition-colors hover:bg-indigo-700"
          >
            {t("judge.openDashboard")}
          </Link>
        </>
      )}

      {(me?.name ?? session) && (
        <p className="text-xs text-gray-400">
          {t("auth.landing.signedInAs")} {me?.name ?? session?.accountId}
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
