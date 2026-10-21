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

/**
 * A reactivated judge: its summary plus the username it kept. `username` is nullable
 * because the server reports what the account carries rather than inventing one.
 */
export interface ReactivatedJudgeView extends JudgeSummaryView {
  username: string | null;
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
  /** The judge's own display name — this screen used to fall back to the raw account id. */
  name: string | null;
  assignments: (JudgeAssignmentView & { competitionName: string })[];
}

/**
 * One row of a competition's range list (report §4c): who supervises which slice, and
 * who recorded it. `judgeActive` matters because an assignment survives the judge's
 * deactivation — the row is still there, the account behind it is not.
 */
export interface CompetitionJudgeAssignmentView extends JudgeAssignmentView {
  judgeName: string;
  judgeActive: boolean;
  assignedByUsername: string | null;
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

/**
 * Undo a deactivation (report §4a). The judge keeps its account and its username; the
 * password is never returned again — it was shown once at creation (BLD-037).
 */
export function reactivateJudge(id: string): Promise<ReactivatedJudgeView> {
  return request<ReactivatedJudgeView>(`/api/judges/${id}/reactivate`, {
    method: "PATCH",
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

/** The ranges already recorded on one competition (report §4c). */
export function listCompetitionAssignments(
  competitionId: string,
): Promise<{ assignments: CompetitionJudgeAssignmentView[] }> {
  return request<{ assignments: CompetitionJudgeAssignmentView[] }>(
    `/api/competitions/${competitionId}/judge-assignments`,
    { method: "GET" },
  );
}

export function fetchJudgeMe(): Promise<JudgeMeView> {
  return request<JudgeMeView>("/api/judges/me", { method: "GET" });
}

// ---------------------------------------------------------------------------
// Unit 10: judge supervision (status view + single-student restart)
// ---------------------------------------------------------------------------

export type ParticipationStateView =
  | "WAITING"
  | "ACTIVE"
  | "SUBMITTED"
  | "AUTO_SUBMITTED"
  | "RESTARTED";

export type RoundStatusView =
  | "WAITING"
  | "PREPARATION"
  | "ACTIVE"
  | "PAUSED"
  | "FINISHED";

/** One row of the judge dashboard. */
export interface JudgeStudentView {
  participantId: string;
  participantNumber: number;
  participantName: string;
  competitionId: string;
  competitionName: string;
  categoryId: string;
  categoryName: string;
  connected: boolean;
  roundId: string | null;
  roundStatus: RoundStatusView | null;
  participationState: ParticipationStateView | null;
  leftAnswerPageCount: number;
  attemptCount: number;
  remainingSeconds: number | null;
  totalSeconds: number | null;
}

export interface RestartStudentResultView {
  participationId: string;
  attemptCount: number;
  remainingSeconds: number;
  totalSeconds: number;
}

/**
 * List the students to supervise. A judge session omits `competitionId` and the
 * server scopes the list to that judge's own assigned range(s) (Unit 10). A
 * controller session must name the competition — its role already authorizes the
 * whole event, so it sees every participant of it with the identical row shape
 * (Unit 11 spec Detail 6: judge-equivalent student-status access).
 */
export function fetchJudgeStudents(
  competitionId?: string,
): Promise<{ students: JudgeStudentView[] }> {
  const query = competitionId
    ? `?competitionId=${encodeURIComponent(competitionId)}`
    : "";
  return request<{ students: JudgeStudentView[] }>(`/api/judge/students${query}`, {
    method: "GET",
  });
}

export function restartStudent(participantId: string): Promise<RestartStudentResultView> {
  return request<RestartStudentResultView>(
    `/api/judge/students/${encodeURIComponent(participantId)}/restart`,
    { method: "POST" },
  );
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
