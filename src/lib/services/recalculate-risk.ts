import { prisma } from "@/lib/db";
import { RULE_SCORE_WEIGHTS } from "@/lib/scam-rules/simple-form";
import { evaluateRules } from "@/lib/scam-rules/evaluate";
import { toEvaluableRules } from "@/lib/services/validation";
import { toJsonArray } from "@/lib/utils";
/** Align stored rule weights with the calibrated missing-signal hierarchy. */
export async function syncRuleScoreWeights(): Promise<number> {
  const rules = await prisma.scamDetectionRule.findMany({
    select: { id: true, field: true },
  });

  let updated = 0;
  for (const rule of rules) {
    let scoreWeight: number | null = null;
    let severity: "high" | "medium" | "low" | "info" | null = null;

    if (rule.field === "has_linkedin") {
      scoreWeight = RULE_SCORE_WEIGHTS.missingLinkedIn;
      severity = "high";
    } else if (rule.field === "email") {
      scoreWeight = RULE_SCORE_WEIGHTS.missingEmail;
      severity = "high";
    } else if (
      rule.field === "has_social_links" ||
      rule.field === "location" ||
      rule.field === "created_at" ||
      rule.field === "public_repos" ||
      rule.field === "company"
    ) {
      scoreWeight = RULE_SCORE_WEIGHTS.baseSignal;
    }

    if (scoreWeight == null) continue;

    await prisma.scamDetectionRule.update({
      where: { id: rule.id },
      data: {
        scoreWeight,
        ...(severity ? { severity } : {}),
      },
    });
    updated += 1;
  }

  return updated;
}

function profileFromStoredUser(user: {
  login: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  linkedinUrl: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitterUsername: string | null;
  profileReadme?: string | null;
  publicRepos: number;
  publicGists: number;
  followers: number;
  following: number;
  githubCreatedAt: Date | null;
  githubUpdatedAt: Date | null;
  type: string | null;
  siteAdmin: boolean;
}): Record<string, unknown> {
  return {
    login: user.login,
    name: user.name,
    company: user.company,
    blog: user.blog,
    location: user.location,
    email: user.email,
    linkedin_url: user.linkedinUrl,
    linkedinUrl: user.linkedinUrl,
    hireable: user.hireable,
    bio: user.bio,
    twitter_username: user.twitterUsername,
    profile_readme: user.profileReadme ?? null,
    public_repos: user.publicRepos,
    public_gists: user.publicGists,
    followers: user.followers,
    following: user.following,
    created_at: user.githubCreatedAt?.toISOString() ?? null,
    updated_at: user.githubUpdatedAt?.toISOString() ?? null,
    type: user.type,
    site_admin: user.siteAdmin,
  };
}

/**
 * Re-score stored GitHub users from the rule set on their last scraping job
 * (falls back to the first enabled rule set). Manual reviews are left unchanged.
 */
export async function recalculateAllRiskScores(): Promise<{
  scanned: number;
  updated: number;
  skippedManual: number;
}> {
  const fallbackRuleSet = await prisma.scamRuleSet.findFirst({
    where: { enabled: true },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  const allUsers = await prisma.gitHubUser.findMany({
    where: { deletedAt: null },
  });

  let updated = 0;
  let skippedManual = 0;

  for (const user of allUsers) {
    // Keep admin overrides; automatic risk→status mapping may update the rest.
    if (user.reviewedAt != null) {
      skippedManual += 1;
      continue;
    }

    let ruleSet = fallbackRuleSet;
    if (user.lastScrapingJobId) {
      const job = await prisma.scrapingJob.findUnique({
        where: { id: user.lastScrapingJobId },
        include: {
          configuration: {
            include: {
              ruleSet: { include: { rules: { orderBy: { sortOrder: "asc" } } } },
            },
          },
        },
      });
      if (job?.configuration?.ruleSet) {
        ruleSet = job.configuration.ruleSet;
      }
    }

    if (!ruleSet || !ruleSet.enabled) continue;

    const decision = evaluateRules(
      profileFromStoredUser(user),
      toEvaluableRules(ruleSet.rules),
      ruleSet.groupLogic,
    );

    await prisma.gitHubUser.update({
      where: { id: user.id },
      data: {
        validationStatus: decision.status,
        riskScore: decision.riskScore,
        matchedRuleIds: toJsonArray(decision.matchedRuleIds),
        validationReasons: toJsonArray(decision.reasons),
      },
    });
    updated += 1;
  }

  return { scanned: allUsers.length, updated, skippedManual };
}
