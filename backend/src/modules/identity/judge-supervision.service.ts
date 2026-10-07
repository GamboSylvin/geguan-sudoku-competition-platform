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
    const competitionId = assignment.competitionId;

    // All participants in the judge's range on this competition, with the
    // account and the active device so the connection flag can be computed.
    const participants = await prisma.participant.findMany({
      where: {
        competitionId,
        participantNumber: {
          gte: assignment.fromParticipantNumber,
          lte: assignment.toParticipantNumber,
        },
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

    const timer = currentRoundId
      ? await roundTimerService.remaining(currentRoundId)
      : null;

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
    const participationByParticipant = new Map(
      participations.map((p) => [p.participantId, p]),
    );

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
    const activeDeviceSet = new Set(
      devices.filter((d) => d.isActive).map((d) => d.id),
    );

    for (const p of participants) {
      const participation = participationByParticipant.get(p.id);
      const connectedDeviceId = p.account?.activeDeviceId ?? null;
      const connected =
        connectedDeviceId !== null && activeDeviceSet.has(connectedDeviceId);
      rows.push({
        participantId: p.id,
        participantNumber: p.participantNumber,
        participantName: p.name,
        competitionId,
        competitionName: assignment.competition.name,
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
      });
    }
  }

  return rows;
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

export const judgeSupervisionService = {
  listStudentsForJudge,
  restartStudent,
};
