/**
 * scripts/monitoring/health.ts
 * Usage: npm run monitor:health
 *
 * Read-only source health report. Never fetches anything — purely
 * summarizes the registry as it currently stands on disk.
 */
import { loadMonitoringRegistry } from "../../lib/monitoring/registry";
import { summarizeSourceHealth, computeNextCheckAt, classifySourceHealth } from "../../lib/monitoring/health";

const registry = loadMonitoringRegistry();
const summary = summarizeSourceHealth(registry);

console.log("Source Health Summary\n");
console.log(`  Total monitored sources: ${summary.totalMonitoredSources}`);
console.log(`  Due for check:           ${summary.dueForCheck}`);
console.log(`  Healthy:                 ${summary.healthy}`);
console.log(`  Warning:                 ${summary.warning}`);
console.log(`  Failed:                  ${summary.failed}`);
console.log(`  Stale:                   ${summary.stale}`);
console.log(`  Disabled:                ${summary.disabled}`);
console.log(`  Never checked:           ${summary.neverChecked}`);
console.log(`  Avg. consecutive failures: ${summary.averageConsecutiveFailures.toFixed(2)}`);

if (registry.sources.length > 0) {
  console.log("\nPer-source detail:\n");
  for (const source of registry.sources) {
    const classification = classifySourceHealth(source);
    const nextCheck = computeNextCheckAt(source);
    console.log(`  [${classification}] ${source.id} — checks: ${source.totalChecks} (${source.successfulChecks} ok / ${source.failedChecks} failed), next check: ${nextCheck ?? "n/a"}`);
  }
} else {
  console.log("\nNo sources registered yet — Phase 4.11 will populate the first real pilot.");
}
