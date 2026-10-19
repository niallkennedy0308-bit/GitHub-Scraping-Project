import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const [
      totalUsers,
      legitimateUsers,
      suspiciousUsers,
      confirmedScamUsers,
      totalJobs,
      latestCompleted,
    ] = await Promise.all([
      prisma.gitHubUser.count({ where: { deletedAt: null } }),
      prisma.gitHubUser.count({ where: { deletedAt: null, validationStatus: "legitimate" } }),
      prisma.gitHubUser.count({ where: { deletedAt: null, validationStatus: "suspicious" } }),
      prisma.gitHubUser.count({ where: { deletedAt: null, validationStatus: "confirmed_scam" } }),
      prisma.scrapingJob.count(),
      prisma.scrapingJob.findFirst({
        where: { status: { in: ["completed", "completed_with_errors"] } },
        orderBy: { completedAt: "desc" },
        select: { newUsers: true, id: true, completedAt: true },
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      legitimateUsers,
      suspiciousUsers,
      confirmedScamUsers,
      totalJobs,
      latestJobNewUsers: latestCompleted?.newUsers ?? 0,
      latestJobId: latestCompleted?.id ?? null,
      latestJobCompletedAt: latestCompleted?.completedAt ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
