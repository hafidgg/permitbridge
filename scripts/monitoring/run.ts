/**
 * scripts/monitoring/run.ts
 * Usage: npm run monitor -- [--mode=live|mock]
 *
 * Runs one real monitoring cycle against the actual on-disk registry.
 * With zero real sources registered (Phase 4.11's job, not this one),
 * this will honestly report "0 sources due" today — that's correct, not
 * a bug. Never approves/publishes anything; only ever creates
 * pending_verification DetectedChange records.
 */
import { runMonitoringCycle } from "../../lib/monitoring/run";

function parseMode(argv: string[]): "live" | "mock" {
  const arg = argv.find((a) => a.startsWith("--mode="));
  const value = arg?.split("=")[1];
  return value === "mock" ? "mock" : "live";
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  console.log(`Running monitoring cycle (mode: ${mode})...\n`);

  const summary = await runMonitoringCycle({ mode });

  console.log(`Sources considered: ${summary.sourcesConsidered}`);
  console.log(`Sources checked (due): ${summary.sourcesChecked}`);
  console.log(`Changes detected: ${summary.changesDetected}`);
  console.log(`Changes queued for review: ${summary.changesQueued}\n`);

  for (const r of summary.results) {
    console.log(`  ${r.sourceId}: ${r.fetchStatus} -> ${r.classification}${r.changeCreated ? ` (queued: ${r.changeId})` : ""}`);
  }

  console.log(`\nHealth before: ${JSON.stringify(summary.healthBefore)}`);
  console.log(`Health after:  ${JSON.stringify(summary.healthAfter)}`);

  if (summary.changesQueued > 0) {
    console.log(`\n${summary.changesQueued} change(s) awaiting human review — run: npm run monitor:review`);
  }
}

main().catch((err) => {
  console.error("Monitoring cycle failed:", err);
  process.exit(1);
});
