import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { logger } from "../../infra/logger";

/**
 * Central error handler: never swallow an error silently, always log it with
 * enough context to diagnose (code-standards, Error handling). The response shape
 * is still OPEN, so it stays minimal.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(err.message, { code: err.code, statusCode: err.statusCode });
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error(message, { stack: err instanceof Error ? err.stack : undefined });
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
