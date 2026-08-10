/**
 * lib/knowledge-base/human-review.ts
 *
 * Phase 2.3, Steps 8 & 9: a clean queue of ONLY the RN fields that now
 * have authoritative-source evidence, ready for an actual human to
 * confirm — plus short, non-verbatim "review packets" a human can act on
 * quickly. `reviewer` and `verificationDate` are ALWAYS null here; this
 * module has no code path that can set them to anything else. Setting
 * them is a manual, separate, human action (see VERIFICATION_POLICY.md).
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts } from "@/types/knowledge-base";
import { RN_CORE_FIELDS, type RnFieldKey } from "./rn-core-fields";
import { loadAllSources } from "./sources";

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");

export interface HumanReviewQueueItem {
  state: string;
  field: RnFieldKey;
  currentValue: unknown;
  authoritativeSource: string; // agencyName
  sourceUrl: string;
  evidence: string; // short, factual, non-verbatim summary — never copied source text
  verificationStatus: string;
  reviewer: null;
  verificationDate: null;
}

function loadAllFacts(): ProfessionStateFacts[] {
  return fs
    .readdirSync(FACTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FACTS_DIR, f), "utf-8")) as ProfessionStateFacts)
    .sort((a, b) => a.state.localeCompare(b.state));
}

function shortEvidence(fieldKey: RnFieldKey, stateName: string, value: unknown, sourceAgency: string): string {
  if (fieldKey === "compactMembership") {
    return value
      ? `${sourceAgency} lists ${stateName} as a full Nurse Licensure Compact member state.`
      : `${sourceAgency} does not list ${stateName} as a Nurse Licensure Compact member.`;
  }
  if (fieldKey === "requiredExams") {
    return `${sourceAgency} confirms NCLEX-RN as the national licensure exam requirement, applicable in ${stateName}.`;
  }
  if (fieldKey === "rnEndorsementFeeUsd") {
    return `${sourceAgency} states the RN licensure-by-endorsement application fee as $${value} (not the exam-pathway or renewal fee).`;
  }
  if (fieldKey === "licensingBoard") {
    return `${sourceAgency}'s own official site self-identifies as "${value}".`;
  }
  if (fieldKey === "officialWebsite") {
    return `Confirmed live and self-hosted by ${sourceAgency}: ${value}.`;
  }
  return `Confirmed via ${sourceAgency}.`;
}

export function buildHumanReviewQueue(): HumanReviewQueueItem[] {
  const allFacts = loadAllFacts();
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const coreFieldKeys = new Set(RN_CORE_FIELDS.map((d) => d.field));

  const queue: HumanReviewQueueItem[] = [];

  for (const facts of allFacts) {
    const stateName = facts.state.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    for (const fieldKey of coreFieldKeys) {
      const field = facts[fieldKey] as any;
      if (field.value === "Unknown") continue;
      const src = field.sourceUrl ? sourceByUrl.get(field.sourceUrl) : undefined;
      if (!src || src.authorityLevel !== "authoritative") continue; // human-review queue is authoritative-evidence-only, per Step 8

      queue.push({
        state: facts.state,
        field: fieldKey,
        currentValue: field.value,
        authoritativeSource: src.agencyName,
        sourceUrl: src.website,
        evidence: shortEvidence(fieldKey, stateName, field.value, src.agencyName),
        verificationStatus: field.status,
        reviewer: null,
        verificationDate: null,
      });
    }
  }

  return queue;
}

export function writeHumanReviewQueue(): { jsonPath: string; count: number } {
  const queue = buildHumanReviewQueue();
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "human-review-queue.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: queue.length, items: queue }, null, 2)
  );

  return { jsonPath, count: queue.length };
}

/** Renders one item as the exact concise packet format specified in Phase 2.3 Step 9. */
export function renderReviewPacket(item: HumanReviewQueueItem, professionLabel = "Registered Nurse"): string {
  const stateName = item.state.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const fieldLabel = item.field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  return [
    `STATE: ${stateName}`,
    `PROFESSION: ${professionLabel}`,
    `FIELD: ${fieldLabel}`,
    "",
    "CURRENT VALUE:",
    String(item.currentValue),
    "",
    "AUTHORITATIVE SOURCE:",
    item.authoritativeSource,
    "",
    "SOURCE URL:",
    item.sourceUrl,
    "",
    "EVIDENCE:",
    item.evidence,
    "",
    "CURRENT STATUS:",
    "Pending Verification",
    "",
    "REVIEW:",
    "[ ] Confirm",
    "[ ] Reject",
    "[ ] Needs Research",
  ].join("\n");
}

export function writeSampleReviewPackets(sampleSize = 10): { mdPath: string } {
  const queue = buildHumanReviewQueue();
  const sample = queue.slice(0, sampleSize);
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const lines: string[] = [
    "# RN Human Review Packets — Sample",
    "",
    `Showing ${sample.length} of ${queue.length} total items in the human-review queue.`,
    "Full machine-readable queue: data/_pipeline/reports/human-review-queue.json",
    "",
  ];
  for (const item of sample) {
    lines.push("---", "", renderReviewPacket(item), "");
  }

  const mdPath = path.join(reportsDir, "human-review-packets-sample.md");
  fs.writeFileSync(mdPath, lines.join("\n"));
  return { mdPath };
}
