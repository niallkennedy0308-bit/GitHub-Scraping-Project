import "dotenv/config";
import {
  claimNextQueuedJob,
  recoverOrphanedJobs,
  runScrapingJob,
} from "../src/lib/services/scraper";

async function loop() {
  const pollMs = Number(process.env.SCRAPER_POLL_MS || 2000);
  console.log(`[worker] started (poll ${pollMs}ms)`);

  const recovered = await recoverOrphanedJobs();
  if (recovered.cancelled || recovered.stalled) {
    console.log(
      `[worker] recovered orphans: cancelled=${recovered.cancelled} stalled=${recovered.stalled}`,
    );
  }

  while (true) {
    try {
      const jobId = await claimNextQueuedJob();
      if (jobId) {
        console.log(`[worker] running job ${jobId}`);
        await runScrapingJob(jobId);
        console.log(`[worker] finished job ${jobId}`);
      } else {
        await new Promise((r) => setTimeout(r, pollMs));
      }
    } catch (error) {
      console.error("[worker] error", error);
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}

loop();
