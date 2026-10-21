import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
    const status = searchParams.get("status");
    const reason = (searchParams.get("reason") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    const where = {
      ...(status
        ? { status: status as "pending" | "under_review" | "resolved" | "dismissed" }
        : {}),
      ...(reason ? { reason: { contains: reason } } : {}),
      ...(q
        ? {
            OR: [
              { githubUser: { login: { contains: q } } },
              { githubUser: { name: { contains: q } } },
              { reporter: { email: { contains: q } } },
              { description: { contains: q } },
            ],
          }
        : {}),
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
          adminNotes: true,
          createdAt: true,
          reviewedAt: true,
          githubUser: {
            select: {
              id: true,
              login: true,
              name: true,
              avatarUrl: true,
              htmlUrl: true,
              validationStatus: true,
              riskScore: true,
            },
          },
          reporter: { select: { id: true, email: true, name: true } },
          reviewedBy: { select: { id: true, email: true, name: true } },
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
