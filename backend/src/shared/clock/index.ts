/**
 * The single server clock. The server owns competition, stage and round state, the
 * timer, pause and resume, submission validity, scoring, ranking and eligibility;
 * the client's countdown is display only (architecture.md, Data flow; invariant 3).
 *
 * Every module reads time through this module, never through `new Date()` directly,
 * so there is exactly one source of time in the backend.
 */
export function now(): Date {
  return new Date();
}

export function nowMs(): number {
  return Date.now();
}

/**
 * Whole seconds remaining, never negative. Used by the round timer (the timer stops
 * during a pause — SCR-011); the pause arithmetic itself belongs to the Round module.
 */
export function secondsUntil(deadlineMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
