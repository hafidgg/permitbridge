/** scripts/knowledge-base/rn-core-audit.ts — Usage: npm run kb:core-audit */
import { writeCoreAudit } from "../../lib/knowledge-base/rn-core-audit";
const { statsPath, matrixPath } = writeCoreAudit();
console.log(`RN core audit written:\n  ${statsPath}\n  ${matrixPath}`);
