/** scripts/knowledge-base/transfer-review-packets.ts — Usage: npm run kb:transfer-packets */
import { writeTransferRuleReviewPackets } from "../../lib/knowledge-base/transfer-review-packet";
const { mdPath, count } = writeTransferRuleReviewPackets();
console.log(`Review packets written for ${count} transfer rules: ${mdPath}`);
