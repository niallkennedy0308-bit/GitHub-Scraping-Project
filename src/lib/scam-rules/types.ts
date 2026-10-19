export const STRING_FIELDS = [
  "login",
  "name",
  "company",
  "blog",
  "location",
  "email",
  "bio",
  "twitter_username",
  "type",
] as const;

export const NUMERIC_FIELDS = [
  "id",
  "public_repos",
  "public_gists",
  "followers",
  "following",
] as const;

export const BOOLEAN_FIELDS = ["hireable", "site_admin", "has_linkedin", "has_social_links"] as const;

export const DATE_FIELDS = ["created_at", "updated_at"] as const;

export const SUPPORTED_FIELDS = [
  ...STRING_FIELDS,
  ...NUMERIC_FIELDS,
  ...BOOLEAN_FIELDS,
  ...DATE_FIELDS,
] as const;

export type SupportedField = (typeof SUPPORTED_FIELDS)[number];

export const STRING_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "matches_regex",
] as const;

export const NUMERIC_OPERATORS = [
  "equals",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
] as const;

export const BOOLEAN_OPERATORS = ["is_true", "is_false"] as const;

export const DATE_OPERATORS = ["before", "after", "between"] as const;

export type RuleOperator =
  | (typeof STRING_OPERATORS)[number]
  | (typeof NUMERIC_OPERATORS)[number]
  | (typeof BOOLEAN_OPERATORS)[number]
  | (typeof DATE_OPERATORS)[number];

export type GitHubProfileLike = Record<string, unknown>;

export type EvaluableRule = {
  id: string;
  name: string;
  field: string;
  operator: string;
  value?: string | null;
  valueTo?: string | null;
  severity: "info" | "low" | "medium" | "high" | "exclusion";
  action: "flag" | "exclude" | "score";
  scoreWeight: number;
  description?: string | null;
  enabled: boolean;
};

export type RuleMatch = {
  ruleId: string;
  ruleName: string;
  explanation: string;
  severity: EvaluableRule["severity"];
  action: EvaluableRule["action"];
  scoreWeight: number;
};

export type ValidationDecision = {
  matches: RuleMatch[];
  riskScore: number;
  excluded: boolean;
  flagged: boolean;
  status: "pending" | "suspicious";
  reasons: string[];
  matchedRuleIds: string[];
  errors: string[];
};
