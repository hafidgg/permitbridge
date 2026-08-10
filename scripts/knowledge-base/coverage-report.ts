/**
 * scripts/knowledge-base/coverage-report.ts
 * Usage: npm run kb:coverage
 */
import { writeCoverageReport } from "../../lib/knowledge-base/coverage";

const { jsonPath, mdPath, report } = writeCoverageReport();
console.log(`Coverage report written:\n  ${jsonPath}\n  ${mdPath}`);
console.log(`Overall: ${report.overallCompletionPct}% (${report.cellsComplete} complete / ${report.cellsPartial} partial / ${report.cellsMissing} missing / ${report.cellsNeedingReview} needs review, of ${report.totalCells} cells)`);
