export type GitHubUserSearchItem = {
  login: string;
  id: number;
  node_id?: string;
  avatar_url?: string;
  url?: string;
  html_url?: string;
  type?: string;
};

export type GitHubUserProfile = {
  login: string;
  id: number;
  node_id?: string;
  avatar_url?: string;
  gravatar_id?: string;
  url?: string;
  html_url?: string;
  followers_url?: string;
  following_url?: string;
  gists_url?: string;
  starred_url?: string;
  subscriptions_url?: string;
  organizations_url?: string;
  repos_url?: string;
  events_url?: string;
  received_events_url?: string;
  type?: string;
  user_view_type?: string;
  site_admin?: boolean;
  name?: string | null;
  company?: string | null;
  blog?: string | null;
  location?: string | null;
  email?: string | null;
  hireable?: boolean | null;
  bio?: string | null;
  twitter_username?: string | null;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  following?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export class GitHubApiError extends Error {
  status: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  permanent: boolean;

  constructor(
    message: string,
    status: number,
    opts?: { rateLimitRemaining?: number; rateLimitReset?: number; permanent?: boolean },
  ) {
    super(message);
    this.status = status;
    this.rateLimitRemaining = opts?.rateLimitRemaining;
    this.rateLimitReset = opts?.rateLimitReset;
    this.permanent = opts?.permanent ?? (status >= 400 && status < 500 && status !== 429);
  }
}

function getHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-scraping-admin",
  };
  const resolved = token?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (resolved) {
    headers.Authorization = `Bearer ${resolved}`;
  }
  return headers;
}

