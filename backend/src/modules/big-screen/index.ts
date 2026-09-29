/**
 * The BigScreen module. Owns: Big-screen state, ranking projection, player and team projection, display mode.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
export { bigScreenService } from "./big-screen.service";
export { bigScreenRouter } from "./big-screen.controller";
export type * from "./big-screen.types";
