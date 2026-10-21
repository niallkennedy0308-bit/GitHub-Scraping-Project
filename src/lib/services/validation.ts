import { evaluateRules } from "@/lib/scam-rules/evaluate";
import type { EvaluableRule, ValidationDecision } from "@/lib/scam-rules/types";
import type { NormalizedGitHubUser } from "@/lib/github/normalize";
import type { ScamDetectionRule, ScamRuleSet } from "@prisma/client";

export function toEvaluableRules(rules: ScamDetectionRule[]): EvaluableRule[] {
  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    field: rule.field,
    operator: rule.operator,
    value: rule.value,
    valueTo: rule.valueTo,
    severity: rule.severity,
    action: rule.action,
    scoreWeight: rule.scoreWeight,
    description: rule.description,
    enabled: rule.enabled,
  }));
}

export function validateProfile(
  user: NormalizedGitHubUser,
  ruleSet: (ScamRuleSet & { rules: ScamDetectionRule[] }) | null | undefined,
): ValidationDecision {
  if (!ruleSet || !ruleSet.enabled) {
    return {
      matches: [],
      riskScore: 0,
      excluded: false,
      flagged: false,
      status: "legitimate",
      reasons: [],
      matchedRuleIds: [],
      errors: [],
    };
  }

  return evaluateRules(
    user.profileForRules,
    toEvaluableRules(ruleSet.rules),
    ruleSet.groupLogic,
  );
}
