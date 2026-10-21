import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
 * Implementation Detail 6, revised with BLD-040 on 2026-10-19): import a question file
 * into a category's pool and assign that round's own questions to it.
 *
 * **One block per round, all four of them** — Individual 1 and 2, Team 1 and 2. Team
 * rounds used to be deliberately absent here: they drew from the category's whole pool at
 * runtime and held no selection, so the panel offered two rounds while the publish check
 * read, to the controller, as being about four. That asymmetry is gone — a Team round now
 * holds a selection like any other and its runtime draws from it.
 *
 * The block is **collapsible and owns its own file upload**: pick the round, drop an
 * `.xlsx` in, select from what that file added, press Add. On success the block closes on
 * its own and its header states that the round is set up, so the screen answers "what is
 * still missing?" at a glance instead of leaving four identical dropdowns open. Nothing
 * stays static: reopening starts from the round's current selection.
 *
 * A round's expected count is not the same everywhere — 6 for an Individual round,
 * `teamQuestionCount` (default 10) for the Team rotation relay, `partitionPuzzleCount`
 * (default 3) for the Team partition round — so it arrives per round from the caller,
 * which reads it off the competition structure, rather than being a constant here.
 *
 * Visual: mood B, "light, sober, white cards" (BLD-054, revising U-66). The same white
 * card as the other panels of the host page (`CompetitionSetupPage`) — one single style
 * per visual role (§6/6). Each round block is a `bg-gray-50` sub-panel inside the card,
 * the same recipe as the participant panel's add form. Counters and grid numbers carry
 * `tabular-nums` (§3.5). Disabled buttons: `disabled:opacity-50`, the report's single
 * convention.
 */
export interface QuestionPanelCategory {
  id: string;
  name: string;
}

export interface QuestionPanelRound {
  id: string;
  name: string;
  /** How many questions this round needs. Not 6 for a Team round — see the header. */
  questionCount: number;
}

/** One round's own editing state, so opening one block never disturbs another. */
interface RoundBlockState {
  open: boolean;
  file: File | null;
  selected: string[];
  /** The `QuestionSet` the block's own upload just created, or null for the whole pool. */
  importedSetId: string | null;
  importedNote: string | null;
  failures: ImportFailureView[] | null;
  error: string | null;
  busy: boolean;
}

const EMPTY_BLOCK: RoundBlockState = {
  open: false,
  file: null,
  selected: [],
  importedSetId: null,
  importedNote: null,
  failures: null,
  error: null,
  busy: false,
};

