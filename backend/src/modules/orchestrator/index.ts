/**
 * The Orchestrator module. Owns: the sequence — start stage, preparation, start and
 * end round, next round, next stage, finish — and the reset/rematch/replay mechanic
 * (ROL-005).
 *
 * Unit 10 exposed `orchestratorService.restartOneParticipant`, the single-student
 * case of the archive-and-restart operation. Unit 11 adds the controller's command
 * surface on top of it: `stageCommandService` (start stage, pause/resume, end round
 * early, finish early), `resetRematchService` (the same archive operation, looped
 * over a scope, but with the round's **full** duration granted again), and
 * `cancelService` (ROL-009's terminal state). All seven HTTP endpoints live on
 * `orchestratorRouter`, mounted under `/api/competitions/:id` in `routes.ts`.
 *
 * The judge-facing single-student restart endpoint stays in the identity module under
 * `/api/judge`, where the range-scoping check is (spec Detail 6: the controller
 * reaches it through that same guard, not a separate path).
 */
export { orchestratorService } from "./orchestrator.service";
export { stageCommandService } from "./stage-command.service";
export { resetRematchService } from "./reset-rematch.service";
export { cancelService } from "./cancel.service";
export { recordCommand } from "./audit.service";
export { orchestratorRouter } from "./orchestrator.controller";
// A value, not a type: callers write `ORCHESTRATOR_AUDIT_ACTIONS.pause` etc.
export { ORCHESTRATOR_AUDIT_ACTIONS } from "./orchestrator.types";
export type * from "./orchestrator.types";
