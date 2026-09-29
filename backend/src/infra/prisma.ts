import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env";

/**
 * The single Prisma client for the process (infra layer: an adapter to an external
 * system, no domain rules — architecture.md, "Backend folder structure").
 * The Prisma schema is the single source of truth for the database (I-31 / BLD-017).
 */
export const prisma = new PrismaClient({
  log: isProduction ? ["warn", "error"] : ["warn", "error"],
});

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
