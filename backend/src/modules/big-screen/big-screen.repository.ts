/**
 * Prisma access for the BigScreen module (Unit 09). No domain rule lives here; the
 * service holds the rules (invariant 4). Thin wrappers over Prisma.
 */
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
