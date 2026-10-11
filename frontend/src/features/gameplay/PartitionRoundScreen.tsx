/**
 * The Team stage's partition-round tablet view (Unit 14, 齐心协力). One member, one
 * shared puzzle, one editable row-band.
 *
 * How this differs from the rotation screen beside it:
 *   - **The whole puzzle is visible, but only this member's rows are editable.** The
 *     server cuts the grid into contiguous horizontal bands, one per active member
 *     (TEM-005), and enforces the cut per cell — a value outside the band is a 422,
 *     not a silent trim. Everything else is rendered read-only rather than hidden, so
 *     the team can see the puzzle it is solving together (the flagged assumption
 *     `showOtherBandsReadOnly()` on the server).
 *   - **There is no submit button.** The puzzle scores the instant the *combined*
 *     grid — every band merged over the given cells — is fully correct, so the only
 *     thing a member does is type. The server evaluates after every autosave and
 *     pushes the advance; this screen never reports its own correctness.
 *   - **Every edit autosaves**, debounced, like the Individual stage — but the write
 *     is band-scoped: the grid sent is the whole board (one shape for every gameplay
 *     screen) and the server keeps only the caller's rows.
 *   - **Progress, not correctness.** The header shows `puzzle N of M`, the solved
 *     count and the shared flat team score (`solvedCount × partitionPointsPerPuzzle`,
 *     SCR-007/SCR-015). No early-finish bonus is ever shown, because none exists.
 *
 * Still landscape-only (UI-001/PAR-006), and the countdown is cosmetic: the server's
 * deadline is the authority (invariant 3).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";

interface PartitionQuestionPayload {
  id: string;
  sequence: number;
  type: "STANDARD" | "VARIANT";
  gridRows: number;
  gridColumns: number;
  regions: unknown;
  startingGrid: unknown;
  points: number;
}

/** This member's contiguous row-band; both ends inclusive. */
export interface PartitionBand {
  participantId: string;
  startRow: number;
  endRow: number;
}

export interface PartitionEndedResult {
  reason: "ALL_SOLVED" | "TIME_LIMIT";
  solvedCount: number;
  score: number;
  completionTimeSeconds: number | null;
}

/**
 * Everything the screen renders. The parent (`PlayerPage`) owns this object and
 * replaces it wholesale on each `partition:deal` / `partition:puzzle-solved` push and
 * on the reconnect read, so the screen never reconciles a partial update against a
 * puzzle the team has already moved past.
 */
export interface PartitionViewState {
  roundId: string;
  teamId: string;
  participantId: string;
  puzzle: PartitionQuestionPayload | null;
  band: PartitionBand | null;
  /** The combined grid: every member's cells merged over the given cells. */
  grid: (number | null)[];
  puzzleIndex: number;
  puzzleCount: number;
  solvedCount: number;
  teamScore: number;
  /** Server-clock epoch ms when the round's total time runs out. */
  totalTimeDeadlineMs: number;
  ended: PartitionEndedResult | null;
  /** Set when a `partition:puzzle-solved` push refreshed the tablet. */
  solvedReason?: "DEAL" | "PUZZLE_SOLVED" | "RECONNECT";
}

interface PartitionRoundScreenProps {
  state: PartitionViewState;
  sessionToken: string;
  deviceId: string;
}

/** Autosave cadence: roughly twice a second, the Individual stage's interval. */
const AUTOSAVE_DEBOUNCE_MS = 500;

