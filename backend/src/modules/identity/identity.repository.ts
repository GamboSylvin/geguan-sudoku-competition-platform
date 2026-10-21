/**
 * Prisma access for the Identity module (Unit 02). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface).
 */
import type { Account, AccountRole, CompetitionJudgeAssignment, Device, Judge } from "@prisma/client";
import { prisma, redis } from "../../infra";

/** Load an account by its username within one role (the login endpoints are per role). */
export function findAccountByUsernameAndRole(
  username: string,
  role: AccountRole,
): Promise<Account | null> {
  return prisma.account.findFirst({ where: { username, role } });
}

/**
 * Every competition an account belongs to, whichever way it belongs to one.
 *
 * A player belongs to exactly one, through its `Participant` row. A judge belongs to
 * each competition that assigned them a range, through `CompetitionJudgeAssignment`
 * — one account, several competitions, so this returns a list rather than a single
 * id. A controller belongs to none: they are not scoped to a competition at all
 * (ROL-004), and login ignores their token rather than rejecting them for it.
 *
 * Read as one function on purpose. It used to read only `participant`, which made the
 * entry link a player-only mechanism: the same link handed to a judge resolved to a
 * null competition and was folded into the generic rejection, so the judge could not
 * use the competition's own link at all (hole D, 2026-10-20).
 */
export async function findAccountCompetitionIds(accountId: string): Promise<string[]> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      participant: { select: { competitionId: true } },
      judgeId: true,
    },
  });
  if (account === null) return [];

  const ids = new Set<string>();
  if (account.participant) ids.add(account.participant.competitionId);
  if (account.judgeId !== null) {
    const assignments = await prisma.competitionJudgeAssignment.findMany({
      where: { judgeId: account.judgeId },
      select: { competitionId: true },
    });
    for (const assignment of assignments) ids.add(assignment.competitionId);
  }
  return [...ids];
}

/** The competition an entry-link token resolves to, or null when no competition carries it. */
export async function findCompetitionIdByEntryLinkToken(
  entryLinkToken: string,
): Promise<string | null> {
  const competition = await prisma.competition.findFirst({
    where: { entryLinkToken },
    select: { id: true },
  });
  return competition?.id ?? null;
}

export function findAccountById(id: string): Promise<Account | null> {
  return prisma.account.findUnique({ where: { id } });
}

/**
 * The public name of the competition an entry-link token belongs to, or null.
 *
 * Name only, and read for an **unauthenticated** caller on purpose: the token is the
 * link printed on the publish card and read out in the room, so whoever holds it is
 * already meant to be at this event, and the one thing the login screen needs from it
 * is which event that is. Nothing else is selected — no participant, no judge, no
 * category, no round, no question.
 */
export async function findCompetitionNameByEntryLinkToken(
  entryLinkToken: string,
): Promise<string | null> {
  const competition = await prisma.competition.findFirst({
    where: { entryLinkToken },
    select: { name: true },
  });
  return competition?.name ?? null;
}

/**
 * The account currently bound to a session token, plus the participant's category
 * (null for a judge/controller account, which has no participant). The category is
 * read in the same query as the account so `authenticate` can hand it to the realtime
 * gateway for its category-scoped room without a second lookup. The nested
 * `participant` relation is flattened into a single `categoryId` field and dropped,
 * so callers see `Account & { categoryId }`.
 */
export type SessionAccountRow = Account & { categoryId: string | null };

