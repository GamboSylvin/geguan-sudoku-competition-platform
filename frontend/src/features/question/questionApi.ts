import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The question feature's API calls (Unit 05). The session token and device id are read
 * from the stored session (Unit 02) and sent on every request; the client is never
 * trusted for identity (code-standards).
 *
 * The import is a `multipart/form-data` upload, so it deliberately does not set a
 * `content-type` header: the browser writes the boundary itself.
 */

export interface QuestionSetSummaryView {
  id: string;
  name: string;
  questionCount: number;
  assignedCounts: { roundId: string; count: number }[];
}

export interface PoolQuestionView {
  id: string;
  sequence: number;
  variantLabel: string;
  gridRows: number;
  gridColumns: number;
  points: number;
  roundId: string | null;
}

export interface PoolGroupView {
  questionSet: QuestionSetSummaryView;
  questions: PoolQuestionView[];
}

export interface PoolView {
  categoryId: string;
  groups: PoolGroupView[];
}

export interface ImportResultView {
  questionSetId: string;
  variantLabel: string;
  questionCount: number;
}

export interface SelectionResultView {
  roundId: string;
  questionIds: string[];
}

/** One row-level reason a file was rejected, with the Excel row number it names. */
export interface ImportFailureView {
  row: number;
  column?: string;
  code: string;
  message: string;
}

/** A rejection carrying the HTTP status, the machine code and any structured details. */
export class QuestionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "QuestionApiError";
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const session = loadSession();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (session) {
    headers.set("x-session-token", session.token);
    headers.set("x-device-id", session.deviceId);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    throw new QuestionApiError(response.status, body?.error?.code ?? "error", body?.error?.details);
  }
  return body as T;
}

/** Upload one `.xlsx` question file into a category's pool. */
export function importQuestionFile(
  competitionId: string,
  categoryId: string,
  file: File,
): Promise<ImportResultView> {
  const form = new FormData();
  form.append("file", file);
  return request<ImportResultView>(
    `/api/competitions/${competitionId}/categories/${categoryId}/questions/import`,
    { method: "POST", body: form },
  );
}

/** The category's pool, grouped by `QuestionSet` (BLD-044). */
export function fetchQuestionPool(
  competitionId: string,
  categoryId: string,
): Promise<PoolView> {
  return request<PoolView>(
    `/api/competitions/${competitionId}/categories/${categoryId}/questions/pool`,
    { method: "GET" },
  );
}

/** Assign exactly 6 pool questions to one Individual round, replacing any earlier 6. */
export function selectRoundQuestions(
  competitionId: string,
  categoryId: string,
  roundId: string,
  questionIds: string[],
): Promise<SelectionResultView> {
  return request<SelectionResultView>(
    `/api/competitions/${competitionId}/categories/${categoryId}/rounds/${roundId}/select-questions`,
    { method: "POST", body: JSON.stringify({ questionIds }) },
  );
}

/** Pull the row-level rejection list out of a 422 import, if present. */
export function importFailuresFrom(error: unknown): ImportFailureView[] | null {
  if (
    error instanceof QuestionApiError &&
    error.status === 422 &&
    typeof error.details === "object" &&
    error.details !== null &&
    Array.isArray((error.details as { failures?: unknown }).failures)
  ) {
    return (error.details as { failures: ImportFailureView[] }).failures;
  }
  return null;
}
