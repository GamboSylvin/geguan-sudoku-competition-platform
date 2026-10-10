import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import { clearSession } from "../auth/session";
import { JudgeRangeAssignmentPanel } from "../judge/JudgeRangeAssignmentPanel";
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

/**
 * The competition-creation and publish screen (Unit 03, frontend `competition`
 * feature). Functional and minimally styled — the finished visual design is deferred
 * (U-66). It shows the venue Wi-Fi advisory note (U-56, UI copy only), the
 * auto-generated structure with its editable round durations, and the publish action
 * with its readiness-failure / success display.
 *
 * Unit 15 gives it a second mode: `/controller/competitions/:id/setup` opens an
 * **existing** competition instead of the create form. That is where a copy lands,
 * because the copy is a fresh `CREATED` competition that still has to go through
 * this screen's publish flow — including a participant import, which Unit 04 owes it
 * and which is why publishing a brand-new copy fails its readiness check until then.
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-slate-50 p-6 text-slate-800">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("competition.title")}</h1>
        {id && (
          <Link
            to="/controller"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            {t("competition.backToList")}
          </Link>
        )}
      </div>

      <p
        role="note"
        className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      >
        {t("competition.wifiNote")}
      </p>

      {/* While an existing competition is still loading, show neither the blank
          create form nor the structure — just the loading line. */}
      {id && !competition && !error && (
        <p className="text-sm text-slate-600">{t("common.loading")}</p>
      )}
      {error && !competition && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!competition && !id && (
        <form className="flex flex-col gap-4" onSubmit={onCreate}>
          <label className="flex flex-col gap-1 text-sm">
            {t("competition.name")}
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            {t("competition.description")}
            <textarea
              className="rounded-md border border-slate-300 px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("competition.categories")}</legend>
            {categories.map((category, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  aria-label={t("competition.categoryCode")}
                  placeholder={t("competition.categoryCode")}
                  value={category.code}
                  onChange={(e) => updateCategory(index, { code: e.target.value })}
                />
                <input
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  aria-label={t("competition.categoryName")}
                  placeholder={t("competition.categoryName")}
                  value={category.name}
                  onChange={(e) => updateCategory(index, { name: e.target.value })}
                />
                {categories.length > 1 && (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
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
              className="self-start rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
              onClick={() => setCategories((current) => [...current, { code: "", name: "" }])}
            >
              {t("competition.addCategory")}
            </button>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          >
            {t("competition.create")}
          </button>
        </form>
      )}

      {competition && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-medium">{competition.name}</h2>
            <p className="text-sm text-slate-600">
              {t("competition.created")} · {competition.status}
            </p>
          </div>

          <h3 className="text-sm font-medium">{t("competition.structure")}</h3>
          {competition.stages.map((stage) => (
            <div key={stage.id} className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium">{stage.type}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {stage.rounds.map((round) => (
                  <li key={round.id} className="flex items-center gap-3 text-sm">
                    <span className="w-40">{stageRoundLabel(t, stage, round)}</span>
                    <label className="flex items-center gap-2">
                      {t("competition.roundDuration")}
                      <input
                        type="number"
                        min={1}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1"
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
                      className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
                      onClick={() => onSaveRound(round.id)}
                    >
                      {t("competition.saveRound")}
                    </button>
                    {savedRound === round.id && (
                      <span className="text-green-700">{t("competition.saved")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {unmet && (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
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
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Judge range assignment (Unit 06) — changeable any time during the event. */}
          <JudgeRangeAssignmentPanel competitionId={competition.id} />

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
              className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
              onClick={onPublish}
            >
              {t("competition.publish")}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">{t("competition.published")}</p>
              <p>
                {t("competition.entryLink")}: <code>{published.entryLinkToken}</code>
              </p>
              <p>
                {t("competition.bigScreenLink")}: <code>{published.bigScreenLinkToken}</code>
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
