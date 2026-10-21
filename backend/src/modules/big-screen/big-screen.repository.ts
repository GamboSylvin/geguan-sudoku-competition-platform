/**
 * Prisma access for the BigScreen module (Unit 09). No domain rule lives here; the
 * service holds the rules (invariant 4). Thin wrappers over Prisma.
 */
import type { BigScreenMode } from "@prisma/client";
import { prisma } from "../../infra";

/**
 * Resolve a big-screen link token to its competition id. The token is the only
 * gate on the no-login big-screen channel (BSC-001); an unknown token resolves to
 * null and the caller rejects the connection.
 */
export function findCompetitionIdByBigScreenToken(
  bigScreenLinkToken: string,
): Promise<{ id: string } | null> {
  return prisma.competition.findUnique({
    where: { bigScreenLinkToken },
    select: { id: true },
  });
}

/**
 * A competition's categories in display order, with the scoring configuration the
 * rotation timer reads (`rankingCycleSeconds`).
 */
export function findCompetitionForRotation(competitionId: string) {
  return prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      scoringConfiguration: { select: { rankingCycleSeconds: true } },
      categories: {
        orderBy: { sequence: "asc" },
        select: { id: true, name: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// BigScreenDisplayState — what the controller has the screens showing (Unit 11)
// ---------------------------------------------------------------------------

export function findDisplayState(competitionId: string) {
  return prisma.bigScreenDisplayState.findUnique({
    where: { competitionId },
  });
}

/**
 * Write the display state. `upsert` because the row is created lazily — a
 * competition starts with no row and Unit 09's rotation never needed one; the
 * first command that sets a mode creates it with the schema's defaults for any
 * field the command left out.
 */
export function upsertDisplayState(input: {
  competitionId: string;
  mode: BigScreenMode;
  targetId: string | null;
  rotationEnabled: boolean;
}) {
  return prisma.bigScreenDisplayState.upsert({
    where: { competitionId: input.competitionId },
    create: input,
    update: {
      mode: input.mode,
      targetId: input.targetId,
      rotationEnabled: input.rotationEnabled,
    },
  });
}
