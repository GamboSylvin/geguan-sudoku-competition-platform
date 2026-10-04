import { API_BASE_URL } from "@/config/env";
import { loadSession } from "../auth/session";

/**
 * The judge feature's API calls (Unit 06). Session token + device id are read from
 * the stored session (Unit 02) and sent on every request; the client is never
 * trusted for identity (code-standards).
 */

export interface JudgeSummaryView {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface CreatedJudgeView extends JudgeSummaryView {
  username: string;
  password: string;
}

export interface JudgeAssignmentView {
  id: string;
  competitionId: string;
  judgeId: string;
  fromParticipantNumber: number;
  toParticipantNumber: number;
  assignedAt: string;
  assignedByAccountId: string | null;
  competitionName?: string;
}

export interface JudgeMeView {
  judgeId: string;
  assignments: (JudgeAssignmentView & { competitionName: string })[];
}

export class JudgeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(code);
    this.name = "JudgeApiError";
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
    throw new JudgeApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.details,
    );
  }
  return body as T;
}

export function createJudge(input: { name: string }): Promise<CreatedJudgeView> {
  return request<CreatedJudgeView>("/api/judges", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listJudges(): Promise<{ judges: JudgeSummaryView[] }> {
  return request<{ judges: JudgeSummaryView[] }>("/api/judges", {
    method: "GET",
  });
}

export function removeJudge(id: string): Promise<JudgeSummaryView> {
  return request<JudgeSummaryView>(`/api/judges/${id}`, {
    method: "DELETE",
  });
}

export function assignJudgeRange(
  competitionId: string,
  input: { judgeId: string; fromParticipantNumber: number; toParticipantNumber: number },
): Promise<JudgeAssignmentView> {
  return request<JudgeAssignmentView>(`/api/competitions/${competitionId}/judge-assignments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function unassignJudge(competitionId: string, assignmentId: string): Promise<void> {
  return request<void>(`/api/competitions/${competitionId}/judge-assignments/${assignmentId}`, {
    method: "DELETE",
  });
}

export function fetchJudgeMe(): Promise<JudgeMeView> {
  return request<JudgeMeView>("/api/judges/me", { method: "GET" });
}

/** Pull the blocking competition names out of a removal rejection, if present. */
export function blockingCompetitionsFrom(error: unknown): string[] | null {
  if (
    error instanceof JudgeApiError &&
    error.status === 409 &&
    typeof error.details === "object" &&
    error.details !== null &&
    Array.isArray((error.details as { competitions?: unknown }).competitions)
  ) {
    return (
      (error.details as { competitions: { competitionName: string }[] }).competitions.map(
        (c) => c.competitionName,
      )
    );
  }
  return null;
}
