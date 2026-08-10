/** scripts/knowledge-base/transfer-publication-report.ts — Usage: npm run kb:transfer-publication */
import { writeTransferPublicationReport } from "../../lib/knowledge-base/transfer-review-queue";
const { jsonPath, mdPath } = writeTransferPublicationReport();
console.log(`Publication report written:\n  ${jsonPath}\n  ${mdPath}`);
