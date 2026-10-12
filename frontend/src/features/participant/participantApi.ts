import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The participant feature's API calls (Unit 04). Mirrors `questionApi.ts` on purpose:
 * the session token and device id come from the stored session (Unit 02) and ride on
 * every request, and the import is a `multipart/form-data` upload that deliberately
 * does **not** set a `content-type` header — the browser writes the boundary itself.
 *
 * The credential-slips download is the one call that cannot go through the JSON-parsing
 * `request<T>`: it returns an `.xlsx` **binary** with a `content-disposition` header, so
 * it fetches the bytes, wraps them in a Blob and hands them to the browser to save (the
 * same shape `resultsApi.ts`'s `downloadExport` uses).
 *
 * Every endpoint is controller-only, so nothing here needs a role check of its own.
 */

/** One participant as the roster shows it. Never a password. */
export interface ParticipantView {
  id: string;
  participantNumber: number;
  name: string;
  active: boolean;
  individualEvent: boolean;
  teamEvent: boolean;
  categoryId: string;
  categoryName: string;
  schoolId: string;
  schoolName: string;
  /** Always null in this build: team formation is deferred out of Unit 04 (U-102). */
  teamId: string | null;
  username: string | null;
}

export interface TeamFlaggedCount {
  schoolId: string;
  schoolName: string;
  categoryId: string;
  categoryName: string;
  count: number;
}

export interface ParticipantCounts {
  total: number;
  active: number;
  individualEvent: number;
  teamEvent: number;
  teamFlaggedBySchool: TeamFlaggedCount[];
}

export interface ParticipantListView {
  competitionId: string;
  participants: ParticipantView[];
  counts: ParticipantCounts;
}

/** A warning that did **not** reject the file — the setup screen shows it, not an error. */
export interface ImportWarningView {
  row: number;
  code: string;
  message: string;
}

/**
 * One freshly issued credential, returned **once** by the call that created it. The
 * plaintext password is never stored, so the panel has to show it immediately and the
 * slips export is the only later retrieval path.
 */
export interface IssuedCredentialView {
  participantId: string;
  participantNumber: number;
  name: string;
  schoolName: string;
  categoryName: string;
  username: string;
  password: string;
}

export interface ParticipantImportResultView {
  batchId: string;
  fileId: string;
  status: "COMMITTED" | "REJECTED";
  created: number;
  kept: number;
  replaced: number;
  deactivated: number;
  warnings: ImportWarningView[];
  credentials: IssuedCredentialView[];
}

export interface ParticipantEditResultView {
  participant: ParticipantView;
  /** Non-null only when the edit replaced a student and issued new credentials. */
  credential: IssuedCredentialView | null;
}

/** One row-level reason a file was rejected, with the Excel row number it names. */
export interface ImportFailureView {
  row: number;
  column?: string;
  code: string;
  message: string;
}

/** A rejection carrying the HTTP status, the machine code and any structured details. */
export class ParticipantApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "ParticipantApiError";
  }
}

/** The session headers every participant request must carry. */
function authHeaders(): Record<string, string> {
  const session = loadSession();
  return session
    ? { "x-session-token": session.token, "x-device-id": session.deviceId }
    : {};
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  for (const [key, value] of Object.entries(authHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    throw new ParticipantApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }
  // 204 carries no body; `json()` already returned null above.
  return body as T;
}

function competitionPath(competitionId: string, rest: string): string {
  return `/api/competitions/${encodeURIComponent(competitionId)}${rest}`;
}

/** Upload one `.xlsx` participant file. The write is all-or-nothing (spec §4.4). */
export function importParticipantFile(
  competitionId: string,
  file: File,
): Promise<ParticipantImportResultView> {
  const form = new FormData();
  form.append("file", file);
  return request<ParticipantImportResultView>(
    competitionPath(competitionId, "/participants/import"),
    { method: "POST", body: form },
  );
}

/** The roster and its counts. Both filters are optional. */
export function fetchParticipants(
  competitionId: string,
  filter: { active?: boolean; categoryId?: string } = {},
): Promise<ParticipantListView> {
  const query = new URLSearchParams();
  if (filter.active !== undefined) query.set("active", String(filter.active));
  if (filter.categoryId) query.set("categoryId", filter.categoryId);
  const suffix = query.toString() === "" ? "" : `?${query.toString()}`;
  return request<ParticipantListView>(
    competitionPath(competitionId, `/participants${suffix}`),
    { method: "GET" },
  );
}

/** Add one participant by hand (PAR-003). Issues credentials, returned once. */
export function addParticipant(
  competitionId: string,
  input: {
    name: string;
    categoryId: string;
    schoolName: string;
    individualEvent: boolean;
    teamEvent: boolean;
  },
): Promise<ParticipantEditResultView> {
  return request<ParticipantEditResultView>(
    competitionPath(competitionId, "/participants"),
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** Edit one row. A **name** change replaces the student and issues new credentials. */
export function editParticipant(
  competitionId: string,
  participantId: string,
  edit: {
    name?: string;
    categoryId?: string;
    schoolName?: string;
    participantNumber?: number;
    active?: boolean;
    individualEvent?: boolean;
    teamEvent?: boolean;
  },
): Promise<ParticipantEditResultView> {
  return request<ParticipantEditResultView>(
    competitionPath(competitionId, `/participants/${encodeURIComponent(participantId)}`),
    { method: "PATCH", body: JSON.stringify(edit) },
  );
}

/** Deactivate one row — never a hard delete. The backend answers 204 with no body. */
export async function deactivateParticipant(
  competitionId: string,
  participantId: string,
): Promise<void> {
  await request<void>(
    competitionPath(competitionId, `/participants/${encodeURIComponent(participantId)}`),
    { method: "DELETE" },
  );
}

function fileNameFromDisposition(header: string | null): string {
  const match = /filename="?([^";]+)"?/i.exec(header ?? "");
  return match?.[1] ?? "participant-credentials.xlsx";
}

/** Download the printable credential slips `.xlsx` and save it in the browser. */
export async function downloadCredentials(competitionId: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}${competitionPath(competitionId, "/participants/credentials")}`,
    { method: "GET", headers: authHeaders() },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { code?: string; details?: unknown } }
      | null;
    throw new ParticipantApiError(
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

/** Pull the row-level rejection list out of a 422 import, if present. */
export function importFailuresFrom(error: unknown): ImportFailureView[] | null {
  if (
    error instanceof ParticipantApiError &&
    error.status === 422 &&
    typeof error.details === "object" &&
    error.details !== null &&
    Array.isArray((error.details as { failures?: unknown }).failures)
  ) {
    return (error.details as { failures: ImportFailureView[] }).failures;
  }
  return null;
}
