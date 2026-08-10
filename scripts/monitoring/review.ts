/**
 * scripts/monitoring/review.ts
 * Usage: npm run monitor:review
 *
 * Interactive CLI, following the exact same pattern as
 * scripts/pipeline/approve.ts: walks every pending DetectedChange, shows
 * its full evidence, and asks for a reviewer name + decision. Every
 * decision goes through applyAndPersistReview() — the same safety
 * boundary (fabricated-reviewer rejection, staleness guard,
 * already-decided guard) applies identically whether this is run once or
 * a hundred times.
 */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { listDetectedChanges } from "../../lib/monitoring/change-record";
import { applyAndPersistReview } from "../../lib/monitoring/persistence";
import type { ReviewIntegrationAction } from "../../lib/monitoring/review-integration";

async function main() {
  const pending = listDetectedChanges().filter((c) => c.status === "pending_verification");

  if (pending.length === 0) {
    console.log("✔ No detected changes awaiting review.");
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log(`\n${pending.length} detected change(s) awaiting review.\n`);

  for (const change of pending) {
    console.log("──────────────────────────────────────────");
    console.log(`${change.classification}  (source: ${change.sourceId})`);
    console.log(`${change.jurisdiction}${change.destinationJurisdiction ? ` -> ${change.destinationJurisdiction}` : ""} / ${change.profession ?? "?"} / ${change.field ?? "(source-level)"}`);
    console.log(`${JSON.stringify(change.previousValue)} -> ${JSON.stringify(change.proposedValue)}`);
    console.log(`evidence: ${change.evidence.url}`);
    if (change.evidence.extractedText) console.log(`extracted text: "${change.evidence.extractedText}"`);
    console.log(`confidence: ${change.confidence}${change.jurisdictionMismatch ? "  ⚠ JURISDICTION MISMATCH" : ""}`);

    const actionAnswer = (
      await rl.question("\nAction? (approve/reject/research/unavailable/defer/skip): ")
    )
      .trim()
      .toLowerCase();

    if (actionAnswer === "skip" || actionAnswer === "") {
      console.log("  ⏭ skipped this run (still pending_verification, not logged as a decision).\n");
      continue;
    }

    const actionMap: Record<string, ReviewIntegrationAction> = {
      approve: "approve",
      reject: "reject",
      research: "request_research",
      unavailable: "mark_unavailable",
      defer: "defer",
    };
    const action = actionMap[actionAnswer];
    if (!action) {
      console.log(`  ⚠ unrecognized action "${actionAnswer}" — skipped.\n`);
      continue;
    }

    const reviewer = (await rl.question("Your name (required — never 'AI'/'Claude'/'system'): ")).trim();
    const reason = (await rl.question("Reason: ")).trim();

    try {
      const result = applyAndPersistReview({ changeId: change.id, action, reviewer, reason });
      if (result.success) {
        console.log(`  ✅ ${action} recorded.${result.productionFileWritten ? ` Production file updated: ${result.productionFilePath}` : ""}\n`);
      } else {
        console.log(`  ❌ refused: ${result.reason}\n`);
      }
    } catch (err) {
      console.log(`  ❌ error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  rl.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Review session failed:", err);
  process.exit(1);
});
