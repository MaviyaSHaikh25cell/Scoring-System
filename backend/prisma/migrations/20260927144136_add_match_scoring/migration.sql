-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('POINTS', 'UNANIMOUS_DECISION', 'SPLIT_DECISION', 'MAJORITY_DECISION', 'KO', 'TKO', 'DISQUALIFICATION', 'RETIREMENT', 'DRAW', 'NO_CONTEST');

-- AlterTable
ALTER TABLE "RoundScore" ADD COLUMN     "blueFouls" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "blueKnockdowns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "blueWarnings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "redFouls" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "redKnockdowns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "redWarnings" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "data" JSONB;

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "winnerId" TEXT,
    "loserId" TEXT,
    "redTotalScore" INTEGER NOT NULL,
    "blueTotalScore" INTEGER NOT NULL,
    "decision" "DecisionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedMatchHistory" (
    "id" TEXT NOT NULL,
    "sourceMatchId" TEXT NOT NULL,
    "redBoxer" TEXT NOT NULL,
    "blueBoxer" TEXT NOT NULL,
    "winner" TEXT,
    "loser" TEXT,
    "redScore" INTEGER NOT NULL,
    "blueScore" INTEGER NOT NULL,
    "weightCategory" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchDate" TEXT NOT NULL,
    "matchTime" TEXT NOT NULL,
    "tournamentId" TEXT,
    "tournamentMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompletedMatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_matchId_key" ON "MatchResult"("matchId");

-- CreateIndex
CREATE INDEX "MatchResult_winnerId_idx" ON "MatchResult"("winnerId");

-- CreateIndex
CREATE INDEX "MatchResult_loserId_idx" ON "MatchResult"("loserId");

-- CreateIndex
CREATE INDEX "MatchResult_decision_idx" ON "MatchResult"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "CompletedMatchHistory_sourceMatchId_key" ON "CompletedMatchHistory"("sourceMatchId");

-- CreateIndex
CREATE INDEX "CompletedMatchHistory_createdAt_idx" ON "CompletedMatchHistory"("createdAt");

-- CreateIndex
CREATE INDEX "CompletedMatchHistory_tournamentId_idx" ON "CompletedMatchHistory"("tournamentId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
