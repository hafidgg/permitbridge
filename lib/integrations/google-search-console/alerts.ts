import type { GscSnapshot } from "./types";

/**
 * Pure comparison logic — takes two REAL snapshots (this run and the
 * previous stored one) and reports meaningful deltas. Never calls any
 * API itself, never simulates data, and has no way to influence
 * rankings/clicks/impressions even in principle — it only reads and
 * compares numbers Google's own API already returned.
 */

export interface FreshnessAlert {
  severity: "info" | "warning";
  message: string;
}

const CLICKS_DROP_WARNING_THRESHOLD = 0.3; // 30% week-over-week drop in total clicks
const IMPRESSIONS_DROP_WARNING_THRESHOLD = 0.3;

export function compareSnapshots(previous: GscSnapshot | null, current: GscSnapshot): FreshnessAlert[] {
  const alerts: FreshnessAlert[] = [];

  if (!previous) {
    alerts.push({ severity: "info", message: "First snapshot recorded — no previous data to compare against yet." });
    return alerts;
  }

  const clicksDelta = current.totals.clicks - previous.totals.clicks;
  const clicksDropRatio = previous.totals.clicks > 0 ? -clicksDelta / previous.totals.clicks : 0;
  if (clicksDropRatio >= CLICKS_DROP_WARNING_THRESHOLD) {
    alerts.push({
      severity: "warning",
      message: `Total clicks dropped ${Math.round(clicksDropRatio * 100)}% (${previous.totals.clicks} -> ${current.totals.clicks}) vs. the previous snapshot.`,
    });
  }

  const impressionsDelta = current.totals.impressions - previous.totals.impressions;
  const impressionsDropRatio = previous.totals.impressions > 0 ? -impressionsDelta / previous.totals.impressions : 0;
  if (impressionsDropRatio >= IMPRESSIONS_DROP_WARNING_THRESHOLD) {
    alerts.push({
      severity: "warning",
      message: `Total impressions dropped ${Math.round(impressionsDropRatio * 100)}% (${previous.totals.impressions} -> ${current.totals.impressions}) vs. the previous snapshot.`,
    });
  }

  const previousPages = new Set(previous.topPages.map((p) => p.page));
  const droppedFromTop = previous.topPages.filter((p) => !current.topPages.some((c) => c.page === p.page));
  if (droppedFromTop.length > 0) {
    alerts.push({
      severity: "info",
      message: `${droppedFromTop.length} page(s) fell out of the top ${current.topPages.length || 25} by clicks: ${droppedFromTop.map((p) => p.page).join(", ")}`,
    });
  }

  const newInTop = current.topPages.filter((p) => !previousPages.has(p.page));
  if (newInTop.length > 0) {
    alerts.push({
      severity: "info",
      message: `${newInTop.length} new page(s) entered the top pages by clicks: ${newInTop.map((p) => p.page).join(", ")}`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({ severity: "info", message: "No significant change vs. the previous snapshot." });
  }

  return alerts;
}
