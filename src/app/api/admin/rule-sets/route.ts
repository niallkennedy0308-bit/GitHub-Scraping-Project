import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { SUPPORTED_FIELDS } from "@/lib/scam-rules/types";
import { writeAuditLog } from "@/lib/services/audit";

const ruleSchema = z.object({
  name: z.string().min(1),
  field: z.enum(SUPPORTED_FIELDS as unknown as [string, ...string[]]),
  operator: z.string().min(1),
  value: z.string().optional().nullable(),
  valueTo: z.string().optional().nullable(),
  severity: z.enum(["info", "low", "medium", "high", "exclusion"]).optional(),
  action: z.enum(["flag", "exclude", "score"]).optional(),
  scoreWeight: z.number().int().min(0).max(100).optional(),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const ruleSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  groupLogic: z.enum(["AND", "OR"]).optional(),
  enabled: z.boolean().optional(),
  rules: z.array(ruleSchema).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const sets = await prisma.scamRuleSet.findMany({
      include: { rules: { orderBy: { sortOrder: "asc" } }, _count: { select: { configurations: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(sets);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = ruleSetSchema.parse(await request.json());

    const created = await prisma.scamRuleSet.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        groupLogic: body.groupLogic ?? "OR",
        enabled: body.enabled ?? true,
        rules: body.rules
          ? {
              create: body.rules.map((rule, index) => ({
                name: rule.name,
                field: rule.field,
                operator: rule.operator,
                value: rule.value ?? null,
                valueTo: rule.valueTo ?? null,
                severity: rule.severity ?? "medium",
                action: rule.action ?? "flag",
                scoreWeight: rule.scoreWeight ?? 10,
                description: rule.description ?? null,
                enabled: rule.enabled ?? true,
                sortOrder: rule.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: { rules: { orderBy: { sortOrder: "asc" } } },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "rule_set.create",
      entityType: "ScamRuleSet",
      entityId: created.id,
      details: { name: created.name },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
