/**
 * Reset / rematch at the four scopes (Unit 11, spec Implementation Detail 5,
 * ROL-005, resolves U-13).
 *
 * The rule in exactly one place, per the spec's Implementation Notes: **reuse
 * Unit 10's archive-and-restart operation, parameterized by scope** — never
 * duplicate the archiving logic. The only difference from a judge's restart is the
 * time granted: a rematch gives the round its **full** duration again, not the
 * remaining time Unit 10 hands back. That is `roundService.grantFullRoundDuration`,
 * the timer service's full-duration restart; Unit 10's `restartOneParticipant`
 * deliberately does not touch the shared timer at all.
 *
 * **Finding (spec wording vs. as-built schema, flagged for sign-off):** the round's
 * timer is shared by everyone in it and there is exactly one live timer per
 * competition. "One person gets full round time" therefore *is* "the round gets
 * full time" — the implementation grants the full duration to the round's timer and
 * restricts the archive-and-restart to the affected participant(s). A per-student
 * private timer does not exist and the spec forbids a schema change.
 *
 * **Finding (EVENT scope):** the spec names the scope but never says what "the
 * whole event" resets to. Implemented as: restart the round currently in flight for
 * every participant in it, with full time — i.e. the widest scope that can still
 * be acted on while the competition is open. Earlier rounds' scores are left
 * untouched, as the spec requires for every scope.
 *
 * The TEAM scope is built generically here but is only exercisable once Units 13/14
 * add team-round runtime (spec Context).
 */
import { ConflictError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { roundService } from "../round";
import * as repository from "./orchestrator.repository";
import { orchestratorService } from "./orchestrator.service";
import { requireOpenCompetition } from "./stage-command.service";
import {
  ORCHESTRATOR_PARTICIPANT_NOT_FOUND,
  ORCHESTRATOR_ROUND_NOT_FOUND,
  ORCHESTRATOR_ROUND_NOT_IN_COMPETITION,
  ORCHESTRATOR_ROUND_NOT_RUNNING,
  ORCHESTRATOR_TEAM_NOT_FOUND,
  type ResetRematchResult,
  type ResetRematchScope,
} from "./orchestrator.types";

/**
 * The rounds a scope acts on. Only a round that is live or paused can be rematched:
 * one that already ended is scored, and "reset after finishing" is explicitly
 * settled as not possible (ROL-005). `WAITING`/`PREPARATION` rounds have no attempt
 * to archive — the controller starts the stage instead.
 */
async function resolveRounds(
  competitionId: string,
  scope: ResetRematchScope,
  roundId: string | null | undefined,
) {
  if (scope === "ROUND" || scope === "EVENT") {
    if (scope === "ROUND" && !roundId) {
      throw new NotFoundError(translate("en", ORCHESTRATOR_ROUND_NOT_FOUND), {
        code: ORCHESTRATOR_ROUND_NOT_FOUND,
      });
    }
    if (scope === "ROUND") {
      const round = await repository.findRoundForCommand(roundId!);
      if (!round) {
        throw new NotFoundError(translate("en", ORCHESTRATOR_ROUND_NOT_FOUND), {
          code: ORCHESTRATOR_ROUND_NOT_FOUND,
        });
      }
      if (round.stage.competitionId !== competitionId) {
        throw new NotFoundError(
          translate("en", ORCHESTRATOR_ROUND_NOT_IN_COMPETITION),
          { code: ORCHESTRATOR_ROUND_NOT_IN_COMPETITION },
        );
      }
      return [round];
    }
    // EVENT: the round in flight, whatever it is.
    const activeRoundId = await roundService.getActiveRoundForCompetition(competitionId);
    if (!activeRoundId) {
      throw new ConflictError(translate("en", ORCHESTRATOR_ROUND_NOT_RUNNING), {
        code: ORCHESTRATOR_ROUND_NOT_RUNNING,
        details: { status: "NONE" },
      });
    }
    const round = await repository.findRoundForCommand(activeRoundId);
    return round ? [round] : [];
  }

  // PARTICIPANT / TEAM: no explicit round, so the competition's live one.
  const activeRoundId = await roundService.getActiveRoundForCompetition(competitionId);
  if (!activeRoundId) {
    throw new ConflictError(translate("en", ORCHESTRATOR_ROUND_NOT_RUNNING), {
      code: ORCHESTRATOR_ROUND_NOT_RUNNING,
      details: { status: "NONE" },
    });
  }
  const round = await repository.findRoundForCommand(activeRoundId);
  if (!round) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_ROUND_NOT_FOUND), {
      code: ORCHESTRATOR_ROUND_NOT_FOUND,
    });
  }
  return [round];
}

