-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScrapingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configurationId" TEXT,
    "githubSearchUrl" TEXT NOT NULL,
    "searchQuery" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "profilesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "duplicateUsers" INTEGER NOT NULL DEFAULT 0,
    "excludedUsers" INTEGER NOT NULL DEFAULT 0,
    "flaggedUsers" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "startedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScrapingJob_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ScrapingConfiguration" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScrapingJob_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScrapingJob" ("cancelRequested", "completedAt", "configurationId", "createdAt", "duplicateUsers", "errorCount", "excludedUsers", "flaggedUsers", "githubSearchUrl", "id", "newUsers", "profilesDiscovered", "progressMessage", "searchQuery", "startedAt", "startedById", "status", "updatedAt") SELECT "cancelRequested", "completedAt", "configurationId", "createdAt", "duplicateUsers", "errorCount", "excludedUsers", "flaggedUsers", "githubSearchUrl", "id", "newUsers", "profilesDiscovered", "progressMessage", "searchQuery", "startedAt", "startedById", "status", "updatedAt" FROM "ScrapingJob";
DROP TABLE "ScrapingJob";
ALTER TABLE "new_ScrapingJob" RENAME TO "ScrapingJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingConfiguration_githubSearchUrl_key" ON "ScrapingConfiguration"("githubSearchUrl");
