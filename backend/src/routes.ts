import { Router } from "express";
import { healthRouter } from "./health";
import { competitionRouter } from "./modules/competition";
import { identityRouter } from "./modules/identity";
import { questionRouter } from "./modules/question";
import { roundRouter } from "./modules/round";
import { gameplayRouter } from "./modules/gameplay";
import { orchestratorRouter } from "./modules/orchestrator";
import { scoringRouter } from "./modules/scoring";
import { rankingRouter } from "./modules/ranking";
import { bigScreenRouter } from "./modules/big-screen";

/**
 * Mounts each module's routes under `/api` (BLD-020). The modules are empty in
 * Unit 01, so no route is served yet except the health check. The API style and
 * versioning are still OPEN (code-standards, API conventions) and are written with
 * the first unit that has an endpoint.
 */
export const apiRouter = Router();

apiRouter.use("/", healthRouter);

apiRouter.use("/competitions", competitionRouter);
apiRouter.use("/identity", identityRouter);
apiRouter.use("/questions", questionRouter);
apiRouter.use("/rounds", roundRouter);
apiRouter.use("/gameplay", gameplayRouter);
apiRouter.use("/orchestrator", orchestratorRouter);
apiRouter.use("/scoring", scoringRouter);
apiRouter.use("/ranking", rankingRouter);
apiRouter.use("/big-screen", bigScreenRouter);
