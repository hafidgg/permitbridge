/**
 * scripts/knowledge-base/metric-audit.ts
 * Usage: npm run kb:audit
 */
import { writeMetricAuditReport } from "../../lib/knowledge-base/reconciliation";

const { jsonPath, mdPath } = writeMetricAuditReport("registered-nurse");
console.log(`Metric audit written:\n  ${jsonPath}\n  ${mdPath}`);
