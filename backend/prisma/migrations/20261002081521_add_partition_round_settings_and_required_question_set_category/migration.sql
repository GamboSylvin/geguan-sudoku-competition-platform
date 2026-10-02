/*
  Warnings:

  - Made the column `categoryId` on table `QuestionSet` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "QuestionSet" DROP CONSTRAINT "QuestionSet_categoryId_fkey";

-- AlterTable
ALTER TABLE "QuestionSet" ALTER COLUMN "categoryId" SET NOT NULL;

-- AlterTable
ALTER TABLE "RoundSettings" ADD COLUMN     "partitionPointsPerPuzzle" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "partitionPuzzleCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "partitionTotalTimeSeconds" INTEGER NOT NULL DEFAULT 1800;

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
