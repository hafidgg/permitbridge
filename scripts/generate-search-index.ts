/**
 * Prebuild: writes lib/generated/search-index.json from buildSearchIndex(), the same function /search and the
 * not-found page used to call on every request. Both returned 500 on the Cloudflare Workers preview, where
 * request-time reads of data/ are the likely cause. The index only changes when data changes, i.e. on deploy, so
 * a build-time snapshot gives identical output. Run with --conditions=react-server (lib/search is server-only).
 */
import fs from "node:fs";
import path from "node:path";
import { buildSearchIndex } from "../lib/search";

const out = path.join(process.cwd(), "lib", "generated", "search-index.json");
const docs = buildSearchIndex();
fs.writeFileSync(out, JSON.stringify(docs, null, 2) + "\n");
console.log(`search index: ${docs.length} documents -> ${path.relative(process.cwd(), out)}`);
