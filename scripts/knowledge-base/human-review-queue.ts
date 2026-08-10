/** scripts/knowledge-base/human-review-queue.ts — Usage: npm run kb:human-review */
import { writeHumanReviewQueue, writeSampleReviewPackets } from "../../lib/knowledge-base/human-review";
const { jsonPath, count } = writeHumanReviewQueue();
console.log(`Human review queue written: ${jsonPath} (${count} items)`);
const { mdPath } = writeSampleReviewPackets(10);
console.log(`Sample review packets written: ${mdPath}`);
