import express, { type Express } from "express";
import { apiRouter } from "./routes";
import { cors, errorHandler, requestLogger } from "./shared/middleware";

/**
 * The Express application: middleware plus route mounting (BLD-020). It is kept
 * separate from `index.ts` so the app can be built in a test without opening a port
 * (the first Jest test uses it).
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // CORS first: the preflight must be answered before body parsing or routing.
  app.use(cors);
  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);

  app.use("/api", apiRouter);

  // Central error handler last: never swallow an error silently.
  app.use(errorHandler);

  return app;
}
