/**
 * scripts/sitemap-floor.ts
 *
 * One definition of "a healthy sitemap", shared by every sitemap check:
 *   - source: calls app/sitemap.ts's sitemap() directly (part of `npm test`)
 *   - build:  reads the prerendered .next/server/app/sitemap.xml.body (`postbuild`)
 *   - live:   fetches the deployed /sitemap.xml (.github/workflows/sitemap-live-check.yml)
 *
 * Exists because of the 2026-10 regression: the live sitemap silently fell
 * from 78 URLs to the 18 hardcoded ones when an ISR re-run lost data/.
 * Every data-backed group went to zero while the static ones survived, so
 * the per-group "non-empty" rule matters as much as the totals.
 *
 * Raise the floors when the site grows; never lower them to make a
 * failing check pass without understanding why URLs disappeared.
 */

export const MIN_TOTAL_URLS = 70;
export const MIN_TRANSFER_URLS = 20;

export type SitemapGroup =
  | "static"
  | "profession"
  | "state"
  | "transfer"
  | "guide"
  | "blog"
  | "knowledgeBaseTransfer"
  | "tradeStateSummary"
  | "singleStateProfession";

const ALL_GROUPS: SitemapGroup[] = [
  "static",
  "profession",
  "state",
  "transfer",
  "guide",
  "blog",
  "knowledgeBaseTransfer",
  "tradeStateSummary",
  "singleStateProfession",
];

function groupOf(url: string): SitemapGroup {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "static";
  const [first, second = ""] = segments;
  if (first === "profession") return "profession";
  if (first === "state") return "state";
  if (first === "transfer") return "transfer";
  if (first === "guides") return "guide";
  if (first === "blog") return "blog";
  if (second.includes("-to-")) return "knowledgeBaseTransfer";
  if (first === "hvac-technician" || first === "plumber") return "tradeStateSummary";
  return "singleStateProfession";
}

export function countByGroup(urls: string[]): Record<SitemapGroup, number> {
  const counts = Object.fromEntries(ALL_GROUPS.map((g) => [g, 0])) as Record<SitemapGroup, number>;
  for (const url of urls) counts[groupOf(url)]++;
  return counts;
}

/** Returns a list of human-readable problems; empty means the sitemap passes the floor. */
export function checkSitemapFloor(urls: string[]): string[] {
  const problems: string[] = [];
  const counts = countByGroup(urls);
  if (urls.length < MIN_TOTAL_URLS) problems.push(`only ${urls.length} URLs (floor ${MIN_TOTAL_URLS})`);
  if (counts.transfer < MIN_TRANSFER_URLS) problems.push(`only ${counts.transfer} /transfer URLs (floor ${MIN_TRANSFER_URLS})`);
  for (const group of ALL_GROUPS) {
    if (counts[group] === 0) problems.push(`group "${group}" is empty`);
  }
  const duplicates = urls.length - new Set(urls).size;
  if (duplicates > 0) problems.push(`${duplicates} duplicate URLs`);
  return problems;
}

export function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").trim());
}
