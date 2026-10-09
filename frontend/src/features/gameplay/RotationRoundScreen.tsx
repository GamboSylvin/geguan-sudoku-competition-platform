/**
 * The Team stage's rotation-round tablet view (Unit 13). One member, one
 * currently-held question, one submit button.
 *
 * How this differs from the Individual `ActiveRoundScreen`:
 *   - **One question at a time**, and it is not the member's own: it rotates in
 *     from a teammate every `rotationPeriodSeconds`, together with whatever they
 *     had already typed ("questions rotate, not seats", TEM-002/TEM-004). The
 *     partial grid therefore arrives pre-filled and is never reset here.
 *   - **The score is shown.** A team round's score is one shared, flat value
 *     (`correctCount × teamPointsPerQuestion`, SCR-007/SCR-015), not a hidden
 *     per-player result — so unlike SUB-007/BLD-029 there is nothing to conceal.
 *   - **A submit is checked immediately** and answered with correct/incorrect.
 *     An incorrect submit changes nothing: the question stays in circulation and
 *     rotates on, so a teammate can finish it.
 *   - **No autosave.** A grid is only sent when the member submits it, because
 *     the grid's next owner is a different tablet and the server's held copy is
 *     the one that moves with the question.
 *   - **A "nothing to work on" state** for the member whose tablet is empty after
 *     the queue ran out (spec Detail 3).
 *
 * Still landscape-only (UI-001/PAR-006), and the countdowns are cosmetic: the
 * server's deadlines are the authority (invariant 3).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";

interface RotationQuestionPayload {
  id: string;
  sequence: number;
  type: "STANDARD" | "VARIANT";
  gridRows: number;
  gridColumns: number;
  regions: unknown;
  startingGrid: unknown;
  points: number;
}

/** The member's own holding, as the deal/rotated pushes and the state read carry it. */
export interface RotationHold {
  question: RotationQuestionPayload;
  grid: (number | null)[];
}

export interface RotationEndedResult {
  reason: "ALL_CORRECT" | "TIME_LIMIT";
  correctCount: number;
  score: number;
  completionTimeSeconds: number | null;
}

/**
 * Everything the screen renders except the grid itself. The parent (`PlayerPage`)
 * owns this object: it replaces it wholesale on each `rotation:deal` /
 * `rotation:rotated` push and on the reconnect read, so the screen never has to
 * reconcile a partial update against a question that has already moved on.
 */
export interface RotationViewState {
  roundId: string;
  teamId: string;
  hold: RotationHold | null;
  totalQuestionCount: number;
  correctCount: number;
  teamScore: number;
  /** Server-clock epoch ms when this question rotates away, or 0 when unknown. */
  nextRotationAtMs: number;
  rotationPeriodSeconds: number;
  /** Server-clock epoch ms when the optional total time runs out, or null. */
  totalTimeDeadlineMs: number | null;
  ended: RotationEndedResult | null;
  /** Set when a `rotation:rotated` push says the tablet was refreshed. */
  rotatedReason?: "ROTATION" | "REFILL" | "STALE_HOLD" | "RECONNECT";
}

interface RotationRoundScreenProps {
  state: RotationViewState;
  sessionToken: string;
  deviceId: string;
}

/** How long the correct/incorrect banner stays up before it fades. */
const FEEDBACK_MS = 2500;

