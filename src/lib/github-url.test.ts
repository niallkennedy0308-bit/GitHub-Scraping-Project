import { describe, expect, it } from "vitest";
import { validateAndParseGitHubSearch } from "@/lib/github-url";

describe("validateAndParseGitHubSearch", () => {
  it("accepts github user search URLs", () => {
    const parsed = validateAndParseGitHubSearch(
      "https://github.com/search?q=fullstack+hireable%3Atrue&type=users",
    );
    expect(parsed.searchQuery).toContain("fullstack");
    expect(parsed.apiSearchUrl).toContain("api.github.com/search/users");
  });

  it("accepts bare queries", () => {
    const parsed = validateAndParseGitHubSearch("location:london followers:>10");
    expect(parsed.searchQuery).toBe("location:london followers:>10");
  });

  it("rejects non-GitHub hosts", () => {
    expect(() => validateAndParseGitHubSearch("https://evil.com/search?q=x")).toThrow(
      /only github.com/i,
    );
  });

  it("rejects http and credentialed URLs", () => {
    expect(() => validateAndParseGitHubSearch("http://github.com/search?q=x&type=users")).toThrow(
      /HTTPS/i,
    );
    expect(() =>
      validateAndParseGitHubSearch("https://user:pass@github.com/search?q=x&type=users"),
    ).toThrow(/credentials/i);
  });
});
