import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { scrapingConfigSchema, validateAndParseGitHubSearch } from "@/lib/github-url";
import { writeAuditLog } from "@/lib/services/audit";

export async function GET() {
  try {
    await requireAdmin();
    const configs = await prisma.scrapingConfiguration.findMany({
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        ruleSet: { select: { id: true, name: true } },
        _count: { select: { jobs: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const parsed = scrapingConfigSchema.parse(body);
    const github = validateAndParseGitHubSearch(parsed.githubSearchUrl);

    const created = await prisma.scrapingConfiguration.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        githubSearchUrl: github.githubSearchUrl,
        searchQuery: github.searchQuery,
        enabled: parsed.enabled ?? true,
        ruleSetId: parsed.ruleSetId ?? null,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        ruleSet: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "configuration.create",
      entityType: "ScrapingConfiguration",
      entityId: created.id,
      details: { name: created.name },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
