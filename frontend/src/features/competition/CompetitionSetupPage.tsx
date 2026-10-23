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

/**
 * How many questions a round's selection must hold. Not a single constant: an Individual
 * round reads its own `individualQuestionCount` (BLD-057 — it was hard-coded to 6 before,
 * which is what stopped the controller setting up a short test competition), the Team
 * rotation relay its `teamQuestionCount`, and the Team partition round its
 * `partitionPuzzleCount`. The defaults mirror the `RoundSettings` column defaults, and are
 * the fallback for a round whose settings row has not been created yet.
 */
const INDIVIDUAL_ROUND_QUESTION_COUNT = 6;
const TEAM_ROTATION_QUESTION_COUNT = 10;
const TEAM_PARTITION_PUZZLE_COUNT = 3;

function roundQuestionCount(stage: StageView, round: RoundView): number {
  if (stage.type === "INDIVIDUAL") {
    return round.settings?.individualQuestionCount ?? INDIVIDUAL_ROUND_QUESTION_COUNT;
  }
  // Team round 2 is the partition round (齐心协力); Team round 1 is the rotation relay —
  // the same mapping the backend's `app.ts` uses to pick the runtime.
  if (round.sequence === 2) {
    return round.settings?.partitionPuzzleCount ?? TEAM_PARTITION_PUZZLE_COUNT;
  }
  return round.settings?.teamQuestionCount ?? TEAM_ROTATION_QUESTION_COUNT;
}

/**
 * Which `RoundSettings` column a round's count lives in. One field name rather than
 * three branches at every edit site, so the count input cannot be wired to the wrong
 * column for one of the three round kinds.
 */
function countFieldFor(
  stage: StageView,
  round: RoundView,
): "individualQuestionCount" | "teamQuestionCount" | "partitionPuzzleCount" {
  if (stage.type === "INDIVIDUAL") return "individualQuestionCount";
  return round.sequence === 2 ? "partitionPuzzleCount" : "teamQuestionCount";
}

/**
 * One published link, as a real, openable address (report §9a). The URL is composed by
 * the backend (`shared/links`) and simply rendered here — this screen never concatenates
 * a token with a base, which is how the two links it shows stay identical to the ones on
 * the credential slips.
 *
 * The copy button falls back to a hidden textarea + `execCommand` because the deployment
 * is plain HTTP on an IP address (BLD-048) and `navigator.clipboard` is only available in
 * a secure context. It is a convenience, not the only path: the link is always selectable.
 */
