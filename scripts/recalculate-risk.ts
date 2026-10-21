/**
 * Sync rule weights and recalculate GitHub user risk scores.
 * Usage: npx tsx scripts/recalculate-risk.ts
 */
import "dotenv/config";
import {
  recalculateAllRiskScores,
  syncRuleScoreWeights,
} from "../src/lib/services/recalculate-risk";

async function main() {
  const weightsUpdated = await syncRuleScoreWeights();
  console.log(`Updated scoreWeight on ${weightsUpdated} rule(s).`);
  const result = await recalculateAllRiskScores();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
