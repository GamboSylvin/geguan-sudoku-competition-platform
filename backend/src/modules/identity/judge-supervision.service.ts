/**
 * Domain rules for the judge's supervision view (Unit 10). Other modules call
 * this service, never the repository (invariant 4).
 *
 * Two things live here:
 *
 *   1. `listStudentsForJudge` — the status row set the judge dashboard renders.
 *      Every participant inside every one of the judge's current assignments,
 *      with connection status (from the account's active device), the
 *      round-participation state, the left-page count, the restart count, and
 *      the live round timer snapshot. Participants outside the judge's range
 *      are never read from the database, let alone returned.
 *
 *   2. `restartStudent` — the judge-facing wrapper over the Orchestrator's
 *      archive-and-restart operation. It applies Unit 06's scoping check
 *      (rejects when the participant is outside the judge's range or
 *      competition), then asks the Orchestrator to do the restart. The
 *      Orchestrator enforces the "round is running" rule.
 *
 * The judge has no other powers (U-55). Anything beyond these two functions is
 * another unit's job (Unit 11 builds the controller's wider reset/rematch on
 * the same Orchestrator function).
 */
import { prisma } from "../../infra";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { orchestratorService } from "../orchestrator";
import { roundTimerService } from "../round";
import { judgeService } from "./judge.service";

/** One row of the judge dashboard. */
export interface JudgeStudentRow {
  participantId: string;
  participantNumber: number;
  participantName: string;
  competitionId: string;
  competitionName: string;
  categoryId: string;
  categoryName: string;
  /** Coarse "is the player's device currently the active one". */
  connected: boolean;
  /** The round the participant is currently on, if the competition has started. */
  roundId: string | null;
  roundStatus: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED" | null;
  /** The participation state on that round; null when no participation exists yet. */
  participationState:
    | "WAITING"
    | "ACTIVE"
    | "SUBMITTED"
    | "AUTO_SUBMITTED"
    | "RESTARTED"
    | null;
  leftAnswerPageCount: number;
  attemptCount: number;
  /** Server-authoritative remaining seconds on the round's shared timer. */
  remainingSeconds: number | null;
  totalSeconds: number | null;
}

/**
 * The status rows for one competition, restricted to a participant-number range.
 * The shared body of the judge view and the controller's judge-equivalent view
 * (Unit 11, spec Detail 6): a judge passes each of their own assignments' ranges,
 * the controller passes `null` for "every participant, no range" — a sentinel the
 * database never has to represent, because `participantNumber` is an INT4 and
 * `Number.MIN_SAFE_INTEGER` does not fit in one.
 */
async function buildStudentRows(
  competitionId: string,
  competitionName: string,
  range: { fromParticipantNumber: number; toParticipantNumber: number } | null,
): Promise<JudgeStudentRow[]> {
  // All participants in range on this competition, with the account and the active
  // device so the connection flag can be computed.
  const participants = await prisma.participant.findMany({
    where: {
      competitionId,
      ...(range
        ? {
            participantNumber: {
              gte: range.fromParticipantNumber,
              lte: range.toParticipantNumber,
            },
          }
        : {}),
    },
    orderBy: { participantNumber: "asc" },
    include: {
      category: { select: { id: true, name: true } },
      account: {
        select: {
          id: true,
          activeDeviceId: true,
        },
      },
    },
  });

  // The competition's currently-running round (from the runtime state), if any.
  const runtime = await prisma.competitionRuntimeState.findUnique({
    where: { competitionId },
    select: { currentRoundId: true },
  });
  const currentRoundId = runtime?.currentRoundId ?? null;
  const currentRound = currentRoundId
    ? await prisma.round.findUnique({
        where: { id: currentRoundId },
        select: { id: true, status: true },
      })
    : null;

  const timer = currentRoundId ? await roundTimerService.remaining(currentRoundId) : null;

  // Every participation on the current round for every participant in scope,
  // in one query, keyed by participantId.
  const participations = currentRoundId
    ? await prisma.roundParticipation.findMany({
        where: {
          roundId: currentRoundId,
          participantId: { in: participants.map((p) => p.id) },
        },
        select: {
          participantId: true,
          state: true,
          attemptCount: true,
          leftAnswerPageCount: true,
        },
      })
    : [];
  const participationByParticipant = new Map(participations.map((p) => [p.participantId, p]));

  // Resolve the connected flag for every participant with one device query.
  const activeDeviceIds = participants
    .map((p) => p.account?.activeDeviceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const devices = activeDeviceIds.length
    ? await prisma.device.findMany({
        where: { id: { in: activeDeviceIds } },
        select: { id: true, isActive: true },
      })
    : [];
  const activeDeviceSet = new Set(devices.filter((d) => d.isActive).map((d) => d.id));

  return participants.map((p) => {
    const participation = participationByParticipant.get(p.id);
    const connectedDeviceId = p.account?.activeDeviceId ?? null;
    const connected = connectedDeviceId !== null && activeDeviceSet.has(connectedDeviceId);
    return {
      participantId: p.id,
      participantNumber: p.participantNumber,
      participantName: p.name,
      competitionId,
      competitionName,
      categoryId: p.category.id,
      categoryName: p.category.name,
      connected,
      roundId: currentRound?.id ?? null,
      roundStatus: currentRound?.status ?? null,
      participationState: participation?.state ?? null,
      leftAnswerPageCount: participation?.leftAnswerPageCount ?? 0,
      attemptCount: participation?.attemptCount ?? 0,
      remainingSeconds: timer?.remainingSeconds ?? null,
      totalSeconds: timer?.totalSeconds ?? null,
    };
  });
}

/**
 * The judge's assigned students with their current status, scoped strictly to
 * the judge's own assignments. One row per (assignment, participant) pair —
 * the spec does not ask us to deduplicate a participant who somehow falls into
 * two of the judge's own ranges (which the controller UI already prevents).
 */
async function listStudentsForJudge(judgeId: string): Promise<JudgeStudentRow[]> {
  const assignments = await prisma.competitionJudgeAssignment.findMany({
    where: { judgeId },
    include: {
      competition: { select: { id: true, name: true, status: true } },
    },
  });
  if (assignments.length === 0) return [];

  const rows: JudgeStudentRow[] = [];
  for (const assignment of assignments) {
    rows.push(
      ...(await buildStudentRows(
        assignment.competitionId,
        assignment.competition.name,
        {
          fromParticipantNumber: assignment.fromParticipantNumber,
          toParticipantNumber: assignment.toParticipantNumber,
        },
      )),
    );
  }

  return rows;
}

/**
 * The controller's judge-equivalent view of one competition (Unit 11, spec Detail 6):
 * every participant on that competition, with the same row shape the judge sees. The
 * range check is skipped, not relaxed — a controller session is already authorized
 * for the whole competition by its role. `null` range means "all participants";
 * no sentinel numbers are needed, and none would fit the INT4 column.
 */
async function listStudentsForCompetition(competitionId: string): Promise<JudgeStudentRow[]> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, name: true },
  });
  if (!competition) {
    throw new NotFoundError(translate("en", "competition.notFound"), {
      code: "competition.notFound",
    });
  }
  return buildStudentRows(competition.id, competition.name, null);
}

