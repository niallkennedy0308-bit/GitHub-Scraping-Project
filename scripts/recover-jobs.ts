import "dotenv/config";
import { recoverOrphanedJobs } from "../src/lib/services/scraper";

async function main() {
  const result = await recoverOrphanedJobs();
  console.log("[recover-jobs]", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
