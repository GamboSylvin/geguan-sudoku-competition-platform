/**
 * HTTP layer for the `School` CRUD surface (BLD-052). It validates input, then calls
 * the service; no domain rule lives here.
 *
 * Mounted under `/api/competitions/:id/schools` with `mergeParams` (the same pattern
 * `judgeAssignmentRouter` uses), so every route reads `:id` for the competition.
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
import { schoolService } from "./school.service";

export const schoolRouter = Router({ mergeParams: true });

/** Only a controller may manage a competition's schools (ROL-002). */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", "school.forbidden"), {
        code: "school.forbidden",
      }),
    );
    return;
  }
  next();
}

const competitionIdParamSchema = z.object({ id: z.string().min(1) });

const schoolParamsSchema = z.object({
  id: z.string().min(1),
  schoolId: z.string().min(1),
});

const createSchoolSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

/** Rename only: nothing else about a school is editable (BLD-052). */
const updateSchoolSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

/**
 * GET /api/competitions/:id/schools — the setup panel's list, each row carrying the
 * participant/team counts that say whether it can be removed. 200 with `{ schools }`.
 */
schoolRouter.get(
  "/",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(competitionIdParamSchema, req.params);
      const schools = await schoolService.listSchools(id);
      res.status(200).json({ schools });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/competitions/:id/schools — body `{ name }`. 201 with the created school.
 * 409 `school.nameTaken` on a name this competition already uses.
 */
schoolRouter.post(
  "/",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(competitionIdParamSchema, req.params);
      const input = parseInput(createSchoolSchema, req.body);
      const school = await schoolService.createSchool(id, input);
      res.status(201).json(school);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/competitions/:id/schools/:schoolId — body `{ name }`. Renames the school.
 * 200 with it, 404 `school.notFound` on an unknown id (or one belonging to another
 * competition), 409 `school.nameTaken` on a clash.
 */
schoolRouter.patch(
  "/:schoolId",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, schoolId } = parseInput(schoolParamsSchema, req.params);
      const input = parseInput(updateSchoolSchema, req.body);
      const school = await schoolService.updateSchool(id, schoolId, input);
      res.status(200).json(school);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/competitions/:id/schools/:schoolId — removes an empty school. 204 on
 * success; 409 `school.hasParticipants` / `school.hasTeam` while anything still points
 * at it; 404 `school.notFound` on an unknown id. 204 rather than 200-with-the-row,
 * because after this call the row no longer exists.
 */
schoolRouter.delete(
  "/:schoolId",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, schoolId } = parseInput(schoolParamsSchema, req.params);
      await schoolService.deleteSchool(id, schoolId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