export interface RestartStudentResult {
  participationId: string;
  attemptCount: number;
  remainingSeconds: number;
  totalSeconds: number;
}

/**
 * Restart one participant's current round, on behalf of a judge. The scoping
 * check runs first; only when the participant is inside the judge's range on
 * the judge's own competition does the orchestrator get called.
 */
async function restartStudent(
  judgeId: string,
  participantId: string,
): Promise<RestartStudentResult> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      participantNumber: true,
      competitionId: true,
    },
  });
  if (!participant) {
    throw new NotFoundError(translate("en", "orchestrator.participantNotFound"), {
      code: "orchestrator.participantNotFound",
    });
  }

  const allowed = await judgeService.isJudgeAuthorizedForParticipant(
    judgeId,
    participant.competitionId,
    participant.participantNumber,
  );
  if (!allowed) {
    throw new ForbiddenError(translate("en", "judgeSupervision.outOfRange"), {
      code: "judgeSupervision.outOfRange",
    });
  }

  // Find the participant's current round via the competition's runtime state.
  const runtime = await prisma.competitionRuntimeState.findUnique({
    where: { competitionId: participant.competitionId },
    select: { currentRoundId: true },
  });
  const roundId = runtime?.currentRoundId ?? null;
  if (!roundId) {
    // No round running on this competition — same rejection the orchestrator
    // would give, raised here so the response carries the round-not-running
    // code the spec's API contract names.
    throw new ConflictError(translate("en", "orchestrator.roundNotRunning"), {
      code: "orchestrator.roundNotRunning",
      details: { status: "WAITING" },
    });
  }

  const result = await orchestratorService.restartOneParticipant({
    roundId,
    participantId: participant.id,
  });

  return {
    participationId: result.participationId,
    attemptCount: result.attemptCount,
    remainingSeconds: result.remainingSeconds,
    totalSeconds: result.totalSeconds,
  };
}

/**
 * The controller's judge-equivalent restart (Unit 11, spec Detail 6): the same
 * orchestrator operation, without Unit 06's range check, because a controller
 * session is authorized for the whole competition by its role. Still logged as its
 * own `AuditLog` action by the caller.
 */
async function restartStudentAsController(
  participantId: string,
): Promise<RestartStudentResult & { competitionId: string }> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, competitionId: true },
  });
  if (!participant) {
    throw new NotFoundError(translate("en", "orchestrator.participantNotFound"), {
      code: "orchestrator.participantNotFound",
    });
  }

  const runtime = await prisma.competitionRuntimeState.findUnique({
    where: { competitionId: participant.competitionId },
    select: { currentRoundId: true },
  });
  const roundId = runtime?.currentRoundId ?? null;
  if (!roundId) {
    throw new ConflictError(translate("en", "orchestrator.roundNotRunning"), {
      code: "orchestrator.roundNotRunning",
      details: { status: "WAITING" },
    });
  }

  const result = await orchestratorService.restartOneParticipant({
    roundId,
    participantId: participant.id,
  });
  return {
    competitionId: participant.competitionId,
    participationId: result.participationId,
    attemptCount: result.attemptCount,
    remainingSeconds: result.remainingSeconds,
    totalSeconds: result.totalSeconds,
  };
}

export const judgeSupervisionService = {
  listStudentsForJudge,
  listStudentsForCompetition,
  restartStudent,
  restartStudentAsController,
};
