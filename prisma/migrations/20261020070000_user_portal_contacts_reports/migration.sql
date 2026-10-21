-- CreateEnum
-- SQLite stores enums as TEXT; Prisma maps ScamReportStatus in the client.

-- CreateTable
CREATE TABLE "UserGithubContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserGithubContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGithubContact_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GitHubUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScamReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubUserId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScamReport_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GitHubUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScamReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScamReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGithubContact_userId_githubUserId_key" ON "UserGithubContact"("userId", "githubUserId");

-- CreateIndex
CREATE INDEX "UserGithubContact_userId_idx" ON "UserGithubContact"("userId");

-- CreateIndex
CREATE INDEX "UserGithubContact_githubUserId_idx" ON "UserGithubContact"("githubUserId");

-- CreateIndex
CREATE INDEX "UserGithubContact_createdAt_idx" ON "UserGithubContact"("createdAt");

-- CreateIndex
CREATE INDEX "ScamReport_githubUserId_idx" ON "ScamReport"("githubUserId");

-- CreateIndex
CREATE INDEX "ScamReport_reporterUserId_idx" ON "ScamReport"("reporterUserId");

-- CreateIndex
CREATE INDEX "ScamReport_status_idx" ON "ScamReport"("status");

-- CreateIndex
CREATE INDEX "ScamReport_createdAt_idx" ON "ScamReport"("createdAt");

-- CreateIndex
CREATE INDEX "ScamReport_reason_idx" ON "ScamReport"("reason");
