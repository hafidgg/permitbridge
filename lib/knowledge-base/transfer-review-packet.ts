/**
 * lib/knowledge-base/transfer-review-packet.ts
 *
 * Phase 3.2, Step 1 & 10: extends the Phase 2.3 review-packet pattern
 * (lib/knowledge-base/human-review.ts) to TransferRule, with the richer
 * field set the spec requires. Reuses existing types throughout — this
 * is a projection/renderer over TransferRule + SourceRecord, not a new
 * data model.
 */
import fs from "node:fs";
import path from "node:path";
import type { TransferRule, TransferRuleFactFieldKey } from "@/types/transfer-rule";
import type { SourceRecord, VerifiedField } from "@/types/knowledge-base";
import { ALL_TRANSFER_RULE_FIELD_KEYS, isCriticalField, getSecondarySourcedFields } from "./transfer-review";
import { loadAllSources } from "./sources";

export interface ReviewPacketFieldEntry {
  field: string;
  isCritical: boolean;
  value: unknown;
  isUnknown: boolean;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceAuthority: "authoritative" | "supplementary" | "unresolved" | null;
  specificity: string | null;
  jurisdiction: string | null;
  verifiedAt: string | null;
  confidence: number;
  verificationMethod: string | null;
  status: string;
  reviewer: string | null;
  historyEntryCount: number;
  conditions: unknown[] | null; // populated only for RequirementValue-shaped fields with status "conditional"
}

export interface TransferRuleReviewPacket {
  sourceState: string;
  destinationState: string;
  profession: string;
  licenseType: string;
  transferMechanism: unknown;
  fields: ReviewPacketFieldEntry[];
  unknownFieldCount: number;
  secondarySourcedFieldCount: number;
  conflictCount: number;
  conflicts: TransferRule["conflicts"];
}

function buildFieldEntry(fieldKey: string, field: VerifiedField<unknown>, resolveSource: (url: string) => SourceRecord | undefined): ReviewPacketFieldEntry {
  const source = field.sourceUrl ? resolveSource(field.sourceUrl) : undefined;
  const isUnknown = field.value === "Unknown";

  let conditions: unknown[] | null = null;
  if (!isUnknown && typeof field.value === "object" && field.value !== null && "status" in (field.value as any)) {
    const rv = field.value as any;
    if (rv.status === "conditional" && Array.isArray(rv.conditions)) conditions = rv.conditions;
  }

  return {
    field: fieldKey,
    isCritical: isCriticalField(fieldKey as TransferRuleFactFieldKey),
    value: field.value,
    isUnknown,
    sourceUrl: field.sourceUrl,
    sourceTitle: field.sourceTitle,
    sourceAuthority: isUnknown ? null : source ? source.authorityLevel : "unresolved",
    specificity: source?.specificity ?? null,
    jurisdiction: source?.jurisdiction ?? null,
    verifiedAt: field.verifiedAt,
    confidence: field.confidence,
    verificationMethod: field.verificationMethod,
    status: field.status,
    reviewer: field.reviewer,
    historyEntryCount: field.history.length,
    conditions,
  };
}

export function buildTransferRuleReviewPacket(rule: TransferRule, resolveSource: (url: string) => SourceRecord | undefined): TransferRuleReviewPacket {
  const fields = ALL_TRANSFER_RULE_FIELD_KEYS.map((key) => buildFieldEntry(key, rule[key] as VerifiedField<unknown>, resolveSource));

  return {
    sourceState: rule.sourceState,
    destinationState: rule.destinationState,
    profession: rule.profession,
    licenseType: rule.licenseType,
    transferMechanism: rule.transferMechanism.value,
    fields,
    unknownFieldCount: fields.filter((f) => f.isUnknown).length,
    secondarySourcedFieldCount: getSecondarySourcedFields(rule, resolveSource).length,
    conflictCount: rule.conflicts.length,
    conflicts: rule.conflicts,
  };
}

/** Human-readable rendering — concise, factual, never reproduces long source text (per Step 10). */
export function renderTransferRuleReviewPacket(packet: TransferRuleReviewPacket): string {
  const lines: string[] = [];
  const stateName = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  lines.push(`SOURCE STATE: ${stateName(packet.sourceState)}`);
  lines.push(`DESTINATION STATE: ${stateName(packet.destinationState)}`);
  lines.push(`PROFESSION: ${packet.profession}`);
  lines.push(`LICENSE TYPE: ${packet.licenseType}`);
  lines.push(`TRANSFER MECHANISM: ${packet.transferMechanism}`);
  lines.push("");
  lines.push(`SUMMARY: ${packet.fields.length - packet.unknownFieldCount}/${packet.fields.length} fields populated, ${packet.unknownFieldCount} Unknown, ${packet.secondarySourcedFieldCount} secondary-sourced, ${packet.conflictCount} conflict(s) recorded.`);
  lines.push("");

  for (const f of packet.fields) {
    lines.push("─".repeat(50));
    lines.push(`FIELD: ${f.field}${f.isCritical ? "  [CRITICAL]" : ""}`);
    if (f.isUnknown) {
      lines.push("VALUE: Unknown (no evidence recorded)");
      lines.push("REVIEW: [ ] N/A — nothing to review yet");
      continue;
    }
    lines.push(`VALUE: ${JSON.stringify(f.value)}`);
    if (f.conditions) lines.push(`CONDITIONS: ${JSON.stringify(f.conditions)}`);
    lines.push(`SOURCE TITLE: ${f.sourceTitle}`);
    lines.push(`SOURCE URL: ${f.sourceUrl}`);
    lines.push(`SOURCE AUTHORITY: ${f.sourceAuthority}${f.sourceAuthority === "supplementary" ? "  ⚠ SECONDARY — not authoritative" : ""}`);
    lines.push(`SPECIFICITY: ${f.specificity ?? "n/a"}`);
    lines.push(`JURISDICTION: ${f.jurisdiction ?? "n/a"}`);
    lines.push(`VERIFIED (AI research) AT: ${f.verifiedAt}`);
    lines.push(`CONFIDENCE: ${f.confidence}`);
    lines.push(`VERIFICATION METHOD: ${f.verificationMethod}`);
    lines.push(`CURRENT STATUS: ${f.status}`);
    lines.push(`REVIEWER: ${f.reviewer ?? "null (no human has reviewed this field)"}`);
    lines.push(`HISTORY ENTRIES: ${f.historyEntryCount}`);
    lines.push("REVIEW: [ ] Approve   [ ] Reject   [ ] Request More Evidence");
  }

  if (packet.conflicts.length > 0) {
    lines.push("─".repeat(50));
    lines.push(`CONFLICTS (${packet.conflicts.length}):`);
    for (const c of packet.conflicts) {
      lines.push(`  Field: ${c.field} — resolution: ${c.resolution}`);
    }
  }

  return lines.join("\n");
}

export function writeTransferRuleReviewPackets(): { mdPath: string; count: number } {
  const dir = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules", "registered-nurse");
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const lines: string[] = ["# RN Transfer Rule Review Packets — All 5 Real Records (Phase 3.2)", ""];

  for (const file of files.sort()) {
    const rule: TransferRule = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    const packet = buildTransferRuleReviewPacket(rule, resolveSource);
    lines.push("=".repeat(60));
    lines.push(`TRANSFER: ${file.replace(".json", "")}`);
    lines.push("=".repeat(60));
    lines.push(renderTransferRuleReviewPacket(packet));
    lines.push("");
  }

  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const mdPath = path.join(reportsDir, "transfer-review-packets.md");
  fs.writeFileSync(mdPath, lines.join("\n"));

  return { mdPath, count: files.length };
}
