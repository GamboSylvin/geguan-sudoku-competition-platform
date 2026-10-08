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
import { AppError, ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { ORCHESTRATOR_AUDIT_ACTIONS, recordCommand } from "../orchestrator";
import { judgeSupervisionService } from "./judge-supervision.service";

export const judgeSupervisionRouter = Router();

/**
 * A JUDGE or a CONTROLLER session may use these endpoints (U-55; Unit 11 spec
 * Detail 6). The controller reaches the same code path, not a separate one: its
 * only difference is that Unit 06's range check is skipped, because its role
 * already authorizes the whole competition.
 */
function requireJudge(req: Request, _res: Response, next: NextFunction): void {
  const isJudge = req.auth?.role === "JUDGE" && Boolean(req.auth.judgeId);
  const isController = req.auth?.role === "CONTROLLER";
  if (!isJudge && !isController) {
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

/** A controller must say which competition to list; a judge's range supplies it. */
const studentsQuerySchema = z.object({
  competitionId: z.string().min(1).optional(),
});

/**
 * GET /api/judge/students — list the calling judge's assigned students with
 * their current status. The response shape is `{ students: [...] }`, one row
 * per participant, in (competition, participantNumber) order.
 *
 * A controller session sees every participant of `?competitionId=` instead, with
 * the identical row shape.
 */
judgeSupervisionRouter.get(
  "/students",
  requireAuth,
  requireJudge,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.auth!.role === "CONTROLLER") {
        const { competitionId } = parseInput(studentsQuerySchema, req.query);
        if (!competitionId) {
          // A controller with no competition named has nothing to scope the list
          // to; `AppError` rather than `ValidationError`, whose code is
          // hard-coded to `VALIDATION_ERROR` and so could not be localized.
          throw new AppError(translate("en", "competition.notFound"), {
            statusCode: 400,
            code: "competition.notFound",
          });
        }
        res.status(200).json({
          students: await judgeSupervisionService.listStudentsForCompetition(competitionId),
        });
        return;
      }
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
 *
 * A controller session reaches the same restart with no range check, and the call
 * is recorded under its own `AuditLog` action (spec Security Considerations: the
 * controller's judge-equivalent access is still logged per-action).
 */
judgeSupervisionRouter.post(
  "/students/:participantId/restart",
  requireAuth,
  requireJudge,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { participantId } = parseInput(restartParamsSchema, req.params);
      if (req.auth!.role === "CONTROLLER") {
        const result = await judgeSupervisionService.restartStudentAsController(participantId);
        await recordCommand({
          competitionId: result.competitionId,
          actorAccountId: req.auth!.accountId ?? null,
          action: ORCHESTRATOR_AUDIT_ACTIONS.restartParticipant,
          targetType: "Participant",
          targetId: participantId,
          payload: { result },
        });
        res.status(200).json(result);
        return;
      }
      const judgeId = req.auth!.judgeId!;
      const result = await judgeSupervisionService.restartStudent(judgeId, participantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
