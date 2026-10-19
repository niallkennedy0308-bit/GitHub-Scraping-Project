import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
  action: z.enum(["mark_legitimate", "mark_suspicious", "confirm_scam", "soft_delete"]),
  note: z.string().max(2000).optional().nullable(),
  confirm: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = bulkSchema.parse(await request.json());

    if (body.action === "soft_delete") {
      const result = await prisma.gitHubUser.updateMany({
        where: { id: { in: body.ids } },
        data: { deletedAt: new Date() },
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "user.bulk_soft_delete",
        entityType: "GitHubUser",
        details: { count: result.count, ids: body.ids, note: body.note },
      });
      return NextResponse.json({ affected: result.count });
    }

    const statusMap = {
      mark_legitimate: "legitimate",
      mark_suspicious: "suspicious",
      confirm_scam: "confirmed_scam",
    } as const;
    const newStatus = statusMap[body.action];

    const users = await prisma.gitHubUser.findMany({ where: { id: { in: body.ids } } });

    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        await tx.gitHubUser.update({
          where: { id: user.id },
          data: {
            validationStatus: newStatus,
            reviewedById: session.user.id,
            reviewedAt: new Date(),
          },
        });
        await tx.userValidationHistory.create({
          data: {
            githubUserId: user.id,
            previousStatus: user.validationStatus,
            newStatus,
            riskScore: user.riskScore,
            matchedRuleIds: user.matchedRuleIds,
            reasons: user.validationReasons,
            note: body.note ?? null,
            reviewedById: session.user.id,
            source: "manual_bulk",
          },
        });
      }
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: `user.bulk_${body.action}`,
      entityType: "GitHubUser",
      details: { count: users.length, ids: body.ids, note: body.note },
    });

    return NextResponse.json({ affected: users.length });
  } catch (error) {
    return jsonError(error);
  }
}
