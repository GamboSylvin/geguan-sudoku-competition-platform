import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import {
  fetchCompetitionCategories,
  fetchSchoolRanking,
  SchoolRankingApiError,
  type SchoolCategoryRankingView,
  type SchoolRankingCategoryView,
} from "./schoolRankingApi";

/**
 * The controller's school-leaderboard screen (Unit 15, spec 15 frontend).
 *
 * One leaderboard per category (EVT-002: two categories are never mixed in one
 * ranking), each row showing the rank, the school, the exact total and — because
 * the tie-break is the only thing that can make two totals equal — a note when the
 * summed submission time actually decided the order.
 *
 * The screen reads only. It never computes a rank or a total, and it never turns
 * `schoolTotal` into a JS number: the server sends the exact decimal as a string
 * (SCR-013) and re-parsing it would reintroduce the float imprecision the backend
 * went out of its way to avoid. An incomplete category is shown as provisional
 * rather than as an error, because that is what the server returns.
 */

/** The summed submission time, as `m:ss`, the way the other screens show it. */
function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SchoolRankingPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [competitionName, setCompetitionName] = useState<string | null>(null);
  const [categories, setCategories] = useState<SchoolRankingCategoryView[]>([]);
  const [rankings, setRankings] = useState<Record<string, SchoolCategoryRankingView>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const competitionId = id ?? null;

  /**
   * Turn a rejection into a localizable message. Every code has an entry in both
   * catalogues with dots turned into underscores; an unexpected code falls back to
   * the generic message and still prints the raw code, so nothing is ever silent
   * (the Unit 11/12 pattern).
   */
  const messageFor = useCallback(
    (e: unknown): string => {
      if (e instanceof SchoolRankingApiError) {
        const known = `schoolRanking.errors.${e.code.replace(/\./g, "_")}`;
        const translated = t(known);
        if (translated !== known) return translated;
        return `${t("schoolRanking.genericError")} (${e.code})`;
      }
      return t("schoolRanking.genericError");
    },
    [t],
  );

  const handleUnauthorized = useCallback(
    (e: unknown): boolean => {
      if (e instanceof SchoolRankingApiError && e.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const refresh = useCallback(async () => {
    if (!competitionId) return;
    try {
      const competition = await fetchCompetitionCategories(competitionId);
      setCompetitionName(competition.name);
      setCategories(competition.categories);
      // One read per category, because the endpoint is per category (EVT-002). A
      // single category's rejection must not blank the others, so each is caught.
      const entries = await Promise.all(
        competition.categories.map(async (category) => {
          try {
            const ranking = await fetchSchoolRanking(competitionId, category.id);
            return [category.id, ranking] as const;
          } catch (e) {
            if (handleUnauthorized(e)) throw e;
            return [category.id, null] as const;
          }
        }),
      );
      const next: Record<string, SchoolCategoryRankingView> = {};
      for (const [categoryId, ranking] of entries) {
        if (ranking) next[categoryId] = ranking;
      }
      setRankings(next);
      setLoadError(null);
    } catch (e) {
      if (handleUnauthorized(e)) return;
      setCategories([]);
      setRankings({});
      setLoadError(messageFor(e));
    }
  }, [competitionId, handleUnauthorized, messageFor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6 text-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {competitionName ?? t("schoolRanking.title")}
          </h1>
          <p className="text-sm text-slate-600">{t("schoolRanking.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/controller/competitions/${encodeURIComponent(competitionId ?? "")}/results`}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            {t("schoolRanking.backToResults")}
          </Link>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            onClick={() => void refresh()}
          >
            {t("schoolRanking.refresh")}
          </button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}

      {!loadError && categories.length === 0 && (
        <p className="text-sm text-slate-600">{t("common.loading")}</p>
      )}

      {categories.map((category) => {
        const ranking = rankings[category.id];
        return (
          <section
            key={category.id}
            className="rounded-md border border-slate-200 bg-white p-4"
          >
            <h2 className="text-lg font-semibold">
              {category.code} — {category.name}
            </h2>
            {ranking && (
              <p className="mb-2 text-xs text-slate-500">
                {ranking.isFinal
                  ? t("schoolRanking.final")
                  : t("schoolRanking.provisional")}
                {" · "}
                {t("schoolRanking.coefficient")}: {ranking.schoolCoefficient}
              </p>
            )}

            {!ranking || ranking.rows.length === 0 ? (
              <p className="text-sm text-slate-500">{t("schoolRanking.empty")}</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">{t("schoolRanking.colRank")}</th>
                    <th className="px-2 py-1 text-left font-medium">{t("schoolRanking.colSchool")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("schoolRanking.colTotal")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("schoolRanking.colIndividual")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("schoolRanking.colTeam1")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("schoolRanking.colTeam2")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("schoolRanking.colTime")}</th>
                    <th className="px-2 py-1 text-right font-medium">{t("schoolRanking.colPlayers")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranking.rows.map((row, index) => {
                    // The tie note: shown only where the total is genuinely equal to
                    // the row above it, so it marks the rows SCR-020 had to separate
                    // (or did not, when they also share a rank).
                    const above = index > 0 ? ranking.rows[index - 1] : undefined;
                    const tiedOnTotal = above !== undefined && above.schoolTotal === row.schoolTotal;
                    return (
                      <tr key={row.schoolId}>
                        <td className="px-2 py-1">{row.rank}</td>
                        <td className="px-2 py-1">
                          {row.schoolName}
                          {!row.isComplete && (
                            <span className="ml-2 text-xs text-amber-700">
                              {t("schoolRanking.incompleteRow")}
                            </span>
                          )}
                          {tiedOnTotal && (
                            <span className="ml-2 text-xs text-slate-500">
                              {row.rank === above?.rank
                                ? t("schoolRanking.tieShared")
                                : t("schoolRanking.tieNote")}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">{row.schoolTotal}</td>
                        <td className="px-2 py-1 text-right">{row.individualSum}</td>
                        <td className="px-2 py-1 text-right">{row.teamRound1Score}</td>
                        <td className="px-2 py-1 text-right">{row.teamRound2Score}</td>
                        <td className="px-2 py-1 text-right">
                          {formatSeconds(row.completionTimeSeconds)}
                        </td>
                        <td className="px-2 py-1 text-right">{row.countedPlayers}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}
