/**
 * Prisma access for the Identity module (Unit 02). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface).
 */
import type { Account, AccountRole, CompetitionJudgeAssignment, Device, Judge } from "@prisma/client";
import { prisma } from "../../infra";

/** Load an account by its username within one role (the login endpoints are per role). */
export function findAccountByUsernameAndRole(
  username: string,
  role: AccountRole,
): Promise<Account | null> {
  return prisma.account.findFirst({ where: { username, role } });
}

export function findAccountById(id: string): Promise<Account | null> {
  return prisma.account.findUnique({ where: { id } });
}

/** The account currently bound to a session token, or null if none/expired. */
export function findSessionAccount(token: string): Promise<Account | null> {
  return prisma.account.findFirst({ where: { sessionToken: token } });
}

export interface CreateDeviceInput {
  accountId: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
}

export function createDevice(input: CreateDeviceInput): Promise<Device> {
  return prisma.device.create({
    data: {
      accountId: input.accountId,
      deviceLabel: input.deviceLabel ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/** Mark the account's other devices inactive (one active device per account). */
export function deactivateDevicesExcept(
  accountId: string,
  keepDeviceId: string,
): Promise<{ count: number }> {
  return prisma.device.updateMany({
    where: { accountId, id: { not: keepDeviceId }, isActive: true },
    data: { isActive: false },
  });
}

export interface SetSessionInput {
  accountId: string;
  sessionToken: string;
  sessionExpiresAt: Date;
  activeDeviceId: string;
  lastLoginAt: Date;
}

/** Record the session, its expiry, the new active device and the login time. */
export function setSession(input: SetSessionInput): Promise<Account> {
  return prisma.account.update({
    where: { id: input.accountId },
    data: {
      sessionToken: input.sessionToken,
      sessionExpiresAt: input.sessionExpiresAt,
      activeDeviceId: input.activeDeviceId,
      lastLoginAt: input.lastLoginAt,
    },
  });
}

/** End the session. The Device row is kept so the next login has something to replace. */
export function clearSession(accountId: string): Promise<Account> {
  return prisma.account.update({
    where: { id: accountId },
    data: { sessionToken: null, sessionExpiresAt: null, activeDeviceId: null },
  });
}

/** Touch a device's last-seen time on an accepted request. */
export function touchDevice(deviceId: string): Promise<Device> {
  return prisma.device.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Judges and ranges (Unit 06)
// ---------------------------------------------------------------------------

export function findJudgeById(id: string): Promise<Judge | null> {
  return prisma.judge.findUnique({ where: { id } });
}

/** The list screen shows active and inactive judges together. */
export function listJudges(): Promise<Judge[]> {
  return prisma.judge.findMany({ orderBy: { createdAt: "asc" } });
}

/**
 * Create the judge row and its account (role JUDGE, linked via judgeId) with the
 * hashed password, in one transaction — a judge always comes with login
 * credentials (spec 06, Implementation Details 1).
 */
export function createJudgeWithAccount(data: {
  name: string;
  username: string;
  passwordHash: string;
}): Promise<Judge> {
  return prisma.$transaction(async (tx) => {
    const judge = await tx.judge.create({ data: { name: data.name } });
    await tx.account.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        role: "JUDGE",
        judgeId: judge.id,
      },
    });
    return judge;
  });
}

/**
 * Deactivate the judge and its account. Removal means deactivation of a
 * competition-independent reusable row (data-model: `Judge.active`); the account is
 * deactivated too so the judge can no longer log in.
 */
export function deactivateJudge(judgeId: string): Promise<Judge> {
  return prisma.$transaction(async (tx) => {
    await tx.account.updateMany({
      where: { judgeId, role: "JUDGE" },
      data: {
        isActive: false,
        sessionToken: null,
        sessionExpiresAt: null,
        activeDeviceId: null,
      },
    });
    return tx.judge.update({ where: { id: judgeId }, data: { active: false } });
  });
}

/**
 * The judge's assignments that point to a competition which is neither FINISHED nor
 * CANCELLED — the condition ROL-010's removal guard checks. Includes the competition
 * name so the rejection can name it.
 */
export function listBlockingAssignments(
  judgeId: string,
): Promise<
  (CompetitionJudgeAssignment & { competition: { id: string; name: string } })[]
> {
  return prisma.competitionJudgeAssignment.findMany({
    where: {
      judgeId,
      competition: { status: { notIn: ["FINISHED", "CANCELLED"] } },
    },
    include: { competition: { select: { id: true, name: true } } },
  });
}

export function findCompetitionName(id: string): Promise<{ name: string } | null> {
  return prisma.competition.findUnique({ where: { id }, select: { name: true } });
}

export function findAssignment(
  competitionId: string,
  judgeId: string,
): Promise<CompetitionJudgeAssignment | null> {
  return prisma.competitionJudgeAssignment.findUnique({
    where: { competitionId_judgeId: { competitionId, judgeId } },
  });
}

export function findAssignmentById(id: string): Promise<CompetitionJudgeAssignment | null> {
  return prisma.competitionJudgeAssignment.findUnique({ where: { id } });
}

/**
 * Create or edit the judge's assignment on the competition (one row per judge per
 * competition, U(competitionId, judgeId)). Editable at any time — no cutoff
 * (BLD-008).
 */
export function upsertAssignment(data: {
  competitionId: string;
  judgeId: string;
  fromParticipantNumber: number;
  toParticipantNumber: number;
  assignedAt: Date;
  assignedByAccountId: string | null;
}): Promise<CompetitionJudgeAssignment> {
  const { competitionId, judgeId, fromParticipantNumber, toParticipantNumber, assignedAt, assignedByAccountId } = data;
  return prisma.competitionJudgeAssignment.upsert({
    where: { competitionId_judgeId: { competitionId, judgeId } },
    create: {
      competitionId,
      judgeId,
      fromParticipantNumber,
      toParticipantNumber,
      assignedAt,
      assignedByAccountId,
    },
    update: { fromParticipantNumber, toParticipantNumber, assignedAt, assignedByAccountId },
  });
}

export function deleteAssignment(id: string): Promise<CompetitionJudgeAssignment> {
  return prisma.competitionJudgeAssignment.delete({ where: { id } });
}

/** The judge's assignment on a specific competition, for the scoping check. */
export function findAssignmentForJudge(
  judgeId: string,
  competitionId: string,
): Promise<CompetitionJudgeAssignment | null> {
  return prisma.competitionJudgeAssignment.findUnique({
    where: { competitionId_judgeId: { competitionId, judgeId } },
  });
}

/** All of a judge's assignments (the minimal judge landing shows the current one). */
export function listAssignmentsForJudge(
  judgeId: string,
): Promise<(CompetitionJudgeAssignment & { competition: { id: string; name: string } })[]> {
  return prisma.competitionJudgeAssignment.findMany({
    where: { judgeId },
    include: { competition: { select: { id: true, name: true } } },
  });
}
