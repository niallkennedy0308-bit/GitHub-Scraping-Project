import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  buildPortalGithubWhere,
  parsePortalGithubListParams,
  portalGithubSelect,
} from "@/lib/portal/github-query";

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const { searchParams } = new URL(request.url);
    const params = parsePortalGithubListParams(searchParams);
    const where = buildPortalGithubWhere(params);

    const [total, items] = await Promise.all([
      prisma.gitHubUser.count({ where }),
      prisma.gitHubUser.findMany({
        where,
        orderBy: { [params.sort]: params.order },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          ...portalGithubSelect,
          savedByUsers: {
            where: { userId: session.user.id },
            select: { id: true },
            take: 1,
          },
          scamReports: {
            where: { reporterUserId: session.user.id },
            select: { id: true, status: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    return NextResponse.json({
      items: items.map(({ savedByUsers, scamReports, ...user }) => ({
        ...user,
        isSaved: savedByUsers.length > 0,
        contactId: savedByUsers[0]?.id ?? null,
        reportStatus: scamReports[0]?.status ?? null,
      })),
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    });
  } catch (error) {
    return jsonError(error);
  }
}
