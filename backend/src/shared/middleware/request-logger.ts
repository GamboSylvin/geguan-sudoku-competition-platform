import type { NextFunction, Request, Response } from "express";
import { logger } from "../../infra/logger";

/**
 * Request logger. Deliberately tiny in Unit 01; it exists so the boundary between
 * the HTTP layer and the modules has one place to observe traffic. It never
 * inspects domain state.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
}
