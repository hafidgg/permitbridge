/**
 * scripts/pipeline/run.ts
 *
 * CLI entry point for the data pipeline.
 *
 * Usage:
 *   npm run pipeline                 # live mode, applies low/medium risk changes
 *   npm run pipeline:dry-run          # mock fixtures, writes nothing, just reports
 *   npm run pipeline -- --mode=mock   # force mock mode with real writes (for local testing against fixtures)
 */
import { runPipeline } from "../../lib/pipeline/run";

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes("--mode=mock") ? "mock" : args.includes("--mode=live") ? "live" : "live";
  const dryRun = args.includes("--dry-run");
  return { mode: mode as "live" | "mock", dryRun };
}

async function main() {
  const { mode, dryRun } = parseArgs();
  const summary = await runPipeline({ mode, dryRun });

  if (summary.validationErrors > 0) {
    console.warn(`\n⚠ Completed with ${summary.validationErrors} validation error(s) — check the output above.`);
  }
  if (summary.changesPendingApproval > 0) {
    console.log(`\n👉 ${summary.changesPendingApproval} change(s) need review: run "npm run pipeline:approve"`);
  }
}

main().catch((err) => {
  console.error("Pipeline run failed:", err);
  process.exit(1);
});
