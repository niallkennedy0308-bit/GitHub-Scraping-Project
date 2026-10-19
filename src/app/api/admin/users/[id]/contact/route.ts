import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import type { GitHubUserProfile } from "@/lib/github/client";
import { normalizeGitHubProfile } from "@/lib/github/normalize";
import { writeAuditLog } from "@/lib/services/audit";
import {
  isBlank,
  normalizeEmailInput,
  normalizeLinkedInInput,
} from "@/lib/services/contact-info";
import { validateProfile } from "@/lib/services/validation";
import { parseJsonArray, toJsonArray } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    email: z.string().optional().nullable(),
    linkedinUrl: z.string().optional().nullable(),
  })
  .refine((body) => Boolean(body.email?.trim() || body.linkedinUrl?.trim()), {
    message: "Provide an email and/or LinkedIn URL",
  });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const user = await prisma.gitHubUser.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updates: { email?: string; linkedinUrl?: string } = {};
    const added: string[] = [];

    if (body.email?.trim()) {
      if (!isBlank(user.email)) {
        return NextResponse.json(
          { error: "Email is already set for this profile" },
          { status: 400 },
        );
      }
      updates.email = normalizeEmailInput(body.email);
      added.push("email");
    }

    if (body.linkedinUrl?.trim()) {
      if (!isBlank(user.linkedinUrl)) {
        return NextResponse.json(
          { error: "LinkedIn URL is already set for this profile" },
          { status: 400 },
        );
      }
      updates.linkedinUrl = normalizeLinkedInInput(body.linkedinUrl);
      added.push("linkedinUrl");
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const nextEmail = updates.email ?? user.email;
    const nextLinkedIn = updates.linkedinUrl ?? user.linkedinUrl;

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
    const normalized = normalizeGitHubProfile({
      ...raw,
      email: nextEmail ?? raw.email ?? null,
    });
    normalized.profileForRules = {
      ...normalized.profileForRules,
      email: nextEmail,
      linkedin_url: nextLinkedIn,
      linkedinUrl: nextLinkedIn,
    };

    const preserveManual =
      user.reviewedAt != null ||
      user.validationStatus === "legitimate" ||
      user.validationStatus === "confirmed_scam";

    const decision = validateProfile(normalized, ruleSet);
    const previousStatus = user.validationStatus;

    const updated = await prisma.gitHubUser.update({
      where: { id },
      data: {
        ...updates,
        ...(preserveManual
          ? {}
          : {
              validationStatus: decision.excluded ? "suspicious" : decision.status,
              riskScore: decision.riskScore,
              matchedRuleIds: toJsonArray(decision.matchedRuleIds),
              validationReasons: toJsonArray(decision.reasons),
            }),
      },
      include: {
        jobUsers: {
          orderBy: { createdAt: "desc" },
          include: { job: { select: { id: true, status: true, createdAt: true, completedAt: true } } },
        },
      },
    });

    if (!preserveManual) {
      await prisma.userValidationHistory.create({
        data: {
          githubUserId: id,
          previousStatus,
          newStatus: updated.validationStatus,
          riskScore: updated.riskScore,
          matchedRuleIds: updated.matchedRuleIds,
          reasons: updated.validationReasons,
          note: `Contact info added (${added.join(", ")}) by ${session.user.role}`,
          reviewedById: session.user.id,
          source: "contact_update",
        },
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "user.contact_update",
      entityType: "GitHubUser",
      entityId: id,
      details: { added, role: session.user.role },
    });

    return NextResponse.json({
      ...updated,
      matchedRuleIds: parseJsonArray(updated.matchedRuleIds),
      validationReasons: parseJsonArray(updated.validationReasons),
    });
  } catch (error) {
    return jsonError(error);
  }
}
