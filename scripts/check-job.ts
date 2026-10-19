import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const j = await prisma.scrapingJob.findFirst({
    orderBy: { createdAt: "desc" },
    include: { errors: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  console.log(
    JSON.stringify(
      {
        id: j?.id,
        status: j?.status,
        progress: j?.progressMessage,
        discovered: j?.profilesDiscovered,
        newUsers: j?.newUsers,
        dup: j?.duplicateUsers,
        flagged: j?.flaggedUsers,
        errors: j?.errorCount,
        cancel: j?.cancelRequested,
        startedAt: j?.startedAt,
        completedAt: j?.completedAt,
        updatedAt: j?.updatedAt,
        recentErrors: j?.errors,
      },
      null,
      2,
    ),
  );
}

main()
  .finally(() => prisma.$disconnect());
