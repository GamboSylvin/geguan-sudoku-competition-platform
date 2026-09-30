/**
 * The Scoring module. Owns: Puzzle evaluation, score and bonus calculation, the finalized round score.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
export { scoringService } from "./scoring.service";
export { scoringRouter } from "./scoring.controller";
export type * from "./scoring.types";
