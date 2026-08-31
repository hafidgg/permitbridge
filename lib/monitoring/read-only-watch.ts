/**
 * lib/monitoring/read-only-watch.ts
 *
 * Phase 3.3 — READ-ONLY official source monitoring.
 *
 * Structurally incapable of writing anything: imports ONLY
 * fetchSource() and applyRule() (both pure read/extract functions,
 * confirmed in Phase 3.2K/3.2O to perform zero filesystem writes).
 * Never imports decide(), evaluateForPersistence(),
 * applyAndPersistAutomated(), the kill switch, or the scheduler.
 */
import { fetchSource } from "../pipeline/fetcher";
import { applyRule } from "../pipeline/extract";
import type { ExtractRule } from "../pipeline/types";

export type WatchResultType = "NO_CHANGE" | "CHANGE_DETECTED" | "SOURCE_UNAVAILABLE";

export interface WatchResult {
  type: WatchResultType;
  source: string;
  detectedAt: string;
  oldValue?: string | number;
  newValue?: string | number;
  evidence?: string;
  reason?: string;
}

export async function watchOfficialSource(sourceId: string, url: string, extractRule: ExtractRule, knownBaseline: string | number, mode: "live" | "mock" = "live"): Promise<WatchResult> {
  const detectedAt = new Date().toISOString();
  const fetchResult = await fetchSource({ id: sourceId, url }, mode);

  if (fetchResult.status !== "ok") {
    return { type: "SOURCE_UNAVAILABLE", source: url, detectedAt, reason: `Fetch status: ${fetchResult.status}${fetchResult.error ? ` (${fetchResult.error})` : ""}` };
  }

  const extraction = applyRule(extractRule, fetchResult.rawText ?? "");
  if (!extraction.matched || extraction.value === undefined || extraction.value === null) {
    return { type: "SOURCE_UNAVAILABLE", source: url, detectedAt, reason: "Extraction pattern did not match — page structure may have changed." };
  }

  const newValue = extraction.value as string | number;
  const unchanged = String(newValue) === String(knownBaseline);

  if (unchanged) {
    return { type: "NO_CHANGE", source: url, detectedAt, oldValue: knownBaseline, newValue };
  }

  return {
    type: "CHANGE_DETECTED",
    source: url,
    detectedAt,
    oldValue: knownBaseline,
    newValue,
    evidence: fetchResult.rawText?.slice(0, 500),
  };
}
