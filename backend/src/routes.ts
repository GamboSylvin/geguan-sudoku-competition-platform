import { Router } from "express";
import { healthRouter } from "./health";
import { competitionRouter } from "./modules/competition";
import { identityRouter, judgeRouter, judgeAssignmentRouter, judgeSupervisionRouter } from "./modules/identity";
import { questionRouter } from "./modules/question";
import { roundRouter } from "./modules/round";
import { gameplayRouter } from "./modules/gameplay";
import { orchestratorRouter } from "./modules/orchestrator";
import { scoringRouter } from "./modules/scoring";
import { rankingRouter } from "./modules/ranking";
import { bigScreenRouter } from "./modules/big-screen";
import { resultsRouter } from "./modules/results";

/**
 * Mounts each module's routes under `/api` (BLD-020). Only the health check and the
 * identity module's authentication endpoints (Unit 02) are served so far. The API
 * style and versioning are still OPEN (code-standards, API conventions) and are
 * written with the first unit that has an endpoint.
 */
export const apiRouter = Router();

apiRouter.use("/", healthRouter);

// Authentication endpoints are unauthenticated by design: you cannot hold a session
// before you log in. Every later module's routes sit behind `requireAuth`.
apiRouter.use("/auth", identityRouter);

apiRouter.use("/competitions", competitionRouter);
// Judge range assignment lives on the competition path (Unit 06 API contract).
apiRouter.use("/competitions/:id/judge-assignments", judgeAssignmentRouter);
apiRouter.use("/judges", judgeRouter);
// Unit 10: the judge's own supervision endpoints live under the singular /judge
// (the management endpoints under /judges are controller-only).
apiRouter.use("/judge", judgeSupervisionRouter);
// Unit 05: question import, the pool listing and the round-selection step all live on
// the competition+category path of the spec's API contract, so the router is mounted
// with `mergeParams` reading `:id`/`:categoryId` (the same pattern Unit 09 uses).
apiRouter.use("/competitions/:id/categories", questionRouter);
apiRouter.use("/rounds", roundRouter);
apiRouter.use("/gameplay", gameplayRouter);
// Unit 11: every controller live command is competition-scoped, so the orchestrator's
// router is mounted on the competition path with `mergeParams` reading `:id` (the same
// pattern Units 05 and 09 use). Nothing is served at the bare /orchestrator path.
apiRouter.use("/competitions/:id", orchestratorRouter);
apiRouter.use("/scoring", scoringRouter);
// Unit 09: the ranking read lives on the competition path (mergeParams reads `:id`).
apiRouter.use("/competitions/:id/categories", rankingRouter);
apiRouter.use("/ranking", rankingRouter);
apiRouter.use("/big-screen", bigScreenRouter);
// Unit 12: the results view, the score correction and the export are all
// competition-scoped and controller-only, so the results router is mounted on the
// competition path with `mergeParams` reading `:id` (the same pattern Units 05, 09 and
// 11 use). The purge has no route — it is schedule-driven only.
apiRouter.use("/competitions/:id", resultsRouter);
