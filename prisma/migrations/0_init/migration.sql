-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RSS',
    "category" TEXT NOT NULL DEFAULT 'general',
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 5,
    "extractFullArticle" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'Sachlich, klar, journalistisch',
    "instructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "authorId" TEXT,
    "originalUrl" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "originalContent" TEXT,
    "generatedTitle" TEXT,
    "generatedExcerpt" TEXT,
    "generatedContent" TEXT,
    "seoTitle" TEXT,
    "keywords" TEXT,
    "researchNotes" TEXT,
    "citations" TEXT,
    "qualityScore" INTEGER,
    "scoreBreakdown" TEXT,
    "titleEmbedding" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AuthorProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "mode" TEXT NOT NULL DEFAULT 'publish',
    "topic" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "currentStep" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RadarQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "score" INTEGER,
    "scoreReason" TEXT,
    "authorId" TEXT,
    "authorReason" TEXT,
    "articleId" TEXT,
    "skipReason" TEXT,
    "failReason" TEXT,
    "jobRunId" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoredAt" DATETIME,
    "assignedAt" DATETIME,
    "writtenAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RadarQueueItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RadarQueueItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AuthorProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RadarQueueItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RadarQueueItem_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "JobRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RadarSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scanIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "dailyArticleLimit" INTEGER NOT NULL DEFAULT 20,
    "publishDirectly" BOOLEAN NOT NULL DEFAULT false,
    "minScore" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobRunId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobEvent_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "JobRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsletterConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Newsletter',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cadence" TEXT NOT NULL DEFAULT 'WEEKLY',
    "sendHour" TEXT NOT NULL DEFAULT '08:00',
    "recipients" TEXT NOT NULL DEFAULT '',
    "subjectTemplate" TEXT NOT NULL DEFAULT 'Deine Top-Artikel',
    "topN" INTEGER NOT NULL DEFAULT 5,
    "lastSentAt" DATETIME,
    "nextSendAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NewsletterSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "articleIds" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsletterSend_configId_fkey" FOREIGN KEY ("configId") REFERENCES "NewsletterConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchTopicSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "preset" TEXT NOT NULL,
    "focusThemes" TEXT NOT NULL,
    "primaryDomain" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAI" BOOLEAN NOT NULL DEFAULT false,
    "aiDurationMs" INTEGER,
    "aiIncluded" INTEGER NOT NULL DEFAULT 0,
    "aiRejected" INTEGER NOT NULL DEFAULT 0,
    "aiError" TEXT,
    "fallbackReason" TEXT,
    "inputTopics" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "FilmRadarSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalVdf" INTEGER NOT NULL,
    "totalMissing" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseURL" TEXT NOT NULL,
    "apiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ModelSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryProviderId" TEXT,
    "primaryModel" TEXT,
    "embeddingProviderId" TEXT,
    "embeddingModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModelSettings_primaryProviderId_fkey" FOREIGN KEY ("primaryProviderId") REFERENCES "LlmProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModelSettings_embeddingProviderId_fkey" FOREIGN KEY ("embeddingProviderId") REFERENCES "LlmProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_originalUrl_key" ON "Article"("originalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RadarQueueItem_originalUrl_key" ON "RadarQueueItem"("originalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RadarQueueItem_articleId_key" ON "RadarQueueItem"("articleId");

-- CreateIndex
CREATE INDEX "RadarQueueItem_status_idx" ON "RadarQueueItem"("status");

-- CreateIndex
CREATE INDEX "RadarQueueItem_discoveredAt_idx" ON "RadarQueueItem"("discoveredAt");

-- CreateIndex
CREATE INDEX "ResearchTopicSnapshot_preset_focusThemes_generatedAt_idx" ON "ResearchTopicSnapshot"("preset", "focusThemes", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_key_key" ON "PromptTemplate"("key");

