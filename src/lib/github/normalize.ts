import type { GitHubUserProfile } from "@/lib/github/client";

export type NormalizedGitHubUser = {
  githubId: number;
  login: string;
  nodeId: string | null;
  avatarUrl: string | null;
  gravatarId: string | null;
  url: string | null;
  htmlUrl: string | null;
  type: string | null;
  userViewType: string | null;
  siteAdmin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitterUsername: string | null;
  publicRepos: number;
  publicGists: number;
  followers: number;
  following: number;
  githubCreatedAt: Date | null;
  githubUpdatedAt: Date | null;
  rawProfile: string;
  profileForRules: Record<string, unknown>;
};

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length ? s : null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeGitHubProfile(profile: GitHubUserProfile): NormalizedGitHubUser {
  if (!profile?.id || !profile?.login) {
    throw new Error("Invalid GitHub profile: missing id or login");
  }

  return {
    githubId: Number(profile.id),
    login: String(profile.login),
    nodeId: nullableString(profile.node_id),
    avatarUrl: nullableString(profile.avatar_url),
    gravatarId: nullableString(profile.gravatar_id),
    url: nullableString(profile.url),
    htmlUrl: nullableString(profile.html_url),
    type: nullableString(profile.type),
    userViewType: nullableString(profile.user_view_type),
    siteAdmin: Boolean(profile.site_admin),
    name: nullableString(profile.name),
    company: nullableString(profile.company),
    blog: nullableString(profile.blog),
    location: nullableString(profile.location),
    email: nullableString(profile.email),
    hireable:
      profile.hireable === null || profile.hireable === undefined
        ? null
        : Boolean(profile.hireable),
    bio: nullableString(profile.bio),
    twitterUsername: nullableString(profile.twitter_username),
    publicRepos: Number(profile.public_repos ?? 0),
    publicGists: Number(profile.public_gists ?? 0),
    followers: Number(profile.followers ?? 0),
    following: Number(profile.following ?? 0),
    githubCreatedAt: parseDate(profile.created_at),
    githubUpdatedAt: parseDate(profile.updated_at),
    rawProfile: JSON.stringify(profile),
    profileForRules: {
      login: profile.login,
      id: profile.id,
      name: profile.name,
      company: profile.company,
      blog: profile.blog,
      location: profile.location,
      email: profile.email,
      hireable: profile.hireable,
      bio: profile.bio,
      twitter_username: profile.twitter_username,
      public_repos: profile.public_repos ?? 0,
      public_gists: profile.public_gists ?? 0,
      followers: profile.followers ?? 0,
      following: profile.following ?? 0,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      type: profile.type,
      site_admin: profile.site_admin ?? false,
    },
  };
}
