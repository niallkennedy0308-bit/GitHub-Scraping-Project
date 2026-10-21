import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getAdminGitHubToken } from "@/lib/services/admin-token";
import { writeAuditLog } from "@/lib/services/audit";
import { deleteFinishedScrapingJobs } from "@/lib/services/jobs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get("take") || 50), 100);

    const jobs = await prisma.scrapingJob.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: {
        configuration: { select: { id: true, name: true } },
        startedBy: { select: { id: true, email: true, name: true } },
      },
    });
    return NextResponse.json(jobs);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const configurationId = String(body.configurationId || "");

    const token = await getAdminGitHubToken(session.user.id);
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Add your GitHub personal access token in Settings before starting a scraping job.",
          code: "GITHUB_TOKEN_REQUIRED",
        },
        { status: 400 },
      );
    }

    const config = await prisma.scrapingConfiguration.findUnique({
      where: { id: configurationId },
    });
    if (!config) return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    if (!config.enabled) {
      return NextResponse.json({ error: "Configuration is disabled" }, { status: 400 });
    }

    const priorJobs = await prisma.scrapingJob.count({
      where: { configurationId: config.id },
    });
    if (priorJobs > 0) {
      return NextResponse.json(
        {
          error:
            "This search URL has already been used. URLs are not reused. Delete the configuration if you need to set the same search up again.",
        },
        { status: 409 },
      );
    }

    const job = await prisma.scrapingJob.create({
      data: {
        configurationId: config.id,
        githubSearchUrl: config.githubSearchUrl,
        searchQuery: config.searchQuery,
        status: "queued",
        startedById: session.user.id,
        progressMessage: "Queued",
      },
      include: {
        configuration: { select: { id: true, name: true } },
        startedBy: { select: { id: true, email: true, name: true } },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "job.start",
      entityType: "ScrapingJob",
      entityId: job.id,
      details: { configurationId: config.id },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

const clearSchema = z.object({
  ids: z.array(z.string()).optional(),
  clearAllFinished: z.boolean().optional(),
});

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin();
    const body = clearSchema.parse(await request.json().catch(() => ({})));

    if (!body.clearAllFinished && (!body.ids || body.ids.length === 0)) {
      return NextResponse.json(
        { error: "Provide job ids or set clearAllFinished=true" },
        { status: 400 },
      );
    }

    const deleted = await deleteFinishedScrapingJobs(
      body.clearAllFinished ? undefined : body.ids,
    );

    await writeAuditLog({
      actorId: session.user.id,
      action: "job.history_delete",
      entityType: "ScrapingJob",
      details: { deleted, ids: body.ids, clearAllFinished: body.clearAllFinished },
    });

    return NextResponse.json({ deleted });
  } catch (error) {
    return jsonError(error);
  }
}
