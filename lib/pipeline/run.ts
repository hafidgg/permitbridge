/**
 * lib/pipeline/run.ts
 *
 * The orchestrator. This is the single function that chains every stage:
 *
 *   1. Fetch      — pull each enabled source (live HTTP or mock fixtures)
 *   2. Extract     — apply regex rules to get structured fields
 *   3. Normalize    — merge onto current profession/state JSON
 *   4. Validate     — schema + business rules; invalid proposals are dropped
 *   5. Diff         — compare proposed vs. current, classify risk per field
 *   6. Gate         — low/medium risk auto-applies; high risk queues for review
 *   7. Update        — write approved changes to /data
 *   8. Regenerate    — rebuild data/transfers/** from the (possibly updated)
 *                      professions + states (reuses the existing, unmodified
 *                      generate-transfers logic — see scripts/generate-transfers.ts)
 *   9. Validate data — run the existing data integrity check
 *  10. Search index   — rebuild the persisted search-index.json snapshot
 *  11. Changelog      — write a dated audit-trail report
 *
 * Nothing in this file imports from app/ or components/ — the pipeline
 * only ever touches /data, /public/data, and its own /data/_pipeline
 * bookkeeping directories. The UI is completely untouched by design.
 */
import { execSync } from "node:child_process";
import { loadSourceRegistry, getSourcesDueForCheck } from "./registry";
import { fetchAllSources } from "./fetcher";
import { extractRecord } from "./extract";
import { normalizeRecord } from "./normalize";
import { validateProposal } from "./validate";
import { diffRecords } from "./diff";
import { applyProposal, queuePendingChange } from "./update";
import { rebuildSearchIndexSnapshot } from "./searchIndex";
import { writeRunChangelog } from "./changelog";
import type { DiffResult, PipelineRunSummary } from "./types";

export interface RunOptions {
  mode: "live" | "mock";
  /** if true, computes everything but never writes to /data or /public/data */
  dryRun?: boolean;
}

export async function runPipeline(options: RunOptions): Promise<PipelineRunSummary> {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const startedAt = new Date().toISOString();

  const registry = loadSourceRegistry();
  const sources = getSourcesDueForCheck(registry);

  console.log(`\n▶ PermitBridge Data Pipeline — run ${runId} (mode: ${options.mode}${options.dryRun ? ", DRY RUN" : ""})`);
  console.log(`  Checking ${sources.length} enabled sources...\n`);

  // ---- 1. Fetch ----
  const fetchResults = await fetchAllSources(sources, options.mode);
  const fetchErrors = fetchResults.filter((r) => r.status === "error");
  fetchErrors.forEach((r) => console.warn(`  ⚠ fetch error for ${r.sourceId}: ${r.error}`));

  const changed = fetchResults.filter((r) => r.status === "ok");
  console.log(`  Fetched ${changed.length} changed page(s), ${fetchResults.length - changed.length - fetchErrors.length} unchanged, ${fetchErrors.length} error(s).\n`);

  // ---- 2-6. Extract → Normalize → Validate → Diff → Gate ----
  let recordsExtracted = 0;
  let validationErrors = 0;
  const appliedDiffs: DiffResult[] = [];
  const pendingDiffs: DiffResult[] = [];

  for (const fetchResult of changed) {
    const source = sources.find((s) => s.id === fetchResult.sourceId);
    if (!source) continue;
    if (source.entityKind === "transfer") continue; // no direct transfer sources in v1 — see normalize.ts

    const extracted = extractRecord(source, fetchResult);
    if (!extracted) continue;
    recordsExtracted++;

    const proposal = normalizeRecord(extracted, source.url);
    if (!proposal || !proposal.proposed) {
      console.warn(`  ⚠ ${source.id}: could not normalize (unknown entity "${extracted.entitySlug}") — skipped.`);
      continue;
    }

    const validation = validateProposal(proposal.entityKind, proposal.proposed);
    const warnings = validation.issues.filter((i) => i.severity === "warning");
    warnings.forEach((w) => console.warn(`  ⚠ ${source.id}: ${w.path}: ${w.message}`));

    if (!validation.valid) {
      validationErrors++;
      console.warn(`  ✗ ${source.id}: validation failed —`);
      validation.issues.filter((i) => i.severity === "error").forEach((i) => console.warn(`      ${i.path}: ${i.message}`));
      continue;
    }

    if (Object.keys(proposal.signals).length > 0) {
      console.log(`  🔔 ${source.id}: page changed in a way that needs human research (not auto-mergeable): ${Object.keys(proposal.signals).join(", ")}`);
    }

    const diff = diffRecords(proposal.entityKind, proposal.entitySlug, source.id, proposal.current, proposal.proposed);
    if (!diff.hasChanges) continue;

    const autoApply = diff.highestRisk !== "high";

    if (options.dryRun) {
      console.log(`  ${autoApply ? "would auto-apply" : "would queue for review"}: ${proposal.entityKind}/${proposal.entitySlug} via ${source.id} (${diff.changes.length} field change(s), highest risk: ${diff.highestRisk})`);
    } else if (autoApply) {
      applyProposal(proposal);
      appliedDiffs.push(diff);
      console.log(`  ✅ applied: ${proposal.entityKind}/${proposal.entitySlug} via ${source.id}`);
    } else {
      queuePendingChange(diff, proposal);
      pendingDiffs.push(diff);
      console.log(`  ⏳ queued for review (high risk): ${proposal.entityKind}/${proposal.entitySlug} via ${source.id}`);
    }
  }

  // ---- 8-9. Regenerate transfers + validate data (skipped in dry run) ----
  let transfersRegenerated = 0;
  if (!options.dryRun && appliedDiffs.length > 0) {
    console.log("\n  Regenerating transfer rules from updated professions/states...");
    execSync("npx tsx scripts/generate-transfers.ts", { stdio: "inherit" });
    execSync("npx tsx scripts/validate-data.ts", { stdio: "inherit" });
    transfersRegenerated = 1; // scripts print their own counts; flagged here as "ran successfully"
  }

  // ---- 10. Search index snapshot ----
  let searchIndexDocuments = 0;
  if (!options.dryRun) {
    const { documentCount } = rebuildSearchIndexSnapshot();
    searchIndexDocuments = documentCount;
    console.log(`  Rebuilt search index snapshot: ${documentCount} documents.`);
  }

  const finishedAt = new Date().toISOString();

  const summary: PipelineRunSummary = {
    runId,
    startedAt,
    finishedAt,
    mode: options.mode,
    sourcesChecked: sources.length,
    fetchErrors: fetchErrors.length,
    recordsExtracted,
    validationErrors,
    changesAutoApplied: appliedDiffs.length,
    changesPendingApproval: pendingDiffs.length,
    transfersRegenerated,
    searchIndexDocuments,
  };

  // ---- 11. Changelog ----
  if (!options.dryRun) {
    const { mdPath } = writeRunChangelog(runId, summary, appliedDiffs, pendingDiffs);
    console.log(`\n  Changelog written: ${mdPath}`);
  }

  console.log(`\n✔ Pipeline run ${runId} complete.\n`);
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}
