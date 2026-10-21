/**
 * Prisma access for the Results module (Unit 12). No domain rule lives here; the
 * service holds the rules (invariant 4).
 *
 * Three groups of access:
 *   - **reads** for the results view and the export (competition structure,
 *     participants, finalized round results, answers),
 *   - **writes** for the correction (the `ScoreCorrection` row and the result it
 *     amends) and the export's `StoredFile` row,
 *   - **the purge**: every read and write the scheduled deletion needs, including
 *     the single transaction that empties one competition's student data.
 */
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../../infra";
import type { PurgeResultView, PurgeScheduleView } from "./results.types";

// ---------------------------------------------------------------------------
// Results-view reads
// ---------------------------------------------------------------------------

/** The competition the results screen describes, with the fields the view shows. */
export function findCompetitionForResults(competitionId: string) {
  return prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      status: true,
      finishedEarly: true,
      finishedAt: true,
      cancelledAt: true,
    },
  });
}

/**
 * The competition's whole shape: categories in order, each stage in order, each
 * stage's rounds in order. One read, because the results view is a tree and the
 * export walks the same tree.
 */
export function findCompetitionStructure(competitionId: string) {
  return prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      categories: {
        orderBy: { sequence: "asc" },
        select: { id: true, code: true, name: true, sequence: true },
      },
      stages: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          type: true,
          sequence: true,
          status: true,
          rounds: {
            orderBy: { sequence: "asc" },
            select: { id: true, sequence: true, name: true, status: true },
          },
        },
      },
    },
  });
}

/**
 * Every participant of a competition — active and inactive alike, because a
 * removed participant's finished round result is still a result the controller may
 * need to see (removal is not erasure; the purge is what erases). Ordered by
 * participant number, which is the order the whole platform displays students in.
 */
export function listParticipants(competitionId: string) {
  return prisma.participant.findMany({
    where: { competitionId },
    orderBy: { participantNumber: "asc" },
    select: {
      id: true,
      name: true,
      participantNumber: true,
      categoryId: true,
      active: true,
    },
  });
}

/** Every finalized Individual round result of a competition. */
export function listIndividualResults(competitionId: string) {
  return prisma.individualRoundResult.findMany({
    where: { round: { stage: { competitionId } } },
    select: {
      id: true,
      roundId: true,
      participantId: true,
      categoryId: true,
      attemptId: true,
      score: true,
      bonus: true,
      totalScore: true,
      submissionType: true,
      submittedAt: true,
      completionTimeSeconds: true,
    },
  });
}

/** Every team round result of a competition (empty until Units 13/14 run). */
export function listTeamResults(competitionId: string) {
  return prisma.teamRoundResult.findMany({
    where: { round: { stage: { competitionId } } },
    select: {
      id: true,
      roundId: true,
      teamId: true,
      categoryId: true,
      correctCount: true,
      score: true,
      completionTimeSeconds: true,
    },
  });
}

/**
 * The per-question answers behind one competition's attempts, for the export's
 * "answer per question" sheet. Reached through the participation → attempt chain so
 * archived attempts' answers come along too (a rematch leaves the earlier attempt
 * behind, and the export should show what was actually submitted).
 */
export function listAnswersForCompetition(competitionId: string) {
  return prisma.answer.findMany({
    where: { attempt: { roundParticipation: { round: { stage: { competitionId } } } } },
    select: {
      id: true,
      attemptId: true,
      questionId: true,
      submittedGrid: true,
      correct: true,
      pointsAwarded: true,
      autoFilled: true,
      question: { select: { sequence: true, gridRows: true, gridColumns: true } },
    },
    orderBy: { question: { sequence: "asc" } },
  });
}

/** The questions assigned to a round, in order — the export's per-question columns. */
export function listQuestionsForRounds(roundIds: string[]) {
  return prisma.question.findMany({
    where: { roundId: { in: roundIds } },
    orderBy: [{ roundId: "asc" }, { sequence: "asc" }],
    select: { id: true, roundId: true, sequence: true, points: true },
  });
}

// ---------------------------------------------------------------------------
// Correction writes
// ---------------------------------------------------------------------------

/** The one result a correction amends: a (round, participant) Individual result. */
export function findIndividualResult(roundId: string, participantId: string) {
  return prisma.individualRoundResult.findFirst({
    where: { roundId, participantId },
    select: {
      id: true,
      roundId: true,
      participantId: true,
      categoryId: true,
      attemptId: true,
      score: true,
      bonus: true,
      totalScore: true,
    },
  });
}

