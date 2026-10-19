import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const job = await prisma.scrapingJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (["completed", "completed_with_errors", "failed", "cancelled"].includes(job.status)) {
      return NextResponse.json({ error: "Job already finished" }, { status: 400 });
    }

    const updated = await prisma.scrapingJob.update({
      where: { id },
      data: {
        cancelRequested: true,
        status: job.status === "queued" ? "cancelled" : job.status,
        completedAt: job.status === "queued" ? new Date() : job.completedAt,
        progressMessage:
          job.status === "queued" ? "Cancelled before start" : "Cancellation requested…",
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "job.cancel",
      entityType: "ScrapingJob",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
