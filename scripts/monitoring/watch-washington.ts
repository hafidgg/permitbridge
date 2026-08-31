/**
 * scripts/monitoring/watch-washington.ts
 *
 * Phase 3.4 — CLI entry point for the scheduled read-only watch.
 * Calls ONLY watchOfficialSource() (lib/monitoring/read-only-watch.ts).
 * Zero import of decide(), evaluateForPersistence(),
 * applyAndPersistAutomated(), the kill switch, or run.ts/scheduler.ts.
 *
 * STEP 4's critical safety rule: on CHANGE_DETECTED, this script prints
 * a clear, greppable report and exits with a distinct, non-zero-but-
 * non-crashing status the workflow can surface — it never calls any
 * further pipeline stage itself. A human runs the existing
 * verification/approval workflow (scripts/monitoring/review.ts)
 * separately, manually, afterward.
 */
import { watchOfficialSource } from "../../lib/monitoring/read-only-watch";
import type { ExtractRule } from "../../lib/pipeline/types";

const EXTRACT_RULE: ExtractRule = {
  field: "generalContractorLicenseFeeUsd",
  pattern: "Initial application or renewal made in person, by mail, or by fax\\s+\\$(\\d+(?:\\.\\d{2})?)",
  transform: "number",
};

const KNOWN_BASELINE = 353.9; // WAC 296-46B-909, confirmed live in Phase 3.2V/3.2W

async function main() {
  const mode = process.argv.includes("--mode=mock") ? "mock" : "live";
  const result = await watchOfficialSource(
    "wa-electrical-contractor-license-fee",
    "https://lawfilesext.leg.wa.gov/Law/WAC/WAC%20296%20%20TITLE/WAC%20296%20-%2046B%20CHAPTER/WAC%20296%20-%2046B-909.htm",
    EXTRACT_RULE,
    KNOWN_BASELINE,
    mode
  );

  console.log(`RESULT: ${result.type}`);
  console.log(`Source: ${result.source}`);
  console.log(`Detected at: ${result.detectedAt}`);

  if (result.type === "NO_CHANGE") {
    console.log(`Value confirmed unchanged: ${result.newValue}`);
    process.exit(0);
  }

  if (result.type === "SOURCE_UNAVAILABLE") {
    console.log(`::warning::Source unavailable — ${result.reason}`);
    console.log("No mutation attempted. No pipeline triggered. Safe exit.");
    process.exit(0); // a transient fetch failure is not itself a workflow failure — it's logged and will retry on the next scheduled run
  }

  if (result.type === "CHANGE_DETECTED") {
    console.log("::warning::CHANGE_DETECTED — official value differs from the known baseline.");
    console.log(`  Previous value: ${result.oldValue}`);
    console.log(`  New value:      ${result.newValue}`);
    console.log(`  Evidence:       ${result.evidence}`);
    console.log("");
    console.log("NO automatic action was taken. NO production data was modified.");
    console.log("A human must review this and start the existing verification/approval workflow manually:");
    console.log("  npm run monitor:review");
    process.exit(0); // observable alert only, per Step 4 — not a hard failure, so it doesn't mask itself as an infra error
  }
}

main();
