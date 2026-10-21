import type { EvaluableRule } from "@/lib/scam-rules/types";

/**
 * Risk % = sum of matched rule weights (capped at 100).
 * Missing LinkedIn is strongest, then missing email; other signals share a base weight.
 */
export const RULE_SCORE_WEIGHTS = {
  missingLinkedIn: 35,
  missingEmail: 25,
  /** Location, created date, repos, any social links, company */
  baseSignal: 15,
} as const;

export type SimpleRuleForm = {
  location: string;
  createdDate: string;
  repositoryNumber: string;
  checkEmail: boolean;
  checkLinkedin: boolean;
  checkSocialLinks: boolean;
  checkCompany: boolean;
};

export const EMPTY_SIMPLE_RULE_FORM: SimpleRuleForm = {
  location: "",
  createdDate: "",
  repositoryNumber: "",
  checkEmail: false,
  checkLinkedin: false,
  checkSocialLinks: false,
  checkCompany: false,
};

type StoredRule = {
  id?: string;
  name: string;
  field: string;
  operator: string;
  value?: string | null;
  valueTo?: string | null;
  severity?: "info" | "low" | "medium" | "high" | "exclusion";
  action?: "flag" | "exclude" | "score";
  scoreWeight?: number;
  description?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

/** Convert the simple admin form into persisted detection rules. */
export function simpleFormToRules(form: SimpleRuleForm): StoredRule[] {
  const rules: StoredRule[] = [];
  let order = 0;

  if (form.location.trim()) {
    rules.push({
      name: "Location match",
      field: "location",
      operator: "contains",
      value: form.location.trim(),
      severity: "medium",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.baseSignal,
      description: `Location contains "${form.location.trim()}"`,
      enabled: true,
      sortOrder: order++,
    });
  }

  if (form.createdDate.trim()) {
    rules.push({
      name: "Account created after date",
      field: "created_at",
      operator: "after",
      value: new Date(`${form.createdDate.trim()}T00:00:00.000Z`).toISOString(),
      severity: "low",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.baseSignal,
      description: `Account created after ${form.createdDate.trim()}`,
      enabled: true,
      sortOrder: order++,
    });
  }

  if (form.repositoryNumber.trim() !== "") {
    rules.push({
      name: "Low repository count",
      field: "public_repos",
      operator: "lte",
      value: String(Number(form.repositoryNumber)),
      severity: "info",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.baseSignal,
      description: `Public repositories ≤ ${form.repositoryNumber}`,
      enabled: true,
      sortOrder: order++,
    });
  }

  if (form.checkEmail) {
    rules.push({
      name: "Missing email",
      field: "email",
      operator: "is_empty",
      value: null,
      severity: "high",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.missingEmail,
      description: "Public email is missing",
      enabled: true,
      sortOrder: order++,
    });
  }

  if (form.checkLinkedin) {
    rules.push({
      name: "Missing LinkedIn",
      field: "has_linkedin",
      operator: "is_false",
      value: null,
      severity: "high",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.missingLinkedIn,
      description: "No LinkedIn link found in profile",
      enabled: true,
      sortOrder: order++,
    });
  }

  if (form.checkSocialLinks) {
    rules.push({
      name: "Missing social links",
      field: "has_social_links",
      operator: "is_false",
      value: null,
      severity: "medium",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.baseSignal,
      description: "No social links found on profile",
      enabled: true,
      sortOrder: order++,
    });
  }

  if (form.checkCompany) {
    rules.push({
      name: "Missing company",
      field: "company",
      operator: "is_empty",
      value: null,
      severity: "low",
      action: "flag",
      scoreWeight: RULE_SCORE_WEIGHTS.baseSignal,
      description: "Company is missing",
      enabled: true,
      sortOrder: order++,
    });
  }

  return rules;
}

/** Load a simple form from stored rules (best-effort). */
export function rulesToSimpleForm(rules: StoredRule[]): SimpleRuleForm {
  const form: SimpleRuleForm = { ...EMPTY_SIMPLE_RULE_FORM };

  for (const rule of rules) {
    if (!rule.enabled && rule.enabled !== undefined) continue;

    if (rule.field === "location" && rule.operator === "contains" && rule.value) {
      form.location = rule.value;
    }
    if (rule.field === "created_at" && rule.operator === "after" && rule.value) {
      const d = new Date(rule.value);
      if (!Number.isNaN(d.getTime())) {
        form.createdDate = d.toISOString().slice(0, 10);
      }
    }
    if (rule.field === "public_repos" && (rule.operator === "lte" || rule.operator === "equals") && rule.value != null) {
      form.repositoryNumber = String(rule.value);
    }
    if (rule.field === "email" && rule.operator === "is_empty") {
      form.checkEmail = true;
    }
    if (rule.field === "has_linkedin" && rule.operator === "is_false") {
      form.checkLinkedin = true;
    }
    if (rule.field === "has_social_links" && rule.operator === "is_false") {
      form.checkSocialLinks = true;
    }
    if (rule.field === "company" && rule.operator === "is_empty") {
      form.checkCompany = true;
    }
  }

  return form;
}

export function toEvaluableFromStored(rules: StoredRule[]): EvaluableRule[] {
  return rules.map((rule, index) => ({
    id: rule.id || `temp-${index}`,
    name: rule.name,
    field: rule.field,
    operator: rule.operator,
    value: rule.value,
    valueTo: rule.valueTo,
    severity: rule.severity || "medium",
    action: rule.action || "flag",
    scoreWeight: rule.scoreWeight ?? 10,
    description: rule.description,
    enabled: rule.enabled ?? true,
  }));
}

export function profileHasLinkedIn(profile: Record<string, unknown>): boolean {
  const haystack = [
    profile.blog,
    profile.bio,
    profile.twitter_username,
    profile.company,
    profile.linkedin_url,
    profile.linkedinUrl,
    profile.profile_readme,
    profile.profileReadme,
  ]
    .map((v) => (v == null ? "" : String(v).toLowerCase()))
    .join(" ");
  return haystack.includes("linkedin.com") || /linkedin/.test(haystack);
}

export function profileHasSocialLinks(profile: Record<string, unknown>): boolean {
  const blog = String(profile.blog || "").trim();
  const twitter = String(profile.twitter_username || "").trim();
  const readme = String(profile.profile_readme || profile.profileReadme || "").trim();
  return Boolean(blog || twitter || readme || profileHasLinkedIn(profile));
}
