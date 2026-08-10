/**
 * scripts/knowledge-base/verification-queue.ts
 * Usage: npm run kb:queue
 */
import { writeVerificationQueue } from "../../lib/knowledge-base/queue";

const { jsonPath, report } = writeVerificationQueue();
const requiring = report.filter((i) => i.verificationRequired).length;
console.log(`Verification queue written: ${jsonPath}`);
console.log(`${report.length} total items, ${requiring} requiring verification.`);
