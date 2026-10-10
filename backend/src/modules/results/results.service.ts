/**
 * The Results module's domain rules and public interface (Unit 12). Other modules
 * call this service, never the repository (invariant 4).
 *
 * Owns four things:
 *   1. **The results view** — every finalized round result, per category and stage,
 *      with Unit 09's current rank beside each participant. The rank is read through
 *      `rankingService.getCategoryRanking`, never computed here (the spec is explicit:
 *      reuse Unit 09's ranking).
 *   2. **The score correction** (RES-003) — a mandatory reason, a `ScoreCorrection`
 *      row plus an `AuditLog` row, the result amended, and the affected category's
 *      ranking recalculated by calling back into Unit 09.
 *   3. **The export** (U-08) — an `.xlsx` of scores, ranks and per-question answers,
 *      written to the competition's storage folder and recorded as a `StoredFile`
 *      with `kind = EXPORT`.
 *   4. **The purge schedule** — created when a competition ends or is cancelled, and
 *      read back so the controller's screen can show the date. The deletion job
 *      itself lives in `purge.service.ts`.
 *
 * **The cancelled gate.** Results, correction and export are all rejected for a
 * `CANCELLED` competition (ROL-009, U-31). Unit 11 set the state and explicitly
 * deferred the check to this unit; `requireResultsAvailable` below is that check, and
 * every one of the three entry points goes through it.
 *
 * A competition that **finished early** is *not* rejected — its results are partial
 * but real, and the view says so with `finishedEarly: true`.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { competitionFilePath, ensureStorageRoot, logger } from "../../infra";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { rankingService } from "../ranking";
import type { RankingRow } from "../ranking/ranking.types";
import * as repository from "./results.repository";
import { writeXlsx, XLSX_MIME_TYPE, gridToCellText, type XlsxSheet } from "./results-xlsx";
import {
  PURGE_RETENTION_DAYS,
  RESULTS_AUDIT_ACTIONS,
  RESULTS_CANCELLED,
  RESULTS_INVALID_SCORE,
  RESULTS_NOT_FOUND,
  RESULTS_REASON_REQUIRED,
  RESULTS_RESULT_NOT_FOUND,
  RESULTS_ROUND_NOT_FOUND,
  RESULTS_UNSUPPORTED_TARGET,
  type CorrectionInput,
  type CorrectionResultView,
  type ExportResultView,
  type PurgeScheduleView,
  type ResultsCategoryView,
  type ResultsRowView,
  type ResultsStageView,
  type ResultsView,
} from "./results.types";

/** Server clock, the same authority the timers use (invariant 3). */
function now(): Date {
  return new Date();
}

function badRequest(code: string, details?: unknown): AppError {
  return new AppError(translate("en", code), { statusCode: 400, code, details });
}

// ---------------------------------------------------------------------------
// The gate every entry point shares
// ---------------------------------------------------------------------------

/**
 * Load a competition for a results action and enforce the two rules that apply to
 * all three endpoints: it must exist, and it must not be cancelled. Returns the row
 * so the caller does not read it twice.
 */
async function requireResultsAvailable(competitionId: string) {
  const competition = await repository.findCompetitionForResults(competitionId);
  if (!competition) {
    throw new NotFoundError(translate("en", RESULTS_NOT_FOUND), {
      code: RESULTS_NOT_FOUND,
      details: { competitionId },
    });
  }
  if (competition.status === "CANCELLED") {
    // 403 per the spec's API contract: a cancelled competition's results are not
    // merely missing, they are withheld (ROL-009 — no result is ever released).
    throw new ForbiddenError(translate("en", RESULTS_CANCELLED), {
      code: RESULTS_CANCELLED,
      details: { competitionId, cancelledAt: competition.cancelledAt?.toISOString() ?? null },
    });
  }
  return competition;
}

// ---------------------------------------------------------------------------
// 1. The results view
// ---------------------------------------------------------------------------

/**
 * Assemble the results tree: category → stage → round → participant row. One
 * participant appears once per round they have a finalized result for; a round with
 * no results is present with an empty row list, so the screen shows the structure
 * even before anything is scored.
 *
 * The `rank` on each row is the participant's current rank in their **category**,
 * which is cumulative across the Individual stage's rounds (Unit 09's model) — so
 * the same participant carries the same rank on both of their Individual rounds.
 * That is the correct reading: the ranking the screen shows next to the results is
 * the category leaderboard, not a per-round leaderboard, which nothing computes.
 */
