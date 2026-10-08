import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-context";
import {
  fetchQuestionPool,
  importFailuresFrom,
  importQuestionFile,
  QuestionApiError,
  selectRoundQuestions,
  type ImportFailureView,
  type PoolView,
} from "./questionApi";

/**
 * The controller's question panel on the competition setup screen (Unit 05, spec
 * Implementation Detail 6): import a question file into a category's pool, see the pool
 * grouped by `QuestionSet`/variant (BLD-044), and assign exactly 6 of them to each
 * Individual round (BLD-040).
 *
 * A Team round is never offered here — it holds no selection; it draws from the pool at
 * runtime. The selection stays changeable until that round's preparation begins, at
 * which point the backend refuses with `question.selection.locked` and the panel shows
 * that refusal instead of silently keeping a stale choice.
 */
export interface QuestionPanelCategory {
  id: string;
  name: string;
}

export interface QuestionPanelRound {
  id: string;
  name: string;
}

const REQUIRED_COUNT = 6;

export function QuestionPanel({
  competitionId,
  categories,
  individualRounds,
}: {
  competitionId: string;
  categories: QuestionPanelCategory[];
  individualRounds: QuestionPanelRound[];
}) {
  const { t } = useLocale();

  /**
   * Turn a backend error code into the controller's own language. `translate` returns the
   * key itself when a catalogue has no entry, so an unmapped code falls back to the
   * generic message rather than showing a raw dot-path on screen.
   */
  const messageFor = useCallback(
    (code: string): string => {
      if (code === "VALIDATION_ERROR") return t("common.validationFailed");
      const translated = t(code);
      return translated === code ? t("question.genericError") : translated;
    },
    [t],
  );

  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [roundId, setRoundId] = useState(individualRounds[0]?.id ?? "");
  const [pool, setPool] = useState<PoolView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [failures, setFailures] = useState<ImportFailureView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPool = useCallback(
    async (targetCategoryId: string): Promise<void> => {
      if (!targetCategoryId) return;
      setBusy(true);
      try {
        const result = await fetchQuestionPool(competitionId, targetCategoryId);
        setPool(result);
      } catch {
        setError(t("question.genericError"));
      } finally {
        setBusy(false);
      }
    },
    [competitionId, t],
  );

  useEffect(() => {
    void loadPool(categoryId);
  }, [categoryId, loadPool]);

  // Opening a round pre-fills the checkboxes with that round's current 6, so
  // re-selecting starts from what is already assigned rather than from nothing.
  useEffect(() => {
    if (!pool || !roundId) return;
    const current = pool.groups
      .flatMap((group) => group.questions)
      .filter((question) => question.roundId === roundId)
      .sort((a, b) => a.sequence - b.sequence)
      .map((question) => question.id);
    setSelected(current);
  }, [pool, roundId]);

  function toggle(questionId: string): void {
    setSaved(null);
    setError(null);
    setSelected((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  async function onImport(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file || !categoryId) return;
    setError(null);
    setFailures(null);
    setImported(null);
    setBusy(true);
    try {
      const result = await importQuestionFile(competitionId, categoryId, file);
      setFile(null);
      await loadPool(categoryId);
      setImported(`${t("question.imported")} · ${result.variantLabel} (${result.questionCount})`);
    } catch (err) {
      const rows = importFailuresFrom(err);
      if (rows) {
        setFailures(rows);
      } else if (err instanceof QuestionApiError) {
        setError(messageFor(err.code));
      } else {
        setError(t("question.genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(): Promise<void> {
    if (!categoryId || !roundId) return;
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      await selectRoundQuestions(competitionId, categoryId, roundId, selected);
      setSaved(t("question.assigned"));
      await loadPool(categoryId);
    } catch (err) {
      setError(err instanceof QuestionApiError ? messageFor(err.code) : t("question.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium">{t("question.title")}</h3>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("question.category")}
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPool(null);
              setImported(null);
              setFailures(null);
            }}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("question.round")}
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
          >
            {individualRounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="flex flex-col gap-2" onSubmit={onImport}>
        <p className="text-xs text-slate-600">{t("question.importHint")}</p>
        <input
          type="file"
          accept=".xlsx"
          className="text-sm"
          aria-label={t("question.chooseFile")}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setImported(null);
            setFailures(null);
          }}
        />
        <button
          type="submit"
          disabled={busy || !file || !categoryId}
          className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
        >
          {t("question.importFile")}
        </button>
      </form>

      {imported && <p className="text-sm text-green-700">{imported}</p>}

      {failures && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          <p className="font-medium">{t("question.rejected")}</p>
          <ul className="mt-1 list-disc pl-5">
            {failures.map((failure) => (
              <li key={`${failure.row}-${failure.code}`}>
                {t("question.row")} {failure.row}
                {failure.column ? ` · ${failure.column}` : ""} — {t(failure.code)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium">{t("question.pool")}</h4>
          <p className="text-xs text-slate-600">
            {t("question.selectedCount")}: {selected.length} / {REQUIRED_COUNT}
          </p>
        </div>

        {pool && pool.groups.length === 0 && (
          <p className="text-sm text-slate-600">{t("question.poolEmpty")}</p>
        )}

        {pool?.groups.map((group) => (
          <div key={group.questionSet.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-medium">
              {group.questionSet.name} · {group.questionSet.questionCount}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {group.questions.map((question) => (
                <li key={question.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(question.id)}
                    disabled={busy}
                    aria-label={`${group.questionSet.name} #${question.sequence}`}
                    onChange={() => toggle(question.id)}
                  />
                  <span>
                    #{question.sequence} · {question.gridRows}×{question.gridColumns} ·{" "}
                    {question.points} {t("question.points")}
                  </span>
                  {question.roundId && (
                    <span className="text-xs text-slate-500">
                      {individualRounds.find((round) => round.id === question.roundId)?.name ??
                        question.roundId}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <button
          type="button"
          disabled={busy || !roundId || selected.length !== REQUIRED_COUNT}
          className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          onClick={() => void onAssign()}
        >
          {t("question.assign")}
        </button>

        {saved && <p className="text-sm text-green-700">{saved}</p>}
      </div>
    </section>
  );
}
