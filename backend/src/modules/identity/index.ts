/**
 * The Identity module. Owns: Players, teams, player and judge accounts, participant
 * membership, competition-specific access, and one active device per account.
 *
 * The barrel exposes only the public interface: the routers (login/logout, the Unit 06
 * judge list and the range-assignment router mounted under /api/competitions), the
 * service (login, the session check, logout, credential helpers), the judge service
 * (Unit 06 — including the authority-scoping check every later judge-facing unit
 * calls) and the module's types.
 */
export { identityService } from "./identity.service";
export { identityRouter } from "./identity.controller";
export { judgeService } from "./judge.service";
export { judgeRouter, judgeAssignmentRouter } from "./judge.controller";
export { judgeSupervisionService } from "./judge-supervision.service";
export { judgeSupervisionRouter } from "./judge-supervision.controller";
export type * from "./identity.types";
