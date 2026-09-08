/**
 * scripts/monitoring/phase4-electrician-watch-test.ts
 *
 * Phase 4 — extends the read-only official-source watch (proven in Phase
 * 3.3-3.7 for Washington) to Texas, Minnesota, and Wyoming electrician
 * reciprocity fees. Same structural guarantee as the Washington POC test:
 * zero import of decide(), evaluateForPersistence(),
 * applyAndPersistAutomated(), or the kill switch anywhere in this file or
 * in read-only-watch.ts.
 *
 * Also demonstrates (Case E) that a known-blocked state (Colorado, whose
 * live source returns HTTP 403 and has no fixture registered here) is
 * correctly reported as SOURCE_UNAVAILABLE rather than silently treated as
 * NO_CHANGE — proof that the monitoring gap for blocked states fails safe.
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

interface StateCase {
  label: string;
  sourceId: string;
  url: string;
  extractRule: ExtractRule;
  baseline: number;
  changedValue: number;
}

const STATE_CASES: StateCase[] = [
  {
    label: "Texas",
    sourceId: "tx-tdlr-electrician-reciprocity-fee",
    url: "https://www.tdlr.texas.gov/electricians/out-of-state.htm",
    extractRule: { field: "masterElectricianReciprocityLicenseFeeUsd", pattern: "License fee of \\$(\\d+\\.\\d{2})", transform: "number" },
    baseline: 45.0,
    changedValue: 99,
  },
  {
    label: "Minnesota",
    sourceId: "mn-dli-electrician-reciprocity-fee",
    url: "https://www.dli.mn.gov/workers/electrician-or-electrical-installer/electrical-license-reciprocity",
    extractRule: { field: "electricianReciprocityApplicationFeeUsd", pattern: "application and examination fee of \\$(\\d+)", transform: "number" },
    baseline: 50,
    changedValue: 75,
  },
  {
    label: "Wyoming",
    sourceId: "wy-electrician-journeyman-reciprocal-fee",
    url: "https://wsfm.wyo.gov/electrical-safety/licensing",
    extractRule: { field: "journeymanElectricianReciprocalLicenseFeeUsd", pattern: "Journeyman:\\s*(\\d+\\.\\d{2})", transform: "number" },
    baseline: 100.0,
    changedValue: 150,
  },
];

console.log("PHASE 4 — ELECTRICIAN MULTI-STATE READ-ONLY WATCH\n" + "=".repeat(60));
const hashBefore = hashProductionState();
console.log(`\nProduction-state hash BEFORE: ${hashBefore.slice(0, 16)}...`);

async function main() {
  for (const c of STATE_CASES) {
    console.log(`\n--- ${c.label} (${c.sourceId}) ---`);

    console.log(`[NO_CHANGE] real baseline fixture, expected value = ${c.baseline}`);
    {
      const result = await watchOfficialSource(c.sourceId, c.url, c.extractRule, c.baseline, "mock");
      console.log(`  type=${result.type} newValue=${result.newValue}`);
      assertEqual(result.type, "NO_CHANGE", `${c.label}: unchanged real value must report NO_CHANGE`);
      assertEqual(result.newValue, c.baseline, `${c.label}: extracted value must match baseline exactly`);
    }

    console.log(`[CHANGE_DETECTED] synthetic fixture, differs from ${c.baseline}`);
    {
      const result = await watchOfficialSource(`${c.sourceId}-changed`, `${c.url}#synthetic-test-only`, c.extractRule, c.baseline, "mock");
      console.log(`  type=${result.type} oldValue=${result.oldValue} newValue=${result.newValue}`);
      assertEqual(result.type, "CHANGE_DETECTED", `${c.label}: differing value must report CHANGE_DETECTED`);
      assertEqual(result.oldValue, c.baseline, `${c.label}: oldValue must be the known baseline`);
      assertEqual(result.newValue, c.changedValue, `${c.label}: newValue must be the extracted synthetic value`);
      assertEqual(typeof result.evidence, "string", `${c.label}: evidence text must be included`);
      assertEqual((result.evidence?.length ?? 0) > 0, true, `${c.label}: evidence must be non-empty`);
    }

    console.log(`[FALSE_POSITIVE_PROTECTION] unrelated content changed, fee unchanged`);
    {
      const result = await watchOfficialSource(`${c.sourceId}-unrelated-change`, `${c.url}#synthetic-test-only`, c.extractRule, c.baseline, "mock");
      console.log(`  type=${result.type} newValue=${result.newValue}`);
      assertEqual(result.type, "NO_CHANGE", `${c.label}: unrelated content change with unchanged fee must still report NO_CHANGE`);
    }
  }

  // --- Case: SOURCE_UNAVAILABLE for a known-blocked state ---
  // Colorado's registered electrician source (dpo.colorado.gov/Electrical/Applications)
  // returned HTTP 403 on every live check performed during this phase's research —
  // it was deliberately NOT wired into any watch-*.ts script or the workflow matrix.
  // This proves that if it *were* attempted, the mechanism fails safe (reports
  // SOURCE_UNAVAILABLE) rather than fabricating a NO_CHANGE result from nothing.
  console.log(`\n--- Colorado (known-blocked gap state, no real watcher wired up) ---`);
  console.log("[SOURCE_UNAVAILABLE] no fixture registered — mirrors the real 403 gap");
  {
    const coloradoRule: ExtractRule = { field: "electricianApplicationFeeUsd", pattern: "License fee\\s+\\$(\\d+)", transform: "number" };
    const result = await watchOfficialSource("co-electrical-board-applications-BLOCKED", "https://dpo.colorado.gov/Electrical/Applications", coloradoRule, 0, "mock");
    console.log(`  type=${result.type} reason=${result.reason}`);
    assertEqual(result.type, "SOURCE_UNAVAILABLE", "Colorado: a blocked/unmonitored source must report SOURCE_UNAVAILABLE, never NO_CHANGE or CHANGE_DETECTED");
    assertEqual(result.oldValue, undefined, "Colorado: no oldValue must be reported on failure");
    assertEqual(result.newValue, undefined, "Colorado: no newValue must be reported on failure");
  }

  // --- Structural safety: this module and this test import nothing write-capable ---
  console.log("\n[Structural] Import-scan proof");
  for (const rel of ["lib/monitoring/read-only-watch.ts", "scripts/monitoring/phase4-electrician-watch-test.ts", "scripts/monitoring/watch-texas.ts", "scripts/monitoring/watch-minnesota.ts", "scripts/monitoring/watch-wyoming.ts"]) {
    const source = fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
    const importLines = source.split("\n").filter((l) => /^\s*import\s/.test(l));
    const hasWriteRef = importLines.some((l) => /decision-engine|safety-gate|automated-persistence|kill-switch|persistence-bridge|scheduler/.test(l));
    assertEqual(hasWriteRef, false, `Structural: ${rel} must import zero write/decision-capable modules`);
  }

  // --- Kill switch untouched ---
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
  console.log("✔ All Phase 4 electrician multi-state read-only monitoring tests passed.");
  console.log("\nMONITORING = READ_ONLY");
  console.log("KILL SWITCH = OFF | SCHEDULER = DISABLED | PRODUCTION MUTATION = DISABLED");
}

main();
