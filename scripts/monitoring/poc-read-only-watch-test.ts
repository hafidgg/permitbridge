/**
 * scripts/monitoring/poc-read-only-watch-test.ts
 *
 * Phase 3.3 — READ-ONLY monitoring test.
 *
 * Zero import of decide(), evaluateForPersistence(),
 * applyAndPersistAutomated(), or the kill switch anywhere in this file
 * or in read-only-watch.ts.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { watchOfficialSource } from "../../lib/monitoring/read-only-watch";
import type { ExtractRule } from "../../lib/pipeline/types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else {
    failed++;
    failures.push(`${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

function hashProductionState(): string {
  const registryPath = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "registry.json");
  const factsDir = path.join(process.cwd(), "data", "knowledge-base", "facts");
  const parts: string[] = [fs.readFileSync(registryPath, "utf-8")];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) parts.push(fs.readFileSync(full, "utf-8"));
    }
  }
  walk(factsDir);
  return crypto.createHash("sha256").update(parts.join("\n---\n")).digest("hex");
}

const EXTRACT_RULE: ExtractRule = {
  field: "generalContractorLicenseFeeUsd",
  pattern: "Initial application or renewal made in person, by mail, or by fax\\s+\\$(\\d+(?:\\.\\d{2})?)",
  transform: "number",
};

console.log("PHASE 3.3 — READ-ONLY OFFICIAL SOURCE MONITORING\n" + "=".repeat(60));
const hashBefore = hashProductionState();
console.log(`\nProduction-state hash BEFORE: ${hashBefore.slice(0, 16)}...`);

async function main() {
  // --- Case A: NO_CHANGE ---
  console.log("\n[Case A] NO_CHANGE — real baseline fixture, live value = $353.90");
  {
    const result = await watchOfficialSource("wa-electrical-contractor-license-fee", "https://lawfilesext.leg.wa.gov/Law/WAC/WAC%20296%20%20TITLE/WAC%20296%20-%2046B%20CHAPTER/WAC%20296%20-%2046B-909.htm", EXTRACT_RULE, 353.9, "mock");
    console.log(`  type=${result.type} newValue=${result.newValue}`);
    assertEqual(result.type, "NO_CHANGE", "Case A: unchanged real value must report NO_CHANGE");
    assertEqual(result.newValue, 353.9, "Case A: extracted value must match baseline exactly");
  }

  // --- Case B: CHANGE_DETECTED ---
  console.log("\n[Case B] CHANGE_DETECTED — synthetic fixture, differs from $353.90");
  {
    const result = await watchOfficialSource("wa-electrical-contractor-license-fee-changed", "https://lawfilesext.leg.wa.gov/synthetic-test-only", EXTRACT_RULE, 353.9, "mock");
    console.log(`  type=${result.type} oldValue=${result.oldValue} newValue=${result.newValue}`);
    assertEqual(result.type, "CHANGE_DETECTED", "Case B: differing value must report CHANGE_DETECTED");
    assertEqual(result.oldValue, 353.9, "Case B: oldValue must be the known baseline");
    assertEqual(result.newValue, 375, "Case B: newValue must be the extracted synthetic value");
    assertEqual(typeof result.evidence, "string", "Case B: evidence text must be included");
    assertEqual((result.evidence?.length ?? 0) > 0, true, "Case B: evidence must be non-empty");
  }

  // --- Case C: SOURCE_UNAVAILABLE ---
  console.log("\n[Case C] SOURCE_UNAVAILABLE — no fixture exists for this source id");
  {
    const result = await watchOfficialSource("wa-nonexistent-source-phase33", "https://lawfilesext.leg.wa.gov/does-not-exist", EXTRACT_RULE, 353.9, "mock");
    console.log(`  type=${result.type} reason=${result.reason}`);
    assertEqual(result.type, "SOURCE_UNAVAILABLE", "Case C: missing fixture must report SOURCE_UNAVAILABLE, never NO_CHANGE or CHANGE_DETECTED");
    assertEqual(result.oldValue, undefined, "Case C: no oldValue must be reported on failure");
    assertEqual(result.newValue, undefined, "Case C: no newValue must be reported on failure");
  }

  // --- Case D: FALSE_POSITIVE_PROTECTION ---
  console.log("\n[Case D] FALSE_POSITIVE_PROTECTION — unrelated content changed, fee unchanged");
  {
    const result = await watchOfficialSource("wa-electrical-contractor-license-fee-unrelated-change", "https://lawfilesext.leg.wa.gov/synthetic-test-only", EXTRACT_RULE, 353.9, "mock");
    console.log(`  type=${result.type} newValue=${result.newValue}`);
    assertEqual(result.type, "NO_CHANGE", "Case D: unrelated content change with unchanged fee must still report NO_CHANGE");
  }

  // --- Structural safety: this module and this test import nothing write-capable ---
  console.log("\n[Structural] Import-scan proof");
  for (const rel of ["lib/monitoring/read-only-watch.ts", "scripts/monitoring/poc-read-only-watch-test.ts"]) {
    const source = fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
    const importLines = source.split("\n").filter((l) => /^\s*import\s/.test(l));
    const hasWriteRef = importLines.some((l) => /decision-engine|safety-gate|automated-persistence|kill-switch|persistence-bridge|scheduler/.test(l));
    assertEqual(hasWriteRef, false, `Structural: ${rel} must import zero write/decision-capable modules`);
  }

  // --- Kill switch and scheduler untouched ---
  const killSwitchStillOff = process.env.AUTO_UPDATE_ENABLED !== "true";
  assertEqual(killSwitchStillOff, true, "Kill switch must remain OFF throughout this entire read-only phase");

  const hashAfter = hashProductionState();
  console.log(`\nProduction-state hash AFTER: ${hashAfter.slice(0, 16)}...`);
  assertEqual(hashAfter, hashBefore, "Production facts data must be byte-identical before and after");

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  if (failed > 0) {
    console.log("\nFAILURES:");
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log("✔ All Phase 3.3 read-only monitoring tests passed.");
  console.log("\nMONITORING = READ_ONLY");
  console.log("KILL SWITCH = OFF | SCHEDULER = DISABLED | PRODUCTION MUTATION = DISABLED");
}

main();
