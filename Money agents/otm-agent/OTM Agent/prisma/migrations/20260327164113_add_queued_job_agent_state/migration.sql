-- CreateTable
CREATE TABLE "QueuedJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "src" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "amt" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreFactors" TEXT NOT NULL DEFAULT '{}',
    "riskLevel" TEXT,
    "trend" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "agent" TEXT,
    "result" TEXT,
    "earnedUsd" REAL NOT NULL DEFAULT 0,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AgentState" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "currentJobId" TEXT,
    "jobsSince" INTEGER NOT NULL DEFAULT 0,
    "earnedTotal" REAL NOT NULL DEFAULT 0,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
