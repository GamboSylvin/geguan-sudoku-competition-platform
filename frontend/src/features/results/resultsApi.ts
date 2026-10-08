import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The controller's results feature API client (Unit 12).
 *
 * Every call here targets `/api/competitions/:id/...` and is controller-only on the
 * server (ROL-002). The session token and device id come from the stored session
 * (Unit 02) and ride on every request; the client is never trusted for identity.
 *
 * Three reads and one write map to the backend's four surfaces:
 *   - `fetchResults`  — `GET  /results`   (the scores, ranks and the purge date)
 *   - `listCorrections` — `GET /corrections` (the change log the screen shows)
 *   - `createCorrection` — `POST /corrections` (the mandatory-reason write)
 *   - `downloadExport` — `GET /export`    (the `.xlsx` binary)
 *
 * The export is the one call that cannot go through the JSON-parsing `request<T>`
 * helper: it returns an `.xlsx` **binary** with a `content-disposition` header, so
 * it fetches the bytes, wraps them in a Blob and hands them to the browser to save.
 */

export class ResultsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "ResultsApiError";
  }
}

/** The session headers every results request must carry. */
function authHeaders(): Record<string, string> {
  const session = loadSession();
  return session
    ? { "x-session-token": session.token, "x-device-id": session.deviceId }
    : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    throw new ResultsApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// The results view (spec Detail 1, acceptance criterion 1)
// ---------------------------------------------------------------------------

/**
 * One row of the results screen: a participant's result in one round. `rank` is the
 * participant's current category rank (Unit 09's), reused, never recomputed here.
 */
export interface ResultsRowView {
  participantId: string;
  participantName: string;
  participantNumber: number;
  roundId: string;
  score: number | null;
  bonus: number | null;
  totalScore: number | null;
  completionTimeSeconds: number | null;
  submissionType: string | null;
  submittedAt: string | null;
  rank: number | null;
}

export interface ResultsRoundView {
  roundId: string;
  sequence: number;
  name: string;
  status: string;
  rows: ResultsRowView[];
}

export interface ResultsStageView {
  stageId: string;
  type: "INDIVIDUAL" | "TEAM";
  sequence: number;
  status: string;
  name: string;
  rounds: ResultsRoundView[];
}

export interface ResultsCategoryView {
  categoryId: string;
  code: string;
  name: string;
  sequence: number;
  stages: ResultsStageView[];
}

/** One row of a category leaderboard, the shape Unit 09 returns. */
export interface RankingRow {
  rank: number;
  participantId: string;
  participantName: string;
  score: number;
  completionTimeSeconds: number;
}

/** The competition's purge schedule, so the screen can show the deletion date. */
export interface PurgeScheduleView {
  competitionId: string;
  purgeAt: string;
  status: "SCHEDULED" | "EXECUTED";
  executedAt: string | null;
}

export interface ResultsView {
  competitionId: string;
  name: string;
  status: string;
  finishedEarly: boolean;
  finishedAt: string | null;
  cancelledAt: string | null;
  categories: ResultsCategoryView[];
  rankings: Record<string, RankingRow[]>;
  purge: PurgeScheduleView | null;
}

export function fetchResults(competitionId: string): Promise<ResultsView> {
  return request<ResultsView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/results`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// The correction (spec Detail 2, RES-003)
// ---------------------------------------------------------------------------

export interface CorrectionResultView {
  correctionId: string;
  competitionId: string;
  targetType: string;
  targetId: string;
  roundId: string | null;
  oldScore: string;
  newScore: string;
  reason: string;
  correctedAt: string;
  ranking: RankingRow[] | null;
}

export function createCorrection(
  competitionId: string,
  input: {
    targetType: string;
    targetId: string;
    roundId: string;
    newScore: number;
    reason: string;
  },
): Promise<CorrectionResultView> {
  return request<CorrectionResultView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/corrections`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** One row of the correction history the screen lists beside the results. */
export interface CorrectionHistoryRow {
  id: string;
  targetType: string;
  targetId: string;
  roundId: string | null;
  oldScore: string;
  newScore: string;
  reason: string;
  correctedByAccountId: string | null;
  correctedAt: string;
}

export function listCorrections(
  competitionId: string,
): Promise<{ competitionId: string; corrections: CorrectionHistoryRow[] }> {
  return request<{ competitionId: string; corrections: CorrectionHistoryRow[] }>(
    `/api/competitions/${encodeURIComponent(competitionId)}/corrections`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// The export (spec Detail 3, U-08) — a binary download, not a JSON call
// ---------------------------------------------------------------------------

/**
 * Download the competition's `.xlsx` results pack. `GET /export` streams the binary
 * with a `content-disposition` header carrying the server-chosen filename, so this
 * reads the bytes into a Blob, points a temporary object URL at it and clicks a
 * detached anchor to hand it to the browser — the standard save-a-file flow. The
 * returned filename is what the server sent, so the caller can show it.
 */
export async function downloadExport(competitionId: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/competitions/${encodeURIComponent(competitionId)}/export`,
    { method: "GET", headers: authHeaders() },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { code?: string; details?: unknown } }
      | null;
    throw new ResultsApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }

  const blob = await response.blob();
  const fileName = fileNameFromDisposition(response.headers.get("content-disposition"));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Release the object URL on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return fileName;
}

/** Pull `filename="…"` out of a `content-disposition` header, with a sane fallback. */
function fileNameFromDisposition(header: string | null): string {
  if (!header) return "results.xlsx";
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? "results.xlsx";
}
