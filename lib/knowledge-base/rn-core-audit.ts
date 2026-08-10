/**
 * lib/knowledge-base/rn-core-audit.ts
 *
 * Phase 2.3, Steps 1 & 3: read-only inspection of the 50 existing RN
 * fact files against the RN_CORE_FIELDS definition. Produces:
 *   - per-core-field coverage stats (authoritative/secondary/missing)
 *   - a full state x core-field coverage matrix
 * Nothing here writes to data/knowledge-base/facts/ — audit only.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts } from "@/types/knowledge-base";
import { RN_CORE_FIELDS, describeAuthorityTiers, type RnFieldKey } from "./rn-core-fields";
import { loadAllSources } from "./sources";

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");

export interface CoreFieldCoverageStat {
  field: RnFieldKey;
  purpose: string;
  authorityRequirement: string;
  totalStates: number;
  authoritativeCoverage: number;
  secondaryCoverage: number;
  missingCoverage: number;
}

export interface StateCoreFieldStatus {
  field: RnFieldKey;
  value: unknown;
  sourceUrl: string | null;
  sourceType: string | null;
  status: "authoritative" | "secondary" | "unresolved-source" | "missing";
}

export interface StateCoreCoverageRow {
  state: string;
  fields: StateCoreFieldStatus[];
  authoritativeCount: number;
  secondaryCount: number;
  missingCount: number;
}

function loadAllFacts(): ProfessionStateFacts[] {
  return fs
    .readdirSync(FACTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FACTS_DIR, f), "utf-8")) as ProfessionStateFacts);
}

export function computeCoreFieldStats(): CoreFieldCoverageStat[] {
  const allFacts = loadAllFacts();
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));

  return RN_CORE_FIELDS.map((def) => {
    let authoritative = 0;
    let secondary = 0;
    let missing = 0;

    for (const facts of allFacts) {
      const field = facts[def.field] as any;
      if (field.value === "Unknown") {
        missing++;
        continue;
      }
      const src = field.sourceUrl ? sourceByUrl.get(field.sourceUrl) : undefined;
      if (src && src.authorityLevel === "authoritative") authoritative++;
      else secondary++; // includes unresolved-source populated fields, conservatively counted as not-yet-authoritative
    }

    return {
      field: def.field,
      purpose: def.purpose,
      authorityRequirement: describeAuthorityTiers(def.authorityTiers),
      totalStates: allFacts.length,
      authoritativeCoverage: authoritative,
      secondaryCoverage: secondary,
      missingCoverage: missing,
    };
  });
}

export function computeStateCoverageMatrix(): StateCoreCoverageRow[] {
  const allFacts = loadAllFacts();
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));

  return allFacts
    .map((facts) => {
      const fields: StateCoreFieldStatus[] = RN_CORE_FIELDS.map((def) => {
        const field = facts[def.field] as any;
        if (field.value === "Unknown") {
          return { field: def.field, value: "Unknown", sourceUrl: null, sourceType: null, status: "missing" as const };
        }
        const src = field.sourceUrl ? sourceByUrl.get(field.sourceUrl) : undefined;
        if (!src) {
          return { field: def.field, value: field.value, sourceUrl: field.sourceUrl, sourceType: null, status: "unresolved-source" as const };
        }
        return {
          field: def.field,
          value: field.value,
          sourceUrl: field.sourceUrl,
          sourceType: src.sourceType,
          status: src.authorityLevel === "authoritative" ? ("authoritative" as const) : ("secondary" as const),
        };
      });

      return {
        state: facts.state,
        fields,
        authoritativeCount: fields.filter((f) => f.status === "authoritative").length,
        secondaryCount: fields.filter((f) => f.status === "secondary" || f.status === "unresolved-source").length,
        missingCount: fields.filter((f) => f.status === "missing").length,
      };
    })
    .sort((a, b) => a.state.localeCompare(b.state));
}

export function writeCoreAudit(): { statsPath: string; matrixPath: string } {
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const stats = computeCoreFieldStats();
  const matrix = computeStateCoverageMatrix();

  const statsPath = path.join(reportsDir, "rn-core-field-stats.json");
  fs.writeFileSync(statsPath, JSON.stringify({ generatedAt: new Date().toISOString(), stats }, null, 2));

  const matrixPath = path.join(reportsDir, "rn-core-coverage-matrix.json");
  fs.writeFileSync(matrixPath, JSON.stringify({ generatedAt: new Date().toISOString(), matrix }, null, 2));

  return { statsPath, matrixPath };
}