export function RotationRoundScreen({
  state,
  sessionToken,
  deviceId,
}: RotationRoundScreenProps) {
  const { t } = useLocale();
  const question = state.hold?.question ?? null;
  const questionId = question?.id ?? null;

  // The working grid is local: edits belong to this tablet until they are
  // submitted, and are thrown away when a new question rotates in.
  const [grid, setGrid] = useState<(number | null)[]>(state.hold?.grid ?? []);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined" ? window.innerWidth >= window.innerHeight : true,
  );

  // A rotation replaces the question wholesale: take the arriving grid (which
  // carries the previous member's progress) and drop every local edit.
  useEffect(() => {
    setGrid(state.hold?.grid ?? []);
    setSelectedCell(null);
    setFeedback(null);
    setError(null);
  }, [questionId, state.hold?.grid]);

  // The submit is bound to the question it was aimed at. If a rotation lands
  // mid-flight, the response describes a question this tablet no longer holds, so
  // it is discarded rather than shown as feedback for the new one.
  const submittedQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth >= window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const handle = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => window.clearTimeout(handle);
  }, [feedback]);

  const starting = useMemo(
    () => (Array.isArray(question?.startingGrid) ? (question!.startingGrid as (number | null)[]) : []),
    [question],
  );

  const setCell = useCallback(
    (cellIndex: number, value: number | null) => {
      if (!question) return;
      // Given cells are read-only, exactly as in the Individual stage.
      if (starting[cellIndex] != null) return;
      setGrid((current) => {
        const next = [...current];
        next[cellIndex] = value;
        return next;
      });
    },
    [question, starting],
  );

  const onDelete = useCallback(() => {
    if (selectedCell == null) return;
    setCell(selectedCell, null);
  }, [selectedCell, setCell]);

  const onClearAll = useCallback(() => {
    if (!question) return;
    setGrid((current) => current.map((value, index) => (starting[index] == null ? null : value)));
  }, [question, starting]);

  const onSubmit = useCallback(async () => {
    if (!question || submitting || state.ended) return;
    setSubmitting(true);
    setError(null);
    submittedQuestionRef.current = question.id;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/gameplay/rotation/${state.roundId}/submit`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-session-token": sessionToken,
            "x-device-id": deviceId,
          },
          body: JSON.stringify({ questionId: question.id, grid }),
        },
      );
      // A rotation may have landed while this was in flight; the push has already
      // replaced the screen, so the answer belongs to a question we no longer hold.
      if (submittedQuestionRef.current !== question.id) return;

      if (response.ok) {
        const body = (await response.json()) as { correct: boolean };
        setFeedback(body.correct ? "correct" : "incorrect");
        return;
      }
      // 409 stale-hold / round-ended: the server has already pushed what the
      // tablet holds now (spec Error Cases), so only say why, don't retry.
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      const code = body?.error?.code;
      setError(
        code === "rotation.staleHold"
          ? t("rotation.errorStale")
          : code === "rotation.roundEnded"
            ? t("rotation.errorEnded")
            : t("rotation.errorGeneric"),
      );
    } catch {
      setError(t("rotation.errorGeneric"));
    } finally {
      if (submittedQuestionRef.current === question.id) setSubmitting(false);
    }
  }, [question, submitting, state.ended, state.roundId, sessionToken, deviceId, grid, t]);

  if (!isLandscape) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("player.rotateDevice")}</h1>
        <p className="text-gray-600">{t("player.rotateDeviceHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col p-4">
      <RotationHeader state={state} />

      <div className="flex flex-1 gap-6">
        <div className="flex-1">
          {state.ended ? (
            <RoundEndedPanel state={state} />
          ) : question ? (
            <EditableGrid
              grid={grid}
              starting={starting}
              gridSize={question.gridRows}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
            />
          ) : (
            <NothingToWorkOnPanel />
          )}
        </div>

        <div className="flex w-56 flex-col gap-2">
          <div className="grid flex-1 grid-cols-3 gap-2">
            {Array.from({ length: question?.gridRows ?? 4 }, (_, i) => i + 1).map((value) => (
              <button
                key={value}
                type="button"
                className="rounded border border-gray-300 bg-white py-2 text-xl font-semibold disabled:opacity-40"
                disabled={!question || selectedCell == null || Boolean(state.ended)}
                onClick={() => selectedCell != null && setCell(selectedCell, value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white py-2 disabled:opacity-40"
            disabled={!question || selectedCell == null || Boolean(state.ended)}
            onClick={onDelete}
          >
            {t("gameplay.delete")}
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white py-2 disabled:opacity-40"
            disabled={!question || Boolean(state.ended)}
            onClick={onClearAll}
          >
            {t("gameplay.clearAll")}
          </button>
          <button
            type="button"
            className="rounded border border-green-600 bg-green-600 py-2 font-semibold text-white disabled:opacity-40"
            disabled={!question || submitting || Boolean(state.ended)}
            onClick={() => void onSubmit()}
          >
            {submitting ? t("rotation.submitting") : t("rotation.submit")}
          </button>

          {feedback === "correct" && (
            <p className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
              {t("rotation.correct")}
            </p>
          )}
          {feedback === "incorrect" && (
            <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              {t("rotation.incorrect")}
            </p>
          )}
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {state.rotatedReason === "STALE_HOLD" && !error && (
            <p className="rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">
              {t("rotation.staleHold")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Team score, solved-count and the rotation countdown. The countdown re-anchors on
 * every push and ticks locally in between; the server's deadline is the authority
 * (invariant 3), so it is display only and never triggers anything here.
 */
function RotationHeader({ state }: { state: RotationViewState }) {
  const { t } = useLocale();
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, state.nextRotationAtMs - Date.now()),
  );

  useEffect(() => {
    setRemainingMs(Math.max(0, state.nextRotationAtMs - Date.now()));
  }, [state.nextRotationAtMs]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 100));
    }, 100);
    return () => window.clearInterval(handle);
  }, []);

  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-sm text-gray-700">
        <span className="font-semibold text-green-700">
          {t("rotation.teamScore")}: {state.teamScore}
        </span>
        <span className="mx-2 text-gray-400">·</span>
        <span>
          {t("rotation.progress")}: {state.correctCount} / {state.totalQuestionCount}
        </span>
      </div>
      {!state.ended && state.nextRotationAtMs > 0 && (
        <div className="text-right">
          <p className="text-xs text-gray-500">{t("rotation.nextRotation")}</p>
          <p className="text-2xl font-bold tabular-nums">{seconds}s</p>
        </div>
      )}
    </div>
  );
}

function EditableGrid({
  grid,
  starting,
  gridSize,
  selectedCell,
  onSelectCell,
}: {
  grid: (number | null)[];
  starting: (number | null)[];
  gridSize: number;
  selectedCell: number | null;
  onSelectCell: (index: number) => void;
}) {
  return (
    <div
      className="grid h-full w-full gap-px bg-gray-400"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {grid.map((value, index) => {
        const isGiven = starting[index] != null;
        const isSelected = selectedCell === index;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectCell(index)}
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
  );
}

/** The queue ran out: this member waits for a question to rotate in (Detail 3). */
function NothingToWorkOnPanel() {
  const { t } = useLocale();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
      <h2 className="text-xl font-semibold text-gray-800">{t("rotation.nothingToWorkOn")}</h2>
      <p className="max-w-md text-sm text-gray-600">{t("rotation.nothingToWorkOnHint")}</p>
    </div>
  );
}

/**
 * The round is over. The score is shown here because a team round's score is a
 * shared flat value (SCR-007/SCR-015) — there is no per-player result to hide, and
 * no early-finish bonus was ever computed (Acceptance Criterion 7).
 */
function RoundEndedPanel({ state }: { state: RotationViewState }) {
  const { t } = useLocale();
  const ended = state.ended;
  if (!ended) return null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
      <h2 className="text-2xl font-semibold text-green-900">{t("rotation.roundEnded")}</h2>
      <p className="text-sm text-green-800">
        {ended.reason === "ALL_CORRECT"
          ? t("rotation.roundEndedAllCorrect")
          : t("rotation.roundEndedTimeLimit")}
      </p>
      <p className="text-5xl font-bold tabular-nums text-green-900">{ended.score}</p>
      <p className="text-sm text-green-800">
        {t("rotation.progress")}: {ended.correctCount} / {state.totalQuestionCount}
      </p>
    </div>
  );
}