export function QuestionPanel({
  competitionId,
  categories,
  rounds,
}: {
  competitionId: string;
  categories: QuestionPanelCategory[];
  rounds: QuestionPanelRound[];
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
  const [pool, setPool] = useState<PoolView | null>(null);
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  /** One editing state per round id, so four blocks can be open at once without sharing. */
  const [blocks, setBlocks] = useState<Record<string, RoundBlockState>>({});

  const blockFor = useCallback(
    (roundId: string): RoundBlockState => blocks[roundId] ?? EMPTY_BLOCK,
    [blocks],
  );

  const patchBlock = useCallback((roundId: string, patch: Partial<RoundBlockState>): void => {
    setBlocks((current) => ({
      ...current,
      [roundId]: { ...(current[roundId] ?? EMPTY_BLOCK), ...patch },
    }));
  }, []);

  const loadPool = useCallback(
    async (targetCategoryId: string): Promise<void> => {
      if (!targetCategoryId) return;
      setPoolBusy(true);
      try {
        const result = await fetchQuestionPool(competitionId, targetCategoryId);
        setPool(result);
        setPoolError(null);
      } catch {
        setPoolError(t("question.genericError"));
      } finally {
        setPoolBusy(false);
      }
    },
    [competitionId, t],
  );

  useEffect(() => {
    void loadPool(categoryId);
  }, [categoryId, loadPool]);

  /** Every question of the category's pool, flattened out of the per-set grouping. */
  const allQuestions = useMemo(
    () => pool?.groups.flatMap((group) => group.questions) ?? [],
    [pool],
  );

  /**
   * Which blocks are open, as one string. The pre-fill effect below depends on this rather
   * than on `blocks` itself: opening a block must re-run it (that is when the round's
   * current selection becomes visible), while ticking a checkbox must not (that would
   * overwrite the edit in progress). A comma-joined id list changes on exactly the first.
   */
  const openRoundIds = useMemo(
    () =>
      rounds
        .filter((round) => blocks[round.id]?.open)
        .map((round) => round.id)
        .join(","),
    [rounds, blocks],
  );

  /**
   * Opening a block pre-fills its checkboxes with that round's current selection, so
   * re-selecting starts from what is already assigned rather than from nothing. Closing
   * and reopening therefore never loses the round's questions — only an unsaved edit.
   */
  useEffect(() => {
    if (!pool || !openRoundIds) return;
    const openIds = new Set(openRoundIds.split(","));
    for (const round of rounds) {
      if (!openIds.has(round.id)) continue;
      const current = pool.groups
        .flatMap((group) => group.questions)
        .filter((question) => question.roundId === round.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((question) => question.id);
      patchBlock(round.id, { selected: current });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, rounds, openRoundIds, patchBlock]);

  /** How many questions a round currently holds, for the header's "set up" wording. */
  function assignedCount(roundId: string): number {
    return allQuestions.filter((question) => question.roundId === roundId).length;
  }

  function toggle(roundId: string, questionId: string): void {
    setSaved(null);
    const block = blockFor(roundId);
    patchBlock(roundId, {
      error: null,
      selected: block.selected.includes(questionId)
        ? block.selected.filter((id) => id !== questionId)
        : [...block.selected, questionId],
    });
  }

  async function onImport(roundId: string, event: FormEvent): Promise<void> {
    event.preventDefault();
    const block = blockFor(roundId);
    if (!block.file || !categoryId) return;
    patchBlock(roundId, { error: null, failures: null, importedNote: null, busy: true });
    try {
      const result = await importQuestionFile(competitionId, categoryId, block.file);
      // The block now shows only what this file added: the controller asked to select
      // "the puzzles from the file I just uploaded", not to hunt them in a 24-question
      // pool. Re-uploading the same file is fine — each upload is its own `QuestionSet`.
      patchBlock(roundId, {
        file: null,
        importedSetId: result.questionSetId,
        importedNote: `${t("question.imported")} · ${result.variantLabel} (${result.questionCount})`,
        busy: false,
      });
      await loadPool(categoryId);
    } catch (err) {
      const rows = importFailuresFrom(err);
      patchBlock(roundId, {
        busy: false,
        failures: rows,
        error: rows
          ? null
          : err instanceof QuestionApiError
            ? messageFor(err.code)
            : t("question.genericError"),
      });
    }
  }

  async function onAssign(round: QuestionPanelRound): Promise<void> {
    const block = blockFor(round.id);
    if (!categoryId) return;
    setSaved(null);
    patchBlock(round.id, { error: null, busy: true });
    try {
      await selectRoundQuestions(competitionId, categoryId, round.id, block.selected);
      const refreshed = await fetchQuestionPool(competitionId, categoryId);
      setPool(refreshed);
      // The block closes on success and states what it now holds, so the panel answers
      // "which rounds are done?" without the controller reopening anything.
      patchBlock(round.id, { ...EMPTY_BLOCK });
      setSaved(t("question.roundSetUp", { round: round.name }));
    } catch (err) {
      patchBlock(round.id, {
        busy: false,
        error: err instanceof QuestionApiError ? messageFor(err.code) : t("question.genericError"),
      });
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow sm:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("question.title")}</h3>

      <label className="flex flex-col gap-1 self-start text-xs font-medium text-gray-700 sm:text-sm">
        {t("question.category")}
        <select
          className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPool(null);
            setBlocks({});
            setSaved(null);
          }}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      {/* Every round of this competition, in structure order, each with its own counter.
          This is what was missing: four identical rows elsewhere on the page and two
          rounds here gave no way to see that the Team rounds were the ones unaccounted
          for. */}
      {pool && rounds.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="font-medium text-gray-700">{t("question.roundsOverview")}:</span>
          {rounds.map((round) => {
            const count = assignedCount(round.id);
            const complete = count === round.questionCount;
            return (
              <span
                key={round.id}
                className={
                  complete
                    ? "rounded bg-green-100 px-2 py-0.5 tabular-nums text-green-800"
                    : "rounded bg-amber-100 px-2 py-0.5 tabular-nums text-amber-800"
                }
              >
                {round.name}: {count} / {round.questionCount} ·{" "}
                {complete ? t("question.roundComplete") : t("question.roundIncomplete")}
              </span>
            );
          })}
        </div>
      )}

      {poolError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:text-sm">
          {poolError}
        </p>
      )}

      {pool && pool.groups.length === 0 && (
        <p className="text-xs text-gray-500 sm:text-sm">{t("question.poolEmpty")}</p>
      )}

      <div className="flex flex-col gap-3">
        {rounds.map((round) => {
          const block = blockFor(round.id);
          const count = assignedCount(round.id);
          const complete = count === round.questionCount;
          return (
            <RoundBlock
              key={round.id}
              round={round}
              block={block}
              pool={pool}
              poolBusy={poolBusy}
              assignedCount={count}
              complete={complete}
              t={t}
              onOpen={() => patchBlock(round.id, { open: true })}
              onClose={() => patchBlock(round.id, { ...EMPTY_BLOCK })}
              onFile={(file) =>
                patchBlock(round.id, { file, importedNote: null, failures: null })
              }
              onSubmit={(event) => void onImport(round.id, event)}
              onToggle={(questionId) => toggle(round.id, questionId)}
              onAssign={() => void onAssign(round)}
              onShowWholePool={() => patchBlock(round.id, { importedSetId: null })}
            />
          );
        })}
      </div>

      {saved && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700 sm:text-sm">
          {saved}
        </p>
      )}
    </section>
  );
}

/**
 * One round's collapsible block. Closed, its header says whether that round is set up and
 * how many questions it holds; open, it carries that round's own upload, the selectable
 * list and the Add button.
 */
