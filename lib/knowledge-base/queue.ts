/**
 * lib/knowledge-base/queue.ts
 *
 * Builds the machine-readable verification queue: one entry per tracked
 * field across every fact file, showing its current value, current
 * source, whether that source is authoritative, and whether it still
 * requires verification. This does NOT verify anything itself — it is a
 * to-do list, not a verifier. Every item defaults to
 * verificationRequired: true unless a field is already "verified" status
 * (which, as of Phase 2.1, none are).
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts, VerificationQueueItem } from "@/types/knowledge-base";
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
  "rnEndorsementFeeUsd",
  "renewalFeeUsd",
  "continuingEducationRequirements",
];

export function buildVerificationQueue(professionFilter?: string): VerificationQueueItem[] {
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));

  const queue: VerificationQueueItem[] = [];
  if (!fs.existsSync(FACTS_DIR)) return queue;

  const professionDirs = professionFilter ? [professionFilter] : fs.readdirSync(FACTS_DIR);

  for (const professionSlug of professionDirs) {
    const dir = path.join(FACTS_DIR, professionSlug);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const facts = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as ProfessionStateFacts;

      for (const key of FIELD_KEYS) {
        const field = facts[key] as any;
        const matchedSource = field.sourceUrl ? sourceByUrl.get(field.sourceUrl) : undefined;

        const alreadyVerified = field.status === "verified";

        queue.push({
          profession: facts.profession,
          state: facts.state,
          fieldPath: key,
          currentValue: field.value,
          currentStatus: field.status,
          sourceUrl: field.sourceUrl,
          sourceId: matchedSource?.id ?? null,
          sourceIsAuthoritative: matchedSource ? matchedSource.authorityLevel === "authoritative" : field.sourceUrl ? false : null,
          verificationRequired: !alreadyVerified,
          reason: alreadyVerified
            ? "Already verified by a named human reviewer — no action needed."
            : field.value === "Unknown"
              ? "No value recorded yet."
              : matchedSource
                ? matchedSource.authorityLevel === "authoritative"
                  ? "Value exists and cites an authoritative source, but no human reviewer has signed off yet."
                  : "Value exists but currently cites a secondary source only — needs re-verification against an authoritative source before it can be marked Verified."
                : "Value exists but its sourceUrl does not match any registered SourceRecord — source cannot be assessed for authority.",
        });
      }
    }
  }

  return queue;
}

export function writeVerificationQueue(professionFilter?: string): { jsonPath: string; report: VerificationQueueItem[] } {
  const queue = buildVerificationQueue(professionFilter);
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "verification-queue.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalItems: queue.length,
        itemsRequiringVerification: queue.filter((i) => i.verificationRequired).length,
        items: queue,
      },
      null,
      2
    )
  );

  return { jsonPath, report: queue };
}
