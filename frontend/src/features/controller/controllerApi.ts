import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The controller's live-command feature API client (Unit 11, spec Detail 10).
 *
 * Every call here targets `/api/competitions/:id/...` and every one of them is
 * controller-only on the server (ROL-002). The session token and device id come
 * from the stored session (Unit 02) and are sent on every request; the client is
 * never trusted for identity (code-standards).
 *
 * Two read endpoints (`listCompetitions`, `fetchCompetition`) are the dashboard's
 * entry point: the controller has to pick a competition, then read its stage/round
 * structure to know which commands are legal in the current state. Those reads are
 * controller-scoped too — a judge or player never sees the list.
 */

export class ControllerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "ControllerApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = loadSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(session
        ? { "x-session-token": session.token, "x-device-id": session.deviceId }
        : {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    throw new ControllerApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// The two reads the dashboard opens with
// ---------------------------------------------------------------------------

export interface CompetitionSummaryView {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** The round's settings, as far as the dashboard cares (it only shows durations). */
export interface RoundSettingsSummaryView {
  durationSeconds: number;
  preparationSeconds: number;
}

export interface LiveRoundView {
  id: string;
  sequence: number;
  name: string;
  status: string;
  settings: RoundSettingsSummaryView | null;
}

export interface LiveStageView {
  id: string;
  type: "INDIVIDUAL" | "TEAM";
  sequence: number;
  status: string;
  rounds: LiveRoundView[];
}

export interface LiveCategoryView {
  id: string;
  code: string;
  name: string;
  sequence: number;
}

export interface LiveCompetitionView {
  id: string;
  name: string;
  description: string | null;
  status: string;
  entryLinkToken: string;
  bigScreenLinkToken: string;
  categories: LiveCategoryView[];
  stages: LiveStageView[];
}

export function listCompetitions(): Promise<{ competitions: CompetitionSummaryView[] }> {
  return request<{ competitions: CompetitionSummaryView[] }>("/api/competitions", {
    method: "GET",
  });
}

export function fetchCompetition(id: string): Promise<LiveCompetitionView> {
  return request<LiveCompetitionView>(`/api/competitions/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// The nine live commands (spec API contract)
// ---------------------------------------------------------------------------

/** `POST /stages/:stageId/start` — Detail 1. Returns the started preparation. */
export interface StartStageResultView {
  competitionId: string;
  stageId: string;
  roundId: string;
  status: string;
  preparationSeconds: number;
}

export function startStage(
  competitionId: string,
  stageId: string,
): Promise<StartStageResultView> {
  return request<StartStageResultView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/stages/${encodeURIComponent(stageId)}/start`,
    { method: "POST" },
  );
}

/**
 * The shared timer snapshot pause and resume both return. `remainingSeconds` is
 * server-authoritative (invariant 3); the dashboard shows it, never counts it.
 */
export interface TimerSnapshotView {
  roundId: string;
  status: string;
  remainingSeconds: number;
  totalSeconds: number;
}

export function pauseCompetition(competitionId: string): Promise<TimerSnapshotView> {
  return request<TimerSnapshotView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/pause`,
    { method: "POST" },
  );
}

export function resumeCompetition(competitionId: string): Promise<TimerSnapshotView> {
  return request<TimerSnapshotView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/resume`,
    { method: "POST" },
  );
}

/** `POST /rounds/:roundId/end-early` — Detail 3 (SUB-004). */
export interface EndRoundEarlyResultView {
  roundId: string;
  closedCount: number;
  alreadyFinished: boolean;
}

export function endRoundEarly(
  competitionId: string,
  roundId: string,
): Promise<EndRoundEarlyResultView> {
  return request<EndRoundEarlyResultView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/rounds/${encodeURIComponent(roundId)}/end-early`,
    { method: "POST" },
  );
}

/** `POST /finish-early` — Detail 4 (RND-007). Cannot be undone. */
export interface FinishEarlyResultView {
  competitionId: string;
  status: "FINISHED";
  finishedEarly: true;
  closedCount: number;
}

export function finishEarly(competitionId: string): Promise<FinishEarlyResultView> {
  return request<FinishEarlyResultView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/finish-early`,
    { method: "POST" },
  );
}

/** The four scopes of reset/rematch (ROL-005). */
export type ResetRematchScope = "EVENT" | "ROUND" | "PARTICIPANT" | "TEAM";

export interface ResetRematchResultView {
  scope: ResetRematchScope;
  roundIds: string[];
  restartedCount: number;
  grantedSeconds: number;
}

export function resetRematch(
  competitionId: string,
  input: {
    scope: ResetRematchScope;
    roundId?: string | null;
    participantId?: string | null;
    teamId?: string | null;
  },
): Promise<ResetRematchResultView> {
  return request<ResetRematchResultView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/reset-rematch`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** `POST /cancel` — Detail 7 (ROL-009). Terminal; no results are ever released. */
export interface CancelResultView {
  competitionId: string;
  status: "CANCELLED";
  cancelledAt: string;
}

export function cancelCompetition(competitionId: string): Promise<CancelResultView> {
  return request<CancelResultView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/cancel`,
    { method: "POST" },
  );
}

/**
 * `POST /big-screen/mode` — Detail 9 (BSC-002). Only the three modes this unit can
 * set are offered; `PLAYER_CLOSEUP`/`TEAM_SPLIT` exist in the schema but have no
 * screen or data behind them, and the server rejects them with `bigScreen.invalidMode`.
 */
export type BigScreenModeCommand = "RANKING" | "PAUSED" | "FINAL";
export type BigScreenModeView = BigScreenModeCommand | "PLAYER_CLOSEUP" | "TEAM_SPLIT";

export interface BigScreenDisplayView {
  competitionId: string;
  mode: BigScreenModeView;
  targetId: string | null;
  rotationEnabled: boolean;
}

export function setBigScreenMode(
  competitionId: string,
  input: {
    mode: BigScreenModeCommand;
    targetId?: string | null;
    rotationEnabled?: boolean | null;
  },
): Promise<BigScreenDisplayView> {
  return request<BigScreenDisplayView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/big-screen/mode`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** The dashboard's read-back of what the screens are showing. No audit row. */
export function fetchBigScreenMode(competitionId: string): Promise<BigScreenDisplayView> {
  return request<BigScreenDisplayView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/big-screen/mode`,
    { method: "GET" },
  );
}