/** The round a correction names, with the stage it belongs to (for the scoping check). */
export function findRoundWithStage(roundId: string) {
  return prisma.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      sequence: true,
      status: true,
      stage: { select: { id: true, competitionId: true, type: true } },
    },
  });
}

/**
 * Write the correction and amend the result it targets, in one transaction. The two
 * writes are inseparable: a `ScoreCorrection` row with no matching result change is
 * a lie, and a result change with no correction row is unauditable (RES-003).
 *
 * `newScore` is treated as the corrected **total** for the round, so the result's
 * `totalScore` becomes it. The raw `score` and the `bonus` are left as they were:
 * the controller is correcting the number the ranking uses, not re-deriving the
 * bonus rule (SCR-008–SCR-011), and re-deriving it would silently undo a legitimate
 * manual adjustment. The `Attempt` row behind the result is updated too, so the
 * archived detail and the settled result never disagree.
 *
 * `ScoreCorrection.oldScore`/`newScore` are `String` columns (schema), so the
 * integers are serialized here rather than at the call site.
 */
export async function applyCorrection(input: {
  competitionId: string;
  targetType: "PARTICIPANT" | "TEAM" | "SCHOOL";
  targetId: string;
  roundId: string;
  resultId: string;
  attemptId: string;
  oldTotalScore: number;
  newScore: number;
  reason: string;
  correctedByAccountId: string | null;
  correctedAt: Date;
}): Promise<{ correctionId: string }> {
  return prisma.$transaction(async (tx) => {
    const correction = await tx.scoreCorrection.create({
      data: {
        competitionId: input.competitionId,
        targetType: input.targetType,
        targetId: input.targetId,
        roundId: input.roundId,
        oldScore: String(input.oldTotalScore),
        newScore: String(input.newScore),
        reason: input.reason,
        correctedByAccountId: input.correctedByAccountId,
        correctedAt: input.correctedAt,
      },
      select: { id: true },
    });

    await tx.individualRoundResult.update({
      where: { id: input.resultId },
      data: { totalScore: input.newScore },
    });
    await tx.attempt.update({
      where: { id: input.attemptId },
      data: { totalScore: input.newScore },
    });

    return { correctionId: correction.id };
  });
}

