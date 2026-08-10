/**
 * lib/monitoring/fetch.ts
 *
 * Phase 4.2: fetches a MonitoredSource by calling straight into
 * lib/pipeline/fetcher.ts's fetchSource() — the exact same retry/backoff,
 * ETag-conditional-request, disk-caching, and SHA-256 hashing logic the
 * live-site pipeline already uses, unmodified in behavior (see Phase 4.2's
 * report for the one-line, structurally-safe parameter widening that made
 * this direct reuse possible, and the real dry-run confirming zero
 * regression to the existing pipeline).
 *
 * This module owns nothing about WHERE fetched content is stored beyond
 * what fetchSource already does (data/_pipeline/cache/) — it only adds
 * the MonitoredSource-specific bookkeeping (lastCheckedAt,
 * lastSuccessfulFetchAt, lastContentHash, consecutiveFailures, status)
 * on top, as a pure function. It never writes to the registry itself —
 * that stays the caller's explicit responsibility (see lib/monitoring/registry.ts).
 */
import { fetchSource, htmlToText, hashContent } from "@/lib/pipeline/fetcher";
import type { FetchResult } from "@/lib/pipeline/types";
import type { MonitoredSource } from "@/types/monitoring";

const MAX_CONSECUTIVE_FAILURES_BEFORE_STATUS_FLIP = 3;

export interface MonitoredFetchOutcome {
  fetchResult: FetchResult;
  /** The source's bookkeeping fields as they SHOULD be after this fetch — caller applies this via updateMonitoredSource(). */
  updatedFields: Pick<
    MonitoredSource,
    | "lastCheckedAt"
    | "lastSuccessfulFetchAt"
    | "lastChangedAt"
    | "lastContentHash"
    | "lastHttpStatus"
    | "lastError"
    | "consecutiveFailures"
    | "totalChecks"
    | "successfulChecks"
    | "failedChecks"
    | "status"
  >;
}

export async function fetchMonitoredSource(source: MonitoredSource, mode: "live" | "mock"): Promise<MonitoredFetchOutcome> {
  const fetchResult = await fetchSource({ id: source.id, url: source.url }, mode);
  const now = fetchResult.fetchedAt;
  const totalChecks = source.totalChecks + 1;

  // Phase 4.7: "paused" is a deliberate human decision — never automatically
  // overridden by a fetch outcome, no matter which branch below would
  // otherwise apply. In normal operation, getSourcesDueForCheck() already
  // excludes paused sources from ever reaching this function at all — this
  // is the defense-in-depth guard for the case where fetchMonitoredSource
  // is called directly (Step 9's explicit test scenario), bypassing the
  // scheduler's own exclusion.
  const resolvedStatus = (computedStatus: MonitoredSource["status"]): MonitoredSource["status"] =>
    source.status === "paused" ? "paused" : computedStatus;

  if (fetchResult.status === "ok") {
    const contentActuallyChanged = !!fetchResult.contentHash && fetchResult.contentHash !== (source.lastContentHash ?? undefined);
    return {
      fetchResult,
      updatedFields: {
        lastCheckedAt: now,
        lastSuccessfulFetchAt: now,
        lastChangedAt: contentActuallyChanged ? now : (source.lastChangedAt ?? null),
        lastContentHash: fetchResult.contentHash ?? source.lastContentHash ?? null,
        lastHttpStatus: fetchResult.httpStatus ?? null,
        lastError: null,
        consecutiveFailures: 0,
        totalChecks,
        successfulChecks: source.successfulChecks + 1,
        failedChecks: source.failedChecks,
        status: resolvedStatus("active"),
      },
    };
  }

  if (fetchResult.status === "not_modified") {
    // A successful check that confirms nothing changed is still a successful fetch —
    // the content is known-good, just unchanged since last time.
    return {
      fetchResult,
      updatedFields: {
        lastCheckedAt: now,
        lastSuccessfulFetchAt: now,
        lastChangedAt: source.lastChangedAt ?? null, // unchanged, by definition of not_modified
        lastContentHash: source.lastContentHash ?? null, // unchanged, by definition of not_modified
        lastHttpStatus: fetchResult.httpStatus ?? null,
        lastError: null,
        consecutiveFailures: 0,
        totalChecks,
        successfulChecks: source.successfulChecks + 1,
        failedChecks: source.failedChecks,
        status: resolvedStatus("active"),
      },
    };
  }

  // status === "error": SOURCE_UNAVAILABLE / fetch failure. Never touch
  // lastContentHash, lastChangedAt, or lastSuccessfulFetchAt — the last
  // known-good value must survive a transient failure untouched (Section 22).
  const consecutiveFailures = source.consecutiveFailures + 1;
  return {
    fetchResult,
    updatedFields: {
      lastCheckedAt: now,
      lastSuccessfulFetchAt: source.lastSuccessfulFetchAt ?? null,
      lastChangedAt: source.lastChangedAt ?? null,
      lastContentHash: source.lastContentHash ?? null,
      lastHttpStatus: fetchResult.httpStatus ?? null,
      lastError: fetchResult.error ?? "Unknown fetch error",
      consecutiveFailures,
      totalChecks,
      successfulChecks: source.successfulChecks,
      failedChecks: source.failedChecks + 1,
      status: resolvedStatus(consecutiveFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_STATUS_FLIP ? "failed" : "active"),
    },
  };
}

export { htmlToText, hashContent };
