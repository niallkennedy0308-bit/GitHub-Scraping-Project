import { prisma } from "@/lib/db";

const TERMINAL = ["completed", "completed_with_errors", "failed", "cancelled"] as const;

export async function deleteScrapingJob(jobId: string) {
  const job = await prisma.scrapingJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  if (job.status === "running" || job.status === "queued") {
    throw new Error("Cancel the job before deleting it from history");
  }

  await prisma.$transaction(async (tx) => {
    await tx.gitHubUser.updateMany({
      where: { lastScrapingJobId: jobId },
      data: { lastScrapingJobId: null },
    });
    await tx.scrapingJob.delete({ where: { id: jobId } });
  });

  return job;
}

export async function deleteFinishedScrapingJobs(ids?: string[]) {
  const where =
    ids && ids.length
      ? { id: { in: ids }, status: { in: [...TERMINAL] } }
      : { status: { in: [...TERMINAL] } };

  const jobs = await prisma.scrapingJob.findMany({
    where,
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  if (jobIds.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.gitHubUser.updateMany({
      where: { lastScrapingJobId: { in: jobIds } },
      data: { lastScrapingJobId: null },
    });
    await tx.scrapingJob.deleteMany({ where: { id: { in: jobIds } } });
  });

  return jobIds.length;
}
