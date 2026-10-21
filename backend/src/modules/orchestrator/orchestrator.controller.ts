/**
 * The Orchestrator module. Owns: The sequence: start stage, preparation, start and end round, next round, next stage, finish.
 *
 * HTTP layer (Unit 11). It validates input, then calls the service; no domain rule
 * lives here. Mounted under `/api/competitions/:id` in `routes.ts` (the same
 * `mergeParams` pattern Units 05 and 09 use) so `:id` comes from the path.
 *
 * Every route is controller-only (ROL-002, spec Security Considerations) and writes
 * one `AuditLog` row per command. The audit write is best-effort and happens *after*
 * the command succeeds, so a failed log never rolls back a state change that already
 * happened.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError, ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { bigScreenService } from "../big-screen";
import { recordCommand } from "./audit.service";
import { cancelService } from "./cancel.service";
import {
  BIG_SCREEN_MODES,
  ORCHESTRATOR_FORBIDDEN,
  ORCHESTRATOR_AUDIT_ACTIONS,
  RESET_REMATCH_SCOPES,
} from "./orchestrator.types";
import { resetRematchService } from "./reset-rematch.service";
import { stageCommandService } from "./stage-command.service";

/** Only a controller may run any command in this unit. */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", ORCHESTRATOR_FORBIDDEN), {
        code: ORCHESTRATOR_FORBIDDEN,
      }),
    );
    return;
  }
  next();
}

const paramsSchema = z.object({ id: z.string().min(1) });
const stageParamsSchema = paramsSchema.extend({ stageId: z.string().min(1) });
const roundParamsSchema = paramsSchema.extend({ roundId: z.string().min(1) });

/**
 * The reset/rematch body. The spec's contract names `targetId(s)`, so all three id
 * fields are accepted and the scope decides which one is read; the service rejects a
 * scope whose id is missing with its own localizable code rather than a 400 here, so
 * the message stays about the scope rather than the shape.
 */
const resetRematchSchema = z.object({
  scope: z.enum(RESET_REMATCH_SCOPES),
  roundId: z.string().min(1).nullish(),
  participantId: z.string().min(1).nullish(),
  teamId: z.string().min(1).nullish(),
});

/**
 * The big-screen mode body. Only the three modes this unit can set are accepted;
 * `PLAYER_CLOSEUP`/`TEAM_SPLIT` are in the enum but out of this unit's scope
 * (spec Constraints: no team-stage gameplay), so they are a 400 with a localizable
 * code instead of a state the screens cannot render.
 */
const bigScreenModeSchema = z.object({
  mode: z.enum(BIG_SCREEN_MODES),
  targetId: z.string().min(1).nullish(),
  rotationEnabled: z.boolean().nullish(),
});

export const orchestratorRouter = Router({ mergeParams: true });

