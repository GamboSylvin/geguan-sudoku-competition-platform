/**
 * HTTP layer for the Gameplay module (Unit 07). Validates input, then calls the
 * service; no domain rule lives here.
 *
 * Routes (all behind `requireAuth`, all participant-scoped in the service):
 *   - `POST /api/gameplay/:roundId/autosave` — the autosave write path. The
 *     client calls this roughly twice per second while the player edits (spec
 *     Implementation Detail 4). Body `{ questionId, grid }`.
 *   - `GET  /api/gameplay/:roundId/state` — the reconnect path. Returns the
 *     round's questions, the player's saved grids, and the server-authoritative
 *     timer snapshot (spec API Contract).
 * Unit 13 adds `POST /rotation/:roundId/submit` and `GET /rotation/:roundId/state`;
 * Unit 14 adds `POST /partition/:roundId/autosave` and
 * `GET /partition/:roundId/state` (both documented at their own definitions below).
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
import { teamRotationService } from "./team-rotation.service";
import { teamPartitionService } from "./team-partition.service";

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

/** Unit 13: the rotation submit body — same shape, the grid is the whole answer. */
const rotationSubmitSchema = z.object({
  questionId: z.string().min(1),
  grid: z.array(z.number().int().nullable()),
});

/**
 * Unit 14: the partition band autosave body. The client still sends a **whole-board**
 * array (one shape for every gameplay screen), but only the caller's own rows may carry
 * a value — the service enforces that per cell, so the schema here stays shape-only and
 * holds no band rule.
 */
const partitionAutosaveSchema = z.object({
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

/**
 * POST /api/gameplay/rotation/:roundId/submit — the Team stage's rotation relay
 * submit (Unit 13, spec API Contract). A member submits the question their tablet
 * currently holds at any time; the rotation period is **not** a deadline
 * (TEM-002/SUB-006). Body `{ questionId, grid }`.
 *
 * 200 with `{ correct, correctCount, teamScore, roundEnded }` — unlike the
 * Individual stage (SUB-007/BLD-029), a team round's score is a shared, flat value
 * the whole team watches move, not a hidden per-player result.
 * 409 when the tablet no longer holds that question (it rotated away between the
 * tap and this request) — the client is refreshed with what is held now.
 *
 * The `questionId` in the body is only ever *matched against* the server-held
 * state, never trusted as the source of it (spec Security Considerations).
 */
gameplayRouter.post(
  "/rotation/:roundId/submit",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseInput(rotationSubmitSchema, req.body);
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const result = await teamRotationService.submitRotation(roundId, participantId, input);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/gameplay/rotation/:roundId/state — one tablet's reconnect read
 * (Unit 13). `GET /:roundId/state` cannot serve a team round: its questions come
 * from `Question.roundId`, which a team round never sets (BLD-040).
 */
gameplayRouter.get(
  "/rotation/:roundId/state",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const state = await teamRotationService.getTabletState(roundId, participantId);
      res.status(200).json(state);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/gameplay/partition/:roundId/autosave — one member's band write for the
 * Team stage's partition collaboration round (Unit 14, 齐心协力). There is **no submit
 * route for this round**: the puzzle scores the instant the *combined* grid is fully
 * correct, so this write path is the only way a score can happen (spec Context).
 * Body `{ questionId, grid }` — the grid is the whole board, but the server keeps only
 * the cells inside the caller's own row-band and rejects anything else, per cell.
 *
 * 200 with `{ savedAtMs, puzzleIndex, puzzleCount, solvedCount, teamScore, puzzleSolved,
 * roundEnded }` — progress, never a per-member correctness verdict.
 * 409 when the team has already moved past this puzzle (a teammate's autosave solved it
 * while this one was in flight); 422 when a cell sits outside the caller's band.
 */
gameplayRouter.post(
  "/partition/:roundId/autosave",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseInput(partitionAutosaveSchema, req.body);
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const result = await teamPartitionService.autosaveBand(roundId, participantId, input);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/gameplay/partition/:roundId/state — one tablet's reconnect read (Unit 14).
 * `GET /:roundId/state` cannot serve a team round: its questions come from
 * `Question.roundId`, which a team round never sets (BLD-040).
 */
gameplayRouter.get(
  "/partition/:roundId/state",
  requireAuth,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = req.params.roundId as string;
      const participantId = req.auth!.participantId!;
      const state = await teamPartitionService.getTabletState(roundId, participantId);
      res.status(200).json(state);
    } catch (error) {
      next(error);
    }
  },
);
