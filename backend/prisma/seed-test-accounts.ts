/**
 * Test/dev seed for Unit 02's own verification: one account per role, plus a
 * deactivated account to prove a disabled login is rejected the same way as a wrong
 * password. Scratch tooling, not a feature and not wired into any user-facing flow
 * (spec 02, "Components Involved" / "Implementation Notes").
 *
 * Usage: npx tsx prisma/seed-test-accounts.ts
 * Idempotent: accounts with the same username are upserted, so the known test
 * password always works.
 */
import { prisma } from "../src/infra/prisma";
import { identityService } from "../src/modules/identity";

const TEST_PASSWORD = "test-pass-1234";

interface SeedRow {
  username: string;
  role: "CONTROLLER" | "JUDGE" | "PLAYER";
  isActive: boolean;
}

const ROWS: SeedRow[] = [
  { username: "controller-test", role: "CONTROLLER", isActive: true },
  { username: "judge-test", role: "JUDGE", isActive: true },
  { username: "player-test", role: "PLAYER", isActive: true },
  { username: "inactive-test", role: "PLAYER", isActive: false },
];

async function main(): Promise<void> {
  const passwordHash = await identityService.hashPassword(TEST_PASSWORD);
  for (const row of ROWS) {
    await prisma.account.upsert({
      where: { username: row.username },
      update: { role: row.role, isActive: row.isActive, passwordHash },
      create: {
        username: row.username,
        passwordHash,
        role: row.role,
        isActive: row.isActive,
      },
    });
    console.log(`seeded ${row.role} ${row.username} (active: ${row.isActive})`);
  }
  console.log(`All test accounts use the password: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
