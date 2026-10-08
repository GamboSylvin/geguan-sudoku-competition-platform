/**
 * The big-screen ranking page (Unit 09). A receive-only spoke: it connects to the
 * `/big-screen` namespace with the `bigScreenLinkToken` from the route (no login,
 * BSC-001), listens for the server-pushed `ranking:update`, and renders exactly
 * what the server sends. It performs no ranking computation of its own
 * (invariant 8) — the server has already ordered the rows and assigned the ranks.
 *
 * Rotation is server-driven: the big-screen service advances through the
 * competition's categories every `rankingCycleSeconds` and pushes the next
 * leaderboard; this page simply swaps to whatever category the latest push names.
 * A category leaderboard that does not fit one screen is paginated locally — pure
 * display of the server-supplied rows, not computation.
 *
 * Unit 11 adds the display mode (BSC-002). The controller picks it and the server
 * pushes `bigScreen:mode`; this page renders the mode it is told and never decides
 * one itself. Only `RANKING`, `PAUSED` and `FINAL` have a screen — the schema's
 * `PLAYER_CLOSEUP` and `TEAM_SPLIT` have no data behind them yet and fall through to
 * the ranking view so a mode the controller can set is never a blank screen.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";

/** The payload shape the server pushes on `ranking:update` (the wire contract). */
interface RankingRowPayload {
  rank: number;
  participantId: string;
  participantName: string;
  score: number;
  completionTimeSeconds: number;
}

interface BigScreenRankingPayload {
  competitionId: string;
  categoryId: string;
  categoryName: string;
  scope: "INDIVIDUAL";
  isFinal: boolean;
  pageIndex: number;
  pageCount: number;
  rows: RankingRowPayload[];
}

/**
 * The display mode pushed on `bigScreen:mode`. `RANKING` shows the leaderboard;
 * `PAUSED` and `FINAL` show a full-screen label. `PLAYER_CLOSEUP` and `TEAM_SPLIT`
 * exist in the schema's enum but have no screen yet — treated as RANKING so a mode
 * the server can send never blanks the display.
 */
type BigScreenMode = "RANKING" | "PAUSED" | "FINAL" | "PLAYER_CLOSEUP" | "TEAM_SPLIT";

/** How many leaderboard rows fit one screen before the display paginates. */
const ROWS_PER_PAGE = 12;
/** How long one leaderboard page stays before the next page of the same category. */
const PAGE_MS = 8000;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function BigScreenPage() {
  const { t } = useLocale();
  const { token } = useParams<{ token: string }>();
  const [ranking, setRanking] = useState<BigScreenRankingPayload | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "invalid">("connecting");
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<BigScreenMode>("RANKING");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const socket: Socket = io(`${API_BASE_URL}/big-screen`, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("ranking:update", (payload: BigScreenRankingPayload) => {
      setRanking(payload);
      setStatus("live");
      // A fresh category push restarts local pagination from its first page.
      setPage(0);
    });
    socket.on(
      "bigScreen:mode",
      (payload: { mode: BigScreenMode; targetId: string | null; rotationEnabled: boolean }) => {
        setMode(payload.mode);
      },
    );
    socket.on("connect_error", () => setStatus("invalid"));
    socket.on("disconnect", () => setStatus((s) => (s === "invalid" ? s : "connecting")));

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const pageCount = useMemo(
    () => (ranking ? Math.max(1, Math.ceil(ranking.rows.length / ROWS_PER_PAGE)) : 1),
    [ranking],
  );

  // Local pagination within one category's leaderboard. This cycles the pages of
  // the rows the server already sent; it does not compute or reorder anything.
  useEffect(() => {
    if (pageCount <= 1) return;
    const handle = window.setInterval(() => {
      setPage((current) => (current + 1) % pageCount);
    }, PAGE_MS);
    return () => window.clearInterval(handle);
  }, [pageCount]);

  const visibleRows = useMemo(() => {
    if (!ranking) return [];
    const start = page * ROWS_PER_PAGE;
    return ranking.rows.slice(start, start + ROWS_PER_PAGE);
  }, [ranking, page]);

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-2xl">{t("bigScreen.invalidLink")}</p>
      </div>
    );
  }

  // The controller's mode wins over "nothing pushed yet": a paused or final screen
  // is a deliberate full-screen state, not a waiting message (BSC-002).
  if (mode === "PAUSED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-7xl font-bold">{t("bigScreen.pausedScreen")}</p>
      </div>
    );
  }

  if (status === "connecting" || !ranking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-2xl">
          {status === "connecting" ? t("bigScreen.connecting") : t("bigScreen.waiting")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 px-10 py-8 text-white">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-4xl font-bold">
          {t("bigScreen.title")} · {ranking.categoryName}
        </h1>
        <div className="flex items-baseline gap-4 text-xl text-gray-300">
          <span>
            {ranking.isFinal || mode === "FINAL"
              ? t("bigScreen.final")
              : t("bigScreen.provisional")}
          </span>
          {ranking.pageCount > 1 && (
            <span>
              {ranking.pageIndex + 1} {t("bigScreen.pageOf")} {ranking.pageCount}
            </span>
          )}
        </div>
      </header>

      {visibleRows.length === 0 ? (
        <p className="text-2xl text-gray-400">{t("bigScreen.empty")}</p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-left text-xl text-gray-400">
              <th className="w-24 py-3">{t("bigScreen.colRank")}</th>
              <th className="py-3">{t("bigScreen.colPlayer")}</th>
              <th className="w-40 py-3 text-right">{t("bigScreen.colScore")}</th>
              <th className="w-40 py-3 text-right">{t("bigScreen.colTime")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.participantId}
                className="border-b border-gray-800 text-3xl font-semibold"
              >
                <td className="py-4 tabular-nums">{row.rank}</td>
                <td className="py-4">{row.participantName}</td>
                <td className="py-4 text-right tabular-nums">{row.score}</td>
                <td className="py-4 text-right tabular-nums text-gray-300">
                  {formatTime(row.completionTimeSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
