import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(["pending", "under_review", "resolved", "dismissed"]).optional(),
  adminNotes: z.string().max(4000).optional().nullable(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const report = await prisma.scamReport.findUnique({
      where: { id },
      include: {
        githubUser: {
          select: {
            id: true,
            login: true,
            name: true,
            avatarUrl: true,
            htmlUrl: true,
            validationStatus: true,
            riskScore: true,
            validationReasons: true,
            bio: true,
            location: true,
            company: true,
          },
        },
        reporter: { select: { id: true, email: true, name: true } },
        reviewedBy: { select: { id: true, email: true, name: true } },
      },
    });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const relatedReports = await prisma.scamReport.findMany({
      where: { githubUserId: report.githubUserId, id: { not: report.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: { select: { email: true } },
      },
    });

    return NextResponse.json({ ...report, relatedReports });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.scamReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const statusChanging = body.status && body.status !== existing.status;
    const updated = await prisma.scamReport.update({
      where: { id },
      data: {
        status: body.status,
        adminNotes: body.adminNotes === undefined ? undefined : body.adminNotes,
        ...(statusChanging
          ? {
              reviewedById: session.user.id,
              reviewedAt: new Date(),
            }
          : {}),
      },
      include: {
        githubUser: {
          select: { id: true, login: true, validationStatus: true },
        },
        reporter: { select: { id: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "admin.scam_report.update",
      entityType: "ScamReport",
      entityId: id,
      details: {
        status: updated.status,
        previousStatus: existing.status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
