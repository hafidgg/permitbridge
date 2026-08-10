/**
 * lib/knowledge-base/transfer-review-queue.ts
 *
 * Phase 3.2, Step 9 & 11: the machine-readable review queue (one item
 * per populated field across all 5 real transfer rules) and the
 * publication report (one row per rule). No numerical priority score —
 * per the explicit instruction, priority is the 3-value
 * High/Medium/Low derived directly from whether the field is critical.
 */
import fs from "node:fs";
import path from "node:path";
import type { TransferRule, TransferRuleFactFieldKey } from "@/types/transfer-rule";
import type { SourceRecord, VerifiedField } from "@/types/knowledge-base";
import {
  ALL_TRANSFER_RULE_FIELD_KEYS,
  isCriticalField,
  isTransferRulePublishable,
  classifyTransferRuleCoverage,
  getSecondarySourcedFields,
} from "./transfer-review";
import { loadAllSources } from "./sources";

export type ReviewPriority = "High" | "Medium" | "Low";

export interface TransferReviewQueueItem {
  transfer: string; // "sourceState-to-destinationState"
  field: string;
  currentValue: unknown;
  sourceTitle: string | null;
  sourceUrl: string | null;
  authority: "authoritative" | "supplementary" | "unresolved" | null;
  confidence: number;
  status: string;
  whyReviewNeeded: string;
  priority: ReviewPriority;
}

function priorityFor(fieldKey: string, authority: string | null): ReviewPriority {
  const critical = isCriticalField(fieldKey as TransferRuleFactFieldKey);
  if (critical) return "High";
  if (authority === "supplementary") return "Medium";
  return "Low";
}

function whyReviewNeeded(fieldKey: string, authority: string | null, isCritical: boolean): string {
  if (authority === "supplementary") {
    return isCritical
      ? "Critical field currently relies only on a secondary source — needs an authoritative source, then human review, before publication."
      : "Relies on a secondary (discovery-only) source — human review should confirm or seek an authoritative replacement.";
  }
  if (authority === "unresolved") {
    return "Source URL does not resolve to a registered SourceRecord — needs investigation before review.";
  }
  return isCritical
    ? "Critical field — no human has reviewed this AI-researched, authoritatively-sourced value yet."
    : "Supporting field — no human has reviewed this AI-researched value yet.";
}

export function buildTransferReviewQueue(): TransferReviewQueueItem[] {
  const dir = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse");
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);

  const queue: TransferReviewQueueItem[] = [];
  if (!fs.existsSync(dir)) return queue;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const rule: TransferRule = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    const transferLabel = `${rule.sourceState}-to-${rule.destinationState}`;

    for (const key of ALL_TRANSFER_RULE_FIELD_KEYS) {
      const field = rule[key] as VerifiedField<unknown>;
      if (field.value === "Unknown") continue; // nothing to review yet
      if (field.status === "verified") continue; // already human-reviewed — not queued again

      const source = field.sourceUrl ? resolveSource(field.sourceUrl) : undefined;
      const authority = source ? source.authorityLevel : "unresolved";
      const critical = isCriticalField(key);

      queue.push({
        transfer: transferLabel,
        field: key,
        currentValue: field.value,
        sourceTitle: field.sourceTitle,
        sourceUrl: field.sourceUrl,
        authority,
        confidence: field.confidence,
        status: field.status,
        whyReviewNeeded: whyReviewNeeded(key, authority, critical),
        priority: priorityFor(key, authority),
      });
    }
  }

  // High priority first, preserving stable order within each tier.
  const order: Record<ReviewPriority, number> = { High: 0, Medium: 1, Low: 2 };
  return queue.sort((a, b) => order[a.priority] - order[b.priority]);
}

export function writeTransferReviewQueue(): { jsonPath: string; count: number } {
  const queue = buildTransferReviewQueue();
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "transfer-review-queue.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalItems: queue.length,
        highPriority: queue.filter((i) => i.priority === "High").length,
        mediumPriority: queue.filter((i) => i.priority === "Medium").length,
        lowPriority: queue.filter((i) => i.priority === "Low").length,
        items: queue,
      },
      null,
      2
    )
  );
  return { jsonPath, count: queue.length };
}

// ---------------------------------------------------------------------
// Publication report (Step 11)
// ---------------------------------------------------------------------

export interface TransferPublicationReportRow {
  transfer: string;
  populatedFields: number;
  verifiedFields: number;
  pendingFields: number;
  unknownFields: number;
  secondarySourceFields: number;
  conflictingFields: number;
  publishable: boolean;
  coverageClass: string;
  blockingReasons: string[];
}

export function buildTransferPublicationReport(): TransferPublicationReportRow[] {
  const dir = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse");
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);
  const knownProfessions = new Set(["registered-nurse"]);

  const rows: TransferPublicationReportRow[] = [];
  if (!fs.existsSync(dir)) return rows;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const rule: TransferRule = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    const transferLabel = `${rule.sourceState}-to-${rule.destinationState}`;

    let populated = 0,
      verified = 0,
      pending = 0,
      unknown = 0,
      conflicting = 0;

    for (const key of ALL_TRANSFER_RULE_FIELD_KEYS) {
      const field = rule[key] as VerifiedField<unknown>;
      if (field.value === "Unknown") {
        unknown++;
        continue;
      }
      populated++;
      if (field.status === "verified") verified++;
      else if (field.status === "conflicting_sources") conflicting++;
      else pending++;
    }

    const secondaryCount = getSecondarySourcedFields(rule, resolveSource).length;
    const { publishable, blockingReasons } = isTransferRulePublishable(rule, resolveSource, knownProfessions);
    const coverageClass = classifyTransferRuleCoverage(rule, resolveSource, knownProfessions);

    rows.push({
      transfer: transferLabel,
      populatedFields: populated,
      verifiedFields: verified,
      pendingFields: pending,
      unknownFields: unknown,
      secondarySourceFields: secondaryCount,
      conflictingFields: conflicting,
      publishable,
      coverageClass,
      blockingReasons,
    });
  }

  return rows;
}

export function writeTransferPublicationReport(): { jsonPath: string; mdPath: string } {
  const rows = buildTransferPublicationReport();
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "transfer-publication-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));

  const lines: string[] = ["# Transfer Rule Publication Report (Phase 3.2)", ""];
  lines.push("| Transfer | Populated | Verified | Pending | Unknown | Secondary | Conflicting | Publishable | Coverage Class |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.transfer} | ${r.populatedFields} | ${r.verifiedFields} | ${r.pendingFields} | ${r.unknownFields} | ${r.secondarySourceFields} | ${r.conflictingFields} | ${r.publishable ? "✅" : "🔴"} | ${r.coverageClass} |`
    );
  }
  lines.push("");
  for (const r of rows) {
    if (r.blockingReasons.length > 0) {
      lines.push(`## Blocking reasons for ${r.transfer}`);
      for (const reason of r.blockingReasons) lines.push(`- ${reason}`);
      lines.push("");
    }
  }

  const mdPath = path.join(reportsDir, "transfer-publication-report.md");
  fs.writeFileSync(mdPath, lines.join("\n"));

  return { jsonPath, mdPath };
}
