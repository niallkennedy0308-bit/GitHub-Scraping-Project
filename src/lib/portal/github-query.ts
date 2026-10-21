import { Prisma } from "@prisma/client";
import { PORTAL_VISIBLE_STATUSES } from "@/lib/portal/constants";

const SORTABLE = new Set([
  "login",
  "followers",
  "publicRepos",
  "githubCreatedAt",
  "lastScrapedAt",
  "name",
]);

export function parsePortalGithubListParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const q = (searchParams.get("q") || "").trim();
  const company = (searchParams.get("company") || "").trim();
  const location = (searchParams.get("location") || "").trim();
  const hireable = searchParams.get("hireable");
  const minFollowers = searchParams.get("minFollowers");
  const maxFollowers = searchParams.get("maxFollowers");
  const minRepos = searchParams.get("minRepos");
  const maxRepos = searchParams.get("maxRepos");
  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  const sort = searchParams.get("sort") || "followers";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const includeConfirmedScam = searchParams.get("includeConfirmedScam") === "true";

  return {
    page,
    pageSize,
    q,
    company,
    location,
    hireable,
    minFollowers,
    maxFollowers,
    minRepos,
    maxRepos,
    createdFrom,
    createdTo,
    sort: SORTABLE.has(sort) ? sort : "followers",
    order: order as "asc" | "desc",
    includeConfirmedScam,
  };
}

export function buildPortalGithubWhere(
  params: ReturnType<typeof parsePortalGithubListParams>,
  opts?: { contactsOnlyUserId?: string },
): Prisma.GitHubUserWhereInput {
  const where: Prisma.GitHubUserWhereInput = {
    deletedAt: null,
  };

  if (!params.includeConfirmedScam) {
    where.validationStatus = { in: [...PORTAL_VISIBLE_STATUSES] };
  }

  if (opts?.contactsOnlyUserId) {
    where.savedByUsers = { some: { userId: opts.contactsOnlyUserId } };
  }

  if (params.q) {
    where.OR = [
      { login: { contains: params.q } },
      { name: { contains: params.q } },
      { bio: { contains: params.q } },
      { company: { contains: params.q } },
      { location: { contains: params.q } },
    ];
  }
  if (params.company) where.company = { contains: params.company };
  if (params.location) where.location = { contains: params.location };
  if (params.hireable === "true") where.hireable = true;
  if (params.hireable === "false") where.hireable = false;

  if (params.minFollowers || params.maxFollowers) {
    where.followers = {};
    if (params.minFollowers) where.followers.gte = Number(params.minFollowers);
    if (params.maxFollowers) where.followers.lte = Number(params.maxFollowers);
  }
  if (params.minRepos || params.maxRepos) {
    where.publicRepos = {};
    if (params.minRepos) where.publicRepos.gte = Number(params.minRepos);
    if (params.maxRepos) where.publicRepos.lte = Number(params.maxRepos);
  }
  if (params.createdFrom || params.createdTo) {
    where.githubCreatedAt = {};
    if (params.createdFrom) where.githubCreatedAt.gte = new Date(params.createdFrom);
    if (params.createdTo) where.githubCreatedAt.lte = new Date(params.createdTo);
  }

  return where;
}

export const portalGithubSelect = {
  id: true,
  githubId: true,
  login: true,
  name: true,
  avatarUrl: true,
  htmlUrl: true,
  bio: true,
  company: true,
  location: true,
  email: true,
  linkedinUrl: true,
  blog: true,
  twitterUsername: true,
  hireable: true,
  publicRepos: true,
  publicGists: true,
  followers: true,
  following: true,
  githubCreatedAt: true,
  lastScrapedAt: true,
  validationStatus: true,
  riskScore: true,
} satisfies Prisma.GitHubUserSelect;
