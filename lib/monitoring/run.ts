/**
 * lib/monitoring/run.ts
 *
 * Phase 4.6, Step 7: the orchestrator tying every prior monitoring phase
 * together into one cycle: load registry -> select due sources -> fetch
 * (Phase 4.2) -> normalize/hash (Phase 4.2) -> compare (Phase 4.2) ->
 * detect (Phase 4.3) -> create DetectedChange (Phase 4.3) -> update
 * source health -> persist.
 *
 * Scope note: with zero real MonitoredSources registered (Phase 4.11's
 * job, not this one), no source in this phase carries a field/extractRule
 * mapping to a specific ProfessionStateFacts/TransferRule fact. This
 * orchestrator therefore operates at the SOURCE level — exactly what
 * Phase 4.3's detectFieldChange() already supports when called with no
 * `field` (a page-level CONTENT_CHANGED signal). Field-level extraction
 * remains fully available (Phase 4.3/4.4/4.5 already handle it) for
 * whenever a real source is registered with a field mapping — that
 * wiring is a natural Phase 4.11 extension, not invented here ahead of
 * the sources that would need it.
 *
 * CRITICAL: this module NEVER calls applyAndPersistReview() or anything
 * that could approve/publish a change. It only ever creates
 * pending_verification DetectedChange records — reviewing them remains
 * an explicit, separate human action (scripts/monitoring/review.ts).
 */
import fs from "node:fs";
import path from "node:path";
import type { MonitoredSourceRegistry, DetectedChange, SourceHealthSummary } from "@/types/monitoring";
import { loadMonitoringRegistry, saveMonitoringRegistry, updateMonitoredSource, getSourcesDueForCheck } from "./registry";
import { fetchMonitoredSource } from "./fetch";
import { detectFieldChange } from "./detect";
import { buildDetectedChange, saveDetectedChange } from "./change-record";
import { summarizeSourceHealth } from "./health";
import { loadFieldForChange } from "./persistence";

const DEFAULT_LOCK_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock");

export interface MonitoringCycleOptions {
  mode: "live" | "mock";
  dryRun?: boolean;
  registry?: MonitoredSourceRegistry; // injectable for tests — defaults to the real on-disk registry
  /** Where to PERSIST the registry after a non-dry-run cycle. Defaults to the real on-disk path — tests MUST override this to an isolated temp path, exactly like changesDir, or a synthetic test registry will leak into real monitoring config. This is what Phase 4.6's own test suite caught and fixed. */
  registryPath?: string;
  changesDir?: string; // injectable for tests — defaults to the real on-disk changes directory
  /** Phase 4.7 Step 11 — advisory lock file path, defaults alongside registryPath. Only ever touched when dryRun is false (a lock file would itself be a "temporary artifact" a dry-run must never leave, per Step 6). */
  lockPath?: string;
  now?: Date;
}

/**
 * Phase 4.7 Step 11: the concurrency audit's conclusion, documented here
 * rather than only in a report.
 *
 * DUPLICATE DetectedChange records are already prevented regardless of
 * concurrency, by construction: buildDetectedChangeId() derives a
 * deterministic id from sourceId+hash(+field), and saveDetectedChange()
 * only ever creates a file if one with that exact id doesn't already
 * exist. Two processes racing to detect the identical change would each
 * compute the identical id; whichever write reaches disk second finds
 * the file already present and no-ops. This was true before Phase 4.7 and
 * is re-verified by this phase's own tests, not re-implemented.
 *
 * The REAL gap is different: two concurrent cycles each load the FULL
 * registry into memory, mutate their own copy, and independently call
 * saveMonitoringRegistry() — last write wins, silently discarding
 * whatever health-tracking updates (lastCheckedAt, consecutiveFailures,
 * etc. for sources the OTHER process touched) the first write contained.
 * This is a real, if narrow, risk for a scheduled batch job — not
 * something the existing architecture already handles.
 *
 * A full distributed lock (with staleness/timeout/crash recovery) is
 * explicitly out of scope ("do not introduce a complex locking system
 * unless the existing architecture requires it" — a weekly-frequency,
 * single-operator batch job doesn't). The smallest safe fix: a simple
 * advisory lock file, created at the start of a non-dry-run cycle and
 * removed at the end (even on error, via try/finally). It cannot
 * guarantee correctness against a hard crash leaving a stale lock behind
 * — that tradeoff is deliberate and documented, not hidden.
 */
