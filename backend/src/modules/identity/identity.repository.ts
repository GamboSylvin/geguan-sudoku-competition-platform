/**
 * Prisma access for the Identity module (Unit 02). No domain rule lives here; the
 * service holds the rules (invariant 4 — a module's internals are reachable only
 * through its public interface).
 */
import type { Account, AccountRole, Device } from "@prisma/client";
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
