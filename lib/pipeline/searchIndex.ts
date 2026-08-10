/**
 * lib/pipeline/searchIndex.ts
 *
 * IMPORTANT — this does NOT change how search works on the live site.
 * The UI's search box (components/home/SearchBox.tsx) still gets its index
 * from lib/search.ts → buildSearchIndex(), computed at build/request time
 * exactly as before.
 *
 * What this module adds is a *persisted snapshot* of that same index,
 * written to public/data/search-index.json after every pipeline run. Two
 * reasons this is useful even though the UI doesn't read it:
 *
 *   1. CI can diff search-index.json between runs to catch pipeline bugs
 *      early (e.g. a run that silently produced zero transfer documents).
 *   2. It's a ready-made artifact if the site later wants client-side
 *      fetch-based search instead of embedding the index in each page's
 *      server-rendered props — a future optimization, not required now.
 *
 * Rebuilding it is always safe: it's a read-only projection of /data.
 */
import fs from "node:fs";
import path from "node:path";
import { buildSearchIndex } from "@/lib/search";

const OUTPUT_PATH = path.join(process.cwd(), "public", "data", "search-index.json");

export function rebuildSearchIndexSnapshot(): { documentCount: number; outputPath: string } {
  const index = buildSearchIndex();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), documentCount: index.length, documents: index }, null, 2)
  );

  return { documentCount: index.length, outputPath: OUTPUT_PATH };
}
