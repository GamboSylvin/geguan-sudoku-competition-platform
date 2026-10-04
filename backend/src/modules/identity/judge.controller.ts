/**
 * HTTP layer for the judge list and range assignment (Unit 06). It validates input,
 * then calls the service; no domain rule lives here.
 *
 * Every endpoint requires a valid `CONTROLLER` session (ROL-002): `requireAuth`
 * (Unit 02) resolves the caller, then `requireController` rejects any other role.
 * A judge's own minimal landing is served by `GET /api/judges/me`, which instead
 * requires a JUDGE session.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { judgeService } from "./judge.service";

export const judgeRouter = Router();

/** Only a controller may manage judges or assign ranges (ROL-002). */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", "judge.forbidden"), {
        code: "judge.forbidden",
      }),
    );
    return;
  }
  next();
}

const createJudgeSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const judgeIdParamSchema = z.object({ id: z.string().min(1) });

const competitionIdParamSchema = z.object({ id: z.string().min(1) });

const assignmentParamsSchema = z.object({
  id: z.string().min(1),
  assignmentId: z.string().min(1),
});

const assignSchema = z
  .object({
    judgeId: z.string().min(1),
    fromParticipantNumber: z.number().int().positive(),
    toParticipantNumber: z.number().int().positive(),
  })
  .refine((v) => v.fromParticipantNumber <= v.toParticipantNumber, {
    message: "fromParticipantNumber must be <= toParticipantNumber",
  });

/**
 * POST /api/judges — body `{ name }`. 201 with the created judge plus its one-time
 * `{ username, password }` (the credential slip; never re-shown).
 */
judgeRouter.post(
  "/",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseInput(createJudgeSchema, req.body);
      const judge = await judgeService.createJudge(input);
      res.status(201).json(judge);
    } catch (error) {
      next(error);
    }
  },
);

/** GET /api/judges — list judges, active and inactive together. */
judgeRouter.get(
  "/",
  requireAuth,
  requireController,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const judges = await judgeService.listJudges();
      res.status(200).json({ judges });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/judges/:id — deactivate the judge. 200 with the deactivated judge on
 * success; 409 naming the unfinished competition(s) when ROL-010 blocks removal.
 */
judgeRouter.delete(
  "/:id",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(judgeIdParamSchema, req.params);
      const judge = await judgeService.removeJudge(id);
      res.status(200).json(judge);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/judges/me — the minimal judge landing: the calling judge's own
 * assignments (which competition, which participant-number range), so the judge
 * sees confirmation after login. Requires a JUDGE session, not a controller one.
 */
judgeRouter.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.auth?.role !== "JUDGE" || !req.auth.judgeId) {
        next(
          new ForbiddenError(translate("en", "judge.forbidden"), {
            code: "judge.forbidden",
          }),
        );
        return;
      }
      const judgeId = req.auth.judgeId;
      const assignments = await judgeService.listJudgeAssignments(judgeId);
      res.status(200).json({ judgeId, assignments });
    } catch (error) {
      next(error);
    }
  },
);

/** The range-assignment router, mounted under `/api/competitions` in `routes.ts`. */
export const judgeAssignmentRouter = Router({ mergeParams: true });

/**
 * POST /api/competitions/:id/judge-assignments — body
 * `{ judgeId, fromParticipantNumber, toParticipantNumber }`. Creates the judge's
 * assignment on this competition or edits the existing one (U(competitionId,
 * judgeId)). 201 with the assignment.
 */
judgeAssignmentRouter.post(
  "/",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: competitionId } = parseInput(competitionIdParamSchema, req.params);
      const input = parseInput(assignSchema, req.body);
      const assignment = await judgeService.assignJudgeRange(
        competitionId,
        input,
        req.auth?.accountId ?? null,
      );
      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/competitions/:id/judge-assignments/:assignmentId — unassign the judge
 * from this competition (the controller's way to free a judge for removal). 204.
 */
judgeAssignmentRouter.delete(
  "/:assignmentId",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: competitionId, assignmentId } = parseInput(
        assignmentParamsSchema,
        req.params,
      );
      await judgeService.unassignJudge(competitionId, assignmentId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
