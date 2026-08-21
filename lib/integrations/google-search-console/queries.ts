import { querySearchAnalytics } from "./client";
import type { GscServiceAccountCredentials, GscSnapshot, GscTopQueryRow } from "./types";

/**
 * Builds a real GscSnapshot from the actual API response — every number
 * here is exactly what Google's API returned, never estimated or
 * padded. If GSC has no data yet (e.g. a brand-new property), totals are
 * honestly zero, not fabricated placeholder numbers.
 *
 * Phase 2C.2: added a third, parallel query (dimensions: ["query",
 * "page"]) alongside the original two — the existing totals/topPages
 * queries are completely unchanged, this only adds new information.
 */
export async function buildSnapshot(credentials: GscServiceAccountCredentials, siteUrl: string): Promise<GscSnapshot> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 28); // GSC data has a ~2-3 day reporting lag; 28 days is a stable trailing window

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [totalsResponse, pagesResponse, queriesResponse] = await Promise.all([
    querySearchAnalytics(credentials, siteUrl, { startDate: fmt(start), endDate: fmt(end), dimensions: [] }),
    querySearchAnalytics(credentials, siteUrl, { startDate: fmt(start), endDate: fmt(end), dimensions: ["page"], rowLimit: 25 }),
    querySearchAnalytics(credentials, siteUrl, { startDate: fmt(start), endDate: fmt(end), dimensions: ["query", "page"], rowLimit: 100 }),
  ]);

  const totalsRow = totalsResponse.rows?.[0];

  return {
    generatedAt: new Date().toISOString(),
    siteUrl,
    totals: {
      clicks: totalsRow?.clicks ?? 0,
      impressions: totalsRow?.impressions ?? 0,
      ctr: totalsRow?.ctr ?? 0,
      averagePosition: totalsRow?.position ?? 0,
    },
    topPages: (pagesResponse.rows ?? [])
      .filter((r): r is typeof r & { keys: [string] } => typeof r.keys[0] === "string")
      .map((r) => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
      })),
    topQueries: normalizeTopQueries(queriesResponse.rows),
  };
}

/**
 * Turns raw dimensions:["query","page"] rows into GscTopQueryRow[].
 * Exported separately (not inlined) so it has its own focused unit tests
 * — malformed/missing dimension values, empty responses, and ordering
 * are all real, distinct failure modes worth testing independently of
 * the network call itself.
 *
 * Deliberately conservative: a row is only included if BOTH dimension
 * values are present and are strings — never fabricates a placeholder
 * query or page for a malformed row, it's silently dropped instead
 * (matching the existing topPages filtering convention).
 *
 * Sorted by clicks descending for deterministic ordering — GSC's own
 * API response order is not guaranteed to be stable across requests.
 */
export function normalizeTopQueries(rows: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> | undefined): GscTopQueryRow[] {
  if (!rows) return [];
  return rows
    .filter((r): r is typeof r & { keys: [string, string] } => typeof r.keys[0] === "string" && typeof r.keys[1] === "string")
    .map((r) => ({
      query: r.keys[0],
      page: r.keys[1],
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}
