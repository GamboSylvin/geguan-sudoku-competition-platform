-- AlterEnum
BEGIN;
CREATE TYPE "ImportBatchKind_new" AS ENUM ('PARTICIPANT_EXCEL', 'QUESTION_EXCEL');
ALTER TABLE "ImportBatch" ALTER COLUMN "kind" TYPE "ImportBatchKind_new" USING ("kind"::text::"ImportBatchKind_new");
ALTER TYPE "ImportBatchKind" RENAME TO "ImportBatchKind_old";
ALTER TYPE "ImportBatchKind_new" RENAME TO "ImportBatchKind";
DROP TYPE "ImportBatchKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StoredFileKind_new" AS ENUM ('PARTICIPANT_EXCEL', 'QUESTION_EXCEL', 'CREDENTIAL_SLIPS', 'EXPORT');
ALTER TABLE "StoredFile" ALTER COLUMN "kind" TYPE "StoredFileKind_new" USING ("kind"::text::"StoredFileKind_new");
ALTER TYPE "StoredFileKind" RENAME TO "StoredFileKind_old";
ALTER TYPE "StoredFileKind_new" RENAME TO "StoredFileKind";
DROP TYPE "StoredFileKind_old";
COMMIT;

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "roundId" DROP NOT NULL;

