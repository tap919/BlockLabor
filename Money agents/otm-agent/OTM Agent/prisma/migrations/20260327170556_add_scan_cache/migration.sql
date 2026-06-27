-- CreateTable
CREATE TABLE "ScanCache" (
    "platform" TEXT NOT NULL PRIMARY KEY,
    "resultJson" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
