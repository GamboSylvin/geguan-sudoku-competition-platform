/**
 * The Orchestrator module's domain rules and public interface. Other modules
 * call this service, never the repository (invariant 4).
 *
 * Unit 10 builds the single-student case of the archive-and-restart operation
 * (ROL-005). The function is parameterized by `(roundId, participantId)` so
 * Unit 11 can call it in a loop for the wider-scope reset/rematch commands.
 *
 * The boundary this module respects:
 *   - The decision *whether* a caller may restart *this* participant lives in
 *     the calling module (Unit 10: the judge-status endpoints apply Unit 06's
 *     scoping check). The orchestrator only enforces the rule "the round must
 *     be running".
 *   - "Running" means `Round.status ∈ {ACTIVE, PAUSED}` — an interpretation of
 *     the spec's "while the round is running" (spec Implementation Notes flag
 *     this as an interpretation, not a silent decision). `WAITING`,
 *     `PREPARATION` and `FINISHED` rounds reject.
 *   - The earlier attempt is *archived*, never deleted (SUB-005 / ROL-005), and
 *     `RoundParticipation.attemptCount` bumps so the restart count stays
 *     visible.
 *   - The round's shared timer is not touched — restarting one student never
 *     changes when the round ends for the others (spec Context, Restart rule).
 */

import { prisma } from "../../infra";
import { now } from "../../shared/clock";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import * as gameplayRepository from "../gameplay/gameplay.repository";
import { roundTimerService } from "../round";
import * as repository from "./orchestrator.repository";
import {
  ORCHESTRATOR_PARTICIPANT_NOT_FOUND,
  ORCHESTRATOR_ROUND_NOT_RUNNING,
  type RestartOneParticipantInput,
  type RestartOneParticipantResult,
} from "./orchestrator.types";

function roundNotRunningError(status: string): ConflictError {
  return new ConflictError(translate("en", ORCHESTRATOR_ROUND_NOT_RUNNING), {
    code: ORCHESTRATOR_ROUND_NOT_RUNNING,
    details: { status },
  });
}

/**
 * Archive one participant's current attempt on a round and start a fresh one.
 *
 * The shared round timer is never touched — the student rejoins the round on
 * whatever time is left for everyone else. The earlier attempt's `Answer` rows
 * stay (the attempt is archived, not deleted); the player's Redis working grids
 * are cleared so the client sees a blank grid on its next read.
 */
async function restartOneParticipant(
  input: RestartOneParticipantInput,
): Promise<RestartOneParticipantResult> {
  const round = await prisma.round.findUnique({
    where: { id: input.roundId },
    select: { id: true, status: true },
  });
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }

  if (round.status !== "ACTIVE" && round.status !== "PAUSED") {
    throw roundNotRunningError(round.status);
  }

  const participation = await repository.findParticipation(
    input.roundId,
    input.participantId,
  );
  if (!participation) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_PARTICIPANT_NOT_FOUND), {
      code: ORCHESTRATOR_PARTICIPANT_NOT_FOUND,
    });
  }

  const current = await repository.findCurrentAttempt(participation.id);
  const newAttemptNumber = await repository.nextAttemptNumber(participation.id);

  const { newAttemptId, attemptCount } = await repository.archiveAndRestart({
    participationId: participation.id,
    currentAttemptId: current?.id ?? null,
    newAttemptNumber,
    now: now(),
  });

  // Clear the player's Redis working grids for this round so the next
  // reconnect / autosave reads see a blank grid. Done after the durable write
  // so a failure to clear Redis never leaves the participation in a
  // half-restarted state — at worst the student sees their old grid until the
  // next autosave overwrites it, which is recoverable; the inverse is not.
  await gameplayRepository.clearGridsForRound(input.roundId, input.participantId);

  const timer = await roundTimerService.remaining(input.roundId);
  const remainingSeconds = timer?.remainingSeconds ?? 0;
  const totalSeconds = timer?.totalSeconds ?? 0;

  return {
    participationId: participation.id,
    archivedAttemptId: current?.id ?? null,
    newAttemptId,
    attemptCount,
    remainingSeconds,
    totalSeconds,
  };
}

export const orchestratorService = {
  restartOneParticipant,
};
