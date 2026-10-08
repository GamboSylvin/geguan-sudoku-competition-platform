/**
 * The one place a controller command writes its `AuditLog` row (Unit 11, spec
 * Security Considerations: every command is controller-only *and* traceable, so
 * even the judge-equivalent restart is logged).
 *
 * Best-effort by design: a command has usually already changed durable state by
 * the time this runs, and rolling it back because a log row failed would be
 * worse than losing the trace. The failure is logged and the command still
 * succeeds.
 */
import { logger } from "../../infra";
import * as repository from "./orchestrator.repository";
import type { OrchestratorAuditAction } from "./orchestrator.types";

export interface CommandAudit {
  competitionId?: string | null;
  /** The acting account, from the session. Null only for a system-triggered write. */
  actorAccountId?: string | null;
  action: OrchestratorAuditAction;
  targetType?: string | null;
  targetId?: string | null;
  /** What the command did, in enough detail to reconstruct it later. */
  payload?: Record<string, unknown> | null;
}

/** Record one command. Never throws. */
export async function recordCommand(entry: CommandAudit): Promise<void> {
  try {
    await repository.writeAuditLog(entry);
  } catch (error) {
    logger.error("orchestrator.audit: failed to write a command's AuditLog row", {
      action: entry.action,
      competitionId: entry.competitionId ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
