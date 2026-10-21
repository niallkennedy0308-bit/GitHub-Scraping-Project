import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
    const q = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status");
    const company = searchParams.get("company");
    const location = searchParams.get("location");
    const jobId = searchParams.get("jobId");
    const ruleId = searchParams.get("ruleId");
    const minRisk = searchParams.get("minRisk");
    const maxRisk = searchParams.get("maxRisk");
    const minFollowers = searchParams.get("minFollowers");
    const maxFollowers = searchParams.get("maxFollowers");
    const minRepos = searchParams.get("minRepos");
    const maxRepos = searchParams.get("maxRepos");
    const createdFrom = searchParams.get("createdFrom");
    const createdTo = searchParams.get("createdTo");
    const scrapedFrom = searchParams.get("scrapedFrom");
    const scrapedTo = searchParams.get("scrapedTo");
    const sort = searchParams.get("sort") || "lastScrapedAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const where: Prisma.GitHubUserWhereInput = {};
    if (!includeDeleted) where.deletedAt = null;

    // Status is derived from risk thresholds (and optional manual review).
    if (status) {
      where.validationStatus = status as Prisma.EnumValidationStatusFilter["equals"];
    }

    if (q) {
      where.OR = [
        { login: { contains: q } },
        { name: { contains: q } },
        { bio: { contains: q } },
        { company: { contains: q } },
      ];
    }
    if (company) where.company = { contains: company };
    if (location?.trim()) where.location = { contains: location.trim() };
    if (jobId) where.lastScrapingJobId = jobId;
    if (ruleId) where.matchedRuleIds = { contains: ruleId };

    if (minRisk || maxRisk) {
      where.riskScore = {};
      if (minRisk) where.riskScore.gte = Number(minRisk);
      if (maxRisk) where.riskScore.lte = Number(maxRisk);
    }
    if (minFollowers || maxFollowers) {
      where.followers = {};
      if (minFollowers) where.followers.gte = Number(minFollowers);
      if (maxFollowers) where.followers.lte = Number(maxFollowers);
    }
    if (minRepos || maxRepos) {
      where.publicRepos = {};
      if (minRepos) where.publicRepos.gte = Number(minRepos);
      if (maxRepos) where.publicRepos.lte = Number(maxRepos);
    }
    if (createdFrom || createdTo) {
      where.githubCreatedAt = {};
      if (createdFrom) where.githubCreatedAt.gte = new Date(createdFrom);
      if (createdTo) where.githubCreatedAt.lte = new Date(createdTo);
    }
    if (scrapedFrom || scrapedTo) {
      where.firstScrapedAt = {};
      if (scrapedFrom) where.firstScrapedAt.gte = new Date(scrapedFrom);
      if (scrapedTo) where.firstScrapedAt.lte = new Date(scrapedTo);
    }

    const sortable = new Set([
      "followers",
      "publicRepos",
      "githubCreatedAt",
      "riskScore",
      "lastScrapedAt",
      "firstScrapedAt",
      "login",
    ]);
    const sortField = sortable.has(sort) ? sort : "lastScrapedAt";

    const [total, items] = await Promise.all([
      prisma.gitHubUser.count({ where }),
      prisma.gitHubUser.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          githubId: true,
          login: true,
          name: true,
          avatarUrl: true,
          htmlUrl: true,
          bio: true,
          location: true,
          company: true,
          email: true,
          linkedinUrl: true,
          blog: true,
          publicRepos: true,
          followers: true,
          following: true,
          githubCreatedAt: true,
          riskScore: true,
          validationStatus: true,
          matchedRuleIds: true,
          validationReasons: true,
          firstScrapedAt: true,
          lastScrapedAt: true,
          lastScrapingJobId: true,
        },
      }),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return jsonError(error);
  }
}
