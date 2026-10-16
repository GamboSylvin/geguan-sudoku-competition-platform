import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { JudgeRangeAssignmentPanel } from "../judge/JudgeRangeAssignmentPanel";
import { ParticipantPanel } from "../participant/ParticipantPanel";
import { QuestionPanel } from "../question/QuestionPanel";
import {
  createCompetition,
  CompetitionApiError,
  fetchCompetition,
  publishCompetition,
  unmetConditionsFrom,
  updateCompetition,
  type CategoryInput,
  type CompetitionView,
  type PublishResultView,
  type ReadinessCondition,
  type RoundView,
  type StageView,
} from "./competitionApi";
import { SchoolPanel } from "./SchoolPanel";

/**
 * The competition-creation and publish screen (Unit 03, frontend `competition`
 * feature). Mood B, "light, sober, white cards" (BLD-054): `bg-gray-50` shell,
 * `bg-white rounded-xl shadow p-4 sm:p-6` cards, indigo-600 primary buttons,
 * `border-gray-300` fields + indigo ring on focus. It shows the venue
 * Wi-Fi advisory note (U-56, UI copy only), the auto-generated structure with its
 * editable round durations, and the publish action with its readiness-failure /
 * success display.
 *
 * Unit 15 gives it a second mode: `/controller/competitions/:id/setup` opens an
 * **existing** competition instead of the create form. That is where a copy lands,
 * because the copy is a fresh `CREATED` competition that still has to go through
 * this screen's publish flow — the participant import Unit 04 built and the question
 * import Unit 05 built, both of which a copy starts from scratch.
 */

function stageRoundLabel(
  t: (key: string) => string,
  stage: StageView,
  round: RoundView,
): string {
  return t(`competition.duration.${stage.type}${round.sequence}`);
}