export async function findSessionAccount(token: string): Promise<SessionAccountRow | null> {
  const row = await prisma.account.findFirst({
    where: { sessionToken: token },
    include: { participant: { select: { categoryId: true } } },
  });
  if (row === null) return null;
  const { participant, ...account } = row;
  return { ...account, categoryId: participant?.categoryId ?? null };
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

// ---------------------------------------------------------------------------
// Session scope (F1, 2026-10-21)
// ---------------------------------------------------------------------------

/**
 * The competition one session is scoped to.
 *
 * ARCH-030 says the entry link *identifies* the competition and there is no
 * competition-selection screen. Login already checks that the link and the
 * credentials agree, then threw the answer away — so a judge assigned to five
 * competitions still saw all five, whichever link they came through. This holds
 * that answer for as long as the session lives.
 *
 * Redis, not a column: this is session runtime state, exactly what BLD-007 puts
 * there (the working grids, the round runtime, the big-screen mode all live the
 * same way), so it needs no migration. The TTL is the session's own, so a scope can
 * never outlive the token it belongs to. Whether a real column on `Account`/`Device`
 * is wanted instead — which would survive a Redis flush — is I-51, recorded rather
 * than assumed.
 *
 * Keyed by the session token, not the account id: one account, one active device,
 * one token at a time (PAR-005), and a re-login through a *different* link must
 * replace the scope rather than inherit the previous one.
 */
function sessionScopeKey(sessionToken: string): string {
  return `session:scope:${sessionToken}`;
}

/** Remember which competition this session came in through. */
export async function setSessionScope(
  sessionToken: string,
  competitionId: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(sessionScopeKey(sessionToken), competitionId, "EX", ttlSeconds);
}

/** The competition this session is scoped to, or null when it carries no scope. */
export async function getSessionScope(sessionToken: string): Promise<string | null> {
  return redis.get(sessionScopeKey(sessionToken));
}

/** Drop the scope when the session ends, so a stale token names no competition. */
export async function clearSessionScope(sessionToken: string): Promise<void> {
  await redis.del(sessionScopeKey(sessionToken));
}

/** Touch a device's last-seen time on an accepted request. */
export function touchDevice(deviceId: string): Promise<Device> {
  return prisma.device.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Player presence (F2/F3, 2026-10-21)
// ---------------------------------------------------------------------------

/**
 * The few fields a presence push about a player may carry: the number the judge's range
 * is expressed in, the name, and the competition. Nothing else — no session token, no
 * device id, no attempt data. Read here rather than assembled in the gateway so the
 * gateway stays a translator (invariant 8) and so the shape cannot drift wider than what
 * a judge is entitled to see about a student.
 */
export interface ParticipantPresenceRow {
  id: string;
  participantNumber: number;
  name: string;
  competitionId: string;
}

export function findParticipantPresence(
  participantId: string,
): Promise<ParticipantPresenceRow | null> {
  return prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, participantNumber: true, name: true, competitionId: true },
  });
}

/**
 * The player an account belongs to, with the one competition that player is a member of.
 * Null for a judge or a controller account, which has no `Participant` row and therefore
 * nothing to announce.
 *
 * Read at login and at logout for the same reason: presence is about a *player* arriving
 * or leaving, and the login may have come through no entry link at all (a controller
 * typing the address straight into the browser), so the competition cannot be taken from
 * the token — it has to come from the participant's own row.
 */
export function findPlayerPresenceTarget(
  accountId: string,
): Promise<{ participantId: string; competitionId: string } | null> {
  return prisma.account.findUnique({
    where: { id: accountId },
    select: {
      participantId: true,
      participant: { select: { competitionId: true } },
    },
  }).then((row) => {
    if (row === null || row.participantId === null || !row.participant) return null;
    return { participantId: row.participantId, competitionId: row.participant.competitionId };
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
 * Reactivate a judge and its account (report §4a — the inverse of `deactivateJudge`).
 * The stored password hash is left untouched, so the judge logs in again with the
 * credentials it was given at creation; only the two `active` flags flip back. No new
 * row is created and nothing is redistributed.
 *
 * Returns the account username alongside the judge so the screen can remind the
 * controller which username still belongs to this judge (the password is never
 * re-shown — BLD-037).
 */
export async function reactivateJudge(
  judgeId: string,
): Promise<{ judge: Judge; username: string | null }> {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { judgeId, role: "JUDGE" },
      select: { username: true },
      orderBy: { createdAt: "asc" },
    });
    if (account) {
      await tx.account.updateMany({
        where: { judgeId, role: "JUDGE" },
        data: { isActive: true },
      });
    }
    const judge = await tx.judge.update({
      where: { id: judgeId },
      data: { active: true },
    });
    return { judge, username: account?.username ?? null };
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

/**
 * A judge's assignments, optionally restricted to one competition.
 *
 * The restriction is what F1 (2026-10-21) needs: the judge landing showed *every*
 * competition the judge was ever assigned to, so arriving through competition A's own
 * link still listed B, C and D. Filtering in the query, not in the service, keeps the
 * rows the caller is not entitled to from ever being read.
 */
export function listAssignmentsForJudge(
  judgeId: string,
  competitionId?: string | null,
): Promise<(CompetitionJudgeAssignment & { competition: { id: string; name: string } })[]> {
  return prisma.competitionJudgeAssignment.findMany({
    where: competitionId ? { judgeId, competitionId } : { judgeId },
    include: { competition: { select: { id: true, name: true } } },
  });
}

/**
 * Every judge assignment recorded on one competition, with the judge's name (the
 * controller-side read the assignment panel was missing — report §4c: the panel was
 * write-only, so a second range had to be assigned blind). Ordered by the first number
 * of the range so overlapping or gapped ranges are visible at a glance.
 */
export function listAssignmentsForCompetition(
  competitionId: string,
): Promise<
  (CompetitionJudgeAssignment & {
    judge: { id: string; name: string; active: boolean };
    assignedBy: { username: string } | null;
  })[]
> {
  return prisma.competitionJudgeAssignment.findMany({
    where: { competitionId },
    include: {
      judge: { select: { id: true, name: true, active: true } },
      assignedBy: { select: { username: true } },
    },
    orderBy: { fromParticipantNumber: "asc" },
  });
}
