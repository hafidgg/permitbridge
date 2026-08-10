/**
 * lib/monitoring/health.ts
 *
 * Phase 4.6, Steps 2/3/5: pure functions deriving health classifications
 * and next-check timing from a MonitoredSource's already-stored fields.
 * Deliberately does NOT introduce a second stored status enum — see the
 * doc comment on SourceHealthSummary (types/monitoring.ts) for why
 * "healthy"/"warning"/"stale"/"disabled" are computed views over the
 * existing MonitoredSourceStatus ("active"/"paused"/"failed"), not a
 * parallel system.
 */
import type { MonitoredSource, MonitoredSourceRegistry, SourceHealthSummary } from "@/types/monitoring";
import { isSourceStale, getSourcesDueForCheck } from "./registry";

export type SourceHealthClassification = "healthy" | "warning" | "failed" | "stale" | "disabled" | "never_checked";

/**
 * Precedence, most to least severe: disabled (a deliberate human choice,
 * always shown regardless of anything else) > failed (hit the
 * consecutive-failure threshold) > never_checked > warning (currently
 * mid-failure-streak, 1-2 consecutive failures) > stale (currently
 * "clean" — 0 consecutive failures — but hasn't succeeded in a long
 * time) > healthy.
 *
 * Phase 4.7 fix: "warning" is checked BEFORE "stale". A source that has
 * NEVER had a single successful fetch (lastSuccessfulFetchAt is null)
 * trips isSourceStale()'s "never succeeded -> true" branch unconditionally
 * — if that check ran first, a source currently in an active 1-2-failure
 * streak (which should read "warning": still trying, not yet failed)
 * would incorrectly show "stale" instead. Caught by this phase's own
 * tests, not left in.
 */
export function classifySourceHealth(source: MonitoredSource, now: Date = new Date()): SourceHealthClassification {
  if (source.status === "paused") return "disabled";
  if (source.status === "failed") return "failed";
  if (!source.lastCheckedAt) return "never_checked";
  if (source.consecutiveFailures > 0) return "warning";
  if (isSourceStale(source, now)) return "stale";
  return "healthy";
}

/**
 * Step 3's exact deterministic formula: nextCheckAt = lastSuccessfulCheckAt
 * + checkIntervalDays. Reuses lastSuccessfulFetchAt (Phase 4.2's name for
 * the same concept) rather than lastCheckedAt, so a run of failures
 * doesn't keep pushing the next check further away from when content was
 * last actually confirmed good. A source that has never succeeded has no
 * computable next-check date — it's already due and returns null rather
 * than a fabricated date.
 */
export function computeNextCheckAt(source: MonitoredSource): string | null {
  if (!source.lastSuccessfulFetchAt) return null;
  const base = new Date(source.lastSuccessfulFetchAt);
  const next = new Date(base.getTime() + source.checkFrequencyDays * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

/**
 * Step 5: a pure summary function, no UI coupling. `previousHashes` is an
 * optional map (sourceId -> hash) representing what the registry looked
 * like BEFORE the current state, purely so "changed" can be computed
 * without this function needing any side-channel/global state — omit it
 * and "changed" is simply reported as 0 (nothing to compare against).
 */
export function summarizeSourceHealth(
  registry: MonitoredSourceRegistry,
  now: Date = new Date(),
  previousHashes?: Record<string, string | null | undefined>
): SourceHealthSummary {
  const summary: SourceHealthSummary = {
    totalMonitoredSources: registry.sources.length,
    dueForCheck: getSourcesDueForCheck(registry, now).length,
    healthy: 0,
    warning: 0,
    failed: 0,
    stale: 0,
    disabled: 0,
    neverChecked: 0,
    changed: 0,
    averageConsecutiveFailures: 0,
  };

  let totalConsecutiveFailures = 0;

  for (const source of registry.sources) {
    const classification = classifySourceHealth(source, now);
    if (classification === "healthy") summary.healthy++;
    else if (classification === "warning") summary.warning++;
    else if (classification === "failed") summary.failed++;
    else if (classification === "stale") summary.stale++;
    else if (classification === "disabled") summary.disabled++;
    else if (classification === "never_checked") summary.neverChecked++;

    totalConsecutiveFailures += source.consecutiveFailures;

    if (previousHashes && previousHashes[source.id] !== undefined && previousHashes[source.id] !== source.lastContentHash) {
      summary.changed++;
    }
  }

  summary.averageConsecutiveFailures = registry.sources.length > 0 ? totalConsecutiveFailures / registry.sources.length : 0;

  return summary;
}
