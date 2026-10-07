/**
 * HTTP layer for the Gameplay module (Unit 07). Validates input, then calls the
 * service; no domain rule lives here.
 *
 * Routes (both behind `requireAuth`, both participant-scoped in the service):
 *   - `POST /api/gameplay/:roundId/autosave` — the autosave write path. The
 *     client calls this roughly twice per second while the player edits (spec
 *     Implementation Detail 4). Body `{ questionId, grid }`.
 *   - `GET  /api/gameplay/:roundId/state` — the reconnect path. Returns the
 *     round's questions, the player's saved grids, and the server-authoritative
 *     timer snapshot (spec API Contract).
 *
 * The caller must be a participant in the round (spec Security Considerations);
 * a controller or judge session is rejected by the participant check.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { gameplayService } from "./gameplay.service";

export const gameplayRouter = Router();

function requireParticipant(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "PLAYER" || !req.auth.participantId) {
    next(
      new UnauthorizedError(translate("en", "gameplay.forbidden"), {
        code: "gameplay.forbidden",
      }),
    );
    return;
  }
  next();
}

const autosaveSchema = z.object({
  questionId: z.string().min(1),
  grid: z.array(z.number().int().nullable()),
});

gameplayRouter.post(
  "/:roundId/autosave",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseInput(autosaveSchema, req.body);
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const result = await gameplayService.autosave(roundId, participantId, input);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

gameplayRouter.get(
  "/:roundId/state",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const state = await gameplayService.getState(roundId, participantId);
      res.status(200).json(state);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/gameplay/:roundId/submit — the player-initiated manual submit
 * (Unit 08). Body is empty: the server already has the latest autosaved grid
 * per puzzle, and the session identifies the participant.
 *
 * 200 with `{ accepted: true, submissionType }`. The score is never returned
 * (SUB-007/BLD-029). A submit that arrives after the timer expired is
 * recorded as `TIMEOUT` (SUB-003) and the response is indistinguishable from
 * a successful manual submit. A repeated submit is a no-op (PL-009).
 */
gameplayRouter.post(
  "/:roundId/submit",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const result = await gameplayService.submit(roundId, participantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/gameplay/:roundId/left-page — the player client reports a
 * page-visibility-leave event during an active round (Unit 10). The server
 * increments `RoundParticipation.leftAnswerPageCount`. Body is empty: the
 * session identifies the participant; the client is never trusted with the
 * count value itself, only with the leave signal.
 *
 * 200 with `{ leftAnswerPageCount }` — the new server-side count. A signal
 * arriving while the round is not ACTIVE is a no-op (200 with the current
 * count), so the client never has to retry or apologize for a late event.
 */
gameplayRouter.post(
  "/:roundId/left-page",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const result = await gameplayService.recordLeftAnswerPage(roundId, participantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
