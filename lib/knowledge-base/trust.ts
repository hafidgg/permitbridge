/**
 * lib/knowledge-base/trust.ts
 *
 * Generates the Trust Dashboard: a machine-readable report on the
 * verification state of every field in the knowledge base, independent
 * of the coverage dashboard (which only measures presence). This is what
 * answers "how much of what's here can actually be trusted, and by whom."
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts, TrustReport, VerificationStatus, VerificationMethod } from "@/types/knowledge-base";
import { isFieldMissingSource } from "./fields";
import { loadAllSources } from "./sources";
import { isDisallowedReviewerName } from "./policy";

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts");
const STALE_THRESHOLD_DAYS = 180;

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
  "rnEndorsementFeeUsd",
  "renewalFeeUsd",
  "continuingEducationRequirements",
];

const ALL_STATUSES: VerificationStatus[] = ["verified", "needs_review", "pending_verification", "deprecated", "conflicting_sources"];
const ALL_METHODS: (VerificationMethod | "none")[] = [
  "ai_assisted_manual_research",
  "automated_pipeline_extraction",
  "manual-review",
  "official_document_review",
  "cross_referenced_multiple_sources",
  "none",
];

function loadAllFactFiles(): ProfessionStateFacts[] {
  if (!fs.existsSync(FACTS_DIR)) return [];
  const facts: ProfessionStateFacts[] = [];
  for (const professionSlug of fs.readdirSync(FACTS_DIR)) {
    const dir = path.join(FACTS_DIR, professionSlug);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      facts.push(JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as ProfessionStateFacts);
    }
  }
  return facts;
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate + "T00:00:00Z").getTime()) / 86400000);
}

export function computeTrustReport(): TrustReport {
  const allFacts = loadAllFactFiles();
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const authoritativeSourcesCount = sources.filter((s) => s.authorityLevel === "authoritative").length;
  const secondarySourcesCount = sources.filter((s) => s.authorityLevel === "supplementary").length;

  const fieldsByStatus: Record<VerificationStatus, number> = {
    verified: 0,
    needs_review: 0,
    pending_verification: 0,
    deprecated: 0,
    conflicting_sources: 0,
  };
  const fieldsByMethod: Record<VerificationMethod | "none", number> = {
    ai_assisted_manual_research: 0,
    automated_pipeline_extraction: 0,
    "manual-review": 0,
    official_document_review: 0,
    cross_referenced_multiple_sources: 0,
    none: 0,
  };

  let totalFields = 0;
  let staleFieldsCount = 0;
  let fieldsMissingSource = 0;
  let confidenceSum = 0;
  let nonUnknownCount = 0;
  let fieldsUsingAuthoritativeSources = 0;
  let fieldsUsingSecondarySources = 0;
  let fieldsUsingUnresolvedSources = 0;
  let humanReviewedFieldsCount = 0;
  let fieldsWithoutHumanReview = 0;
  let fieldsWithRecordedConflicts = 0;
  let fieldsWithUnresolvedConflicts = 0;
  const conflictAgencyNames = new Set<string>();

  for (const facts of allFacts) {
    const conflictsByField = new Map<string, any[]>();
    for (const conflict of facts.conflicts ?? []) {
      if (!conflictsByField.has(conflict.field)) conflictsByField.set(conflict.field, []);
      conflictsByField.get(conflict.field)!.push(conflict);
      conflictAgencyNames.add(conflict.sourceA?.agencyName);
      conflictAgencyNames.add(conflict.sourceB?.agencyName);
    }

    for (const key of FIELD_KEYS) {
      const field = facts[key] as any;
      totalFields++;
      fieldsByStatus[field.status as VerificationStatus]++;
      fieldsByMethod[(field.verificationMethod ?? "none") as VerificationMethod | "none"]++;

      if (isFieldMissingSource(field)) fieldsMissingSource++;

      const fieldConflicts = conflictsByField.get(key) ?? [];
      if (fieldConflicts.length > 0) {
        fieldsWithRecordedConflicts++;
        if (fieldConflicts.some((c) => c.resolution === "unresolved")) fieldsWithUnresolvedConflicts++;
      }

      const hasRealReviewer =
        typeof field.reviewer === "string" && field.reviewer.trim().length > 0 && !isDisallowedReviewerName(field.reviewer);
      if (field.status === "verified" && hasRealReviewer) {
        humanReviewedFieldsCount++;
      } else {
        fieldsWithoutHumanReview++;
      }

      if (field.value !== "Unknown") {
        nonUnknownCount++;
        confidenceSum += field.confidence ?? 0;
        if (field.verifiedAt && daysSince(field.verifiedAt) > STALE_THRESHOLD_DAYS) {
          staleFieldsCount++;
        }

        const matchedSource = field.sourceUrl ? sourceByUrl.get(field.sourceUrl) : undefined;
        if (!matchedSource) fieldsUsingUnresolvedSources++;
        else if (matchedSource.authorityLevel === "authoritative") fieldsUsingAuthoritativeSources++;
        else fieldsUsingSecondarySources++;
      }
    }
  }

  const fieldsByStatusPct: Record<VerificationStatus, number> = {} as Record<VerificationStatus, number>;
  for (const status of ALL_STATUSES) {
    fieldsByStatusPct[status] = totalFields > 0 ? Math.round((fieldsByStatus[status] / totalFields) * 1000) / 10 : 0;
  }

  const sourcesWithZeroFieldsUsingThem = sources.filter((s) => s.fieldsUsingThisSource === 0).map((s) => s.id);

  return {
    generatedAt: new Date().toISOString(),
    totalFields,
    fieldsByStatus,
    fieldsByStatusPct,
    conflictingFieldsCount: fieldsByStatus.conflicting_sources,
    staleFieldsCount,
    staleThresholdDays: STALE_THRESHOLD_DAYS,
    averageConfidence: nonUnknownCount > 0 ? Math.round((confidenceSum / nonUnknownCount) * 100) / 100 : 0,
    verificationCoveragePct: totalFields > 0 ? Math.round((nonUnknownCount / totalFields) * 1000) / 10 : 0,
    fieldsMissingSource,
    fieldsByMethod,
    sourcesTracked: sources.length,
    sourcesWithZeroFieldsUsingThem,
    authoritativeSourcesCount,
    secondarySourcesCount,
    fieldsUsingAuthoritativeSources,
    fieldsUsingSecondarySources,
    fieldsUsingUnresolvedSources,
    humanReviewedFieldsCount,
    fieldsWithoutHumanReview,
    fieldsWithRecordedConflicts,
    fieldsWithUnresolvedConflicts,
    officialSourcesInvolvedInConflicts: Array.from(conflictAgencyNames).filter(Boolean).sort(),
  };
}

export function writeTrustReport(): { jsonPath: string; mdPath: string; report: TrustReport } {
  const report = computeTrustReport();
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "trust.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const lines: string[] = [];
  lines.push("# PermitBridge Knowledge Base — Trust Dashboard");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(`**Verification coverage: ${report.verificationCoveragePct}%** of all tracked fields have any value (vs. "Unknown")`);
  lines.push(`**Average confidence (non-Unknown fields): ${report.averageConfidence}**`);
  lines.push("");
  lines.push("## Fields by Status");
  lines.push("");
  lines.push("| Status | Count | % |");
  lines.push("|---|---|---|");
  for (const status of ALL_STATUSES) {
    lines.push(`| ${status} | ${report.fieldsByStatus[status]} | ${report.fieldsByStatusPct[status]}% |`);
  }
  lines.push("");
  lines.push(
    `> Note: ${report.fieldsByStatus.verified} fields carry status "verified" — meaning a **named human reviewer** has signed off. Everything else found so far is "pending_verification": a real source was read (by an AI research assistant), but no human has confirmed it yet. This distinction is deliberate — see Data Quality Rules.`
  );
  lines.push("");
  lines.push("## Fields by Verification Method");
  lines.push("");
  lines.push("| Method | Count |");
  lines.push("|---|---|");
  for (const method of ALL_METHODS) {
    if (report.fieldsByMethod[method] > 0) lines.push(`| ${method} | ${report.fieldsByMethod[method]} |`);
  }
  lines.push("");
  lines.push("## Source Authority");
  lines.push("");
  lines.push(`- **Authoritative sources tracked:** ${report.authoritativeSourcesCount}`);
  lines.push(`- **Secondary sources tracked:** ${report.secondarySourcesCount}`);
  lines.push(`- **Fields citing an authoritative source:** ${report.fieldsUsingAuthoritativeSources}`);
  lines.push(`- **Fields citing a secondary source:** ${report.fieldsUsingSecondarySources}`);
  lines.push(`- **Fields citing an unresolved/unregistered source:** ${report.fieldsUsingUnresolvedSources}`);
  lines.push("");
  lines.push("## Human Review");
  lines.push("");
  lines.push(`- **Fields with real, named human review:** ${report.humanReviewedFieldsCount}`);
  lines.push(`- **Fields without human review:** ${report.fieldsWithoutHumanReview}`);
  lines.push("");
  lines.push("## Data Quality");
  lines.push("");
  lines.push(`- **Fields missing a source despite having a value:** ${report.fieldsMissingSource} ${report.fieldsMissingSource === 0 ? "✅ (rule holding — no field appears without a source)" : "🔴 VIOLATION — see below"}`);
  lines.push(`- **Stale fields (unverified for >${report.staleThresholdDays} days):** ${report.staleFieldsCount}`);
  lines.push(`- **Fields with unresolved conflicting sources:** ${report.conflictingFieldsCount}`);
  lines.push("");
  lines.push("## Conflicts (Phase 2.6)");
  lines.push("");
  lines.push(`- **Fields with a recorded conflict (resolved or not):** ${report.fieldsWithRecordedConflicts}`);
  lines.push(`- **Fields with a genuinely unresolved conflict:** ${report.fieldsWithUnresolvedConflicts}`);
  lines.push(`- **Official sources that have appeared on either side of a conflict:** ${report.officialSourcesInvolvedInConflicts.length > 0 ? report.officialSourcesInvolvedInConflicts.join(", ") : "none"}`);
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  lines.push(`${report.sourcesTracked} source(s) currently tracked in \`data/knowledge-base/sources/\`.`);
  if (report.sourcesWithZeroFieldsUsingThem.length > 0) {
    lines.push(`Sources with zero fields currently citing them: ${report.sourcesWithZeroFieldsUsingThem.join(", ")}`);
  }

  const mdPath = path.join(reportsDir, "trust.md");
  fs.writeFileSync(mdPath, lines.join("\n"));

  return { jsonPath, mdPath, report };
}