export function PartitionRoundScreen({
  state,
  sessionToken,
  deviceId,
}: PartitionRoundScreenProps) {
  const { t } = useLocale();
  const puzzle = state.puzzle;
  const puzzleId = puzzle?.id ?? null;

  const [grid, setGrid] = useState<(number | null)[]>(state.grid ?? []);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined" ? window.innerWidth >= window.innerHeight : true,
  );

  /** The grid as the server last confirmed it — the base local edits are diffed against. */
  const serverGridRef = useRef<(number | null)[]>(state.grid ?? []);
  /**
   * The puzzle an in-flight autosave was aimed at. A `partition:puzzle-solved` push
   * can land mid-flight; its response then describes a puzzle this tablet no longer
   * holds, so it is discarded rather than written over the fresh grid.
   */
  const inFlightPuzzleRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  /** The edit the pending debounce will send, kept so an unmount can flush it. */
  const pendingRef = useRef<{ grid: (number | null)[]; questionId: string } | null>(null);

  // A new puzzle (or a reconnect read) replaces the board wholesale: take the
  // server's combined grid and drop every un-sent local edit.
  useEffect(() => {
    const incoming = state.grid ?? [];
    serverGridRef.current = incoming;
    setGrid(incoming);
    setSelectedCell(null);
    setError(null);
  }, [puzzleId, state.grid, state.solvedReason]);

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth >= window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const columns = puzzle?.gridColumns ?? 0;
  const rows = puzzle?.gridRows ?? 0;

  /**
   * The given cells, flattened the same way the server flattens them: the importer
   * stores `startingGrid` as a row-major matrix with `0` for "blank", while every
   * other source is already a flat array. Both shapes have to render identically.
   */
  const given = useMemo(() => {
    const stored = puzzle?.startingGrid;
    if (!Array.isArray(stored) || rows <= 0 || columns <= 0) return [] as (number | null)[];
    const cells: unknown[] = [];
    const isMatrix = stored.length > 0 && Array.isArray(stored[0]);
    if (isMatrix) {
      for (const row of stored) {
        if (!Array.isArray(row)) return [] as (number | null)[];
        cells.push(...row);
      }
    } else {
      cells.push(...stored);
    }
    if (cells.length !== rows * columns) return [] as (number | null)[];
    return cells.map((v) => (typeof v === "number" && v !== 0 ? v : null));
  }, [puzzle, rows, columns]);

  /** Whether this cell sits inside the caller's own band — the only editable cells. */
  const isOwnCell = useCallback(
    (cellIndex: number) => {
      if (!state.band || columns <= 0) return false;
      const row = Math.floor(cellIndex / columns);
      return row >= state.band.startRow && row <= state.band.endRow;
    },
    [state.band, columns],
  );

  const sendAutosave = useCallback(
    async (next: (number | null)[], aimedAt: string) => {
      if (!puzzle) return;
      inFlightPuzzleRef.current = aimedAt;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/gameplay/partition/${state.roundId}/autosave`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-session-token": sessionToken,
              "x-device-id": deviceId,
            },
            // The server keeps only this member's band cells and rejects anything
            // else, so sending the whole board is safe by construction — but only
            // the band's own edits are ever in it (the rest come from the server).
            body: JSON.stringify({ questionId: aimedAt, grid: next }),
          },
        );
        if (inFlightPuzzleRef.current !== aimedAt) return;
        if (response.ok) {
          serverGridRef.current = next;
          setError(null);
          return;
        }
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        const code = body?.error?.code;
        setError(
          code === "partition.stalePuzzle"
            ? t("partition.errorStale")
            : code === "partition.outsideBand"
              ? t("partition.errorOutsideBand")
              : code === "partition.roundEnded"
                ? t("partition.errorEnded")
                : t("partition.errorGeneric"),
        );
      } catch {
        if (inFlightPuzzleRef.current === aimedAt) setError(t("partition.errorGeneric"));
      }
    },
    [puzzle, state.roundId, sessionToken, deviceId, t],
  );

  /** Queue a debounced send. Edits are kept locally the instant they happen. */
  const queueAutosave = useCallback(
    (next: (number | null)[], aimedAt: string) => {
      pendingRef.current = { grid: next, questionId: aimedAt };
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        pendingRef.current = null;
        void sendAutosave(next, aimedAt);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [sendAutosave],
  );

  /**
   * Flush on unmount. A pause or a `puzzle-solved` push unmounts this screen, and
   * digits typed inside the last half-second would otherwise be dropped — which
   * matters here because there is no submit button to re-send them with.
   */
  useEffect(
    () => () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      void fetch(`${API_BASE_URL}/api/gameplay/partition/${state.roundId}/autosave`, {
        method: "POST",
        keepalive: true,
        headers: {
          "content-type": "application/json",
          "x-session-token": sessionToken,
          "x-device-id": deviceId,
        },
        body: JSON.stringify({ questionId: pending.questionId, grid: pending.grid }),
      }).catch(() => undefined);
    },
    [state.roundId, sessionToken, deviceId],
  );

  const setCell = useCallback(
    (cellIndex: number, value: number | null) => {
      if (!puzzle || !puzzleId || state.ended) return;
      // Given cells and every row outside this member's band are read-only. The
      // server enforces the same rule per cell; doing it here only saves a round trip.
      if (given[cellIndex] != null) return;
      if (!isOwnCell(cellIndex)) return;
      const next = [...grid];
      next[cellIndex] = value;
      setGrid(next);
      queueAutosave(next, puzzleId);
    },
    [puzzle, puzzleId, state.ended, given, isOwnCell, grid, queueAutosave],
  );

  const onDelete = useCallback(() => {
    if (selectedCell == null) return;
    setCell(selectedCell, null);
  }, [selectedCell, setCell]);

  const onClearMine = useCallback(() => {
    if (!puzzle || !puzzleId || state.ended) return;
    const next = grid.map((value, index) =>
      isOwnCell(index) && given[index] == null ? null : value,
    );
    setGrid(next);
    queueAutosave(next, puzzleId);
  }, [puzzle, puzzleId, state.ended, grid, isOwnCell, given, queueAutosave]);

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
      <PartitionHeader state={state} rows={rows} />

      <div className="flex flex-1 gap-6">
        <div className="flex-1">
          {state.ended ? (
            <RoundEndedPanel state={state} />
          ) : puzzle ? (
            <BandGrid
              grid={grid}
              given={given}
              rows={rows}
              columns={columns}
              band={state.band}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
            />
          ) : (
            <NoPuzzlePanel />
          )}
        </div>

        <div className="flex w-56 flex-col gap-2">
          <div className="grid flex-1 grid-cols-3 gap-2">
            {Array.from({ length: Math.max(rows, 1) }, (_, i) => i + 1).map((value) => (
              <button
                key={value}
                type="button"
                className="rounded border border-gray-300 bg-white py-2 text-xl font-semibold disabled:opacity-40"
                disabled={!puzzle || selectedCell == null || Boolean(state.ended)}
                onClick={() => selectedCell != null && setCell(selectedCell, value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white py-2 disabled:opacity-40"
            disabled={!puzzle || selectedCell == null || Boolean(state.ended)}
            onClick={onDelete}
          >
            {t("gameplay.delete")}
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white py-2 disabled:opacity-40"
            disabled={!puzzle || Boolean(state.ended)}
            onClick={onClearMine}
          >
            {t("gameplay.clearAll")}
          </button>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {state.solvedReason === "PUZZLE_SOLVED" && !error && (
            <p className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
              {t("partition.puzzleSolved")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Team score, puzzle progress, solved count and the total-time countdown. The
 * countdown re-anchors on every push and ticks locally in between; the server's
 * deadline is the authority (invariant 3), so it is display only and never ends
 * anything here.
 */
function PartitionHeader({ state, rows }: { state: PartitionViewState; rows: number }) {
  const { t } = useLocale();
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, state.totalTimeDeadlineMs - Date.now()),
  );

  useEffect(() => {
    setRemainingMs(Math.max(0, state.totalTimeDeadlineMs - Date.now()));
  }, [state.totalTimeDeadlineMs]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 1000));
    }, 1000);
    return () => window.clearInterval(handle);
  }, []);

  const seconds = Math.ceil(remainingMs / 1000);
  const band = state.band;

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-sm text-gray-700">
        <span className="font-semibold text-green-700">
          {t("partition.teamScore")}: {state.teamScore}
        </span>
        <span className="mx-2 text-gray-400">·</span>
        <span>
          {t("partition.progress")}: {state.puzzleCount > 0 ? state.puzzleIndex + 1 : 0} /{" "}
          {state.puzzleCount}
        </span>
        <span className="mx-2 text-gray-400">·</span>
        <span>
          {t("partition.solved")}: {state.solvedCount}
        </span>
        <span className="mx-2 text-gray-400">·</span>
        <span className="text-gray-600">
          {band && band.endRow >= band.startRow
            ? `${t("partition.yourRows")}: ${band.startRow + 1}–${band.endRow + 1} / ${rows}`
            : t("partition.yourRowsNone")}
        </span>
      </div>
      {!state.ended && state.totalTimeDeadlineMs > 0 && (
        <div className="text-right">
          <p className="text-xs text-gray-500">{t("partition.timeLeft")}</p>
          <p className="text-2xl font-bold tabular-nums">{formatClock(seconds)}</p>
        </div>
      )}
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The shared puzzle. Three cell kinds, by style only:
 *   - **given** — dark, never editable (the server ignores a value written there);
 *   - **inside the caller's band** — blue on a tinted background, the only editable cells;
 *   - **a teammate's band** — grey, read-only, so the team sees the whole puzzle.
 * Rows are numbered at the left so a member can tell which rows are theirs.
 */
function BandGrid({
  grid,
  given,
  rows,
  columns,
  band,
  selectedCell,
  onSelectCell,
}: {
  grid: (number | null)[];
  given: (number | null)[];
  rows: number;
  columns: number;
  band: PartitionBand | null;
  selectedCell: number | null;
  onSelectCell: (index: number) => void;
}) {
  const inBand = (index: number) => {
    if (!band || columns <= 0) return false;
    const row = Math.floor(index / columns);
    return row >= band.startRow && row <= band.endRow;
  };

  return (
    <div className="flex h-full gap-1">
      <div
        className="grid gap-px text-xs text-gray-400"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className={[
              "flex w-6 items-center justify-center",
              band && row >= band.startRow && row <= band.endRow
                ? "font-semibold text-blue-700"
                : "",
            ].join(" ")}
          >
            {row + 1}
          </div>
        ))}
      </div>
      <div
        className="grid h-full flex-1 gap-px bg-gray-400"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {grid.map((value, index) => {
          const isGiven = given[index] != null;
          const mine = inBand(index);
          const isSelected = selectedCell === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectCell(index)}
              className={[
                "flex items-center justify-center text-xl font-semibold",
                isGiven
                  ? "bg-gray-100 text-gray-900"
                  : mine
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white text-gray-400",
                isSelected ? "outline outline-2 outline-blue-500" : "",
              ].join(" ")}
            >
              {value ?? ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * No puzzle to show: the category pool was empty, or the round ended while this
 * tablet was away and only the settled result came back. The ended panel takes over
 * in the second case, so this is the empty-pool path.
 */
function NoPuzzlePanel() {
  const { t } = useLocale();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
      <h2 className="text-xl font-semibold text-gray-800">{t("rotation.nothingToWorkOn")}</h2>
      <p className="max-w-md text-sm text-gray-600">{t("partition.rowsHint")}</p>
    </div>
  );
}

/**
 * The round is over. The score is shown because a team round's score is one shared
 * flat value (SCR-007/SCR-015) — there is no per-player result to hide, and no
 * early-finish bonus was ever computed (Unit 14 Constraints).
 */
function RoundEndedPanel({ state }: { state: PartitionViewState }) {
  const { t } = useLocale();
  const ended = state.ended;
  if (!ended) return null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
      <h2 className="text-2xl font-semibold text-green-900">{t("partition.roundEnded")}</h2>
      <p className="text-sm text-green-800">
        {ended.reason === "ALL_SOLVED"
          ? t("partition.roundEndedAllSolved")
          : t("partition.roundEndedTimeLimit")}
      </p>
      <p className="text-5xl font-bold tabular-nums text-green-900">{ended.score}</p>
      <p className="text-sm text-green-800">
        {t("partition.solved")}: {ended.solvedCount} / {state.puzzleCount}
      </p>
      {ended.completionTimeSeconds != null && (
        <p className="text-sm text-green-800">
          {t("partition.completionTime")}: {ended.completionTimeSeconds}
          {t("partition.seconds")}
        </p>
      )}
    </div>
  );
}