/** The participant ids a scope restarts, for one round. */
async function resolveParticipants(
  competitionId: string,
  scope: ResetRematchScope,
  input: { participantId?: string | null; teamId?: string | null },
): Promise<string[] | null> {
  if (scope === "EVENT" || scope === "ROUND") return null; // everyone in the round

  if (scope === "PARTICIPANT") {
    if (!input.participantId) {
      throw new NotFoundError(translate("en", ORCHESTRATOR_PARTICIPANT_NOT_FOUND), {
        code: ORCHESTRATOR_PARTICIPANT_NOT_FOUND,
      });
    }
    return [input.participantId];
  }

  // TEAM: the team's members. Built generically; no team-round runtime exists yet
  // (Units 13/14), so this path has no data to act on in this unit's own tests.
  if (!input.teamId) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_TEAM_NOT_FOUND), {
      code: ORCHESTRATOR_TEAM_NOT_FOUND,
    });
  }
  const team = await repository.findTeamForCommand(input.teamId, competitionId);
  if (!team) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_TEAM_NOT_FOUND), {
      code: ORCHESTRATOR_TEAM_NOT_FOUND,
    });
  }
  return team.participants.map((p) => p.id);
}

/**
 * Archive and restart every participation in scope, then grant the round its full
 * duration again. Returns the ids of the rounds whose timer was reset and how many
 * attempts were restarted.
 */
export async function resetRematch(input: {
  competitionId: string;
  scope: ResetRematchScope;
  roundId?: string | null;
  participantId?: string | null;
  teamId?: string | null;
}): Promise<ResetRematchResult> {
  await requireOpenCompetition(input.competitionId);

  const rounds = await resolveRounds(input.competitionId, input.scope, input.roundId);
  if (rounds.length === 0) {
    throw new NotFoundError(translate("en", ORCHESTRATOR_ROUND_NOT_FOUND), {
      code: ORCHESTRATOR_ROUND_NOT_FOUND,
    });
  }

  const roundIds: string[] = [];
  let restartedCount = 0;
  let grantedSeconds = 0;

  for (const round of rounds) {
    if (round.status !== "ACTIVE" && round.status !== "PAUSED") {
      throw new ConflictError(translate("en", ORCHESTRATOR_ROUND_NOT_RUNNING), {
        code: ORCHESTRATOR_ROUND_NOT_RUNNING,
        details: { status: round.status },
      });
    }

    const participantIds = await resolveParticipants(
      input.competitionId,
      input.scope,
      input,
    );
    const participations = await repository.listParticipations(round.id, participantIds ?? undefined);

    for (const participation of participations) {
      // Unit 10's operation, unchanged: archive the current attempt, create a
      // fresh blank one, clear the player's Redis working grids.
      const restarted = await orchestratorService.restartOneParticipant({
        roundId: round.id,
        participantId: participation.participantId,
      });
      if (restarted.newAttemptId) restartedCount += 1;
    }

    // The key difference from a judge's restart: full round time, not remaining.
    const durationSeconds = round.settings?.durationSeconds ?? 0;
    const snapshot = await roundService.grantFullRoundDuration(round.id, durationSeconds);
    if (snapshot) {
      grantedSeconds = snapshot.totalSeconds;
      roundIds.push(round.id);
    }
  }

  return {
    scope: input.scope,
    roundIds,
    restartedCount,
    grantedSeconds,
  };
}

export const resetRematchService = {
  resetRematch,
};
