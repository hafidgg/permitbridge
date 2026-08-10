/**
 * lib/knowledge-base/sources.ts
 *
 * Recomputes `fieldsUsingThisSource` on every SourceRecord by scanning
 * every fact file's populated fields and matching sourceUrl. This value
 * is never hand-maintained — running this is the only way it changes,
 * which is what keeps a source record from silently drifting out of sync
 * with what's actually cited in the knowledge base.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts, SourceRecord } from "@/types/knowledge-base";

const SOURCES_DIR = path.join(process.cwd(), "data", "knowledge-base", "sources");
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

export function recomputeSourceUsage(): { updated: number; sourceCounts: Record<string, number> } {
  if (!fs.existsSync(SOURCES_DIR)) return { updated: 0, sourceCounts: {} };

  const sourceFiles = fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith(".json"));
  const sources: SourceRecord[] = sourceFiles.map((f) => JSON.parse(fs.readFileSync(path.join(SOURCES_DIR, f), "utf-8")));
  const allFacts = loadAllFactFiles();

  // Count how many populated fields cite each source's exact URL.
  const counts: Record<string, number> = {};
  for (const source of sources) counts[source.website] = 0;

  for (const facts of allFacts) {
    for (const key of FIELD_KEYS) {
      const field = facts[key] as any;
      if (field?.sourceUrl && field.sourceUrl in counts) {
        counts[field.sourceUrl] = (counts[field.sourceUrl] ?? 0) + 1;
      }
    }
  }

  let updated = 0;
  const sourceCounts: Record<string, number> = {};
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) continue;
    const newCount = counts[source.website] ?? 0;
    sourceCounts[source.id] = newCount;
    if (source.fieldsUsingThisSource !== newCount) {
      source.fieldsUsingThisSource = newCount;
      fs.writeFileSync(path.join(SOURCES_DIR, sourceFiles[i]!), JSON.stringify(source, null, 2) + "\n");
      updated++;
    }
  }

  return { updated, sourceCounts };
}

export function loadAllSources(): SourceRecord[] {
  if (!fs.existsSync(SOURCES_DIR)) return [];
  return fs
    .readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(SOURCES_DIR, f), "utf-8")) as SourceRecord);
}
