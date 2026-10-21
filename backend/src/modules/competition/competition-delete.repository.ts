/**
 * Prisma access for the Competition module's hard delete (BLD-050, decided
 * 2026-10-15). No domain rule lives here; `competition.service.ts` decides when a
 * delete is allowed (answer: always — there is deliberately no status gate). Kept in
 * its own file so Unit 03's repository and Unit 15's copy repository both stay
 * untouched.
 *
 * The whole delete runs inside ONE transaction, mirroring
 * `competition-copy.repository.ts`'s shape. A partially deleted competition — results
 * gone but the row still there — would be worse than either endpoint of the
 * operation.
 *
 * Nearly every relation in the schema is `onDelete: Cascade`, so deleting the
 * `Competition` row alone would in fact remove almost all of this. The explicit
 * child-first deletes are still there on purpose:
 *
 * 1. They return real per-table counts, which the service logs and the test asserts.
 *    Relying on cascades would report "deleted one competition" for an event that held
 *    400 participants and 12 question sets — the same reasoning `results.repository.ts`'s
 *    purge states in its own comment.
 * 2. `ImportBatch.file -> StoredFile` is `onDelete: Restrict`, so batches genuinely must
 *    go before their files or the transaction fails.
 * 3. `Judge` rows are a reusable list independent of any competition (Unit 06). Only
 *    `CompetitionJudgeAssignment` rows scoped to this competition are removed; the
 *    judges themselves must survive, and a cascade from `Competition` would never touch
 *    them anyway. Stating it here keeps that guarantee visible rather than incidental.
 *
 * `CompetitionRuntimeState` and `BigScreenDisplayState` are 1:1 `Cascade` children of
 * `Competition` with no other referent, so they are removed by the final competition
 * delete and are not listed explicitly.
 */
import { unlink } from "node:fs/promises";
import { prisma, logger } from "../../infra";

/** Per-table row counts, so the caller can log and assert what actually went. */
export interface DeleteCounts {
  answers: number;
  attempts: number;
  roundParticipations: number;
  individualRoundResults: number;
  teamRoundResults: number;
  rankingSnapshots: number;
  scoreCorrections: number;
  auditLogs: number;
  teamRotationStates: number;
  teamPartitionStates: number;
  questions: number;
  questionSets: number;
  roundSettings: number;
  rounds: number;
  stages: number;
  judgeAssignments: number;
  teams: number;
  participants: number;
  devices: number;
  accounts: number;
  schools: number;
  scoringConfigurations: number;
  purgeSchedules: number;
  importBatches: number;
  storedFiles: number;
  competitions: number;
}

/** Does this competition exist at all? Drives the 404. */
export async function competitionExists(id: string): Promise<boolean> {
  const row = await prisma.competition.findUnique({ where: { id }, select: { id: true } });
  return row !== null;
}

/**
 * The on-disk paths of every stored file belonging to this competition. Read before
 * the transaction, unlinked after it commits — the same ordering `purge.service.ts`
 * uses, so a rolled-back delete never loses a file that its row still points at.
 */
export function readStoredFilePaths(competitionId: string): Promise<{ id: string; path: string; kind: string }[]> {
  return prisma.storedFile.findMany({
    where: { competitionId },
    select: { id: true, path: true, kind: true },
  });
}

/**
 * Delete everything scoped to this competition, children before parents, in one
 * transaction. The order below is the FK-required one; comments mark the two places
 * where it is a hard constraint rather than belt-and-braces.
 */
