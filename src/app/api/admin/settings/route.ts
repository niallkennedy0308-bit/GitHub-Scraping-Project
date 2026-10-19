import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { verifyGitHubToken } from "@/lib/github/client";
import { writeAuditLog } from "@/lib/services/audit";
import { getAdminTokenStatus } from "@/lib/services/admin-token";
import { encryptSecret } from "@/lib/token-crypto";

const updateSchema = z.object({
  githubToken: z.string().min(8).max(255).optional(),
  clearToken: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    const status = await getAdminTokenStatus(session.user.id);
    return NextResponse.json({
      email: session.user.email,
      githubToken: status,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    const body = updateSchema.parse(await request.json());

    if (body.clearToken) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { githubTokenEncrypted: null },
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "settings.clear_github_token",
        entityType: "User",
        entityId: session.user.id,
      });
      return NextResponse.json({
        email: session.user.email,
        githubToken: { configured: false, maskedToken: null },
      });
    }

    if (!body.githubToken?.trim()) {
      return NextResponse.json({ error: "GitHub token is required" }, { status: 400 });
    }

    const token = body.githubToken.trim();
    const verified = await verifyGitHubToken(token);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { githubTokenEncrypted: encryptSecret(token) },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "settings.set_github_token",
      entityType: "User",
      entityId: session.user.id,
      details: { githubLogin: verified.login },
    });

    const status = await getAdminTokenStatus(session.user.id);
    return NextResponse.json({
      email: session.user.email,
      githubToken: status,
      verifiedAs: verified.login,
    });
  } catch (error) {
    return jsonError(error);
  }
}
