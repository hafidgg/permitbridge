/** scripts/knowledge-base/transfer-review-queue.ts — Usage: npm run kb:transfer-queue */
import { writeTransferReviewQueue } from "../../lib/knowledge-base/transfer-review-queue";
const { jsonPath, count } = writeTransferReviewQueue();
console.log(`Transfer review queue written: ${jsonPath} (${count} items)`);
