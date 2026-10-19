import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { deleteScrapingJob } from "@/lib/services/jobs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const job = await prisma.scrapingJob.findUnique({
      where: { id },
      include: {
        configuration: { select: { id: true, name: true } },
        startedBy: { select: { id: true, email: true, name: true } },
        errors: { orderBy: { createdAt: "desc" }, take: 50 },
        _count: { select: { jobUsers: true } },
      },
    });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const deleted = await deleteScrapingJob(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await writeAuditLog({
      actorId: session.user.id,
      action: "job.delete",
      entityType: "ScrapingJob",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
