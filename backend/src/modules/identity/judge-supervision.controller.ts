/**
 * HTTP layer for the judge's supervision view (Unit 10). Validates input, then
 * calls the service; no domain rule lives here.
 *
 * Two endpoints, both behind `requireAuth` + a JUDGE role check, and both
 * passing every target through Unit 06's authority-scoping check:
 *
 *   - `GET  /api/judge/students` — list every participant inside the calling
 *     judge's own assigned range(s), with each participant's connection status,
 *     round-participation state, left-page count, attempt (restart) count, and
 *     the round's remaining time. A judge with several assignments sees all of
 *     them; a judge with none sees an empty list.
 *
 *   - `POST /api/judge/students/:participantId/restart` — restart one student's
 *     current round. 404 when the participant does not exist; 403 when the
 *     participant is outside the judge's range or competition; 409 when the
 *     round is not currently running.
 *
 * The `connected` flag is derived from `Account.activeDeviceId` being set and
 * the device row's `isActive` — a logged-in, not-taken-over player counts as
 * connected (PAR-005). It is a coarse signal by design: the spec calls it
 * "connected" without further qualification, and Unit 02's one-active-device
 * rule is the mechanism that keeps it meaningful.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { judgeSupervisionService } from "./judge-supervision.service";

export const judgeSupervisionRouter = Router();

/** Only a JUDGE session may use these endpoints (U-55; spec Security). */
function requireJudge(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "JUDGE" || !req.auth.judgeId) {
    next(
      new ForbiddenError(translate("en", "judgeSupervision.forbidden"), {
        code: "judgeSupervision.forbidden",
      }),
    );
    return;
  }
  next();
}

const restartParamsSchema = z.object({
  participantId: z.string().min(1),
});

/**
 * GET /api/judge/students — list the calling judge's assigned students with
 * their current status. The response shape is `{ students: [...] }`, one row
 * per participant, in (competition, participantNumber) order.
 */
judgeSupervisionRouter.get(
  "/students",
  requireAuth,
  requireJudge,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const judgeId = req.auth!.judgeId!;
      const students = await judgeSupervisionService.listStudentsForJudge(judgeId);
      res.status(200).json({ students });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/judge/students/:participantId/restart — restart the named
 * participant's current round. Body is empty: the session identifies the judge,
 * the path the participant; the round is whatever round the participant is
 * currently on.
 *
 * 200 with `{ participationId, attemptCount, remainingSeconds, totalSeconds }`.
 * 403 `judgeSupervision.outOfRange` when the participant is not in the judge's
 * assigned range. 409 `orchestrator.roundNotRunning` when the round's status is
 * not ACTIVE or PAUSED. 404 when the participant id does not resolve.
 */
judgeSupervisionRouter.post(
  "/students/:participantId/restart",
  requireAuth,
  requireJudge,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { participantId } = parseInput(restartParamsSchema, req.params);
      const judgeId = req.auth!.judgeId!;
      const result = await judgeSupervisionService.restartStudent(judgeId, participantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
