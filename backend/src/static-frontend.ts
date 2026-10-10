import { existsSync } from "node:fs";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";

/**
 * Serving the frontend's built bundle from the backend (BLD-048's production
 * deployment).
 *
 * WHY SAME-ORIGIN: `VITE_API_BASE_URL` is baked into the bundle at BUILD time, so a
 * separately-served frontend would have to know the server's final public IP before
 * it was built — fragile, and wrong the moment the IP changes. Serving the bundle from
 * the same Express app makes every API call and every Socket.io connection relative to
 * the page's own origin, so the image works on any host with no rebuild, the browser
 * needs no CORS for its own page, and only ONE port has to be opened in the server's
 * security group instead of two.
 *
 * This is not a domain module (BLD-020): like `health.ts`, it exists for the
 * deployment, so it lives next to the entry point.
 *
 * It is inert unless `FRONTEND_DIST` points at a real folder — which is only true in
 * the production image. In development that variable is unset, `createApp()` never
 * calls this, and the Vite dev server serves the frontend exactly as before.
 */

/** The folder the production image copies the Vite build into. */
let frontendDist = "";

/**
 * Register static serving on `app`. Call AFTER every `/api` route is mounted so no
 * existing route's behaviour changes, and BEFORE the central error handler.
 *
 * Two parts:
 *   1. the built assets at their real paths (`/assets/index-abc123.js`, `/favicon.ico`, …);
 *   2. a catch-all that returns `index.html` for any other GET, because the frontend
 *      uses `BrowserRouter` — so `/player`, `/login` and
 *      `/controller/competitions/:id/school-ranking` are real URLs a browser may load
 *      directly or refresh, and they are not files.
 *
 * Unknown `/api/...` paths are deliberately NOT caught here, so they fall through to
 * Express's built-in 404 instead of silently serving the SPA's `index.html`. Note what
 * that built-in 404 actually is: `text/html`, because this backend has no API-level
 * not-found handler (verified — the dev stack, where this file is never registered,
 * returns the identical HTML 404). That is pre-existing behaviour, not something this
 * file introduces, and closing it would mean adding a handler to `app.ts`, which is a
 * route-behaviour change this deployment task must not make. Flagged, not fixed.
 */
export function serveFrontend(app: Express, dist: string): void {
  frontendDist = dist;

  app.use(
    express.static(frontendDist, {
      // Hashed asset filenames, so they can be cached hard; index.html must not be.
      index: "index.html",
      maxAge: "1h",
      setHeaders(res: Response, filePath: string): void {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  app.get(
    "*",
    (req: Request, res: Response, next: NextFunction): void => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      // The index is read per request rather than captured once, so a rebuild-and-
      // restart that replaces the bundle is picked up without a code change.
      res.sendFile("index.html", { root: frontendDist });
    },
  );
}

/** True when `dist` exists and holds an `index.html` — i.e. a built frontend. */
export function hasBuiltFrontend(dist: string): boolean {
  return dist.length > 0 && existsSync(`${dist}/index.html`);
}