async function getResults(competitionId: string): Promise<ResultsView> {
  const competition = await requireResultsAvailable(competitionId);
  const structure = await repository.findCompetitionStructure(competitionId);
  if (!structure) {
    throw new NotFoundError(translate("en", RESULTS_NOT_FOUND), {
      code: RESULTS_NOT_FOUND,
      details: { competitionId },
    });
  }

  const participants = await repository.listParticipants(competitionId);
  const results = await repository.listIndividualResults(competitionId);

  const resultsByRoundAndParticipant = new Map<string, (typeof results)[number]>();
  for (const result of results) {
    resultsByRoundAndParticipant.set(`${result.roundId}:${result.participantId}`, result);
  }

  // The rank lookup is per category, computed once and reused for every round row.
  const rankings: Record<string, RankingRow[]> = {};
  const rankByCategoryAndParticipant = new Map<string, number>();
  for (const category of structure.categories) {
    const ranking = await rankingService.getCategoryRanking(competitionId, category.id);
    const rows = ranking?.rows ?? [];
    rankings[category.id] = rows;
    for (const row of rows) {
      rankByCategoryAndParticipant.set(`${category.id}:${row.participantId}`, row.rank);
    }
  }

  const categories: ResultsCategoryView[] = structure.categories.map((category) => {
    // Which participants belong to this category — the rows only list them.
    const categoryParticipantIds = new Set(
      participants.filter((p) => p.categoryId === category.id).map((p) => p.id),
    );

    const stages: ResultsStageView[] = structure.stages.map((stage) => ({
      stageId: stage.id,
      type: stage.type,
      sequence: stage.sequence,
      status: stage.status,
      name: stage.type === "INDIVIDUAL" ? "Individual" : "Team",
      rounds: stage.rounds.map((round) => {
        const rows: ResultsRowView[] = participants
          .filter((p) => categoryParticipantIds.has(p.id))
          .map((participant) => {
            const result = resultsByRoundAndParticipant.get(
              `${round.id}:${participant.id}`,
            );
            return {
              participantId: participant.id,
              participantName: participant.name,
              participantNumber: participant.participantNumber,
              roundId: round.id,
              score: result?.score ?? null,
              bonus: result?.bonus ?? null,
              totalScore: result?.totalScore ?? null,
              completionTimeSeconds: result?.completionTimeSeconds ?? null,
              submissionType: result?.submissionType ?? null,
              submittedAt: result ? result.submittedAt.toISOString() : null,
              // Only an Individual-stage round has a result to rank; a Team round's
              // rows stay unranked until Units 13/14 produce team results.
              rank:
                stage.type === "INDIVIDUAL"
                  ? rankByCategoryAndParticipant.get(
                      `${category.id}:${participant.id}`,
                    ) ?? null
                  : null,
            };
          })
          // Participants with a result first, then the rest by number: the screen
          // reads top-down as a leaderboard, and a missing result is not an error.
          .sort((a, b) => {
            const aHas = a.totalScore === null ? 1 : 0;
            const bHas = b.totalScore === null ? 1 : 0;
            if (aHas !== bHas) return aHas - bHas;
            return a.participantNumber - b.participantNumber;
          });
        return {
          roundId: round.id,
          sequence: round.sequence,
          name: round.name,
          status: round.status,
          rows,
        };
      }),
    }));

    return {
      categoryId: category.id,
      code: category.code,
      name: category.name,
      sequence: category.sequence,
      stages,
    };
  });

  const schedule = await repository.findPurgeSchedule(competitionId);

  return {
    competitionId: competition.id,
    name: competition.name,
    status: competition.status,
    finishedEarly: competition.finishedEarly,
    finishedAt: competition.finishedAt ? competition.finishedAt.toISOString() : null,
    cancelledAt: competition.cancelledAt ? competition.cancelledAt.toISOString() : null,
    categories,
    rankings,
    purge: schedule
      ? {
          competitionId,
          purgeAt: schedule.purgeAt.toISOString(),
          status: schedule.status === "EXECUTED" ? "EXECUTED" : "SCHEDULED",
          executedAt: schedule.executedAt ? schedule.executedAt.toISOString() : null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// 2. The score correction (RES-003)
// ---------------------------------------------------------------------------

/**
 * Correct one participant's round score.
 *
 * Order matters: validate everything, write the correction and the amended result in
 * one transaction, log the audit row, then recalculate the ranking. The recompute is
 * last and outside the transaction because it is a *derived* value — if it fails, the
 * correction still stands and the next read recalculates it anyway (Unit 09's
 * recompute-on-read).
 *
 * `TEAM`/`SCHOOL` targets are rejected: the schema supports them and this code is
 * written so they can be added without restructuring, but nothing produces a team or
 * school result until Units 13/14/15, so there is nothing to correct (spec Error
 * Cases — a rejection, not a gap).
 */
async function createCorrection(
  competitionId: string,
  input: CorrectionInput,
  actorAccountId: string | null,
): Promise<CorrectionResultView> {
  await requireResultsAvailable(competitionId);

  const targetType = input.targetType;
  if (targetType !== "PARTICIPANT") {
    throw badRequest(RESULTS_UNSUPPORTED_TARGET, {
      targetType,
      supported: ["PARTICIPANT"],
    });
  }

  // The reason is mandatory and must survive trimming — a whitespace-only reason is
  // no reason at all (RES-003, spec Error Cases).
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length === 0) {
    throw badRequest(RESULTS_REASON_REQUIRED);
  }

  const newScore = input.newScore;
  if (
    typeof newScore !== "number" ||
    !Number.isInteger(newScore) ||
    newScore < 0
  ) {
    throw badRequest(RESULTS_INVALID_SCORE, { newScore });
  }

  const round = await repository.findRoundWithStage(input.roundId);
  if (!round || round.stage.competitionId !== competitionId) {
    throw new NotFoundError(translate("en", RESULTS_ROUND_NOT_FOUND), {
      code: RESULTS_ROUND_NOT_FOUND,
      details: { competitionId, roundId: input.roundId },
    });
  }

  const result = await repository.findIndividualResult(input.roundId, input.targetId);
  if (!result) {
    throw new UnprocessableEntityError(translate("en", RESULTS_RESULT_NOT_FOUND), {
      code: RESULTS_RESULT_NOT_FOUND,
      details: { roundId: input.roundId, participantId: input.targetId },
    });
  }

  const correctedAt = now();
  const { correctionId } = await repository.applyCorrection({
    competitionId,
    targetType: "PARTICIPANT",
    targetId: input.targetId,
    roundId: input.roundId,
    resultId: result.id,
    attemptId: result.attemptId,
    oldTotalScore: result.totalScore,
    newScore,
    reason,
    correctedByAccountId: actorAccountId,
    correctedAt,
  });

  await recordResultsAction({
    competitionId,
    actorAccountId,
    action: RESULTS_AUDIT_ACTIONS.correction,
    targetType: "ScoreCorrection",
    targetId: correctionId,
    payload: {
      participantId: input.targetId,
      roundId: input.roundId,
      oldScore: result.totalScore,
      newScore,
      reason,
    },
  });

  // Recalculate the affected category's ranking through Unit 09's own service. This
  // is the single seam both the live trigger and the controller read use, so the
  // ranking the big screen pushes and the one the results screen shows cannot drift.
  const ranking = await rankingService.recomputeCategoryRanking(
    competitionId,
    result.categoryId,
  );

  return {
    correctionId,
    competitionId,
    targetType: "PARTICIPANT",
    targetId: input.targetId,
    roundId: input.roundId,
    oldScore: String(result.totalScore),
    newScore: String(newScore),
    reason,
    correctedAt: correctedAt.toISOString(),
    ranking: ranking?.rows ?? null,
  };
}

/** The correction history the results screen shows (RES-003's "change log"). */
async function listCorrections(competitionId: string) {
  await requireResultsAvailable(competitionId);
  const corrections = await repository.listCorrections(competitionId);
  return {
    competitionId,
    corrections: corrections.map((c) => ({
      id: c.id,
      targetType: c.targetType,
      targetId: c.targetId,
      roundId: c.roundId,
      oldScore: c.oldScore,
      newScore: c.newScore,
      reason: c.reason,
      correctedByAccountId: c.correctedByAccountId,
      correctedAt: c.correctedAt.toISOString(),
    })),
  };
}

/**
 * Best-effort audit write. A correction that already changed state is never rolled
 * back because its log row failed (the pattern Unit 11's `recordCommand` uses); the
 * failure is logged instead, so the trace is the only thing lost.
 */
async function recordResultsAction(entry: {
  competitionId: string;
  actorAccountId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await repository.writeAuditLog(entry);
  } catch (error) {
    logger.error("results.audit: failed to write audit log", {
      competitionId: entry.competitionId,
      action: entry.action,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// 3. The export (U-08)
// ---------------------------------------------------------------------------

/**
 * The workbook's sheets. The spec imposes no layout ("No specific layout or column
 * list is imposed"), so the shape chosen is the one that makes the three required
 * contents — scores, ranks, and the answer per question — readable without
 * cross-referencing:
 *   - one **Scores** sheet per category: one row per participant, one column block
 *     per Individual round (score / bonus / total / time / submission type) plus the
 *     cumulative total and the current rank;
 *   - one **Answers** sheet per category: one row per (participant, round), one
 *     column per question in that round, each holding the submitted grid and whether
 *     it was correct.
 */
async function buildWorkbook(competitionId: string): Promise<XlsxSheet[]> {
  const structure = await repository.findCompetitionStructure(competitionId);
  if (!structure) {
    throw new NotFoundError(translate("en", RESULTS_NOT_FOUND), {
      code: RESULTS_NOT_FOUND,
      details: { competitionId },
    });
  }

  const participants = await repository.listParticipants(competitionId);
  const results = await repository.listIndividualResults(competitionId);
  const teamResults = await repository.listTeamResults(competitionId);
  const answers = await repository.listAnswersForCompetition(competitionId);

  const individualStage = structure.stages.find((s) => s.type === "INDIVIDUAL") ?? null;
  const individualRoundIds = individualStage ? individualStage.rounds.map((r) => r.id) : [];
  const questionsByRound = new Map<string, { id: string; sequence: number; points: number }[]>();
  for (const question of await repository.listQuestionsForRounds(individualRoundIds)) {
    const list = questionsByRound.get(question.roundId!) ?? [];
    list.push({ id: question.id, sequence: question.sequence, points: question.points });
    questionsByRound.set(question.roundId!, list);
  }

  const resultKey = (roundId: string, participantId: string) => `${roundId}:${participantId}`;
  const resultByRoundParticipant = new Map<string, (typeof results)[number]>();
  for (const result of results) {
    resultByRoundParticipant.set(resultKey(result.roundId, result.participantId), result);
  }
  const answersByAttempt = new Map<string, (typeof answers)[number][]>();
  for (const answer of answers) {
    const list = answersByAttempt.get(answer.attemptId) ?? [];
    list.push(answer);
    answersByAttempt.set(answer.attemptId, list);
  }

  const sheets: XlsxSheet[] = [];

  for (const category of structure.categories) {
    const ranking = await rankingService.getCategoryRanking(competitionId, category.id);
    const rankByParticipant = new Map<string, number>(
      (ranking?.rows ?? []).map((row) => [row.participantId, row.rank]),
    );
    const categoryParticipants = participants.filter((p) => p.categoryId === category.id);

    // --- the scores sheet ---
    const scoreHeader: (string | number)[] = [
      "Rank",
      "Number",
      "Name",
    ];
    for (const round of individualStage?.rounds ?? []) {
      scoreHeader.push(
        `R${round.sequence} Score`,
        `R${round.sequence} Bonus`,
        `R${round.sequence} Total`,
        `R${round.sequence} Time (s)`,
        `R${round.sequence} Submission`,
      );
    }
    scoreHeader.push("Cumulative Total", "Category");

    const scoreRows: (string | number | null)[][] = categoryParticipants
      .map((participant) => {
        const row: (string | number | null)[] = [
          rankByParticipant.get(participant.id) ?? null,
          participant.participantNumber,
          participant.name,
        ];
        let cumulative = 0;
        let hasAnyResult = false;
        for (const round of individualStage?.rounds ?? []) {
          const result = resultByRoundParticipant.get(resultKey(round.id, participant.id));
          if (result) hasAnyResult = true;
          row.push(
            result?.score ?? null,
            result?.bonus ?? null,
            result?.totalScore ?? null,
            result?.completionTimeSeconds ?? null,
            result?.submissionType ?? null,
          );
          cumulative += result?.totalScore ?? 0;
        }
        row.push(hasAnyResult ? cumulative : null, category.code);
        return { participant, row, hasAnyResult, rank: rankByParticipant.get(participant.id) ?? null };
      })
      // Ranked participants first, in rank order; the unranked (no result yet) after,
      // by participant number. The export reads as the leaderboard the screen shows.
      .sort((a, b) => {
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
        if (a.rank !== null) return -1;
        if (b.rank !== null) return 1;
        return a.participant.participantNumber - b.participant.participantNumber;
      })
      .map((entry) => entry.row);

    sheets.push({
      name: `Scores ${category.code}`,
      rows: [scoreHeader, ...scoreRows],
    });

    // --- the answers sheet ---
    const answerHeader: (string | number)[] = ["Number", "Name", "Round"];
    for (const round of individualStage?.rounds ?? []) {
      const questions = questionsByRound.get(round.id) ?? [];
      for (const question of questions) {
        answerHeader.push(`R${round.sequence}Q${question.sequence} (${question.points}pts)`);
      }
    }
    answerHeader.push("Correct", "Score");

    const answerRows: (string | number | null)[][] = [];
    for (const round of individualStage?.rounds ?? []) {
      const questions = questionsByRound.get(round.id) ?? [];
      for (const participant of categoryParticipants) {
        const result = resultByRoundParticipant.get(resultKey(round.id, participant.id));
        if (!result) continue; // no finalized result: nothing was submitted to show
        const attemptAnswers = answersByAttempt.get(result.attemptId) ?? [];
        const byQuestion = new Map(attemptAnswers.map((a) => [a.questionId, a]));
        const row: (string | number | null)[] = [
          participant.participantNumber,
          participant.name,
          `R${round.sequence}`,
        ];
        let correctCount = 0;
        for (const question of questions) {
          const answer = byQuestion.get(question.id);
          row.push(answer ? gridToCellText(answer.submittedGrid) : null);
          if (answer?.correct) correctCount += 1;
        }
        row.push(correctCount, result.totalScore);
        answerRows.push(row);
      }
    }

    sheets.push({
      name: `Answers ${category.code}`,
      rows: [answerHeader, ...answerRows],
    });
  }

  // Team results have no screen or ranking yet (Units 13/14), but the rows exist in
  // the schema and the export should not silently drop them if any are present.
  if (teamResults.length > 0) {
    const teamRows: (string | number | null)[][] = teamResults.map((result) => [
      result.roundId,
      result.teamId,
      result.categoryId,
      result.correctCount,
      result.score,
      result.completionTimeSeconds,
    ]);
    sheets.push({
      name: "Team Results",
      rows: [
        ["Round", "Team", "Category", "Correct", "Score", "Time (s)"],
        ...teamRows,
      ],
    });
  }

  // The correction log: what was changed, by whom, and why (RES-003's audit trail,
  // carried into the export so a printed results pack explains its own numbers).
  const corrections = await repository.listCorrections(competitionId);
  if (corrections.length > 0) {
    sheets.push({
      name: "Corrections",
      rows: [
        ["Corrected At", "Target Type", "Target", "Round", "Old Score", "New Score", "Reason"],
        ...corrections.map((c) => [
          c.correctedAt.toISOString(),
          c.targetType,
          c.targetId,
          c.roundId,
          c.oldScore,
          c.newScore,
          c.reason,
        ]),
      ],
    });
  }

  return sheets;
}

/**
 * Generate the export workbook, write it to disk and record it as a `StoredFile`
 * with `kind = EXPORT` (U-08). A fresh file is produced on every call rather than
 * reusing the last one: a correction between two exports must be visible in the
 * second, and a stale workbook is worse than a redundant one.
 */
async function generateExport(
  competitionId: string,
  actorAccountId: string | null,
): Promise<ExportResultView> {
  await requireResultsAvailable(competitionId);

  const sheets = await buildWorkbook(competitionId);
  const bytes = writeXlsx(sheets);

  const fileId = randomUUID();
  const stamp = now().toISOString().replace(/[:.]/g, "-");
  const fileName = `results-${competitionId}-${stamp}.xlsx`;

  await ensureStorageRoot();
  const path = competitionFilePath({
    competitionId,
    kind: "EXPORT",
    fileId,
    originalName: fileName,
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);

  const stored = await repository.createExportFile({
    competitionId,
    path,
    originalName: fileName,
    mimeType: XLSX_MIME_TYPE,
    bytes,
    uploadedByAccountId: actorAccountId,
  });

  await recordResultsAction({
    competitionId,
    actorAccountId,
    action: RESULTS_AUDIT_ACTIONS.export,
    targetType: "StoredFile",
    targetId: stored.id,
    payload: { fileName, sizeBytes: stored.sizeBytes, sheets: sheets.length },
  });

  return {
    competitionId,
    storedFileId: stored.id,
    fileName,
    sizeBytes: stored.sizeBytes,
    checksum: stored.checksum,
    generatedAt: now().toISOString(),
  };
}

/**
 * Resolve an export file to its bytes and download metadata. The controller's
 * download endpoint streams this — it is the only path that puts an `.xlsx` on the
 * wire, and it is controller-only like the rest (ROL-002).
 */
async function readExportFile(competitionId: string, fileId: string | null) {
  await requireResultsAvailable(competitionId);
  const row = fileId
    ? await repository.findExportFile(competitionId, fileId)
    : await repository.findLatestExportFile(competitionId);
  if (!row) {
    throw new NotFoundError(translate("en", RESULTS_NOT_FOUND), {
      code: RESULTS_NOT_FOUND,
      details: { competitionId, fileId },
    });
  }
  return row;
}

// ---------------------------------------------------------------------------
// 4. The purge schedule (RES-004)
// ---------------------------------------------------------------------------

/** `purgeAt` = the competition's end + 15 days (RES-04). */
function computePurgeAt(endedAt: Date): Date {
  return new Date(endedAt.getTime() + PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Start a competition's purge countdown. Called when the competition ends — whether
 * it finished naturally, was finished early (RND-007) or was cancelled (ROL-009).
 *
 * Idempotent: `ensurePurgeSchedule` returns the existing row rather than adding a
 * second, so a restart or a repeated announcement cannot move the date. A
 * competition that is neither finished nor cancelled gets no schedule — the countdown
 * only starts at an end.
 *
 * Never throws: it runs from a hook off the finish path, and failing to schedule a
 * purge 15 days out must not fail the competition's own finish transition.
 */
async function schedulePurge(input: {
  competitionId: string;
  /** The end the countdown runs from: `finishedAt`, or `cancelledAt` for a cancel. */
  endedAt: Date;
}): Promise<PurgeScheduleView | null> {
  try {
    return await repository.ensurePurgeSchedule({
      competitionId: input.competitionId,
      purgeAt: computePurgeAt(input.endedAt),
    });
  } catch (error) {
    logger.error("results.purge: failed to schedule purge", {
      competitionId: input.competitionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Back-fill the schedule for a competition that ended before this unit existed, or
 * whose hook failed. The purge job calls it per competition; the results view uses it
 * so the controller always sees a date rather than a blank.
 */
async function ensurePurgeScheduled(competitionId: string): Promise<PurgeScheduleView | null> {
  const existing = await repository.findPurgeSchedule(competitionId);
  if (existing) {
    return {
      competitionId,
      purgeAt: existing.purgeAt.toISOString(),
      status: existing.status === "EXECUTED" ? "EXECUTED" : "SCHEDULED",
      executedAt: existing.executedAt ? existing.executedAt.toISOString() : null,
    };
  }
  const competition = await repository.findCompetitionForResults(competitionId);
  if (!competition) return null;
  const endedAt = competition.finishedAt ?? competition.cancelledAt ?? null;
  if (!endedAt) return null; // not ended: no countdown to start
  return schedulePurge({ competitionId, endedAt });
}

export const resultsService = {
  requireResultsAvailable,
  getResults,
  createCorrection,
  listCorrections,
  generateExport,
  readExportFile,
  schedulePurge,
  ensurePurgeScheduled,
  computePurgeAt,
};
