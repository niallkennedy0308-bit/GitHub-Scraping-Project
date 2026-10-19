import { describe, expect, it } from "vitest";
import {
  buildGitHubUserSearchQuery,
  buildGitHubUserSearchUrl,
  EMPTY_SEARCH_BUILDER,
  parseGitHubUserSearchQuery,
} from "@/lib/github-search-builder";

describe("github search builder", () => {
  it("builds query from keywords and advanced filters", () => {
    const q = buildGitHubUserSearchQuery({
      ...EMPTY_SEARCH_BUILDER,
      keywords: "full stack",
      location: "London",
      followersComparator: ">",
      followers: "100",
      language: "TypeScript",
      hireable: true,
    });

    expect(q).toContain("full stack");
    expect(q).toContain("location:London");
    expect(q).toContain("followers:>100");
    expect(q).toContain("language:TypeScript");
    expect(q).toContain("hireable:true");
  });

  it("generates a users search URL", () => {
    const url = buildGitHubUserSearchUrl({
      ...EMPTY_SEARCH_BUILDER,
      keywords: "fullstack",
      reposComparator: ">=",
      repos: "10",
    });

    expect(url).toContain("https://github.com/search?q=");
    expect(url).toContain("type=users");
    expect(decodeURIComponent(url)).toContain("repos:>=10");
  });

  it("quotes multi-word qualifier values", () => {
    const q = buildGitHubUserSearchQuery({
      ...EMPTY_SEARCH_BUILDER,
      fullname: "Jane Doe",
    });
    expect(q).toBe('fullname:"Jane Doe"');
  });

  it("parses an existing query back into fields", () => {
    const parsed = parseGitHubUserSearchQuery(
      'full stack location:London followers:>50 hireable:true',
    );
    expect(parsed.keywords).toBe("full stack");
    expect(parsed.location).toBe("London");
    expect(parsed.followers).toBe("50");
    expect(parsed.followersComparator).toBe(">");
    expect(parsed.hireable).toBe(true);
  });
});
