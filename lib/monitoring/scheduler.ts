/**
 * lib/monitoring/scheduler.ts
 *
 * Phase 4.8, Step 2: a thin, provider-agnostic scheduler abstraction over
 * the orchestrator already built in run.ts. Nothing here talks to Vercel,
 * GitHub Actions, or any specific trigger mechanism — the cron endpoint
 * (app/api/cron/source-monitor/route.ts) is just one CALLER of
 * runMonitoringCycle(), exactly as a local CLI invocation or a future
 * GitHub Actions workflow would be. This file adds exactly one new
 * capability run.ts didn't already expose: checking ONE specific source
 * on demand, regardless of whether it's currently "due."
 *
 * Concurrency, idempotency, retry/backoff, and last-known-good
 * preservation are ALL inherited from Phase 4.2/4.3/4.6/4.7 — reused
 * here, not reimplemented.
 */
import { loadMonitoringRegistry, getSourcesDueForCheck, saveMonitoringRegistry } from "./registry";
import { runMonitoringCycle, processDueSource, type MonitoringCycleOptions, type MonitoringCycleSummary, type PerSourceCycleResult, MonitoringCycleInProgressError } from "./run";
import type { MonitoredSource, MonitoredSourceRegistry } from "@/types/monitoring";

/** Step 2's getDueSources() — a read-only projection, no fetching. */
export function getDueSources(registry?: MonitoredSourceRegistry, now: Date = new Date()): MonitoredSource[] {
  return getSourcesDueForCheck(registry ?? loadMonitoringRegistry(), now);
}

export interface RunSourceCheckOptions {
  mode: "live" | "mock";
  dryRun?: boolean;
  registry?: MonitoredSourceRegistry;
  registryPath?: string;
  changesDir?: string;
  now?: Date;
}

export interface RunSourceCheckResult {
  found: boolean;
  result?: PerSourceCycleResult;
}

/**
 * Step 2's runSourceCheck(sourceId) — checks exactly one source,
 * regardless of its due status (an on-demand, manual re-check; the
 * scheduled path, runMonitoringCycle(), still respects due status
 * normally). Reuses the exact same processDueSource() pipeline
 * runMonitoringCycle() itself uses per-source — one implementation.
 */
export async function runSourceCheck(sourceId: string, options: RunSourceCheckOptions): Promise<RunSourceCheckResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const registry = options.registry ?? loadMonitoringRegistry();
  const source = registry.sources.find((s) => s.id === sourceId);
  if (!source) return { found: false };

  const outcome = await processDueSource(source, registry, { mode: options.mode, dryRun, changesDir: options.changesDir }, now);

  if (!dryRun) {
    saveMonitoringRegistry(outcome.updatedRegistry, options.registryPath);
  }

  return { found: true, result: outcome.result };
}

export { runMonitoringCycle, MonitoringCycleInProgressError };
export type { MonitoringCycleOptions, MonitoringCycleSummary, PerSourceCycleResult };
