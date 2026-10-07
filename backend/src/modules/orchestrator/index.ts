/**
 * The Orchestrator module. Owns: the sequence — start stage, preparation, start
 * and end round, next round, next stage, finish — and the reset/rematch/replay
 * mechanic (ROL-005).
 *
 * Unit 10 exposes `orchestratorService.restartOneParticipant`, the
 * single-student case of the archive-and-restart operation. Unit 11 will call
 * the same function in a loop for the controller's wider-scope reset/rematch
 * commands. No HTTP routes are mounted from this module yet — the judge-facing
 * endpoints for restart live in the identity module under `/api/judge`, where
 * the scoping check is.
 */
export { orchestratorService } from "./orchestrator.service";
export { orchestratorRouter } from "./orchestrator.controller";
export type * from "./orchestrator.types";
