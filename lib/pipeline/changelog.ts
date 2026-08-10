/**
 * lib/pipeline/changelog.ts
 *
 * Every pipeline run writes a dated, human-readable Markdown report plus a
 * machine-readable JSON report to data/_pipeline/changelog/. This is the
 * audit trail: what changed, from which source, when, and whether it was
 * auto-applied or is waiting on a human.
 */
import fs from "node:fs";
import path from "node:path";
import type { DiffResult, PipelineRunSummary } from "./types";

const CHANGELOG_DIR = path.join(process.cwd(), "data", "_pipeline", "changelog");

function riskEmoji(risk: string | null): string {
  if (risk === "high") return "🔴";
  if (risk === "medium") return "🟡";
  if (risk === "low") return "🟢";
  return "⚪";
}

export function writeRunChangelog(
  runId: string,
  summary: PipelineRunSummary,
  appliedDiffs: DiffResult[],
  pendingDiffs: DiffResult[]
): { mdPath: string; jsonPath: string } {
  fs.mkdirSync(CHANGELOG_DIR, { recursive: true });

  const jsonPath = path.join(CHANGELOG_DIR, `${runId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, appliedDiffs, pendingDiffs }, null, 2));

  const lines: string[] = [];
  lines.push(`# Pipeline Run ${runId}`);
  lines.push("");
  lines.push(`- **Mode**: ${summary.mode}`);
  lines.push(`- **Started**: ${summary.startedAt}`);
  lines.push(`- **Finished**: ${summary.finishedAt}`);
  lines.push(`- **Sources checked**: ${summary.sourcesChecked} (${summary.fetchErrors} fetch errors)`);
  lines.push(`- **Records extracted**: ${summary.recordsExtracted}`);
  lines.push(`- **Validation errors**: ${summary.validationErrors}`);
  lines.push(`- **Auto-applied changes**: ${summary.changesAutoApplied}`);
  lines.push(`- **Pending manual approval**: ${summary.changesPendingApproval}`);
  lines.push(`- **Transfer rules regenerated**: ${summary.transfersRegenerated}`);
  lines.push(`- **Search index documents**: ${summary.searchIndexDocuments}`);
  lines.push("");

  if (appliedDiffs.length > 0) {
    lines.push("## ✅ Auto-Applied Changes");
    lines.push("");
    for (const diff of appliedDiffs) {
      lines.push(`### ${diff.entityKind}/${diff.entitySlug} — via \`${diff.sourceId}\``);
      for (const change of diff.changes) {
        lines.push(`- ${riskEmoji(change.risk)} \`${change.path}\`: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`);
      }
      lines.push("");
    }
  }

  if (pendingDiffs.length > 0) {
    lines.push("## ⏳ Pending Manual Approval");
    lines.push("");
    lines.push("Run `npm run pipeline:approve` to review these interactively.");
    lines.push("");
    for (const diff of pendingDiffs) {
      lines.push(`### ${diff.entityKind}/${diff.entitySlug} — via \`${diff.sourceId}\``);
      for (const change of diff.changes) {
        lines.push(`- ${riskEmoji(change.risk)} \`${change.path}\`: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`);
      }
      lines.push("");
    }
  }

  if (appliedDiffs.length === 0 && pendingDiffs.length === 0) {
    lines.push("No changes detected in this run — every source matched current data.");
  }

  const mdPath = path.join(CHANGELOG_DIR, `${runId}.md`);
  fs.writeFileSync(mdPath, lines.join("\n"));

  return { mdPath, jsonPath };
}
