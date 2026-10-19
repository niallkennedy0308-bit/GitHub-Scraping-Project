import { describe, expect, it } from "vitest";
import { evaluateRule, evaluateRules } from "@/lib/scam-rules/evaluate";
import type { EvaluableRule } from "@/lib/scam-rules/types";

const sample = {
  login: "Tyrese-FullStackGenius",
  id: 133923231,
  name: "Tyrese, Full Stack Genius",
  company: null,
  blog: "",
  location: null,
  email: null,
  hireable: true,
  bio: "Full Stack Web Developer with DevOps experience.",
  twitter_username: null,
  public_repos: 53,
  public_gists: 0,
  followers: 114,
  following: 2,
  created_at: "2023-05-17T22:18:31Z",
  updated_at: "2025-02-10T07:20:34Z",
  type: "User",
  site_admin: false,
};

function rule(partial: Partial<EvaluableRule> & Pick<EvaluableRule, "name" | "field" | "operator">): EvaluableRule {
  return {
    id: partial.id || "r1",
    severity: "medium",
    action: "flag",
    scoreWeight: 10,
    enabled: true,
    value: null,
    valueTo: null,
    description: null,
    ...partial,
  };
}

describe("scam rule evaluation", () => {
  it("evaluates string contains", () => {
    const result = evaluateRule(
      sample,
      rule({ name: "bio has fullstack", field: "bio", operator: "contains", value: "Full Stack" }),
    );
    expect(result.matched).toBe(true);
  });

  it("handles null string fields with is_empty", () => {
    const result = evaluateRule(
      sample,
      rule({ name: "no company", field: "company", operator: "is_empty" }),
    );
    expect(result.matched).toBe(true);
  });

  it("evaluates numeric comparisons", () => {
    const result = evaluateRule(
      sample,
      rule({ name: "followers gte", field: "followers", operator: "gte", value: "100" }),
    );
    expect(result.matched).toBe(true);
  });

  it("evaluates boolean operators", () => {
    const result = evaluateRule(
      sample,
      rule({ name: "hireable", field: "hireable", operator: "is_true" }),
    );
    expect(result.matched).toBe(true);
  });

  it("evaluates date before/after", () => {
    const result = evaluateRule(
      sample,
      rule({
        name: "created before 2024",
        field: "created_at",
        operator: "before",
        value: "2024-01-01T00:00:00Z",
      }),
    );
    expect(result.matched).toBe(true);
  });

  it("skips disabled rules", () => {
    const decision = evaluateRules(
      sample,
      [
        rule({
          id: "d1",
          name: "disabled",
          field: "login",
          operator: "contains",
          value: "Tyrese",
          enabled: false,
        }),
      ],
      "OR",
    );
    expect(decision.matches).toHaveLength(0);
    expect(decision.flagged).toBe(false);
  });

  it("AND group requires all enabled rules", () => {
    const decision = evaluateRules(
      sample,
      [
        rule({ id: "a", name: "a", field: "followers", operator: "gte", value: "100" }),
        rule({ id: "b", name: "b", field: "public_repos", operator: "equals", value: "0" }),
      ],
      "AND",
    );
    expect(decision.matches).toHaveLength(0);
    expect(decision.flagged).toBe(false);
  });

  it("OR group flags on any match without confirming scam", () => {
    const decision = evaluateRules(
      sample,
      [
        rule({
          id: "a",
          name: "low followers",
          field: "followers",
          operator: "lt",
          value: "1000",
          action: "flag",
        }),
      ],
      "OR",
    );
    expect(decision.flagged).toBe(true);
    expect(decision.excluded).toBe(false);
    expect(decision.status).toBe("suspicious");
  });

  it("exclusion action marks excluded", () => {
    const decision = evaluateRules(
      sample,
      [
        rule({
          id: "x",
          name: "bot",
          field: "login",
          operator: "contains",
          value: "Tyrese",
          action: "exclude",
          severity: "exclusion",
        }),
      ],
      "OR",
    );
    expect(decision.excluded).toBe(true);
  });

  it("records unsafe regex errors", () => {
    const decision = evaluateRules(
      sample,
      [
        rule({
          id: "re",
          name: "bad regex",
          field: "bio",
          operator: "matches_regex",
          value: "(?<=bad)",
        }),
      ],
      "OR",
    );
    expect(decision.errors.length).toBeGreaterThan(0);
  });
});
