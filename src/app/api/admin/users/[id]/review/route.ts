import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { toJsonArray } from "@/lib/utils";
import { normalizeGitHubProfile } from "@/lib/github/normalize";
import { validateProfile } from "@/lib/services/validation";
import type { GitHubUserProfile } from "@/lib/github/client";

type Params = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  action: z.enum([
    "mark_legitimate",
    "mark_suspicious",
    "confirm_scam",
    "soft_delete",
    "restore",
    "revalidate",
  ]),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = reviewSchema.parse(await request.json());

    const user = await prisma.gitHubUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "soft_delete") {
      const updated = await prisma.gitHubUser.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "user.soft_delete",
        entityType: "GitHubUser",
        entityId: id,
        details: { note: body.note },
      });
      return NextResponse.json(updated);
    }

    if (body.action === "restore") {
      const updated = await prisma.gitHubUser.update({
        where: { id },
        data: { deletedAt: null },
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "user.restore",
        entityType: "GitHubUser",
        entityId: id,
      });
      return NextResponse.json(updated);
    }

    if (body.action === "revalidate") {
      const config = user.lastScrapingJobId
        ? await prisma.scrapingJob.findUnique({
            where: { id: user.lastScrapingJobId },
            include: { configuration: { include: { ruleSet: { include: { rules: true } } } } },
          })
        : null;

      const ruleSet =
        config?.configuration.ruleSet ??
        (await prisma.scamRuleSet.findFirst({
          where: { enabled: true },
          include: { rules: true },
          orderBy: { updatedAt: "desc" },
        }));

      const raw = JSON.parse(user.rawProfile) as GitHubUserProfile;
      const normalized = normalizeGitHubProfile(raw);
      const decision = validateProfile(normalized, ruleSet);

      const previousStatus = user.validationStatus;
      const updated = await prisma.gitHubUser.update({
        where: { id },
        data: {
          validationStatus: decision.excluded ? "suspicious" : decision.status,
          riskScore: decision.riskScore,
          matchedRuleIds: toJsonArray(decision.matchedRuleIds),
          validationReasons: toJsonArray(decision.reasons),
        },
      });

      await prisma.userValidationHistory.create({
        data: {
          githubUserId: id,
          previousStatus,
          newStatus: updated.validationStatus,
          riskScore: decision.riskScore,
          matchedRuleIds: toJsonArray(decision.matchedRuleIds),
          reasons: toJsonArray(decision.reasons),
          note: body.note ?? "Re-ran validation",
          reviewedById: session.user.id,
          source: "revalidate",
        },
      });

      return NextResponse.json(updated);
    }

    const statusMap = {
      mark_legitimate: "legitimate",
      mark_suspicious: "suspicious",
      confirm_scam: "confirmed_scam",
    } as const;

    const newStatus = statusMap[body.action];
    const previousStatus = user.validationStatus;

    const updated = await prisma.gitHubUser.update({
      where: { id },
      data: {
        validationStatus: newStatus,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.userValidationHistory.create({
      data: {
        githubUserId: id,
        previousStatus,
        newStatus,
        riskScore: user.riskScore,
        matchedRuleIds: user.matchedRuleIds,
        reasons: user.validationReasons,
        note: body.note ?? null,
        reviewedById: session.user.id,
        source: "manual",
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: `user.${body.action}`,
      entityType: "GitHubUser",
      entityId: id,
      details: { previousStatus, newStatus, note: body.note },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
