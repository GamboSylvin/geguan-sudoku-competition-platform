/**
 * Bootstrap seed — the one-time command that creates the first controller account
 * (ROL-011, confirmed 2026-10-02). The MVP has no self-service controller signup and
 * no unit owns one; this is the documented, intentional manual step that brings the
 * controller account into existence in production.
 *
 * Usage (inside the backend container or a dev shell with the env loaded):
 *   npx tsx prisma/seed.ts
 *   CONTROLLER_USERNAME=admin CONTROLLER_PASSWORD=... npx tsx prisma/seed.ts
 *
 * Idempotent: if a controller account already exists it is left untouched, so the
 * command is safe to re-run. It prints the generated credentials once so they can be
 * written down / printed — the password is never stored in plaintext.
 */
import { prisma } from "../src/infra/prisma";
import { identityService } from "../src/modules/identity";

async function main(): Promise<void> {
  const existing = await prisma.account.findFirst({ where: { role: "CONTROLLER" } });
  if (existing) {
    console.log(
      `A controller account already exists (username: ${existing.username}). Nothing to do.`,
    );
    return;
  }

  const username = process.env.CONTROLLER_USERNAME?.trim() || "controller";
  const password =
    process.env.CONTROLLER_PASSWORD?.trim() || identityService.generatePassword(10);
  const passwordHash = await identityService.hashPassword(password);

  await prisma.account.create({
    data: { username, passwordHash, role: "CONTROLLER", isActive: true },
  });

  console.log("Created the first controller account. Write these down and keep them safe:");
  console.log(`  username: ${username}`);
  console.log(`  password: ${password}`);
  console.log("The password is shown once and is not stored in plaintext.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
