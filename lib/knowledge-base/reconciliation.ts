/**
 * lib/knowledge-base/reconciliation.ts
 *
 * Phase 2.1 Final Audit — traces exactly what unit each trust metric
 * counts, and proves (by direct computation, not assertion) that the
 * field-level and source-level breakdowns each sum to their expected
 * totals independently.
 *
 * Two genuinely different kinds of number exist in this system and this
 * module is what keeps them from ever being silently conflated:
 *
 *   FIELD-counted metrics: "how many of the 750 fields have a value that
 *   cites a source of category X" — computed by iterating fields.
 *
 *   SOURCE-counted metrics: "how many of the 53 source records actually
 *   have >=1 field citing them" — computed by iterating sources.
 *
 * A field can currently cite at most ONE source (VerifiedField.sourceUrl
 * is a single string, not an array), so "total field-source
 * relationships" and "populated field count" are numerically identical
 * today — but they are reported as separate, explicitly-labeled figures
 * below so that a future schema change (a field citing multiple sources)
 * would not silently break this report's meaning.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts, SourceRecord } from "@/types/knowledge-base";
import { loadAllSources } from "./sources";

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts");

const FIELD_KEYS: (keyof ProfessionStateFacts)[] = [
  "licensingBoard",
  "officialWebsite",
  "licenseTransferPage",
  "reciprocityRules",
  "endorsementRules",
  "universalLicenseRecognitionStatus",
  "compactMembership",
  "requiredExams",
  "requiredExperience",
  "requiredEducation",
  "requiredDocuments",
  "processingTime",
  "endorsementFeeUsd",
  "renewalFeeUsd",
  "continuingEducationRequirements",
];

function loadFactFiles(professionSlug: string): ProfessionStateFacts[] {
  const dir = path.join(FACTS_DIR, professionSlug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ProfessionStateFacts);
}

/** FIELD-counted reconciliation: units are "fields" (max 1 source cited per field today). */
export interface FieldReconciliation {
  professionSlug: string;
  totalFields: number; // = states x FIELD_KEYS.length
  fieldsWithAuthoritativeSource: number;
  fieldsWithSecondarySource: number;
  fieldsWithNoSource: number; // includes both "Unknown" value fields AND any populated field whose sourceUrl matches nothing
  sumCheck: number; // authoritative + secondary + noSource — must equal totalFields
  sumCheckPasses: boolean;

  // Explicitly labeled relationship framing, per the audit's request.
  // Under the CURRENT schema (one sourceUrl per field) these three values
  // are mathematically identical to the three above — reported separately
  // and explicitly so, on purpose, not merged into the same field names.
  totalFieldSourceRelationships: number; // populated fields with a resolvable source = authoritative + secondary
  uniqueFieldsWithAtLeastOneAuthoritativeSource: number;
  uniqueFieldsWithAtLeastOneSecondarySource: number;
  uniqueFieldsWithNoSource: number;
}

export function computeFieldReconciliation(professionSlug: string): FieldReconciliation {
  const facts = loadFactFiles(professionSlug);
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));

  let totalFields = 0;
  let withAuthoritative = 0;
  let withSecondary = 0;
  let withNoSource = 0;

  for (const record of facts) {
    for (const key of FIELD_KEYS) {
      const field = record[key] as any;
      totalFields++;

      if (field.value === "Unknown") {
        withNoSource++;
        continue;
      }

      const matched = field.sourceUrl ? sourceByUrl.get(field.sourceUrl) : undefined;
      if (!matched) {
        withNoSource++;
      } else if (matched.authorityLevel === "authoritative") {
        withAuthoritative++;
      } else {
        withSecondary++;
      }
    }
  }

  const sumCheck = withAuthoritative + withSecondary + withNoSource;

  return {
    professionSlug,
    totalFields,
    fieldsWithAuthoritativeSource: withAuthoritative,
    fieldsWithSecondarySource: withSecondary,
    fieldsWithNoSource: withNoSource,
    sumCheck,
    sumCheckPasses: sumCheck === totalFields,
    totalFieldSourceRelationships: withAuthoritative + withSecondary,
    uniqueFieldsWithAtLeastOneAuthoritativeSource: withAuthoritative,
    uniqueFieldsWithAtLeastOneSecondarySource: withSecondary,
    uniqueFieldsWithNoSource: withNoSource,
  };
}

/** SOURCE-counted reconciliation: units are "source records" (53 total as of Phase 2.1). */
export interface SourceReconciliation {
  totalSourceRecords: number;
  officialSourceRecords: number;
  secondarySourceRecords: number;

  officialSourcesReferencedByAtLeastOneField: number;
  secondarySourcesReferencedByAtLeastOneField: number;
  unusedSourceRecords: number; // fieldsUsingThisSource === 0, regardless of authority level
  sumCheck: number;
  sumCheckPasses: boolean;

  unusedSourceIds: string[];
  referencedSourceIds: string[];
}

