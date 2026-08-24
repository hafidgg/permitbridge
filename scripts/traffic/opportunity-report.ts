import fs from "node:fs";
import path from "node:path";
import { normalizeQuery, classifyGeo } from "../../lib/traffic/geo-classifier";
import { classifyIntent } from "../../lib/traffic/intent-classifier";
import { buildOpportunityQueue } from "../../lib/traffic/opportunity-engine";
import type { GscSnapshot } from "../../lib/integrations/google-search-console/types";

/**
 * Phase 2C.3 — reads the real, already-persisted GSC snapshot
 * (data/gsc-snapshots/latest.json, produced by the existing
 * scripts/monitoring/gsc-monitor.ts workflow) and turns its real
 * topQueries into a US-first-prioritized, human-reviewable opportunity
 * queue.
 *
 * This script NEVER calls the GSC API itself, never publishes anything,
 * never touches the knowledge-base — purely reads one existing snapshot
 * file and writes one new internal report. Output location follows the
 * exact same convention as every other internal report in this project
 * (data/_pipeline/reports/) — never served by any public route.
 *
 * If no real snapshot exists yet, or the snapshot predates Phase 2C.2
 * (no topQueries field), this exits cleanly reporting
 * NO_REAL_GSC_DATA / INSUFFICIENT_REAL_DATA rather than fabricating
 * anything — the real-data guardrail (Step 21) applies here too.
 *
 * Usage: npx tsx scripts/traffic/opportunity-report.ts
 */
const SNAPSHOT_PATH = path.join(process.cwd(), "data", "gsc-snapshots", "latest.json");
const REPORT_PATH = path.join(process.cwd(), "data", "_pipeline", "reports", "traffic-opportunities.json");

function main() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.log("[traffic-opportunities] NO_REAL_GSC_DATA — no snapshot found at " + SNAPSHOT_PATH + ". Nothing generated.");
    return;
  }

  const snapshot: GscSnapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));

  if (!snapshot.topQueries || snapshot.topQueries.length === 0) {
    console.log("[traffic-opportunities] INSUFFICIENT_REAL_DATA — snapshot exists but has no topQueries (pre-Phase-2C.2 snapshot, or GSC genuinely returned zero query rows). Nothing generated.");
    return;
  }

  const opportunities = buildOpportunityQueue(snapshot.topQueries, normalizeQuery, classifyGeo, classifyIntent);

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceSnapshotGeneratedAt: snapshot.generatedAt,
    totalOpportunities: opportunities.length,
    byClassification: opportunities.reduce<Record<string, number>>((acc, o) => {
      acc[o.classification] = (acc[o.classification] ?? 0) + 1;
      return acc;
    }, {}),
    byGeoRelevance: opportunities.reduce<Record<string, number>>((acc, o) => {
      acc[o.geoRelevance] = (acc[o.geoRelevance] ?? 0) + 1;
      return acc;
    }, {}),
    // reviewRequired is always true on every item — this report is
    // intelligence for a human reviewer, never a publish instruction.
    opportunities,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2) + "\n");

  console.log(`[traffic-opportunities] REAL_GSC_DATA_AVAILABLE — ${opportunities.length} opportunities generated from ${snapshot.topQueries.length} real query rows.`);
  console.log(`[traffic-opportunities] By classification:`, summary.byClassification);
  console.log(`[traffic-opportunities] Report written to ${REPORT_PATH}`);
}

main();
