import { z } from "zod";

const ALLOWED_HOSTS = new Set(["github.com", "www.github.com", "api.github.com"]);

export type ParsedGitHubSearch = {
  githubSearchUrl: string;
  searchQuery: string;
  apiSearchUrl: string;
};

/**
 * Validate admin-provided GitHub search URLs to prevent SSRF.
 * Supported forms:
 * - https://github.com/search?q=...&type=users
 * - https://api.github.com/search/users?q=...
 * - bare search query string (converted to users search)
 */
export function validateAndParseGitHubSearch(input: string): ParsedGitHubSearch {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("GitHub search URL or query is required");
  }

  // Bare query (no scheme) → treat as search query
  if (!trimmed.includes("://") && !trimmed.startsWith("//")) {
    const searchQuery = trimmed;
    const apiSearchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(searchQuery)}`;
    return {
      githubSearchUrl: `https://github.com/search?q=${encodeURIComponent(searchQuery)}&type=users`,
      searchQuery,
      apiSearchUrl,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS GitHub URLs are allowed");
  }

  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Only github.com and api.github.com URLs are allowed");
  }

  // Block credentials, unusual ports, and redirects to private networks via userinfo
  if (url.username || url.password) {
    throw new Error("URLs with credentials are not allowed");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Custom ports are not allowed");
  }

  const host = url.hostname.toLowerCase();

  if (host === "api.github.com") {
    if (!url.pathname.startsWith("/search/users")) {
      throw new Error("Only /search/users API endpoints are supported");
    }
    const q = url.searchParams.get("q");
    if (!q) {
      throw new Error("API search URL must include a q parameter");
    }
    const apiSearchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(q)}`;
    return {
      githubSearchUrl: `https://github.com/search?q=${encodeURIComponent(q)}&type=users`,
      searchQuery: q,
      apiSearchUrl,
    };
  }

  // github.com/search
  if (url.pathname !== "/search" && !url.pathname.startsWith("/search/")) {
    throw new Error("Only GitHub user search URLs (/search) are supported");
  }

  const q = url.searchParams.get("q");
  if (!q) {
    throw new Error("Search URL must include a q parameter");
  }

  const type = (url.searchParams.get("type") || "users").toLowerCase();
  if (type !== "users" && type !== "user") {
    throw new Error("Only user search type is supported");
  }

  const apiSearchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(q)}`;
  return {
    githubSearchUrl: `https://github.com/search?q=${encodeURIComponent(q)}&type=users`,
    searchQuery: q,
    apiSearchUrl,
  };
}

export const scrapingConfigSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  githubSearchUrl: z.string().min(1),
  enabled: z.boolean().optional(),
  ruleSetId: z.string().cuid().optional().nullable(),
});