function RoundBlock({
  round,
  block,
  pool,
  poolBusy,
  assignedCount,
  complete,
  t,
  onOpen,
  onClose,
  onFile,
  onSubmit,
  onToggle,
  onAssign,
  onShowWholePool,
}: {
  round: QuestionPanelRound;
  block: RoundBlockState;
  pool: PoolView | null;
  poolBusy: boolean;
  assignedCount: number;
  complete: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onOpen: () => void;
  onClose: () => void;
  onFile: (file: File | null) => void;
  onSubmit: (event: FormEvent) => void;
  onToggle: (questionId: string) => void;
  onAssign: () => void;
  onShowWholePool: () => void;
}) {
  /**
   * What the open block offers to select from. After its own upload that is only the new
   * `QuestionSet` — the controller selects from the file they just dropped in. A button
   * widens it back to the whole pool, which is how an already-set-up round is re-selected
   * without a fresh upload.
   */
  const groups = useMemo(() => {
    if (!pool) return [];
    if (block.importedSetId === null) return pool.groups;
    return pool.groups.filter((group) => group.questionSet.id === block.importedSetId);
  }, [pool, block.importedSetId]);

  const questionCount = round.questionCount;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50" data-testid={`round-block-${round.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-900 sm:text-sm">{round.name}</span>
          <span
            className={
              complete
                ? "rounded bg-green-100 px-2 py-0.5 text-xs tabular-nums text-green-800"
                : "rounded bg-amber-100 px-2 py-0.5 text-xs tabular-nums text-amber-800"
            }
          >
            {complete ? t("question.roundSetUpShort") : t("question.roundNotSetUp")} ·{" "}
            {assignedCount} / {questionCount}
          </span>
        </div>
        {block.open ? (
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
            onClick={onClose}
          >
            {t("question.closeBlock")}
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 sm:text-sm"
            onClick={onOpen}
          >
            {complete ? t("question.changeQuestions") : t("question.setUpRound")}
          </button>
        )}
      </div>

      {block.open && (
        <div className="flex flex-col gap-3 border-t border-gray-200 p-3">
          <form className="flex flex-col gap-2" onSubmit={onSubmit}>
            <p className="text-xs text-gray-500 sm:text-sm">{t("question.importHint")}</p>
            <input
              type="file"
              accept=".xlsx"
              className="text-xs text-gray-700 sm:text-sm"
              aria-label={`${t("question.chooseFile")} · ${round.name}`}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="submit"
              disabled={block.busy || !block.file}
              className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {t("question.importFile")}
            </button>
          </form>

          {block.importedNote && (
            <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700 sm:text-sm">
              {block.importedNote}
            </p>
          )}

          {block.failures && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:text-sm"
            >
              <p className="font-medium">{t("question.rejected")}</p>
              <ul className="mt-1 list-disc pl-5">
                {block.failures.map((failure) => (
                  <li key={`${failure.row}-${failure.code}`}>
                    {t("question.row")} {failure.row}
                    {failure.column ? ` · ${failure.column}` : ""} — {t(failure.code)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {block.error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:text-sm">
              {block.error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
                {block.importedSetId === null ? t("question.pool") : t("question.fromThisFile")}
              </h4>
              <p className="text-xs tabular-nums text-gray-500">
                {t("question.selectedCount")}: {block.selected.length} / {questionCount}
              </p>
            </div>

            {block.importedSetId !== null && (
              <button
                type="button"
                className="self-start text-xs font-medium text-indigo-600 underline transition-colors hover:text-indigo-500 sm:text-sm"
                onClick={onShowWholePool}
              >
                {t("question.showWholePool")}
              </button>
            )}

            {poolBusy && (
              <p className="text-xs text-gray-500 sm:text-sm">{t("question.loading")}</p>
            )}

            {!poolBusy && groups.length === 0 && (
              <p className="text-xs text-gray-500 sm:text-sm">
                {block.importedSetId === null
                  ? t("question.poolEmpty")
                  : t("question.nothingInThisFileYet")}
              </p>
            )}

            {groups.map((group) => (
              <div key={group.questionSet.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                  {group.questionSet.name} · {group.questionSet.questionCount}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {group.questions.map((question) => (
                    <li key={question.id} className="flex items-center gap-2 text-xs text-gray-700 sm:text-sm">
                      <input
                        type="checkbox"
                        checked={block.selected.includes(question.id)}
                        disabled={block.busy}
                        aria-label={`${round.name} · ${group.questionSet.name} #${question.sequence}`}
                        onChange={() => onToggle(question.id)}
                      />
                      <span className="tabular-nums">
                        #{question.sequence} · {question.gridRows}×{question.gridColumns} ·{" "}
                        {question.points} {t("question.points")}
                      </span>
                      {question.roundId && question.roundId !== round.id && (
                        <span className="text-xs text-gray-500">{t("question.inAnotherRound")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <button
              type="button"
              disabled={block.busy || block.selected.length !== questionCount}
              className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              onClick={onAssign}
            >
              {t("question.addQuestions", { count: questionCount })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
