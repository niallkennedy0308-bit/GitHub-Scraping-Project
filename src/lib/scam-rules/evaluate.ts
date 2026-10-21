import {
  BOOLEAN_FIELDS,
  DATE_FIELDS,
  NUMERIC_FIELDS,
  STRING_FIELDS,
  type AutoValidationStatus,
  type EvaluableRule,
  type GitHubProfileLike,
  type RuleMatch,
  type ValidationDecision,
} from "@/lib/scam-rules/types";
import { profileHasLinkedIn, profileHasSocialLinks } from "@/lib/scam-rules/simple-form";

const SAFE_REGEX = /^[\w\s.\-@+*?^$[\](){}|\\,]{1,200}$/;

/** Map risk % to automatic validation status. */
export function statusFromRiskScore(riskScore: number): AutoValidationStatus {
  const score = Math.min(100, Math.max(0, riskScore));
  if (score >= 70) return "confirmed_scam";
  if (score >= 30) return "suspicious";
  if (score > 0) return "pending";
  return "legitimate";
}

function getFieldValue(profile: GitHubProfileLike, field: string): unknown {
  if (field === "has_linkedin") return profileHasLinkedIn(profile);
  if (field === "has_social_links") return profileHasSocialLinks(profile);
  return profile[field];
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function evaluateString(
  fieldValue: unknown,
  operator: string,
  compare?: string | null,
): boolean {
  const value = asString(fieldValue);
  const empty = value === null || value.trim() === "";

  switch (operator) {
    case "is_empty":
      return empty;
    case "is_not_empty":
      return !empty;
    case "equals":
      return (value ?? "").toLowerCase() === (compare ?? "").toLowerCase();
    case "not_equals":
      return (value ?? "").toLowerCase() !== (compare ?? "").toLowerCase();
    case "contains":
      return (value ?? "").toLowerCase().includes((compare ?? "").toLowerCase());
    case "not_contains":
      return !(value ?? "").toLowerCase().includes((compare ?? "").toLowerCase());
    case "starts_with":
      return (value ?? "").toLowerCase().startsWith((compare ?? "").toLowerCase());
    case "ends_with":
      return (value ?? "").toLowerCase().endsWith((compare ?? "").toLowerCase());
    case "matches_regex": {
      if (!compare || !SAFE_REGEX.test(compare)) {
        throw new Error("Unsafe or invalid regular expression");
      }
      const re = new RegExp(compare, "i");
      return re.test(value ?? "");
    }
    default:
      throw new Error(`Unsupported string operator: ${operator}`);
  }
}

function evaluateNumeric(
  fieldValue: unknown,
  operator: string,
  compare?: string | null,
  compareTo?: string | null,
): boolean {
  const value = asNumber(fieldValue);
  if (value === null) return false;
  const n = asNumber(compare);
  const n2 = asNumber(compareTo);

  switch (operator) {
    case "equals":
      return n !== null && value === n;
    case "gt":
      return n !== null && value > n;
    case "gte":
      return n !== null && value >= n;
    case "lt":
      return n !== null && value < n;
    case "lte":
      return n !== null && value <= n;
    case "between":
      return n !== null && n2 !== null && value >= n && value <= n2;
    default:
      throw new Error(`Unsupported numeric operator: ${operator}`);
  }
}

function evaluateBoolean(fieldValue: unknown, operator: string): boolean {
  const value = asBoolean(fieldValue);
  if (value === null) return false;
  if (operator === "is_true") return value === true;
  if (operator === "is_false") return value === false;
  throw new Error(`Unsupported boolean operator: ${operator}`);
}

function evaluateDate(
  fieldValue: unknown,
  operator: string,
  compare?: string | null,
  compareTo?: string | null,
): boolean {
  const value = asDate(fieldValue);
  if (!value) return false;
  const d = asDate(compare);
  const d2 = asDate(compareTo);

  switch (operator) {
    case "before":
      return !!d && value.getTime() < d.getTime();
    case "after":
      return !!d && value.getTime() > d.getTime();
    case "between":
      return !!d && !!d2 && value.getTime() >= d.getTime() && value.getTime() <= d2.getTime();
    default:
      throw new Error(`Unsupported date operator: ${operator}`);
  }
}

export function evaluateRule(
  profile: GitHubProfileLike,
  rule: EvaluableRule,
): { matched: boolean; explanation?: string; error?: string } {
  try {
    const fieldValue = getFieldValue(profile, rule.field);
    let matched = false;

    if ((STRING_FIELDS as readonly string[]).includes(rule.field)) {
      matched = evaluateString(fieldValue, rule.operator, rule.value);
    } else if ((NUMERIC_FIELDS as readonly string[]).includes(rule.field)) {
      matched = evaluateNumeric(fieldValue, rule.operator, rule.value, rule.valueTo);
    } else if ((BOOLEAN_FIELDS as readonly string[]).includes(rule.field)) {
      matched = evaluateBoolean(fieldValue, rule.operator);
    } else if ((DATE_FIELDS as readonly string[]).includes(rule.field)) {
      matched = evaluateDate(fieldValue, rule.operator, rule.value, rule.valueTo);
    } else {
      return { matched: false, error: `Unsupported field: ${rule.field}` };
    }

    if (!matched) return { matched: false };

    const explanation =
      rule.description ||
      `${rule.name}: field "${rule.field}" matched operator "${rule.operator}"` +
        (rule.value ? ` with value "${rule.value}"` : "");

    return { matched: true, explanation };
  } catch (error) {
    return {
      matched: false,
      error: error instanceof Error ? error.message : "Rule evaluation failed",
    };
  }
}

export function evaluateRules(
  profile: GitHubProfileLike,
  rules: EvaluableRule[],
  groupLogic: "AND" | "OR" = "OR",
): ValidationDecision {
  const enabled = rules.filter((r) => r.enabled);
  const matches: RuleMatch[] = [];
  const errors: string[] = [];

  for (const rule of enabled) {
    const result = evaluateRule(profile, rule);
    if (result.error) {
      errors.push(`${rule.name}: ${result.error}`);
      continue;
    }
    if (result.matched && result.explanation) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        explanation: result.explanation,
        severity: rule.severity,
        action: rule.action,
        scoreWeight: rule.scoreWeight,
      });
    }
  }

  // Group logic applies to whether the set is considered a "group match"
  // for flagging: OR = any match flags; AND = all enabled rules must match.
  const groupMatched =
    enabled.length === 0
      ? false
      : groupLogic === "AND"
        ? matches.length === enabled.length && errors.length === 0
        : matches.length > 0;

  const effectiveMatches = groupLogic === "AND" && !groupMatched ? [] : matches;

  const excluded = effectiveMatches.some(
    (m) => m.action === "exclude" || m.severity === "exclusion",
  );

  const riskScore = Math.min(
    100,
    effectiveMatches.reduce((sum, m) => sum + (m.scoreWeight || 0), 0),
  );

  const flagged = !excluded && effectiveMatches.length > 0;
  // Thresholds: 0 → legitimate; 1–29 → pending; 30–69 → suspicious; 70+ → confirmed_scam
  const status = excluded ? "pending" : statusFromRiskScore(riskScore);

  return {
    matches: effectiveMatches,
    riskScore,
    excluded,
    flagged,
    status,
    reasons: effectiveMatches.map((m) => m.explanation),
    matchedRuleIds: effectiveMatches.map((m) => m.ruleId),
    errors,
  };
}
