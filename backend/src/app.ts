import express, { type Express } from "express";
import { apiRouter } from "./routes";
import { cors, errorHandler, requestLogger } from "./shared/middleware";
import { gameplayService } from "./modules/gameplay";
import { roundTimerService } from "./modules/round";

/**
 * The Express application: middleware plus route mounting (BLD-020). It is kept
 * separate from `index.ts` so the app can be built in a test without opening a port
 * (the first Jest test uses it).
 */

// Unit 08: subscribe the Gameplay module to the Round module's round-ended signal.
// When the timer expires, the gameplay module auto-submits every still-active
// participation and advances the competition (CS-022, invariant 7). Installed
// once per process — `createApp()` can be called multiple times in tests, and
// `onRoundEnded` would otherwise accumulate duplicate listeners.
let roundEndedListenerInstalled = false;
function installRoundEndedListener(): void {
  if (roundEndedListenerInstalled) return;
  roundTimerService.onRoundEnded((event) => gameplayService.handleRoundEnded(event));
  roundEndedListenerInstalled = true;
}

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

  installRoundEndedListener();

  return app;
}
