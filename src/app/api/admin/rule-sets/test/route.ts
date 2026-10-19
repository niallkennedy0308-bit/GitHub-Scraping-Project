import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { evaluateRules } from "@/lib/scam-rules/evaluate";
import type { EvaluableRule } from "@/lib/scam-rules/types";
import { SUPPORTED_FIELDS } from "@/lib/scam-rules/types";

const testSchema = z.object({
  groupLogic: z.enum(["AND", "OR"]).default("OR"),
  rules: z.array(
    z.object({
      id: z.string().default("temp"),
      name: z.string(),
      field: z.enum(SUPPORTED_FIELDS as unknown as [string, ...string[]]),
      operator: z.string(),
      value: z.string().optional().nullable(),
      valueTo: z.string().optional().nullable(),
      severity: z.enum(["info", "low", "medium", "high", "exclusion"]).default("medium"),
      action: z.enum(["flag", "exclude", "score"]).default("flag"),
      scoreWeight: z.number().default(10),
      description: z.string().optional().nullable(),
      enabled: z.boolean().default(true),
    }),
  ),
  sampleProfile: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = testSchema.parse(await request.json());
    const decision = evaluateRules(
      body.sampleProfile,
      body.rules as EvaluableRule[],
      body.groupLogic,
    );

    return NextResponse.json({
      ...decision,
      note:
        "A matched/flagged result does not mean the user is a confirmed scam. Only exclusion rules auto-reject.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
