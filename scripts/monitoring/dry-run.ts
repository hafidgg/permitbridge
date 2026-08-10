/**
 * scripts/monitoring/dry-run.ts
 * Usage: npm run monitor:dry-run -- [--mode=live|mock]
 *
 * Fetches, normalizes, hashes, and classifies exactly like a real run —
 * but creates NO DetectedChange records, saves NO registry updates, and
 * leaves every file on disk byte-identical to before. Every line below
 * is prefixed "WOULD" specifically so its output can never be confused
 * with an actual mutation report.
 */
import { runMonitoringCycle } from "../../lib/monitoring/run";

function parseMode(argv: string[]): "live" | "mock" {
  const arg = argv.find((a) => a.startsWith("--mode="));
  const value = arg?.split("=")[1];
  return value === "mock" ? "mock" : "live";
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  console.log(`DRY RUN — monitoring cycle (mode: ${mode}). No files will be written.\n`);

  const summary = await runMonitoringCycle({ mode, dryRun: true });

  console.log(`WOULD CHECK: ${summary.sourcesChecked} source(s) (of ${summary.sourcesConsidered} total registered)\n`);

  for (const r of summary.results) {
    console.log(`  ${r.sourceId}: fetch -> ${r.fetchStatus}`);
    if (r.wouldCreateChange) {
      console.log(`    WOULD DETECT: ${r.classification}`);
      console.log(`    WOULD QUEUE: a new pending_verification DetectedChange`);
    } else {
      console.log(`    WOULD DETECT: NO_CHANGE — nothing to queue`);
    }
    console.log(`    WOULD UPDATE HEALTH: lastCheckedAt, consecutiveFailures, etc. for ${r.sourceId}`);
  }

  console.log(`\nActual mutations performed: NONE. Registry and changes directory left untouched.`);
  console.log(`Re-run without --dry-run (npm run monitor) once you're satisfied with this report.`);
}

main().catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});
