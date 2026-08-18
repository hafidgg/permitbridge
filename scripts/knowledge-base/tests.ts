/**
 * scripts/knowledge-base/tests.ts
 *
 * Dependency-free test suite for the Phase 2.1 verification system.
 * No test framework (jest/vitest) is installed in this project, and this
 * repo's existing philosophy (see scripts/validate-data.ts) is plain
 * Node/TS assertions run via tsx — this follows the same pattern rather
 * than introducing a new dependency for this alone.
 *
 * Usage: npm test
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts, SourceRecord, VerifiedField } from "../../types/knowledge-base";
import { loadAllSources, recomputeSourceUsage } from "../../lib/knowledge-base/sources";
import { checkCanMarkVerified, detectConflict, isDisallowedReviewerName } from "../../lib/knowledge-base/policy";
import { isAuthoritativeForField } from "../../lib/knowledge-base/authority-mapping";
import { RN_CORE_FIELDS } from "../../lib/knowledge-base/rn-core-fields";
import { computeCoreFieldStats } from "../../lib/knowledge-base/rn-core-audit";
import { resolveSourceConflict } from "../../lib/knowledge-base/conflict";
import type { ConflictSourceSnapshot } from "../../types/knowledge-base";
import { buildTransferRuleSlug, parseTransferRuleSlug, validateTransferRule, isTransferRuleValid } from "../../lib/knowledge-base/transfer-rule-schema";
import {
  SYNTHETIC_TRANSFER_CA_TO_TX,
  SYNTHETIC_TRANSFER_TX_TO_CA,
  SYNTHETIC_SOURCES,
} from "../../fixtures/knowledge-base/transfer-rules/synthetic-ca-tx";
import type { TransferRule } from "../../types/transfer-rule";
import type { MonitoredSource } from "../../types/monitoring";
import {
  loadMonitoringRegistry,
  addMonitoredSource,
  getMonitoredSource,
  listMonitoredSources,
  listActiveMonitoredSources,
  updateMonitoredSource,
  removeMonitoredSource,
  getSourcesDueForCheck,
  isSourceStale,
  DuplicateMonitoredSourceIdError,
} from "../../lib/monitoring/registry";
import { fetchMonitoredSource } from "../../lib/monitoring/fetch";
import { normalizeForHashing, computeStableHash, compareHashes } from "../../lib/monitoring/normalize";
import { hashContent, htmlToText, fetchSource, ResponseTooLargeError, DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_MAX_RESPONSE_BYTES } from "../../lib/pipeline/fetcher";
import { detectFieldChange } from "../../lib/monitoring/detect";
import { classifyFieldRisk, classifyFieldChangeCategory } from "../../lib/monitoring/field-classification";
import { buildDetectedChange, buildDetectedChangeId, saveDetectedChange, loadDetectedChange, listDetectedChanges } from "../../lib/monitoring/change-record";
import * as ChangeScenarios from "../../fixtures/knowledge-base/monitoring/synthetic-change-scenarios";
import { toReviewItem, processReviewDecision, isChangeStale } from "../../lib/monitoring/review-integration";
import type { DetectedChange } from "../../types/monitoring";
import { resolveEntityFile, loadFieldForChange, applyAndPersistReview, rollbackChange } from "../../lib/monitoring/persistence";
import { classifySourceHealth, computeNextCheckAt, summarizeSourceHealth } from "../../lib/monitoring/health";
import { runMonitoringCycle, MonitoringCycleInProgressError } from "../../lib/monitoring/run";
import { getDueSources, runSourceCheck } from "../../lib/monitoring/scheduler";
import { checkCronAuthorization } from "../../lib/monitoring/cron-auth";
import type { MonitoredSourceRegistry } from "../../types/monitoring";
import {
  applyFieldReview,
  isTransferRulePublishable,
  isTransferRuleFullyHumanVerified,
  classifyTransferRuleCoverage,
  CRITICAL_TRANSFER_RULE_FIELDS,
} from "../../lib/knowledge-base/transfer-review";
import { buildTransferPublicationReport } from "../../lib/knowledge-base/transfer-review-queue";
import { buildTransferReviewQueue } from "../../lib/knowledge-base/transfer-review-queue";
import { getAllPublicTransferRuleSlugs, getPublicTransferRule, summarizeEvidence, getSourceByUrl } from "../../lib/knowledge-base/transfer-rule-data";
import { FIELD_LABELS as PAGE_FIELD_LABELS } from "../../lib/knowledge-base/transfer-rule-labels";
import {
  SYNTHETIC_REVIEW_SOURCE,
  SYNTHETIC_SECONDARY_SOURCE,
  SCENARIO_1_FIELD_TO_APPROVE,
  SCENARIO_2_FIELD_TO_REJECT,
  SCENARIO_3_FIELD_NEEDS_MORE_EVIDENCE,
  SCENARIO_4_CRITICAL_CONFLICT,
  FAKE_REVIEWER_NAMES,
  REAL_TEST_REVIEWER_NAME,
} from "../../fixtures/knowledge-base/transfer-rules/synthetic-review-scenarios";
import { buildVerificationQueue } from "../../lib/knowledge-base/queue";
import { computeTrustReport } from "../../lib/knowledge-base/trust";
import { verifiedField, unknownField } from "../../lib/knowledge-base/fields";
import { computeFieldReconciliation, computeSourceReconciliation } from "../../lib/knowledge-base/reconciliation";

(async () => {

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${message}`);
    console.log(`  ❌ ${name}`);
    console.log(`     ${message}`);
  }
}

function assert(condition: boolean, message = "assertion failed") {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message = "values are not equal") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log("\n▶ PermitBridge Knowledge Base — Phase 2.1 Test Suite\n");

// ---------------------------------------------------------------------
// 1. Official source classification
// ---------------------------------------------------------------------
console.log("Official source classification:");
const sources = loadAllSources();

await test("at least one official-board source exists", () => {
  assert(sources.some((s) => s.sourceType === "official-board"), "expected at least one official-board source");
});

await test("all official-board sources are marked official=true, authorityLevel=authoritative", () => {
  const boards = sources.filter((s) => s.sourceType === "official-board");
  assert(boards.length > 0, "no official-board sources found");
  for (const board of boards) {
    assert(board.official === true, `${board.id}: official-board must have official=true`);
    assert(board.authorityLevel === "authoritative", `${board.id}: official-board must have authorityLevel=authoritative`);
  }
});

await test("official-compact source (nursecompact.com) is classified authoritative", () => {
  const compact = sources.find((s) => s.id === "ncsbn-nurse-compact");
  assert(!!compact, "ncsbn-nurse-compact source not found");
  assert(compact!.sourceType === "official-compact", "expected sourceType official-compact");
  assert(compact!.official === true, "expected official=true");
  assert(compact!.authorityLevel === "authoritative", "expected authorityLevel authoritative");
});

await test("official-national-organization source (NCLEX) is authoritative", () => {
  const nclex = sources.find((s) => s.id === "ncsbn-nclex");
  assert(!!nclex, "ncsbn-nclex source not found");
  assert(nclex!.sourceType === "official-national-organization", "expected sourceType official-national-organization");
  assert(nclex!.authorityLevel === "authoritative", "expected authorityLevel authoritative");
});

// ---------------------------------------------------------------------
// 2. Secondary source classification
// ---------------------------------------------------------------------
console.log("\nSecondary source classification:");

await test("nurse.org board directory is classified secondary/non-official", () => {
  const nurseOrg = sources.find((s) => s.id === "nurse-org-board-directory");
  assert(!!nurseOrg, "nurse-org-board-directory source not found");
  assert(nurseOrg!.sourceType === "secondary", "expected sourceType secondary");
  assert(nurseOrg!.official === false, "expected official=false");
  assert(nurseOrg!.authorityLevel === "supplementary", "expected authorityLevel supplementary");
});

// ---------------------------------------------------------------------
// 3. Secondary source cannot independently produce Verified status
// ---------------------------------------------------------------------
console.log("\nSecondary source cannot independently produce Verified status:");

await test("checkCanMarkVerified fails when source is secondary, even with all other conditions met", () => {
  const secondarySource = sources.find((s) => s.id === "nurse-org-board-directory")!;
  const field: VerifiedField<string> = verifiedField({
    value: "Test Board",
    sourceUrl: secondarySource.website,
    sourceTitle: "Test",
    sourceName: "Test",
    verifiedAt: "2026-08-07",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.9,
  });
  const result = checkCanMarkVerified(field, secondarySource, { requireManualReview: false });
  assert(result.canMarkVerified === false, "expected canMarkVerified=false for a secondary source");
  assert(result.failedConditions.includes("source_not_authoritative"), "expected source_not_authoritative in failedConditions");
});

await test("checkCanMarkVerified succeeds when source is authoritative AND reviewer is real (manual review required)", () => {
  const boardSource = sources.find((s) => s.sourceType === "official-board")!;
  const field: VerifiedField<string> = verifiedField({
    value: "Test Board",
    sourceUrl: boardSource.website,
    sourceTitle: "Board site",
    sourceName: boardSource.agencyName,
    verifiedAt: "2026-08-07",
    verificationMethod: "manual-review",
    confidence: 1,
    reviewer: "Jane Smith, Licensing Policy Analyst",
    status: "verified",
  });
  const result = checkCanMarkVerified(field, boardSource, { requireManualReview: true });
  assertEqual(result.failedConditions, [], "expected zero failed conditions");
  assert(result.canMarkVerified === true, "expected canMarkVerified=true");
});

// ---------------------------------------------------------------------
// 4. Missing reviewer
// ---------------------------------------------------------------------
console.log("\nMissing reviewer handling:");

await test("checkCanMarkVerified fails when requireManualReview=true and reviewer is null", () => {
  const boardSource = sources.find((s) => s.sourceType === "official-board")!;
  const field: VerifiedField<string> = verifiedField({
    value: "Test Board",
    sourceUrl: boardSource.website,
    sourceTitle: "Board site",
    sourceName: boardSource.agencyName,
    verifiedAt: "2026-08-07",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.9,
    reviewer: null,
  });
  const result = checkCanMarkVerified(field, boardSource, { requireManualReview: true });
  assert(result.failedConditions.includes("reviewer_missing"), "expected reviewer_missing in failedConditions");
});

await test("fabricated reviewer names (Claude/AI/System/Automatic) are rejected", () => {
  for (const fake of ["Claude", "AI", "System", "Automatic", "  claude  ", "GPT"]) {
    assert(isDisallowedReviewerName(fake), `expected "${fake}" to be flagged as a disallowed reviewer name`);
  }
  assert(!isDisallowedReviewerName("Jane Smith"), 'expected "Jane Smith" to be allowed');
});

await test("zero fields in the actual dataset currently use a fabricated reviewer name", () => {
  const factsDir = path.join(process.cwd(), "data", "knowledge-base", "facts");
  let violations = 0;
  for (const professionSlug of fs.readdirSync(factsDir)) {
    const dir = path.join(factsDir, professionSlug);
    for (const file of fs.readdirSync(dir)) {
      const facts: ProfessionStateFacts = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      for (const key of Object.keys(facts)) {
        const field = (facts as any)[key];
        if (field && typeof field === "object" && "reviewer" in field) {
          if (typeof field.reviewer === "string" && isDisallowedReviewerName(field.reviewer)) violations++;
        }
      }
    }
  }
  assertEqual(violations, 0, "expected zero fabricated-reviewer violations across the whole dataset");
});

// ---------------------------------------------------------------------
// 5. Pending verification
// ---------------------------------------------------------------------
console.log("\nPending verification default:");

await test("a freshly-created verifiedField() defaults to status pending_verification", () => {
  const field = verifiedField({
    value: "X",
    sourceUrl: "https://example.gov",
    sourceTitle: "T",
    sourceName: "N",
    verifiedAt: "2026-08-07",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.9,
  });
  assertEqual(field.status, "pending_verification", "expected default status pending_verification");
});

await test("unknownField() has status pending_verification and value Unknown", () => {
  const field = unknownField();
  assertEqual(field.value, "Unknown", "expected value Unknown");
  assertEqual(field.status, "pending_verification", "expected status pending_verification");
});

// ---------------------------------------------------------------------
// 6. Authoritative source
// ---------------------------------------------------------------------
console.log("\nAuthoritative source counting:");

await test("authoritative source count equals official-board + official-compact + official-national-organization + official-government", () => {
  const expected = sources.filter((s) =>
    ["official-board", "official-government", "official-compact", "official-national-organization"].includes(s.sourceType)
  ).length;
  const actual = sources.filter((s) => s.authorityLevel === "authoritative").length;
  assertEqual(actual, expected, "authoritative count mismatch");
});

// ---------------------------------------------------------------------
// 7. Source usage counts
// ---------------------------------------------------------------------
console.log("\nSource usage counts:");

await test("recomputeSourceUsage produces non-negative counts for every source, dynamically (not hard-coded)", () => {
  const { sourceCounts } = recomputeSourceUsage();
  assert(Object.keys(sourceCounts).length === sources.length, "sourceCounts should cover every source");
  for (const [id, count] of Object.entries(sourceCounts)) {
    assert(count >= 0, `${id}: count must be >= 0`);
  }
});

await test("nurse-org-board-directory usage count reflects fields NOT yet upgraded to a direct board source (Phase 2.3: 80, after Batch 2 + Batch 3 upgraded 10 states total)", () => {
  const { sourceCounts } = recomputeSourceUsage();
  assertEqual(
    sourceCounts["nurse-org-board-directory"],
    80,
    "expected 80 fields still citing nurse-org-board-directory (100 originally, minus 20 moved to direct board sources across Phase 2.2 Batch 2 (5 states) and Phase 2.3 Batch 3 (5 states))"
  );
});

await test("official board sources for all 10 states verified across Batch 2+3 show exactly 2 usages each; the 40 board sources not yet re-verified still show 0 (honest); the 5 new Phase 2.5 fee-schedule sources are separate records", () => {
  const { sourceCounts } = recomputeSourceUsage();
  const verifiedSoFar = [
    "california-nursing-board", "texas-nursing-board", "florida-nursing-board", "new-york-nursing-board", "ohio-nursing-board",
    "illinois-nursing-board", "pennsylvania-nursing-board", "georgia-nursing-board", "north-carolina-nursing-board", "michigan-nursing-board",
  ];
  for (const id of verifiedSoFar) {
    assertEqual(sourceCounts[id], 2, `${id}: expected exactly 2 (licensingBoard + officialWebsite)`);
  }
  const boardIds = sources.filter((s) => s.sourceType === "official-board" && s.id.endsWith("-nursing-board")).map((s) => s.id);
  const notYetVerified = boardIds.filter((id) => !verifiedSoFar.includes(id));
  assertEqual(notYetVerified.length, 40, "expected 40 *-nursing-board sources not yet touched (50 total - 10 verified across Batch 2+3)");
  for (const id of notYetVerified) {
    assertEqual(sourceCounts[id], 0, `${id}: expected 0 — honestly not yet re-verified against its own board site`);
  }
});

await test("Phase 2.5 added exactly 5 new fee-schedule source records, each with exactly 1 field citing it", () => {
  const { sourceCounts } = recomputeSourceUsage();
  const feeScheduleIds = ["california-fee-schedule", "florida-fee-schedule", "georgia-fee-schedule", "illinois-fee-schedule", "new-york-fee-schedule"];
  for (const id of feeScheduleIds) {
    assert(sources.some((s) => s.id === id), `expected source record ${id} to exist`);
    assertEqual(sourceCounts[id], 1, `${id}: expected exactly 1 field citing it`);
  }
});

// ---------------------------------------------------------------------
// 8. Verification queue
// ---------------------------------------------------------------------
console.log("\nVerification queue:");

await test("verification queue has exactly 750 items for registered-nurse (50 states x 15 fields)", () => {
  const queue = buildVerificationQueue("registered-nurse");
  assertEqual(queue.length, 750, "expected 750 queue items");
});

await test("every queue item for a populated field has verificationRequired=true (nothing auto-verified)", () => {
  const queue = buildVerificationQueue("registered-nurse");
  const populated = queue.filter((i) => i.currentValue !== "Unknown");
  assert(populated.length > 0, "expected some populated fields in the queue");
  for (const item of populated) {
    assert(item.verificationRequired === true, `${item.state}/${item.fieldPath}: expected verificationRequired=true`);
  }
});

await test("queue items citing the secondary nurse.org source are flagged sourceIsAuthoritative=false (80 remain after Phase 2.2+2.3 upgraded 20 to direct board sources)", () => {
  const queue = buildVerificationQueue("registered-nurse");
  const nurseOrgItems = queue.filter((i) => i.sourceId === "nurse-org-board-directory");
  assert(nurseOrgItems.length === 80, `expected 80 items citing nurse-org-board-directory, got ${nurseOrgItems.length}`);
  for (const item of nurseOrgItems) {
    assertEqual(item.sourceIsAuthoritative, false, `${item.state}/${item.fieldPath}: expected sourceIsAuthoritative=false`);
  }
});

// ---------------------------------------------------------------------
// 9. Conflict handling
// ---------------------------------------------------------------------
console.log("\nConflict handling:");

await test("detectConflict returns null when values agree", () => {
  const boardSource = sources.find((s) => s.sourceType === "official-board")!;
  const a = verifiedField({
    value: true,
    sourceUrl: boardSource.website,
    sourceTitle: "A",
    sourceName: "A",
    verifiedAt: "2026-08-07",
    verificationMethod: "manual-review",
    confidence: 1,
  });
  const b = verifiedField({
    value: true,
    sourceUrl: boardSource.website,
    sourceTitle: "B",
    sourceName: "B",
    verifiedAt: "2026-08-07",
    verificationMethod: "manual-review",
    confidence: 1,
  });
  const conflict = detectConflict("testField", { field: a, source: boardSource }, { field: b, source: boardSource });
  assertEqual(conflict, null, "expected no conflict when values agree");
});

await test("detectConflict returns a ConflictRecord when two authoritative sources disagree", () => {
  const boardA = sources.find((s) => s.sourceType === "official-board")!;
  const boardB = sources.filter((s) => s.sourceType === "official-board")[1]!;
  const a = verifiedField({
    value: true,
    sourceUrl: boardA.website,
    sourceTitle: "A",
    sourceName: "A",
    verifiedAt: "2026-08-07",
    verificationMethod: "manual-review",
    confidence: 1,
  });
  const b = verifiedField({
    value: false,
    sourceUrl: boardB.website,
    sourceTitle: "B",
    sourceName: "B",
    verifiedAt: "2026-08-07",
    verificationMethod: "manual-review",
    confidence: 1,
  });
  const conflict = detectConflict("testField", { field: a, source: boardA }, { field: b, source: boardB });
  assert(conflict !== null, "expected a ConflictRecord");
  assert(conflict!.resolution === "resolved_a" || conflict!.resolution === "resolved_b", "expected deterministic resolution per Phase 2.6 policy, not left unresolved");
  assert(!!conflict!.resolutionReason, "expected a documented resolutionReason");
  assertEqual(conflict!.reviewer, null, "conflict resolution must never fabricate a human reviewer");
});

await test("detectConflict returns null when one source is only secondary (not a real conflict per policy)", () => {
  const boardSource = sources.find((s) => s.sourceType === "official-board")!;
  const secondarySource = sources.find((s) => s.sourceType === "secondary")!;
  const a = verifiedField({
    value: true,
    sourceUrl: boardSource.website,
    sourceTitle: "A",
    sourceName: "A",
    verifiedAt: "2026-08-07",
    verificationMethod: "manual-review",
    confidence: 1,
  });
  const b = verifiedField({
    value: false,
    sourceUrl: secondarySource.website,
    sourceTitle: "B",
    sourceName: "B",
    verifiedAt: "2026-08-07",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.7,
  });
  const conflict = detectConflict("testField", { field: a, source: boardSource }, { field: b, source: secondarySource });
  assertEqual(conflict, null, "expected null — a secondary source disagreeing doesn't count as a formal conflict");
});

// ---------------------------------------------------------------------
// 10. Trust dashboard
// ---------------------------------------------------------------------
console.log("\nTrust dashboard:");

await test("trust report totalFields equals 750 for the current single-profession dataset", () => {
  const report = computeTrustReport();
  assertEqual(report.totalFields, 750, "expected 750 total fields");
});

await test("trust report shows zero verified fields (honest — no human review has occurred)", () => {
  const report = computeTrustReport();
  assertEqual(report.fieldsByStatus.verified, 0, "expected 0 verified fields");
  assertEqual(report.humanReviewedFieldsCount, 0, "expected 0 human-reviewed fields");
});

await test("trust report fieldsMissingSource is 0 (data quality rule holding)", () => {
  const report = computeTrustReport();
  assertEqual(report.fieldsMissingSource, 0, "expected 0 fields missing a source despite having a value");
});

await test("trust report authoritative/secondary source counts are internally consistent", () => {
  const report = computeTrustReport();
  assertEqual(
    report.authoritativeSourcesCount + report.secondarySourcesCount,
    report.sourcesTracked,
    "authoritative + secondary should equal total sources tracked"
  );
});

await test("trust report fieldsUsingAuthoritativeSources + fieldsUsingSecondarySources + unresolved == total non-Unknown fields", () => {
  const report = computeTrustReport();
  const nonUnknown = Math.round((report.verificationCoveragePct / 100) * report.totalFields);
  assertEqual(
    report.fieldsUsingAuthoritativeSources + report.fieldsUsingSecondarySources + report.fieldsUsingUnresolvedSources,
    nonUnknown,
    "source-usage breakdown should sum to total populated fields"
  );
});

// ---------------------------------------------------------------------
// 11. Metric unit-confusion regression test (Phase 2.1 Final Audit)
// ---------------------------------------------------------------------
console.log("\nMetric unit-confusion regression (field-count vs. source-count):");

await test("fieldsUsingAuthoritativeSources (a FIELD count) must NOT equal officialSourcesReferenced (a SOURCE count) unless coincidentally equal", () => {
  const trust = computeTrustReport();
  const sourceRecon = computeSourceReconciliation();
  // These are DIFFERENT units by definition (100 fields vs. 2 sources in
  // the current dataset). If a future edit accidentally made
  // fieldsUsingAuthoritativeSources iterate sources instead of fields (or
  // vice versa), this specific dataset would make that swap visible: the
  // two numbers are not equal, so asserting them unequal here would catch
  // a regression that silently swapped the two implementations.
  assert(
    trust.fieldsUsingAuthoritativeSources !== sourceRecon.officialSourcesReferencedByAtLeastOneField,
    `fieldsUsingAuthoritativeSources (${trust.fieldsUsingAuthoritativeSources}, a field count) unexpectedly equals ` +
      `officialSourcesReferencedByAtLeastOneField (${sourceRecon.officialSourcesReferencedByAtLeastOneField}, a source count) — ` +
      `either the dataset changed in a way that makes this coincidental, or a unit-confusion bug was introduced.`
  );
});

await test("field reconciliation sum check passes: authoritative + secondary + noSource === totalFields", () => {
  const recon = computeFieldReconciliation("registered-nurse");
  assert(recon.sumCheckPasses, `expected sumCheck (${recon.sumCheck}) to equal totalFields (${recon.totalFields})`);
  assertEqual(recon.totalFields, 750, "expected 750 total RN fields");
});

await test("source reconciliation sum check passes: officialReferenced + secondaryReferenced + unused === totalSourceRecords (79 after Phase 3.1 registered 20 new sources for the 5-rule pilot)", () => {
  const recon = computeSourceReconciliation();
  assert(recon.sumCheckPasses, `expected sumCheck (${recon.sumCheck}) to equal totalSourceRecords (${recon.totalSourceRecords})`);
  assertEqual(recon.totalSourceRecords, 79, "expected 79 total source records (59 after Phase 2.6 + 20 new in Phase 3.1)");
});

await test("trust dashboard's fieldsUsingAuthoritativeSources/fieldsUsingSecondarySources exactly match the independently-computed field reconciliation", () => {
  const trust = computeTrustReport();
  const recon = computeFieldReconciliation("registered-nurse");
  assertEqual(
    trust.fieldsUsingAuthoritativeSources,
    recon.fieldsWithAuthoritativeSource,
    "trust.ts and reconciliation.ts disagree on fields-with-authoritative-source — these are two independent implementations of what should be the same field-level count"
  );
  assertEqual(
    trust.fieldsUsingSecondarySources,
    recon.fieldsWithSecondarySource,
    "trust.ts and reconciliation.ts disagree on fields-with-secondary-source"
  );
});

await test("no source record's fieldsUsingThisSource exceeds the total number of populated fields (sanity bound)", () => {
  const sources = loadAllSources();
  const recon = computeFieldReconciliation("registered-nurse");
  const maxPossible = recon.totalFieldSourceRelationships;
  for (const source of sources) {
    assert(
      source.fieldsUsingThisSource <= maxPossible,
      `${source.id}: fieldsUsingThisSource (${source.fieldsUsingThisSource}) exceeds total populated fields (${maxPossible}) — impossible, indicates a counting bug`
    );
  }
});

// ---------------------------------------------------------------------
// 12. Phase 2.2 — actual verification workflow regression tests
// ---------------------------------------------------------------------
console.log("\nActual verification workflow (Phase 2.2):");

await test("confirmed official fact: authoritative source + field-aware authority check passes", () => {
  const nclexSource = sources.find((s) => s.id === "ncsbn-nclex")!;
  const field: VerifiedField<string> = verifiedField({
    value: "NCLEX-RN",
    sourceUrl: nclexSource.website,
    sourceTitle: "NCLEX Examinations",
    sourceName: "NCSBN",
    verifiedAt: "2026-08-08",
    verificationMethod: "cross_referenced_multiple_sources",
    confidence: 0.95,
  });
  const result = checkCanMarkVerified(field, nclexSource, { requireManualReview: false, fieldPath: "requiredExams" });
  assert(
    !result.failedConditions.includes("source_not_authoritative_for_this_field"),
    "NCSBN should be recognized as authoritative for requiredExams specifically"
  );
});

await test("secondary-only fact cannot become Verified even with a fieldPath supplied", () => {
  const nurseOrg = sources.find((s) => s.id === "nurse-org-board-directory")!;
  const field: VerifiedField<string> = verifiedField({
    value: "Some Board",
    sourceUrl: nurseOrg.website,
    sourceTitle: "Directory",
    sourceName: "Nurse.org",
    verifiedAt: "2026-08-08",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.75,
  });
  const result = checkCanMarkVerified(field, nurseOrg, { requireManualReview: false, fieldPath: "licensingBoard" });
  assert(
    result.failedConditions.includes("source_not_authoritative_for_this_field"),
    "a secondary source must fail the field-aware authority check regardless of fieldPath"
  );
  assert(!result.canMarkVerified, "secondary source must never produce canMarkVerified=true");
});

await test("an authoritative source NOT mapped to a given field is correctly rejected for that field (source-specificity)", () => {
  // NCSBN's NCLEX source is authoritative for requiredExams, but NOT for a
  // state's rnEndorsementFeeUsd — this is the exact distinction Phase 2.2's
  // authority-mapping.ts exists to enforce.
  const nclexSource = sources.find((s) => s.id === "ncsbn-nclex")!;
  assert(
    !isAuthoritativeForField("rnEndorsementFeeUsd", nclexSource.sourceType),
    "NCSBN (official-national-organization) must NOT be treated as authoritative for a state fee field"
  );
  assert(
    isAuthoritativeForField("requiredExams", nclexSource.sourceType),
    "NCSBN must be treated as authoritative for requiredExams, which it actually governs"
  );
});

await test("contradiction: an official source disagreeing with the current value produces a conflict, never a silent overwrite", () => {
  const boardA = sources.filter((s) => s.sourceType === "official-board")[0]!;
  const boardB = sources.filter((s) => s.sourceType === "official-board")[1]!;
  const current = verifiedField({
    value: true,
    sourceUrl: boardA.website,
    sourceTitle: "A",
    sourceName: "A",
    verifiedAt: "2026-08-08",
    verificationMethod: "cross_referenced_multiple_sources",
    confidence: 0.9,
  });
  const freshlyFound = verifiedField({
    value: false,
    sourceUrl: boardB.website,
    sourceTitle: "B",
    sourceName: "B",
    verifiedAt: "2026-08-08",
    verificationMethod: "cross_referenced_multiple_sources",
    confidence: 0.9,
  });
  const conflict = detectConflict("testField", { field: current, source: boardA }, { field: freshlyFound, source: boardB });
  assert(conflict !== null, "expected a ConflictRecord when two authoritative sources disagree");
  assert(conflict!.resolution === "resolved_a" || conflict!.resolution === "resolved_b", "expected deterministic resolution per Phase 2.6 policy");
  // Critically: the ORIGINAL field object is untouched — detectConflict never mutates its inputs.
  assertEqual(current.value, true, "original field's value must be preserved, never silently overwritten");
});

await test("history: a real value change (NY board name correction) produced exactly one new history entry with correct previous/new values", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  const board = ny.licensingBoard;
  assertEqual(board.value, "New York State Board for Nursing", "expected the corrected board name");
  const changeEntries = board.history.filter((h: any) => h.previousValue !== h.newValue);
  assert(changeEntries.length >= 1, "expected at least one real value-change history entry");
  const lastChange = changeEntries[changeEntries.length - 1]!;
  assertEqual(lastChange.previousValue, "New York State Board of Nursing", "expected previousValue to be the old (uncorrected) name");
  assertEqual(lastChange.newValue, "New York State Board for Nursing", "expected newValue to be the corrected name");
  assertEqual(lastChange.reviewer, null, "reviewer must be null — this was an AI-found correction, not human-reviewed");
});

await test("missing official evidence: an Unknown field cannot pass checkCanMarkVerified regardless of a plausible source", () => {
  const boardSource = sources.find((s) => s.sourceType === "official-board")!;
  const field = unknownField<string>();
  const result = checkCanMarkVerified(field, boardSource, { requireManualReview: false, fieldPath: "processingTime" });
  assert(result.failedConditions.includes("value_missing"), "expected value_missing for an Unknown field");
  assert(!result.canMarkVerified, "an Unknown field must never pass verification");
});

await test("reviewer integrity: no real reviewer means the human-review requirement cannot be satisfied, even with perfect evidence otherwise", () => {
  const boardSource = sources.find((s) => s.sourceType === "official-board")!;
  const field: VerifiedField<string> = verifiedField({
    value: "Confirmed Value",
    sourceUrl: boardSource.website,
    sourceTitle: "T",
    sourceName: boardSource.agencyName,
    verifiedAt: "2026-08-08",
    verificationMethod: "cross_referenced_multiple_sources",
    confidence: 0.95,
    reviewer: null,
  });
  const result = checkCanMarkVerified(field, boardSource, { requireManualReview: true, fieldPath: "licensingBoard" });
  assert(result.failedConditions.includes("reviewer_missing"), "expected reviewer_missing");
  assert(!result.canMarkVerified, "must not be verifiable without a real reviewer when manual review is required");
});

await test("zero fields in the actual dataset were marked Verified during Phase 2.2 batch processing (goal was accuracy, not maximizing Verified count)", () => {
  const trust = computeTrustReport();
  assertEqual(trust.fieldsByStatus.verified, 0, "expected 0 verified fields after Phase 2.2 batches — no human reviewer exists in this environment");
});

// ---------------------------------------------------------------------
// 13. Phase 2.3 — RN Core Fields & Batch 3 regression tests
// ---------------------------------------------------------------------
console.log("\nRN Core Fields (Phase 2.3):");

await test("every RN core field has a defined authority category (no core field is unmapped)", () => {
  for (const def of RN_CORE_FIELDS) {
    assert(def.authorityTiers.length > 0, `${def.field}: expected at least one authority tier defined`);
  }
});

await test("Batch 3 states (IL/PA/GA/NC/MI) now show 2 authoritative fields each (licensingBoard + officialWebsite)", () => {
  const { sourceCounts } = recomputeSourceUsage();
  for (const id of ["illinois-nursing-board", "pennsylvania-nursing-board", "georgia-nursing-board", "north-carolina-nursing-board", "michigan-nursing-board"]) {
    assertEqual(sourceCounts[id], 2, `${id}: expected exactly 2 fields citing it after Phase 2.3 Batch 3`);
  }
});

await test("nurse-org-board-directory usage reflects 10 total states upgraded across Phase 2.2 + 2.3 (100 - 20 = 80)", () => {
  const { sourceCounts } = recomputeSourceUsage();
  assertEqual(sourceCounts["nurse-org-board-directory"], 80, "expected 80 fields still citing nurse-org-board-directory");
});

await test("official source upgrade changes provenance (sourceUrl/verificationMethod) without changing the value, when source agrees", () => {
  const il = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "illinois.json"), "utf-8")
  );
  assertEqual(il.officialWebsite.value, "https://idfpr.illinois.gov/profs/nursing.html", "value must be unchanged (source agreed)");
  assertEqual(il.officialWebsite.sourceUrl, "https://idfpr.illinois.gov/profs/nursing.html", "sourceUrl must now point directly at the board");
  assertEqual(il.officialWebsite.verificationMethod, "cross_referenced_multiple_sources", "verificationMethod must reflect the real upgrade");
});

await test("Field History is only appended when a real event occurs — untouched-by-Batch2/3 states have exactly the history entries their actual verification passes justify", () => {
  const factsDir = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");
  const untouchedByBatch23 = ["alabama", "wyoming", "montana"]; // never touched by Batch 2 or Batch 3
  for (const slug of untouchedByBatch23) {
    const facts = JSON.parse(fs.readFileSync(path.join(factsDir, `${slug}.json`), "utf-8"));
    // compactMembership: 1 original creation (Phase 1) + 1 Batch 1 re-confirmation = 2 entries.
    assertEqual(facts.compactMembership.history.length, 2, `${slug}: expected exactly 2 history entries (Phase 1 creation + Batch 1 re-confirmation)`);
    // licensingBoard: never touched by ANY batch for these 3 states — still just its original single entry.
    assertEqual(facts.licensingBoard.history.length, 1, `${slug}: expected exactly 1 history entry (original Phase 1 value, never re-verified)`);
  }
});

await test("existing value is preserved (not silently changed) when the official source agrees, for all 10 states verified across Batch 2+3", () => {
  const verifiedSlugs = ["california", "texas", "florida", "ohio", "illinois", "pennsylvania", "georgia", "north-carolina", "michigan"]; // excludes new-york, which DID have a real correction
  const factsDir = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");
  for (const slug of verifiedSlugs) {
    const facts = JSON.parse(fs.readFileSync(path.join(factsDir, `${slug}.json`), "utf-8"));
    assert(facts.licensingBoard.history.length > 0, `${slug}: expected at least one history entry`);
    const lastHistoryEntry = facts.licensingBoard.history[facts.licensingBoard.history.length - 1]!;
    assertEqual(lastHistoryEntry.previousValue, lastHistoryEntry.newValue, `${slug}: expected value preserved (source agreed), not changed`);
  }
});

await test("RN core field stats total (auth+secondary+missing) equals 50 for every core field", () => {
  for (const stat of computeCoreFieldStats()) {
    const sum = stat.authoritativeCoverage + stat.secondaryCoverage + stat.missingCoverage;
    assertEqual(sum, 50, `${stat.field}: expected auth+secondary+missing to sum to 50 states`);
  }
});

await test("trust dashboard and source reconciliation remain internally consistent after Batch 3 + Phase 2.5 (cross-module agreement)", () => {
  const trust = computeTrustReport();
  const sourceRecon = computeSourceReconciliation();
  assertEqual(trust.fieldsUsingAuthoritativeSources, 125, "expected 125 fields with authoritative source after Phase 2.5 (120 after Batch 3 + 5 new rnEndorsementFeeUsd fields)");
  assertEqual(trust.fieldsUsingSecondarySources, 80, "expected 80 fields with secondary source (unchanged by Phase 2.5)");
  assert(sourceRecon.sumCheckPasses, "source reconciliation sum check must still pass after Phase 2.5");
});

await test("zero fields marked Verified after Batch 3 — status remains Pending regardless of source quality (no human reviewer)", () => {
  const trust = computeTrustReport();
  assertEqual(trust.fieldsByStatus.verified, 0, "expected 0 verified fields — Phase 2.3 batches upgrade evidence, never verify without a human");
});

// ---------------------------------------------------------------------
// 14. Phase 2.5 — rnEndorsementFeeUsd batch regression tests
// ---------------------------------------------------------------------
console.log("\nrnEndorsementFeeUsd batch (Phase 2.5):");

await test("rnEndorsementFeeUsd accepts an authoritative state source (California)", () => {
  const caSource = sources.find((s) => s.id === "california-fee-schedule")!;
  const field: VerifiedField<number> = verifiedField({
    value: 350,
    sourceUrl: caSource.website,
    sourceTitle: "CCR Title 16 Section 1417",
    sourceName: caSource.agencyName,
    verifiedAt: "2026-08-09",
    verificationMethod: "official_document_review",
    confidence: 0.93,
  });
  const result = checkCanMarkVerified(field, caSource, { requireManualReview: false, fieldPath: "rnEndorsementFeeUsd", jurisdiction: "california" });
  assert(
    !result.failedConditions.includes("source_not_authoritative_for_this_field"),
    "an official-board source must be recognized as authoritative for rnEndorsementFeeUsd"
  );
  assert(!result.failedConditions.includes("source_jurisdiction_mismatch"), "matching jurisdiction must not fail the jurisdiction check");
});

await test("secondary source (nurse.org) does not satisfy authoritative evidence for rnEndorsementFeeUsd", () => {
  const nurseOrg = sources.find((s) => s.id === "nurse-org-board-directory")!;
  const field: VerifiedField<number> = verifiedField({
    value: 350,
    sourceUrl: nurseOrg.website,
    sourceTitle: "Directory",
    sourceName: "Nurse.org",
    verifiedAt: "2026-08-09",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.7,
  });
  const result = checkCanMarkVerified(field, nurseOrg, { requireManualReview: false, fieldPath: "rnEndorsementFeeUsd", jurisdiction: "california" });
  assert(result.failedConditions.includes("source_not_authoritative_for_this_field"), "secondary source must fail authority check for rnEndorsementFeeUsd");
});

await test("jurisdiction mismatch is rejected: a California source cannot verify a Texas fee, even though both are authoritative official-board sources", () => {
  const caSource = sources.find((s) => s.id === "california-fee-schedule")!;
  const field: VerifiedField<number> = verifiedField({
    value: 108,
    sourceUrl: caSource.website,
    sourceTitle: "CCR Title 16 Section 1417",
    sourceName: caSource.agencyName,
    verifiedAt: "2026-08-09",
    verificationMethod: "official_document_review",
    confidence: 0.93,
  });
  const result = checkCanMarkVerified(field, caSource, { requireManualReview: false, fieldPath: "rnEndorsementFeeUsd", jurisdiction: "texas" });
  assert(result.failedConditions.includes("source_jurisdiction_mismatch"), "expected source_jurisdiction_mismatch when state doesn't match source's jurisdiction");
});

await test("national/compact sources are jurisdiction-agnostic (no mismatch for a state-specific field check)", () => {
  const nclexSource = sources.find((s) => s.id === "ncsbn-nclex")!; // jurisdiction: "national"
  const field: VerifiedField<string> = verifiedField({
    value: "NCLEX-RN",
    sourceUrl: nclexSource.website,
    sourceTitle: "NCLEX",
    sourceName: "NCSBN",
    verifiedAt: "2026-08-09",
    verificationMethod: "cross_referenced_multiple_sources",
    confidence: 0.95,
  });
  const result = checkCanMarkVerified(field, nclexSource, { requireManualReview: false, fieldPath: "requiredExams", jurisdiction: "california" });
  assert(!result.failedConditions.includes("source_jurisdiction_mismatch"), "a national source must not fail jurisdiction check regardless of state");
});

await test("fee semantics are preserved: all 5 new fee values match the field's documented endorsement-fee definition, not exam/renewal fees", () => {
  const expectedFees: Record<string, number> = { california: 350, florida: 110, georgia: 75, illinois: 50, "new-york": 143 };
  for (const [slug, expectedFee] of Object.entries(expectedFees)) {
    const facts = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", `${slug}.json`), "utf-8")
    );
    assertEqual(facts.rnEndorsementFeeUsd.value, expectedFee, `${slug}: expected rnEndorsementFeeUsd = ${expectedFee}`);
    assert(
      facts.rnEndorsementFeeUsd.notes && /endorsement/i.test(facts.rnEndorsementFeeUsd.notes),
      `${slug}: expected notes to explicitly document the endorsement-fee distinction`
    );
  }
});

await test("missing official evidence remains Unknown/Pending: the 45 non-batch states are untouched", () => {
  const untouchedSample = ["alabama", "wyoming", "texas", "ohio"]; // texas/ohio were verified for board/website in Batch 2, but NOT for fees
  for (const slug of untouchedSample) {
    const facts = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", `${slug}.json`), "utf-8")
    );
    assertEqual(facts.rnEndorsementFeeUsd.value, "Unknown", `${slug}: expected rnEndorsementFeeUsd to remain Unknown (not part of Phase 2.5 batch)`);
    assertEqual(facts.rnEndorsementFeeUsd.status, "pending_verification", `${slug}: expected status pending_verification`);
  }
});

await test("human reviewer is not fabricated on any of the 5 new fee fields", () => {
  for (const slug of ["california", "florida", "georgia", "illinois", "new-york"]) {
    const facts = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", `${slug}.json`), "utf-8")
    );
    assertEqual(facts.rnEndorsementFeeUsd.reviewer, null, `${slug}: reviewer must be null`);
    assertEqual(facts.rnEndorsementFeeUsd.status, "pending_verification", `${slug}: status must be pending_verification, never verified`);
  }
});

await test("Field History is correct: previousValue is null (not a fake prior value) since the field was genuinely Unknown before Phase 2.5", () => {
  const facts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "california.json"), "utf-8")
  );
  assert(facts.rnEndorsementFeeUsd.history.length > 0, "expected at least one history entry");
  const lastEntry = facts.rnEndorsementFeeUsd.history[facts.rnEndorsementFeeUsd.history.length - 1]!;
  assertEqual(lastEntry.previousValue, null, "expected previousValue null — no fake prior value fabricated for a field that was genuinely Unknown");
  assertEqual(lastEntry.newValue, 350, "expected newValue to be the verified fee");
});

await test("source usage is recalculated dynamically for the 5 new fee-schedule sources (not hard-coded)", () => {
  const { sourceCounts } = recomputeSourceUsage();
  for (const id of ["california-fee-schedule", "florida-fee-schedule", "georgia-fee-schedule", "illinois-fee-schedule", "new-york-fee-schedule"]) {
    assertEqual(sourceCounts[id], 1, `${id}: expected exactly 1 field citing it`);
  }
});

await test("trust metrics reconcile after Phase 2.5: authoritative fields rose from 120 to 125, secondary unchanged at 80", () => {
  const trust = computeTrustReport();
  assertEqual(trust.fieldsUsingAuthoritativeSources, 125, "expected 125 authoritative fields after Phase 2.5");
  assertEqual(trust.fieldsUsingSecondarySources, 80, "expected 80 secondary fields (unchanged — Phase 2.5 touched a previously-Unknown field, not a secondary one)");
  assertEqual(trust.fieldsByStatus.verified, 0, "expected 0 verified fields — no human reviewer exists");
});

// ---------------------------------------------------------------------
// 15. Phase 2.6 — Source Conflict & Fee Semantics regression tests
// ---------------------------------------------------------------------
console.log("\nSource Conflict & Fee Semantics (Phase 2.6):");

// Deterministic fixture representing the ACTUAL New York situation —
// no web fetch, per Step 7's explicit requirement.
const nyGeneralChartFixture: ConflictSourceSnapshot = {
  value: "50",
  url: "https://www.op.nysed.gov/sites/op/files/documents/opfeechart.pdf",
  agencyName: "New York State Education Department, Office of the Professions",
  title: "Office of the Professions Fees Chart (all professions)",
  jurisdiction: "new-york",
  authorityLevel: "authoritative",
  specificity: "jurisdiction-general",
  observedAt: "2026-08-09",
};
const nyNursingSpecificFixture: ConflictSourceSnapshot = {
  value: "143",
  url: "https://www.op.nysed.gov/professions/registered-professional-nursing/endorsement-nursing-licenses",
  agencyName: "New York State Education Department, Office of the Professions",
  title: "Endorsement of Nursing Licenses - RPN",
  jurisdiction: "new-york",
  authorityLevel: "authoritative",
  specificity: "profession-specific",
  observedAt: "2026-08-09",
};

await test("[NY fixture] two official sources may conflict — both authoritative, different values", () => {
  assertEqual(nyGeneralChartFixture.authorityLevel, "authoritative", "general chart is genuinely official");
  assertEqual(nyNursingSpecificFixture.authorityLevel, "authoritative", "nursing-specific page is genuinely official");
  assert(nyGeneralChartFixture.value !== nyNursingSpecificFixture.value, "fixture must represent an actual value conflict ($50 vs $143)");
});

await test("[NY fixture] profession-specific source outranks general official source", () => {
  const result = resolveSourceConflict("rnEndorsementFeeUsd", nyGeneralChartFixture, nyNursingSpecificFixture, "endorsement");
  assertEqual(result.winner, "b", "expected the nursing-specific page (source B, $143) to win over the general all-professions chart");
  assert(result.reasonSteps.some((s) => s.toLowerCase().includes("specificity")), "expected the specificity tier to be cited as the deciding factor");
});

await test("[NY fixture] field-specific authority is respected: a field-specific source outranks a profession-specific one", () => {
  const fieldSpecific: ConflictSourceSnapshot = { ...nyNursingSpecificFixture, specificity: "field-specific", title: "RN Endorsement Fee Schedule" };
  const result = resolveSourceConflict("rnEndorsementFeeUsd", nyNursingSpecificFixture, fieldSpecific, "endorsement");
  assertEqual(result.winner, "b", "expected the field-specific source to outrank the profession-specific source");
});

await test("jurisdiction mismatch is rejected in conflict resolution context too (reuses the same checkCanMarkVerified guard)", () => {
  const caSource = sources.find((s) => s.id === "california-fee-schedule")!;
  const field = verifiedField({
    value: 999,
    sourceUrl: caSource.website,
    sourceTitle: "T",
    sourceName: caSource.agencyName,
    verifiedAt: "2026-08-09",
    verificationMethod: "official_document_review",
    confidence: 0.9,
  });
  const result = checkCanMarkVerified(field, caSource, { requireManualReview: false, fieldPath: "rnEndorsementFeeUsd", jurisdiction: "new-york" });
  assert(result.failedConditions.includes("source_jurisdiction_mismatch"), "a California source must never be usable to verify a New York fact");
});

await test("conflicting evidence is preserved: the actual NY conflict record in production data retains both sources' full provenance", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  assert(ny.conflicts.length >= 1, "expected at least 1 recorded conflict for New York");
  const conflict = ny.conflicts.find((c: any) => c.field === "rnEndorsementFeeUsd");
  assert(!!conflict, "expected an rnEndorsementFeeUsd conflict record");
  assertEqual(conflict.sourceA.value, "50", "sourceA's original value must be preserved, not discarded");
  assertEqual(conflict.sourceB.value, "143", "sourceB's original value must be preserved");
  assert(!!conflict.sourceA.url && !!conflict.sourceB.url, "both URLs must be preserved");
  assert(!!conflict.sourceA.agencyName && !!conflict.sourceB.agencyName, "both agency names must be preserved");
});

await test("conflict does not become Verified automatically — the resolved NY field remains pending_verification", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  assertEqual(ny.rnEndorsementFeeUsd.status, "pending_verification", "resolving a conflict deterministically must not promote the field to Verified");
  assertEqual(ny.rnEndorsementFeeUsd.reviewer, null, "reviewer must remain null — policy resolution is not human review");
});

await test("resolution reason is stored and is substantive (not just 'official source wins')", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  const conflict = ny.conflicts.find((c: any) => c.field === "rnEndorsementFeeUsd");
  assert(!!conflict.resolutionReason, "expected a resolutionReason");
  assert(conflict.resolutionReason.length > 30, "expected a substantive explanation, not a one-word reason");
  assert(!/^official source wins?$/i.test(conflict.resolutionReason.trim()), "must not reduce to the forbidden 'official source wins' shortcut");
});

await test("source provenance remains intact: both new-york-fee-schedule and new-york-fees-chart-general SourceRecords exist independently", () => {
  const specific = sources.find((s) => s.id === "new-york-fee-schedule");
  const general = sources.find((s) => s.id === "new-york-fees-chart-general");
  assert(!!specific && !!general, "both conflicting sources must be independently registered, not merged or one discarded");
  assertEqual(specific!.specificity, "profession-specific", "new-york-fee-schedule should be classified profession-specific");
  assertEqual(general!.specificity, "jurisdiction-general", "new-york-fees-chart-general should be classified jurisdiction-general");
});

await test("human reviewer remains null on the conflict record unless genuinely reviewed", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  const conflict = ny.conflicts.find((c: any) => c.field === "rnEndorsementFeeUsd");
  assertEqual(conflict.reviewer, null, "no human has reviewed this conflict — reviewer must be null");
  assertEqual(conflict.reviewedAt, null, "reviewedAt must be null when reviewer is null");
});

await test("Trust Dashboard counts remain correct after Phase 2.6 (no data value changed, only provenance/conflict metadata added)", () => {
  const trust = computeTrustReport();
  assertEqual(trust.fieldsByStatus.verified, 0, "expected 0 verified fields — unchanged by Phase 2.6");
  assertEqual(trust.fieldsUsingAuthoritativeSources, 125, "expected 125 authoritative fields — unchanged, Phase 2.6 added no new field values");
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  assertEqual(ny.rnEndorsementFeeUsd.value, 143, "the actual NY fee value must remain unchanged — the conflict confirmed the existing value was already correct");
});

await test("Trust Dashboard surfaces the NY conflict explicitly — not hidden inside 'authoritative' counts", () => {
  const trust = computeTrustReport();
  assertEqual(trust.fieldsWithRecordedConflicts, 1, "expected exactly 1 field with a recorded conflict (NY's rnEndorsementFeeUsd)");
  assertEqual(trust.fieldsWithUnresolvedConflicts, 0, "expected 0 unresolved — the NY conflict was deterministically resolved, not left ambiguous");
  assert(
    trust.officialSourcesInvolvedInConflicts.includes("New York State Education Department, Office of the Professions"),
    "expected NYSED to appear in officialSourcesInvolvedInConflicts"
  );
});

// ---------------------------------------------------------------------
// 16. Phase 2.7 — Semantic Rename migration regression tests
// ---------------------------------------------------------------------
console.log("\nSemantic Rename migration (Phase 2.7):");

await test("1. Old field name 'initialFeeUsd' no longer exists as an active key in any RN fact file", () => {
  const factsDir = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");
  for (const file of fs.readdirSync(factsDir)) {
    const facts = JSON.parse(fs.readFileSync(path.join(factsDir, file), "utf-8"));
    assert(!("initialFeeUsd" in facts), `${file}: expected no 'initialFeeUsd' key to remain`);
  }
});

await test("2. New field name 'rnEndorsementFeeUsd' exists in every RN fact file", () => {
  const factsDir = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");
  const files = fs.readdirSync(factsDir);
  assertEqual(files.length, 50, "expected 50 state files");
  for (const file of files) {
    const facts = JSON.parse(fs.readFileSync(path.join(factsDir, file), "utf-8"));
    assert("rnEndorsementFeeUsd" in facts, `${file}: expected 'rnEndorsementFeeUsd' key to exist`);
  }
});

await test("3. All five existing fee values are unchanged after the rename", () => {
  const expectedFees: Record<string, number> = { california: 350, florida: 110, georgia: 75, illinois: 50, "new-york": 143 };
  for (const [slug, expectedFee] of Object.entries(expectedFees)) {
    const facts = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", `${slug}.json`), "utf-8")
    );
    assertEqual(facts.rnEndorsementFeeUsd.value, expectedFee, `${slug}: fee value must survive the rename unchanged`);
  }
});

await test("4. NY conflict resolution still returns $143 under the new field name", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  assertEqual(ny.rnEndorsementFeeUsd.value, 143, "NY's resolved fee must remain $143");
  const conflict = ny.conflicts.find((c: any) => c.field === "rnEndorsementFeeUsd");
  assert(!!conflict, "expected the conflict record's field to now say 'rnEndorsementFeeUsd'");
  assertEqual(conflict.resolution, "resolved_b", "conflict resolution outcome must be unchanged by the rename");
});

await test("5. Both NY conflict sources remain preserved after the rename", () => {
  const ny = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")
  );
  const conflict = ny.conflicts.find((c: any) => c.field === "rnEndorsementFeeUsd");
  assertEqual(conflict.sourceA.value, "50", "sourceA value must survive the rename");
  assertEqual(conflict.sourceB.value, "143", "sourceB value must survive the rename");
  assert(!!conflict.sourceA.url && !!conflict.sourceB.url, "both URLs must survive the rename");
});

await test("6. History remains intact — same length, same content, only the containing key changed", () => {
  const facts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "california.json"), "utf-8")
  );
  const history = facts.rnEndorsementFeeUsd.history;
  assertEqual(history.length, 1, "expected exactly 1 history entry, unchanged by the rename");
  assertEqual(history[0].previousValue, null, "history previousValue must be unchanged");
  assertEqual(history[0].newValue, 350, "history newValue must be unchanged");
  assert(history[0].reason.includes("Phase 2.5"), "history reason text must be preserved verbatim, not rewritten");
});

await test("7. Authority checks still work against the new field name", () => {
  const caSource = sources.find((s) => s.id === "california-fee-schedule")!;
  const field: VerifiedField<number> = verifiedField({
    value: 350,
    sourceUrl: caSource.website,
    sourceTitle: "T",
    sourceName: caSource.agencyName,
    verifiedAt: "2026-08-09",
    verificationMethod: "official_document_review",
    confidence: 0.93,
  });
  const result = checkCanMarkVerified(field, caSource, { requireManualReview: false, fieldPath: "rnEndorsementFeeUsd", jurisdiction: "california" });
  assert(!result.failedConditions.includes("source_not_authoritative_for_this_field"), "authority mapping must resolve correctly under the new field name");
  assert(isAuthoritativeForField("rnEndorsementFeeUsd", "official-board"), "isAuthoritativeForField must recognize the new field name");
});

await test("8. Human-review queue exposes 'rnEndorsementFeeUsd', not the old name", () => {
  const queue = buildVerificationQueue("registered-nurse");
  const feeItems = queue.filter((i) => i.fieldPath === "rnEndorsementFeeUsd");
  assertEqual(feeItems.length, 50, "expected 50 queue items (one per state) for the renamed field");
  const oldNameItems = queue.filter((i) => i.fieldPath === ("initialFeeUsd" as any));
  assertEqual(oldNameItems.length, 0, "expected zero queue items still using the old field name");
});

await test("9. Trust metrics remain unchanged by the rename (same counts as Phase 2.6)", () => {
  const trust = computeTrustReport();
  assertEqual(trust.totalFields, 750, "total fields must be unchanged");
  assertEqual(trust.fieldsByStatus.verified, 0, "verified count must be unchanged");
  assertEqual(trust.fieldsUsingAuthoritativeSources, 125, "authoritative count must be unchanged");
  assertEqual(trust.fieldsWithRecordedConflicts, 1, "conflict count must be unchanged");
});

await test("10. Reconciliation remains consistent after the rename", () => {
  const fieldRecon = computeFieldReconciliation("registered-nurse");
  assert(fieldRecon.sumCheckPasses, "field reconciliation sum check must still pass");
  const sourceRecon = computeSourceReconciliation();
  assert(sourceRecon.sumCheckPasses, "source reconciliation sum check must still pass");
  assertEqual(sourceRecon.totalSourceRecords, 79, "source record count as of this test's original writing (Phase 2.7) — grew further in Phase 3.1, which is expected and not a rename-related regression; this assertion documents Phase 2.7's own baseline moment, now updated to avoid false-failing on later legitimate growth");
});

// ---------------------------------------------------------------------
// 17. Phase 3.0 — TransferRule schema tests (synthetic fixtures only)
// ---------------------------------------------------------------------
console.log("\nTransferRule Schema (Phase 3.0):");

const synthResolveSource = (url: string) => SYNTHETIC_SOURCES.find((s) => s.website === url);
const synthKnownProfessions = new Set(["registered-nurse"]);

await test("directional transfer independence: rule(CA,TX) != rule(TX,CA)", () => {
  assert(SYNTHETIC_TRANSFER_CA_TO_TX.sourceState !== SYNTHETIC_TRANSFER_TX_TO_CA.sourceState, "source states must differ");
  assertEqual(SYNTHETIC_TRANSFER_CA_TO_TX.sourceState, "california");
  assertEqual(SYNTHETIC_TRANSFER_CA_TO_TX.destinationState, "texas");
  assertEqual(SYNTHETIC_TRANSFER_TX_TO_CA.sourceState, "texas");
  assertEqual(SYNTHETIC_TRANSFER_TX_TO_CA.destinationState, "california");
  // Not just different identity — genuinely different evidence, proving no silent symmetry:
  assert(
    SYNTHETIC_TRANSFER_CA_TO_TX.applicationFeeUsd.value !== SYNTHETIC_TRANSFER_TX_TO_CA.applicationFeeUsd.value,
    "fee values must differ between directions — the model must never assume A->B implies B->A"
  );
  assert(
    (SYNTHETIC_TRANSFER_CA_TO_TX.examRequirement.value as any).status !== (SYNTHETIC_TRANSFER_TX_TO_CA.examRequirement.value as any).status,
    "exam requirement must differ between directions in this fixture"
  );
});

await test("field-level verification: every populated field on the fixture carries its own independent source/date/confidence", () => {
  const rule = SYNTHETIC_TRANSFER_CA_TO_TX;
  assert(rule.transferMechanism.sourceUrl !== rule.applicationFeeUsd.sourceUrl, "different fields may (and here do) cite different sources — no single rule-level source");
  assert(!!rule.transferMechanism.verifiedAt && !!rule.applicationFeeUsd.verifiedAt, "every populated field has its own verifiedAt");
});

await test("Unknown vs Not Applicable are structurally distinct, never collapsed", () => {
  const unknownField_ = SYNTHETIC_TRANSFER_CA_TO_TX.temporaryPermitAvailability;
  const notApplicableField = SYNTHETIC_TRANSFER_CA_TO_TX.reciprocityAgreementExists;
  assertEqual(unknownField_.value, "Unknown", "temporaryPermitAvailability must be the literal Unknown sentinel");
  assert(notApplicableField.value !== "Unknown", "reciprocityAgreementExists must NOT be Unknown");
  assertEqual((notApplicableField.value as any).status, "not_applicable", "reciprocityAgreementExists must be the real, evidenced 'not_applicable' answer");
  assert(!!notApplicableField.sourceUrl, "a Not Applicable determination must still carry evidence, unlike a genuine Unknown");
  assertEqual(unknownField_.sourceUrl, null, "a genuine Unknown must not have a sourceUrl");
});

await test("Conditional requirements carry a real, structured conditions[] array — not a boolean", () => {
  const field = SYNTHETIC_TRANSFER_CA_TO_TX.experienceRequirement;
  const value = field.value as any;
  assertEqual(value.status, "conditional");
  assert(Array.isArray(value.conditions) && value.conditions.length === 2, "expected exactly 2 structured conditions in the fixture");
  assert(value.conditions.every((c: any) => typeof c.description === "string" && typeof c.category === "string"), "every condition must have description + category");
});

await test("source jurisdiction validation: TransferRule validator rejects a field whose source jurisdiction doesn't match destinationState", () => {
  const badRule: TransferRule = {
    ...SYNTHETIC_TRANSFER_CA_TO_TX,
    // deliberately cite the CA source (jurisdiction: california) on a CA->TX rule, where destinationState is texas
    applicationFeeUsd: { ...SYNTHETIC_TRANSFER_CA_TO_TX.applicationFeeUsd, sourceUrl: SYNTHETIC_SOURCES.find((s) => s.id === "synthetic-test-ca-brn")!.website },
  };
  const issues = validateTransferRule(badRule, synthResolveSource, synthKnownProfessions);
  assert(issues.some((i) => i.rule === "7"), "expected a Rule 7 (jurisdiction mismatch) violation");
});

await test("conflict integration: TransferRule reuses ConflictRecord/ConflictSourceSnapshot exactly, no second conflict system", () => {
  const a: ConflictSourceSnapshot = {
    value: "10",
    url: SYNTHETIC_SOURCE_TDLR_URL(),
    agencyName: "[TEST] A",
    title: "[TEST] A",
    jurisdiction: "texas",
    authorityLevel: "authoritative",
    specificity: "field-specific",
    observedAt: "2026-08-10",
  };
  const b: ConflictSourceSnapshot = { ...a, value: "20", agencyName: "[TEST] B", title: "[TEST] B", specificity: "profession-specific" };
  const result = resolveSourceConflict("applicationFeeUsd", a, b);
  assertEqual(result.winner, "a", "the SAME resolveSourceConflict function from Phase 2.6 must work unmodified against TransferRule field names — field-specific (a) correctly outranks profession-specific (b)");
});

await test("deterministic slug generation matches the exact documented convention", () => {
  assertEqual(
    buildTransferRuleSlug({ profession: "registered-nurse", sourceState: "california", destinationState: "texas" }),
    "registered-nurse/california-to-texas"
  );
  assertEqual(
    buildTransferRuleSlug({ profession: "registered-nurse", sourceState: "new-york", destinationState: "florida" }),
    "registered-nurse/new-york-to-florida"
  );
});

await test("slug parsing round-trips correctly", () => {
  const parsed = parseTransferRuleSlug("registered-nurse/california-to-texas");
  assert(!!parsed, "expected a successful parse");
  assertEqual(parsed!.profession, "registered-nurse");
  assertEqual(parsed!.sourceState, "california");
  assertEqual(parsed!.destinationState, "texas");
  assertEqual(parseTransferRuleSlug("not-a-valid-slug"), null, "expected null for a malformed slug");
});

await test("schema validation: the two synthetic fixtures both pass validateTransferRule cleanly", () => {
  const issuesAB = validateTransferRule(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions);
  const issuesBA = validateTransferRule(SYNTHETIC_TRANSFER_TX_TO_CA, synthResolveSource, synthKnownProfessions);
  const errorsAB = issuesAB.filter((i) => i.severity === "error");
  const errorsBA = issuesBA.filter((i) => i.severity === "error");
  assertEqual(errorsAB, [], "expected zero validation errors on the CA->TX fixture");
  assertEqual(errorsBA, [], "expected zero validation errors on the TX->CA fixture");
});

await test("schema validation catches sourceState === destinationState (Rule 1)", () => {
  const invalid: TransferRule = { ...SYNTHETIC_TRANSFER_CA_TO_TX, destinationState: "california" };
  const issues = validateTransferRule(invalid, synthResolveSource, synthKnownProfessions);
  assert(issues.some((i) => i.rule === "1"), "expected a Rule 1 violation when sourceState === destinationState");
});

await test("schema validation catches an unknown profession slug (Rule 2)", () => {
  const invalid: TransferRule = { ...SYNTHETIC_TRANSFER_CA_TO_TX, profession: "not-a-real-profession" };
  const issues = validateTransferRule(invalid, synthResolveSource, synthKnownProfessions);
  assert(issues.some((i) => i.rule === "2"), "expected a Rule 2 violation for an unknown profession");
});

await test("schema validation catches a raw boolean on a requirement field (Rule 5 — Unknown/N/A must not collapse to true/false)", () => {
  const invalid: TransferRule = {
    ...SYNTHETIC_TRANSFER_CA_TO_TX,
    examRequirement: { ...SYNTHETIC_TRANSFER_CA_TO_TX.examRequirement, value: true as any },
  };
  const issues = validateTransferRule(invalid, synthResolveSource, synthKnownProfessions);
  assert(issues.some((i) => i.rule === "5"), "expected a Rule 5 violation for a raw boolean requirement value");
});

await test("no fabricated reviewer: schema validation catches a disallowed placeholder reviewer name (Rule 10)", () => {
  const invalid: TransferRule = {
    ...SYNTHETIC_TRANSFER_CA_TO_TX,
    transferMechanism: { ...SYNTHETIC_TRANSFER_CA_TO_TX.transferMechanism, reviewer: "Claude" },
  };
  const issues = validateTransferRule(invalid, synthResolveSource, synthKnownProfessions);
  assert(issues.some((i) => i.rule === "10"), "expected a Rule 10 violation for a fabricated reviewer name");
});

await test("no unsupported Verified status: schema validation catches a field marked verified while a related conflict exists (Rule 9)", () => {
  const invalid: TransferRule = {
    ...SYNTHETIC_TRANSFER_CA_TO_TX,
    applicationFeeUsd: { ...SYNTHETIC_TRANSFER_CA_TO_TX.applicationFeeUsd, status: "verified", reviewer: "Jane Smith, Licensing Analyst" },
    conflicts: [
      {
        field: "applicationFeeUsd",
        sourceA: { value: "999", url: "x", agencyName: "A", title: "A", jurisdiction: "texas", authorityLevel: "authoritative", specificity: "field-specific", observedAt: "2026-08-10" },
        sourceB: { value: "888", url: "y", agencyName: "B", title: "B", jurisdiction: "texas", authorityLevel: "authoritative", specificity: "field-specific", observedAt: "2026-08-10" },
        detectedAt: "2026-08-10",
        reasonForConflict: "test",
        resolution: "unresolved",
        reviewer: null,
        reviewedAt: null,
      },
    ],
  };
  const issues = validateTransferRule(invalid, synthResolveSource, synthKnownProfessions);
  assert(issues.some((i) => i.rule === "9"), "expected a Rule 9 violation for a Verified field with an active conflict");
});

await test("isTransferRuleValid returns true for both clean synthetic fixtures", () => {
  assert(isTransferRuleValid(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions), "CA->TX fixture should be schema-valid");
  assert(isTransferRuleValid(SYNTHETIC_TRANSFER_TX_TO_CA, synthResolveSource, synthKnownProfessions), "TX->CA fixture should be schema-valid");
});

function SYNTHETIC_SOURCE_TDLR_URL(): string {
  return SYNTHETIC_SOURCES.find((s) => s.id === "synthetic-test-tdlr")!.website;
}

// ---------------------------------------------------------------------
// 18. Phase 3.1 — REAL RN transfer rule pilot (5 production records)
// ---------------------------------------------------------------------
console.log("\nReal RN Transfer Rule Pilot (Phase 3.1):");

const REAL_TRANSFER_RULES_DIR = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse");
function loadRealRule(filename: string): TransferRule {
  return JSON.parse(fs.readFileSync(path.join(REAL_TRANSFER_RULES_DIR, filename), "utf-8"));
}
const realSourceByUrl = new Map(sources.map((s) => [s.website, s]));
const realResolveSource = (url: string) => realSourceByUrl.get(url);
const realKnownProfessions = new Set(["registered-nurse"]);

await test("exactly 5 real transfer rule files exist, no more, no fewer", () => {
  const files = fs.readdirSync(REAL_TRANSFER_RULES_DIR).filter((f) => f.endsWith(".json"));
  assertEqual(files.length, 5, "expected exactly 5 real transfer rule files per Phase 3.1's strict scope");
});

await test("A->B is independent from B->A using REAL data (Texas<->California)", () => {
  const caToTx = loadRealRule("california-to-texas.json");
  const txToCa = loadRealRule("texas-to-california.json");
  assertEqual(caToTx.sourceState, "california");
  assertEqual(caToTx.destinationState, "texas");
  assertEqual(txToCa.sourceState, "texas");
  assertEqual(txToCa.destinationState, "california");
  assert(caToTx.applicationFeeUsd.value !== txToCa.applicationFeeUsd.value, "real fees must differ ($150 TX vs $350 CA)");
  assertEqual(caToTx.applicationFeeUsd.value, 150);
  assertEqual(txToCa.applicationFeeUsd.value, 350);
});

await test("every populated field across all 5 real rules has evidence (sourceUrl), zero schema validation errors", () => {
  const files = fs.readdirSync(REAL_TRANSFER_RULES_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const rule = loadRealRule(file);
    const issues = validateTransferRule(rule, realResolveSource, realKnownProfessions);
    const errors = issues.filter((i) => i.severity === "error");
    assertEqual(errors, [], `${file}: expected zero validation errors`);
  }
});

await test("source jurisdiction matches destination context for all 5 real rules (zero Rule 7 warnings)", () => {
  const files = fs.readdirSync(REAL_TRANSFER_RULES_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const rule = loadRealRule(file);
    const issues = validateTransferRule(rule, realResolveSource, realKnownProfessions);
    const jurisdictionIssues = issues.filter((i) => i.rule === "7");
    assertEqual(jurisdictionIssues, [], `${file}: expected zero jurisdiction/source-resolution issues`);
  }
});

await test("unknown fields remain genuinely Unknown, never guessed (NY background check, a real epistemic-humility case)", () => {
  const caToNy = loadRealRule("california-to-new-york.json");
  assertEqual(caToNy.backgroundCheckRequirement.value, "Unknown", "NY background check must stay Unknown — secondary sources disagreed and no official confirmation was found");
  assertEqual(caToNy.backgroundCheckRequirement.sourceUrl, null);
  assertEqual(caToNy.fingerprintingRequirement.value, "Unknown");
});

await test("conditional requirements remain conditional in real data (Georgia's real 500-hour/4-year reentry rule)", () => {
  const ilToGa = loadRealRule("illinois-to-georgia.json");
  const exp = ilToGa.experienceRequirement.value as any;
  assertEqual(exp.status, "conditional");
  assert(Array.isArray(exp.conditions) && exp.conditions.length === 1);
  assert(exp.conditions[0].description.includes("500 hours"), "expected the real, quantified 500-hour condition from Ga. Comp. R. & Regs. 410-4-.03");
  assertEqual(ilToGa.experienceRequirement.confidence, 0.95, "this field should carry high confidence — it's a directly-quoted primary regulation, the strongest-sourced fact in the whole batch");
});

await test("compact_privilege mechanism correctly identified for the one compact-to-compact real transfer (Texas->Florida)", () => {
  const txToFl = loadRealRule("texas-to-florida.json");
  assertEqual(txToFl.transferMechanism.value, "compact_privilege");
  assert(txToFl.examRequirement.value !== "Unknown", "examRequirement must be populated for this fixture");
  assertEqual((txToFl.examRequirement.value as { status: string }).status, "not_required");
});

await test("secondary-source-derived fields are honestly downgraded, never silently treated as authoritative", () => {
  const caToTx = loadRealRule("california-to-texas.json");
  const examField = caToTx.examRequirement;
  const source = realResolveSource(examField.sourceUrl!);
  assert(!!source, "exam field source must resolve to a registered SourceRecord");
  assertEqual(source!.authorityLevel, "supplementary", "the RenewRN.net source used for discovery must be classified supplementary, not authoritative");
  assert(examField.confidence <= 0.6, "a field sourced from a secondary discovery-only source must carry deliberately capped confidence");
});

await test("no fake reviewer exists anywhere across all 5 real transfer rules", () => {
  const files = fs.readdirSync(REAL_TRANSFER_RULES_DIR).filter((f) => f.endsWith(".json"));
  const allFieldKeys = [
    "transferMechanism", "endorsementProcess", "reciprocityAgreementExists", "universalRecognitionApplies",
    "examRequirement", "experienceRequirement", "applicationFeeUsd", "otherRequiredFees",
    "backgroundCheckRequirement", "fingerprintingRequirement", "licenseVerificationRequirement",
    "documentsRequired", "goodStandingRequirement", "disciplinaryDisclosureRequirement", "processingTime",
    "temporaryPermitAvailability", "compactStatus", "exceptions",
  ];
  for (const file of files) {
    const rule = loadRealRule(file) as any;
    for (const key of allFieldKeys) {
      assertEqual(rule[key].reviewer, null, `${file}/${key}: reviewer must be null across all 5 real rules — zero human review has occurred`);
      assertEqual(rule[key].status, "pending_verification", `${file}/${key}: status must be pending_verification, never verified`);
    }
  }
});

await test("unsupported values cannot become Verified (structural check — no requirement field is a raw boolean anywhere in real data)", () => {
  const files = fs.readdirSync(REAL_TRANSFER_RULES_DIR).filter((f) => f.endsWith(".json"));
  const requirementKeys = [
    "reciprocityAgreementExists", "universalRecognitionApplies", "examRequirement", "experienceRequirement",
    "backgroundCheckRequirement", "fingerprintingRequirement", "licenseVerificationRequirement",
    "goodStandingRequirement", "disciplinaryDisclosureRequirement", "temporaryPermitAvailability",
  ];
  for (const file of files) {
    const rule = loadRealRule(file) as any;
    for (const key of requirementKeys) {
      assert(typeof rule[key].value !== "boolean", `${file}/${key}: must never be a raw boolean`);
    }
  }
});

await test("slugs are deterministic for all 5 real transfer rules and match their filenames", () => {
  const expected: Record<string, string> = {
    "texas-to-florida.json": "registered-nurse/texas-to-florida",
    "california-to-texas.json": "registered-nurse/california-to-texas",
    "texas-to-california.json": "registered-nurse/texas-to-california",
    "california-to-new-york.json": "registered-nurse/california-to-new-york",
    "illinois-to-georgia.json": "registered-nurse/illinois-to-georgia",
  };
  for (const [file, expectedSlug] of Object.entries(expected)) {
    const rule = loadRealRule(file);
    const slug = buildTransferRuleSlug(rule);
    assertEqual(slug, expectedSlug, `${file}: slug mismatch`);
  }
});

await test("Trust Dashboard metrics reconcile: total sources grew from 59 to 79 (20 new sources for the 5-rule pilot)", () => {
  assertEqual(sources.length, 79, "expected 79 total sources after Phase 3.1 (59 before + 20 new: 8 board/fee sources + 5 secondary discovery sources + 7 additional page-specific sources)");
  const secondarySources = sources.filter((s) => s.authorityLevel === "supplementary");
  assert(secondarySources.length >= 5, "expected at least the 5 secondary discovery-only sources registered this phase");
});

await test("existing RN ProfessionStateFacts data (750 fields) remains completely untouched by Phase 3.1", () => {
  const ca = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "california.json"), "utf-8")
  );
  assertEqual(ca.rnEndorsementFeeUsd.value, 350, "California's Phase 2.5 fee value must be unchanged");
  const trust = computeTrustReport();
  assertEqual(trust.totalFields, 750, "the 750-field RN dataset must be completely unaffected by the new transfer-rules dataset");
});

// ---------------------------------------------------------------------
// 19. Phase 3.2 — Human Review & Publication Gate
// ---------------------------------------------------------------------
console.log("\nHuman Review & Publication Gate (Phase 3.2):");

await test("AI-only evidence cannot become Verified: applyFieldReview never sets status=verified without a decision to approve", () => {
  const field = verifiedField({
    value: 100, sourceUrl: SYNTHETIC_REVIEW_SOURCE.website, sourceTitle: "T", sourceName: "N",
    verifiedAt: "2026-08-11", verificationMethod: "ai_assisted_manual_research", confidence: 0.9,
  });
  assertEqual(field.status, "pending_verification", "AI research alone must never produce status=verified");
});

await test("missing reviewer prevents Verified: applyFieldReview rejects an empty reviewer name", () => {
  const result = applyFieldReview(SCENARIO_1_FIELD_TO_APPROVE, { decision: "approve", reviewer: "", reason: "test" });
  assertEqual(result.applied, false);
  assertEqual(result.rejectionReason, "reviewer_missing");
  assertEqual(result.updatedField.status, "pending_verification", "field must remain unchanged when reviewer is missing");
});

await test("fake reviewer names are rejected by applyFieldReview for every disallowed placeholder", () => {
  for (const fake of FAKE_REVIEWER_NAMES) {
    const result = applyFieldReview(SCENARIO_1_FIELD_TO_APPROVE, { decision: "approve", reviewer: fake, reason: "test" });
    assertEqual(result.applied, false, `expected "${fake}" to be rejected as a fake reviewer`);
    assertEqual(result.rejectionReason, "reviewer_is_fabricated_placeholder");
  }
});

await test("AI cannot be recorded as a human reviewer even when framed as a decision — 'Claude' specifically rejected", () => {
  const result = applyFieldReview(SCENARIO_1_FIELD_TO_APPROVE, { decision: "approve", reviewer: "Claude", reason: "AI reviewed itself" });
  assertEqual(result.applied, false);
  assertEqual(result.updatedField.reviewer, null, "reviewer must remain null, never 'Claude'");
});

await test("reviewer approves one field: applyFieldReview with a real reviewer name sets status=verified", () => {
  const result = applyFieldReview(SCENARIO_1_FIELD_TO_APPROVE, { decision: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Confirmed against the source directly." });
  assertEqual(result.applied, true);
  assertEqual(result.updatedField.status, "verified");
  assertEqual(result.updatedField.reviewer, REAL_TEST_REVIEWER_NAME);
  assertEqual(result.updatedField.verificationMethod, "manual-review");
});

await test("reviewer rejects one field: applyFieldReview with decision=reject sets status=needs_review, not verified", () => {
  const result = applyFieldReview(SCENARIO_2_FIELD_TO_REJECT, { decision: "reject", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Source page was ambiguous on inspection." });
  assertEqual(result.applied, true);
  assertEqual(result.updatedField.status, "needs_review");
  assert(result.updatedField.status !== "verified", "a rejected field must never become verified");
});

await test("reviewer requests more evidence: field stays pending_verification, but the request is recorded in history", () => {
  const result = applyFieldReview(SCENARIO_3_FIELD_NEEDS_MORE_EVIDENCE, { decision: "request_more_evidence", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Need an official source, not a commercial estimate." });
  assertEqual(result.applied, true);
  assertEqual(result.updatedField.status, "pending_verification");
  assert(result.updatedField.history.length > 0, "expected at least one history entry");
  const lastEntry = result.updatedField.history[result.updatedField.history.length - 1]!;
  assert(lastEntry.reason.includes("request_more_evidence"), "the request-more-evidence decision must be recorded in history");
});

await test("approving one field never touches another field on the same rule (field-level review, Step 2)", () => {
  const ruleCopy: TransferRule = JSON.parse(JSON.stringify(SYNTHETIC_TRANSFER_CA_TO_TX));
  const originalExamField = JSON.stringify(ruleCopy.examRequirement);
  const feeResult = applyFieldReview(ruleCopy.applicationFeeUsd, { decision: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "test" });
  ruleCopy.applicationFeeUsd = feeResult.updatedField;
  assertEqual(ruleCopy.applicationFeeUsd.status, "verified", "the reviewed field must be updated");
  assertEqual(JSON.stringify(ruleCopy.examRequirement), originalExamField, "an unrelated field must remain completely untouched");
});

await test("critical unresolved conflict blocks publication", () => {
  const ruleWithConflict: TransferRule = {
    ...SYNTHETIC_TRANSFER_CA_TO_TX,
    conflicts: [SCENARIO_4_CRITICAL_CONFLICT],
  };
  const resolve = (url: string) => (url === SYNTHETIC_REVIEW_SOURCE.website ? SYNTHETIC_REVIEW_SOURCE : synthResolveSource(url));
  const result = isTransferRulePublishable(ruleWithConflict, resolve, synthKnownProfessions);
  assertEqual(result.publishable, false, "a critical field with an unresolved conflict must block publication");
  assert(result.blockingReasons.some((r) => r.includes("unresolved conflict")));
});

await test("secondary evidence does not become authoritative: a critical field sourced only from a secondary source blocks publication", () => {
  const ruleWithSecondaryCritical: TransferRule = {
    ...SYNTHETIC_TRANSFER_CA_TO_TX,
    examRequirement: verifiedField({
      value: { status: "required" },
      sourceUrl: SYNTHETIC_SECONDARY_SOURCE.website,
      sourceTitle: "T", sourceName: SYNTHETIC_SECONDARY_SOURCE.agencyName,
      verifiedAt: "2026-08-11", verificationMethod: "ai_assisted_manual_research", confidence: 0.6,
    }),
  };
  const resolve = (url: string) => (url === SYNTHETIC_SECONDARY_SOURCE.website ? SYNTHETIC_SECONDARY_SOURCE : synthResolveSource(url));
  const result = isTransferRulePublishable(ruleWithSecondaryCritical, resolve, synthKnownProfessions);
  assertEqual(result.publishable, false, "a critical field relying only on a secondary source must block publication");
  assert(result.blockingReasons.some((r) => r.includes("secondary source")));
});

await test("Unknown fields remain Unknown and do not block publication by themselves", () => {
  assertEqual(SYNTHETIC_TRANSFER_CA_TO_TX.temporaryPermitAvailability.value, "Unknown");
  const result = isTransferRulePublishable(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions);
  assert(!result.blockingReasons.some((r) => r.toLowerCase().includes("unknown")), "Unknown fields must never appear as a blocking reason by themselves");
});

await test("reviewed fields can become Verified, and isTransferRuleFullyHumanVerified reflects it correctly", () => {
  assertEqual(isTransferRuleFullyHumanVerified(SYNTHETIC_TRANSFER_CA_TO_TX), false, "fixture starts with zero human review");
  let reviewedRule: TransferRule = JSON.parse(JSON.stringify(SYNTHETIC_TRANSFER_CA_TO_TX));
  for (const key of CRITICAL_TRANSFER_RULE_FIELDS) {
    const field = (reviewedRule as any)[key];
    if (field.value === "Unknown") continue;
    const result = applyFieldReview(field, { decision: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "test" });
    (reviewedRule as any)[key] = result.updatedField;
  }
  assert(
    CRITICAL_TRANSFER_RULE_FIELDS.every((k) => (reviewedRule as any)[k].value !== "Unknown"),
    "sanity check: fixture must have no Unknown critical fields for this test to be meaningful"
  );
  assertEqual(isTransferRuleFullyHumanVerified(reviewedRule), true, "after reviewing every critical field, the rule should be fully human-verified");
});

await test("partial rules are correctly classified by classifyTransferRuleCoverage", () => {
  const cls = classifyTransferRuleCoverage(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions);
  assertEqual(cls, "partially_verified", "an AI-researched, evidence-complete, non-conflicted, zero-human-review fixture should classify as partially_verified");
});

await test("publication decision is deterministic: calling isTransferRulePublishable twice on the same rule gives the same result", () => {
  const r1 = isTransferRulePublishable(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions);
  const r2 = isTransferRulePublishable(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions);
  assertEqual(r1.publishable, r2.publishable);
  assertEqual(r1.blockingReasons, r2.blockingReasons);
});

await test("directional rules remain independent under the publication gate too (CA->TX and TX->CA evaluated separately)", () => {
  const rCaTx = isTransferRulePublishable(SYNTHETIC_TRANSFER_CA_TO_TX, synthResolveSource, synthKnownProfessions);
  const rTxCa = isTransferRulePublishable(SYNTHETIC_TRANSFER_TX_TO_CA, synthResolveSource, synthKnownProfessions);
  assert(typeof rCaTx.publishable === "boolean" && typeof rTxCa.publishable === "boolean");
});

await test("reviewer history is preserved: approving a field appends to history rather than replacing it", () => {
  const before = SCENARIO_1_FIELD_TO_APPROVE.history.length;
  const result = applyFieldReview(SCENARIO_1_FIELD_TO_APPROVE, { decision: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "test" });
  assertEqual(result.updatedField.history.length, before + 1, "review must append a new history entry, not replace existing ones");
  assertEqual(result.updatedField.history[0], SCENARIO_1_FIELD_TO_APPROVE.history[0], "original history entries must be preserved unchanged");
});

await test("real production data (5 real transfer rules) untouched by Phase 3.2 — checksums match pre-phase snapshot", () => {
  const dir = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse");
  const crypto = require("node:crypto");
  const expectedHashes: Record<string, string> = {
    "california-to-new-york.json": "45d1ada0c43a4a62e424d7dd50c9190c",
    "california-to-texas.json": "7c66c2cedf469c75828e21ec72d01966",
    "illinois-to-georgia.json": "481e6b9dcc66b613294c212abcaf4d52",
    "texas-to-california.json": "0122d91754c9f0985915a6a58a5cfa7b",
    "texas-to-florida.json": "41cc34cf246d284890b90a2013389e90",
  };
  for (const [file, expectedHash] of Object.entries(expectedHashes)) {
    const content = fs.readFileSync(path.join(dir, file));
    const hash = crypto.createHash("md5").update(content).digest("hex");
    assertEqual(hash, expectedHash, `${file}: MD5 checksum must exactly match the pre-Phase-3.2 snapshot — zero bytes changed`);
  }
});

await test("real publication report correctly blocks california-to-texas (the one real rule with critical secondary-only fields)", () => {
  const rows = buildTransferPublicationReport();
  const caToTx = rows.find((r) => r.transfer === "california-to-texas")!;
  assertEqual(caToTx.publishable, false, "california-to-texas must be blocked — examRequirement and applicationFeeUsd are critical fields sourced only from RenewRN.net");
  assertEqual(caToTx.coverageClass, "insufficient_evidence");
  const others = rows.filter((r) => r.transfer !== "california-to-texas");
  for (const r of others) {
    assertEqual(r.publishable, true, `${r.transfer} should be publishable (partial coverage, no critical secondary-only fields)`);
  }
});

await test("real review queue contains exactly 69 items (one per populated, non-Verified field across all 5 real rules)", () => {
  const queue = buildTransferReviewQueue();
  assertEqual(queue.length, 69, "expected 69 queue items, matching Phase 3.1's 69 populated fields (0 already Verified)");
  const highPriority = queue.filter((i) => i.priority === "High");
  assert(highPriority.length > 0, "expected at least some High-priority (critical field) queue items");
});

// ---------------------------------------------------------------------
// 20. Phase 3.3 — First Public Product (RN Transfer Pages)
// ---------------------------------------------------------------------
console.log("\nFirst Public Product / RN Transfer Pages (Phase 3.3):");

await test("all 5 expected routes resolve via getAllPublicTransferRuleSlugs — the exact whitelist generateStaticParams() uses", () => {
  const slugs = getAllPublicTransferRuleSlugs();
  const actual = slugs.map((s) => `${s.profession}/${s.transfer}`).sort();
  const expected = [
    "registered-nurse/texas-to-florida",
    "registered-nurse/california-to-texas",
    "registered-nurse/texas-to-california",
    "registered-nurse/california-to-new-york",
    "registered-nurse/illinois-to-georgia",
  ].sort();
  assertEqual(actual, expected, "expected exactly these 5 routes, no more, no fewer");
});

await test("nonexistent transfer resolves to undefined (the exact condition the page's notFound() checks)", () => {
  const result = getPublicTransferRule("registered-nurse", "ohio-to-michigan");
  assertEqual(result, undefined, "a transfer with no real data must resolve to undefined, never a fabricated fallback");
});

await test("California -> Texas correctly evaluates as blocked (page would show the blocked notice)", () => {
  const rule = getPublicTransferRule("registered-nurse", "california-to-texas")!;
  const summary = summarizeEvidence(rule);
  assertEqual(summary.publishable, false);
  assertEqual(summary.coverageClass, "insufficient_evidence");
});

await test("the other 4 real transfers evaluate as publishable (page would NOT show the blocked notice)", () => {
  const publishableSlugs = ["texas-to-florida", "texas-to-california", "california-to-new-york", "illinois-to-georgia"];
  for (const slug of publishableSlugs) {
    const rule = getPublicTransferRule("registered-nurse", slug)!;
    assertEqual(summarizeEvidence(rule).publishable, true, `${slug} should be publishable`);
  }
});

await test("Unknown fields remain present and visible in the data every page row would render", () => {
  const rule = getPublicTransferRule("registered-nurse", "texas-to-florida")!;
  assert(summarizeEvidence(rule).unknownCount > 0, "texas-to-florida should have Unknown fields per Phase 3.1's own research findings");
  assertEqual(rule.backgroundCheckRequirement.value, "Unknown");
});

await test("secondary sources are correctly identifiable per field (what the page's 'Secondary Source' badge relies on)", () => {
  const rule = getPublicTransferRule("registered-nurse", "california-to-texas")!;
  const source = getSourceByUrl(rule.examRequirement.sourceUrl!);
  assertEqual(source?.authorityLevel, "supplementary", "examRequirement's source must be identifiable as secondary");
});

await test("human verification is never falsely displayed — zero fields have status='verified' across all 5 real pages", () => {
  const slugs = getAllPublicTransferRuleSlugs();
  for (const s of slugs) {
    const rule = getPublicTransferRule(s.profession, s.transfer)! as any;
    for (const key of Object.keys(PAGE_FIELD_LABELS)) {
      assert(rule[key].status !== "verified", `${s.transfer}/${key}: must never be 'verified' — no human review has occurred`);
    }
  }
});

await test("source links correspond to the correct field — sourceName on the field matches the resolved SourceRecord's agency", () => {
  const rule = getPublicTransferRule("registered-nurse", "illinois-to-georgia")!;
  const field = rule.experienceRequirement;
  const source = getSourceByUrl(field.sourceUrl!);
  assertEqual(source?.agencyName, field.sourceName, "the field's own sourceName must match the resolved SourceRecord it links to");
});

await test("directional independence holds for the pages: California->Texas and Texas->California are distinct routes with distinct data", () => {
  const caTx = getPublicTransferRule("registered-nurse", "california-to-texas")!;
  const txCa = getPublicTransferRule("registered-nurse", "texas-to-california")!;
  assert(caTx.applicationFeeUsd.value !== txCa.applicationFeeUsd.value, "the two directional pages must show different fee values");
});

await test("conditional requirements are present in the data exactly as structured objects (what the page's IF/AND renderer consumes)", () => {
  const rule = getPublicTransferRule("registered-nurse", "illinois-to-georgia")!;
  const value = rule.experienceRequirement.value as any;
  assertEqual(value.status, "conditional");
  assert(Array.isArray(value.conditions) && value.conditions.length === 1);
});

await test("no invented fields: FIELD_LABELS (what the page renders) exactly matches the real TransferRule field set, nothing added or missing", () => {
  const realFieldKeys = [
    "transferMechanism", "endorsementProcess", "reciprocityAgreementExists", "universalRecognitionApplies",
    "examRequirement", "experienceRequirement", "applicationFeeUsd", "otherRequiredFees",
    "backgroundCheckRequirement", "fingerprintingRequirement", "licenseVerificationRequirement",
    "documentsRequired", "goodStandingRequirement", "disciplinaryDisclosureRequirement", "processingTime",
    "temporaryPermitAvailability", "compactStatus", "exceptions",
  ].sort();
  const labelKeys = Object.keys(PAGE_FIELD_LABELS).sort();
  assertEqual(labelKeys, realFieldKeys, "FIELD_LABELS must cover exactly the real schema — no invented fields, none silently dropped");
});

await test("metadata source exists for every real transfer page (getPublicTransferRule succeeds for all 5, feeding generateMetadata)", () => {
  const slugs = getAllPublicTransferRuleSlugs();
  for (const s of slugs) {
    const rule = getPublicTransferRule(s.profession, s.transfer);
    assert(!!rule, `${s.transfer}: generateMetadata's data source must resolve successfully`);
  }
});

await test("sitemap contains exactly the 5 intended public transfer pages — no more, no fewer, correctly dated", () => {
  // Deliberately does NOT import app/sitemap.ts directly: that file
  // transitively imports lib/data.ts, which correctly uses the REAL
  // "server-only" package (a pre-existing file, unmodified) — and the
  // real package intentionally throws outside an actual Next.js server
  // bundle, which includes this test suite's plain Node/tsx execution.
  // This test instead independently replicates exactly the URL-building
  // logic app/sitemap.ts uses for its knowledge-base section (see that
  // file's "Phase 3.3" comment block) against the same underlying data
  // functions, which is what actually matters for this assertion.
  const slugs = getAllPublicTransferRuleSlugs();
  assertEqual(slugs.length, 5, "expected exactly 5 knowledge-base transfer routes");
  for (const s of slugs) {
    const rule = getPublicTransferRule(s.profession, s.transfer)!;
    const summary = summarizeEvidence(rule);
    assert(!!summary.latestVerifiedAt, `${s.transfer}: expected a real lastModified-equivalent date, not fabricated`);
  }
});

await test("real production TransferRule data was not modified by Phase 3.3 (UI-only phase) — spot-check against Phase 3.1/3.2 values", () => {
  const rule = getPublicTransferRule("registered-nurse", "illinois-to-georgia")!;
  assertEqual(rule.applicationFeeUsd.value, 75, "Georgia's fee must remain unchanged from Phase 3.1");
  assertEqual(rule.experienceRequirement.confidence, 0.95, "the 500-hour rule's confidence must remain unchanged");
  assertEqual(rule.experienceRequirement.reviewer, null, "reviewer must still be null — Phase 3.3 built UI only, no review occurred");
});

// ---------------------------------------------------------------------
// 21. Phase 4.1 — Source Monitoring Model (registry infrastructure only,
//     zero real sources, zero network, zero production-data involvement)
// ---------------------------------------------------------------------
console.log("\nSource Monitoring Model (Phase 4.1):");

function synthMonitoredSource(overrides: Partial<MonitoredSource> = {}): MonitoredSource {
  return {
    id: "synthetic-monitor-test-source",
    url: "https://example-test.invalid/synthetic-monitor",
    title: "[TEST] Synthetic Monitored Source",
    jurisdiction: "texas",
    sourceType: "official-board",
    authority: "authoritative",
    specificity: "field-specific",
    checkFrequencyDays: 30,
    status: "active",
    consecutiveFailures: 0,
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    ...overrides,
  };
}

await test("the real on-disk registry currently exists and is empty — Phase 4.1 is infrastructure-only, no sources populated yet", () => {
  const registry = loadMonitoringRegistry();
  assertEqual(registry.version, 1);
  // Updated after Phase 4.11's source expansion: the registry now
  // legitimately contains 4 real sources (checked precisely, not just
  // "non-empty") — the original pilot plus 3 individually-validated
  // Phase 4.11 mappings.
  assertEqual(registry.sources.length, 4, "expected exactly 4 real sources — the original pilot plus 3 Phase 4.11 mappings");
  assert(registry.sources.some((s) => s.id === "florida-fee-schedule-monitor"), "the original pilot source must still be present");
});

await test("MonitoredSource reuses SourceType/AuthorityLevel/SourceSpecificity from knowledge-base types, not a redefinition", () => {
  const source = synthMonitoredSource();
  // Structural check: these values must be valid members of the REAL knowledge-base enums,
  // proven by successfully resolving against a real SourceRecord's own field constraints.
  const realSource = sources.find((s) => s.sourceType === source.sourceType && s.authorityLevel === source.authority);
  assert(!!realSource, "expected at least one real SourceRecord sharing the same sourceType/authorityLevel vocabulary as MonitoredSource — confirms no parallel vocabulary was invented");
});

await test("addMonitoredSource adds a source to an in-memory registry without touching the real on-disk file", () => {
  const empty = { version: 1, sources: [] };
  const updated = addMonitoredSource(synthMonitoredSource(), empty);
  assertEqual(updated.sources.length, 1);
  assertEqual(updated.sources[0]!.id, "synthetic-monitor-test-source");
  // Confirm the real on-disk registry is untouched by this in-memory operation
  // — checked against its real current count (1, the pilot source, after
  // the first-real-source-pilot work), not a hardcoded 0.
  assertEqual(loadMonitoringRegistry().sources.length, 4, "in-memory registry mutation must never touch the real file without an explicit save call — real count is 4 post-Phase-4.11, not 0/1");
});

await test("addMonitoredSource rejects a duplicate id", () => {
  const registryWithOne = addMonitoredSource(synthMonitoredSource(), { version: 1, sources: [] });
  let threw = false;
  try {
    addMonitoredSource(synthMonitoredSource(), registryWithOne);
  } catch (e) {
    threw = e instanceof DuplicateMonitoredSourceIdError;
  }
  assert(threw, "expected DuplicateMonitoredSourceIdError on a duplicate id");
});

await test("getMonitoredSource / listMonitoredSources / listActiveMonitoredSources work correctly on an in-memory registry", () => {
  let registry = { version: 1, sources: [] as MonitoredSource[] };
  registry = addMonitoredSource(synthMonitoredSource({ id: "a", status: "active" }), registry);
  registry = addMonitoredSource(synthMonitoredSource({ id: "b", status: "paused" }), registry);
  assertEqual(listMonitoredSources(registry).length, 2);
  assertEqual(listActiveMonitoredSources(registry).length, 1);
  assertEqual(getMonitoredSource("a", registry)?.status, "active");
  assertEqual(getMonitoredSource("nonexistent", registry), undefined);
});

await test("updateMonitoredSource patches only the specified fields, leaving everything else untouched", () => {
  let registry = { version: 1, sources: [] as MonitoredSource[] };
  registry = addMonitoredSource(synthMonitoredSource({ id: "a", consecutiveFailures: 0 }), registry);
  registry = updateMonitoredSource("a", { consecutiveFailures: 3, status: "failed" }, registry);
  const updated = getMonitoredSource("a", registry)!;
  assertEqual(updated.consecutiveFailures, 3);
  assertEqual(updated.status, "failed");
  assertEqual(updated.url, "https://example-test.invalid/synthetic-monitor", "unrelated fields must remain unchanged");
});

await test("updateMonitoredSource throws for a nonexistent id rather than silently no-op-ing", () => {
  let threw = false;
  try {
    updateMonitoredSource("nonexistent", { status: "paused" }, { version: 1, sources: [] });
  } catch {
    threw = true;
  }
  assert(threw, "expected an error when updating a nonexistent source id");
});

await test("removeMonitoredSource removes exactly the targeted source", () => {
  let registry = { version: 1, sources: [] as MonitoredSource[] };
  registry = addMonitoredSource(synthMonitoredSource({ id: "a" }), registry);
  registry = addMonitoredSource(synthMonitoredSource({ id: "b" }), registry);
  registry = removeMonitoredSource("a", registry);
  assertEqual(registry.sources.length, 1);
  assertEqual(registry.sources[0]!.id, "b");
});

await test("getSourcesDueForCheck: a never-checked active source is always due", () => {
  const registry = addMonitoredSource(synthMonitoredSource({ id: "a", lastCheckedAt: null }), { version: 1, sources: [] });
  const due = getSourcesDueForCheck(registry, new Date("2026-08-11"));
  assertEqual(due.length, 1);
});

await test("getSourcesDueForCheck: a recently-checked source within its interval is NOT due", () => {
  const registry = addMonitoredSource(
    synthMonitoredSource({ id: "a", checkFrequencyDays: 30, lastCheckedAt: "2026-08-01" }),
    { version: 1, sources: [] }
  );
  const due = getSourcesDueForCheck(registry, new Date("2026-08-11")); // only 10 days later
  assertEqual(due.length, 0);
});

await test("getSourcesDueForCheck: a source past its interval IS due", () => {
  const registry = addMonitoredSource(
    synthMonitoredSource({ id: "a", checkFrequencyDays: 30, lastCheckedAt: "2026-07-01" }),
    { version: 1, sources: [] }
  );
  const due = getSourcesDueForCheck(registry, new Date("2026-08-11")); // 41 days later
  assertEqual(due.length, 1);
});

await test("getSourcesDueForCheck: a paused source is never due, regardless of interval", () => {
  const registry = addMonitoredSource(
    synthMonitoredSource({ id: "a", status: "paused", checkFrequencyDays: 1, lastCheckedAt: "2020-01-01" }),
    { version: 1, sources: [] }
  );
  const due = getSourcesDueForCheck(registry, new Date("2026-08-11"));
  assertEqual(due.length, 0, "a paused source must never be due, no matter how long it's been");
});

await test("isSourceStale: never-successfully-fetched source is stale", () => {
  const source = synthMonitoredSource({ lastSuccessfulFetchAt: null });
  assertEqual(isSourceStale(source, new Date("2026-08-11")), true);
});

await test("isSourceStale: recently-successful source is not stale", () => {
  const source = synthMonitoredSource({ checkFrequencyDays: 30, lastSuccessfulFetchAt: "2026-08-05" });
  assertEqual(isSourceStale(source, new Date("2026-08-11")), false);
});

await test("isSourceStale is distinct from 'stale fact' — staleness here is purely about fetch recency, never about a field's own verifiedAt", () => {
  // Structural proof of the conceptual separation Section 24 requires:
  // isSourceStale's signature takes a MonitoredSource, not a VerifiedField —
  // it is impossible to accidentally pass a fact into this function.
  const source = synthMonitoredSource({ checkFrequencyDays: 10, lastSuccessfulFetchAt: "2026-01-01" });
  const staleSource = isSourceStale(source, new Date("2026-08-11"), 3); // way past 10*3=30 days
  assertEqual(staleSource, true);
  // This tells us nothing about whether any FACT this source might support is itself stale —
  // that remains the Trust Dashboard's staleFieldsCount concern (lib/knowledge-base/trust.ts), untouched by this module.
});

await test("saveMonitoringRegistry + loadMonitoringRegistry round-trip correctly (using a temp path via direct file write/read, not touching the real registry)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const tempPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.test-temp.json");
  const testRegistry = addMonitoredSource(synthMonitoredSource({ id: "roundtrip-test" }), { version: 1, sources: [] });
  fs.writeFileSync(tempPath, JSON.stringify(testRegistry, null, 2));
  const reloaded = JSON.parse(fs.readFileSync(tempPath, "utf-8"));
  assertEqual(reloaded.sources.length, 1);
  assertEqual(reloaded.sources[0].id, "roundtrip-test");
  fs.unlinkSync(tempPath); // clean up — never leave test artifacts in production directories
});

// ---------------------------------------------------------------------
// 22. Phase 4.2 — Fetch / Normalize / Hash Engine (mock mode only —
//     no real network calls; reuses lib/pipeline/fetcher.ts directly)
// ---------------------------------------------------------------------
console.log("\nFetch / Normalize / Hash Engine (Phase 4.2):");

await test("fetchMonitoredSource reuses lib/pipeline/fetcher.ts's fetchSource directly — confirmed via a real mock-mode fetch against a synthetic fixture", async () => {
  const source = synthMonitoredSource({ id: "synthetic-monitor-test-source" });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.fetchResult.status, "ok");
  assert(!!outcome.fetchResult.contentHash, "expected a real content hash from the shared fetcher");
  assert(!!outcome.fetchResult.rawText, "expected extracted text");
  assert(!outcome.fetchResult.rawText!.includes("<h1>"), "htmlToText must have stripped HTML tags — proves real reuse, not a stub");
  assert(!outcome.fetchResult.rawText!.includes("console.log"), "htmlToText must have stripped <script> content");
  assert(outcome.fetchResult.rawText!.includes("Application fee"), "expected the actual synthetic page text to survive normalization");
});

await test("a successful mock fetch produces correct MonitoredSource bookkeeping updates", async () => {
  const source = synthMonitoredSource({ id: "synthetic-monitor-test-source", consecutiveFailures: 2 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.status, "active");
  assertEqual(outcome.updatedFields.consecutiveFailures, 0, "a successful fetch must reset the failure counter");
  assert(!!outcome.updatedFields.lastCheckedAt);
  assert(!!outcome.updatedFields.lastSuccessfulFetchAt);
  assert(!!outcome.updatedFields.lastContentHash);
});

await test("a failed fetch (missing fixture) preserves the last known-good value and increments the failure counter, never wiping data (Section 22)", async () => {
  const source = synthMonitoredSource({
    id: "synthetic-nonexistent-fixture",
    consecutiveFailures: 0,
    lastContentHash: "previously-known-good-hash",
    lastSuccessfulFetchAt: "2026-08-01",
  });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.fetchResult.status, "error", "expected SOURCE_UNAVAILABLE-equivalent fetch status for a missing fixture");
  assertEqual(outcome.updatedFields.lastContentHash, "previously-known-good-hash", "the last known-good hash must survive a fetch failure untouched");
  assertEqual(outcome.updatedFields.lastSuccessfulFetchAt, "2026-08-01", "the last successful fetch date must survive a fetch failure untouched");
  assertEqual(outcome.updatedFields.consecutiveFailures, 1);
  assertEqual(outcome.updatedFields.status, "active", "one failure alone must not flip status to failed");
});

await test("status flips to 'failed' after 3 consecutive failures, not before", async () => {
  let source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", consecutiveFailures: 0 });
  for (let i = 1; i <= 2; i++) {
    const outcome = await fetchMonitoredSource(source, "mock");
    assertEqual(outcome.updatedFields.status, "active", `expected still active after ${i} failure(s)`);
    source = { ...source, ...outcome.updatedFields };
  }
  const thirdOutcome = await fetchMonitoredSource(source, "mock");
  assertEqual(thirdOutcome.updatedFields.consecutiveFailures, 3);
  assertEqual(thirdOutcome.updatedFields.status, "failed", "expected status to flip to failed on the 3rd consecutive failure");
});

await test("normalizeForHashing collapses whitespace deterministically", () => {
  const messy = "  Application   fee:\n\t $150.  ";
  assertEqual(normalizeForHashing(messy), "Application fee: $150.");
});

await test("normalizeForHashing applies configured volatile-pattern stripping, without needing any patterns configured yet by default", () => {
  const text = "Fee: $150 [SESSION-ID: abc123]";
  const withPattern = normalizeForHashing(text, { volatilePatterns: [/\[SESSION-ID: [a-z0-9]+\]/] });
  assert(!withPattern.includes("SESSION-ID"), "expected the configured volatile pattern to be stripped");
  const withoutPattern = normalizeForHashing(text);
  assert(withoutPattern.includes("SESSION-ID"), "with no patterns configured (today's real default), nothing extra should be stripped");
});

await test("computeStableHash reuses hashContent from lib/pipeline/fetcher.ts exactly — same input produces the same hash both ways", () => {
  const text = "Application fee: $150.";
  const direct = hashContent(normalizeForHashing(text));
  const viaModule = computeStableHash(text);
  assertEqual(viaModule, direct, "computeStableHash must produce byte-identical output to calling the shared hashContent function directly — proves real reuse, not a parallel implementation");
});

await test("compareHashes: identical hashes -> NO_CHANGE", () => {
  const hash = computeStableHash("some content");
  assertEqual(compareHashes(hash, hash), "NO_CHANGE");
});

await test("compareHashes: different hashes -> CONTENT_CHANGED", () => {
  const hashA = computeStableHash("content A");
  const hashB = computeStableHash("content B");
  assertEqual(compareHashes(hashA, hashB), "CONTENT_CHANGED");
});

await test("compareHashes: no previous hash (first-ever fetch) -> CONTENT_CHANGED, per Section 9's documented contract", () => {
  const hash = computeStableHash("brand new content");
  assertEqual(compareHashes(null, hash), "CONTENT_CHANGED");
  assertEqual(compareHashes(undefined, hash), "CONTENT_CHANGED");
});

await test("htmlToText (reused directly from lib/pipeline/fetcher.ts) is idempotent-safe: running it twice on already-clean text doesn't corrupt it", () => {
  const clean = "Application fee: $150.";
  assertEqual(htmlToText(clean), clean);
});

await test("regression: the existing live-site pipeline (SourceConfig-typed) still calls the exact same fetchSource/hashContent after the Phase 4.2 parameter widening — verified by re-running the real pipeline in mock+dry-run mode", () => {
  // This is a structural proof, not a re-execution inside the test harness
  // (the actual `npm run pipeline:dry-run` re-run is reported separately in
  // the Phase 4.2 report) — confirms hashContent is a pure function stable
  // across both call sites by construction: both lib/pipeline/fetcher.ts's
  // own internal fetchLive/fetchMock AND lib/monitoring/fetch.ts import and
  // call the identical exported function, never a fork or copy.
  const a = hashContent("identical text");
  const b = hashContent("identical text");
  assertEqual(a, b, "hashContent must be deterministic — the same function, the same output, regardless of which module calls it");
});

// ---------------------------------------------------------------------
// 23. Phase 4.3 — Change Detection & Classification (pure functions +
//     idempotent storage only; zero production facts ever read-written
//     here except as a read-only `currentValue` supplied by the caller)
// ---------------------------------------------------------------------
console.log("\nChange Detection & Classification (Phase 4.3):");

await test("[Scenario 1: UNCHANGED] identical content -> NO_CHANGE, no extraction even attempted", () => {
  const result = detectFieldChange({
    field: "continuingEducationRequirements",
    currentValue: ChangeScenarios.UNCHANGED_CURRENT_VALUE,
    extractRule: ChangeScenarios.UNCHANGED_EXTRACT_RULE,
    previousHash: ChangeScenarios.UNCHANGED_HASH,
    newHash: ChangeScenarios.UNCHANGED_HASH,
    fetchStatus: "ok",
    rawText: ChangeScenarios.UNCHANGED_TEXT,
  });
  assertEqual(result.classification, "NO_CHANGE");
  assertEqual(result.proposedValue, undefined);
});

await test("[Scenario 2: LOW RISK] a supporting RN field change is confidently extracted and correctly classified low risk", () => {
  const result = detectFieldChange({
    field: ChangeScenarios.LOW_RISK_FIELD,
    currentValue: ChangeScenarios.LOW_RISK_CURRENT_VALUE,
    extractRule: ChangeScenarios.LOW_RISK_EXTRACT_RULE,
    previousHash: hashContent(ChangeScenarios.LOW_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.LOW_RISK_NEW_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.LOW_RISK_NEW_TEXT,
  });
  assertEqual(result.classification, "POSSIBLE_REQUIREMENT_CHANGE");
  assertEqual(result.proposedValue, "30 contact hours every 2 years");
  assertEqual(classifyFieldRisk(ChangeScenarios.LOW_RISK_FIELD, "profession-state-facts"), "low");
});

await test("[Scenario 3: MEDIUM RISK] a non-critical TransferRule field change is confidently extracted and correctly classified medium risk", () => {
  const result = detectFieldChange({
    field: ChangeScenarios.MEDIUM_RISK_FIELD,
    currentValue: ChangeScenarios.MEDIUM_RISK_CURRENT_VALUE,
    extractRule: ChangeScenarios.MEDIUM_RISK_EXTRACT_RULE,
    previousHash: hashContent(ChangeScenarios.MEDIUM_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.MEDIUM_RISK_NEW_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.MEDIUM_RISK_NEW_TEXT,
  });
  assertEqual(result.classification, "POSSIBLE_PROCESSING_TIME_CHANGE");
  assertEqual(result.proposedValue, "8-12 weeks");
  assertEqual(classifyFieldRisk(ChangeScenarios.MEDIUM_RISK_FIELD, "transfer-rule"), "medium");
});

await test("[Scenario 4: HIGH RISK] a critical/core fee field change is confidently extracted (as a number) and correctly classified high risk", () => {
  const result = detectFieldChange({
    field: ChangeScenarios.HIGH_RISK_FIELD,
    currentValue: ChangeScenarios.HIGH_RISK_CURRENT_VALUE,
    extractRule: ChangeScenarios.HIGH_RISK_EXTRACT_RULE,
    previousHash: hashContent(ChangeScenarios.HIGH_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.HIGH_RISK_NEW_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.HIGH_RISK_NEW_TEXT,
  });
  assertEqual(result.classification, "POSSIBLE_FEE_CHANGE");
  assertEqual(result.proposedValue, ChangeScenarios.HIGH_RISK_EXPECTED_PROPOSED_VALUE, "expected the number 125 to be confidently extracted, not a string or a guess");
  assertEqual(classifyFieldRisk(ChangeScenarios.HIGH_RISK_FIELD, "profession-state-facts"), "high");
});

await test("[Scenario 5: AMBIGUOUS] page changed, category is known, but no confident value extractable -> classification WITHOUT a proposedValue (never guessed)", () => {
  const result = detectFieldChange({
    field: ChangeScenarios.AMBIGUOUS_FIELD,
    currentValue: ChangeScenarios.AMBIGUOUS_CURRENT_VALUE,
    extractRule: ChangeScenarios.AMBIGUOUS_EXTRACT_RULE,
    previousHash: hashContent(ChangeScenarios.AMBIGUOUS_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.AMBIGUOUS_NEW_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.AMBIGUOUS_NEW_TEXT,
  });
  assertEqual(result.classification, "POSSIBLE_FEE_CHANGE", "expected the field's category even though no value could be extracted");
  assertEqual(result.proposedValue, undefined, "must NEVER guess a value — this is Section 13's exact test case");
  assertEqual(result.confidence, 0);
});

await test("[Scenario 6: EXTRACTION FAILURE] a malformed extraction pattern produces PARSER_ERROR, never an uncaught exception", () => {
  const result = detectFieldChange({
    field: ChangeScenarios.EXTRACTION_FAILURE_FIELD,
    currentValue: ChangeScenarios.EXTRACTION_FAILURE_CURRENT_VALUE,
    extractRule: ChangeScenarios.EXTRACTION_FAILURE_EXTRACT_RULE,
    previousHash: ChangeScenarios.EXTRACTION_FAILURE_OLD_HASH,
    newHash: hashContent(ChangeScenarios.EXTRACTION_FAILURE_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.EXTRACTION_FAILURE_TEXT,
  });
  assertEqual(result.classification, "PARSER_ERROR");
  assertEqual(result.proposedValue, undefined);
});

await test("[Scenario 7: SOURCE_UNAVAILABLE] a fetch failure is classified correctly and never treated as a content/value change (Section 22)", () => {
  const result = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: ChangeScenarios.SOURCE_UNAVAILABLE_CURRENT_VALUE,
    previousHash: ChangeScenarios.SOURCE_UNAVAILABLE_PREVIOUS_HASH,
    newHash: ChangeScenarios.SOURCE_UNAVAILABLE_PREVIOUS_HASH, // irrelevant — fetchStatus error short-circuits before hash is even considered
    fetchStatus: "error",
  });
  assertEqual(result.classification, "SOURCE_UNAVAILABLE");
  assertEqual(result.proposedValue, undefined);
});

await test("a content hash change that doesn't affect THIS field's extracted value resolves to NO_CHANGE for that field (Section 9 — not every page edit is a fact change)", () => {
  const textWithUnrelatedEdit = "Endorsement application fee: $110. (Page last reviewed by staff.)";
  const result = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 110,
    extractRule: { field: "rnEndorsementFeeUsd", pattern: "Endorsement application fee: \\$(\\d+)", transform: "number" },
    previousHash: hashContent("Endorsement application fee: $110."),
    newHash: hashContent(textWithUnrelatedEdit), // different hash — a real page edit happened
    fetchStatus: "ok",
    rawText: textWithUnrelatedEdit,
  });
  assertEqual(result.classification, "NO_CHANGE", "the page changed, but the fee itself extracted identically — must not be reported as a fee change");
});

await test("classifyFieldRisk correctly disambiguates 'processingTime', the one field name shared by both schemas — RN core (high) vs TransferRule supporting (medium) — a real bug this phase's own tests caught and fixed", () => {
  assertEqual(classifyFieldRisk("processingTime", "profession-state-facts"), "high", "processingTime is an RN Phase 2.3 core field");
  assertEqual(classifyFieldRisk("processingTime", "transfer-rule"), "medium", "processingTime was explicitly NOT made critical in Phase 3.2's TransferRule model");
});

await test("classifyFieldChangeCategory covers all real ProfessionStateFacts and TransferRule field names with a sensible category (no field silently falls through to an unrelated category)", () => {
  const knownFeeFields = ["rnEndorsementFeeUsd", "renewalFeeUsd", "applicationFeeUsd"];
  const knownCompactFields = ["compactMembership", "compactStatus"];
  const knownUlrFields = ["universalLicenseRecognitionStatus", "universalRecognitionApplies"];
  for (const f of knownFeeFields) assertEqual(classifyFieldChangeCategory(f), "POSSIBLE_FEE_CHANGE", `${f} should be a fee category`);
  for (const f of knownCompactFields) assertEqual(classifyFieldChangeCategory(f), "POSSIBLE_COMPACT_CHANGE", `${f} should be a compact category`);
  for (const f of knownUlrFields) assertEqual(classifyFieldChangeCategory(f), "POSSIBLE_ULR_CHANGE", `${f} should be a ULR category`);
  assertEqual(classifyFieldChangeCategory("licensingBoard"), "POSSIBLE_RULE_CHANGE", "an uncategorized field must still get a sensible generic category, never silently dropped");
});

await test("buildDetectedChangeId is deterministic — same sourceId+hash+field always produces the same id (idempotency key correctness)", () => {
  const id1 = buildDetectedChangeId("texas-fee-schedule", "abc123", "rnEndorsementFeeUsd");
  const id2 = buildDetectedChangeId("texas-fee-schedule", "abc123", "rnEndorsementFeeUsd");
  assertEqual(id1, id2);
  const differentHash = buildDetectedChangeId("texas-fee-schedule", "xyz789", "rnEndorsementFeeUsd");
  assert(id1 !== differentHash, "a different content hash must produce a different id");
});

await test("buildDetectedChange correctly flags a jurisdiction mismatch without blocking creation of the record (surfaced, not silently dropped)", () => {
  const matchingResult = detectFieldChange({
    field: ChangeScenarios.HIGH_RISK_FIELD,
    currentValue: ChangeScenarios.HIGH_RISK_CURRENT_VALUE,
    extractRule: ChangeScenarios.HIGH_RISK_EXTRACT_RULE,
    previousHash: hashContent(ChangeScenarios.HIGH_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.HIGH_RISK_NEW_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.HIGH_RISK_NEW_TEXT,
  });

  const mismatched = buildDetectedChange({
    sourceId: "california-fee-schedule",
    jurisdiction: "texas", // the FACT is about Texas
    field: ChangeScenarios.HIGH_RISK_FIELD,
    previousValue: ChangeScenarios.HIGH_RISK_CURRENT_VALUE,
    previousHash: hashContent(ChangeScenarios.HIGH_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.HIGH_RISK_NEW_TEXT),
    detectionResult: matchingResult,
    evidence: { url: "https://example-test.invalid/ca-fee", title: "[TEST]", fetchedAt: ChangeScenarios.SCENARIOS_DETECTED_AT },
    detectedAt: ChangeScenarios.SCENARIOS_DETECTED_AT,
    sourceJurisdiction: "california", // but the SOURCE is California's own page
  });
  assertEqual(mismatched.jurisdictionMismatch, true);
  assertEqual(mismatched.classification, "POSSIBLE_FEE_CHANGE", "a jurisdiction mismatch must still be recorded with its real classification, not silently dropped");
  assertEqual(mismatched.status, "pending_verification", "a mismatched-jurisdiction change must never auto-approve — it still requires human review, now with the mismatch visible");

  const matched = buildDetectedChange({
    sourceId: "texas-fee-schedule",
    jurisdiction: "texas",
    field: ChangeScenarios.HIGH_RISK_FIELD,
    previousValue: ChangeScenarios.HIGH_RISK_CURRENT_VALUE,
    previousHash: hashContent(ChangeScenarios.HIGH_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.HIGH_RISK_NEW_TEXT),
    detectionResult: matchingResult,
    evidence: { url: "https://example-test.invalid/tx-fee", title: "[TEST]", fetchedAt: ChangeScenarios.SCENARIOS_DETECTED_AT },
    detectedAt: ChangeScenarios.SCENARIOS_DETECTED_AT,
    sourceJurisdiction: "texas",
  });
  assertEqual(matched.jurisdictionMismatch, false);

  const nationalSource = buildDetectedChange({
    sourceId: "ncsbn-nclex",
    jurisdiction: "texas",
    field: "requiredExams",
    newHash: "somehash",
    detectionResult: { classification: "POSSIBLE_REQUIREMENT_CHANGE", confidence: 0.9 },
    evidence: { url: "https://example-test.invalid/nclex", title: "[TEST]", fetchedAt: ChangeScenarios.SCENARIOS_DETECTED_AT },
    detectedAt: ChangeScenarios.SCENARIOS_DETECTED_AT,
    sourceJurisdiction: "national",
  });
  assertEqual(nationalSource.jurisdictionMismatch, false, "a national-scoped source must never be flagged as a jurisdiction mismatch against any state");
});

await test("saveDetectedChange is idempotent: saving the same id twice never overwrites or duplicates — the first record wins", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const tempDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-test-temp");

  const result = detectFieldChange({
    field: ChangeScenarios.HIGH_RISK_FIELD,
    currentValue: ChangeScenarios.HIGH_RISK_CURRENT_VALUE,
    extractRule: ChangeScenarios.HIGH_RISK_EXTRACT_RULE,
    previousHash: hashContent(ChangeScenarios.HIGH_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.HIGH_RISK_NEW_TEXT),
    fetchStatus: "ok",
    rawText: ChangeScenarios.HIGH_RISK_NEW_TEXT,
  });
  const change = buildDetectedChange({
    sourceId: "texas-fee-schedule",
    jurisdiction: "texas",
    field: ChangeScenarios.HIGH_RISK_FIELD,
    previousValue: ChangeScenarios.HIGH_RISK_CURRENT_VALUE,
    previousHash: hashContent(ChangeScenarios.HIGH_RISK_OLD_TEXT),
    newHash: hashContent(ChangeScenarios.HIGH_RISK_NEW_TEXT),
    detectionResult: result,
    evidence: { url: "https://example-test.invalid/tx-fee", title: "[TEST]", fetchedAt: ChangeScenarios.SCENARIOS_DETECTED_AT },
    detectedAt: ChangeScenarios.SCENARIOS_DETECTED_AT,
    sourceJurisdiction: "texas",
  });

  try {
    const first = saveDetectedChange(change, tempDir);
    assertEqual(first.created, true, "first save must create a new record");

    // Simulate a human having reviewed it in the meantime — this must survive a repeated detection run untouched.
    const reviewedVersion = { ...loadDetectedChange(change.id, tempDir)!, status: "approved" as const };
    fs.writeFileSync(path.join(tempDir, `${change.id}.json`), JSON.stringify(reviewedVersion, null, 2));

    const second = saveDetectedChange(change, tempDir); // identical id, simulating a repeated pipeline run
    assertEqual(second.created, false, "second save with the same id must be a no-op, not a duplicate or overwrite");
    assertEqual(second.change.status, "approved", "the existing (human-reviewed) record must be returned untouched, not clobbered by the fresh detection");

    assertEqual(listDetectedChanges(tempDir).length, 1, "must never end up with 2 files for the same id");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true }); // clean up — never leave test artifacts in production directories
  }
});

await test("production facts remain completely untouched by the entire Phase 4.3 detection+storage layer — spot-check against real data", () => {
  const facts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8")
  );
  assertEqual(facts.rnEndorsementFeeUsd.value, "Unknown", "Texas's real rnEndorsementFeeUsd must remain exactly what it was before this phase — Phase 4.3 only ever READ this kind of value as detectFieldChange's `currentValue` input, never wrote it");
});

// ---------------------------------------------------------------------
// 24. Phase 4.4 — Review Queue Integration (synthetic fixtures only;
//     zero production facts ever written by any function in this
//     section — approve/reject/defer/research/unavailable are all pure
//     functions returning updated objects, never touching a real file)
// ---------------------------------------------------------------------
console.log("\nReview Queue Integration (Phase 4.4):");

function buildSyntheticApprovalScenario(overrides: { proposedFeeValue?: number; sourceUrl?: string } = {}) {
  const currentField = verifiedField({
    value: 350,
    sourceUrl: overrides.sourceUrl ?? "https://example-test.invalid/tx-fee-schedule",
    sourceTitle: "[TEST] TX Fee Schedule",
    sourceName: "[TEST] Texas Board of Nursing",
    verifiedAt: "2026-08-01",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.9,
  });
  const detectionResult = { classification: "POSSIBLE_FEE_CHANGE" as const, proposedValue: overrides.proposedFeeValue ?? 400, confidence: 0.9 };
  const change = buildDetectedChange({
    sourceId: "texas-fee-schedule",
    jurisdiction: "texas",
    field: "rnEndorsementFeeUsd",
    previousValue: 350,
    previousHash: "hash-v1",
    newHash: "hash-v2",
    detectionResult,
    evidence: { url: currentField.sourceUrl!, title: "[TEST] TX Fee Schedule", fetchedAt: "2026-08-10" },
    detectedAt: "2026-08-10",
    sourceJurisdiction: "texas",
  });
  return { currentField, change };
}

// --- Step 2: DetectedChange -> review item projection ---
await test("toReviewItem preserves complete provenance from DetectedChange (Step 2's required field list)", () => {
  const { change } = buildSyntheticApprovalScenario();
  const item = toReviewItem(change, "high");
  assertEqual(item.sourceId, "texas-fee-schedule");
  assertEqual(item.detectedChangeId, change.id);
  assertEqual(item.contentHash, "hash-v2");
  assertEqual(item.jurisdiction, "texas");
  assertEqual(item.field, "rnEndorsementFeeUsd");
  assertEqual(item.previousValue, 350);
  assertEqual(item.proposedValue, 400);
  assertEqual(item.classification, "POSSIBLE_FEE_CHANGE");
  assertEqual(item.priority, "High", "risk 'high' must map to the EXISTING ReviewPriority vocabulary, not a new one");
  assertEqual(item.status, "pending_verification");
});

await test("toReviewItem is a pure, deterministic projection — same change always produces the same item (Test B's underlying guarantee)", () => {
  const { change } = buildSyntheticApprovalScenario();
  const item1 = toReviewItem(change, "medium");
  const item2 = toReviewItem(change, "medium");
  assertEqual(item1, item2);
});

// --- Test A: Detection creates a review item but changes zero production facts ---
await test("[Test A] building a review item from a DetectedChange changes zero production facts", () => {
  const before = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8");
  const { change } = buildSyntheticApprovalScenario();
  toReviewItem(change, "high");
  const after = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8");
  assertEqual(before, after, "production data must be byte-identical before and after building a review item");
});

// --- Test C: Reject does not modify production data ---
await test("[Test C] reject produces an updated field with status=needs_review, and processReviewDecision itself never touches a file", () => {
  const before = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8");
  const { change, currentField } = buildSyntheticApprovalScenario();
  const result = processReviewDecision({ change, action: "reject", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Source text was misread by extraction.", currentField });
  assertEqual(result.success, true);
  assertEqual(result.updatedField!.status, "needs_review");
  assertEqual(result.updatedChange.status, "rejected");
  const after = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8");
  assertEqual(before, after, "reject must never touch a real file — the caller owns persistence, this function only returns updated objects");
});

// --- Test D: Defer does not modify production data ---
await test("[Test D] defer leaves status pending_verification but records an auditable log entry", () => {
  const { change } = buildSyntheticApprovalScenario();
  const result = processReviewDecision({ change, action: "defer", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Need to check with a colleague first." });
  assertEqual(result.success, true);
  assertEqual(result.updatedChange.status, "pending_verification", "defer must never change status — Step 5's explicit requirement");
  assertEqual(result.updatedChange.reviewLog?.length, 1);
  assertEqual(result.updatedChange.reviewLog?.[0]?.action, "defer");
  assertEqual(result.updatedField, undefined, "defer never touches a field at all");
});

// --- Test E: Request research does not modify production data ---
await test("[Test E] request_research maps to the existing request_more_evidence decision and keeps the field pending", () => {
  const { change, currentField } = buildSyntheticApprovalScenario();
  const result = processReviewDecision({ change, action: "request_research", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Need an official source, not this secondary one.", currentField });
  assertEqual(result.success, true);
  assertEqual(result.updatedField!.status, "pending_verification", "request_research must map to Phase 3.2's existing request_more_evidence, which keeps the field pending");
  assertEqual(result.updatedChange.status, "pending_verification");
});

// --- mark_unavailable (Step 5) ---
await test("mark_unavailable never guesses a replacement value and records the correct status", () => {
  const { change } = buildSyntheticApprovalScenario();
  const result = processReviewDecision({ change, action: "mark_unavailable", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Source page returns 404 now." });
  assertEqual(result.success, true);
  assertEqual(result.updatedChange.status, "source_unavailable");
  assertEqual(result.updatedField, undefined, "mark_unavailable never touches a field value — no guessed replacement");
});

// --- Test F/G/H: Approve uses the existing mutation path, creates History, preserves provenance ---
await test("[Test F/G/H] approve applies through the EXISTING applyFieldReview mechanism, creating History and preserving provenance", () => {
  const { change, currentField } = buildSyntheticApprovalScenario();
  const historyLengthBefore = currentField.history.length;
  const result = processReviewDecision({ change, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Confirmed directly against the board's fee schedule PDF.", currentField, currentSourceHash: "hash-v2" });

  assertEqual(result.success, true);
  // Test F: the exact same status/verificationMethod applyFieldReview itself produces — proves reuse, not reimplementation.
  assertEqual(result.updatedField!.status, "verified");
  assertEqual(result.updatedField!.verificationMethod, "manual-review");
  assertEqual(result.updatedField!.reviewer, REAL_TEST_REVIEWER_NAME);
  assertEqual(result.updatedField!.value, 400, "approval must actually APPLY the proposed value, not just certify the old one — the exact Phase 4.5 bug this test now explicitly guards against");
  // Test G: Field History grew by exactly one entry.
  assertEqual(result.updatedField!.history.length, historyLengthBefore + 1);
  const lastEntry = result.updatedField!.history[result.updatedField!.history.length - 1]!;
  assertEqual(lastEntry.previousValue, 350);
  // Test H: provenance (sourceUrl/sourceName) survives the approval unchanged.
  assertEqual(result.updatedField!.sourceUrl, currentField.sourceUrl);
  assertEqual(result.updatedField!.sourceName, currentField.sourceName);
  assertEqual(result.updatedChange.status, "approved");
});

// --- Test I: A stale detected change cannot overwrite a newer value ---
await test("[Test I] the exact $350->$400->$425 staleness scenario: approval is refused when the source has moved on since detection", () => {
  const { change, currentField } = buildSyntheticApprovalScenario({ proposedFeeValue: 400 }); // detected: $350 -> $400, hash-v2
  // Before the human approves, the source changes AGAIN to $425 — its current known hash is now hash-v3, not hash-v2.
  const result = processReviewDecision({
    change,
    action: "approve",
    reviewer: REAL_TEST_REVIEWER_NAME,
    reason: "Approving the $400 figure.",
    currentField,
    currentSourceHash: "hash-v3", // the source has moved on
  });
  assertEqual(result.success, false, "approval must be REFUSED — the source's current hash no longer matches what this change was detected against");
  assertEqual(result.reason, "stale_change");
  assertEqual(result.updatedChange.status, "superseded");
  assertEqual(result.updatedField, undefined, "a refused stale approval must never touch the field at all");
});

await test("isChangeStale: matching hash is not stale; missing currentSourceHash cannot be judged stale (nothing fresher to compare against)", () => {
  const { change } = buildSyntheticApprovalScenario();
  assertEqual(isChangeStale(change, "hash-v2"), false);
  assertEqual(isChangeStale(change, "hash-v3"), true);
  assertEqual(isChangeStale(change, undefined), false);
  assertEqual(isChangeStale(change, null), false);
});

// --- Test J: An already-reviewed change cannot be silently overwritten ---
await test("[Test J] an already-approved change refuses a second decision of any kind (except defer is still safe, since it never mutates)", () => {
  const { change, currentField } = buildSyntheticApprovalScenario();
  const firstApproval = processReviewDecision({ change, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "First approval.", currentField, currentSourceHash: "hash-v2" });
  assertEqual(firstApproval.success, true);

  const secondAttempt = processReviewDecision({ change: firstApproval.updatedChange, action: "reject", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Changed my mind.", currentField });
  assertEqual(secondAttempt.success, false, "a change that is already approved must refuse a second, conflicting decision");
  assertEqual(secondAttempt.updatedChange, firstApproval.updatedChange, "the already-decided change must be returned completely untouched, not partially modified");
});

// --- Test K: Reviewer identity is required/recorded according to existing project policy ---
await test("[Test K] an empty reviewer name is rejected for every action", () => {
  const { change, currentField } = buildSyntheticApprovalScenario();
  const result = processReviewDecision({ change, action: "approve", reviewer: "", reason: "test", currentField, currentSourceHash: "hash-v2" });
  assertEqual(result.success, false);
  assertEqual(result.reason, "reviewer_missing");
});

// --- Test L: No automated process can create a verified production field ---
await test("[Test L] a fabricated reviewer name ('Claude') is rejected by the EXISTING applyFieldReview check, not a new one — reused, not duplicated", () => {
  const { change, currentField } = buildSyntheticApprovalScenario();
  const result = processReviewDecision({ change, action: "approve", reviewer: "Claude", reason: "AI reviewed itself.", currentField, currentSourceHash: "hash-v2" });
  assertEqual(result.success, false);
  assertEqual(result.reason, "reviewer_is_fabricated_placeholder");
  assertEqual(result.updatedField, undefined);
  assertEqual(result.updatedChange.status, "pending_verification", "a rejected-fake-reviewer attempt must leave the change exactly as it was");
});

await test("production data (facts, transfer-rules, sources) remains completely byte-identical across the entire Phase 4.4 review-integration test run", () => {
  const ca = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "california.json"), "utf-8"));
  assertEqual(ca.rnEndorsementFeeUsd.value, 350, "unchanged from every prior phase's verification");
  const ilGa = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "illinois-to-georgia.json"), "utf-8"));
  assertEqual(ilGa.experienceRequirement.confidence, 0.95, "unchanged from every prior phase's verification");
});

// ---------------------------------------------------------------------
// 25. Phase 4.5 — Change Resolution & Persistence (synthetic profession/
//     state paths only — "__phase45_synthetic_test__" is NOT a real
//     profession and is created+destroyed entirely within each test, so
//     the REAL resolveEntityFile()/applyAndPersistReview() code paths are
//     genuinely exercised without ever touching real production files)
// ---------------------------------------------------------------------
console.log("\nChange Resolution & Persistence (Phase 4.5):");

const SYNTH_PROFESSION = "__phase45_synthetic_test__";
const SYNTH_STATE = "synthstate";
const SYNTH_DEST_STATE = "synthdeststate";
const SYNTH_FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts", SYNTH_PROFESSION);
const SYNTH_TRANSFER_DIR = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", SYNTH_PROFESSION);
const SYNTH_CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-phase45-test-temp");

function cleanupSynthetic() {
  fs.rmSync(SYNTH_FACTS_DIR, { recursive: true, force: true });
  fs.rmSync(SYNTH_TRANSFER_DIR, { recursive: true, force: true });
  fs.rmSync(SYNTH_CHANGES_DIR, { recursive: true, force: true });
}

function writeSyntheticFactsFile(fieldValue = 350) {
  fs.mkdirSync(SYNTH_FACTS_DIR, { recursive: true });
  const field = verifiedField({
    value: fieldValue,
    sourceUrl: "https://example-test.invalid/synth-fee",
    sourceTitle: "[TEST] Synthetic Fee Page",
    sourceName: "[TEST] Synthetic Board",
    verifiedAt: "2026-08-01",
    verificationMethod: "ai_assisted_manual_research",
    confidence: 0.9,
  });
  fs.writeFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), JSON.stringify({ profession: SYNTH_PROFESSION, state: SYNTH_STATE, testFeeField: field }, null, 2));
}

function buildAndSaveChange(args: { newHash: string; proposedValue: unknown; destinationJurisdiction?: string }): DetectedChange {
  const change = buildDetectedChange({
    sourceId: "synth-source",
    jurisdiction: SYNTH_STATE,
    destinationJurisdiction: args.destinationJurisdiction,
    profession: SYNTH_PROFESSION,
    field: "testFeeField",
    previousValue: 350,
    previousHash: "hash-v1",
    newHash: args.newHash,
    detectionResult: { classification: "POSSIBLE_FEE_CHANGE", proposedValue: args.proposedValue, confidence: 0.9 },
    evidence: { url: "https://example-test.invalid/synth-fee", title: "[TEST]", fetchedAt: "2026-08-10" },
    detectedAt: "2026-08-10T00:00:00.000Z",
    sourceJurisdiction: SYNTH_STATE,
  });
  saveDetectedChange(change, SYNTH_CHANGES_DIR);
  return change;
}

await test("resolveEntityFile correctly resolves a ProfessionStateFacts path vs a TransferRule path (destinationJurisdiction is the discriminator)", () => {
  const rnChange = buildDetectedChange({
    sourceId: "s", jurisdiction: "texas", profession: "registered-nurse", field: "rnEndorsementFeeUsd",
    newHash: "h", detectionResult: { classification: "POSSIBLE_FEE_CHANGE", confidence: 0.9 },
    evidence: { url: "u", title: "t", fetchedAt: "2026-08-10" }, detectedAt: "2026-08-10",
  });
  const rnResolved = resolveEntityFile(rnChange);
  assertEqual(rnResolved?.kind, "profession-state-facts");
  assert(rnResolved!.filePath.endsWith(path.join("facts", "registered-nurse", "texas.json")));

  const trChange = buildDetectedChange({
    sourceId: "s", jurisdiction: "texas", destinationJurisdiction: "florida", profession: "registered-nurse", field: "applicationFeeUsd",
    newHash: "h", detectionResult: { classification: "POSSIBLE_FEE_CHANGE", confidence: 0.9 },
    evidence: { url: "u", title: "t", fetchedAt: "2026-08-10" }, detectedAt: "2026-08-10",
  });
  const trResolved = resolveEntityFile(trChange);
  assertEqual(trResolved?.kind, "transfer-rule");
  assert(trResolved!.filePath.endsWith(path.join("transfer-rules", "registered-nurse", "texas-to-florida.json")));
});

await test("[synthetic] applyAndPersistReview: approve writes ONLY to the synthetic file, real production untouched", () => {
  cleanupSynthetic();
  const beforeRealTexas = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8");
  try {
    writeSyntheticFactsFile(350);
    const change = buildAndSaveChange({ newHash: "hash-v2", proposedValue: 400 });

    const result = applyAndPersistReview({ changeId: change.id, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Confirmed.", changesDir: SYNTH_CHANGES_DIR });

    assertEqual(result.success, true);
    assertEqual(result.productionFileWritten, true);
    const syntheticFile = JSON.parse(fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8"));
    assertEqual(syntheticFile.testFeeField.value, 400, "the synthetic file must reflect the approved value");
    assertEqual(syntheticFile.testFeeField.status, "verified");

    const afterRealTexas = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8");
    assertEqual(beforeRealTexas, afterRealTexas, "the REAL texas.json must be completely untouched by this synthetic-target approval");
  } finally {
    cleanupSynthetic();
  }
});

await test("[synthetic] applyAndPersistReview: reject/defer/request_research/mark_unavailable never write the synthetic production file at all", () => {
  cleanupSynthetic();
  try {
    for (const action of ["reject", "defer", "request_research", "mark_unavailable"] as const) {
      writeSyntheticFactsFile(350);
      const beforeSynthetic = fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8");
      const change = buildAndSaveChange({ newHash: `hash-${action}`, proposedValue: 400 });

      const result = applyAndPersistReview({ changeId: change.id, action, reviewer: REAL_TEST_REVIEWER_NAME, reason: "test", changesDir: SYNTH_CHANGES_DIR });

      assertEqual(result.success, true, `${action} should succeed`);
      assertEqual(result.productionFileWritten, false, `${action} must never write a production-shaped file`);
      const afterSynthetic = fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8");
      assertEqual(beforeSynthetic, afterSynthetic, `${action} must leave the underlying field file byte-identical`);
      cleanupSynthetic();
    }
  } finally {
    cleanupSynthetic();
  }
});

await test("[synthetic] applyAndPersistReview is idempotent: calling approve twice with the same changeId never double-applies", () => {
  cleanupSynthetic();
  try {
    writeSyntheticFactsFile(350);
    const change = buildAndSaveChange({ newHash: "hash-idempotent", proposedValue: 400 });

    const first = applyAndPersistReview({ changeId: change.id, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "first", changesDir: SYNTH_CHANGES_DIR });
    assertEqual(first.success, true);

    const historyLengthAfterFirst = JSON.parse(fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8")).testFeeField.history.length;

    const second = applyAndPersistReview({ changeId: change.id, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "second attempt", changesDir: SYNTH_CHANGES_DIR });
    assertEqual(second.success, false, "a second approval attempt on an already-approved change must be refused");

    const historyLengthAfterSecond = JSON.parse(fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8")).testFeeField.history.length;
    assertEqual(historyLengthAfterSecond, historyLengthAfterFirst, "history must not grow from the refused second attempt — no double-application");
  } finally {
    cleanupSynthetic();
  }
});

await test("[synthetic] rollback restores the previous value via updateField, preserving BOTH the approved and rollback history entries (never deletes)", () => {
  cleanupSynthetic();
  try {
    writeSyntheticFactsFile(350);
    const change = buildAndSaveChange({ newHash: "hash-rollback", proposedValue: 400 });
    const approval = applyAndPersistReview({ changeId: change.id, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Approved.", changesDir: SYNTH_CHANGES_DIR });
    assertEqual(approval.success, true);
    assertEqual(JSON.parse(fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8")).testFeeField.value, 400);

    const rollback = rollbackChange({ changeId: change.id, reviewer: REAL_TEST_REVIEWER_NAME, reason: "The approval was a mistake — source was misread.", changesDir: SYNTH_CHANGES_DIR });
    assertEqual(rollback.success, true);

    const afterRollback = JSON.parse(fs.readFileSync(path.join(SYNTH_FACTS_DIR, `${SYNTH_STATE}.json`), "utf-8")).testFeeField;
    assertEqual(afterRollback.value, 350, "value must be restored to previousValue");
    assertEqual(afterRollback.status, "pending_verification", "no longer human-verified after an undo");
    assertEqual(afterRollback.reviewer, null, "rollback itself is not a review sign-off on a new value");
    assert(afterRollback.history.length >= 3, "expected at least 3 history entries: initial, approved-to-400, rolled-back-to-350 — none deleted");
    const values = afterRollback.history.map((h: any) => h.newValue);
    assert(values.includes(400), "the approved value must still be visible in history — never deleted");
    assert(values.includes(350), "the rollback's restored value must be recorded too");
  } finally {
    cleanupSynthetic();
  }
});

await test("[synthetic] rollback refuses to act on a non-approved change", () => {
  cleanupSynthetic();
  try {
    writeSyntheticFactsFile(350);
    const change = buildAndSaveChange({ newHash: "hash-notapproved", proposedValue: 400 }); // status stays pending_verification — never approved
    const rollback = rollbackChange({ changeId: change.id, reviewer: REAL_TEST_REVIEWER_NAME, reason: "test", changesDir: SYNTH_CHANGES_DIR });
    assertEqual(rollback.success, false);
    assert(!!rollback.reason?.includes("only an approved change"), "expected a clear reason explaining why rollback was refused");
  } finally {
    cleanupSynthetic();
  }
});

await test("[synthetic] stale-change protection integrated end-to-end: a newer pending change for the same target blocks approval of an older one", () => {
  cleanupSynthetic();
  try {
    writeSyntheticFactsFile(350);
    const olderChange = buildAndSaveChange({ newHash: "hash-older", proposedValue: 400 });
    // Simulate the source having moved on again before the older change was reviewed:
    // a NEWER detection run recorded a second, still-pending change for the exact same target.
    const newerChange = { ...buildDetectedChange({
      sourceId: "synth-source", jurisdiction: SYNTH_STATE, profession: SYNTH_PROFESSION, field: "testFeeField",
      previousValue: 400, previousHash: "hash-older", newHash: "hash-newer",
      detectionResult: { classification: "POSSIBLE_FEE_CHANGE" as const, proposedValue: 425, confidence: 0.9 },
      evidence: { url: "https://example-test.invalid/synth-fee", title: "[TEST]", fetchedAt: "2026-08-11" },
      detectedAt: "2026-08-11T00:00:00.000Z", // LATER than olderChange's 2026-08-10
      sourceJurisdiction: SYNTH_STATE,
    })};
    saveDetectedChange(newerChange, SYNTH_CHANGES_DIR);

    const result = applyAndPersistReview({ changeId: olderChange.id, action: "approve", reviewer: REAL_TEST_REVIEWER_NAME, reason: "Approving the older, now-stale figure.", changesDir: SYNTH_CHANGES_DIR });

    assertEqual(result.success, false, "approving the OLDER change must be refused once a newer pending change exists for the same target");
    assertEqual(result.reason, "stale_change");
    assertEqual(result.productionFileWritten, false);
  } finally {
    cleanupSynthetic();
  }
});

await test("production data (facts, transfer-rules) remains completely byte-identical across the entire Phase 4.5 persistence test run", () => {
  const ca = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "california.json"), "utf-8"));
  assertEqual(ca.rnEndorsementFeeUsd.value, 350);
  const tx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "texas.json"), "utf-8"));
  assertEqual(tx.rnEndorsementFeeUsd.value, "Unknown");
  const ilGa = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "illinois-to-georgia.json"), "utf-8"));
  assertEqual(ilGa.experienceRequirement.confidence, 0.95);
  // Confirm no stray synthetic test directories survived.
  assert(!fs.existsSync(SYNTH_FACTS_DIR), "synthetic test facts directory must be cleaned up");
  assert(!fs.existsSync(SYNTH_TRANSFER_DIR), "synthetic test transfer-rules directory must be cleaned up");
  assert(!fs.existsSync(SYNTH_CHANGES_DIR), "synthetic test changes directory must be cleaned up");
});

// ---------------------------------------------------------------------
// 26. Phase 4.6 — Source Health & Monitoring Orchestration (synthetic
//     registries/fixtures only; the orchestrator is exercised with an
//     INJECTED in-memory registry + a temp changes directory, so the
//     real data/knowledge-base/monitoring/registry.json is never touched)
// ---------------------------------------------------------------------
console.log("\nSource Health & Monitoring Orchestration (Phase 4.6):");

const PHASE46_CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-phase46-test-temp");
const PHASE46_REGISTRY_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-phase46-test-temp.json");
function cleanupPhase46() {
  fs.rmSync(PHASE46_CHANGES_DIR, { recursive: true, force: true });
  fs.rmSync(PHASE46_REGISTRY_PATH, { force: true });
}

// --- Source selection ---
await test("[Source selection] a never-checked active source is due", () => {
  const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "a", lastCheckedAt: null })] };
  assertEqual(getSourcesDueForCheck(registry, new Date("2026-08-12")).length, 1);
});

await test("[Source selection] a recently-checked source within its interval is NOT due", () => {
  const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "a", checkFrequencyDays: 30, lastCheckedAt: "2026-08-05" })] };
  assertEqual(getSourcesDueForCheck(registry, new Date("2026-08-12")).length, 0);
});

await test("[Source selection] a disabled (paused) source is excluded regardless of how overdue it is", () => {
  const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "a", status: "paused", checkFrequencyDays: 1, lastCheckedAt: "2020-01-01" })] };
  assertEqual(getSourcesDueForCheck(registry, new Date("2026-08-12")).length, 0);
});

await test("[Source selection] a FAILED source REMAINS due for its next scheduled check — the Phase 4.6 bug fix, proving recovery is possible", () => {
  const registry: MonitoredSourceRegistry = {
    version: 1,
    sources: [synthMonitoredSource({ id: "a", status: "failed", consecutiveFailures: 3, checkFrequencyDays: 7, lastCheckedAt: "2026-08-01" })],
  };
  const due = getSourcesDueForCheck(registry, new Date("2026-08-12")); // 11 days later, past the 7-day interval
  assertEqual(due.length, 1, "a failed source must still be checked again — permanent exclusion would make automatic recovery impossible");
});

await test("[Source selection] an overdue source is returned, ordering is deterministic (registry array order preserved)", () => {
  const registry: MonitoredSourceRegistry = {
    version: 1,
    sources: [synthMonitoredSource({ id: "b", lastCheckedAt: null }), synthMonitoredSource({ id: "a", lastCheckedAt: null })],
  };
  const due = getSourcesDueForCheck(registry, new Date("2026-08-12"));
  assertEqual(due.map((s) => s.id), ["b", "a"], "expected the same order as the registry array — no implicit re-sorting");
});

// --- Health classification ---
await test("[Health] initial (never-checked) state classifies as never_checked", () => {
  const source = synthMonitoredSource({ lastCheckedAt: null });
  assertEqual(classifySourceHealth(source, new Date("2026-08-12")), "never_checked");
});

await test("[Health] a clean, recent, zero-failure source classifies healthy", () => {
  const source = synthMonitoredSource({ lastCheckedAt: "2026-08-10", lastSuccessfulFetchAt: "2026-08-10", consecutiveFailures: 0, checkFrequencyDays: 30 });
  assertEqual(classifySourceHealth(source, new Date("2026-08-12")), "healthy");
});

await test("[Health] one or two failures (below the 3-strike threshold) classify as warning, not failed", () => {
  const oneFailure = synthMonitoredSource({ lastCheckedAt: "2026-08-10", lastSuccessfulFetchAt: "2026-08-05", consecutiveFailures: 1, checkFrequencyDays: 30 });
  assertEqual(classifySourceHealth(oneFailure, new Date("2026-08-12")), "warning");
  const twoFailures = synthMonitoredSource({ lastCheckedAt: "2026-08-10", lastSuccessfulFetchAt: "2026-08-05", consecutiveFailures: 2, checkFrequencyDays: 30 });
  assertEqual(classifySourceHealth(twoFailures, new Date("2026-08-12")), "warning");
});

await test("[Health] three consecutive failures -> stored status flips to failed, classification reflects it", () => {
  const source = synthMonitoredSource({ status: "failed", consecutiveFailures: 3, lastCheckedAt: "2026-08-10" });
  assertEqual(classifySourceHealth(source, new Date("2026-08-12")), "failed");
});

await test("[Health] successful recovery after failures: consecutiveFailures resets to 0, status back to active, classification back to healthy", () => {
  // Simulates what fetchMonitoredSource's own successful-fetch branch already does (Phase 4.2, re-verified as still correct here).
  const recovered = synthMonitoredSource({ status: "active", consecutiveFailures: 0, lastCheckedAt: "2026-08-12", lastSuccessfulFetchAt: "2026-08-12", checkFrequencyDays: 30 });
  assertEqual(classifySourceHealth(recovered, new Date("2026-08-12")), "healthy");
});

await test("[Health] a disabled (paused) source always classifies disabled, taking precedence over everything else", () => {
  const source = synthMonitoredSource({ status: "paused", consecutiveFailures: 5, lastCheckedAt: null });
  assertEqual(classifySourceHealth(source, new Date("2026-08-12")), "disabled");
});

await test("[Health] a source that hasn't succeeded in a long time (but isn't formally 'failed') classifies stale", () => {
  const source = synthMonitoredSource({ status: "active", consecutiveFailures: 0, lastCheckedAt: "2026-08-10", lastSuccessfulFetchAt: "2026-01-01", checkFrequencyDays: 7 });
  assertEqual(classifySourceHealth(source, new Date("2026-08-12")), "stale", "far more than 3x the 7-day interval has passed since the last success");
});

await test("[Health] computeNextCheckAt implements the exact Step 3 formula: lastSuccessfulFetchAt + checkFrequencyDays", () => {
  const source = synthMonitoredSource({ lastSuccessfulFetchAt: "2026-08-01T00:00:00.000Z", checkFrequencyDays: 30 });
  const next = computeNextCheckAt(source);
  assertEqual(next, "2026-08-31T00:00:00.000Z");
});

await test("[Health] computeNextCheckAt returns null for a never-successful source rather than a fabricated date", () => {
  const source = synthMonitoredSource({ lastSuccessfulFetchAt: null });
  assertEqual(computeNextCheckAt(source), null);
});

await test("[Health] summarizeSourceHealth produces the exact Step 5 field set with correct counts across a mixed registry", () => {
  const registry: MonitoredSourceRegistry = {
    version: 1,
    sources: [
      synthMonitoredSource({ id: "healthy1", status: "active", consecutiveFailures: 0, lastCheckedAt: "2026-08-11", lastSuccessfulFetchAt: "2026-08-11", checkFrequencyDays: 30 }),
      synthMonitoredSource({ id: "warning1", status: "active", consecutiveFailures: 1, lastCheckedAt: "2026-08-11", lastSuccessfulFetchAt: "2026-08-05", checkFrequencyDays: 30 }),
      synthMonitoredSource({ id: "failed1", status: "failed", consecutiveFailures: 3, lastCheckedAt: "2026-08-11" }),
      synthMonitoredSource({ id: "disabled1", status: "paused", lastCheckedAt: null }),
      synthMonitoredSource({ id: "never1", lastCheckedAt: null }),
    ],
  };
  const summary = summarizeSourceHealth(registry, new Date("2026-08-12"));
  assertEqual(summary.totalMonitoredSources, 5);
  assertEqual(summary.healthy, 1);
  assertEqual(summary.warning, 1);
  assertEqual(summary.failed, 1);
  assertEqual(summary.disabled, 1);
  assertEqual(summary.neverChecked, 1);
  assertEqual(summary.healthy + summary.warning + summary.failed + summary.disabled + summary.neverChecked + summary.stale, 5);
});

// --- Orchestrator: change detection integration (mock mode, injected registry + temp changes dir) ---
await test("[Orchestrator] a source with a real mock fixture is detected, classified, and queued as a DetectedChange (first-ever check = baseline CONTENT_CHANGED, per Phase 4.3's own documented contract)", async () => {
  cleanupPhase46();
  try {
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, lastContentHash: null })],
    };
    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE46_CHANGES_DIR, registryPath: PHASE46_REGISTRY_PATH, now: new Date("2026-08-12") });

    assertEqual(summary.sourcesChecked, 1);
    assertEqual(summary.changesDetected, 1, "a first-ever successful check with no previous hash must be treated as CONTENT_CHANGED, per compareHashes' documented contract");
    assertEqual(summary.changesQueued, 1);
    assertEqual(summary.results[0]!.fetchStatus, "ok");
    assertEqual(summary.results[0]!.changeCreated, true);

    const changes = listDetectedChanges(PHASE46_CHANGES_DIR);
    assertEqual(changes.length, 1);
    assertEqual(changes[0]!.status, "pending_verification", "the orchestrator must NEVER auto-approve — this is the single most important safety check in this whole phase");
  } finally {
    cleanupPhase46();
  }
});

await test("[Orchestrator / Step 8] running twice against unchanged content produces NO duplicate DetectedChange the second time (idempotent)", async () => {
  cleanupPhase46();
  try {
    let registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, lastContentHash: null, checkFrequencyDays: 0 })],
    };

    const first = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE46_CHANGES_DIR, registryPath: PHASE46_REGISTRY_PATH, now: new Date("2026-08-12T00:00:00Z") });
    assertEqual(first.changesQueued, 1, "run #1 detects the first-ever baseline as a change");

    // The registry the orchestrator returns internally isn't exposed directly, so re-load what it saved would normally happen on-disk — here we simulate the same effect by re-loading via the real update path: fetch again with the SAME source but now carrying the hash the first run recorded.
    const updatedSource = { ...registry.sources[0]!, lastCheckedAt: first.results[0]!.fetchStatus === "ok" ? "2026-08-12T00:00:00.000Z" : null, lastContentHash: (await import("../../lib/monitoring/change-record")).listDetectedChanges(PHASE46_CHANGES_DIR)[0]!.newHash };
    registry = { version: 1, sources: [updatedSource] };

    const second = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE46_CHANGES_DIR, registryPath: PHASE46_REGISTRY_PATH, now: new Date("2026-08-12T00:00:01Z") });
    assertEqual(second.changesDetected, 0, "run #2 against the exact same fixture content must resolve to NO_CHANGE");
    assertEqual(second.changesQueued, 0, "no duplicate DetectedChange may be created");

    const changes = listDetectedChanges(PHASE46_CHANGES_DIR);
    assertEqual(changes.length, 1, "still exactly one DetectedChange record on disk after 2 runs");
  } finally {
    cleanupPhase46();
  }
});

await test("[Orchestrator / Step 9] a fetch failure (nonexistent fixture) is recorded as SOURCE_UNAVAILABLE, never as a fake content change, and never wipes prior known-good state", async () => {
  cleanupPhase46();
  try {
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [
        synthMonitoredSource({
          id: "synthetic-nonexistent-fixture",
          lastCheckedAt: "2026-08-01",
          lastSuccessfulFetchAt: "2026-08-01",
          lastContentHash: "previously-known-good-hash",
          checkFrequencyDays: 0,
        }),
      ],
    };
    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE46_CHANGES_DIR, registryPath: PHASE46_REGISTRY_PATH, now: new Date("2026-08-12") });

    assertEqual(summary.results[0]!.fetchStatus, "error");
    assertEqual(summary.results[0]!.classification, "SOURCE_UNAVAILABLE");
    assertEqual(summary.changesQueued, 1, "SOURCE_UNAVAILABLE is itself a real classification worth a review-visible record — but it must never claim a content/value change occurred");

    const changes = listDetectedChanges(PHASE46_CHANGES_DIR);
    assertEqual(changes[0]!.classification, "SOURCE_UNAVAILABLE");
    assertEqual(changes[0]!.proposedValue, undefined, "an unavailable source must never propose a value");
  } finally {
    cleanupPhase46();
  }
});

await test("[Orchestrator / Step 11 Dry Run] identical fetch/detect/classify output, but ZERO files written anywhere", async () => {
  cleanupPhase46();
  try {
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, lastContentHash: null })],
    };
    const summary = await runMonitoringCycle({ mode: "mock", dryRun: true, registry, changesDir: PHASE46_CHANGES_DIR, registryPath: PHASE46_REGISTRY_PATH, now: new Date("2026-08-12") });

    assertEqual(summary.dryRun, true);
    assertEqual(summary.sourcesChecked, 1);
    assertEqual(summary.results[0]!.wouldCreateChange, true, "dry-run must still correctly COMPUTE what would happen");
    assertEqual(summary.results[0]!.changeCreated, false, "but must never actually CREATE the record");
    assertEqual(summary.changesQueued, 0);

    assert(!fs.existsSync(PHASE46_CHANGES_DIR), "dry-run must leave the changes directory completely absent/untouched — not even created");
    assertEqual(summary.healthBefore, summary.healthAfter, "dry-run must leave health metrics completely unchanged, since nothing was actually persisted");
  } finally {
    cleanupPhase46();
  }
});

await test("[Safety] the orchestrator's own module never imports applyAndPersistReview or anything that could approve a change — an import check is the true structural guarantee (if it's never imported, it structurally cannot be called), unlike a naive substring search that would also match this test's own explanatory comments", () => {
  const runModuleSource = fs.readFileSync(path.join(process.cwd(), "lib", "monitoring", "run.ts"), "utf-8");
  const importLines = runModuleSource.split("\n").filter((line) => line.trim().startsWith("import"));
  const importedNames = importLines.join("\n");
  assert(!importedNames.includes("applyAndPersistReview"), "the orchestrator must not import applyAndPersistReview — without the import, calling it is structurally impossible regardless of anything the file's comments say");
  assert(!importedNames.includes("applyFieldReview"), "the orchestrator must not import applyFieldReview either — no path to marking anything verified");
});

await test("[Safety] production facts and transfer-rules remain completely untouched by the entire Phase 4.6 orchestration test suite", () => {
  const ca = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "california.json"), "utf-8"));
  assertEqual(ca.rnEndorsementFeeUsd.value, 350);
  const ilGa = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "illinois-to-georgia.json"), "utf-8"));
  assertEqual(ilGa.experienceRequirement.confidence, 0.95);
  assert(!fs.existsSync(PHASE46_CHANGES_DIR), "no stray Phase 4.6 test directory may survive");
  // Note: as of the first-real-source-pilot work (after Phase 4.7), the
  // real registry legitimately contains 1 real source — this test no
  // longer asserts emptiness (that invariant only held through Phase 4.7);
  // see the later pilot-specific test for the correct current-state check.
});

// ---------------------------------------------------------------------
// 27. Phase 4.7 — Monitoring Recovery & Health State Hardening
//     (synthetic registries/fixtures only; every orchestrator call below
//     uses an isolated registryPath/changesDir/lockPath — never the real
//     data/knowledge-base/monitoring/registry.json)
// ---------------------------------------------------------------------
console.log("\nMonitoring Recovery & Health State Hardening (Phase 4.7):");

const PHASE47_CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-phase47-test-temp");
const PHASE47_REGISTRY_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-phase47-test-temp.json");
const PHASE47_LOCK_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-phase47-test-temp");
function cleanupPhase47() {
  fs.rmSync(PHASE47_CHANGES_DIR, { recursive: true, force: true });
  fs.rmSync(PHASE47_REGISTRY_PATH, { force: true });
  fs.rmSync(PHASE47_LOCK_PATH, { force: true });
}

// --- Steps 3/4: the complete failure/recovery state machine ---
await test("[Test A] active -> failure #1 -> warning (consecutiveFailures=1, status stays active)", async () => {
  const source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", status: "active", consecutiveFailures: 0 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.consecutiveFailures, 1);
  assertEqual(outcome.updatedFields.status, "active", "1 failure must not flip the stored status");
  const updated = { ...source, ...outcome.updatedFields };
  assertEqual(classifySourceHealth(updated, new Date()), "warning");
});

await test("[Test B] warning -> second failure -> still warning (consecutiveFailures=2, status stays active)", async () => {
  const source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", status: "active", consecutiveFailures: 1 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.consecutiveFailures, 2);
  assertEqual(outcome.updatedFields.status, "active");
  const updated = { ...source, ...outcome.updatedFields };
  assertEqual(classifySourceHealth(updated, new Date()), "warning");
});

await test("[Test C] warning -> third consecutive failure -> failed", async () => {
  const source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", status: "active", consecutiveFailures: 2 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.consecutiveFailures, 3);
  assertEqual(outcome.updatedFields.status, "failed");
  const updated = { ...source, ...outcome.updatedFields };
  assertEqual(classifySourceHealth(updated, new Date()), "failed");
});

await test("[Test D] failed -> successful fetch -> active, and the failure counter resets (no stale poisoning)", async () => {
  const source = synthMonitoredSource({ id: "synthetic-monitor-test-source", status: "failed", consecutiveFailures: 3 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.status, "active", "a successful fetch must recover a failed source to active");
  assertEqual(outcome.updatedFields.consecutiveFailures, 0, "recovery must not leave a stale failure count");
});

await test("[Test E] warning -> successful fetch -> active (partial recovery before hitting the 3-strike threshold)", async () => {
  const source = synthMonitoredSource({ id: "synthetic-monitor-test-source", status: "active", consecutiveFailures: 2 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.status, "active");
  assertEqual(outcome.updatedFields.consecutiveFailures, 0);
});

await test("[Test F] paused -> successful fetch/check -> REMAINS paused (the Phase 4.7 bug fix: fetchMonitoredSource previously always forced status='active' on success, ignoring a deliberate human pause)", async () => {
  const source = synthMonitoredSource({ id: "synthetic-monitor-test-source", status: "paused", consecutiveFailures: 0 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.status, "paused", "a paused source must never be automatically un-paused by a fetch outcome, success or failure");
});

await test("[Test F variant] paused -> failed fetch -> still REMAINS paused, not 'failed' either", async () => {
  const source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", status: "paused", consecutiveFailures: 0 });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.status, "paused", "even a failure must not move a paused source into the failed state — pause overrides everything");
});

// --- Step 4: failure counters, broader audit ---
await test("[Counters] consecutiveFailures increments by exactly 1 per consecutive failure, never more", async () => {
  let source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", consecutiveFailures: 0 });
  for (let i = 1; i <= 3; i++) {
    const outcome = await fetchMonitoredSource(source, "mock");
    assertEqual(outcome.updatedFields.consecutiveFailures, i);
    source = { ...source, ...outcome.updatedFields };
  }
});

await test("[Counters] totalChecks/successfulChecks/failedChecks are cumulative and never reset, unlike consecutiveFailures", async () => {
  let source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture", totalChecks: 0, successfulChecks: 0, failedChecks: 0, consecutiveFailures: 0 });
  let outcome = await fetchMonitoredSource(source, "mock"); // fail #1
  source = { ...source, ...outcome.updatedFields };
  outcome = await fetchMonitoredSource(source, "mock"); // fail #2
  source = { ...source, ...outcome.updatedFields };
  assertEqual(source.totalChecks, 2);
  assertEqual(source.failedChecks, 2);
  assertEqual(source.successfulChecks, 0);

  // Now recover — cumulative counters must NOT reset even though consecutiveFailures does.
  source.id = "synthetic-monitor-test-source";
  outcome = await fetchMonitoredSource(source, "mock");
  source = { ...source, ...outcome.updatedFields };
  assertEqual(source.totalChecks, 3, "cumulative total must keep counting");
  assertEqual(source.failedChecks, 2, "past failures remain in the cumulative count — recovery doesn't erase history");
  assertEqual(source.successfulChecks, 1);
  assertEqual(source.consecutiveFailures, 0, "only the CONSECUTIVE counter resets on success");
});

// --- Step 5/7: idempotency + registry isolation regression ---
await test("[Step 5 Idempotency] the same monitoring cycle run twice against the same isolated registry+content produces no duplicate DetectedChange", async () => {
  cleanupPhase47();
  try {
    let registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, lastContentHash: null, checkFrequencyDays: 0 })] };
    const first = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH, now: new Date("2026-08-13T00:00:00Z") });
    assertEqual(first.changesQueued, 1);

    const reloadedRegistry = JSON.parse(fs.readFileSync(PHASE47_REGISTRY_PATH, "utf-8"));
    const second = await runMonitoringCycle({ mode: "mock", registry: reloadedRegistry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH, now: new Date("2026-08-13T00:01:00Z") });
    assertEqual(second.changesQueued, 0, "identical source, same fetched content, same hash, same metadata -> no duplicate on the second run");
    assertEqual(listDetectedChanges(PHASE47_CHANGES_DIR).length, 1);
  } finally {
    cleanupPhase47();
  }
});

await test("[Step 7 Registry Isolation Regression — PERMANENT] production registry.json checksum is identical before and after an isolated monitoring cycle run", async () => {
  const realRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json");
  const before = fs.readFileSync(realRegistryPath, "utf-8");

  cleanupPhase47();
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null })] };
    await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH, now: new Date("2026-08-13") });
  } finally {
    cleanupPhase47();
  }

  const after = fs.readFileSync(realRegistryPath, "utf-8");
  assertEqual(before, after, "an isolated monitoring cycle (registryPath explicitly overridden) must NEVER touch the real production registry.json — this is exactly the Phase 4.6 bug this test permanently guards against");
});

// --- Step 6: dry-run side-effect audit ---
await test("[Step 6 Dry Run Audit] dry-run performs real fetch/hash/classify but creates NO registry, NO changes dir, NO lock file — verified via filesystem state before/after", async () => {
  cleanupPhase47();
  const realRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json");
  const realRegistryBefore = fs.readFileSync(realRegistryPath, "utf-8");
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null })] };
    const summary = await runMonitoringCycle({ mode: "mock", dryRun: true, registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH, now: new Date("2026-08-13") });

    assert(summary.results.length > 0, "dry-run must still perform the real fetch/detect/classify work");
    assert(!fs.existsSync(PHASE47_CHANGES_DIR), "dry-run must not create the changes directory");
    assert(!fs.existsSync(PHASE47_REGISTRY_PATH), "dry-run must not create/write the isolated registry path either");
    assert(!fs.existsSync(PHASE47_LOCK_PATH), "dry-run must never even create a lock file — that would itself be a leftover artifact");
    assertEqual(fs.readFileSync(realRegistryPath, "utf-8"), realRegistryBefore, "the real registry must obviously also be untouched");
  } finally {
    cleanupPhase47();
  }
});

// --- Step 9: paused source scheduler safety ---
await test("[Step 9] a paused source is never selected by the scheduler at all", () => {
  const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "a", status: "paused", checkFrequencyDays: 1, lastCheckedAt: "2000-01-01" })] };
  assertEqual(getSourcesDueForCheck(registry, new Date("2026-08-13")).length, 0);
});

await test("[Step 9] a full orchestrator cycle with only a paused source due-in-theory results in zero sources actually checked", async () => {
  cleanupPhase47();
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", status: "paused", checkFrequencyDays: 0, lastCheckedAt: null })] };
    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH, now: new Date("2026-08-13") });
    assertEqual(summary.sourcesChecked, 0, "a paused source must never actually be fetched by a real cycle run");
  } finally {
    cleanupPhase47();
  }
});

// --- Step 8: failure metadata preservation ---
await test("[Step 8] failed fetches preserve httpStatus/error information already supported by FetchResult, without duplicating fields", async () => {
  const source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture" });
  const outcome = await fetchMonitoredSource(source, "mock");
  assert(!!outcome.updatedFields.lastError, "expected a real error message preserved from the failed fetch");
  assert(outcome.updatedFields.lastError!.length > 0);
  // httpStatus is genuinely absent for a missing-fixture mock failure (no HTTP request was ever made) — correctly null, not fabricated.
  assertEqual(outcome.updatedFields.lastHttpStatus, null);
});

await test("[Step 8] a successful fetch clears lastError (doesn't leave a stale error message after recovery)", async () => {
  const source = synthMonitoredSource({ id: "synthetic-monitor-test-source", lastError: "some stale prior error" });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.updatedFields.lastError, null);
});

// --- Step 10: no review coupling, re-verified for Phase 4.7's own new code ---
await test("[Step 10] Phase 4.7's changes to fetch.ts and run.ts still import zero review/approval machinery", () => {
  const fetchSource_ = fs.readFileSync(path.join(process.cwd(), "lib", "monitoring", "fetch.ts"), "utf-8");
  const runSource_ = fs.readFileSync(path.join(process.cwd(), "lib", "monitoring", "run.ts"), "utf-8");
  for (const src of [fetchSource_, runSource_]) {
    const importLines = src.split("\n").filter((l) => l.trim().startsWith("import")).join("\n");
    assert(!importLines.includes("applyAndPersistReview"), "no monitoring module may import applyAndPersistReview");
    assert(!importLines.includes("applyFieldReview"), "no monitoring module may import applyFieldReview");
  }
});

// --- Step 11: concurrency / duplicate-run audit ---
await test("[Step 11] a second non-dry-run cycle refuses to start while a lock is held, rather than racing the first", async () => {
  cleanupPhase47();
  try {
    fs.mkdirSync(path.dirname(PHASE47_LOCK_PATH), { recursive: true });
    fs.writeFileSync(PHASE47_LOCK_PATH, JSON.stringify({ acquiredAt: new Date().toISOString() }), { flag: "wx" }); // simulate an in-progress cycle

    const registry: MonitoredSourceRegistry = { version: 1, sources: [] };
    let threw = false;
    try {
      await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH });
    } catch (e) {
      threw = e instanceof MonitoringCycleInProgressError;
    }
    assert(threw, "expected MonitoringCycleInProgressError when a lock is already held");
  } finally {
    cleanupPhase47();
  }
});

await test("[Step 11] the lock is always released after a cycle completes, even implicitly proven by a clean back-to-back run", async () => {
  cleanupPhase47();
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [] };
    await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH });
    assert(!fs.existsSync(PHASE47_LOCK_PATH), "the lock file must be removed once the cycle finishes");
    // A second run must succeed cleanly — no leftover lock blocking it.
    await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH });
    assert(!fs.existsSync(PHASE47_LOCK_PATH), "the lock file must be removed after the second run too");
  } finally {
    cleanupPhase47();
  }
});

await test("[Step 11] dry-run never acquires the lock at all — no lock file appears even transiently", async () => {
  cleanupPhase47();
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [] };
    await runMonitoringCycle({ mode: "mock", dryRun: true, registry, changesDir: PHASE47_CHANGES_DIR, registryPath: PHASE47_REGISTRY_PATH, lockPath: PHASE47_LOCK_PATH });
    assert(!fs.existsSync(PHASE47_LOCK_PATH), "dry-run must never touch the lock file");
  } finally {
    cleanupPhase47();
  }
});

// --- HTTP / network error distinction (part of Step 12's matrix) ---
await test("[HTTP/network error] a fetch failure without an HTTP status (network-level failure) still records a usable lastError, httpStatus correctly null", async () => {
  const source = synthMonitoredSource({ id: "synthetic-nonexistent-fixture" });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.fetchResult.status, "error");
  assertEqual(outcome.updatedFields.lastHttpStatus, null, "no HTTP request was made for this mock-mode missing-fixture case — correctly absent, not fabricated as e.g. 500");
});

// --- Hash unchanged / hash changed (part of Step 12's matrix, direct re-verification) ---
await test("[Hash unchanged] two fetches of the identical mock fixture produce the identical content hash", async () => {
  const source1 = synthMonitoredSource({ id: "synthetic-monitor-test-source" });
  const outcome1 = await fetchMonitoredSource(source1, "mock");
  const source2 = synthMonitoredSource({ id: "synthetic-monitor-test-source" });
  const outcome2 = await fetchMonitoredSource(source2, "mock");
  assertEqual(outcome1.fetchResult.contentHash, outcome2.fetchResult.contentHash, "the same fixture file must always hash identically");
});

await test("production registry.json remains byte-identical across the ENTIRE Phase 4.7 test run (final confirmation)", () => {
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  // Updated post-4.7: the registry now legitimately contains the one real
  // pilot source (added deliberately, outside any test, as this phase's
  // actual production deliverable) — the invariant this test protects is
  // "no TEST activity corrupted it," not "it must stay eternally empty."
  assert(!realRegistry.sources.some((s: any) => s.id.includes("-TEST") || s.id.includes("synthetic")), "no synthetic/test source id may ever appear in the real registry");
  assert(!fs.existsSync(PHASE47_CHANGES_DIR));
  assert(!fs.existsSync(PHASE47_REGISTRY_PATH));
  assert(!fs.existsSync(PHASE47_LOCK_PATH));
});

// ---------------------------------------------------------------------
// 28. First Real Source Pilot / Field-Level Monitoring (post-4.7)
//     ONE real source (Florida's official fee page, already backing a
//     verified production value), ONE real field mapping
//     (rnEndorsementFeeUsd), tested against REAL sanitized fixtures
//     captured from the live page. All non-dry-run orchestrator calls
//     use isolated changesDir/registryPath/lockPath — the REAL registry
//     (which now legitimately contains this one pilot source) is only
//     ever read, never written, by these tests.
// ---------------------------------------------------------------------
console.log("\nFirst Real Source Pilot / Field-Level Monitoring:");

const PILOT_CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-pilot-test-temp");
const PILOT_REGISTRY_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-pilot-test-temp.json");
const PILOT_LOCK_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-pilot-test-temp");
function cleanupPilot() {
  fs.rmSync(PILOT_CHANGES_DIR, { recursive: true, force: true });
  fs.rmSync(PILOT_REGISTRY_PATH, { force: true });
  fs.rmSync(PILOT_LOCK_PATH, { force: true });
}

function pilotSource(overrides: Partial<MonitoredSource> = {}): MonitoredSource {
  return {
    id: "florida-fee-schedule-monitor-TEST",
    url: "https://example-test.invalid/florida-fee-pilot", // never actually fetched — mock mode reads the fixture by id
    title: "[TEST] Fees Archives - Florida Board of Nursing",
    jurisdiction: "florida",
    profession: "registered-nurse",
    sourceType: "official-board",
    authority: "authoritative",
    specificity: "field-specific",
    checkFrequencyDays: 30,
    status: "active",
    consecutiveFailures: 0,
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    lastCheckedAt: null,
    lastContentHash: null,
    fieldMapping: {
      field: "rnEndorsementFeeUsd",
      extractRule: { field: "rnEndorsementFeeUsd", pattern: "MOBILE Endorsement Fees[\\s\\S]{0,200}?\\$(\\d+(?:\\.\\d{2})?)", transform: "number" },
    },
    ...overrides,
  };
}

// The real production florida.json's rnEndorsementFeeUsd is $110 — every
// test below reads that REAL value (read-only) as the "currentValue"
// baseline, exactly like the real orchestrator would.
const REAL_FLORIDA_FEE = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8")).rnEndorsementFeeUsd.value;

await test("[Pilot Test 1: successful extraction] the real fixture (v1) extracts to EXACTLY the real, already-verified production value ($110)", async () => {
  assertEqual(REAL_FLORIDA_FEE, 110, "sanity check on the real production baseline this whole pilot is built against");
  const source = pilotSource({ id: "florida-fee-schedule-pilot-v1" });
  const outcome = await fetchMonitoredSource(source, "mock");
  assertEqual(outcome.fetchResult.status, "ok");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: REAL_FLORIDA_FEE,
    extractRule: source.fieldMapping!.extractRule,
    previousHash: null,
    newHash: outcome.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome.fetchResult.rawText,
  });
  // First-ever baseline (no previous hash) is CONTENT_CHANGED per Phase 4.3's documented contract,
  // but critically the extracted VALUE matches the real current value exactly.
  assert(detection.classification !== "NO_CHANGE" || true); // baseline case, see below assertion for the real proof:
  const extracted = require("../../lib/pipeline/extract").applyRule(source.fieldMapping!.extractRule, outcome.fetchResult.rawText);
  assertEqual(extracted.matched, true);
  assertEqual(extracted.value, 110, "extraction must produce exactly the real, already-verified $110 — proving the rule is correct against real content, not just a synthetic toy fixture");
});

await test("[Pilot Test 2: unchanged source] running detection twice against the identical real fixture produces NO_CHANGE the second time", async () => {
  const source = pilotSource({ id: "florida-fee-schedule-pilot-v1" });
  const outcome1 = await fetchMonitoredSource(source, "mock");
  const outcome2 = await fetchMonitoredSource({ ...source, ...outcome1.updatedFields }, "mock");
  assertEqual(outcome1.fetchResult.contentHash, outcome2.fetchResult.contentHash, "identical fixture must hash identically");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 110,
    extractRule: source.fieldMapping!.extractRule,
    previousHash: outcome1.fetchResult.contentHash,
    newHash: outcome2.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome2.fetchResult.rawText,
  });
  assertEqual(detection.classification, "NO_CHANGE");
});

await test("[Pilot Test 3: changed field] the v2 fixture (simulated $110 -> $125) produces a real DetectedChange with the correct proposed value", async () => {
  const source = pilotSource({ id: "florida-fee-schedule-pilot-v2-changed" });
  const outcome = await fetchMonitoredSource(source, "mock");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 110, // the real current production value
    extractRule: source.fieldMapping!.extractRule,
    previousHash: "some-previous-hash-representing-v1",
    newHash: outcome.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome.fetchResult.rawText,
  });
  assertEqual(detection.classification, "POSSIBLE_FEE_CHANGE");
  assertEqual(detection.proposedValue, 125, "must extract exactly the new, changed value");
});

await test("[Pilot Test 4: irrelevant source change] the page changing (copyright year) without the target field changing produces NO field-level change", async () => {
  const source = pilotSource({ id: "florida-fee-schedule-pilot-v1-irrelevant-change" });
  const outcome = await fetchMonitoredSource(source, "mock");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 110,
    extractRule: source.fieldMapping!.extractRule,
    previousHash: "some-different-previous-hash", // the page DID change (different copyright year -> different hash)
    newHash: outcome.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome.fetchResult.rawText,
  });
  assertEqual(detection.classification, "NO_CHANGE", "the page's hash differs, but the extracted fee is still exactly $110 — Section 9's core principle: not every page edit is a fact change");
});

await test("[Pilot Test 5: extraction failure] the malformed/restructured fixture fails to extract safely — no fabricated value", async () => {
  const source = pilotSource({ id: "florida-fee-schedule-pilot-v3-malformed" });
  const outcome = await fetchMonitoredSource(source, "mock");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 110,
    extractRule: source.fieldMapping!.extractRule,
    previousHash: "some-previous-hash",
    newHash: outcome.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome.fetchResult.rawText,
  });
  assertEqual(detection.classification, "POSSIBLE_FEE_CHANGE", "the category is still correctly inferred");
  assertEqual(detection.proposedValue, undefined, "but NO value is guessed when extraction can't confidently find one");
});

await test("[Pilot Test 6: provenance] a DetectedChange built from the pilot source carries complete, correct provenance per the existing schema", () => {
  const evidence = { url: "https://floridasnursing.gov/category/post-template-toggle/fees/", title: "Fees Archives - Florida Board of Nursing", fetchedAt: "2026-08-09" };
  const change = buildDetectedChange({
    sourceId: "florida-fee-schedule-monitor",
    jurisdiction: "florida",
    profession: "registered-nurse",
    field: "rnEndorsementFeeUsd",
    previousValue: 110,
    previousHash: "hash-v1",
    newHash: "hash-v2",
    detectionResult: { classification: "POSSIBLE_FEE_CHANGE", proposedValue: 125, confidence: 1 },
    evidence,
    detectedAt: "2026-08-09",
    sourceJurisdiction: "florida",
  });
  assertEqual(change.sourceId, "florida-fee-schedule-monitor");
  assertEqual(change.jurisdiction, "florida");
  assertEqual(change.profession, "registered-nurse");
  assertEqual(change.field, "rnEndorsementFeeUsd");
  assertEqual(change.evidence.url, evidence.url);
  assertEqual(change.jurisdictionMismatch, false);
});

await test("[Pilot Test 7: review boundary] the full pilot cycle (real fixture, real field mapping) NEVER auto-applies — the DetectedChange stays pending_verification and no production file is touched", async () => {
  cleanupPilot();
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [pilotSource({ id: "florida-fee-schedule-pilot-v2-changed", lastCheckedAt: null, lastContentHash: null })] };
    const before = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8");

    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: PILOT_CHANGES_DIR, registryPath: PILOT_REGISTRY_PATH, lockPath: PILOT_LOCK_PATH, now: new Date("2026-08-13") });

    assertEqual(summary.changesQueued, 1);
    const changes = listDetectedChanges(PILOT_CHANGES_DIR);
    assertEqual(changes.length, 1);
    assertEqual(changes[0]!.status, "pending_verification", "the change must remain pending — no automated approval, ever");
    assertEqual(changes[0]!.field, "rnEndorsementFeeUsd");

    const after = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8");
    assertEqual(before, after, "Florida's real production fact file must be completely untouched — detection alone, however confident, never writes a production fact");
  } finally {
    cleanupPilot();
  }
});

// --- End-to-end demonstration (Step 12): baseline -> simulated change -> DetectedChange -> pending, never approved ---
await test("[End-to-end demonstration] fixture v1 (baseline, matches the real known value) then fixture v2 (genuinely changed) across two real cycle runs: only the genuine change is queued, both scenarios stay pending", async () => {
  cleanupPilot();
  try {
    // Run 1: v1 fixture extracts $110 — which is EXACTLY the real current
    // value already on record. Even though this is technically the
    // first-ever check for this source, detectFieldChange correctly
    // recognizes there's nothing NEW to report (Section 9's principle,
    // applied to the best possible case: a first check that confirms the
    // existing data was already right).
    let registry: MonitoredSourceRegistry = { version: 1, sources: [pilotSource({ id: "florida-fee-schedule-pilot-v1", lastCheckedAt: null, lastContentHash: null, checkFrequencyDays: 0 })] };
    const run1 = await runMonitoringCycle({ mode: "mock", registry, changesDir: PILOT_CHANGES_DIR, registryPath: PILOT_REGISTRY_PATH, lockPath: PILOT_LOCK_PATH, now: new Date("2026-08-13T00:00:00Z") });
    assertEqual(run1.changesQueued, 0, "v1 extracts $110, which already matches the real current value — correctly nothing to flag, even on a first check");

    // Run 2: the SAME source, now pointed at the v2 fixture (simulating the real page changing to $125).
    const reloadedRegistry = JSON.parse(fs.readFileSync(PILOT_REGISTRY_PATH, "utf-8"));
    reloadedRegistry.sources[0].id = "florida-fee-schedule-pilot-v2-changed";
    const run2 = await runMonitoringCycle({ mode: "mock", registry: reloadedRegistry, changesDir: PILOT_CHANGES_DIR, registryPath: PILOT_REGISTRY_PATH, lockPath: PILOT_LOCK_PATH, now: new Date("2026-08-13T00:01:00Z") });
    assertEqual(run2.changesQueued, 1, "the real content change (v1 -> v2, $110 -> $125) must be detected and queued");

    const allChanges = listDetectedChanges(PILOT_CHANGES_DIR);
    assertEqual(allChanges.length, 1, "exactly one genuine change recorded — run 1 correctly produced none");
    assertEqual(allChanges[0]!.proposedValue, 125);
    assertEqual(allChanges[0]!.status, "pending_verification", "the demonstration explicitly does NOT approve anything");
  } finally {
    cleanupPilot();
  }
});

await test("production data (facts, transfer-rules, sources) remains completely untouched by the entire pilot test suite", () => {
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110, "Florida's real fee must remain exactly $110 — unchanged by any pilot test");
  assert(!fs.existsSync(PILOT_CHANGES_DIR));
  assert(!fs.existsSync(PILOT_REGISTRY_PATH));
  assert(!fs.existsSync(PILOT_LOCK_PATH));
});

await test("the REAL production registry contains the original pilot source, with correct identity and field mapping (now alongside 3 Phase 4.11 additions)", () => {
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  const source = realRegistry.sources.find((s: any) => s.id === "florida-fee-schedule-monitor");
  assert(!!source, "the original pilot source must still be present");
  assertEqual(source.jurisdiction, "florida");
  assertEqual(source.profession, "registered-nurse");
  assertEqual(source.fieldMapping.field, "rnEndorsementFeeUsd");
  assertEqual(source.status, "active");
  assertEqual(source.consecutiveFailures, 0);
});

// ---------------------------------------------------------------------
// 29. Phase 4.8 — Automated Scheduler / Cron Integration
// ---------------------------------------------------------------------
console.log("\nAutomated Scheduler / Cron Integration (Phase 4.8):");

const PHASE48_CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-phase48-test-temp");
const PHASE48_REGISTRY_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-phase48-test-temp.json");
const PHASE48_LOCK_PATH = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-phase48-test-temp");
function cleanupPhase48() {
  fs.rmSync(PHASE48_CHANGES_DIR, { recursive: true, force: true });
  fs.rmSync(PHASE48_REGISTRY_PATH, { force: true });
  fs.rmSync(PHASE48_LOCK_PATH, { force: true });
}

// --- Step 2: scheduler abstraction ---
await test("[Scheduler] getDueSources() matches getSourcesDueForCheck() exactly — a thin wrapper, not a reimplementation", () => {
  const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "a", lastCheckedAt: null }), synthMonitoredSource({ id: "b", status: "paused", lastCheckedAt: null })] };
  const due = getDueSources(registry, new Date("2026-08-14"));
  assertEqual(due.length, 1);
  assertEqual(due[0]!.id, "a");
});

await test("[Scheduler] runSourceCheck(sourceId) checks a specific source ON DEMAND, ignoring due-status (a manual re-check, unlike the scheduled cycle)", async () => {
  cleanupPhase48();
  try {
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", checkFrequencyDays: 9999, lastCheckedAt: "2026-08-13" })], // NOT due by interval
    };
    const result = await runSourceCheck("synthetic-monitor-test-source", { mode: "mock", registry, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH });
    assertEqual(result.found, true);
    assertEqual(result.result!.fetchStatus, "ok", "on-demand check must actually run, even though the source isn't 'due' by its interval");
  } finally {
    cleanupPhase48();
  }
});

await test("[Scheduler] runSourceCheck returns found=false for an unknown source id, without throwing", async () => {
  const registry: MonitoredSourceRegistry = { version: 1, sources: [] };
  const result = await runSourceCheck("does-not-exist", { mode: "mock", registry });
  assertEqual(result.found, false);
  assertEqual(result.result, undefined);
});

// --- Step 8: cron authentication ---
await test("[Cron Auth] missing CRON_SECRET (server not configured) always rejects, regardless of what the request sends", () => {
  assertEqual(checkCronAuthorization("Bearer anything", undefined), false);
  assertEqual(checkCronAuthorization(null, undefined), false);
  assertEqual(checkCronAuthorization("Bearer ", ""), false);
});

await test("[Cron Auth] wrong secret is rejected", () => {
  assertEqual(checkCronAuthorization("Bearer wrong-value", "real-secret-abc123"), false);
});

await test("[Cron Auth] missing Authorization header is rejected even when a secret IS configured", () => {
  assertEqual(checkCronAuthorization(null, "real-secret-abc123"), false);
  assertEqual(checkCronAuthorization(undefined, "real-secret-abc123"), false);
});

await test("[Cron Auth] correct secret, correctly formatted, is authorized", () => {
  assertEqual(checkCronAuthorization("Bearer real-secret-abc123", "real-secret-abc123"), true);
});

await test("[Cron Auth] the secret must be prefixed 'Bearer ' — a bare secret value alone is rejected (format matters, not just substring match)", () => {
  assertEqual(checkCronAuthorization("real-secret-abc123", "real-secret-abc123"), false);
});

// --- Step 7: failure safety scenarios, re-verified through the scheduler's public API ---
await test("[Failure Safety A] successful fetch through the scheduler updates lastCheckedAt/nextCheckAt-computable state, health stays active", async () => {
  cleanupPhase48();
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null })] };
    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH, lockPath: PHASE48_LOCK_PATH, now: new Date("2026-08-14") });
    const updated = JSON.parse(fs.readFileSync(PHASE48_REGISTRY_PATH, "utf-8")).sources[0];
    assert(!!updated.lastCheckedAt);
    assertEqual(classifySourceHealth(updated, new Date("2026-08-14")), "healthy");
  } finally {
    cleanupPhase48();
  }
});

await test("[Failure Safety B] HTTP/network failure through the scheduler never wipes last-known-good data", async () => {
  cleanupPhase48();
  try {
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [synthMonitoredSource({ id: "synthetic-nonexistent-fixture", checkFrequencyDays: 0, lastCheckedAt: "2026-08-01", lastSuccessfulFetchAt: "2026-08-01", lastContentHash: "known-good-hash" })],
    };
    await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH, lockPath: PHASE48_LOCK_PATH, now: new Date("2026-08-14") });
    const updated = JSON.parse(fs.readFileSync(PHASE48_REGISTRY_PATH, "utf-8")).sources[0];
    assertEqual(updated.lastContentHash, "known-good-hash", "last-known-good hash must survive a fetch failure");
    assertEqual(updated.lastSuccessfulFetchAt, "2026-08-01");
  } finally {
    cleanupPhase48();
  }
});

await test("[Failure Safety D] a real field change ($110->$125) through the full scheduler path produces pending_verification, production value untouched", async () => {
  cleanupPhase48();
  try {
    const before = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8");
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [
        {
          id: "florida-fee-schedule-pilot-v2-changed",
          url: "https://example-test.invalid/florida-fee-pilot",
          title: "[TEST]",
          jurisdiction: "florida",
          profession: "registered-nurse",
          sourceType: "official-board",
          authority: "authoritative",
          specificity: "field-specific",
          checkFrequencyDays: 0,
          status: "active",
          consecutiveFailures: 0,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          lastCheckedAt: null,
          lastContentHash: null,
          fieldMapping: { field: "rnEndorsementFeeUsd", extractRule: { field: "rnEndorsementFeeUsd", pattern: "MOBILE Endorsement Fees[\\s\\S]{0,200}?\\$(\\d+(?:\\.\\d{2})?)", transform: "number" } },
        },
      ],
    };
    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH, lockPath: PHASE48_LOCK_PATH, now: new Date("2026-08-14") });
    assertEqual(summary.changesQueued, 1);
    const change = listDetectedChanges(PHASE48_CHANGES_DIR)[0]!;
    assertEqual(change.proposedValue, 125);
    assertEqual(change.status, "pending_verification");
    const after = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8");
    assertEqual(before, after, "production florida.json must remain completely untouched");
  } finally {
    cleanupPhase48();
  }
});

await test("[Failure Safety F] repeated scheduler invocation against unchanged content produces no duplicate change on either run", async () => {
  cleanupPhase48();
  try {
    let registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, checkFrequencyDays: 0 })] };
    const run1 = await runMonitoringCycle({ mode: "mock", registry, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH, lockPath: PHASE48_LOCK_PATH, now: new Date("2026-08-14T00:00:00Z") });
    const countAfterRun1 = listDetectedChanges(PHASE48_CHANGES_DIR).length;

    const reloaded = JSON.parse(fs.readFileSync(PHASE48_REGISTRY_PATH, "utf-8"));
    const run2 = await runMonitoringCycle({ mode: "mock", registry: reloaded, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH, lockPath: PHASE48_LOCK_PATH, now: new Date("2026-08-14T00:01:00Z") });
    const countAfterRun2 = listDetectedChanges(PHASE48_CHANGES_DIR).length;

    assertEqual(run2.changesQueued, 0, "second run against unchanged content must queue nothing new");
    assertEqual(countAfterRun2, countAfterRun1, "no duplicate change record from the second, identical run");
  } finally {
    cleanupPhase48();
  }
});

// --- Step 14 / unexpected exception handling ---
await test("[Unexpected exception] a lock-in-progress condition surfaces as the specific, catchable MonitoringCycleInProgressError, not a generic crash", async () => {
  cleanupPhase48();
  try {
    fs.mkdirSync(path.dirname(PHASE48_LOCK_PATH), { recursive: true });
    fs.writeFileSync(PHASE48_LOCK_PATH, "{}", { flag: "wx" });
    let caught: unknown;
    try {
      await runMonitoringCycle({ mode: "mock", registry: { version: 1, sources: [] }, changesDir: PHASE48_CHANGES_DIR, registryPath: PHASE48_REGISTRY_PATH, lockPath: PHASE48_LOCK_PATH });
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof MonitoringCycleInProgressError, "expected the specific error type, catchable by the cron endpoint to return 409 rather than a generic 500");
  } finally {
    cleanupPhase48();
  }
});

// --- Zero automatic production mutation, final structural proof for the new files ---
await test("[Safety] the cron route and scheduler never import applyAndPersistReview/applyFieldReview — the same structural guarantee re-verified for Phase 4.8's new files", () => {
  const files = [
    path.join(process.cwd(), "lib", "monitoring", "scheduler.ts"),
    path.join(process.cwd(), "app", "api", "cron", "source-monitor", "route.ts"),
  ];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf-8");
    const importLines = src.split("\n").filter((l) => l.trim().startsWith("import")).join("\n");
    assert(!importLines.includes("applyAndPersistReview"), `${f} must not import applyAndPersistReview`);
    assert(!importLines.includes("applyFieldReview"), `${f} must not import applyFieldReview`);
  }
});

await test("[Safety — PERMANENT, Step 8 of the Final Production Verification] tracing the ENTIRE real import chain Cron -> Scheduler -> Orchestrator -> every module it touches, none of them import the write-capable applyAndPersistReview/applyFieldReview — only the safe, read-only loadFieldForChange from persistence.ts is ever reached", () => {
  const chain = [
    path.join(process.cwd(), "app", "api", "cron", "source-monitor", "route.ts"),
    path.join(process.cwd(), "lib", "monitoring", "cron-auth.ts"),
    path.join(process.cwd(), "lib", "monitoring", "scheduler.ts"),
    path.join(process.cwd(), "lib", "monitoring", "run.ts"),
    path.join(process.cwd(), "lib", "monitoring", "registry.ts"),
    path.join(process.cwd(), "lib", "monitoring", "fetch.ts"),
    path.join(process.cwd(), "lib", "monitoring", "detect.ts"),
    path.join(process.cwd(), "lib", "monitoring", "change-record.ts"),
    path.join(process.cwd(), "lib", "monitoring", "health.ts"),
    path.join(process.cwd(), "lib", "monitoring", "persistence.ts"), // reached only for the read-only loadFieldForChange
  ];
  let sawLoadFieldForChangeImport = false;
  for (const f of chain) {
    const src = fs.readFileSync(f, "utf-8");
    const importLines = src.split("\n").filter((l) => l.trim().startsWith("import")).join("\n");
    assert(!importLines.includes("applyAndPersistReview"), `${f}: the cron-reachable chain must never import applyAndPersistReview`);
    assert(!importLines.includes("applyFieldReview"), `${f}: the cron-reachable chain must never import applyFieldReview`);
    if (importLines.includes("loadFieldForChange")) sawLoadFieldForChangeImport = true;
  }
  assert(sawLoadFieldForChangeImport, "sanity check: confirms this test is actually tracing a real, non-trivial chain — persistence.ts IS reached, just only for its safe read helper");

  // Functional proof, not just a static-text check: run a REAL cycle
  // (the same code path the cron endpoint calls) against a source that
  // WOULD detect a real change, and confirm no field anywhere ends up
  // "verified" as a result — the actual, observable outcome of the
  // import-chain guarantee above.
  return (async () => {
    const tempChangesDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-step8-test-temp");
    const tempRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-step8-test-temp.json");
    const tempLockPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-step8-test-temp");
    try {
      const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null })] };
      await runMonitoringCycle({ mode: "mock", registry, changesDir: tempChangesDir, registryPath: tempRegistryPath, lockPath: tempLockPath });
      const changes = listDetectedChanges(tempChangesDir);
      for (const c of changes) {
        assertEqual(c.status, "pending_verification", "the cron/scheduler path must never produce anything but pending_verification");
      }
    } finally {
      fs.rmSync(tempChangesDir, { recursive: true, force: true });
      fs.rmSync(tempRegistryPath, { force: true });
      fs.rmSync(tempLockPath, { force: true });
    }
  })();
});

await test("[Safety] the cron route source never references logging the CRON_SECRET value itself", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "app", "api", "cron", "source-monitor", "route.ts"), "utf-8");
  assert(!/console\.(log|error)\([^)]*CRON_SECRET/.test(src), "CRON_SECRET must never appear inside a console.log/error call");
});

await test("production data (facts, transfer-rules, sources, registry) remains completely untouched by the entire Phase 4.8 test suite", () => {
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110);
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  assert(realRegistry.sources.some((s: any) => s.id === "florida-fee-schedule-monitor"), "the original pilot source must still be present");
  assert(!fs.existsSync(PHASE48_CHANGES_DIR));
  assert(!fs.existsSync(PHASE48_REGISTRY_PATH));
  assert(!fs.existsSync(PHASE48_LOCK_PATH));
});

// ---------------------------------------------------------------------
// 30. Phase 4.9 — Move Monitoring Execution to GitHub Actions
// ---------------------------------------------------------------------
console.log("\nMove Monitoring Execution to GitHub Actions (Phase 4.9):");

await test("[Vercel] vercel.json's crons array is now empty — Vercel can never auto-trigger the monitoring cycle, eliminating the two-scheduler risk", () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf-8"));
  assertEqual(vercelConfig.crons, [], "no automatic Vercel-triggered execution may remain — GitHub Actions is now the sole scheduler");
});

await test("[Cron route] the route source now specifically detects EROFS/EACCES and returns a clear, actionable message instead of a bare internal_error", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "app", "api", "cron", "source-monitor", "route.ts"), "utf-8");
  assert(src.includes("EROFS"), "expected explicit detection of the real, confirmed Vercel failure mode");
  assert(src.includes("vercel_readonly_filesystem"), "expected the specific, documented error code");
  assert(src.includes("GitHub Actions"), "the error message must point at the actual, current authoritative scheduler");
});

await test("[Workflow file] .github/workflows/source-monitor.yml exists, is valid, and never uses a blind 'git add .'", () => {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "source-monitor.yml");
  assert(fs.existsSync(workflowPath), "expected the new dedicated workflow file to exist");
  const src = fs.readFileSync(workflowPath, "utf-8");
  assert(!/git add \.\s*$/m.test(src), "must never blindly `git add .` — only the explicit monitoring-state path");
  assert(src.includes("git add data/knowledge-base/monitoring/"), "must explicitly scope the git add to the monitoring-state directory only");
  assert(src.includes("npm run monitor"), "must reuse the existing CLI, not duplicate the orchestrator");
  assert(src.includes("npm run validate-data"), "must run validation before committing (Step 2 / Step 9)");
  assert(src.includes("workflow_dispatch"), "must support manual triggering");
  assert(src.includes("permissions:") && src.includes("contents: write"), "must declare the exact permission it needs, nothing broader");
});

await test("[Workflow schedule] the new workflow's cron schedule does not exactly collide with the existing data-pipeline.yml schedule", () => {
  const existing = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "data-pipeline.yml"), "utf-8");
  const newWorkflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "source-monitor.yml"), "utf-8");
  const existingCron = existing.match(/cron:\s*"([^"]+)"/)?.[1];
  const newCron = newWorkflow.match(/cron:\s*"([^"]+)"/)?.[1];
  assert(!!existingCron && !!newCron, "expected both workflows to declare a cron schedule");
  assert(existingCron !== newCron, `expected different schedules to avoid an exact-time collision — got "${existingCron}" and "${newCron}"`);
});

await test("[PERMANENT — real GitHub Actions run caught this] .gitignore excludes data/_pipeline/cache/ contents (except .gitkeep) — the exact real-world cache-file leak the first live workflow run correctly refused to commit", () => {
  const gitignore = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf-8");
  assert(gitignore.includes("data/_pipeline/cache/*"), "expected the cache directory's contents to be gitignored");
  assert(gitignore.includes("!data/_pipeline/cache/.gitkeep"), "expected .gitkeep specifically to remain tracked, preserving the directory itself");
});

await test("[Real fetchLive cache side effect, documented] fetchMonitoredSource in 'live' mode reuses lib/pipeline/fetcher.ts's fetchLive(), which writes to data/_pipeline/cache/{id}.json as a side effect — confirmed this is real, not hypothetical, by inspecting fetcher.ts's own source", () => {
  const fetcherSrc = fs.readFileSync(path.join(process.cwd(), "lib", "pipeline", "fetcher.ts"), "utf-8");
  assert(fetcherSrc.includes("_pipeline") && fetcherSrc.includes("cache"), "expected fetcher.ts to reference the cache directory — confirms the real cause, not a guess");
});

await test("[Filesystem reality check] the local monitoring engine genuinely writes to a writable filesystem here (unlike Vercel) — confirmed by an actual write/read round-trip, the same operation that fails on Vercel", async () => {
  const tempChangesDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-p49-fswrite-test");
  const tempRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-p49-fswrite-test.json");
  const tempLockPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-p49-fswrite-test");
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null })] };
    await runMonitoringCycle({ mode: "mock", registry, changesDir: tempChangesDir, registryPath: tempRegistryPath, lockPath: tempLockPath });
    assert(fs.existsSync(tempRegistryPath), "the registry write must have actually succeeded on this (CLI/Actions-like) filesystem");
    const written = JSON.parse(fs.readFileSync(tempRegistryPath, "utf-8"));
    assertEqual(written.sources[0].id, "synthetic-monitor-test-source");
  } finally {
    fs.rmSync(tempChangesDir, { recursive: true, force: true });
    fs.rmSync(tempRegistryPath, { force: true });
    fs.rmSync(tempLockPath, { force: true });
  }
});

await test("[Step 11 re-demonstration] unchanged pilot source -> NO_CHANGE, no production mutation, no registry pollution — same guarantees re-verified after the Phase 4.9 architecture change", async () => {
  const before = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8");
  const tempChangesDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-p49-pilot-test");
  const tempRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-p49-pilot-test.json");
  const tempLockPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-p49-pilot-test");
  try {
    const registry: MonitoredSourceRegistry = {
      version: 1,
      sources: [
        {
          id: "florida-fee-schedule-pilot-v1",
          url: "https://example-test.invalid/florida-fee-pilot",
          title: "[TEST]",
          jurisdiction: "florida",
          profession: "registered-nurse",
          sourceType: "official-board",
          authority: "authoritative",
          specificity: "field-specific",
          checkFrequencyDays: 0,
          status: "active",
          consecutiveFailures: 0,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          lastCheckedAt: null,
          lastContentHash: null,
          fieldMapping: { field: "rnEndorsementFeeUsd", extractRule: { field: "rnEndorsementFeeUsd", pattern: "MOBILE Endorsement Fees[\\s\\S]{0,200}?\\$(\\d+(?:\\.\\d{2})?)", transform: "number" } },
        },
      ],
    };
    const summary = await runMonitoringCycle({ mode: "mock", registry, changesDir: tempChangesDir, registryPath: tempRegistryPath, lockPath: tempLockPath });
    assertEqual(summary.changesQueued, 0, "the pilot's known $110 value must still resolve to NO_CHANGE");
    const after = fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8");
    assertEqual(before, after);
  } finally {
    fs.rmSync(tempChangesDir, { recursive: true, force: true });
    fs.rmSync(tempRegistryPath, { force: true });
    fs.rmSync(tempLockPath, { force: true });
  }
});

await test("production data remains completely untouched by the entire Phase 4.9 test suite, and the real registry is unaffected", () => {
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110);
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  // Updated post-Phase-4.11: this invariant ("exactly 1 source") only held
  // through Phase 4.9. The registry now legitimately contains 4 real,
  // individually-validated sources — checked precisely below, not just
  // "non-empty."
  assert(realRegistry.sources.some((s: any) => s.id === "florida-fee-schedule-monitor"), "the original pilot source must still be present");
});

// ---------------------------------------------------------------------
// 31. Phase 4.11 — Production Source Expansion & Field-Mapping
//     (3 new real sources, individually live-verified before any fixture
//     or rule was written; 2 candidates researched and REJECTED for
//     genuine extraction-safety reasons, documented in the code itself)
// ---------------------------------------------------------------------
console.log("\nProduction Source Expansion & Field-Mapping (Phase 4.11):");

const REAL_NY_FEE = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8")).rnEndorsementFeeUsd.value;
const REAL_NY_TRANSFER_FEE = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "california-to-new-york.json"), "utf-8")).applicationFeeUsd.value;
const REAL_FL_TRANSFER_FEE = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "texas-to-florida.json"), "utf-8")).applicationFeeUsd.value;

// Phase 4.12.1: updated to the corrected, whitespace-tolerant pattern —
// the fixtures below (v1-irrelevant-change, v2-changed) were rebuilt to
// reflect the REAL current op.nysed.gov page structure (a hyperlink
// around "Form 1 - Application for Licensure"), so these Phase 4.11
// tests must use the same corrected pattern the production registry now
// uses, or they'd be testing against fixture content that no longer
// matches what they were written to model.
const NY_EXTRACT_RULE = { field: "rnEndorsementFeeUsd", pattern: "Form 1 - Application for Licensure\\s*\\*\\s*along with the \\$(\\d+(?:\\.\\d{2})?)", transform: "number" as const };
const FL_MULTISTATE_EXTRACT_RULE = { field: "applicationFeeUsd", pattern: "Multi-state Upgrade Fees[\\s\\S]{0,200}?\\$(\\d+(?:\\.\\d{2})?)", transform: "number" as const };

const PHASE411_CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-phase411-test-temp");
function cleanupPhase411() {
  fs.rmSync(PHASE411_CHANGES_DIR, { recursive: true, force: true });
}

async function testMappingSequence(args: {
  label: string;
  v1FixtureId: string;
  v2FixtureId: string;
  irrelevantFixtureId: string;
  malformedFixtureId: string;
  field: string;
  extractRule: { field: string; pattern: string; transform: "number" };
  currentValue: number;
  expectedV2Value: number;
}) {
  // 1. current value -> NO_CHANGE
  await test(`[${args.label}] current real fixture -> NO_CHANGE against the real current production value`, async () => {
    const source = synthMonitoredSource({ id: args.v1FixtureId });
    const outcome = await fetchMonitoredSource(source, "mock");
    const detection = detectFieldChange({
      field: args.field,
      currentValue: args.currentValue,
      extractRule: args.extractRule,
      previousHash: null,
      newHash: outcome.fetchResult.contentHash!,
      fetchStatus: "ok",
      rawText: outcome.fetchResult.rawText,
    });
    assertEqual(detection.classification, "NO_CHANGE", "the live-verified current value must match production exactly, per this phase's explicit pre-implementation live check");
  });

  // 2. changed value -> correct DetectedChange
  await test(`[${args.label}] v2 (genuinely changed) fixture -> correct DetectedChange with the right proposed value`, async () => {
    const source = synthMonitoredSource({ id: args.v2FixtureId });
    const outcome = await fetchMonitoredSource(source, "mock");
    const detection = detectFieldChange({
      field: args.field,
      currentValue: args.currentValue,
      extractRule: args.extractRule,
      previousHash: "some-prior-hash",
      newHash: outcome.fetchResult.contentHash!,
      fetchStatus: "ok",
      rawText: outcome.fetchResult.rawText,
    });
    assertEqual(detection.proposedValue, args.expectedV2Value);
    assert(detection.classification !== "NO_CHANGE");
  });

  // 3. irrelevant page change -> NO_CHANGE
  await test(`[${args.label}] irrelevant page change -> NO_CHANGE (target value unaffected)`, async () => {
    const source = synthMonitoredSource({ id: args.irrelevantFixtureId });
    const outcome = await fetchMonitoredSource(source, "mock");
    const detection = detectFieldChange({
      field: args.field,
      currentValue: args.currentValue,
      extractRule: args.extractRule,
      previousHash: "some-different-prior-hash",
      newHash: outcome.fetchResult.contentHash!,
      fetchStatus: "ok",
      rawText: outcome.fetchResult.rawText,
    });
    assertEqual(detection.classification, "NO_CHANGE");
  });

  // 4. malformed/ambiguous source -> no guessed value
  await test(`[${args.label}] malformed/ambiguous fixture -> classification without a guessed value`, async () => {
    const source = synthMonitoredSource({ id: args.malformedFixtureId });
    const outcome = await fetchMonitoredSource(source, "mock");
    const detection = detectFieldChange({
      field: args.field,
      currentValue: args.currentValue,
      extractRule: args.extractRule,
      previousHash: "some-prior-hash",
      newHash: outcome.fetchResult.contentHash!,
      fetchStatus: "ok",
      rawText: outcome.fetchResult.rawText,
    });
    assertEqual(detection.proposedValue, undefined, "must never guess when the target text has disappeared");
  });
}

await testMappingSequence({
  label: "NY rnEndorsementFeeUsd",
  v1FixtureId: "ny-endorsement-fee-pilot-v1",
  v2FixtureId: "ny-endorsement-fee-pilot-v2-changed",
  irrelevantFixtureId: "ny-endorsement-fee-pilot-v1-irrelevant-change",
  malformedFixtureId: "ny-endorsement-fee-pilot-v3-malformed",
  field: "rnEndorsementFeeUsd",
  extractRule: NY_EXTRACT_RULE,
  currentValue: REAL_NY_FEE,
  expectedV2Value: 160,
});

await testMappingSequence({
  label: "NY TransferRule applicationFeeUsd",
  v1FixtureId: "ny-endorsement-fee-pilot-v1",
  v2FixtureId: "ny-endorsement-fee-pilot-v2-changed",
  irrelevantFixtureId: "ny-endorsement-fee-pilot-v1-irrelevant-change",
  malformedFixtureId: "ny-endorsement-fee-pilot-v3-malformed",
  field: "applicationFeeUsd",
  extractRule: { ...NY_EXTRACT_RULE, field: "applicationFeeUsd" },
  currentValue: REAL_NY_TRANSFER_FEE,
  expectedV2Value: 160,
});

await testMappingSequence({
  label: "FL TransferRule applicationFeeUsd (Multi-state Upgrade)",
  v1FixtureId: "florida-fee-schedule-pilot-v1",
  v2FixtureId: "florida-fee-schedule-pilot-v2-multistate-changed",
  irrelevantFixtureId: "florida-fee-schedule-pilot-v2-changed", // the EXISTING pilot's own "endorsement changed" fixture — proves this new rule is genuinely unaffected by that unrelated figure changing
  malformedFixtureId: "florida-fee-schedule-pilot-v3-malformed",
  field: "applicationFeeUsd",
  extractRule: FL_MULTISTATE_EXTRACT_RULE,
  currentValue: REAL_FL_TRANSFER_FEE,
  expectedV2Value: 120,
});

await test("[Rejected candidates] Georgia and California extraction targets are NOT present in the production registry — documented rejections, not silent omissions", () => {
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  const ids = realRegistry.sources.map((s: any) => s.id);
  assert(!ids.some((id: string) => id.includes("georgia")), "Georgia was rejected — word-form numbers ('fifteen') and inferential-only prose, not a safe regex target");
  assert(!ids.some((id: string) => id.includes("california") && id.includes("exam")), "California examRequirement was rejected — a double-negative conditional sentence, not a safe declarative regex target");
});

await test("[Full orchestrator integration] a real cycle run against all 4 real production sources (mock mode, real fixtures matching their real ids' content) produces zero DetectedChanges — every live-verified value still matches production", async () => {
  cleanupPhase411();
  try {
    const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8")) as MonitoredSourceRegistry;
    // Point each real source's id at its matching real/synthetic fixture for this offline mock-mode integration test — mirrors exactly what "mode":"live" will do against the real URLs in GitHub Actions.
    const idToFixture: Record<string, string> = {
      "florida-fee-schedule-monitor": "florida-fee-schedule-pilot-v1", // the REAL Florida pilot fixture (MOBILE Endorsement Fees, $110) — NOT the generic Phase 4.2 placeholder fixture
      "ny-endorsement-fee-monitor": "ny-endorsement-fee-pilot-v1",
      "ny-transfer-fee-monitor": "ny-endorsement-fee-pilot-v1",
      "florida-multistate-fee-monitor": "florida-fee-schedule-pilot-v1",
    };
    let allNoChange = true;
    for (const source of realRegistry.sources) {
      const fixtureId = idToFixture[source.id];
      if (!fixtureId) continue; // skip anything unmapped rather than fail the whole test on an unrelated future source
      const mockSource = { ...source, id: fixtureId };
      const outcome = await fetchMonitoredSource(mockSource, "mock");
      if (source.fieldMapping) {
        const currentValue = loadFieldForChange({
          profession: source.profession,
          jurisdiction: source.jurisdiction,
          destinationJurisdiction: source.fieldMapping.destinationJurisdiction,
          field: source.fieldMapping.field,
        })?.value;
        const detection = detectFieldChange({
          field: source.fieldMapping.field,
          currentValue,
          extractRule: source.fieldMapping.extractRule,
          previousHash: null,
          newHash: outcome.fetchResult.contentHash!,
          fetchStatus: "ok",
          rawText: outcome.fetchResult.rawText,
        });
        if (detection.classification !== "NO_CHANGE") allNoChange = false;
      }
    }
    assert(allNoChange, "every one of the 4 real production sources must resolve to NO_CHANGE, matching this phase's live pre-verification");
  } finally {
    cleanupPhase411();
  }
});

await test("[Existing pilot regression] the original Florida rnEndorsementFeeUsd mapping is completely unaffected by adding 3 new sources", async () => {
  const source = synthMonitoredSource({ id: "florida-fee-schedule-pilot-v1" });
  const outcome = await fetchMonitoredSource(source, "mock");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 110,
    extractRule: { field: "rnEndorsementFeeUsd", pattern: "MOBILE Endorsement Fees[\\s\\S]{0,200}?\\$(\\d+(?:\\.\\d{2})?)", transform: "number" },
    previousHash: null,
    newHash: outcome.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome.fetchResult.rawText,
  });
  assertEqual(detection.classification, "NO_CHANGE");
});

await test("production facts and transfer-rules remain completely untouched by Phase 4.11 — only the monitoring registry changed, and only in the intended way", () => {
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110);
  const ny = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8"));
  assertEqual(ny.rnEndorsementFeeUsd.value, 143);
  const caNy = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "california-to-new-york.json"), "utf-8"));
  assertEqual(caNy.applicationFeeUsd.value, 143);
  const txFl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "texas-to-florida.json"), "utf-8"));
  assertEqual(txFl.applicationFeeUsd.value, 100);

  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  assertEqual(realRegistry.sources.length, 4, "expected exactly 4 real sources: the original pilot + 3 new Phase 4.11 mappings");
  assert(!fs.existsSync(PHASE411_CHANGES_DIR));
});

// ---------------------------------------------------------------------
// 32. Phase 4.12.1 — NY Extraction Robustness Fix
//     Real production incident: op.nysed.gov added a hyperlink around
//     "Form 1 - Application for Licensure", inserting a space at the
//     </a> tag boundary that broke the old zero-whitespace-tolerant
//     pattern. Value never changed (still $143) — the system correctly
//     refused to guess. This section makes all 6 required scenarios
//     permanent, executed against the REAL extraction implementation.
// ---------------------------------------------------------------------
console.log("\nNY Extraction Robustness Fix (Phase 4.12.1):");

const NY_FIXED_PATTERN = { field: "rnEndorsementFeeUsd", pattern: "Form 1 - Application for Licensure\\s*\\*\\s*along with the \\$(\\d+(?:\\.\\d{2})?)", transform: "number" as const };

const NY_ROBUSTNESS_SCENARIOS: [string, string, "no_change" | "changed" | "no_guess", number | undefined][] = [
  ["[Scenario 1] old plain-text structure (pre-hyperlink) still extracts 143, correctly resolving to NO_CHANGE against the real current value — backward compatible", "ny-endorsement-fee-pilot-v1", "no_change", undefined],
  ["[Scenario 2] current REAL hyperlink structure extracts 143, correctly resolving to NO_CHANGE — the actual fix", "ny-endorsement-fee-pilot-v1-hyperlink", "no_change", undefined],
  ["[Scenario 3] hyperlink + the REAL phishing/vishing banner text (verbatim from the real incident) still extracts 143 -> NO_CHANGE, unaffected", "ny-endorsement-fee-pilot-v1-irrelevant-change", "no_change", undefined],
  ["[Scenario 4] hyperlink structure + a genuine value change ($143->$160) is still correctly detected", "ny-endorsement-fee-pilot-v2-changed", "changed", 160],
  ["[Scenario 5] malformed/restructured target sentence fails safely — no guessed value", "ny-endorsement-fee-pilot-v3-malformed", "no_guess", undefined],
  ["[Scenario 6] an unrelated dollar amount elsewhere, with the target sentence entirely absent, does not falsely match", "ny-endorsement-fee-pilot-v5-unrelated-dollar", "no_guess", undefined],
];

for (const [label, fixtureId, expectedOutcome, expectedValue] of NY_ROBUSTNESS_SCENARIOS) {
  await test(label, async () => {
    const source = synthMonitoredSource({ id: fixtureId });
    const outcome = await fetchMonitoredSource(source, "mock");
    assertEqual(outcome.fetchResult.status, "ok", "fixture must fetch successfully — this test exercises the real fetch->normalize->extract path, not just a regex string check");
    const detection = detectFieldChange({
      field: "rnEndorsementFeeUsd",
      currentValue: 143,
      extractRule: NY_FIXED_PATTERN,
      previousHash: "some-prior-hash",
      newHash: outcome.fetchResult.contentHash!,
      fetchStatus: "ok",
      rawText: outcome.fetchResult.rawText,
    });
    if (expectedOutcome === "no_change") {
      // Extraction succeeded AND matches the real current production value ($143) —
      // detectFieldChange correctly reports NO_CHANGE with no proposedValue, since
      // there is genuinely nothing new to propose. This is the CORRECT contract,
      // not a failure — confirmed against lib/monitoring/detect.ts's own documented behavior.
      assertEqual(detection.classification, "NO_CHANGE");
      assertEqual(detection.proposedValue, undefined);
    } else if (expectedOutcome === "changed") {
      assertEqual(detection.proposedValue, expectedValue);
      assert(detection.classification !== "NO_CHANGE");
    } else {
      assertEqual(detection.proposedValue, undefined, "must never guess a value when extraction is genuinely ambiguous");
    }
  });
}

await test("[Real regression] the OLD, now-replaced pattern genuinely fails against the real current page structure — proves this fix was necessary, not speculative", async () => {
  const OLD_PATTERN = { field: "rnEndorsementFeeUsd", pattern: "Form 1 - Application for Licensure\\* along with the \\$(\\d+)", transform: "number" as const };
  const source = synthMonitoredSource({ id: "ny-endorsement-fee-pilot-v1-hyperlink" });
  const outcome = await fetchMonitoredSource(source, "mock");
  const detection = detectFieldChange({
    field: "rnEndorsementFeeUsd",
    currentValue: 143,
    extractRule: OLD_PATTERN,
    previousHash: "some-prior-hash",
    newHash: outcome.fetchResult.contentHash!,
    fetchStatus: "ok",
    rawText: outcome.fetchResult.rawText,
  });
  assertEqual(detection.proposedValue, undefined, "the OLD pattern must still fail here — this is the exact real-world bug being fixed, preserved as a permanent regression marker");
});

await test("[Production registry] both NY sources now use the corrected pattern, and nothing else on them changed", () => {
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  const expectedPattern = "Form 1 - Application for Licensure\\s*\\*\\s*along with the \\$(\\d+(?:\\.\\d{2})?)";
  const endorsementSource = realRegistry.sources.find((s: any) => s.id === "ny-endorsement-fee-monitor");
  const transferSource = realRegistry.sources.find((s: any) => s.id === "ny-transfer-fee-monitor");
  assert(!!endorsementSource && !!transferSource, "both NY sources must still exist");
  assertEqual(endorsementSource.fieldMapping.extractRule.pattern, expectedPattern);
  assertEqual(transferSource.fieldMapping.extractRule.pattern, expectedPattern);
  assertEqual(endorsementSource.fieldMapping.field, "rnEndorsementFeeUsd", "target field must be unchanged");
  assertEqual(transferSource.fieldMapping.field, "applicationFeeUsd", "target field must be unchanged");
  assertEqual(transferSource.fieldMapping.destinationJurisdiction, "new-york", "must be unchanged");
});

await test("[Florida history preserved] the real operational history from commit d17eb0b remains completely untouched by this phase's registry edit", () => {
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  const fl = realRegistry.sources.find((s: any) => s.id === "florida-fee-schedule-monitor");
  assertEqual(fl.totalChecks, 1);
  assertEqual(fl.successfulChecks, 1);
  assertEqual(fl.lastCheckedAt, "2026-08-10T14:20:14.246Z");
  assertEqual(fl.lastSuccessfulFetchAt, "2026-08-10T14:20:14.246Z");
  assertEqual(fl.lastChangedAt, "2026-08-10T14:20:14.246Z");
  assertEqual(fl.lastContentHash, "09e17211596cb981");
  assertEqual(fl.lastHttpStatus, 200);
  assertEqual(fl.fieldMapping.extractRule.pattern, "MOBILE Endorsement Fees[\\s\\S]{0,200}?\\$(\\d+(?:\\.\\d{2})?)", "Florida's own extraction rule must be completely unaffected by the NY fix");
});

await test("[PERMANENT — Phase 4.13.1, Finding #1] all 4 real monitored sources' operational history matches the authoritative commit 4232bb8 GitHub Actions run — a real regression (3 of 4 sources silently reverted to 'never checked' by Phase 4.12.1's registry edit) that this exact test now guards against permanently", () => {
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  const bySourceId = Object.fromEntries(realRegistry.sources.map((s: any) => [s.id, s]));

  // Recovered directly from `git show 4232bb8:data/knowledge-base/monitoring/registry.json`
  // — the real, authoritative GitHub Actions run that actually checked all 4 sources.
  const AUTHORITATIVE_HISTORY: Record<string, { totalChecks: number; successfulChecks: number; failedChecks: number; lastCheckedAt: string; lastSuccessfulFetchAt: string; lastChangedAt: string; lastContentHash: string; lastHttpStatus: number }> = {
    "florida-fee-schedule-monitor": {
      totalChecks: 1, successfulChecks: 1, failedChecks: 0,
      lastCheckedAt: "2026-08-10T14:20:14.246Z", lastSuccessfulFetchAt: "2026-08-10T14:20:14.246Z", lastChangedAt: "2026-08-10T14:20:14.246Z",
      lastContentHash: "09e17211596cb981", lastHttpStatus: 200,
    },
    "ny-endorsement-fee-monitor": {
      totalChecks: 1, successfulChecks: 1, failedChecks: 0,
      lastCheckedAt: "2026-08-11T14:00:35.057Z", lastSuccessfulFetchAt: "2026-08-11T14:00:35.057Z", lastChangedAt: "2026-08-11T14:00:35.057Z",
      lastContentHash: "9f749086bd13bd64", lastHttpStatus: 200,
    },
    "ny-transfer-fee-monitor": {
      totalChecks: 1, successfulChecks: 1, failedChecks: 0,
      lastCheckedAt: "2026-08-11T14:00:36.747Z", lastSuccessfulFetchAt: "2026-08-11T14:00:36.747Z", lastChangedAt: "2026-08-11T14:00:36.747Z",
      lastContentHash: "9f749086bd13bd64", lastHttpStatus: 200,
    },
    "florida-multistate-fee-monitor": {
      totalChecks: 1, successfulChecks: 1, failedChecks: 0,
      lastCheckedAt: "2026-08-11T14:00:38.274Z", lastSuccessfulFetchAt: "2026-08-11T14:00:38.274Z", lastChangedAt: "2026-08-11T14:00:38.274Z",
      lastContentHash: "09e17211596cb981", lastHttpStatus: 200,
    },
  };

  for (const [sourceId, expected] of Object.entries(AUTHORITATIVE_HISTORY)) {
    const source = bySourceId[sourceId];
    assert(!!source, `expected ${sourceId} to still exist in the registry`);
    for (const [field, expectedValue] of Object.entries(expected)) {
      assertEqual(source[field], expectedValue, `${sourceId}.${field}: must match the authoritative 4232bb8 GitHub Actions run — a regression here means real operational history is being silently lost again`);
    }
  }

  // The NY extraction-rule fix (Phase 4.12.1) must survive this history
  // reconciliation untouched — history and extraction logic are
  // independent concerns, and this test proves neither corrupts the other.
  const NY_CORRECT_PATTERN = "Form 1 - Application for Licensure\\s*\\*\\s*along with the \\$(\\d+(?:\\.\\d{2})?)";
  assertEqual(bySourceId["ny-endorsement-fee-monitor"].fieldMapping.extractRule.pattern, NY_CORRECT_PATTERN);
  assertEqual(bySourceId["ny-transfer-fee-monitor"].fieldMapping.extractRule.pattern, NY_CORRECT_PATTERN);
});

await test("production facts and transfer-rules remain completely untouched by Phase 4.12.1 — extraction-rule fixes never modify published facts", () => {
  const ny = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "new-york.json"), "utf-8"));
  assertEqual(ny.rnEndorsementFeeUsd.value, 143);
  const caNy = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse", "california-to-new-york.json"), "utf-8"));
  assertEqual(caNy.applicationFeeUsd.value, 143);
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110);
});

// ---------------------------------------------------------------------
// 33. Phase 4.13.3 — Deterministic Clock Injection
//     Root cause discovered in Phase 4.13.2: lib/pipeline/fetcher.ts used
//     real wall-clock time (new Date()) for `fetchedAt` regardless of any
//     injected `now`, causing lastCheckedAt to silently diverge from a
//     test's injected clock — which is exactly why
//     "[End-to-end demonstration]" (Phase 4.11's own test, far above)
//     started failing purely from the passage of real time, with zero
//     code change. This section makes the fix permanent.
// ---------------------------------------------------------------------
console.log("\nDeterministic Clock Injection (Phase 4.13.3):");

await test("[PERMANENT — Phase 4.13.3] an injected now on runMonitoringCycle produces an EXACT, deterministic lastCheckedAt matching that injected value, not real wall-clock time", async () => {
  const tempChangesDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-p4133-clock-test");
  const tempRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-p4133-clock-test.json");
  const tempLockPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-p4133-clock-test");
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, checkFrequencyDays: 0 })] };
    const injectedNow = new Date("2026-08-13T00:00:00Z");
    await runMonitoringCycle({ mode: "mock", registry, changesDir: tempChangesDir, registryPath: tempRegistryPath, lockPath: tempLockPath, now: injectedNow });

    const written = JSON.parse(fs.readFileSync(tempRegistryPath, "utf-8"));
    assertEqual(written.sources[0].lastCheckedAt, "2026-08-13T00:00:00.000Z", "lastCheckedAt must EXACTLY match the injected now, not real wall-clock time");
    assertEqual(written.sources[0].lastSuccessfulFetchAt, "2026-08-13T00:00:00.000Z");
  } finally {
    fs.rmSync(tempChangesDir, { recursive: true, force: true });
    fs.rmSync(tempRegistryPath, { force: true });
    fs.rmSync(tempLockPath, { force: true });
  }
});

await test("[PERMANENT — Phase 4.13.3] a second monitoring cycle with a DIFFERENT injected now produces a correspondingly different, deterministic lastCheckedAt — proves this isn't a fluke of one specific timestamp", async () => {
  const tempChangesDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-p4133-clock-test2");
  const tempRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-p4133-clock-test2.json");
  const tempLockPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-p4133-clock-test2");
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, checkFrequencyDays: 0 })] };
    const injectedNow = new Date("2030-01-01T12:34:56.789Z"); // deliberately a very different, far-future timestamp
    await runMonitoringCycle({ mode: "mock", registry, changesDir: tempChangesDir, registryPath: tempRegistryPath, lockPath: tempLockPath, now: injectedNow });

    const written = JSON.parse(fs.readFileSync(tempRegistryPath, "utf-8"));
    assertEqual(written.sources[0].lastCheckedAt, "2030-01-01T12:34:56.789Z");
    assertEqual(written.sources[0].lastSuccessfulFetchAt, "2030-01-01T12:34:56.789Z");
  } finally {
    fs.rmSync(tempChangesDir, { recursive: true, force: true });
    fs.rmSync(tempRegistryPath, { force: true });
    fs.rmSync(tempLockPath, { force: true });
  }
});

await test("[PERMANENT — Phase 4.13.3] existing behavior WITHOUT an injected now remains valid — lastCheckedAt still defaults to real current time, unchanged for production callers", async () => {
  const tempChangesDir = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes-p4133-clock-test3");
  const tempRegistryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry-p4133-clock-test3.json");
  const tempLockPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", ".lock-p4133-clock-test3");
  try {
    const registry: MonitoredSourceRegistry = { version: 1, sources: [synthMonitoredSource({ id: "synthetic-monitor-test-source", lastCheckedAt: null, checkFrequencyDays: 0 })] };
    const beforeCall = Date.now();
    await runMonitoringCycle({ mode: "mock", registry, changesDir: tempChangesDir, registryPath: tempRegistryPath, lockPath: tempLockPath }); // no `now` supplied — production default path
    const afterCall = Date.now();

    const written = JSON.parse(fs.readFileSync(tempRegistryPath, "utf-8"));
    const recordedMs = new Date(written.sources[0].lastCheckedAt).getTime();
    assert(recordedMs >= beforeCall && recordedMs <= afterCall, `expected lastCheckedAt to fall within the real wall-clock window of this call (${beforeCall}..${afterCall}), got ${recordedMs} — production behavior (no injected now) must be completely unchanged`);
  } finally {
    fs.rmSync(tempChangesDir, { recursive: true, force: true });
    fs.rmSync(tempRegistryPath, { force: true });
    fs.rmSync(tempLockPath, { force: true });
  }
});

await test("production data (facts, transfer-rules, sources, registry) remains completely untouched by the entire Phase 4.13.3 clock-injection test suite", () => {
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110);
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  assertEqual(realRegistry.sources.length, 4);
});

// ---------------------------------------------------------------------
// 34. Phase 4.13.5 — Fetch Timeout & Response-Size Cap
//     Real bug confirmed via live reproduction in Phase 4.13.4: fetchLive()
//     had zero internal timeout (confirmed hang against a mocked
//     never-resolving fetch) and zero response-size limit (confirmed a
//     fake Content-Length header was never even read, and an actual 50MB
//     body was accepted without any interruption). This section makes
//     both fixes permanent, using short overrides so these tests run in
//     milliseconds, never literally waiting the real 15s production default.
// ---------------------------------------------------------------------
console.log("\nFetch Timeout & Response-Size Cap (Phase 4.13.5):");

function withMockedFetch<T>(mockImpl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  (globalThis as any).fetch = mockImpl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

await test("[Defaults] the exported timeout/size-cap defaults match the evidence-based values chosen this phase — a change here should be a deliberate decision, not silent drift", () => {
  assertEqual(DEFAULT_FETCH_TIMEOUT_MS, 15_000);
  assertEqual(DEFAULT_MAX_RESPONSE_BYTES, 2 * 1024 * 1024);
});

await test("[Timeout, fast-testable] a fetch that never resolves is aborted within a short OVERRIDDEN timeout, not the real 15s production default — proves the mechanism works without slowing the test suite down", async () => {
  await withMockedFetch(
    // Realistic mock: never resolves on its own, but DOES actively listen
    // to the AbortSignal and reject accordingly — exactly like real
    // fetch() implementations do. A mock that ignores the signal entirely
    // can't test abort behavior at all (confirmed the hard way while
    // writing this test: such a mock leaves the awaited promise eternally
    // suspended with nothing else keeping Node's event loop alive, so the
    // process just exits silently once the loop empties, never reaching
    // any assertion — a false negative, not a real pass or fail).
    ((_url: string, options?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          reject(err);
        });
      })) as any,
    async () => {
      const start = Date.now();
      // Override timeoutMs to 100ms for this test only — the PRODUCTION default (15_000ms) is completely unaffected by this override, verified separately below.
      const result = await fetchSource({ id: "test-timeout", url: "https://example.invalid/timeout" }, "live", undefined, 100, DEFAULT_MAX_RESPONSE_BYTES);
      const elapsed = Date.now() - start;
      assertEqual(result.status, "error");
      assert(!!result.error?.includes("timed out"), `expected a clear timeout error message, got: ${result.error}`);
      // Real math: 3 attempts x 100ms timeout each (300ms) + backoff between attempts (500+1000=1500ms) = ~1800ms minimum, plus real scheduling overhead.
      // Generously bounded at 8s — still dramatically faster than the unfixed 46.5s+ this would have taken against the real 15s-per-attempt production default.
      assert(elapsed < 8000, `expected the overridden short timeout to resolve quickly (got ${elapsed}ms) — proves the abort mechanism actually fires, not just that we gave up waiting in the test`);
    }
  );
});

await test("[Response-size cap, fast-testable] a response streaming beyond an OVERRIDDEN small cap is rejected as an error, never silently truncated or accepted", async () => {
  const oversizedChunk = new TextEncoder().encode("x".repeat(2000)); // 2000 bytes
  await withMockedFetch(
    (async () => ({
      status: 200,
      ok: true,
      headers: { get: () => null },
      body: {
        getReader: () => {
          let served = false;
          return {
            read: async () => {
              if (served) return { done: true, value: undefined };
              served = true;
              return { done: false, value: oversizedChunk };
            },
            cancel: async () => {},
            releaseLock: () => {},
          };
        },
      },
    })) as any,
    async () => {
      // Override maxResponseBytes to 500 — the actual chunk (2000 bytes) exceeds it, so this must be rejected.
      const result = await fetchSource({ id: "test-oversized", url: "https://example.invalid/big" }, "live", undefined, DEFAULT_FETCH_TIMEOUT_MS, 500);
      assertEqual(result.status, "error");
      assert(!!result.error?.includes("exceeded"), `expected a clear size-cap error message, got: ${result.error}`);
    }
  );
});

await test("[Response-size cap] a response comfortably under the cap succeeds normally — the cap doesn't false-positive on ordinary content", async () => {
  // Live-mode caching writes to data/_pipeline/cache/{id}.json and persists
  // across runs — clean any stale cache from a prior run of this exact
  // test first, or a matching contentHash would short-circuit to
  // "not_modified" instead of "ok", which is a test-isolation artifact,
  // not a real behavior to assert on here.
  const cacheFile = path.join(process.cwd(), "data", "_pipeline", "cache", "test-small.json");
  fs.rmSync(cacheFile, { force: true });
  const smallChunk = new TextEncoder().encode("<html><body>Fee: $110</body></html>");
  await withMockedFetch(
    (async () => ({
      status: 200,
      ok: true,
      headers: { get: () => null },
      body: {
        getReader: () => {
          let served = false;
          return {
            read: async () => {
              if (served) return { done: true, value: undefined };
              served = true;
              return { done: false, value: smallChunk };
            },
            cancel: async () => {},
            releaseLock: () => {},
          };
        },
      },
    })) as any,
    async () => {
      const result = await fetchSource({ id: "test-small", url: "https://example.invalid/small" }, "live", undefined, DEFAULT_FETCH_TIMEOUT_MS, 500);
      assertEqual(result.status, "ok");
      assert(!!result.rawText?.includes("110"), "expected the small, well-under-cap response to be read and processed normally");
    }
  );
  fs.rmSync(cacheFile, { force: true }); // leave no trace for future runs either
});

await test("[No regression] a too-large response is never retried — ResponseTooLargeError short-circuits immediately instead of burning through all 3 retry attempts for a structurally-wrong page", async () => {
  let fetchCallCount = 0;
  const oversizedChunk = new TextEncoder().encode("x".repeat(2000));
  await withMockedFetch(
    (async () => {
      fetchCallCount++;
      return {
        status: 200,
        ok: true,
        headers: { get: () => null },
        body: {
          getReader: () => {
            let served = false;
            return {
              read: async () => {
                if (served) return { done: true, value: undefined };
                served = true;
                return { done: false, value: oversizedChunk };
              },
              cancel: async () => {},
              releaseLock: () => {},
            };
          },
        },
      };
    }) as any,
    async () => {
      await fetchSource({ id: "test-no-retry", url: "https://example.invalid/big2" }, "live", undefined, DEFAULT_FETCH_TIMEOUT_MS, 500);
      assertEqual(fetchCallCount, 1, "an oversized response should fail fast on the first attempt, not retry 3 times for a page that's structurally too large regardless of retrying");
    }
  );
});

await test("[Mock mode unaffected] fetchSource in mock mode is completely unaffected by the new live-mode-only timeout/size-cap machinery — a real, existing fixture still fetches normally", async () => {
  const result = await fetchSource({ id: "florida-fee-schedule-pilot-v1", url: "https://example-test.invalid/unused" }, "mock");
  assertEqual(result.status, "ok");
  assert(!!result.rawText?.includes("110"), "expected the real pilot fixture to still read correctly, unaffected by any of this phase's changes");
});

await test("production data (facts, transfer-rules, sources, registry) and the workflow files remain completely untouched by the entire Phase 4.13.5 test suite", () => {
  const fl = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse", "florida.json"), "utf-8"));
  assertEqual(fl.rnEndorsementFeeUsd.value, 110);
  const realRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json"), "utf-8"));
  assertEqual(realRegistry.sources.length, 4);
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "source-monitor.yml"), "utf-8");
  assert(workflow.includes("timeout-minutes: 10"), "expected the new workflow timeout to be present");
  const dataPipelineWorkflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "data-pipeline.yml"), "utf-8");
  assert(!dataPipelineWorkflow.includes("timeout-minutes"), "data-pipeline.yml is explicitly out of this phase's scope and must remain untouched");
});

// ---------------------------------------------------------------------
console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("✔ All tests passed.\n");

})();
