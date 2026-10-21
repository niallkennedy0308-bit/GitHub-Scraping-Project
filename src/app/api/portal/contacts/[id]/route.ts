import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const contact = await prisma.userGithubContact.findUnique({
      where: { id },
      select: { id: true, userId: true, githubUserId: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (contact.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.userGithubContact.delete({ where: { id: contact.id } });
    await writeAuditLog({
      actorId: session.user.id,
      action: "portal.contact.remove",
      entityType: "UserGithubContact",
      entityId: contact.id,
      details: { githubUserId: contact.githubUserId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
