/**
 * Types for the Google Search Console Search Analytics API (the only
 * part of the GSC API this integration uses). Kept minimal and scoped to
 * exactly what queries.ts actually requests — not a full API surface.
 */

export interface GscServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

export interface GscSearchAnalyticsRow {
  keys: string[]; // one entry per requested dimension, in the same order
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows?: GscSearchAnalyticsRow[];
}

export type GscDimension = "query" | "page" | "date" | "country" | "device";

export interface GscSearchAnalyticsQuery {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: GscDimension[];
  rowLimit?: number;
}

/**
 * A comparable snapshot — what alerts.ts diffs against the previous run.
 * Deliberately only the aggregate numbers GSC's API actually exposes;
 * never anything that implies click/impression manipulation is possible
 * or intended.
 */
export interface GscSnapshot {
  generatedAt: string;
  siteUrl: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
  };
  topPages: Array<{ page: string; clicks: number; impressions: number; position: number }>;
}
