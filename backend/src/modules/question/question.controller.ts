/**
 * HTTP layer for the Question module (Unit 05). It validates input, then calls the
 * service; no domain rule lives here.
 *
 * The three endpoints of the spec's API contract, all mounted under
 * `/api/competitions/:id/categories` (see `routes.ts`, the same mergeParams pattern
 * Unit 09 uses) so `:id` and `:categoryId` come from the path:
 * - `POST   /:categoryId/questions/import` — multipart upload of one `.xlsx`
 * - `GET    /:categoryId/questions/pool` — the pool, grouped by `QuestionSet`
 * - `POST   /:categoryId/rounds/:roundId/select-questions` — assign that round's own questions
 *
 * Every one is controller-only (ROL-002, spec Security Considerations).
 *
 * The upload deliberately does **not** use a multipart middleware package: `app.ts`
 * parses JSON bodies globally, and this route asks Express for the raw bytes of a
 * `multipart/form-data` body instead, which `question-multipart.ts` then splits. No
 * new dependency (code-standards.md, Dependencies).
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import express from "express";
import { z } from "zod";
import { AppError, ForbiddenError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { requireAuth } from "../../shared/middleware";
import { parseInput } from "../../shared/validation";
import { questionService } from "./question.service";
import type { UploadedQuestionFile } from "./question.service";

/** Only a controller may import questions, read the pool or pick a round's 6. */
function requireController(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "CONTROLLER") {
    next(
      new ForbiddenError(translate("en", "question.forbidden"), {
        code: "question.forbidden",
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

const selectionParamsSchema = paramsSchema.extend({ roundId: z.string().min(1) });

/**
 * A non-empty array of question ids. The controller only validates the *shape* of the
 * body here; the exact count is per-round — 6 for an Individual round, `teamQuestionCount`
 * for the Team rotation relay, `partitionPuzzleCount` for the Team partition round
 * (BLD-040, revised 2026-10-19) — so the service owns that check and reports the count
 * it wanted in `details.expected`.
 */
const selectionSchema = z.object({
  questionIds: z.array(z.string().min(1)).nonempty(),
});

/** The raw multipart body Express hands over, plus its boundary. */
function readUpload(req: Request): UploadedQuestionFile | null {
  const contentType = req.get("content-type") ?? "";
  const boundary = /boundary=(?:"([^"]*)"|([^;]*))/i.exec(contentType);
  const value = (boundary?.[1] ?? boundary?.[2])?.trim();
  if (!value || !Buffer.isBuffer(req.body)) return null;
  return { body: req.body as Buffer, boundary: value };
}

export const questionRouter = Router({ mergeParams: true });

const rawUpload = express.raw({ type: "multipart/form-data", limit: "20mb" });

questionRouter.post(
  "/:categoryId/questions/import",
  requireAuth,
  requireController,
  rawUpload,
  async (req, res, next) => {
    try {
      const { id, categoryId } = parseInput(paramsSchema, req.params);
      const upload = readUpload(req);
      if (!upload) {
        // Not a 422 from the parser: the request itself carries no file part.
        // `AppError` rather than `ValidationError`, whose code is hard-coded to
        // `VALIDATION_ERROR` and so could not be localized by the client.
        throw new AppError(translate("en", "question.import.noFile"), {
          statusCode: 400,
          code: "question.import.noFile",
        });
      }
      const result = await questionService.importQuestionFile({
        competitionId: id,
        categoryId,
        upload,
        uploadedByAccountId: req.auth?.accountId ?? null,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

questionRouter.get(
  "/:categoryId/questions/pool",
  requireAuth,
  requireController,
  async (req, res, next) => {
    try {
      const { id, categoryId } = parseInput(paramsSchema, req.params);
      res.status(200).json(await questionService.listPool(id, categoryId));
    } catch (error) {
      next(error);
    }
  },
);

questionRouter.post(
  "/:categoryId/rounds/:roundId/select-questions",
  requireAuth,
  requireController,
  async (req, res, next) => {
    try {
      const { id, categoryId, roundId } = parseInput(selectionParamsSchema, req.params);
      const { questionIds } = parseInput(selectionSchema, req.body);
      res
        .status(200)
        .json(
          await questionService.selectRoundQuestions({
            competitionId: id,
            categoryId,
            roundId,
            questionIds,
          }),
        );
    } catch (error) {
      next(error);
    }
  },
);