function PublishedLink({ label, url, notConfigured }: {
  label: string;
  url: string;
  notConfigured: string;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
    } catch {
      // Copying is a convenience: a failure leaves the selectable link as the way out.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-gray-700">{label}</span>
      {url === "" ? (
        <p className="text-xs text-amber-700">{notConfigured}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-xs text-indigo-700 underline hover:text-indigo-600 sm:text-sm"
          >
            {url}
          </a>
          <button
            type="button"
            onClick={onCopy}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100"
          >
            {copied ? t("competition.copied") : t("competition.copyLink")}
          </button>
        </div>
      )}
    </div>
  );
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
  /**
   * BLD-057: the per-round selection size being edited, keyed by round id. Only the
   * Individual round had no way in — its count was a constant on both sides, so the
   * controller setting up a short test competition was stuck at 6. The two Team counts
   * were already stored per round and patchable through the API, but this screen never
   * offered a field for them either, so all three are editable from here now.
   */
  const [countEdits, setCountEdits] = useState<Record<string, number>>({});
  const [savedRound, setSavedRound] = useState<string | null>(null);

  /**
   * The category editor's own draft (report §6c). Seeded from the loaded/created
   * competition whenever it changes, so reopening a competition starts from its real
   * categories rather than the blank form's single empty row.
   */
  const [categoryEdits, setCategoryEdits] = useState<CategoryInput[]>([]);
  const [categoriesSaved, setCategoriesSaved] = useState(false);

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

  /** Seed the category editor from the real competition once it is known (report §6c). */
  useEffect(() => {
    if (competition) {
      setCategoryEdits(competition.categories.map((c) => ({ code: c.code, name: c.name })));
    }
  }, [competition]);

  function updateCategoryEdit(index: number, patch: Partial<CategoryInput>): void {
    setCategoryEdits((current) =>
      current.map((category, i) => (i === index ? { ...category, ...patch } : category)),
    );
  }

  /**
   * Save the edited category list (report §6c). The backend's `applyCategoryChanges`
   * matches on `code` to add/remove/reorder, and refuses once the competition is
   * published (`competition.structureLocked`) — this form is not offered past that
   * point, so that refusal should never actually fire here.
   */
  async function onSaveCategories(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!competition) return;
    setError(null);
    setCategoriesSaved(false);
    setBusy(true);
    try {
      const cleaned = categoryEdits
        .map((category) => ({ code: category.code.trim(), name: category.name.trim() }))
        .filter((category) => category.code.length > 0 && category.name.length > 0);
      const updated = await updateCompetition(competition.id, { categories: cleaned });
      setCompetition(updated);
      setCategoriesSaved(true);
    } catch {
      setError(t("competition.genericError"));
    } finally {
      setBusy(false);
    }
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

  async function onSaveRound(
    stage: StageView,
    round: RoundView,
  ): Promise<void> {
    if (!competition) return;
    const roundId = round.id;
    // Either field alone is a reason to save: the controller may change the count
    // without touching the duration (BLD-057), and the reverse was already true.
    const duration = durationEdits[roundId];
    const count = countEdits[roundId];
    if (duration === undefined && count === undefined) return;
    const patch: {
      durationSeconds?: number;
      individualQuestionCount?: number;
      teamQuestionCount?: number;
      partitionPuzzleCount?: number;
    } = {};
    if (duration !== undefined) patch.durationSeconds = duration;
    if (count !== undefined) patch[countFieldFor(stage, round)] = count;
    setError(null);
    setBusy(true);
    try {
      const updated = await updateCompetition(competition.id, {
        roundSettings: { [roundId]: patch },
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

  /**
   * The competition is published when its own status says so — not merely when the Publish
   * button was clicked in this session. A reopened competition arrives already published,
   * and its status is what decides whether the links or the Publish button shows.
   */
  const isPublished = published !== null || competition?.status !== "CREATED";

  /**
   * The two links to display. Right after publishing, the publish result is the freshest
   * source; otherwise the loaded competition carries the same composed URLs.
   */
  const entryLinkUrl = published?.entryLinkUrl ?? competition?.entryLinkUrl ?? "";
  const bigScreenLinkUrl =
    published?.bigScreenLinkUrl ?? competition?.bigScreenLinkUrl ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          {t("competition.title")}
        </h1>
        {/* Unconditional (report §7): the way back is always there, including on the create
            route where `id` is undefined. */}
        <Link
          to="/controller"
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
        >
          {t("competition.backToList")}
        </Link>
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

          {/* Category editor (report §6c): editable before publish — the backend already
              supported PATCHing categories, this screen just never exposed it, which is
              also why there was no way to add the category a late `选手信息.xlsx` import
              needed. Read-only with an explanation after publish, not hidden. */}
          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
              {t("competition.editCategories")}
            </h3>
            {isPublished ? (
              <>
                <ul className="mb-2 flex flex-col gap-1 text-xs text-gray-700 sm:text-sm">
                  {competition.categories.map((category) => (
                    <li key={category.id}>
                      <span className="font-mono tabular-nums">{category.code}</span> — {category.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 sm:text-sm">{t("competition.categoriesLockedNote")}</p>
              </>
            ) : (
              <form className="flex flex-col gap-2" onSubmit={onSaveCategories}>
                {categoryEdits.map((category, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      className="w-28 rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                      aria-label={t("competition.categoryCode")}
                      placeholder={t("competition.categoryCode")}
                      value={category.code}
                      onChange={(e) => updateCategoryEdit(index, { code: e.target.value })}
                    />
                    <input
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                      aria-label={t("competition.categoryName")}
                      placeholder={t("competition.categoryName")}
                      value={category.name}
                      onChange={(e) => updateCategoryEdit(index, { name: e.target.value })}
                    />
                    {categoryEdits.length > 1 && (
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                        onClick={() =>
                          setCategoryEdits((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        {t("competition.removeCategory")}
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="self-start rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                    onClick={() =>
                      setCategoryEdits((current) => [...current, { code: "", name: "" }])
                    }
                  >
                    {t("competition.addCategory")}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    {t("competition.saveCategories")}
                  </button>
                  {categoriesSaved && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      {t("competition.saved")}
                    </span>
                  )}
                </div>
              </form>
            )}
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
                    {/* BLD-057: the round's own selection size, editable like its duration.
                        The panel the controller picks questions in reads this same number,
                        so changing it here changes how many must be assigned there too. */}
                    <label className="flex items-center gap-2">
                      {t("competition.roundQuestionCount")}
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded border border-gray-300 px-2 py-1 tabular-nums text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label={t("competition.roundQuestionCount")}
                        value={
                          countEdits[round.id] ?? roundQuestionCount(stage, round)
                        }
                        onChange={(e) =>
                          setCountEdits((current) => ({
                            ...current,
                            [round.id]: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      onClick={() => onSaveRound(stage, round)}
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

          {/* Question import, pool and per-round selection (Unit 05, BLD-040 revised
              2026-10-19). Every round now holds a selection — the two Individual rounds
              and the two Team rounds alike — so the panel gets all four, each with the
              count its own round uses: 6 for an Individual round, `teamQuestionCount`
              for the Team rotation relay (round 1 of the Team stage) and
              `partitionPuzzleCount` for the Team partition round (round 2). */}
          <QuestionPanel
            competitionId={competition.id}
            categories={competition.categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
            rounds={competition.stages.flatMap((stage) =>
              stage.rounds.map((round) => ({
                id: round.id,
                name: stageRoundLabel(t, stage, round),
                questionCount: roundQuestionCount(stage, round),
              })),
            )}
          />

          {!isPublished ? (
            <button
              type="button"
              disabled={busy}
              className="self-start rounded-lg bg-indigo-600 px-4 sm:px-6 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              onClick={onPublish}
            >
              {t("competition.publish")}
            </button>
          ) : (
            /* The two public links. Rendered for any published competition, not only the
               one just published in this session: reopening `/controller/competitions/:id/setup`
               on a competition published earlier used to show nothing at all (report §9a),
               because the card was keyed on the local `published` state. The tokens alone
               are not links, so they are no longer shown raw. */
            <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-xs sm:p-6 sm:text-sm">
              <p className="font-medium text-green-700">{t("competition.published")}</p>
              <PublishedLink
                label={t("competition.entryLink")}
                url={entryLinkUrl}
                notConfigured={t("competition.linkNotConfigured")}
              />
              <PublishedLink
                label={t("competition.bigScreenLink")}
                url={bigScreenLinkUrl}
                notConfigured={t("competition.linkNotConfigured")}
              />
              {/*
                Hole C (report 2026-10-19): the published card stopped at the two links and
                said nothing about what happens next, so there was no visible path to actually
                *starting* the competition. Starting lives on the controller's live page
                (CS-022 [C] and J-004 give that power to the controller alone, deliberately not
                to the judge), so name it and link to it. Text and a link only — no state, no
                request, nothing about the start sequence itself changed.
              */}
              <div className="mt-1 flex flex-col gap-2 border-t border-green-200 pt-3">
                <p className="text-green-800">{t("competition.nextStep")}</p>
                <Link
                  to={`/controller/competitions/${encodeURIComponent(competition.id)}/live`}
                  className="self-start rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-800 sm:text-sm"
                >
                  {t("competition.openLive")}
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