async function githubFetch(url: string, token?: string | null): Promise<Response> {
  const base = process.env.GITHUB_API_BASE || "https://api.github.com";
  if (!url.startsWith("https://api.github.com") && !url.startsWith(base)) {
    throw new GitHubApiError("Blocked non-GitHub API URL", 400, { permanent: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: getHeaders(token),
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "GitHub API request timed out"
        : error instanceof Error
          ? error.message
          : "GitHub API request failed";
    throw new GitHubApiError(message, 408, { permanent: false });
  }

  const remaining = Number(response.headers.get("x-ratelimit-remaining") || "0");
  const reset = Number(response.headers.get("x-ratelimit-reset") || "0");

  if (response.status === 403 || response.status === 429) {
    const body = await response.text().catch(() => "");
    const secondary = /secondary rate limit|abuse detection/i.test(body);
    const resetLabel = reset
      ? new Date(reset * 1000).toLocaleString()
      : "later";
    throw new GitHubApiError(
      secondary
        ? `GitHub secondary rate limit — waiting to retry (resets ~${resetLabel})`
        : `GitHub rate limit exceeded (remaining ${remaining}). Resets ~${resetLabel}`,
      response.status,
      {
        rateLimitRemaining: remaining,
        rateLimitReset: reset,
        permanent: false,
      },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GitHubApiError(
      `GitHub API error ${response.status}: ${body.slice(0, 200)}`,
      response.status,
      { rateLimitRemaining: remaining, rateLimitReset: reset },
    );
  }

  return response;
}

export async function searchUsersPage(
  apiSearchUrl: string,
  page: number,
  perPage: number,
  token?: string | null,
): Promise<{ items: GitHubUserSearchItem[]; totalCount: number; incompleteResults: boolean }> {
  const url = new URL(apiSearchUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const response = await githubFetch(url.toString(), token);
  const data = (await response.json()) as {
    items?: GitHubUserSearchItem[];
    total_count?: number;
    incomplete_results?: boolean;
  };

  return {
    items: data.items ?? [],
    totalCount: data.total_count ?? 0,
    incompleteResults: Boolean(data.incomplete_results),
  };
}

export async function fetchUserProfile(
  login: string,
  token?: string | null,
): Promise<GitHubUserProfile> {
  const base = process.env.GITHUB_API_BASE || "https://api.github.com";
  const response = await githubFetch(`${base}/users/${encodeURIComponent(login)}`, token);
  return (await response.json()) as GitHubUserProfile;
}

export type GitHubSocialAccount = {
  provider: string;
  url: string;
};

/** Public LinkedIn/Twitter/etc. links shown in the GitHub profile sidebar. */
export async function fetchUserSocialAccounts(
  login: string,
  token?: string | null,
): Promise<GitHubSocialAccount[]> {
  const base = process.env.GITHUB_API_BASE || "https://api.github.com";
  const response = await githubFetch(
    `${base}/users/${encodeURIComponent(login)}/social_accounts`,
    token,
  );
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (item): item is GitHubSocialAccount =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as GitHubSocialAccount).provider === "string" &&
            typeof (item as GitHubSocialAccount).url === "string",
        ),
    )
    .map((item) => ({ provider: item.provider, url: item.url }));
}

/**
 * Profile README shown in the main column of a GitHub profile
 * (from the special public repo `{login}/{login}`). Returns null when absent.
 */
export async function fetchProfileReadme(
  login: string,
  token?: string | null,
): Promise<string | null> {
  const base = process.env.GITHUB_API_BASE || "https://api.github.com";
  const encoded = encodeURIComponent(login);
  const url = `${base}/repos/${encoded}/${encoded}/readme`;

  try {
    const response = await githubFetch(url, token);
    const data = (await response.json()) as {
      content?: string;
      encoding?: string;
    };
    if (!data.content) return null;
    if (data.encoding && data.encoding !== "base64") {
      return String(data.content);
    }
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function verifyGitHubToken(token: string): Promise<{ login: string }> {
  const response = await githubFetch("https://api.github.com/user", token);
  const data = (await response.json()) as { login?: string };
  if (!data.login) {
    throw new GitHubApiError("Token verification failed", 401, { permanent: true });
  }
  return { login: data.login };
}

export type GitHubRateLimitSnapshot = {
  coreLimit: number;
  coreRemaining: number;
  coreReset: number;
  searchLimit: number;
  searchRemaining: number;
  searchReset: number;
  authenticated: boolean;
};

export async function fetchRateLimit(token?: string | null): Promise<GitHubRateLimitSnapshot> {
  const response = await githubFetch("https://api.github.com/rate_limit", token);
  const data = (await response.json()) as {
    resources?: {
      core?: { limit?: number; remaining?: number; reset?: number };
      search?: { limit?: number; remaining?: number; reset?: number };
    };
  };
  const coreLimit = Number(data.resources?.core?.limit ?? 0);
  const searchLimit = Number(data.resources?.search?.limit ?? 0);
  return {
    coreLimit,
    coreRemaining: Number(data.resources?.core?.remaining ?? 0),
    coreReset: Number(data.resources?.core?.reset ?? 0),
    searchLimit,
    searchRemaining: Number(data.resources?.search?.remaining ?? 0),
    searchReset: Number(data.resources?.search?.reset ?? 0),
    // Authenticated classic/fine-grained tokens normally get ~5000 core / ~30 search.
    authenticated: coreLimit > 60 || searchLimit > 10,
  };
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    maxAttempts?: number;
    shouldCancel?: () => Promise<boolean>;
    onWait?: (message: string) => Promise<void> | void;
  },
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  let attempt = 0;
  let delay = 1000;

  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      if (opts?.shouldCancel && (await opts.shouldCancel())) {
        throw new Error("Job cancelled");
      }
      if (!(error instanceof GitHubApiError) || error.permanent || attempt >= maxAttempts) {
        throw error;
      }

      let waitMs = delay;
      if (error.status === 429 || error.status === 403) {
        const now = Math.floor(Date.now() / 1000);
        const waitSec = error.rateLimitReset
          ? Math.max(5, error.rateLimitReset - now)
          : Math.max(5, Math.ceil(delay / 1000));
        // Wait up to 15 minutes for primary rate-limit reset (was capped at 90s).
        waitMs = Math.min(waitSec, 15 * 60) * 1000;
      } else {
        delay = Math.min(delay * 2, 30000);
      }

      if (opts?.onWait) {
        await opts.onWait(
          `${error.message}. Waiting ${Math.ceil(waitMs / 1000)}s before retry ${attempt}/${maxAttempts}…`,
        );
      }

      // Sleep in short slices so cancel requests are honored during long rate-limit waits.
      const sliceMs = 2000;
      let remaining = waitMs;
      while (remaining > 0) {
        if (opts?.shouldCancel && (await opts.shouldCancel())) {
          throw new Error("Job cancelled");
        }
        const step = Math.min(sliceMs, remaining);
        await sleep(step);
        remaining -= step;
      }
    }
  }
}
