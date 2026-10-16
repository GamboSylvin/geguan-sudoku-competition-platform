import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";
import { CompetitionApiError } from "./competitionApi";

/**
 * The `School` CRUD API calls (BLD-052), mounted under
 * `/api/competitions/:id/schools`. Same discipline as `competitionApi.ts`: the
 * session token and device id are read from the stored session and sent on every
 * request, the client is never trusted for identity.
 *
 * The error class is `competitionApi`'s own — one class for the whole competition
 * surface, so panels can read `status`/`code` the same way regardless of which
 * endpoint answered.
 */

/** One school row as the setup panel displays it. */
export interface SchoolView {
  id: string;
  name: string;
  sequence: number;
  /** How many participants still point at this school — decides whether removal is possible. */
  participantCount: number;
  /** How many teams still point at this school — the guard's other half. */
  teamCount: number;
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

function schoolsPath(competitionId: string): string {
  return `/api/competitions/${encodeURIComponent(competitionId)}/schools`;
}

/** `GET …/schools` — the panel's list, each row carrying its counts. */
export async function fetchSchools(competitionId: string): Promise<SchoolView[]> {
  const body = await request<{ schools: SchoolView[] }>(schoolsPath(competitionId), {
    method: "GET",
  });
  return body.schools;
}

/** `POST …/schools` — body `{ name }`. 409 `school.nameTaken` on an already-taken name. */
export function createSchool(
  competitionId: string,
  input: { name: string },
): Promise<SchoolView> {
  return request<SchoolView>(schoolsPath(competitionId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PATCH …/schools/:schoolId` — rename only, nothing else is editable. */
export function renameSchool(
  competitionId: string,
  schoolId: string,
  input: { name: string },
): Promise<SchoolView> {
  return request<SchoolView>(
    `${schoolsPath(competitionId)}/${encodeURIComponent(schoolId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

/**
 * `DELETE …/schools/:schoolId` — removes an empty school. 204 with no body on
 * success; 409 `school.hasParticipants` / `school.hasTeam` while anything still
 * points at it. The panel reads that 409 to explain the refusal rather than failing
 * silently.
 */
export async function deleteSchool(
  competitionId: string,
  schoolId: string,
): Promise<void> {
  await request<null>(
    `${schoolsPath(competitionId)}/${encodeURIComponent(schoolId)}`,
    { method: "DELETE" },
  );
}

/**
 * The figure that comes with a deletion refusal, if the server sent one. Lets the
 * panel say "3 participants" instead of only "some participants remain."
 */
export function referenceCountsFrom(
  error: unknown,
): { participants: number; teams: number } | null {
  if (
    error instanceof CompetitionApiError &&
    error.status === 409 &&
    typeof error.details === "object" &&
    error.details !== null
  ) {
    const details = error.details as { participants?: unknown; teams?: unknown };
    if (typeof details.participants === "number" && typeof details.teams === "number") {
      return { participants: details.participants, teams: details.teams };
    }
  }
  return null;
}
