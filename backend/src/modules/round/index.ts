/**
 * The Round module (Unit 07 — round runtime and autosave). Owns: stage and
 * round state transitions, the preparation countdown, the round timer, and
 * the round-ended signal.
 *
 * The barrel exposes the public interface (invariant 4):
 *   - `roundService`: the dev-only start-preparation trigger, the narrow
 *     pause/resume/remaining surface Unit 11 will call, and the event
 *     subscriptions (onRoundEnded, onTick, onPause, onResume, onStart) the
 *     realtime gateway and Unit 08 use.
 *   - `roundRouter`: HTTP routes — only the dev-only internal trigger.
 *   - `roundTimerService`: the timer service itself, exported for tests and
 *     restart recovery. Unit 11 should call `roundService.pause/resume/remaining`,
 *     not the timer service directly, so the durable-state bookkeeping that
 *     accompanies them stays in one place.
 */
export { roundService } from "./round.service";
export type { TeamRoundStartInput } from "./round.service";
export { roundTimerService, RESUME_COUNTDOWN_SECONDS } from "./round-timer.service";
export { roundRouter } from "./round.controller";
export type * from "./round.types";