export async function deleteCompetitionEverything(
  competitionId: string,
): Promise<DeleteCounts> {
  return prisma.$transaction(async (tx) => {
    // Every round-scoped table is reached through round -> stage -> competitionId.
    // Collected once, because `Attempt` has no competition column of its own.
    const attemptIds = (
      await tx.attempt.findMany({
        where: { roundParticipation: { round: { stage: { competitionId } } } },
        select: { id: true },
      })
    ).map((row) => row.id);
    const roundScope = { round: { stage: { competitionId } } } as const;

    // `Answer.attempt` and `IndividualRoundResult.attempt` both cascade from `Attempt`,
    // so they are deleted first or their counts read zero and lie about what the delete
    // actually removed. The same goes for `Device.account`/`Account.participant` further
    // down — every cascade-prone child precedes its parent here.
    const answers = await tx.answer.deleteMany({ where: { attemptId: { in: attemptIds } } });
    const individualRoundResults = await tx.individualRoundResult.deleteMany({ where: roundScope });
    const teamRoundResults = await tx.teamRoundResult.deleteMany({ where: roundScope });
    const attempts = await tx.attempt.deleteMany({ where: { id: { in: attemptIds } } });
    const roundParticipations = await tx.roundParticipation.deleteMany({ where: roundScope });

    const rankingSnapshots = await tx.rankingSnapshot.deleteMany({ where: { competitionId } });
    const scoreCorrections = await tx.scoreCorrection.deleteMany({ where: { competitionId } });
    const auditLogs = await tx.auditLog.deleteMany({ where: { competitionId } });

    const teamRotationStates = await tx.teamRotationState.deleteMany({ where: roundScope });
    const teamPartitionStates = await tx.teamPartitionState.deleteMany({ where: roundScope });

    const questions = await tx.question.deleteMany({
      where: { questionSet: { competitionId } },
    });
    const questionSets = await tx.questionSet.deleteMany({ where: { competitionId } });

    const roundSettings = await tx.roundSettings.deleteMany({ where: roundScope });
    const rounds = await tx.round.deleteMany({ where: { stage: { competitionId } } });
    const stages = await tx.stage.deleteMany({ where: { competitionId } });

    // The assignment goes; the `Judge` row itself never does (Unit 06: the judge list
    // is reusable across competitions and outlives any one of them).
    const judgeAssignments = await tx.competitionJudgeAssignment.deleteMany({
      where: { competitionId },
    });

    const teams = await tx.team.deleteMany({ where: { competitionId } });

    // Player accounts belong to a participant and their devices to them, and both
    // cascade — so all three must precede the participant delete or the login counts
    // would report zero for a competition whose 300 tablets all signed in.
    const devices = await tx.device.deleteMany({
      where: { account: { participant: { competitionId } } },
    });
    const accounts = await tx.account.deleteMany({
      where: { participant: { competitionId } },
    });
    const participants = await tx.participant.deleteMany({ where: { competitionId } });

    const schools = await tx.school.deleteMany({ where: { competitionId } });
    const scoringConfigurations = await tx.scoringConfiguration.deleteMany({
      where: { competitionId },
    });
    const purgeSchedules = await tx.purgeSchedule.deleteMany({ where: { competitionId } });

    // `ImportBatch.file` is `onDelete: Restrict` — batches must go before their files.
    const importBatches = await tx.importBatch.deleteMany({ where: { competitionId } });
    const storedFiles = await tx.storedFile.deleteMany({ where: { competitionId } });

    // Categories, the runtime state and the big-screen state all cascade from here.
    const competitions = await tx.competition.deleteMany({ where: { id: competitionId } });

    return {
      answers: answers.count,
      attempts: attempts.count,
      roundParticipations: roundParticipations.count,
      individualRoundResults: individualRoundResults.count,
      teamRoundResults: teamRoundResults.count,
      rankingSnapshots: rankingSnapshots.count,
      scoreCorrections: scoreCorrections.count,
      auditLogs: auditLogs.count,
      teamRotationStates: teamRotationStates.count,
      teamPartitionStates: teamPartitionStates.count,
      questions: questions.count,
      questionSets: questionSets.count,
      roundSettings: roundSettings.count,
      rounds: rounds.count,
      stages: stages.count,
      judgeAssignments: judgeAssignments.count,
      teams: teams.count,
      participants: participants.count,
      devices: devices.count,
      accounts: accounts.count,
      schools: schools.count,
      scoringConfigurations: scoringConfigurations.count,
      purgeSchedules: purgeSchedules.count,
      importBatches: importBatches.count,
      storedFiles: storedFiles.count,
      competitions: competitions.count,
    };
  });
}

/**
 * Remove the files from disk, best effort, after the rows are gone. A file that
 * cannot be unlinked is logged and skipped — the database is already consistent and
 * an orphaned file on disk is a far smaller problem than failing the delete.
 * Exactly the pattern `purge.service.ts` uses.
 */
export async function unlinkStoredFiles(
  competitionId: string,
  files: { id: string; path: string; kind: string }[],
): Promise<void> {
  for (const file of files) {
    try {
      await unlink(file.path);
    } catch (error) {
      logger.error("competition.delete: could not remove a stored file", {
        competitionId,
        storedFileId: file.id,
        path: file.path,
        kind: file.kind,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
