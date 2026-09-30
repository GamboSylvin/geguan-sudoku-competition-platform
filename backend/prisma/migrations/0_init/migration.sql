-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('CREATED', 'PUBLISHED', 'WAITING', 'PREPARATION', 'ROUND_ACTIVE', 'PAUSED', 'ROUND_FINISHED', 'STAGE_FINISHED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('WAITING', 'PREPARATION', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('WAITING', 'PREPARATION', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('CONTROLLER', 'JUDGE', 'PLAYER');

-- CreateEnum
CREATE TYPE "RoundParticipationState" AS ENUM ('WAITING', 'ACTIVE', 'SUBMITTED', 'AUTO_SUBMITTED', 'RESTARTED');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('MANUAL', 'TIMEOUT', 'CONTROLLER_END', 'AUTO');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('STANDARD', 'VARIANT');

-- CreateEnum
CREATE TYPE "ScoreCorrectionTargetType" AS ENUM ('PARTICIPANT', 'TEAM', 'SCHOOL');

-- CreateEnum
CREATE TYPE "RankingScope" AS ENUM ('INDIVIDUAL', 'TEAM', 'SCHOOL');

-- CreateEnum
CREATE TYPE "StoredFileKind" AS ENUM ('PARTICIPANT_EXCEL', 'QUESTION_PDF', 'CREDENTIAL_SLIPS', 'EXPORT');

-- CreateEnum
CREATE TYPE "ImportBatchKind" AS ENUM ('PARTICIPANT_EXCEL', 'QUESTION_PDF');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('VALIDATED', 'REJECTED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "BigScreenMode" AS ENUM ('RANKING', 'PLAYER_CLOSEUP', 'TEAM_SPLIT', 'PAUSED', 'FINAL');

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "finishedEarly" BOOLEAN NOT NULL DEFAULT false,
    "entryLinkToken" TEXT NOT NULL,
    "bigScreenLinkToken" TEXT NOT NULL,
    "copiedFromCompetitionId" TEXT,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionCategory" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "CompetitionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "type" "StageType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'WAITING',
    "earlyEnded" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundSettings" (
    "roundId" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "preparationSeconds" INTEGER NOT NULL DEFAULT 60,
    "earlyBonusRate" INTEGER NOT NULL DEFAULT 3,
    "earlyBonusCap" INTEGER,
    "teamPointsPerQuestion" INTEGER NOT NULL DEFAULT 10,
    "rotationPeriodSeconds" INTEGER NOT NULL DEFAULT 60,
    "teamQuestionCount" INTEGER NOT NULL DEFAULT 10,
    "teamTotalTimeSeconds" INTEGER,
    "individualTotalWarning" INTEGER DEFAULT 100,

    CONSTRAINT "RoundSettings_pkey" PRIMARY KEY ("roundId")
);

-- CreateTable
CREATE TABLE "QuestionSet" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "sourceFileId" TEXT,

    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionSetId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'STANDARD',
    "gridRows" INTEGER NOT NULL,
    "gridColumns" INTEGER NOT NULL,
    "regions" JSONB NOT NULL,
    "startingGrid" JSONB NOT NULL,
    "solution" JSONB NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "kind" "ImportBatchKind" NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL,
    "errors" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "participantNumber" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "participantId" TEXT,
    "judgeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "activeDeviceId" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionJudgeAssignment" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "fromParticipantNumber" INTEGER NOT NULL,
    "toParticipantNumber" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByAccountId" TEXT,

    CONSTRAINT "CompetitionJudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundParticipation" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "state" "RoundParticipationState" NOT NULL DEFAULT 'WAITING',
    "currentAttemptId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leftAnswerPageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoundParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "roundParticipationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "submissionType" "SubmissionType" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoFilled" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "completionTimeSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "submittedGrid" JSONB NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "autoFilled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualRoundResult" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "submissionType" "SubmissionType" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completionTimeSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IndividualRoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRoundResult" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completionTimeSeconds" INTEGER,

    CONSTRAINT "TeamRoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreCorrection" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "targetType" "ScoreCorrectionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "roundId" TEXT,
    "oldScore" TEXT NOT NULL,
    "newScore" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedByAccountId" TEXT,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "stageId" TEXT,
    "categoryId" TEXT,
    "scope" "RankingScope" NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringConfiguration" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "schoolCoefficient" DECIMAL(10,4) NOT NULL DEFAULT 0.6,
    "rankingCycleSeconds" INTEGER NOT NULL DEFAULT 180,

    CONSTRAINT "ScoringConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRotationState" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "refillQueue" JSONB,
    "tabletHolds" JSONB,
    "rotationIndex" INTEGER NOT NULL DEFAULT 0,
    "lastRotationAt" TIMESTAMP(3),

    CONSTRAINT "TeamRotationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionRuntimeState" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "currentStageId" TEXT,
    "currentRoundId" TEXT,
    "phase" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "remainingSecondsAtPause" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionRuntimeState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BigScreenDisplayState" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "mode" "BigScreenMode" NOT NULL DEFAULT 'RANKING',
    "targetId" TEXT,
    "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BigScreenDisplayState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "kind" "StoredFileKind" NOT NULL,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedByAccountId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurgeSchedule" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "purgeAt" TIMESTAMP(3) NOT NULL,
    "scope" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "PurgeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "actorAccountId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "payload" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_entryLinkToken_key" ON "Competition"("entryLinkToken");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_bigScreenLinkToken_key" ON "Competition"("bigScreenLinkToken");

-- CreateIndex
CREATE INDEX "Competition_status_idx" ON "Competition"("status");

-- CreateIndex
CREATE INDEX "CompetitionCategory_competitionId_idx" ON "CompetitionCategory"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionCategory_competitionId_code_key" ON "CompetitionCategory"("competitionId", "code");

-- CreateIndex
CREATE INDEX "Stage_competitionId_idx" ON "Stage"("competitionId");

-- CreateIndex
CREATE INDEX "Round_stageId_idx" ON "Round"("stageId");

-- CreateIndex
CREATE INDEX "QuestionSet_competitionId_idx" ON "QuestionSet"("competitionId");

-- CreateIndex
CREATE INDEX "Question_questionSetId_idx" ON "Question"("questionSetId");

-- CreateIndex
CREATE INDEX "Question_roundId_idx" ON "Question"("roundId");

-- CreateIndex
CREATE INDEX "ImportBatch_competitionId_idx" ON "ImportBatch"("competitionId");

-- CreateIndex
CREATE INDEX "School_competitionId_idx" ON "School"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "School_competitionId_name_key" ON "School"("competitionId", "name");

-- CreateIndex
CREATE INDEX "Team_competitionId_idx" ON "Team"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_competitionId_categoryId_schoolId_key" ON "Team"("competitionId", "categoryId", "schoolId");

-- CreateIndex
CREATE INDEX "Participant_competitionId_idx" ON "Participant"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_competitionId_participantNumber_key" ON "Participant"("competitionId", "participantNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Account_participantId_key" ON "Account"("participantId");

-- CreateIndex
CREATE INDEX "Account_role_idx" ON "Account"("role");

-- CreateIndex
CREATE INDEX "Device_accountId_idx" ON "Device"("accountId");

-- CreateIndex
CREATE INDEX "CompetitionJudgeAssignment_competitionId_idx" ON "CompetitionJudgeAssignment"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionJudgeAssignment_competitionId_judgeId_key" ON "CompetitionJudgeAssignment"("competitionId", "judgeId");

-- CreateIndex
CREATE INDEX "RoundParticipation_roundId_idx" ON "RoundParticipation"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundParticipation_roundId_participantId_key" ON "RoundParticipation"("roundId", "participantId");

-- CreateIndex
CREATE INDEX "Attempt_roundParticipationId_idx" ON "Attempt"("roundParticipationId");

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "IndividualRoundResult_roundId_idx" ON "IndividualRoundResult"("roundId");

-- CreateIndex
CREATE INDEX "TeamRoundResult_roundId_idx" ON "TeamRoundResult"("roundId");

-- CreateIndex
CREATE INDEX "ScoreCorrection_competitionId_idx" ON "ScoreCorrection"("competitionId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_competitionId_idx" ON "RankingSnapshot"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringConfiguration_competitionId_key" ON "ScoringConfiguration"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRotationState_roundId_teamId_key" ON "TeamRotationState"("roundId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionRuntimeState_competitionId_key" ON "CompetitionRuntimeState"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "BigScreenDisplayState_competitionId_key" ON "BigScreenDisplayState"("competitionId");

-- CreateIndex
CREATE INDEX "StoredFile_competitionId_idx" ON "StoredFile"("competitionId");

-- CreateIndex
CREATE INDEX "PurgeSchedule_competitionId_idx" ON "PurgeSchedule"("competitionId");

-- CreateIndex
CREATE INDEX "AuditLog_competitionId_idx" ON "AuditLog"("competitionId");

-- AddForeignKey
ALTER TABLE "CompetitionCategory" ADD CONSTRAINT "CompetitionCategory_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundSettings" ADD CONSTRAINT "RoundSettings_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionJudgeAssignment" ADD CONSTRAINT "CompetitionJudgeAssignment_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionJudgeAssignment" ADD CONSTRAINT "CompetitionJudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionJudgeAssignment" ADD CONSTRAINT "CompetitionJudgeAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipation" ADD CONSTRAINT "RoundParticipation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipation" ADD CONSTRAINT "RoundParticipation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipation" ADD CONSTRAINT "RoundParticipation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_roundParticipationId_fkey" FOREIGN KEY ("roundParticipationId") REFERENCES "RoundParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualRoundResult" ADD CONSTRAINT "IndividualRoundResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualRoundResult" ADD CONSTRAINT "IndividualRoundResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualRoundResult" ADD CONSTRAINT "IndividualRoundResult_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualRoundResult" ADD CONSTRAINT "IndividualRoundResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRoundResult" ADD CONSTRAINT "TeamRoundResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRoundResult" ADD CONSTRAINT "TeamRoundResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRoundResult" ADD CONSTRAINT "TeamRoundResult_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreCorrection" ADD CONSTRAINT "ScoreCorrection_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreCorrection" ADD CONSTRAINT "ScoreCorrection_correctedByAccountId_fkey" FOREIGN KEY ("correctedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringConfiguration" ADD CONSTRAINT "ScoringConfiguration_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRotationState" ADD CONSTRAINT "TeamRotationState_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRotationState" ADD CONSTRAINT "TeamRotationState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionRuntimeState" ADD CONSTRAINT "CompetitionRuntimeState_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BigScreenDisplayState" ADD CONSTRAINT "BigScreenDisplayState_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedByAccountId_fkey" FOREIGN KEY ("uploadedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurgeSchedule" ADD CONSTRAINT "PurgeSchedule_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

