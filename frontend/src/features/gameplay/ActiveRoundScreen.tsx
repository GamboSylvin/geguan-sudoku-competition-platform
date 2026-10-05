/**
 * The active-round screen (Unit 07). Renders the round's 6 puzzles one at a time,
 * with free navigation between them, a number pad for the selected cell, and
 * autosave of every edit to the server.
 *
 * The screen is landscape-only (UI-001/PAR-006): a "please rotate your device"
 * gate appears when the viewport is taller than it is wide.
 *
 * There is deliberately no live correctness feedback (spec Free movement): the
 * grid shows what the player typed, nothing more.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";

interface RoundQuestionPayload {
  id: string;
  sequence: number;
  type: "STANDARD" | "VARIANT";
  gridRows: number;
  gridColumns: number;
  regions: unknown;
  startingGrid: unknown;
  points: number;
}

interface SavedGridEntry {
  questionId: string;
  grid: (number | null)[];
  savedAtMs: number;
}

interface ActiveRoundScreenProps {
  roundId: string;
  competitionId: string;
  durationSeconds: number;
  questions: RoundQuestionPayload[];
  savedGrids: SavedGridEntry[];
  sessionToken: string;
  deviceId: string;
  /**
   * Server-reported state of this player's participation (Unit 08). When it
   * arrives as SUBMITTED/AUTO_SUBMITTED on reconnect, the screen locks straight
   * into the read-only "submission accepted" view without letting the player
   * edit again (PL-009 — a repeated submit is a no-op, so we don't even render
   * the button).
   */
  initialParticipationState?:
    | "WAITING"
    | "ACTIVE"
    | "SUBMITTED"
    | "AUTO_SUBMITTED"
    | "RESTARTED";
}

/** Autosave debounce: roughly twice a second (spec Implementation Detail 4). */
const AUTOSAVE_DEBOUNCE_MS = 500;

