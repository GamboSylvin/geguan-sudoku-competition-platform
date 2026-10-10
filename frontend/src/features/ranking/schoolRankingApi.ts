import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The ranking feature's school-leaderboard API client (Unit 15).
 *
 * One read: `GET /api/competitions/:id/categories/:categoryId/school-ranking`,
 * controller-only on the server (ROL-002). The screen never computes a rank or a
 * total — the server owns both (invariant 8), including the exact decimal
 * arithmetic (SCR-013).
 *
 * `schoolTotal` arrives as a **string** and is rendered as-is: JSON has no decimal
 * type, so the backend serializes the exact decimal as a string precisely so a
 * browser `number` never degrades it. The same is true of `schoolCoefficient`.
 */

export class SchoolRankingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "SchoolRankingApiError";
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
    throw new SchoolRankingApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }
  return body as T;
}

/**
 * One row of a category's school leaderboard.
 *
 * The two halves are shown separately on purpose, because they count genuinely
 * different people (SCR-018): `individualSum` sums **every** player the school has
 * in this category across both Individual rounds, while the two team scores come
 * from that school's single team. `countedPlayers` is the size of the first set.
 */
export interface SchoolRankingRowView {
  rank: number;
  schoolId: string;
  schoolName: string;
  individualSum: number;
  teamRound1Score: number;
  teamRound2Score: number;
  /** Exact decimal, serialized as a string — render as-is, never `Number(...)`. */
  schoolTotal: string;
  /** SCR-020's school tie-break: the summed submission time of all counted players. */
  completionTimeSeconds: number;
  countedPlayers: number;
  /** False while this school is still missing an Individual result or a team score. */
  isComplete: boolean;
}

export interface SchoolCategoryRankingView {
  categoryId: string;
  /**
   * False while any school in the category is still incomplete. That is not an
   * error: the server returns whatever is computable (spec 15, Error Cases).
   */
  isFinal: boolean;
  schoolCoefficient: string;
  rows: SchoolRankingRowView[];
}

export function fetchSchoolRanking(
  competitionId: string,
  categoryId: string,
): Promise<SchoolCategoryRankingView> {
  return request<SchoolCategoryRankingView>(
    `/api/competitions/${encodeURIComponent(competitionId)}/categories/${encodeURIComponent(categoryId)}/school-ranking`,
    { method: "GET" },
  );
}

/**
 * The category list, so the screen can offer one leaderboard per category without
 * a separate call of its own shape. This is the same controller-only read Unit 11's
 * dashboard opens with, re-declared here at the minimum the school screen needs.
 */
export interface SchoolRankingCategoryView {
  id: string;
  code: string;
  name: string;
  sequence: number;
}

export function fetchCompetitionCategories(
  competitionId: string,
): Promise<{ id: string; name: string; categories: SchoolRankingCategoryView[] }> {
  return request<{ id: string; name: string; categories: SchoolRankingCategoryView[] }>(
    `/api/competitions/${encodeURIComponent(competitionId)}`,
    { method: "GET" },
  );
}
