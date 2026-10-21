import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { USER_REPORT_DESCRIPTION, USER_REPORT_REASON } from "@/lib/portal/constants";
import { writeAuditLog } from "@/lib/services/audit";

const createSchema = z.object({
  githubUserId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));
    const status = searchParams.get("status");

    const where = {
      reporterUserId: session.user.id,
      ...(status ? { status: status as "pending" | "under_review" | "resolved" | "dismissed" } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.scamReport.count({ where }),
      prisma.scamReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reason: true,
          description: true,
          evidenceUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          reviewedAt: true,
          githubUser: {
            select: {
              id: true,
              login: true,
              name: true,
              avatarUrl: true,
              htmlUrl: true,
              validationStatus: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = createSchema.parse(await request.json());

    const githubUser = await prisma.gitHubUser.findFirst({
      where: { id: body.githubUserId, deletedAt: null },
      select: { id: true, login: true, validationStatus: true },
    });
    if (!githubUser) {
      return NextResponse.json({ error: "GitHub profile not found" }, { status: 404 });
    }
    if (githubUser.validationStatus === "confirmed_scam") {
      return NextResponse.json(
        { error: "This profile is already confirmed as a scam" },
        { status: 400 },
      );
    }

    const existing = await prisma.scamReport.findFirst({
      where: {
        githubUserId: githubUser.id,
        reporterUserId: session.user.id,
        status: { in: ["pending", "under_review"] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "You already have an open report for this profile",
          reportId: existing.id,
          status: existing.status,
        },
        { status: 409 },
      );
    }

    // Simple per-user rate limit: max 10 reports in the last hour.
    const recentCount = await prisma.scamReport.count({
      where: {
        reporterUserId: session.user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recentCount >= 10) {
      return NextResponse.json(
        { error: "Too many reports submitted recently. Please try again later." },
        { status: 429 },
      );
    }

    const report = await prisma.scamReport.create({
      data: {
        githubUserId: githubUser.id,
        reporterUserId: session.user.id,
        reason: USER_REPORT_REASON,
        description: USER_REPORT_DESCRIPTION,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "portal.scam_report.create",
      entityType: "ScamReport",
      entityId: report.id,
      details: { githubUserId: githubUser.id, login: githubUser.login },
    });

    return NextResponse.json(
      {
        ...report,
        message:
          "Your report has been submitted successfully. An administrator will review the reported profile.",
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
