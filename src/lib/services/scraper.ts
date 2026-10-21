import { prisma } from "@/lib/db";
import {
  fetchProfileReadme,
  fetchRateLimit,
  fetchUserProfile,
  fetchUserSocialAccounts,
  searchUsersPage,
  withRetry,
} from "@/lib/github/client";
import { normalizeGitHubProfile } from "@/lib/github/normalize";
import { validateAndParseGitHubSearch } from "@/lib/github-url";
import { getAdminGitHubToken } from "@/lib/services/admin-token";
import { processDiscoveredUser } from "@/lib/services/github-users";
import { validateProfile } from "@/lib/services/validation";
import type { JobStatus } from "@prisma/client";

async function isCancelRequested(jobId: string): Promise<boolean> {
  const job = await prisma.scrapingJob.findUnique({
    where: { id: jobId },
    select: { cancelRequested: true, status: true },
  });
  return Boolean(job?.cancelRequested || job?.status === "cancelled");
}

async function bumpCounters(
  jobId: string,
  patch: {
    profilesDiscovered?: number;
    newUsers?: number;
    duplicateUsers?: number;
    excludedUsers?: number;
    flaggedUsers?: number;
    errorCount?: number;
    progressMessage?: string;
  },
) {
  const data: Record<string, unknown> = {};
  if (patch.progressMessage !== undefined) data.progressMessage = patch.progressMessage;
  if (patch.profilesDiscovered) data.profilesDiscovered = { increment: patch.profilesDiscovered };
  if (patch.newUsers) data.newUsers = { increment: patch.newUsers };
  if (patch.duplicateUsers) data.duplicateUsers = { increment: patch.duplicateUsers };
  if (patch.excludedUsers) data.excludedUsers = { increment: patch.excludedUsers };
  if (patch.flaggedUsers) data.flaggedUsers = { increment: patch.flaggedUsers };
  if (patch.errorCount) data.errorCount = { increment: patch.errorCount };

  await prisma.scrapingJob.update({ where: { id: jobId }, data });
}

async function recordError(jobId: string, message: string, details?: unknown) {
  await prisma.scrapingJobError.create({
    data: {
      jobId,
      message,
      details: details ? JSON.stringify(details) : null,
    },
  });
  await bumpCounters(jobId, { errorCount: 1 });
}