export class MonitoringCycleInProgressError extends Error {
  constructor(lockPath: string) {
    super(`A monitoring cycle appears to already be running (lock file present at ${lockPath}). If a previous run crashed and left a stale lock, remove that file manually before retrying.`);
    this.name = "MonitoringCycleInProgressError";
  }
}

function acquireLock(lockPath: string): void {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    fs.writeFileSync(lockPath, JSON.stringify({ acquiredAt: new Date().toISOString() }), { flag: "wx" }); // 'wx': fail if it already exists — the actual mutual-exclusion check
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new MonitoringCycleInProgressError(lockPath);
    throw err;
  }
}

function releaseLock(lockPath: string): void {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Already gone — nothing to clean up, not an error worth surfacing.
  }
}

export interface PerSourceCycleResult {
  sourceId: string;
  fetchStatus: "ok" | "not_modified" | "error";
  classification: string;
  changeId?: string; // populated only when a DetectedChange was (or, in dry-run, WOULD BE) created
  wouldCreateChange: boolean;
  changeCreated: boolean; // false in dry-run even when wouldCreateChange is true
  healthUpdated: boolean;
}

export interface MonitoringCycleSummary {
  dryRun: boolean;
  mode: "live" | "mock";
  sourcesConsidered: number;
  sourcesChecked: number;
  changesDetected: number; // count of non-NO_CHANGE classifications across the run
  changesQueued: number; // count actually persisted (0 in dry-run)
  results: PerSourceCycleResult[];
  healthBefore: SourceHealthSummary;
  healthAfter: SourceHealthSummary; // identical to healthBefore in dry-run — nothing was persisted
}

export interface ProcessSourceOutcome {
  result: PerSourceCycleResult;
  updatedRegistry: MonitoredSourceRegistry;
  changeDetectedIncrement: number;
  changeQueuedIncrement: number;
}

/**
 * The complete per-source pipeline (fetch -> field-aware detect -> build
 * DetectedChange -> persist -> update registry entry), extracted so it
 * can be called both from the full-cycle loop below AND from
 * scheduler.ts's runSourceCheck() (a single, on-demand source check) —
 * one implementation, not two.
 */
export async function processDueSource(
  source: MonitoredSourceRegistry["sources"][number],
  registry: MonitoredSourceRegistry,
  options: Pick<MonitoringCycleOptions, "mode" | "dryRun" | "changesDir">
): Promise<ProcessSourceOutcome> {
  const dryRun = options.dryRun ?? false;
  const outcome = await fetchMonitoredSource(source, options.mode);

  const mapping = source.fieldMapping;
  const currentValue = mapping
    ? (loadFieldForChange({
        profession: source.profession,
        jurisdiction: source.jurisdiction,
        destinationJurisdiction: mapping.destinationJurisdiction,
        field: mapping.field,
      })?.value ?? "Unknown")
    : undefined;

  const detection = detectFieldChange({
    field: mapping?.field,
    currentValue,
    extractRule: mapping?.extractRule,
    previousHash: source.lastContentHash,
    newHash: outcome.fetchResult.contentHash ?? source.lastContentHash ?? "",
    fetchStatus: outcome.fetchResult.status,
    rawText: outcome.fetchResult.rawText,
  });

  const wouldCreateChange = detection.classification !== "NO_CHANGE";
  let changeId: string | undefined;
  let changeCreated = false;
  let changeDetectedIncrement = 0;
  let changeQueuedIncrement = 0;

  if (wouldCreateChange) {
    changeDetectedIncrement = 1;
    const change: DetectedChange = buildDetectedChange({
      sourceId: source.id,
      jurisdiction: source.jurisdiction,
      destinationJurisdiction: mapping?.destinationJurisdiction,
      profession: source.profession,
      field: mapping?.field,
      previousValue: mapping ? currentValue : undefined,
      newHash: outcome.fetchResult.contentHash ?? source.lastContentHash ?? "",
      previousHash: source.lastContentHash,
      detectionResult: detection,
      evidence: {
        url: source.url,
        title: source.title,
        fetchedAt: outcome.fetchResult.fetchedAt,
        extractedText: detection.extractedText,
      },
      detectedAt: outcome.fetchResult.fetchedAt,
      sourceJurisdiction: source.jurisdiction,
    });
    changeId = change.id;

    if (!dryRun) {
      const saveResult = saveDetectedChange(change, options.changesDir);
      changeCreated = saveResult.created; // idempotent — false if this exact change (same id) already existed
      if (changeCreated) changeQueuedIncrement = 1;
    }
  }

  const updatedRegistry = dryRun ? registry : updateMonitoredSource(source.id, outcome.updatedFields, registry);

  return {
    result: {
      sourceId: source.id,
      fetchStatus: outcome.fetchResult.status,
      classification: detection.classification,
      changeId,
      wouldCreateChange,
      changeCreated,
      healthUpdated: !dryRun,
    },
    updatedRegistry,
    changeDetectedIncrement,
    changeQueuedIncrement,
  };
}