export function ActiveRoundScreen({
  roundId,
  durationSeconds,
  questions,
  savedGrids,
  sessionToken,
  deviceId,
  initialParticipationState,
}: ActiveRoundScreenProps) {
  const { t } = useLocale();

  // Build the initial working grids: the saved grid when one exists (reconnect),
  // otherwise the puzzle's starting grid.
  const initialGrids = useMemo(() => {
    const map = new Map<string, (number | null)[]>();
    for (const question of questions) {
      const saved = savedGrids.find((s) => s.questionId === question.id);
      if (saved) {
        map.set(question.id, [...saved.grid]);
      } else {
        const starting = Array.isArray(question.startingGrid)
          ? (question.startingGrid as (number | null)[])
          : [];
        map.set(question.id, [...starting]);
      }
    }
    return map;
  }, [questions, savedGrids]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [grids, setGrids] = useState<Map<string, (number | null)[]>>(initialGrids);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined" ? window.innerWidth >= window.innerHeight : true,
  );

  const currentQuestion = questions[currentIndex];
  const currentGrid = currentQuestion ? grids.get(currentQuestion.id) ?? [] : [];

  // Cosmetic countdown. The server's timer-sync pushes re-anchor this; between
  // pushes it ticks down once a second. The server's remaining is the authority
  // (invariant 3).
  useEffect(() => {
    setTimeLeft(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(handle);
  }, []);

  // Track orientation for the landscape gate.
  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth >= window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Autosave: debounced per question. The last write wins; the server is
  // authoritative for whether the write is accepted (spec Error Cases).
  const pendingRef = useRef<Map<string, (number | null)[]>>(new Map());
  const timerRef = useRef<Map<string, number>>(new Map());

  const flushAutosave = useCallback(
    async (questionId: string) => {
      const grid = pendingRef.current.get(questionId);
      if (!grid) return;
      pendingRef.current.delete(questionId);
      try {
        await fetch(`${API_BASE_URL}/api/gameplay/${roundId}/autosave`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-session-token": sessionToken,
            "x-device-id": deviceId,
          },
          body: JSON.stringify({ questionId, grid }),
        });
      } catch {
        // Network errors are silent: the next edit's autosave will carry the
        // latest grid. The server keeps the authoritative copy.
      }
    },
    [roundId, sessionToken, deviceId],
  );

  const scheduleAutosave = useCallback(
    (questionId: string, grid: (number | null)[]) => {
      pendingRef.current.set(questionId, grid);
      const existing = timerRef.current.get(questionId);
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      const handle = window.setTimeout(() => {
        timerRef.current.delete(questionId);
        void flushAutosave(questionId);
      }, AUTOSAVE_DEBOUNCE_MS);
      timerRef.current.set(questionId, handle);
    },
    [flushAutosave],
  );

  // Flush any pending autosave when the round ends or the page unloads.
  useEffect(() => {
    const onBeforeUnload = () => {
      for (const questionId of pendingRef.current.keys()) {
        void flushAutosave(questionId);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushAutosave]);

  const setCell = useCallback(
    (cellIndex: number, value: number | null) => {
      if (!currentQuestion) return;
      // Given cells (non-null in the starting grid) are read-only.
      const starting = Array.isArray(currentQuestion.startingGrid)
        ? (currentQuestion.startingGrid as (number | null)[])
        : [];
      if (starting[cellIndex] != null) return;

      setGrids((current) => {
        const next = new Map(current);
        const grid = [...(next.get(currentQuestion.id) ?? [])];
        grid[cellIndex] = value;
        next.set(currentQuestion.id, grid);
        scheduleAutosave(currentQuestion.id, grid);
        return next;
      });
    },
    [currentQuestion, scheduleAutosave],
  );

  const onDelete = useCallback(() => {
    if (selectedCell == null) return;
    if (!window.confirm(t("gameplay.confirmDelete"))) return;
    setCell(selectedCell, null);
  }, [selectedCell, setCell, t]);

  const onClearAll = useCallback(() => {
    if (!currentQuestion) return;
    if (!window.confirm(t("gameplay.confirmClearAll"))) return;
    const starting = Array.isArray(currentQuestion.startingGrid)
      ? (currentQuestion.startingGrid as (number | null)[])
      : [];
    setGrids((current) => {
      const next = new Map(current);
      const grid = [...(next.get(currentQuestion.id) ?? [])];
      for (let i = 0; i < grid.length; i += 1) {
        if (starting[i] == null) grid[i] = null;
      }
      next.set(currentQuestion.id, grid);
      scheduleAutosave(currentQuestion.id, grid);
      return next;
    });
  }, [currentQuestion, scheduleAutosave, t]);

  // ------- Unit 08: manual submit -------
  // The submit button is always visible while the player can edit. Clicking it
  // opens a confirmation dialog that names the count of *completely blank*
  // puzzles (puzzles where no playable cell is filled) — spec UI flow. Once
  // the server accepts, the screen swaps into a read-only view of the answers
  // and a "submission accepted" panel; the score is deliberately NOT shown
  // (SUB-007/BLD-029).
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(
    initialParticipationState === "SUBMITTED" ||
      initialParticipationState === "AUTO_SUBMITTED",
  );

  // Count of puzzles where every playable cell is still blank. A puzzle that
  // has even one filled-in cell counts as attempted (it will be scored, just
  // possibly wrong) — only completely untouched puzzles are flagged.
  const blankPuzzleCount = useMemo(() => {
    let count = 0;
    for (const q of questions) {
      const starting = Array.isArray(q.startingGrid)
        ? (q.startingGrid as (number | null)[])
        : [];
      const grid = grids.get(q.id) ?? [];
      let anyFilled = false;
      for (let i = 0; i < starting.length; i += 1) {
        if (starting[i] == null && grid[i] != null) {
          anyFilled = true;
          break;
        }
      }
      if (!anyFilled) count += 1;
    }
    return count;
  }, [questions, grids]);

  const onSubmitClick = useCallback(() => {
    if (submitting || submitted) return;
    setShowSubmitConfirm(true);
  }, [submitting, submitted]);

  const onSubmitConfirm = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      // Flush any pending autosave so the server scores the latest grid.
      const pendingIds = Array.from(pendingRef.current.keys());
      await Promise.all(pendingIds.map((id) => flushAutosave(id)));

      const response = await fetch(`${API_BASE_URL}/api/gameplay/${roundId}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-token": sessionToken,
          "x-device-id": deviceId,
        },
        body: "{}",
      });
      // 200 = accepted (manual or late/timeout — indistinguishable to the player
      // per SUB-003). 4xx = rejected; keep the dialog open so the player can
      // retry. We never read the response body for a score (SUB-007).
      if (response.ok) {
        setSubmitted(true);
        setShowSubmitConfirm(false);
      }
    } catch {
      // Network error: keep the dialog open so the player can retry.
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitted, roundId, sessionToken, deviceId, flushAutosave]);

  const onSubmitCancel = useCallback(() => {
    if (submitting) return;
    setShowSubmitConfirm(false);
  }, [submitting]);

  if (!isLandscape) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("player.rotateDevice")}</h1>
        <p className="text-gray-600">{t("player.rotateDeviceHint")}</p>
      </div>
    );
  }

  // Submitted (Unit 08): read-only view of the answers, no number pad, no edit
  // handlers, no score. The grid is rendered from the player's last autosaved
  // state — the server's authoritative copy. Players can still navigate
  // between puzzles to review their work while they wait for the next round.
  if (submitted) {
    return (
      <div className="flex h-screen flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              {t("gameplay.previous")}
            </button>
            <span className="text-sm text-gray-700">
              {t("gameplay.puzzle")} {currentIndex + 1} {t("gameplay.of")} {questions.length}
            </span>
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              {t("gameplay.next")}
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-green-700">
              {t("gameplay.submitAcceptedTitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 gap-6">
          <div className="flex-1">
            <p className="mb-2 text-xs text-gray-500">
              {t("gameplay.submittedReadOnly")}
            </p>
            {currentQuestion ? (
              <ReadOnlyGrid
                question={currentQuestion}
                grid={grids.get(currentQuestion.id) ?? []}
              />
            ) : null}
          </div>
          <div className="flex w-64 flex-col justify-center">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h2 className="mb-2 font-semibold text-green-900">
                {t("gameplay.submitAcceptedTitle")}
              </h2>
              <p className="text-sm text-green-800">
                {t("gameplay.submitAcceptedBody")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const starting = Array.isArray(currentQuestion.startingGrid)
    ? (currentQuestion.startingGrid as (number | null)[])
    : [];
  const gridSize = currentQuestion.gridRows;
  const numberPadValues = Array.from({ length: gridSize }, (_, i) => i + 1);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex h-screen flex-col p-4">
      {/* Header: puzzle navigation + timer */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            {t("gameplay.previous")}
          </button>
          <span className="text-sm text-gray-700">
            {t("gameplay.puzzle")} {currentIndex + 1} {t("gameplay.of")} {questions.length}
            {" · "}
            {currentQuestion.points} {t("gameplay.points")}
          </span>
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIndex === questions.length - 1}
          >
            {t("gameplay.next")}
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{t("gameplay.timeLeft")}</p>
          <p className="text-2xl font-bold tabular-nums">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </p>
        </div>
      </div>

      {/* Body: grid on the left, number pad on the right */}
      <div className="flex flex-1 gap-6">
        <div className="flex-1">
          <div
            className="grid h-full w-full gap-px bg-gray-400"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            }}
          >
            {currentGrid.map((value, index) => {
              const isGiven = starting[index] != null;
              const isSelected = selectedCell === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedCell(index)}
                  className={[
                    "flex items-center justify-center bg-white text-xl font-semibold",
                    isGiven ? "text-gray-900" : "text-blue-700",
                    isSelected ? "outline outline-2 outline-blue-500" : "",
                  ].join(" ")}
                >
                  {value ?? ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex w-48 flex-col gap-2">
          <div className="grid flex-1 grid-cols-3 gap-2">
            {numberPadValues.map((value) => (
              <button
                key={value}
                type="button"
                className="rounded border border-gray-300 bg-white py-2 text-xl font-semibold disabled:opacity-40"
                disabled={selectedCell == null}
                onClick={() => selectedCell != null && setCell(selectedCell, value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white py-2 disabled:opacity-40"
            disabled={selectedCell == null}
            onClick={onDelete}
          >
            {t("gameplay.delete")}
          </button>
          <button
            type="button"
            className="rounded border border-red-300 bg-red-50 py-2 text-red-700"
            onClick={onClearAll}
          >
            {t("gameplay.clearAll")}
          </button>
          <button
            type="button"
            className="rounded border border-green-600 bg-green-600 py-2 font-semibold text-white disabled:opacity-40"
            onClick={onSubmitClick}
            disabled={submitting}
          >
            {submitting ? t("gameplay.submitting") : t("gameplay.submit")}
          </button>
        </div>
      </div>

      {/* Submit confirmation dialog (Unit 08). Names the blank-puzzle count. */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-semibold">
              {t("gameplay.submitConfirmTitle")}
            </h2>
            <p className="mb-3 text-sm text-gray-700">
              {t("gameplay.submitConfirmBody")}
            </p>
            <p className="mb-4 text-sm font-medium text-gray-900">
              {blankPuzzleCount > 0 ? (
                <>
                  {t("gameplay.submitConfirmBlanks")}
                  {blankPuzzleCount}
                </>
              ) : (
                t("gameplay.submitConfirmNone")
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 disabled:opacity-40"
                onClick={onSubmitCancel}
                disabled={submitting}
              >
                {t("gameplay.submitConfirmCancel")}
              </button>
              <button
                type="button"
                className="rounded bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                onClick={() => void onSubmitConfirm()}
                disabled={submitting}
              >
                {submitting ? t("gameplay.submitting") : t("gameplay.submitConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A read-only Sudoku grid used by the "submission accepted" view (Unit 08).
 * Renders the player's locked-in answers with givens in dark text and entries
 * in blue — same colour language as the editable grid, but with no click
 * targets, no selection outline, and no number pad.
 */
function ReadOnlyGrid({
  question,
  grid,
}: {
  question: RoundQuestionPayload;
  grid: (number | null)[];
}) {
  const starting = Array.isArray(question.startingGrid)
    ? (question.startingGrid as (number | null)[])
    : [];
  const gridSize = question.gridRows;
  return (
    <div
      className="grid h-full w-full gap-px bg-gray-400"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
      }}
    >
      {grid.map((value, index) => {
        const isGiven = starting[index] != null;
        return (
          <div
            key={index}
            className={[
              "flex items-center justify-center bg-white text-xl font-semibold",
              isGiven ? "text-gray-900" : "text-blue-700",
            ].join(" ")}
          >
            {value ?? ""}
          </div>
        );
      })}
    </div>
  );
}