export async function runScrapingJob(jobId: string) {
  const job = await prisma.scrapingJob.findUnique({
    where: { id: jobId },
    include: {
      configuration: {
        include: {
          ruleSet: { include: { rules: true } },
        },
      },
      startedBy: { select: { id: true, email: true } },
    },
  });

  if (!job) return;
  if (job.status !== "queued" && job.status !== "running") return;

  await prisma.scrapingJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: job.startedAt ?? new Date(),
      progressMessage: "Starting scrape…",
    },
  });

  const token = await getAdminGitHubToken(job.startedById);
  if (!token) {
    await recordError(
      jobId,
      "No GitHub personal access token configured for the admin who started this job",
    );
    await finalizeJob(jobId, "failed", "Missing GitHub personal access token");
    return;
  }

  const pageSize = Number(process.env.SCRAPER_PAGE_SIZE || 30);
  const maxPages = Number(process.env.SCRAPER_MAX_PAGES || 10);

  try {
    const quota = await fetchRateLimit(token);
    const resetLabel = quota.coreReset
      ? new Date(quota.coreReset * 1000).toLocaleString()
      : "later";
    await bumpCounters(jobId, {
      progressMessage: `GitHub quota: ${quota.coreRemaining}/${quota.coreLimit} core remaining (resets ~${resetLabel})`,
    });

    if (!quota.authenticated) {
      await recordError(
        jobId,
        `GitHub is treating requests as unauthenticated (core limit ${quota.coreLimit}/hour). Re-save a valid classic PAT (ghp_…) or fine-grained token with public profile access in Settings.`,
      );
    }

    if (quota.coreRemaining < 10) {
      await recordError(
        jobId,
        `GitHub core rate limit nearly exhausted (${quota.coreRemaining}/${quota.coreLimit} left). Wait until ~${resetLabel} before scraping again.`,
      );
      await finalizeJob(
        jobId,
        "failed",
        `Rate limit exhausted — wait until ~${resetLabel}`,
      );
      return;
    }

    const parsed = validateAndParseGitHubSearch(job.githubSearchUrl);
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      if (await isCancelRequested(jobId)) {
        await finalizeJob(jobId, "cancelled", "Cancelled by admin");
        return;
      }

      await bumpCounters(jobId, {
        progressMessage: `Fetching search page ${page}…`,
      });

      const searchResult = await withRetry(
        () => searchUsersPage(parsed.apiSearchUrl, page, pageSize, token),
        {
          shouldCancel: () => isCancelRequested(jobId),
          onWait: (message) => bumpCounters(jobId, { progressMessage: message }),
        },
      );

      if (searchResult.items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of searchResult.items) {
        if (await isCancelRequested(jobId)) {
          await finalizeJob(jobId, "cancelled", "Cancelled by admin");
          return;
        }

        try {
          await bumpCounters(jobId, {
            profilesDiscovered: 1,
            progressMessage: `Processing @${item.login}…`,
          });

          const profile = await withRetry(() => fetchUserProfile(item.login, token), {
            shouldCancel: () => isCancelRequested(jobId),
            onWait: (message) =>
              bumpCounters(jobId, {
                progressMessage: `Waiting on GitHub for @${item.login}: ${message}`,
              }),
          });
          // LinkedIn lives on /users/{login}/social_accounts — not on the basic profile payload.
          const socialAccounts = await withRetry(
            () => fetchUserSocialAccounts(item.login, token),
            {
              shouldCancel: () => isCancelRequested(jobId),
              onWait: (message) =>
                bumpCounters(jobId, {
                  progressMessage: `Waiting on GitHub social links for @${item.login}: ${message}`,
                }),
            },
          );
          // Profile README (main column / red-box area) may contain email + LinkedIn.
          const profileReadme = await withRetry(
            () => fetchProfileReadme(item.login, token),
            {
              shouldCancel: () => isCancelRequested(jobId),
              onWait: (message) =>
                bumpCounters(jobId, {
                  progressMessage: `Waiting on GitHub README for @${item.login}: ${message}`,
                }),
            },
          );
          const normalized = normalizeGitHubProfile(profile, socialAccounts, profileReadme);
          const decision = validateProfile(normalized, job.configuration?.ruleSet);

          if (decision.errors.length) {
            await recordError(jobId, `Validation errors for @${item.login}`, decision.errors);
          }

          const outcome = await processDiscoveredUser({
            jobId,
            user: normalized,
            decision,
          });

          if (outcome === "new") await bumpCounters(jobId, { newUsers: 1 });
          if (outcome === "duplicate") await bumpCounters(jobId, { duplicateUsers: 1 });
          if (outcome === "excluded") await bumpCounters(jobId, { excludedUsers: 1 });
          if (outcome === "flagged") {
            await bumpCounters(jobId, { newUsers: 1, flaggedUsers: 1 });
          }
        } catch (error) {
          if (error instanceof Error && /cancelled/i.test(error.message)) {
            await finalizeJob(jobId, "cancelled", "Cancelled by admin");
            return;
          }
          const message =
            error instanceof Error ? error.message : `Failed processing @${item.login}`;
          await recordError(jobId, message);
        }
      }

      page += 1;
      hasMore = searchResult.items.length === pageSize && page <= maxPages;
      if (searchResult.incompleteResults) {
        await recordError(
          jobId,
          "GitHub reported incomplete search results (coverage limitation)",
        );
      }
    }

    const fresh = await prisma.scrapingJob.findUnique({ where: { id: jobId } });
    if (!fresh) return;
    if (fresh.cancelRequested) {
      await finalizeJob(jobId, "cancelled", "Cancelled by admin");
      return;
    }

    const status: JobStatus =
      fresh.errorCount > 0 ? "completed_with_errors" : "completed";
    await finalizeJob(jobId, status, "Scraping finished");
  } catch (error) {
    if (error instanceof Error && /cancelled/i.test(error.message)) {
      await finalizeJob(jobId, "cancelled", "Cancelled by admin");
      return;
    }
    const message = error instanceof Error ? error.message : "Scraping job failed";
    await recordError(jobId, message);
    await finalizeJob(jobId, "failed", message);
  }
}

async function finalizeJob(jobId: string, status: JobStatus, progressMessage: string) {
  await prisma.scrapingJob.update({
    where: { id: jobId },
    data: {
      status,
      completedAt: new Date(),
      progressMessage,
    },
  });
}

/**
 * Clear orphaned "running" jobs left behind when the worker process was restarted
 * mid-scrape (or after cancel was requested with no active runner).
 */
export async function recoverOrphanedJobs() {
  const now = new Date();

  // Cancelled while orphaned: finalize immediately so they stop blocking the queue.
  const cancelled = await prisma.scrapingJob.updateMany({
    where: { status: "running", cancelRequested: true },
    data: {
      status: "cancelled",
      completedAt: now,
      progressMessage: "Cancelled by admin",
    },
  });

  // Stale running jobs with no recent counter/progress updates (worker died).
  const staleMs = Number(process.env.SCRAPER_STALE_MS || 5 * 60 * 1000);
  const staleBefore = new Date(Date.now() - staleMs);
  const stalled = await prisma.scrapingJob.updateMany({
    where: {
      status: "running",
      cancelRequested: false,
      updatedAt: { lt: staleBefore },
    },
    data: {
      status: "failed",
      completedAt: now,
      progressMessage: "Job stalled after worker restart — start a new scrape to continue",
    },
  });

  return { cancelled: cancelled.count, stalled: stalled.count };
}

export async function claimNextQueuedJob(): Promise<string | null> {
  await recoverOrphanedJobs();

  const maxConcurrent = Number(process.env.SCRAPER_MAX_CONCURRENT_JOBS || 1);
  const running = await prisma.scrapingJob.count({ where: { status: "running" } });
  if (running >= maxConcurrent) return null;

  const next = await prisma.scrapingJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  return next?.id ?? null;
}
