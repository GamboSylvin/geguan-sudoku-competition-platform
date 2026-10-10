/**
 * The scheduled purge (Unit 12, spec Detail 4, RES-004 / RES-009 / RES-011).
 *
 * What it does: once a `FINISHED` or `CANCELLED` competition's `PurgeSchedule.purgeAt`
 * has passed, everything student-identifying about that competition is deleted in a
 * single transaction, and the schedule is marked `EXECUTED`. Setup stays — the
 * competition, its stages, rounds, round settings, scoring configuration, question
 * sets and questions (including the question Excel file), and the judges with their
 * accounts and assignments.
 *
 * **It is never an endpoint.** The spec's Security Considerations are explicit: the
 * purge is schedule-driven only, with no manual trigger from any client. There is no
 * HTTP surface here at all.
 *
 * The scheduler follows the shape the codebase already uses for a background timer
 * (`big-screen.service.ts`'s rotation): one `setInterval`, `unref()`'d so it never
 * holds the process open, a tick wrapped in try/catch + `logger.error` so a failure
 * logs rather than crashes, and a `stopPurgeScheduler()` for a clean shutdown. No
 * scheduling library is added — `node-cron` or similar would be a new dependency for
 * something a 60-second poll does correctly.
 *
 * **A poll, not a per-competition timer.** A purge date is up to 15 days out, so a
 * timer per competition would have to survive a restart and hold a `setTimeout` for
 * days. Instead the tick reads the schedules that are due — which is also what makes
 * it idempotent across restarts: a process that was down over a purge date catches up
 * on its first tick, and a second run finds nothing due.
 *
 * The files on disk go too. The database transaction deletes the `StoredFile` rows,
 * but the uploaded participant Excel and any generated export live under
 * `STORAGE_ROOT`; those are unlinked after the transaction commits. A file that
 * cannot be unlinked is logged, not fatal — the row is already gone, so nothing can
 * serve it again.
 */
import { unlink } from "node:fs/promises";
import { logger } from "../../infra";
import * as repository from "./results.repository";
import { PURGE_RETENTION_DAYS, type PurgeResultView } from "./results.types";

/** How often the tick looks for schedules that have come due. */
const POLL_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------------------
// One competition's purge
// ---------------------------------------------------------------------------

/**
 * Purge one competition if its schedule is due. Returns what was deleted, or `null`
 * when there was nothing to do — which is the normal case, not an error (spec Error
 * Cases: "the purge job runs twice for the same competition → the second run is a
 * no-op").
 *
 * The state check is deliberate and happens here, not only in the query that selects
 * due schedules: a competition that is still running must never be purged even if a
 * stray schedule row says otherwise.
 */
async function purgeOne(competitionId: string, nowDate: Date): Promise<PurgeResultView | null> {
  const schedule = await repository.findPurgeSchedule(competitionId);
  if (!schedule || schedule.status === "EXECUTED") return null;
  if (schedule.purgeAt.getTime() > nowDate.getTime()) return null;

  const target = await repository.readPurgeTarget(competitionId);
  if (!target) return null;
  if (target.competition.status !== "FINISHED" && target.competition.status !== "CANCELLED") {
    logger.warn("results.purge: skipped a competition that has not ended", {
      competitionId,
      status: target.competition.status,
    });
    return null;
  }

  const executedAt = nowDate;
  const deleted = await repository.purgeCompetitionData({
    competitionId,
    scheduleId: schedule.id,
    executedAt,
  });

  // The rows are gone; now the bytes. Best-effort, after the commit.
  for (const file of target.storedFiles) {
    try {
      await unlink(file.path);
    } catch (error) {
      logger.error("results.purge: could not delete a stored file", {
        competitionId,
        path: file.path,
        kind: file.kind,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("results.purge: competition data purged", {
    competitionId,
    executedAt: executedAt.toISOString(),
    ...deleted,
  });

  return {
    competitionId,
    purgeAt: schedule.purgeAt.toISOString(),
    executedAt: executedAt.toISOString(),
    deleted,
  };
}

/**
 * Create the schedule for every ended competition that does not have one yet.
 *
 * This is how the countdown starts — for **all three** end paths (natural finish,
 * `finish-early`, cancel) with no coupling to the modules that set those states. Each
 * of them already writes the timestamp the retention rule reads (`finishedAt` or
 * `cancelledAt`), so the purge date is derived from what is durably in the database
 * rather than from an announcement that could be missed. It also covers competitions
 * that ended before this unit existed.
 *
 * Runs every tick, so a missed hook or a crash between the finish and the schedule
 * write is self-healing within a minute. `ensurePurgeSchedule` is idempotent, so a
 * competition that already has a schedule is untouched — its date never moves.
 */
async function backfillSchedules(): Promise<void> {
  const ended = await repository.listEndedCompetitionsWithoutSchedule();
  for (const competition of ended) {
    const endedAt = competition.finishedAt ?? competition.cancelledAt;
    if (!endedAt) continue;
    try {
      await repository.ensurePurgeSchedule({
        competitionId: competition.id,
        purgeAt: new Date(
          endedAt.getTime() + PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        ),
      });
    } catch (error) {
      logger.error("results.purge: failed to schedule purge", {
        competitionId: competition.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Run every due purge. One competition's failure is isolated: the loop continues, so
 * a single bad row cannot block the rest of the retention schedule.
 */
async function runDuePurges(nowDate: Date = new Date()): Promise<PurgeResultView[]> {
  await backfillSchedules();
  const due = await repository.listDueSchedules(nowDate);
  const results: PurgeResultView[] = [];
  for (const schedule of due) {
    try {
      const result = await purgeOne(schedule.competitionId, nowDate);
      if (result) results.push(result);
    } catch (error) {
      logger.error("results.purge: failed to purge a competition", {
        competitionId: schedule.competitionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

async function runTick(): Promise<void> {
  try {
    await runDuePurges();
  } catch (error) {
    logger.error("results.purge: tick failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// The scheduler
// ---------------------------------------------------------------------------

/**
 * Start the purge poll, once per process. Called from `app.ts`'s
 * `installListeners()`, behind the same once-guard the other cross-module wiring
 * uses (BLD-033), so a second `createApp()` in a test does not start a second timer.
 *
 * The first tick runs immediately on start: a server that was down across a purge
 * date should not wait a full minute to catch up.
 */
function startPurgeScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void runTick();
  }, POLL_INTERVAL_MS);
  // A retention job must never hold the process open on its own.
  timer.unref?.();
  void runTick();
}

function stopPurgeScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export const purgeService = {
  startPurgeScheduler,
  stopPurgeScheduler,
  runDuePurges,
  purgeOne,
};