async function runMonitoringCycleInner(options: MonitoringCycleOptions): Promise<MonitoringCycleSummary> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  let registry = options.registry ?? loadMonitoringRegistry();

  const healthBefore = summarizeSourceHealth(registry, now);
  const dueSources = getSourcesDueForCheck(registry, now);

  console.log(`[monitor] cycle started (mode=${options.mode}${dryRun ? " dry-run" : ""}, ${dueSources.length} source(s) due)`);

  const results: PerSourceCycleResult[] = [];
  let changesDetected = 0;
  let changesQueued = 0;

  for (const source of dueSources) {
    const outcome = await processDueSource(source, registry, options);
    registry = outcome.updatedRegistry;
    changesDetected += outcome.changeDetectedIncrement;
    changesQueued += outcome.changeQueuedIncrement;
    results.push(outcome.result);

    // Step 9: concise, structured, secret-free logs — never the raw HTML/rawText, never any credential.
    if (outcome.result.fetchStatus === "error") {
      console.log(`[monitor] source=${source.id} status=checked result=failed`);
    } else if (outcome.result.classification === "NO_CHANGE") {
      console.log(`[monitor] source=${source.id} status=checked result=no_change`);
    } else {
      console.log(`[monitor] source=${source.id} status=checked result=${outcome.result.classification}${outcome.result.changeCreated ? " queued=true" : ""}`);
    }
  }

  if (!dryRun && dueSources.length > 0) {
    saveMonitoringRegistry(registry, options.registryPath);
  }

  const healthAfter = dryRun ? healthBefore : summarizeSourceHealth(registry, now);

  console.log(`[monitor] cycle completed (checked=${dueSources.length} detected=${changesDetected} queued=${changesQueued})`);

  return {
    dryRun,
    mode: options.mode,
    sourcesConsidered: registry.sources.length,
    sourcesChecked: dueSources.length,
    changesDetected,
    changesQueued,
    results,
    healthBefore,
    healthAfter,
  };
}

/**
 * The real public entry point. Dry-run bypasses the lock entirely (a lock
 * file is itself a mutation a dry-run must never leave behind — Step 6).
 * A non-dry-run cycle acquires the lock before doing any work and
 * releases it in `finally`, so it's released even if fetching/detection
 * throws partway through.
 */
export async function runMonitoringCycle(options: MonitoringCycleOptions): Promise<MonitoringCycleSummary> {
  if (options.dryRun) {
    return runMonitoringCycleInner(options);
  }

  const lockPath = options.lockPath ?? DEFAULT_LOCK_PATH;
  acquireLock(lockPath);
  try {
    return await runMonitoringCycleInner(options);
  } finally {
    releaseLock(lockPath);
  }
}
