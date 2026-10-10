/**
 * The Competition module. Owns: Creation, metadata, lifecycle, publish, pause and resume, finish and cancel state.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
export { competitionService } from "./competition.service";
export { competitionCopyService } from "./competition-copy.service";
export { competitionRouter } from "./competition.controller";
export type * from "./competition.types";
