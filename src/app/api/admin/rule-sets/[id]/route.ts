import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { SUPPORTED_FIELDS } from "@/lib/scam-rules/types";
import { writeAuditLog } from "@/lib/services/audit";

type Params = { params: Promise<{ id: string }> };

const ruleSchema = z.object({
  id: z.string().optional(),
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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  groupLogic: z.enum(["AND", "OR"]).optional(),
  enabled: z.boolean().optional(),
  rules: z.array(ruleSchema).optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const set = await prisma.scamRuleSet.findUnique({
      where: { id },
      include: { rules: { orderBy: { sortOrder: "asc" } } },
    });
    if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(set);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.scamRuleSet.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      if (body.rules) {
        await tx.scamDetectionRule.deleteMany({ where: { ruleSetId: id } });
        await tx.scamDetectionRule.createMany({
          data: body.rules.map((rule, index) => ({
            ruleSetId: id,
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
        });
      }

      return tx.scamRuleSet.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          groupLogic: body.groupLogic,
          enabled: body.enabled,
        },
        include: { rules: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "rule_set.update",
      entityType: "ScamRuleSet",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await prisma.scamRuleSet.delete({ where: { id } });
    await writeAuditLog({
      actorId: session.user.id,
      action: "rule_set.delete",
      entityType: "ScamRuleSet",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
