/**
 * CORS for the HTTP API (Unit 02). The frontend (Vite dev server, `FRONTEND_ORIGIN`)
 * calls the backend on a different origin, so the browser needs the CORS headers on
 * both the preflight and the actual response. The allowed origin is the single decided
 * `FRONTEND_ORIGIN` — not `*` — because the API carries session state
 * (code-standards, "the client is never trusted"). The realtime gateway applies the
 * same policy to the WebSocket handshake (`realtime/gateway.ts`).
 *
 * Written with the platform (no `cors` package) to avoid a new dependency
 * (code-standards, "Dependencies").
 */
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";

/** Headers the browser is allowed to send: JSON body plus the session/device headers. */
const ALLOWED_HEADERS = "content-type, x-session-token, x-device-id";
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
/** Cache the preflight result for a day so the browser does not re-ask each call. */
const MAX_AGE_SECONDS = "86400";

export function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("origin");

  // Echo only the decided frontend origin; a request from anywhere else gets no
  // allow header, so the browser blocks it.
  if (origin && origin === env.FRONTEND_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.setHeader("Access-Control-Max-Age", MAX_AGE_SECONDS);
    res.status(204).end();
    return;
  }

  next();
}
