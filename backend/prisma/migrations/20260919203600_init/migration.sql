-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'JUDGE', 'BOXER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BoxerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "JudgeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Corner" AS ENUM ('RED', 'BLUE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boxer" (
    "id" TEXT NOT NULL,
    "boxerId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "club" TEXT NOT NULL,
    "coach" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "status" "BoxerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boxer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "JudgeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "venue" TEXT,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentBoxer" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "boxerId" TEXT NOT NULL,

    CONSTRAINT "TournamentBoxer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "redBoxerId" TEXT NOT NULL,
    "blueBoxerId" TEXT NOT NULL,
    "weightCategory" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "matchType" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'UPCOMING',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "winnerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchJudge" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,

    CONSTRAINT "MatchJudge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundScore" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "redScore" INTEGER NOT NULL,
    "blueScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Boxer_boxerId_key" ON "Boxer"("boxerId");

-- CreateIndex
CREATE UNIQUE INDEX "Boxer_userId_key" ON "Boxer"("userId");

-- CreateIndex
CREATE INDEX "Boxer_name_idx" ON "Boxer"("name");

-- CreateIndex
CREATE INDEX "Boxer_status_idx" ON "Boxer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_judgeId_key" ON "Judge"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_userId_key" ON "Judge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_email_key" ON "Judge"("email");

-- CreateIndex
CREATE INDEX "Judge_status_idx" ON "Judge"("status");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_date_idx" ON "Tournament"("date");

-- CreateIndex
CREATE INDEX "TournamentBoxer_boxerId_idx" ON "TournamentBoxer"("boxerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentBoxer_tournamentId_boxerId_key" ON "TournamentBoxer"("tournamentId", "boxerId");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_redBoxerId_idx" ON "Match"("redBoxerId");

-- CreateIndex
CREATE INDEX "Match_blueBoxerId_idx" ON "Match"("blueBoxerId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "MatchJudge_judgeId_idx" ON "MatchJudge"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchJudge_matchId_judgeId_key" ON "MatchJudge"("matchId", "judgeId");

-- CreateIndex
CREATE INDEX "RoundScore_judgeId_idx" ON "RoundScore"("judgeId");

-- CreateIndex
CREATE INDEX "RoundScore_matchId_roundNumber_idx" ON "RoundScore"("matchId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RoundScore_matchId_judgeId_roundNumber_key" ON "RoundScore"("matchId", "judgeId", "roundNumber");

-- AddForeignKey
ALTER TABLE "Boxer" ADD CONSTRAINT "Boxer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentBoxer" ADD CONSTRAINT "TournamentBoxer_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentBoxer" ADD CONSTRAINT "TournamentBoxer_boxerId_fkey" FOREIGN KEY ("boxerId") REFERENCES "Boxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_redBoxerId_fkey" FOREIGN KEY ("redBoxerId") REFERENCES "Boxer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_blueBoxerId_fkey" FOREIGN KEY ("blueBoxerId") REFERENCES "Boxer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchJudge" ADD CONSTRAINT "MatchJudge_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchJudge" ADD CONSTRAINT "MatchJudge_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundScore" ADD CONSTRAINT "RoundScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundScore" ADD CONSTRAINT "RoundScore_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
