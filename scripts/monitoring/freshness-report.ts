import { buildFreshnessReport, summarizeFreshness } from "../../lib/monitoring/content-freshness";

/**
 * Read-only audit tool. Prints the real freshness/update trail derived
 * from the actual DetectedChange archive — never writes anything.
 *
 * Usage: npx tsx scripts/monitoring/freshness-report.ts
 */
const events = buildFreshnessReport();
console.log(summarizeFreshness(events));
