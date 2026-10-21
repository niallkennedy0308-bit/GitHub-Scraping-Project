import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  buildPortalGithubWhere,
  parsePortalGithubListParams,
  portalGithubSelect,
} from "@/lib/portal/github-query";
import { writeAuditLog } from "@/lib/services/audit";

const createSchema = z.object({
  githubUserId: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const { searchParams } = new URL(request.url);
    const params = parsePortalGithubListParams(searchParams);
    // Contacts may include previously saved profiles that later became confirmed_scam.
    const where = buildPortalGithubWhere(
      { ...params, includeConfirmedScam: true },
      { contactsOnlyUserId: session.user.id },
    );

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
            select: { id: true, createdAt: true, notes: true },
            take: 1,
          },
        },
      }),
    ]);

    return NextResponse.json({
      items: items.map(({ savedByUsers, ...user }) => ({
        ...user,
        isSaved: true,
        contactId: savedByUsers[0]?.id ?? null,
        savedAt: savedByUsers[0]?.createdAt ?? null,
        notes: savedByUsers[0]?.notes ?? null,
        unavailable: user.validationStatus === "confirmed_scam",
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
        { error: "Confirmed scam profiles cannot be saved as contacts" },
        { status: 400 },
      );
    }

    const contact = await prisma.userGithubContact.upsert({
      where: {
        userId_githubUserId: {
          userId: session.user.id,
          githubUserId: githubUser.id,
        },
      },
      create: {
        userId: session.user.id,
        githubUserId: githubUser.id,
        notes: body.notes?.trim() || null,
      },
      update: {
        notes: body.notes?.trim() || undefined,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "portal.contact.save",
      entityType: "UserGithubContact",
      entityId: contact.id,
      details: { githubUserId: githubUser.id, login: githubUser.login },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
