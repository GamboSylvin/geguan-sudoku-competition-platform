/**
 * Competition copy (Unit 15, CMP-100 / CA-004, resolves U-10).
 *
 * A copy keeps **settings, questions and judges** and never carries over
 * participants or results. The new competition is a fresh `CREATED` row that must
 * go through Unit 03's normal publish flow again — including a fresh participant
 * import (Unit 04) — before it can run.
 *
 * Two spec details are enforced here rather than assumed:
 *
 * - The stage/round/settings structure is carried over with the **source's own
 *   customized values** (durations, bonus rate, team counts…), not schema defaults.
 * - Copying is allowed from a source in **any** status — `FINISHED`, `CANCELLED` or
 *   still running — because nothing about the source's own state affects what is
 *   being copied (spec 15, Context: an assumed, flagged detail).
 *
 * The judge ranges are copied as a starting point only. Participants are not
 * copied, so the new import will generate fresh participant numbers that may not
 * land on the same counts; the controller reviews and adjusts the ranges with
 * Unit 06's existing range editing (spec 15, Constraints).
 */
import { NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import type { CompetitionWithStructure } from "./competition.repository";
import { readCompetitionWithStructure, readCopySource, writeCopy } from "./competition-copy.repository";

/**
 * The copy's name. Nothing in the documents fixes it, so it derives from the
 * source's own name — the controller can rename it on the setup screen it lands
 * on, exactly as with a hand-created competition.
 */
function copyName(sourceName: string): string {
  const base = `${sourceName} (copy)`;
  // `Competition.name` has no length cap in the schema, but Unit 03's create
  // endpoint caps it at 120; stay within that so the copy is editable through the
  // same form.
  return base.length > 120 ? base.slice(0, 120) : base;
}

function notFoundError(): NotFoundError {
  return new NotFoundError(translate("en", "competition.notFound"), {
    code: "competition.notFound",
  });
}

/**
 * Deep-copy a competition and return the new one in the same shape
 * create/update/publish return, so the setup screen can render it directly.
 */
export async function copyCompetition(
  sourceCompetitionId: string,
): Promise<CompetitionWithStructure> {
  const source = await readCopySource(sourceCompetitionId);
  if (!source) {
    throw notFoundError();
  }

  const newId = await writeCopy({ source, name: copyName(source.competition.name) });

  const created = await readCompetitionWithStructure(newId);
  if (!created) {
    // Unreachable in practice — the transaction that just wrote it succeeded —
    // but the read is a separate statement, so the null case is handled honestly
    // rather than asserted away.
    throw notFoundError();
  }
  return created;
}

export const competitionCopyService = {
  copyCompetition,
};
