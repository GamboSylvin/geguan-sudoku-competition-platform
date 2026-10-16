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
// BLD-052: the school CRUD surface is competition-scoped setup data, so it lives in
// this module rather than a new one (see `school.repository.ts`'s header for why).
export { schoolService } from "./school.service";
export { schoolRouter } from "./school.controller";
export type * from "./competition.types";
export type * from "./school.types";
