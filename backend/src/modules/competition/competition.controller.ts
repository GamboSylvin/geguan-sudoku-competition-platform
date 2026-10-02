/**
 * HTTP layer for the Competition module (Unit 03). It validates input, then calls the
 * service; no domain rule lives here.
 *
 * Every endpoint requires a valid `CONTROLLER` session (ROL-002): `requireAuth`
 * (Unit 02) resolves the caller, then `requireController` rejects any other role.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { competitionService } from "./competition.service";

export const competitionRouter = Router();

/** Only a controller may create, edit or publish a competition (ROL-002). */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", "competition.forbidden"), {
        code: "competition.forbidden",
      }),
    );
    return;
  }
  next();
}

const categorySchema = z.object({
  code: z.string().trim().min(1).max(16),
  name: z.string().trim().min(1).max(64),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  categories: z.array(categorySchema).min(1),
});

/** Every round-settings field is optional; each is a whole number (null clears an optional one). */
const roundSettingsPatchSchema = z
  .object({
    durationSeconds: z.number().int().positive().optional(),
    preparationSeconds: z.number().int().positive().optional(),
    earlyBonusRate: z.number().int().nonnegative().optional(),
    earlyBonusCap: z.number().int().nonnegative().nullable().optional(),
    teamPointsPerQuestion: z.number().int().min(1).optional(),
    rotationPeriodSeconds: z.number().int().positive().optional(),
    teamQuestionCount: z.number().int().positive().optional(),
    teamTotalTimeSeconds: z.number().int().positive().nullable().optional(),
    individualTotalWarning: z.number().int().nonnegative().nullable().optional(),
    partitionPuzzleCount: z.number().int().positive().optional(),
    partitionTotalTimeSeconds: z.number().int().positive().optional(),
    partitionPointsPerPuzzle: z.number().int().min(1).optional(),
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullish(),
    categories: z.array(categorySchema).min(1).optional(),
    roundSettings: z.record(z.string().min(1), roundSettingsPatchSchema).optional(),
  })
  .strict();

const idParamSchema = z.object({ id: z.string().min(1) });

/**
 * POST /api/competitions — body `{ name, description?, categories: [{ code, name }] }`.
 * 201 with the created competition and its auto-generated structure.
 */
competitionRouter.post(
  "/",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseInput(createSchema, req.body);
      const competition = await competitionService.createCompetition(input);
      res.status(201).json(competition);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/competitions/:id — edits name/description and categories (pre-publish
 * only) or round settings (any time within this unit's scope). 200 with the updated
 * competition.
 */
competitionRouter.patch(
  "/:id",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(idParamSchema, req.params);
      const input = parseInput(updateSchema, req.body);
      const competition = await competitionService.updateCompetition(id, input);
      res.status(200).json(competition);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/competitions/:id/publish — 200 with `entryLinkToken`/`bigScreenLinkToken`
 * and the new status on success; 422 with the list of unmet readiness conditions on
 * failure (spec API contract).
 */
competitionRouter.post(
  "/:id/publish",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(idParamSchema, req.params);
      const result = await competitionService.publishCompetition(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
