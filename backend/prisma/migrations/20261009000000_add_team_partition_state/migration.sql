-- Unit 14 (2026-10-09): the second team round's gameplay state container
-- (齐心协力 / partition collaboration, TEM-005). `context/data-model.md` line 52 has
-- defined this entity since its 2026-09-30 approval; this migration creates its
-- concrete form, mirroring `TeamRotationState`. The live copy is Redis
-- (`gameplay:partition:{roundId}:{teamId}`, BLD-007); this row is a best-effort
-- mirror so a judge can read team status for round 2 (ROL-008).
--
-- Hand-written to match what `prisma migrate dev` emits for the schema change:
-- purely additive (one new table, two new FKs, one unique index), no data touched,
-- so it is safe to apply to a database holding rows from Units 01-13.

-- CreateTable
CREATE TABLE "TeamPartitionState" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "blockAssignments" JSONB,
    "puzzleIndex" INTEGER NOT NULL DEFAULT 0,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TeamPartitionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamPartitionState_roundId_teamId_key" ON "TeamPartitionState"("roundId", "teamId");

-- CreateIndex
CREATE INDEX "TeamPartitionState_roundId_idx" ON "TeamPartitionState"("roundId");

-- AddForeignKey
ALTER TABLE "TeamPartitionState" ADD CONSTRAINT "TeamPartitionState_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPartitionState" ADD CONSTRAINT "TeamPartitionState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
