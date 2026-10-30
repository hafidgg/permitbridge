/**
 * scripts/guide-links.ts
 *
 * Guides hand-write their internal links (content/guides/*.md), and pages link
 * back to guides through getAllGuides()'s linkedFrom. A trade page can be
 * folded into a summary page (308) or withdrawn (410) without either side
 * noticing, so every such path must be a URL the sitemap actually serves.
 *
 * Run by check-sitemap.ts against the real URL set (`npm test` via --source,
 * `postbuild` via --build).
 */
import fs from "node:fs";
import path from "node:path";
import { getAllGuides } from "../lib/guides";

/** Internal paths linked from a guide's markdown: `](/...)`, without any #fragment. */
export function internalLinksIn(markdown: string): string[] {
  return [...markdown.matchAll(/\]\((\/[^)\s#]*)(?:#[^)\s]*)?\)/g)].map((m) => m[1] ?? "");
}

/** Problems for every guide link or linkedFrom path that is not a sitemap URL. Empty when all resolve. */
export function findBrokenGuideLinks(sitemapUrls: string[], guidesDir = path.join(process.cwd(), "content", "guides")): string[] {
  const served = new Set(sitemapUrls.map((u) => new URL(u).pathname.replace(/\/$/, "") || "/"));
  const problems: string[] = [];
  for (const file of fs.readdirSync(guidesDir).filter((f) => f.endsWith(".md"))) {
    for (const link of internalLinksIn(fs.readFileSync(path.join(guidesDir, file), "utf-8"))) {
      if (!served.has(link.replace(/\/$/, "") || "/")) problems.push(`${file} links to ${link}, which is not in the sitemap`);
    }
  }
  for (const g of getAllGuides()) {
    if (!served.has(`/guides/${g.slug}`)) problems.push(`guide ${g.slug} is not in the sitemap`);
    for (const p of g.linkedFrom ?? []) {
      if (!served.has(p)) problems.push(`guide ${g.slug} is linked from ${p}, which is not in the sitemap`);
    }
  }
  return problems;
}
