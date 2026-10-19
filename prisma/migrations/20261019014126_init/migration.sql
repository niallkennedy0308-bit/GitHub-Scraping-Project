-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScrapingConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "githubSearchUrl" TEXT NOT NULL,
    "searchQuery" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ruleSetId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScrapingConfiguration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScrapingConfiguration_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ScamRuleSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScamRuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupLogic" TEXT NOT NULL DEFAULT 'AND',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScamDetectionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,
    "valueTo" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "action" TEXT NOT NULL DEFAULT 'flag',
    "scoreWeight" INTEGER NOT NULL DEFAULT 10,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScamDetectionRule_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ScamRuleSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configurationId" TEXT NOT NULL,
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
    CONSTRAINT "ScrapingJob_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ScrapingConfiguration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScrapingJob_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GitHubUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "nodeId" TEXT,
    "avatarUrl" TEXT,
    "gravatarId" TEXT,
    "url" TEXT,
    "htmlUrl" TEXT,
    "type" TEXT,
    "userViewType" TEXT,
    "siteAdmin" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "company" TEXT,
    "blog" TEXT,
    "location" TEXT,
    "email" TEXT,
    "hireable" BOOLEAN,
    "bio" TEXT,
    "twitterUsername" TEXT,
    "publicRepos" INTEGER NOT NULL DEFAULT 0,
    "publicGists" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "githubCreatedAt" DATETIME,
    "githubUpdatedAt" DATETIME,
    "rawProfile" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "matchedRuleIds" TEXT NOT NULL DEFAULT '[]',
    "validationReasons" TEXT NOT NULL DEFAULT '[]',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "firstScrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScrapingJobId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GitHubUser_lastScrapingJobId_fkey" FOREIGN KEY ("lastScrapingJobId") REFERENCES "ScrapingJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapingJobUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapingJobUser_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScrapingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScrapingJobUser_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GitHubUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserValidationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubUserId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "riskScore" INTEGER,
    "matchedRuleIds" TEXT,
    "reasons" TEXT,
    "note" TEXT,
    "reviewedById" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserValidationHistory_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "GitHubUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserValidationHistory_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapingJobError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapingJobError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScrapingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubUser_githubId_key" ON "GitHubUser"("githubId");

-- CreateIndex
CREATE INDEX "GitHubUser_login_idx" ON "GitHubUser"("login");

-- CreateIndex
CREATE INDEX "GitHubUser_validationStatus_idx" ON "GitHubUser"("validationStatus");

-- CreateIndex
CREATE INDEX "GitHubUser_riskScore_idx" ON "GitHubUser"("riskScore");

-- CreateIndex
CREATE INDEX "GitHubUser_followers_idx" ON "GitHubUser"("followers");

-- CreateIndex
CREATE INDEX "GitHubUser_publicRepos_idx" ON "GitHubUser"("publicRepos");

-- CreateIndex
CREATE INDEX "GitHubUser_githubCreatedAt_idx" ON "GitHubUser"("githubCreatedAt");

-- CreateIndex
CREATE INDEX "GitHubUser_firstScrapedAt_idx" ON "GitHubUser"("firstScrapedAt");

-- CreateIndex
CREATE INDEX "GitHubUser_lastScrapedAt_idx" ON "GitHubUser"("lastScrapedAt");

-- CreateIndex
CREATE INDEX "GitHubUser_company_idx" ON "GitHubUser"("company");

-- CreateIndex
CREATE INDEX "GitHubUser_location_idx" ON "GitHubUser"("location");

-- CreateIndex
CREATE INDEX "GitHubUser_deletedAt_idx" ON "GitHubUser"("deletedAt");

-- CreateIndex
CREATE INDEX "ScrapingJobUser_jobId_idx" ON "ScrapingJobUser"("jobId");

-- CreateIndex
CREATE INDEX "ScrapingJobUser_githubUserId_idx" ON "ScrapingJobUser"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingJobUser_jobId_githubUserId_key" ON "ScrapingJobUser"("jobId", "githubUserId");

-- CreateIndex
CREATE INDEX "UserValidationHistory_githubUserId_idx" ON "UserValidationHistory"("githubUserId");

-- CreateIndex
CREATE INDEX "ScrapingJobError_jobId_idx" ON "ScrapingJobError"("jobId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
