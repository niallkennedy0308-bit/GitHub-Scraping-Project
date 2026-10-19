import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const user = await prisma.gitHubUser.findUnique({
      where: { id },
      include: {
        history: {
          orderBy: { createdAt: "desc" },
          include: { reviewedBy: { select: { id: true, email: true, name: true } } },
        },
        jobUsers: {
          orderBy: { createdAt: "desc" },
          include: { job: { select: { id: true, status: true, createdAt: true, completedAt: true } } },
        },
        lastScrapingJob: { select: { id: true, status: true, completedAt: true } },
      },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...user,
      matchedRuleIds: parseJsonArray(user.matchedRuleIds),
      validationReasons: parseJsonArray(user.validationReasons),
      rawProfile: JSON.parse(user.rawProfile),
    });
  } catch (error) {
    return jsonError(error);
  }
}