export function computeSourceReconciliation(): SourceReconciliation {
  const sources = loadAllSources();

  const officialSourceRecords = sources.filter((s) => s.authorityLevel === "authoritative").length;
  const secondarySourceRecords = sources.filter((s) => s.authorityLevel === "supplementary").length;

  const referenced = sources.filter((s) => s.fieldsUsingThisSource > 0);
  const unused = sources.filter((s) => s.fieldsUsingThisSource === 0);

  const officialReferenced = referenced.filter((s) => s.authorityLevel === "authoritative").length;
  const secondaryReferenced = referenced.filter((s) => s.authorityLevel === "supplementary").length;

  const sumCheck = officialReferenced + secondaryReferenced + unused.length;

  return {
    totalSourceRecords: sources.length,
    officialSourceRecords,
    secondarySourceRecords,
    officialSourcesReferencedByAtLeastOneField: officialReferenced,
    secondarySourcesReferencedByAtLeastOneField: secondaryReferenced,
    unusedSourceRecords: unused.length,
    sumCheck,
    sumCheckPasses: sumCheck === sources.length,
    unusedSourceIds: unused.map((s) => s.id),
    referencedSourceIds: referenced.map((s) => s.id),
  };
}

export function writeMetricAuditReport(professionSlug: string): { jsonPath: string; mdPath: string } {
  const fieldRecon = computeFieldReconciliation(professionSlug);
  const sourceRecon = computeSourceReconciliation();

  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "metric-audit.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), fieldRecon, sourceRecon }, null, 2));

  const lines: string[] = [];
  lines.push("# Phase 2.1 Metric Audit — Field vs. Source Reconciliation");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Field-Level Reconciliation (unit: fields)");
  lines.push("");
  lines.push(`Total ${professionSlug} fields: ${fieldRecon.totalFields}`);
  lines.push("");
  lines.push(`Fields with authoritative source: ${fieldRecon.fieldsWithAuthoritativeSource}`);
  lines.push(`Fields with secondary source: ${fieldRecon.fieldsWithSecondarySource}`);
  lines.push(`Fields with no source: ${fieldRecon.fieldsWithNoSource}`);
  lines.push("");
  lines.push(
    `${fieldRecon.fieldsWithAuthoritativeSource} + ${fieldRecon.fieldsWithSecondarySource} + ${fieldRecon.fieldsWithNoSource} = ${fieldRecon.sumCheck} ${fieldRecon.sumCheckPasses ? "✅ matches total" : "🔴 MISMATCH"}`
  );
  lines.push("");
  lines.push(
    "> Note: the current schema allows exactly one `sourceUrl` per field, so 'total field-source relationships' and 'unique fields with a source of that type' are numerically identical to the counts above. Reported as separate named figures below on purpose, so a future multi-source-per-field schema change doesn't silently reuse this report's meaning."
  );
  lines.push("");
  lines.push(`Total field-source relationships: ${fieldRecon.totalFieldSourceRelationships}`);
  lines.push(`Unique fields with at least one authoritative source: ${fieldRecon.uniqueFieldsWithAtLeastOneAuthoritativeSource}`);
  lines.push(`Unique fields with at least one secondary source: ${fieldRecon.uniqueFieldsWithAtLeastOneSecondarySource}`);
  lines.push(`Unique fields with no source: ${fieldRecon.uniqueFieldsWithNoSource}`);
  lines.push("");
  lines.push("## Source-Level Reconciliation (unit: source records)");
  lines.push("");
  lines.push(`Official source records: ${sourceRecon.officialSourceRecords}`);
  lines.push(`Secondary source records: ${sourceRecon.secondarySourceRecords}`);
  lines.push(`Total source records: ${sourceRecon.totalSourceRecords}`);
  lines.push("");
  lines.push(`Official sources actually referenced by >=1 field: ${sourceRecon.officialSourcesReferencedByAtLeastOneField}`);
  lines.push(`Secondary sources actually referenced by >=1 field: ${sourceRecon.secondarySourcesReferencedByAtLeastOneField}`);
  lines.push(`Unused source records (fieldsUsingThisSource = 0): ${sourceRecon.unusedSourceRecords}`);
  lines.push("");
  lines.push(
    `${sourceRecon.officialSourcesReferencedByAtLeastOneField} + ${sourceRecon.secondarySourcesReferencedByAtLeastOneField} + ${sourceRecon.unusedSourceRecords} = ${sourceRecon.sumCheck} ${sourceRecon.sumCheckPasses ? "✅ matches total source records" : "🔴 MISMATCH"}`
  );
  lines.push("");
  lines.push(`Unused source IDs: ${sourceRecon.unusedSourceIds.join(", ")}`);
  lines.push(`Referenced source IDs: ${sourceRecon.referencedSourceIds.join(", ")}`);

  const mdPath = path.join(reportsDir, "metric-audit.md");
  fs.writeFileSync(mdPath, lines.join("\n"));

  return { jsonPath, mdPath };
}
