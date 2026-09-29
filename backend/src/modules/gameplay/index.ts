/**
 * The Gameplay module. Owns: The current grid, autosave, reconnection, submission state, player runtime state.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
export { gameplayService } from "./gameplay.service";
export { gameplayRouter } from "./gameplay.controller";
export type * from "./gameplay.types";