// 1. Start a stage (spec Detail 1).
orchestratorRouter.post(
  "/stages/:stageId/start",
  requireAuth,
  requireController,
  async (req, res, next) => {
    try {
      const { id, stageId } = parseInput(stageParamsSchema, req.params);
      const result = await stageCommandService.startStage(id, stageId);
      await recordCommand({
        competitionId: id,
        actorAccountId: req.auth?.accountId ?? null,
        action: ORCHESTRATOR_AUDIT_ACTIONS.startStage,
        targetType: "Stage",
        targetId: stageId,
        payload: { result },
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// 2. Global pause / resume (spec Detail 2).
orchestratorRouter.post("/pause", requireAuth, requireController, async (req, res, next) => {
  try {
    const { id } = parseInput(paramsSchema, req.params);
    const result = await stageCommandService.pauseCompetition(id);
    await recordCommand({
      competitionId: id,
      actorAccountId: req.auth?.accountId ?? null,
      action: ORCHESTRATOR_AUDIT_ACTIONS.pause,
      targetType: "Competition",
      targetId: id,
      payload: { result },
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

orchestratorRouter.post("/resume", requireAuth, requireController, async (req, res, next) => {
  try {
    const { id } = parseInput(paramsSchema, req.params);
    const result = await stageCommandService.resumeCompetition(id);
    await recordCommand({
      competitionId: id,
      actorAccountId: req.auth?.accountId ?? null,
      action: ORCHESTRATOR_AUDIT_ACTIONS.resume,
      targetType: "Competition",
      targetId: id,
      payload: { result },
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// 3. End a round early (spec Detail 3, SUB-004).
orchestratorRouter.post(
  "/rounds/:roundId/end-early",
  requireAuth,
  requireController,
  async (req, res, next) => {
    try {
      const { id, roundId } = parseInput(roundParamsSchema, req.params);
      const result = await stageCommandService.endRoundEarly(id, roundId);
      await recordCommand({
        competitionId: id,
        actorAccountId: req.auth?.accountId ?? null,
        action: ORCHESTRATOR_AUDIT_ACTIONS.endRoundEarly,
        targetType: "Round",
        targetId: roundId,
        payload: { result },
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// 4. Finish the whole competition early (spec Detail 4, RND-007).
orchestratorRouter.post("/finish-early", requireAuth, requireController, async (req, res, next) => {
  try {
    const { id } = parseInput(paramsSchema, req.params);
    const result = await stageCommandService.finishEarly(id);
    await recordCommand({
      competitionId: id,
      actorAccountId: req.auth?.accountId ?? null,
      action: ORCHESTRATOR_AUDIT_ACTIONS.finishEarly,
      targetType: "Competition",
      targetId: id,
      payload: { result },
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// 5. Reset / rematch at the four scopes (spec Detail 5, ROL-005).
orchestratorRouter.post("/reset-rematch", requireAuth, requireController, async (req, res, next) => {
  try {
    const { id } = parseInput(paramsSchema, req.params);
    const body = parseInput(resetRematchSchema, req.body ?? {});
    const result = await resetRematchService.resetRematch({
      competitionId: id,
      scope: body.scope,
      roundId: body.roundId ?? null,
      participantId: body.participantId ?? null,
      teamId: body.teamId ?? null,
    });
    await recordCommand({
      competitionId: id,
      actorAccountId: req.auth?.accountId ?? null,
      action: ORCHESTRATOR_AUDIT_ACTIONS.resetRematch,
      targetType: "Competition",
      targetId: id,
      payload: { ...body, result },
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// 7. Cancel (spec Detail 7, ROL-009).
orchestratorRouter.post("/cancel", requireAuth, requireController, async (req, res, next) => {
  try {
    const { id } = parseInput(paramsSchema, req.params);
    const result = await cancelService.cancelCompetition(id);
    await recordCommand({
      competitionId: id,
      actorAccountId: req.auth?.accountId ?? null,
      action: ORCHESTRATOR_AUDIT_ACTIONS.cancel,
      targetType: "Competition",
      targetId: id,
      payload: { result: { ...result, cancelledAt: result.cancelledAt.toISOString() } },
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// 9. Big-screen display control (spec Detail 9, BSC-002).
orchestratorRouter.post(
  "/big-screen/mode",
  requireAuth,
  requireController,
  async (req, res, next) => {
    try {
      const { id } = parseInput(paramsSchema, req.params);
      const parsed = bigScreenModeSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        // A mode outside this unit's set is rejected with its own code, because
        // `ValidationError`'s code is hard-coded to `VALIDATION_ERROR` and so could
        // not be localized by the controller's dashboard.
        const mode = (req.body ?? {}).mode;
        const code =
          typeof mode === "string" && !BIG_SCREEN_MODES.includes(mode as never)
            ? "bigScreen.invalidMode"
            : "VALIDATION_ERROR";
        throw new AppError(
          code === "VALIDATION_ERROR" ? parsed.error.message : translate("en", code),
          { statusCode: 400, code },
        );
      }
      const body = parsed.data;
      const result = await bigScreenService.setMode({
        competitionId: id,
        mode: body.mode,
        targetId: body.targetId ?? null,
        rotationEnabled: body.rotationEnabled ?? null,
      });
      await recordCommand({
        competitionId: id,
        actorAccountId: req.auth?.accountId ?? null,
        action: ORCHESTRATOR_AUDIT_ACTIONS.setBigScreenMode,
        targetType: "Competition",
        targetId: id,
        payload: { ...body, result },
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/** The dashboard's read-back of what the screens are showing (no audit row: a read). */
orchestratorRouter.get(
  "/big-screen/mode",
  requireAuth,
  requireController,
  async (req, res, next) => {
    try {
      const { id } = parseInput(paramsSchema, req.params);
      res.status(200).json(await bigScreenService.getMode(id));
    } catch (error) {
      next(error);
    }
  },
);
