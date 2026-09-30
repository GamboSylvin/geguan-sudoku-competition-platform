/**
 * The Round module. Owns: Stage and round definitions, round timing and state, preparation state.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
export { roundService } from "./round.service";
export { roundRouter } from "./round.controller";
export type * from "./round.types";
