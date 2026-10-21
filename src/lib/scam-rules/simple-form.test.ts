import { describe, expect, it } from "vitest";
import { evaluateRules } from "@/lib/scam-rules/evaluate";
import {
  profileHasLinkedIn,
  profileHasSocialLinks,
  simpleFormToRules,
} from "@/lib/scam-rules/simple-form";

describe("simple rule form", () => {
  it("maps form fields into evaluation rules", () => {
    const rules = simpleFormToRules({
      location: "London",
      createdDate: "2024-01-01",
      repositoryNumber: "3",
      checkEmail: true,
      checkLinkedin: true,
      checkSocialLinks: true,
      checkCompany: true,
    });

    expect(rules.map((r) => r.field)).toEqual([
      "location",
      "created_at",
      "public_repos",
      "email",
      "has_linkedin",
      "has_social_links",
      "company",
    ]);
    expect(rules.find((r) => r.field === "has_linkedin")?.scoreWeight).toBe(35);
    expect(rules.find((r) => r.field === "email")?.scoreWeight).toBe(25);
    expect(rules.find((r) => r.field === "has_social_links")?.scoreWeight).toBe(15);
    expect(rules.find((r) => r.field === "location")?.scoreWeight).toBe(15);
  });

  it("detects linkedin and social links", () => {
    expect(profileHasLinkedIn({ blog: "https://linkedin.com/in/test" })).toBe(true);
    expect(profileHasLinkedIn({ linkedin_url: "https://linkedin.com/in/manual" })).toBe(true);
    expect(profileHasSocialLinks({ twitter_username: "dev" })).toBe(true);
    expect(profileHasSocialLinks({ blog: "", twitter_username: null })).toBe(false);
  });

  it("flags missing email and company on sample profile", () => {
    const rules = simpleFormToRules({
      location: "",
      createdDate: "",
      repositoryNumber: "",
      checkEmail: true,
      checkLinkedin: false,
      checkSocialLinks: false,
      checkCompany: true,
    }).map((rule, index) => ({
      ...rule,
      id: `r${index}`,
      severity: rule.severity || ("medium" as const),
      action: rule.action || ("flag" as const),
      scoreWeight: rule.scoreWeight ?? 10,
      enabled: true,
    }));

    const decision = evaluateRules(
      {
        email: null,
        company: null,
        blog: "",
        twitter_username: null,
      },
      rules,
      "OR",
    );

    expect(decision.flagged).toBe(true);
    // Missing email (25) + company (15) = 40% → suspicious band
    expect(decision.riskScore).toBe(40);
    expect(decision.status).toBe("suspicious");
  });
});
