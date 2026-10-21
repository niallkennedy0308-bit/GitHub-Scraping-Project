import { describe, expect, it } from "vitest";
import {
  extractEmailFromText,
  extractLinkedInFromText,
  extractLinkedInUrl,
  normalizeGitHubProfile,
} from "@/lib/github/normalize";
import type { GitHubUserProfile } from "@/lib/github/client";

const baseProfile = {
  login: "imranolas",
  id: 1,
  blog: null,
  bio: "Software engineer",
  email: null,
} as GitHubUserProfile;

const sampleReadme = `
# 👋 Hi, I'm Imran

📫 How to reach me: [LinkedIn](https://www.linkedin.com/in/imransulemanji), Twitter, or email me at [imran.sulemanji@gmail.com](mailto:imran.sulemanji@gmail.com).
`;

/** Real-world pattern: shields.io badge with HTML-entity-encoded slashes. */
const badgeReadme = `
<a href="mailto:contact@tobythe.dev" target="_blank">
  <img src="https://img.shields.io/badge/Email-%235B92E5.svg"/>
</a>
<a href="https:&#x2F;&#x2F;www.linkedin.com&#x2F;in&#x2F;tobysmith568&#x2F;" target="_blank">
  <img src="https://img.shields.io/badge/Linkedin-%230077B5.svg?style=for-the-badge&logo=linkedin&logoColor=white&link=https:&#x2F;&#x2F;www.linkedin.com&#x2F;in&#x2F;tobysmith568&#x2F;"/>
</a>
`;

describe("extract contacts from profile README", () => {
  it("extracts LinkedIn from markdown links", () => {
    expect(extractLinkedInFromText(sampleReadme)).toBe(
      "https://www.linkedin.com/in/imransulemanji",
    );
  });

  it("extracts LinkedIn from HTML badge buttons with entity-encoded URLs", () => {
    expect(extractLinkedInFromText(badgeReadme)).toBe(
      "https://www.linkedin.com/in/tobysmith568/",
    );
  });

  it("extracts email from mailto / plain text", () => {
    expect(extractEmailFromText(sampleReadme)).toBe("imran.sulemanji@gmail.com");
  });

  it("ignores github noreply emails", () => {
    expect(extractEmailFromText("contact 123+user@users.noreply.github.com")).toBeNull();
  });
});

describe("extractLinkedInUrl", () => {
  it("prefers social_accounts over README", () => {
    expect(
      extractLinkedInUrl(
        baseProfile,
        [{ provider: "linkedin", url: "https://www.linkedin.com/in/from-sidebar" }],
        sampleReadme,
      ),
    ).toBe("https://www.linkedin.com/in/from-sidebar");
  });

  it("falls back to README when social accounts omit LinkedIn", () => {
    expect(extractLinkedInUrl(baseProfile, [], sampleReadme)).toBe(
      "https://www.linkedin.com/in/imransulemanji",
    );
  });
});

describe("normalizeGitHubProfile", () => {
  it("stores README and fills missing email / LinkedIn from it", () => {
    const normalized = normalizeGitHubProfile(baseProfile, [], sampleReadme);
    expect(normalized.profileReadme).toContain("Hi, I'm Imran");
    expect(normalized.email).toBe("imran.sulemanji@gmail.com");
    expect(normalized.linkedinUrl).toBe("https://www.linkedin.com/in/imransulemanji");
    expect(normalized.profileForRules.email).toBe(normalized.email);
    expect(normalized.profileForRules.linkedin_url).toBe(normalized.linkedinUrl);
  });
});
