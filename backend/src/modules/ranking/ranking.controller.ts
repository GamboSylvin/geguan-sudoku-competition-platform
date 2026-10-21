/**
 * HTTP layer for the Ranking module (Unit 09). Validates input, then calls the
 * service; no domain rule lives here.
 *
 * The controller-facing read lives on the competition path — `GET
 * /api/competitions/:id/categories/:categoryId/ranking` — because a ranking is
 * always scoped to one category of one competition (EVT-002). The router uses
 * `mergeParams` so it can read the competition id from the mount path.
 *
 * Controller-only (ROL-002). This endpoint never serves a player session; the
 * player-facing score reveal at competition FINISHED is Unit 12's concern
 * (SUB-007/BLD-029).
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { rankingService } from "./ranking.service";
import { schoolRankingService } from "./school-ranking.service";

export const rankingRouter = Router({ mergeParams: true });

/** Only a controller may read a ranking (ROL-002). */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", "ranking.forbidden"), {
        code: "ranking.forbidden",
      }),
    );
    return;
  }
  next();
}

const paramsSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
});

/**
 * GET /api/competitions/:id/categories/:categoryId/ranking — the current Individual
 * ranking for one category (provisional while the stage runs, final once complete).
 * 200 with the ranking; 404 when the competition or its Individual stage is missing.
 */
rankingRouter.get(
  "/:categoryId/ranking",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, categoryId } = parseInput(paramsSchema, req.params);
      const ranking = await rankingService.getCategoryRanking(id, categoryId);
      if (!ranking) {
        throw new NotFoundError(translate("en", "ranking.notFound"), {
          code: "ranking.notFound",
        });
      }
      res.status(200).json(ranking);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/competitions/:id/categories/:categoryId/school-ranking — Unit 15's
 * school leaderboard for one category. Controller-only (ROL-002), same as the
 * individual read above. An incomplete category still returns 200 with whatever
 * is computable and `isFinal: false`; only a missing competition/Individual stage
 * is a 404.
 */
rankingRouter.get(
  "/:categoryId/school-ranking",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, categoryId } = parseInput(paramsSchema, req.params);
      const ranking = await schoolRankingService.getSchoolCategoryRanking(id, categoryId);
      res.status(200).json(ranking);
    } catch (error) {
      next(error);
    }
  },
);
