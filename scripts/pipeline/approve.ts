/**
 * scripts/pipeline/approve.ts
 *
 * Interactive CLI to review and resolve high-risk pending changes queued
 * by the pipeline (see lib/pipeline/update.ts). Every pending change shows
 * its full field-level diff before you decide.
 *
 * Usage: npm run pipeline:approve
 */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { listPendingChanges, resolvePendingChange } from "../../lib/pipeline/update";

async function main() {
  const pending = listPendingChanges();

  if (pending.length === 0) {
    console.log("✔ No pending changes awaiting approval.");
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log(`\n${pending.length} change(s) awaiting approval.\n`);

  for (const change of pending) {
    console.log("──────────────────────────────────────────");
    console.log(`${change.diff.entityKind}/${change.diff.entitySlug}  (source: ${change.diff.sourceId})`);
    console.log(`queued: ${change.createdAt}\n`);
    for (const field of change.diff.changes) {
      console.log(`  [${field.risk.toUpperCase()}] ${field.path}: ${JSON.stringify(field.before)} → ${JSON.stringify(field.after)}`);
    }

    const answer = (await rl.question("\nApprove this change? (y/N/skip): ")).trim().toLowerCase();

    if (answer === "y" || answer === "yes") {
      resolvePendingChange(change.id, "approved");
      console.log("  ✅ approved and written to /data.\n");
    } else if (answer === "skip" || answer === "") {
      console.log("  ⏭ left pending for later.\n");
    } else {
      resolvePendingChange(change.id, "rejected");
      console.log("  ❌ rejected.\n");
    }
  }

  rl.close();
  console.log("Done. Run `npm run generate-transfers && npm run validate-data` if you approved anything.");
}

main().catch((err) => {
  console.error("Approval session failed:", err);
  process.exit(1);
});
