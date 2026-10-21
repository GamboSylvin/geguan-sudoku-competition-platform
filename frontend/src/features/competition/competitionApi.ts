import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The competition feature's API calls (Unit 03). The session token and device id are
 * read from the stored session (Unit 02) and sent on every request; the client is
 * never trusted for identity (code-standards).
 */

export interface CategoryInput {
  code: string;
  name: string;
}

export interface RoundSettingsView {
  durationSeconds: number;
  preparationSeconds: number;
  earlyBonusRate: number;
  earlyBonusCap: number | null;
  teamPointsPerQuestion: number;
  rotationPeriodSeconds: number;
  teamQuestionCount: number;
  teamTotalTimeSeconds: number | null;
  individualTotalWarning: number | null;
  partitionPuzzleCount: number;
  partitionTotalTimeSeconds: number;
  partitionPointsPerPuzzle: number;
}

export interface RoundView {
  id: string;
  sequence: number;
  name: string;
  status: string;
  settings: RoundSettingsView | null;
}

export interface StageView {
  id: string;
  type: "INDIVIDUAL" | "TEAM";
  sequence: number;
  status: string;
  rounds: RoundView[];
}

export interface CategoryView {
  id: string;
  code: string;
  name: string;
  sequence: number;
}

export interface CompetitionView {
  id: string;
  name: string;
  description: string | null;
  status: string;
  entryLinkToken: string;
  bigScreenLinkToken: string;
  /**
   * The two links as complete, openable URLs, composed by the backend (`shared/links`)
   * so the rule is written in exactly one place. Empty when the server has no
   * `PUBLIC_BASE_URL` configured — the UI then says "not configured" rather than showing
   * a raw token that cannot be opened (report §9).
   */
  entryLinkUrl: string;
  bigScreenLinkUrl: string;
  categories: CategoryView[];
  stages: StageView[];
  scoringConfiguration: {
    schoolCoefficient: string;
    rankingCycleSeconds: number;
  } | null;
}

export interface ReadinessCondition {
  key: string;
  message: string;
}

export interface PublishResultView {
  id: string;
  status: string;
  publishedAt: string | null;
  entryLinkToken: string;
  bigScreenLinkToken: string;
  /**
   * The two links as complete, openable URLs, composed by the backend (`shared/links`)
   * rather than by this screen: the composition rule is written in exactly one place, so
   * the publish result and the credential slips cannot drift apart. Empty when the server
   * has no `PUBLIC_BASE_URL` configured — the UI then says "not configured" instead of
   * showing a raw token that cannot be opened (report §9a).
   */
  entryLinkUrl: string;
  bigScreenLinkUrl: string;
}

/** A rejection carrying the HTTP status, the machine code and any structured details. */
export class CompetitionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "CompetitionApiError";
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
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
    throw new CompetitionApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }
  return body as T;
}

export function createCompetition(input: {
  name: string;
  description?: string | null;
  categories: CategoryInput[];
}): Promise<CompetitionView> {
  return request<CompetitionView>("/api/competitions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCompetition(
  id: string,
  input: {
    roundSettings?: Record<string, { durationSeconds?: number }>;
    /** Editable only before publish (report §6c) — the backend 409s otherwise. */
    categories?: CategoryInput[];
  },
): Promise<CompetitionView> {
  return request<CompetitionView>(`/api/competitions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function publishCompetition(id: string): Promise<PublishResultView> {
  return request<PublishResultView>(`/api/competitions/${id}/publish`, {
    method: "POST",
  });
}

/**
 * Read one competition with its full structure (Unit 03's read). The setup screen
 * uses it to reopen an existing competition — which is how a copy lands back on the
 * setup screen (Unit 15) instead of starting from a blank form.
 */
export function fetchCompetition(id: string): Promise<CompetitionView> {
  return request<CompetitionView>(`/api/competitions/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

/**
 * `POST /api/competitions/:id/copy` — Unit 15's deep copy. The server creates a new
 * `CREATED` competition carrying the source's categories, round settings, scoring
 * configuration, question sets/questions and judge assignments, and **nothing else**:
 * no participant, team, account, attempt, answer, result, correction, ranking or
 * file. The copy therefore has to be published again through the normal flow.
 * The response is the new competition, in the same shape `createCompetition` returns.
 */
export function copyCompetition(id: string): Promise<CompetitionView> {
  return request<CompetitionView>(
    `/api/competitions/${encodeURIComponent(id)}/copy`,
    { method: "POST" },
  );
}

/**
 * `DELETE /api/competitions/:id` — BLD-050's hard delete. Permanent and total: the
 * competition, its structure, its questions, its participants and their accounts, its
 * results, rankings, corrections, audit rows and uploaded files all go. Only this
 * competition's judge *assignments* are removed; the judge list itself is reusable
 * across competitions and survives. The server accepts it at any status and answers
 * 204 with no body, hence `void`.
 */
export async function deleteCompetition(id: string): Promise<void> {
  await request<null>(`/api/competitions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Pull the unmet readiness conditions out of a publish rejection, if present. */
export function unmetConditionsFrom(error: unknown): ReadinessCondition[] | null {
  if (
    error instanceof CompetitionApiError &&
    error.status === 422 &&
    typeof error.details === "object" &&
    error.details !== null &&
    Array.isArray((error.details as { unmet?: unknown }).unmet)
  ) {
    return (error.details as { unmet: ReadinessCondition[] }).unmet;
  }
  return null;
}