/** The correction rows a competition holds, newest first (the change log). */
export function listCorrections(competitionId: string) {
  return prisma.scoreCorrection.findMany({
    where: { competitionId },
    orderBy: { correctedAt: "desc" },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      roundId: true,
      oldScore: true,
      newScore: true,
      reason: true,
      correctedByAccountId: true,
      correctedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * One `AuditLog` row per results action (spec Security Considerations). Best-effort
 * by contract — the caller wraps it, so a logging failure never rolls back a
 * correction that already succeeded.
 */
export async function writeAuditLog(entry: {
  competitionId: string;
  actorAccountId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      competitionId: entry.competitionId,
      actorAccountId: entry.actorAccountId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      payload: (entry.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Export: the StoredFile row
// ---------------------------------------------------------------------------

export interface CreateExportFileInput {
  competitionId: string;
  path: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedByAccountId: string | null;
}

/**
 * Record the generated workbook. Same shape as Unit 05's upload record, minus the
 * `uploadedBy` semantics — an export is generated, not uploaded, but the column is
 * reused to say which controller produced it.
 */
export async function createExportFile(
  input: CreateExportFileInput,
): Promise<{ id: string; sizeBytes: number; checksum: string }> {
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const row = await prisma.storedFile.create({
    data: {
      competitionId: input.competitionId,
      kind: "EXPORT",
      path: input.path,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      checksum,
      uploadedByAccountId: input.uploadedByAccountId,
    },
    select: { id: true, sizeBytes: true, checksum: true },
  });
  return row;
}

/** An export file row by id, scoped to a competition. */
export function findExportFile(competitionId: string, fileId: string) {
  return prisma.storedFile.findFirst({
    where: { competitionId, id: fileId, kind: "EXPORT" },
    select: { id: true, path: true, originalName: true, mimeType: true, sizeBytes: true },
  });
}

/** The most recent export of a competition, if any (the screen offers a re-download). */
export function findLatestExportFile(competitionId: string) {
  return prisma.storedFile.findFirst({
    where: { competitionId, kind: "EXPORT" },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, path: true, originalName: true, mimeType: true, sizeBytes: true },
  });
}

// ---------------------------------------------------------------------------
// Purge schedule
// ---------------------------------------------------------------------------

/** The scope the schedule row records — what a run will delete (RES-004, RES-011). */
export const PURGE_SCOPE = {
  answers: true,
  attempts: true,
  individualRoundResults: true,
  teamRoundResults: true,
  rankingSnapshots: true,
  scoreCorrections: true,
  auditLogs: true,
  studentParticipants: true,
  studentAccounts: true,
  studentDevices: true,
  participantExcelFiles: true,
  exportFiles: true,
} as const;

/**
 * Create the schedule for a competition that just ended, or return the one it
 * already has. Idempotent on purpose: both the natural-finish and the early-finish
 * paths announce through the same hook, and a crash-restart re-runs it — a second
 * row would mean two purge dates for one competition.
 */
export async function ensurePurgeSchedule(input: {
  competitionId: string;
  purgeAt: Date;
}): Promise<PurgeScheduleView> {
  const existing = await prisma.purgeSchedule.findFirst({
    where: { competitionId: input.competitionId },
    orderBy: { purgeAt: "asc" },
  });
  if (existing) {
    return toScheduleView(existing);
  }
  const created = await prisma.purgeSchedule.create({
    data: {
      competitionId: input.competitionId,
      purgeAt: input.purgeAt,
      scope: PURGE_SCOPE as unknown as Prisma.InputJsonValue,
      status: "SCHEDULED",
    },
  });
  return toScheduleView(created);
}

export function findPurgeSchedule(competitionId: string) {
  return prisma.purgeSchedule.findFirst({
    where: { competitionId },
    orderBy: { purgeAt: "asc" },
  });
}

/** Every schedule whose date has passed and that has not run yet. */
export function listDueSchedules(now: Date) {
  return prisma.purgeSchedule.findMany({
    where: { status: { not: "EXECUTED" }, purgeAt: { lte: now } },
    select: { id: true, competitionId: true, purgeAt: true },
  });
}

/**
 * Ended competitions that have no purge schedule yet. The tick back-fills these, so a
 * competition that finished before this unit existed — or whose finish hook failed —
 * still reaches its retention date. Without this, a schedule that nobody created is
 * never selected by `listDueSchedules` and the data would sit forever.
 */
export function listEndedCompetitionsWithoutSchedule() {
  return prisma.competition.findMany({
    where: {
      status: { in: ["FINISHED", "CANCELLED"] },
      purgeSchedules: { none: {} },
      OR: [{ finishedAt: { not: null } }, { cancelledAt: { not: null } }],
    },
    select: { id: true, finishedAt: true, cancelledAt: true },
  });
}

function toScheduleView(row: {
  competitionId: string;
  purgeAt: Date;
  status: string;
  executedAt: Date | null;
}): PurgeScheduleView {
  return {
    competitionId: row.competitionId,
    purgeAt: row.purgeAt.toISOString(),
    status: row.status === "EXECUTED" ? "EXECUTED" : "SCHEDULED",
    executedAt: row.executedAt ? row.executedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// The purge itself
// ---------------------------------------------------------------------------

/**
 * Everything the deletion needs to know about one competition, read *before* the
 * transaction starts: the competition's end state (a competition that is neither
 * `FINISHED` nor `CANCELLED` is never purged), the student participant ids, and the
 * file rows to drop.
 */
export async function readPurgeTarget(competitionId: string) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, status: true, finishedAt: true, cancelledAt: true },
  });
  if (!competition) return null;

  const participants = await prisma.participant.findMany({
    where: { competitionId },
    select: { id: true },
  });
  // A student participant whose account row is missing (defensive) still has data to
  // delete, so the participant list is not filtered down to those with an account.
  const studentAccounts = await prisma.account.findMany({
    where: { participant: { competitionId }, role: "PLAYER" },
    select: { id: true },
  });

  const storedFiles = await prisma.storedFile.findMany({
    where: { competitionId, kind: { in: ["PARTICIPANT_EXCEL", "EXPORT"] } },
    select: { id: true, path: true, kind: true },
  });

  return {
    competition,
    studentParticipantIds: participants.map((p) => p.id),
    studentAccountIds: studentAccounts.map((a) => a.id),
    storedFiles,
  };
}

/**
 * Delete one competition's student-identifying data in a single transaction (spec
 * Detail 4, Implementation Notes). Either all of it goes or none of it does: a
 * half-purged competition is worse than an un-purged one, because it looks purged.
 *
 * Deletion order matters only for the foreign keys that are `Restrict` rather than
 * `Cascade`: `ImportBatch.file` restricts, so the participant-Excel batches go
 * before their `StoredFile` rows. Everything else cascades from `Attempt`, but the
 * children are deleted explicitly anyway so the counts the run reports are real.
 *
 * Kept, per spec Context: `Competition`, `Stage`, `Round`, `RoundSettings`,
 * `ScoringConfiguration`, `QuestionSet`, `Question` (and the question Excel's
 * `StoredFile`), `Judge`, `CompetitionJudgeAssignment` and every judge `Account`.
 */
export async function purgeCompetitionData(input: {
  competitionId: string;
  scheduleId: string;
  executedAt: Date;
}): Promise<PurgeResultView["deleted"]> {
  const competitionId = input.competitionId;

  return prisma.$transaction(async (tx) => {
    const attemptIds = (
      await tx.attempt.findMany({
        where: { roundParticipation: { round: { stage: { competitionId } } } },
        select: { id: true },
      })
    ).map((a) => a.id);

    // `IndividualRoundResult.attempt` and `Answer.attempt` both cascade from `Attempt`,
    // so the dependants are deleted first: otherwise the cascade would remove them and
    // the explicit deletes would report zero, making the run's counts lie.
    const individualResults = await tx.individualRoundResult.deleteMany({
      where: { round: { stage: { competitionId } } },
    });
    const teamResults = await tx.teamRoundResult.deleteMany({
      where: { round: { stage: { competitionId } } },
    });
    const answers = await tx.answer.deleteMany({
      where: { attemptId: { in: attemptIds } },
    });
    const attempts = await tx.attempt.deleteMany({
      where: { id: { in: attemptIds } },
    });
    const rankingSnapshots = await tx.rankingSnapshot.deleteMany({
      where: { competitionId },
    });
    const scoreCorrections = await tx.scoreCorrection.deleteMany({
      where: { competitionId },
    });
    const auditLogs = await tx.auditLog.deleteMany({
      where: { competitionId },
    });

    // The round participations themselves are student-identifying (they join a
    // participant to a round) and hold no setup value once the attempts are gone.
    await tx.roundParticipation.deleteMany({
      where: { round: { stage: { competitionId } } },
    });

    // Student access first, while the participant → account link still exists to
    // scope it: a `Device` belongs to an `Account`, and a student `Account` belongs
    // to a `Participant` of this competition. In this schema a `Participant` is
    // always a student — judges are a separate `Judge` entity with their own
    // `Account` — so "the PLAYER-role rows" (spec Context) and "every participant of
    // this competition" are the same set. Logged as a Finding, not guessed silently.
    // Deleting them explicitly rather than relying on the cascade gives the run real
    // counts to report.
    const devices = await tx.device.deleteMany({
      where: { account: { participant: { competitionId } } },
    });
    const accounts = await tx.account.deleteMany({
      where: { participant: { competitionId }, role: "PLAYER" },
    });
    const participants = await tx.participant.deleteMany({ where: { competitionId } });

    // `ImportBatch.file` is `onDelete: Restrict`, so the batches that point at the
    // uploaded files must go first or the file delete fails.
    await tx.importBatch.deleteMany({
      where: { competitionId, kind: "PARTICIPANT_EXCEL" },
    });
    const storedFiles = await tx.storedFile.deleteMany({
      where: { competitionId, kind: { in: ["PARTICIPANT_EXCEL", "EXPORT"] } },
    });

    await tx.purgeSchedule.update({
      where: { id: input.scheduleId },
      data: { status: "EXECUTED", executedAt: input.executedAt },
    });

    return {
      answers: answers.count,
      attempts: attempts.count,
      individualResults: individualResults.count,
      teamResults: teamResults.count,
      rankingSnapshots: rankingSnapshots.count,
      scoreCorrections: scoreCorrections.count,
      auditLogs: auditLogs.count,
      devices: devices.count,
      accounts: accounts.count,
      participants: participants.count,
      storedFiles: storedFiles.count,
    };
  });
}
