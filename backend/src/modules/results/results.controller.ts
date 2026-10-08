/**
 * The Results module's HTTP surface (Unit 12, spec API contract).
 *
 * Three endpoints, all competition-scoped and all **controller-only** (ROL-002):
 *   - `GET  /results`        the results view, per category and stage
 *   - `POST /corrections`    correct a score, with a mandatory reason
 *   - `GET  /export`         generate and stream the competition's `.xlsx`
 * plus `GET /corrections`, the change log the results screen shows beside them.
 *
 * The purge is **not** here and never will be: the spec's Security Considerations say
 * it is schedule-driven only, with no manual trigger.
 *
 * The export returns binary, so it cannot go through the JSON error path the other
 * endpoints share — its failure is raised before any byte is written, which is why
 * the generation happens first and the response is only committed once the file is on
 * disk.
 */
import { readFile } from "node:fs/promises";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError, ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { XLSX_MIME_TYPE } from "./results-xlsx";
import { resultsService } from "./results.service";
import {
  RESULTS_FORBIDDEN,
  RESULTS_INVALID_SCORE,
  RESULTS_REASON_REQUIRED,
} from "./results.types";

/** Only a controller may read results, correct a score or export (ROL-002). */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(new ForbiddenError(translate("en", RESULTS_FORBIDDEN), { code: RESULTS_FORBIDDEN }));
    return;
  }
  next();
}

const paramsSchema = z.object({ id: z.string().min(1) });

/**
 * The correction's input. Every field the spec lists is required: `targetType` and
 * `targetId` name what is being corrected, `roundId` which round, `newScore` the
 * corrected total, and `reason` why. The reason is validated as a non-empty string
 * here *and* re-checked after trimming in the service — the schema catches a missing
 * field, the service catches a whitespace-only one, and only the service can produce
 * the localizable `results.reasonRequired` code.
 */
const correctionSchema = z.object({
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  roundId: z.string().min(1),
  newScore: z.number(),
  reason: z.string(),
});

const exportQuerySchema = z.object({
  /** A previously generated export to re-download; omitted generates a fresh one. */
  fileId: z.string().min(1).optional(),
});

export const resultsRouter = Router({ mergeParams: true });

resultsRouter.get(
  "/results",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(paramsSchema, req.params);
      // Back-fills the purge schedule for a competition that ended before this unit
      // existed, so the screen always has a date to show rather than a blank.
      await resultsService.ensurePurgeScheduled(id);
      const results = await resultsService.getResults(id);
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  },
);

resultsRouter.get(
  "/corrections",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(paramsSchema, req.params);
      const corrections = await resultsService.listCorrections(id);
      res.status(200).json(corrections);
    } catch (error) {
      next(error);
    }
  },
);

resultsRouter.post(
  "/corrections",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(paramsSchema, req.params);
      const parsed = correctionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        // A missing or empty `reason` gets its own localizable code, because
        // `ValidationError` hard-codes `VALIDATION_ERROR` and so could not be
        // localized by the correction form (the same reason Unit 11's big-screen
        // endpoint special-cases its mode field).
        const body = (req.body ?? {}) as { reason?: unknown; newScore?: unknown };
        const code =
          typeof body.reason !== "string" || body.reason.trim().length === 0
            ? RESULTS_REASON_REQUIRED
            : typeof body.newScore !== "number"
              ? RESULTS_INVALID_SCORE
              : "VALIDATION_ERROR";
        throw new AppError(
          code === "VALIDATION_ERROR" ? parsed.error.message : translate("en", code),
          { statusCode: 400, code },
        );
      }
      const result = await resultsService.createCorrection(
        id,
        parsed.data,
        req.auth?.accountId ?? null,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

resultsRouter.get(
  "/export",
  requireAuth,
  requireController,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseInput(paramsSchema, req.params);
      const { fileId } = parseInput(exportQuerySchema, req.query);

      // A `fileId` re-downloads an export that already exists; without one a fresh
      // workbook is generated. Either way the gate on a cancelled competition has
      // already run inside the service call.
      const generated = fileId
        ? null
        : await resultsService.generateExport(id, req.auth?.accountId ?? null);
      const row = await resultsService.readExportFile(id, generated?.storedFileId ?? fileId ?? null);
      const bytes = await readFile(row.path);

      res
        .status(200)
        .set({
          "content-type": XLSX_MIME_TYPE,
          "content-length": String(bytes.length),
          "content-disposition": `attachment; filename="${row.originalName}"`,
        })
        .send(bytes);
    } catch (error) {
      next(error);
    }
  },
);
