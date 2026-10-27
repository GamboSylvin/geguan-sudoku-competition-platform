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
 * PATCH /api/judges/:id/reactivate — undo a deactivation (report §4a). 200 with the
 * reactivated judge plus the username its account keeps; the password is never re-shown
 * (BLD-037), and no new account is created. No ROL-010 guard here: that guard protects
 * supervision during an event, and reactivation restores it.
 */
judgeRouter.patch(
  "/:id/reactivate",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(judgeIdParamSchema, req.params);
      const judge = await judgeService.reactivateJudge(id);
      res.status(200).json(judge);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/judges/:id/assignments — this judge's ranges, competition names included. The
 * permanent-deletion dialog reads it so it can name what the deletion will destroy before
 * the controller confirms, rather than warning in the abstract (2026-10-26).
 */
judgeRouter.get(
  "/:id/assignments",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(judgeIdParamSchema, req.params);
      const assignments = await judgeService.listAssignmentsForController(id);
      res.status(200).json({ assignments });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/judges/:id/permanent — destroy the judge row, its accounts and every range
 * it holds (2026-10-26). Separate from `DELETE /:id` on purpose: that one deactivates and
 * is guarded by ROL-010, this one deletes and is not. 200 with what was destroyed, so the
 * screen can report the consequences of an operation that cannot be undone.
 */
judgeRouter.delete(
  "/:id/permanent",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(judgeIdParamSchema, req.params);
      const destroyed = await judgeService.destroyJudge(id);
      res.status(200).json(destroyed);
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
        // Not `judge.forbidden`: that code means "you are not a controller" and is what
        // the management endpoints return. This route is the judge's own landing, so the
        // rejection is the mirror image of it — reusing the management message told a
        // controller "only a controller can manage judges" on a route that is not a
        // management route, which reads as nonsense to whoever is debugging it.
        next(
          new ForbiddenError(translate("en", "judge.meRequiresJudgeRole"), {
            code: "judge.meRequiresJudgeRole",
          }),
        );
        return;
      }
      const judgeId = req.auth.judgeId;
      // The session's own scope (F1): a judge who came through one competition's link
      // answers with that competition's assignment only. Null when the session arrived
      // with no link, which keeps the pre-F1 answer rather than showing nothing.
      const scopedCompetitionId = req.auth.competitionId;
      const [assignments, name] = await Promise.all([
        judgeService.listJudgeAssignments(judgeId, scopedCompetitionId),
        judgeService.getOwnName(judgeId),
      ]);
      res.status(200).json({ judgeId, name, assignments });
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
 * GET /api/competitions/:id/judge-assignments — the ranges already recorded on this
 * competition, judge names included (report §4c: the panel was write-only, so assigning
 * a second judge meant working blind). 200 with `{ assignments }`, ordered by the first
 * number of each range. Overlap is reported, not rejected — see the service.
 */
judgeAssignmentRouter.get(
  "/",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: competitionId } = parseInput(competitionIdParamSchema, req.params);
      const assignments = await judgeService.listCompetitionAssignments(competitionId);
      res.status(200).json({ assignments });
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
