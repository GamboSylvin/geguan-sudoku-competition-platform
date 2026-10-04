/**
 * The Gameplay module's domain rules and public interface (Unit 07). Other
 * modules call this service, never the repository (invariant 4).
 *
 * Owns: the player's working grid for every puzzle of the active round (in
 * Redis, BLD-007), the autosave write path, and the reconnect path that hands a
 * player back exactly the grid they last saved plus the server-authoritative
 * remaining time.
 *
 * Two hard rules this module enforces:
 *   - **Participant scoping.** A player reads and writes only their own grid
 *     (spec Security Considerations). Every entry point resolves the caller's
 *     `participantId` from the session and rejects the request when the caller
 *     is not a participant in the round.
 *   - **Active-round gating.** Autosave is accepted only while the round is
 *     `ACTIVE`. After the timer reaches zero the round flips to `FINISHED` and
 *     further writes are rejected (spec Error Cases). Autosave never triggers
 *     scoring (invariant 7; scoring is Unit 08's).
 *
 * Question delivery at round start does **not** live here. The Round module
 * fetches the questions at countdown zero (BLD-006) and the realtime gateway
 * pushes them via `round:started`; this module's `getState` re-reads them for
 * the reconnect path only.
 */
import { prisma } from "../../infra";
import { nowMs } from "../../shared/clock";
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../shared/errors";
import { translate } from "../../shared/i18n";
import * as roundRepository from "../round/round.repository";
import { roundTimerService } from "../round/round-timer.service";
import * as repository from "./gameplay.repository";
import type {
  AutosaveInput,
  GameplayStatePayload,
  WorkingGrid,
} from "./gameplay.types";

/**
 * Load the caller's participation row for a round and reject when the caller is
 * not a participant. The participation row is the single source of truth for
 * "is this account a participant in this round" (data-model, "Access rules").
 */
async function requireParticipation(roundId: string, participantId: string) {
  const participation = await prisma.roundParticipation.findUnique({
    where: { roundId_participantId: { roundId, participantId } },
  });
  if (!participation) {
    throw new ForbiddenError(translate("en", "gameplay.notAParticipant"), {
      code: "gameplay.notAParticipant",
    });
  }
  return participation;
}

/**
 * Load the round and reject when it is not currently accepting gameplay
 * (autosave). Only an `ACTIVE` round accepts writes; `FINISHED` and everything
 * before `ACTIVE` reject (spec Error Cases: writes after the timer hits zero
 * are refused; Unit 08 acts on the last saved state).
 */
async function requireActiveRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, status: true, stageId: true },
  });
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }
  if (round.status !== "ACTIVE") {
    throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
      code: "gameplay.notActive",
    });
  }
  return round;
}

/**
 * Reject when the question does not belong to this round. Autosave for a
 * question in another round is an error, not a silent no-op (spec Error Cases).
 */
async function requireQuestionInRound(roundId: string, questionId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, roundId },
    select: { id: true },
  });
  if (!question) {
    throw new UnprocessableEntityError(translate("en", "gameplay.notActive"), {
      code: "gameplay.notActive",
      details: { reason: "questionNotInRound" },
    });
  }
}

/**
 * Autosave the player's working grid for one question. Called roughly twice per
 * second while the player edits (spec Implementation Detail 4). Never calls
 * into scoring (invariant 7).
 */
async function autosave(
  roundId: string,
  participantId: string,
  input: AutosaveInput,
): Promise<{ savedAtMs: number }> {
  await requireActiveRound(roundId);
  await requireParticipation(roundId, participantId);
  await requireQuestionInRound(roundId, input.questionId);

  const savedAtMs = nowMs();
  await repository.saveGrid(roundId, participantId, input.questionId, input.grid, savedAtMs);
  return { savedAtMs };
}

/**
 * The reconnect path (spec Implementation Detail 5). Returns the round's
 * questions, the player's saved grids for the round, and the server-authoritative
 * timer snapshot — enough for the client to render exactly the state the player
 * left. A player with no participation in the round is rejected; a participant
 * with no live round yet gets an empty grid list and a null timer.
 */
async function getState(
  roundId: string,
  participantId: string,
): Promise<GameplayStatePayload> {
  await requireParticipation(roundId, participantId);

  const round = await roundRepository.findRoundWithContext(roundId);
  if (!round) {
    throw new NotFoundError(translate("en", "gameplay.roundNotFound"), {
      code: "gameplay.roundNotFound",
    });
  }

  const questionRows = await roundRepository.listRoundQuestions(roundId);
  const questions = questionRows.map((q) => ({
    id: q.id,
    sequence: q.sequence,
    type: q.type,
    gridRows: q.gridRows,
    gridColumns: q.gridColumns,
    regions: q.regions,
    startingGrid: q.startingGrid,
    points: q.points,
  }));

  const savedGrids = await repository.listGridsForRound(roundId, participantId);

  const timer = await roundTimerService.remaining(roundId);

  return {
    roundId: round.id,
    competitionId: round.stage.competitionId,
    stageId: round.stageId,
    status: round.status,
    questions,
    savedGrids,
    timer: timer
      ? { remainingSeconds: timer.remainingSeconds, totalSeconds: timer.totalSeconds }
      : null,
  };
}

/**
 * The round-start hook the realtime gateway installs. The Round module calls it
 * after the questions have been fetched and the round timer has started; this
 * module's only job at round start is to be a stable place to hang that hook.
 * The actual push lives in the realtime layer (no Socket.io import here, per
 * the module-first boundary).
 */
export type { RoundStartedPayload } from "../round/round.types";

export const gameplayService = {
  autosave,
  getState,
};

export type { WorkingGrid };
