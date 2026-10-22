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
 *
 * 2026-10-22: lowered on purpose, from 70 total / 20 /transfer. 18 near-duplicate
 * HVAC and plumber /transfer pages were folded into their destination summary
 * pages (data/consolidated-transfers.json), leaving 52 URLs and 6 /transfer
 * pages. Each floor is the real count, the total less a margin of 2.
 */

export const MIN_TOTAL_URLS = 50;
export const MIN_TRANSFER_URLS = 6;

/** Per-group floors, at the real count. A group not listed here only has to be non-empty. */
export const MIN_GROUP_URLS: Readonly<Partial<Record<SitemapGroup, number>>> = {
  knowledgeBaseTransfer: 7, // RN pairs
};

/** Trade summary pages per profession (/hvac-technician/{state}, /plumber/{state}), at the real count. */
export const MIN_TRADE_SUMMARY_URLS: Readonly<Record<"hvac-technician" | "plumber", number>> = {
  "hvac-technician": 4,
  plumber: 4,
};

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

/**
 * Groups allowed to be empty. Only "blog": the blog was removed on
 * 2026-10-21 (its one post had no sourced facts). Every other group must
 * still be non-empty, and the totals below are unchanged.
 */
const OPTIONAL_GROUPS: ReadonlySet<SitemapGroup> = new Set(["blog"]);

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
  for (const [group, min] of Object.entries(MIN_GROUP_URLS) as [SitemapGroup, number][]) {
    if (counts[group] < min) problems.push(`only ${counts[group]} ${group} URLs (floor ${min})`);
  }
  for (const [profession, min] of Object.entries(MIN_TRADE_SUMMARY_URLS)) {
    const n = urls.filter((u) => new URL(u).pathname.split("/").filter(Boolean)[0] === profession && groupOf(u) === "tradeStateSummary").length;
    if (n < min) problems.push(`only ${n} /${profession}/{state} URLs (floor ${min})`);
  }
  for (const group of ALL_GROUPS) {
    if (counts[group] === 0 && !OPTIONAL_GROUPS.has(group)) problems.push(`group "${group}" is empty`);
  }
  const duplicates = urls.length - new Set(urls).size;
  if (duplicates > 0) problems.push(`${duplicates} duplicate URLs`);
  return problems;
}

export function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").trim());
}