export function CompetitionSetupPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<CategoryInput[]>([
    { code: "", name: "" },
  ]);

  const [competition, setCompetition] = useState<CompetitionView | null>(null);
  const [published, setPublished] = useState<PublishResultView | null>(null);
  const [unmet, setUnmet] = useState<ReadinessCondition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [durationEdits, setDurationEdits] = useState<Record<string, number>>({});
  const [savedRound, setSavedRound] = useState<string | null>(null);

  /**
   * Reopen an existing competition (Unit 15). Only runs on the `:id` route; the
   * create route keeps its blank form. A 401 sends the controller back to login the
   * way every other controller screen does.
   */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await fetchCompetition(id);
        if (!cancelled) {
          setCompetition(loaded);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof CompetitionApiError && e.status === 401) {
          clearSession();
          navigate("/login", { replace: true });
          return;
        }
        setError(t("competition.genericError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, t]);

  function updateCategory(index: number, patch: Partial<CategoryInput>): void {
    setCategories((current) =>
      current.map((category, i) => (i === index ? { ...category, ...patch } : category)),
    );
  }

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cleaned = categories
        .map((category) => ({ code: category.code.trim(), name: category.name.trim() }))
        .filter((category) => category.code.length > 0 && category.name.length > 0);
      const created = await createCompetition({
        name: name.trim(),
        description: description.trim() || null,
        categories: cleaned,
      });
      setCompetition(created);
      setUnmet(null);
    } catch {
      setError(t("competition.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRound(roundId: string): Promise<void> {
    if (!competition) return;
    const value = durationEdits[roundId];
    if (value === undefined) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await updateCompetition(competition.id, {
        roundSettings: { [roundId]: { durationSeconds: value } },
      });
      setCompetition(updated);
      setSavedRound(roundId);
    } catch {
      setError(t("competition.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onPublish(): Promise<void> {
    if (!competition) return;
    setError(null);
    setUnmet(null);
    setBusy(true);
    try {
      const result = await publishCompetition(competition.id);
      setPublished(result);
      setCompetition({ ...competition, status: result.status });
    } catch (err) {
      const conditions = unmetConditionsFrom(err);
      if (conditions) {
        setUnmet(conditions);
      } else {
        setError(t("competition.genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          {t("competition.title")}
        </h1>
        {id && (
          <Link
            to="/controller"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
          >
            {t("competition.backToList")}
          </Link>
        )}
      </div>

      <p
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 sm:p-6 sm:text-sm"
      >
        {t("competition.wifiNote")}
      </p>

      {/* While an existing competition is still loading, show neither the blank
          create form nor the structure — just the loading line. */}
      {id && !competition && !error && (
        <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
      )}
      {error && !competition && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      {!competition && !id && (
        <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow sm:p-6" onSubmit={onCreate}>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
            {t("competition.name")}
            <input
              className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
            {t("competition.description")}
            <textarea
              className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-gray-700 sm:text-sm">
              {t("competition.categories")}
            </legend>
            {categories.map((category, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="w-28 rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                  aria-label={t("competition.categoryCode")}
                  placeholder={t("competition.categoryCode")}
                  value={category.code}
                  onChange={(e) => updateCategory(index, { code: e.target.value })}
                />
                <input
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                  aria-label={t("competition.categoryName")}
                  placeholder={t("competition.categoryName")}
                  value={category.name}
                  onChange={(e) => updateCategory(index, { name: e.target.value })}
                />
                {categories.length > 1 && (
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                    onClick={() =>
                      setCategories((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    {t("competition.removeCategory")}
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="self-start rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
              onClick={() => setCategories((current) => [...current, { code: "", name: "" }])}
            >
              {t("competition.addCategory")}
            </button>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            {t("competition.create")}
          </button>
        </form>
      )}

      {competition && (
        <section className="flex flex-col gap-4">
          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <h2 className="text-base font-bold text-gray-900 sm:text-lg">{competition.name}</h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              {t("competition.created")} · {competition.status}
            </p>
          </div>

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
            {t("competition.structure")}
          </h3>
          {competition.stages.map((stage) => (
            <div
              key={stage.id}
              className="rounded-xl bg-white p-4 shadow sm:p-6"
            >
              <p className="text-xs font-semibold text-gray-700 sm:text-sm">{stage.type}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {stage.rounds.map((round) => (
                  <li key={round.id} className="flex items-center gap-3 text-xs text-gray-700 sm:text-sm">
                    <span className="w-40">{stageRoundLabel(t, stage, round)}</span>
                    <label className="flex items-center gap-2">
                      {t("competition.roundDuration")}
                      <input
                        type="number"
                        min={1}
                        className="w-24 rounded border border-gray-300 px-2 py-1 tabular-nums text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label={t("competition.roundDuration")}
                        value={durationEdits[round.id] ?? round.settings?.durationSeconds ?? 0}
                        onChange={(e) =>
                          setDurationEdits((current) => ({
                            ...current,
                            [round.id]: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      onClick={() => onSaveRound(round.id)}
                    >
                      {t("competition.saveRound")}
                    </button>
                    {savedRound === round.id && (
                      <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
                        {t("competition.saved")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {unmet && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 sm:p-6 sm:text-sm"
            >
              <p className="font-medium">{t("competition.notReady")}</p>
              <ul className="mt-1 list-disc pl-5">
                {unmet.map((condition) => (
                  <li key={condition.key}>{condition.message}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
              {error}
            </p>
          )}

          {/* Judge range assignment (Unit 06) — changeable any time during the event. */}
          <JudgeRangeAssignmentPanel competitionId={competition.id} />

          {/* BLD-052: the school CRUD panel. It sits right before the participant panel
              because a participant is attached to a school — the organizer creates the
              schools first, then imports the roster that points at them. */}
          <SchoolPanel competitionId={competition.id} />

          {/* Participant import, roster and credential slips (Unit 04). It sits before the
              question panel because the publish readiness check needs both a participant
              and a question set in every category, and participants come first in the
              organizer's own order of work. No team formation is offered here — teams are
              deferred out of Unit 04 (spec §8 Q10, U-102). */}
          <ParticipantPanel
            competitionId={competition.id}
            categories={competition.categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
          />

          {/* Question import, pool and per-round selection (Unit 05, BLD-040). Only
              Individual rounds hold a selection; Team rounds draw from the pool. */}
          <QuestionPanel
            competitionId={competition.id}
            categories={competition.categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
            individualRounds={competition.stages
              .filter((stage) => stage.type === "INDIVIDUAL")
              .flatMap((stage) =>
                stage.rounds.map((round) => ({
                  id: round.id,
                  name: stageRoundLabel(t, stage, round),
                })),
              )}
          />

          {!published ? (
            <button
              type="button"
              disabled={busy}
              className="self-start rounded-lg bg-indigo-600 px-4 sm:px-6 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              onClick={onPublish}
            >
              {t("competition.publish")}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-xs sm:p-6 sm:text-sm">
              <p className="font-medium text-green-700">{t("competition.published")}</p>
              <p className="text-gray-700">
                {t("competition.entryLink")}:{" "}
                <code className="rounded bg-white px-1 font-mono text-gray-900">
                  {published.entryLinkToken}
                </code>
              </p>
              <p className="text-gray-700">
                {t("competition.bigScreenLink")}:{" "}
                <code className="rounded bg-white px-1 font-mono text-gray-900">
                  {published.bigScreenLinkToken}
                </code>
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
