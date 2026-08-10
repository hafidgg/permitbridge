/**
 * scripts/monitoring/changes.ts
 * Usage: npm run monitor:changes
 *
 * Lists every persisted DetectedChange, sorted by priority (High first).
 * Read-only — never mutates anything.
 */
import { listDetectedChanges } from "../../lib/monitoring/change-record";
import { toReviewItem } from "../../lib/monitoring/review-integration";
import { classifyFieldRisk } from "../../lib/monitoring/field-classification";
import type { FieldSchema } from "../../lib/monitoring/field-classification";

const changes = listDetectedChanges();

if (changes.length === 0) {
  console.log("✔ No detected changes on record.");
  process.exit(0);
}

console.log(`\n${changes.length} detected change(s) on record.\n`);

for (const change of changes) {
  const schema: FieldSchema = change.destinationJurisdiction ? "transfer-rule" : "profession-state-facts";
  const risk = change.field ? classifyFieldRisk(change.field, schema) : "medium";
  const item = toReviewItem(change, risk);

  console.log("──────────────────────────────────────────");
  console.log(`[${item.priority}] ${item.classification}  —  ${item.status}`);
  console.log(`  id: ${item.detectedChangeId}`);
  console.log(`  ${item.jurisdiction}${change.destinationJurisdiction ? ` -> ${change.destinationJurisdiction}` : ""} / ${item.profession ?? "?"} / ${item.field ?? "(source-level)"}`);
  console.log(`  ${JSON.stringify(item.previousValue)} -> ${JSON.stringify(item.proposedValue)}`);
  console.log(`  source: ${item.sourceUrl}`);
  console.log(`  confidence: ${item.confidence}${item.jurisdictionMismatch ? "  ⚠ JURISDICTION MISMATCH" : ""}`);
  console.log("");
}
