/**
 * Cancel (Unit 11, spec Implementation Detail 7, ROL-009, resolves U-31).
 *
 * A different scenario from reset/rematch: this is a competition that is invalid
 * from the start, stopped without any scoring and with no results ever released.
 * `CANCELLED` is its own terminal state — separate from `FINISHED` — and once set,
 * nothing else can act on the competition: it cannot be resumed, reset or rematched,
 * because every command in this module goes through `requireOpenCompetition`.
 *
 * Unit 12 is responsible for hiding results for a cancelled competition; this unit
 * only sets the state it reads.
 */
import { now } from "../../shared/clock";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { roundService } from "../round";
import * as repository from "./orchestrator.repository";
import { ORCHESTRATOR_COMPETITION_CLOSED, type CancelResult } from "./orchestrator.types";

/**
 * Cancel a competition from any state before `FINISHED`. A second cancel — or a
 * cancel after a finish — is rejected rather than silently no-op'd: the spec's
 * Error Cases list "finish-early or cancel twice: the second call is a
 * no-op/rejected", and the competition is already in a terminal state either way.
 */
async function cancelCompetition(competitionId: string): Promise<CancelResult> {
  const competition = await repository.findCompetition(competitionId);
  if (!competition) {
    throw new NotFoundError(translate("en", "competition.notFound"), {
      code: "competition.notFound",
    });
  }
  if (competition.status === "CANCELLED" || competition.status === "FINISHED") {
    throw new ConflictError(translate("en", ORCHESTRATOR_COMPETITION_CLOSED), {
      code: ORCHESTRATOR_COMPETITION_CLOSED,
      details: { status: competition.status },
    });
  }

  // Stop whatever is in flight first, so no timer keeps ticking under a cancelled
  // competition and no round-ended signal can arrive afterwards and score
  // something (spec: "no score is computed from that point on"). Both are no-ops
  // when nothing is running.
  await roundService.stopRoundEarlyForCompetition(competitionId);
  await roundService.cancelPreparationForCompetition(competitionId);

  const cancelledAt = now();
  await repository.markCompetitionCancelled(competitionId, cancelledAt);

  return { competitionId, status: "CANCELLED", cancelledAt };
}

export const cancelService = {
  cancelCompetition,
};
