/**
 * scripts/generate-gone-paths.ts
 *
 * Writes lib/generated/gone-transfer-paths.json: every /transfer pair with a
 * data/transfers file that fails isTradeTransferPublishable(). middleware.ts
 * answers those paths with 410 (it runs on the edge and can't read data/).
 * Runs as `prebuild`, so a pair drops off the list, and its page comes back,
 * on the first build after it gets a registered source. The file is
 * committed; `npm test` fails if it's out of date.
 *
 * Usage: npm run generate-gone-paths
 */
import fs from "node:fs";
import path from "node:path";
import { computeGoneTransferPaths } from "../lib/gone-transfer-paths";

const out = path.join(process.cwd(), "lib", "generated", "gone-transfer-paths.json");
const paths = computeGoneTransferPaths();
fs.writeFileSync(out, JSON.stringify(paths, null, 2) + "\n");
console.log(`Wrote ${paths.length} gone /transfer paths to ${path.relative(process.cwd(), out)}`);
