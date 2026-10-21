/**
 * The Participant module. Owns: the participant Excel import, the `School`/`Participant`/
 * `PLAYER` `Account` rows it creates, the roster read, the individual add/edit/deactivate
 * of PAR-003, and the credential slips of PAR-002.
 *
 * Built in Unit 04 (`specs/04-participant-import-teams-and-credentials.md`). The files
 * follow the decided module layout (BLD-020): controller (HTTP), service (domain rules
 * and the public interface), repository (Prisma access), types, and this barrel — the
 * only way another module reaches this one (invariant 4).
 *
 * The parsing and file-reading internals (`participant-parse`, `participant-xlsx`,
 * `participant-multipart`) are deliberately **not** re-exported: they are implementation,
 * and no other module has any business reading a workbook.
 *
 * **No team is created by this module.** `团队赛` is stored for whoever forms teams later
 * (spec §8 Q10; the random-formation proposal contradicts SCR-004 [C] and is logged as
 * U-102), and `Participant.teamId` stays null.
 */
export { participantService } from "./participant.service";
export { participantRouter } from "./participant.controller";
export type * from "./participant.types";
