import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { portalGithubSelect } from "@/lib/portal/github-query";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const user = await prisma.gitHubUser.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...portalGithubSelect,
        profileReadme: true,
        firstScrapedAt: true,
        validationReasons: true,
        savedByUsers: {
          where: { userId: session.user.id },
          select: { id: true, createdAt: true, notes: true },
          take: 1,
        },
        scamReports: {
          where: {
            reporterUserId: session.user.id,
            status: { in: ["pending", "under_review"] },
          },
          select: { id: true, status: true, reason: true, createdAt: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Confirmed scams are not discoverable; allow detail only if already saved.
    if (user.validationStatus === "confirmed_scam" && user.savedByUsers.length === 0) {
      return NextResponse.json({ error: "This profile is not available" }, { status: 404 });
    }

    const { savedByUsers, scamReports, validationReasons, ...rest } = user;
    return NextResponse.json({
      ...rest,
      isSaved: savedByUsers.length > 0,
      contactId: savedByUsers[0]?.id ?? null,
      savedAt: savedByUsers[0]?.createdAt ?? null,
      openReport: scamReports[0] ?? null,
      // High-level reasons only — not internal rule IDs / admin notes.
      validationHints:
        user.validationStatus === "suspicious" || user.validationStatus === "pending"
          ? (() => {
              try {
                return JSON.parse(validationReasons || "[]") as string[];
              } catch {
                return [] as string[];
              }
            })()
          : [],
    });
  } catch (error) {
    return jsonError(error);
  }
}
