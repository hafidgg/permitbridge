/**
 * scripts/knowledge-base/trust-report.ts
 * Usage: npm run kb:trust
 */
import { recomputeSourceUsage } from "../../lib/knowledge-base/sources";
import { writeTrustReport } from "../../lib/knowledge-base/trust";

const usage = recomputeSourceUsage();
console.log(`Source usage recomputed (${usage.updated} source record(s) updated).`);

const { jsonPath, mdPath, report } = writeTrustReport();
console.log(`\nTrust report written:\n  ${jsonPath}\n  ${mdPath}`);
console.log(`Verification coverage: ${report.verificationCoveragePct}% · Average confidence: ${report.averageConfidence} · Fields missing source: ${report.fieldsMissingSource}`);
