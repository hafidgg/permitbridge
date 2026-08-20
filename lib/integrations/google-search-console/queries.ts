import { querySearchAnalytics } from "./client";
import type { GscServiceAccountCredentials, GscSnapshot } from "./types";

/**
 * Builds a real GscSnapshot from the actual API response — every number
 * here is exactly what Google's API returned, never estimated or
 * padded. If GSC has no data yet (e.g. a brand-new property), totals are
 * honestly zero, not fabricated placeholder numbers.
 */
export async function buildSnapshot(credentials: GscServiceAccountCredentials, siteUrl: string): Promise<GscSnapshot> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 28); // GSC data has a ~2-3 day reporting lag; 28 days is a stable trailing window

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [totalsResponse, pagesResponse] = await Promise.all([
    querySearchAnalytics(credentials, siteUrl, { startDate: fmt(start), endDate: fmt(end), dimensions: [] }),
    querySearchAnalytics(credentials, siteUrl, { startDate: fmt(start), endDate: fmt(end), dimensions: ["page"], rowLimit: 25 }),
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
  };
}
