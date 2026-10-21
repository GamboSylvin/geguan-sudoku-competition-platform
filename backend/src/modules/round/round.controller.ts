/**
 * HTTP layer for the Round module (Unit 07). It validates input, then calls the
 * service; no domain rule lives here.
 *
 * What this router exposes: nothing public. The only endpoint is the dev-only
 * internal trigger that starts stage 1 round 1's preparation, and it is
 * gated twice: it requires a controller session AND it refuses to run in
 * production. Unit 11 will replace this endpoint with the real controller
 * command surface (spec Context, Implementation Detail 7).
 *
 * Pause, resume and the round's remaining time are *not* HTTP endpoints in
 * this unit. Unit 11 will expose them; Unit 07 exposes them on the service.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { roundService } from "./round.service";

export const roundRouter = Router();

function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", "round.forbidden"), {
        code: "round.forbidden",
      }),
    );
    return;
  }
  next();
}

function requireNonProduction(_req: Request, _res: Response, next: NextFunction): void {
  if (env.NODE_ENV === "production") {
    next(
      new ForbiddenError(translate("en", "round.devOnly"), {
        code: "round.devOnly",
      }),
    );
    return;
  }
  next();
}

const startPreparationSchema = z.object({
  competitionId: z.string().min(1),
});

/**
 * POST /api/rounds/dev/start-stage1-round1 — the internal trigger (spec step 7).
 * Body `{ competitionId }`. 201 with the started preparation's identifiers.
 * 403 in production, 403 for a non-controller, 409 if the competition is not
 * WAITING or another round is already running.
 */
roundRouter.post(
  "/dev/start-stage1-round1",
  requireNonProduction,
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseInput(startPreparationSchema, req.body);
      const started = await roundService.startStage1Round1Preparation(input.competitionId);
      res.status(201).json(started);
    } catch (error) {
      next(error);
    }
  },
);
