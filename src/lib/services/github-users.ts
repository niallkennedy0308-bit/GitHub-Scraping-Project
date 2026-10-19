import { prisma } from "@/lib/db";
import type { NormalizedGitHubUser } from "@/lib/github/normalize";
import type { ValidationDecision } from "@/lib/scam-rules/types";
import { toJsonArray } from "@/lib/utils";
import type { ValidationStatus } from "@prisma/client";

export type ProcessOutcome = "new" | "duplicate" | "excluded" | "flagged" | "error";

const MANUAL_STATUSES: ValidationStatus[] = ["legitimate", "confirmed_scam"];

export async function processDiscoveredUser(input: {
  jobId: string;
  user: NormalizedGitHubUser;
  decision: ValidationDecision;
}): Promise<ProcessOutcome> {
  const { jobId, user, decision } = input;

  if (decision.excluded) {
    return "excluded";
  }

  const existing = await prisma.gitHubUser.findUnique({
    where: { githubId: user.githubId },
  });

  if (existing) {
    const preserveManual =
      existing.reviewedAt != null || MANUAL_STATUSES.includes(existing.validationStatus);

    await prisma.gitHubUser.update({
      where: { id: existing.id },
      data: {
        login: user.login,
        nodeId: user.nodeId,
        avatarUrl: user.avatarUrl,
        gravatarId: user.gravatarId,
        url: user.url,
        htmlUrl: user.htmlUrl,
        type: user.type,
        userViewType: user.userViewType,
        siteAdmin: user.siteAdmin,
        name: user.name,
        company: user.company,
        blog: user.blog,
        location: user.location,
        // Keep manually supplied contact fields when GitHub still omits them.
        email: user.email || existing.email,
        linkedinUrl: existing.linkedinUrl,
        hireable: user.hireable,
        bio: user.bio,
        twitterUsername: user.twitterUsername,
        publicRepos: user.publicRepos,
        publicGists: user.publicGists,
        followers: user.followers,
        following: user.following,
        githubCreatedAt: user.githubCreatedAt,
        githubUpdatedAt: user.githubUpdatedAt,
        rawProfile: user.rawProfile,
        lastScrapedAt: new Date(),
        lastScrapingJobId: jobId,
        // Preserve manual review; refresh automated signals only when not manually decided
        ...(preserveManual
          ? {}
          : {
              validationStatus: decision.status,
              riskScore: decision.riskScore,
              matchedRuleIds: toJsonArray(decision.matchedRuleIds),
              validationReasons: toJsonArray(decision.reasons),
            }),
      },
    });

    await prisma.scrapingJobUser.upsert({
      where: {
        jobId_githubUserId: { jobId, githubUserId: existing.id },
      },
      create: {
        jobId,
        githubUserId: existing.id,
        outcome: "duplicate",
      },
      update: { outcome: "duplicate" },
    });

    return "duplicate";
  }

  const created = await prisma.gitHubUser.create({
    data: {
      githubId: user.githubId,
      login: user.login,
      nodeId: user.nodeId,
      avatarUrl: user.avatarUrl,
      gravatarId: user.gravatarId,
      url: user.url,
      htmlUrl: user.htmlUrl,
      type: user.type,
      userViewType: user.userViewType,
      siteAdmin: user.siteAdmin,
      name: user.name,
      company: user.company,
      blog: user.blog,
      location: user.location,
      email: user.email,
      hireable: user.hireable,
      bio: user.bio,
      twitterUsername: user.twitterUsername,
      publicRepos: user.publicRepos,
      publicGists: user.publicGists,
      followers: user.followers,
      following: user.following,
      githubCreatedAt: user.githubCreatedAt,
      githubUpdatedAt: user.githubUpdatedAt,
      rawProfile: user.rawProfile,
      validationStatus: decision.status,
      riskScore: decision.riskScore,
      matchedRuleIds: toJsonArray(decision.matchedRuleIds),
      validationReasons: toJsonArray(decision.reasons),
      firstScrapedAt: new Date(),
      lastScrapedAt: new Date(),
      lastScrapingJobId: jobId,
    },
  });

  await prisma.userValidationHistory.create({
    data: {
      githubUserId: created.id,
      previousStatus: null,
      newStatus: decision.status,
      riskScore: decision.riskScore,
      matchedRuleIds: toJsonArray(decision.matchedRuleIds),
      reasons: toJsonArray(decision.reasons),
      source: "automatic",
    },
  });

  await prisma.scrapingJobUser.create({
    data: {
      jobId,
      githubUserId: created.id,
      outcome: decision.flagged ? "flagged" : "new",
    },
  });

  return decision.flagged ? "flagged" : "new";
}
