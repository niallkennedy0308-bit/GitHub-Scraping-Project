import type { GitHubSocialAccount, GitHubUserProfile } from "@/lib/github/client";

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
  linkedinUrl: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitterUsername: string | null;
  profileReadme: string | null;
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

function cleanUrl(url: string): string {
  return url.replace(/[.,;:!?)\]}'"]+$/g, "");
}

/** Decode HTML entities commonly used in profile README badge markup. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'");
}

/** Extract a LinkedIn profile/company URL from free text / markdown / HTML badges. */
export function extractLinkedInFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const decoded = decodeHtmlEntities(text);

  // HTML badge buttons: <a href="https://www.linkedin.com/in/...">
  const anchor = decoded.match(
    /<a[^>]+href=["'](https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^"'\s]+)["']/i,
  );
  if (anchor?.[1]) return cleanUrl(anchor[1]);

  // shields.io / badge image query: ...&link=https://www.linkedin.com/in/...
  const badgeLink = decoded.match(
    /[?&]link=(https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^&"'>\s]+)/i,
  );
  if (badgeLink?.[1]) return cleanUrl(decodeURIComponent(badgeLink[1]));

  const markdown = decoded.match(
    /\[[^\]]*linkedin[^\]]*\]\((https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^)\s]+)\)/i,
  );
  if (markdown?.[1]) return cleanUrl(markdown[1]);

  const bare = decoded.match(
    /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:in|company|pub)\/[^\s"'<>)\]]+/i,
  );
  if (bare?.[0]) return cleanUrl(bare[0]);

  // GitHub sometimes shows the short "in/username" form in plain text
  const short = decoded.match(/\bin\/([a-zA-Z0-9_-]{2,100})\b/);
  if (short?.[1] && /linkedin/i.test(decoded)) {
    return `https://www.linkedin.com/in/${short[1]}`;
  }

  return null;
}

/** Extract a public email from free text / markdown (skips GitHub noreply). */
export function extractEmailFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const decoded = decodeHtmlEntities(text);

  const mailto = decoded.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailto?.[1] && !/noreply\.github\.com/i.test(mailto[1])) {
    return mailto[1];
  }

  const matches = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  for (const email of matches) {
    if (/noreply\.github\.com/i.test(email)) continue;
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)) continue;
    return email;
  }

  return null;
}

/** Pull LinkedIn from social_accounts first, then blog/bio text. */
export function extractLinkedInUrl(
  profile: GitHubUserProfile,
  socialAccounts: GitHubSocialAccount[] = [],
  profileReadme?: string | null,
): string | null {
  for (const account of socialAccounts) {
    const provider = String(account.provider || "").toLowerCase();
    const url = String(account.url || "").trim();
    if (!url) continue;
    if (provider === "linkedin" || /linkedin\.com/i.test(url)) {
      return url;
    }
  }

  const fromReadme = extractLinkedInFromText(profileReadme);
  if (fromReadme) return fromReadme;

  for (const field of [profile.blog, profile.bio, profile.company]) {
    const found = extractLinkedInFromText(field);
    if (found) return found;
  }

  return null;
}

export function normalizeGitHubProfile(
  profile: GitHubUserProfile,
  socialAccounts: GitHubSocialAccount[] = [],
  profileReadme: string | null = null,
): NormalizedGitHubUser {
  if (!profile?.id || !profile?.login) {
    throw new Error("Invalid GitHub profile: missing id or login");
  }

  const linkedinUrl = extractLinkedInUrl(profile, socialAccounts, profileReadme);
  const email =
    nullableString(profile.email) || extractEmailFromText(profileReadme) || null;
  const readme = profileReadme?.trim() ? profileReadme : null;

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
    email,
    linkedinUrl,
    hireable:
      profile.hireable === null || profile.hireable === undefined
        ? null
        : Boolean(profile.hireable),
    bio: nullableString(profile.bio),
    twitterUsername: nullableString(profile.twitter_username),
    profileReadme: readme,
    publicRepos: Number(profile.public_repos ?? 0),
    publicGists: Number(profile.public_gists ?? 0),
    followers: Number(profile.followers ?? 0),
    following: Number(profile.following ?? 0),
    githubCreatedAt: parseDate(profile.created_at),
    githubUpdatedAt: parseDate(profile.updated_at),
    rawProfile: JSON.stringify({
      ...profile,
      social_accounts: socialAccounts,
      profile_readme: readme,
    }),
    profileForRules: {
      login: profile.login,
      id: profile.id,
      name: profile.name,
      company: profile.company,
      blog: profile.blog,
      location: profile.location,
      email,
      linkedin_url: linkedinUrl,
      linkedinUrl,
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
      social_accounts: socialAccounts,
      profile_readme: readme,
    },
  };
}
