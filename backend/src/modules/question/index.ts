/**
 * The Question module. Owns: Question import and validation, question packs, assignment of questions to rounds.
 *
 * Built in Unit 05 (`specs/05-question-import-and-question-sets.md`). The files
 * follow the decided module layout (BLD-020): controller (HTTP), service (domain
 * rules and the public interface), repository (Prisma access), types, and this
 * barrel — the only way another module reaches this one (invariant 4).
 *
 * The parsing and file-reading internals (`question-parse`, `question-xlsx`,
 * `question-multipart`) are deliberately **not** re-exported: they are
 * implementation, and no other module has any business reading a workbook.
 */
export { questionService } from "./question.service";
export { questionRouter } from "./question.controller";
export type * from "./question.types";
