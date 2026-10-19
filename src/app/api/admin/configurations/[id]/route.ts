import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { scrapingConfigSchema, validateAndParseGitHubSearch } from "@/lib/github-url";
import { writeAuditLog } from "@/lib/services/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const config = await prisma.scrapingConfiguration.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        ruleSet: { include: { rules: { orderBy: { sortOrder: "asc" } } } },
        jobs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.scrapingConfiguration.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (body.name !== undefined || body.githubSearchUrl !== undefined || body.description !== undefined) {
      const parsed = scrapingConfigSchema.partial().parse(body);
      if (parsed.name !== undefined) data.name = parsed.name;
      if (parsed.description !== undefined) data.description = parsed.description;
      if (parsed.enabled !== undefined) data.enabled = parsed.enabled;
      if (parsed.ruleSetId !== undefined) data.ruleSetId = parsed.ruleSetId;
      if (parsed.githubSearchUrl !== undefined) {
        const github = validateAndParseGitHubSearch(parsed.githubSearchUrl);
        data.githubSearchUrl = github.githubSearchUrl;
        data.searchQuery = github.searchQuery;
      }
    } else {
      if (typeof body.enabled === "boolean") data.enabled = body.enabled;
      if (body.ruleSetId !== undefined) data.ruleSetId = body.ruleSetId;
    }

    const updated = await prisma.scrapingConfiguration.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        ruleSet: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "configuration.update",
      entityType: "ScrapingConfiguration",
      entityId: id,
      details: data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await prisma.scrapingConfiguration.delete({ where: { id } });
    await writeAuditLog({
      actorId: session.user.id,
      action: "configuration.delete",
      entityType: "ScrapingConfiguration",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
