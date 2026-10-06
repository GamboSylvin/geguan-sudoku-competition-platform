import express, { type Express } from "express";
import { apiRouter } from "./routes";
import { cors, errorHandler, requestLogger } from "./shared/middleware";
import { gameplayService, installIndividualResultFinalizedHook } from "./modules/gameplay";
import { roundTimerService } from "./modules/round";
import { rankingService } from "./modules/ranking";
import { bigScreenService } from "./modules/big-screen";

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
//
// Unit 09: subscribe the Ranking module to the Gameplay module's "individual
// result finalized" signal (recompute the category), and the BigScreen module to
// the Ranking module's "ranking updated" signal (push the fresh leaderboard to the
// big screen out of cycle, within the 2-second target, U-58). Same once-guard.
let listenersInstalled = false;
function installListeners(): void {
  if (listenersInstalled) return;
  roundTimerService.onRoundEnded((event) => gameplayService.handleRoundEnded(event));
  installIndividualResultFinalizedHook((event) =>
    rankingService.handleIndividualResultFinalized(event),
  );
  rankingService.installRankingUpdateHook((payload) =>
    bigScreenService.pushCurrentForUpdate(payload.competitionId, payload.categoryId),
  );
  listenersInstalled = true;
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

  installListeners();

  return app;
}
