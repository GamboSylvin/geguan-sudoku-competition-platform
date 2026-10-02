/**
 * The Identity module. Owns: Players, teams, player and judge accounts, participant
 * membership, competition-specific access, and one active device per account.
 *
 * The barrel exposes only the public interface (Unit 02): the router, the service
 * (login, the session check later units call, logout, credential helpers) and the
 * module's types.
 */
export { identityService } from "./identity.service";
export { identityRouter } from "./identity.controller";
export type * from "./identity.types";
