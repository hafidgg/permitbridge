/**
 * lib/knowledge-base/coverage.ts
 *
 * Computes the Coverage Dashboard: for every profession x state cell,
 * how many of the 15 tracked fact fields are complete/partial/missing,
 * and whether any field has an unresolved conflict between sources.
 *
 * This is a REPORT GENERATOR, not a UI page — it writes JSON + Markdown
 * to data/_pipeline/reports/, the same place the existing pipeline writes
 * its changelogs. Per the "do not redesign UI / do not add features"
 * constraint, the dashboard is a generated artifact you read as a file,
 * not a new route on the live site.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts, CoverageCell, CoverageReport, FieldStatus } from "@/types/knowledge-base";
import { isFieldComplete, isFieldPartial, isFieldMissing } from "./fields";

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts");
const PROFESSIONS_DIR = path.join(process.cwd(), "data", "knowledge-base", "professions");
const STATES_DIR = path.join(process.cwd(), "data", "knowledge-base", "states");

const TRACKED_FIELDS: (keyof ProfessionStateFacts)[] = [
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

function loadJsonFilesIn<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as T);
}

function cellStatus(complete: number, partial: number, total: number, hasConflict: boolean): FieldStatus {
  if (hasConflict) return "needs_manual_review";
  if (complete === total) return "complete";
  if (complete > 0 || partial > 0) return "partial";
  return "missing";
}

export function computeCoverageReport(): CoverageReport {
  const professions = loadJsonFilesIn<{ slug: string }>(PROFESSIONS_DIR);
  const states = loadJsonFilesIn<{ slug: string }>(STATES_DIR);

  const cells: CoverageCell[] = [];

  for (const profession of professions) {
    const factsDir = path.join(FACTS_DIR, profession.slug);
    for (const state of states) {
      const factPath = path.join(factsDir, `${state.slug}.json`);
      let complete = 0;
      let partial = 0;
      let hasConflict = false;

      if (fs.existsSync(factPath)) {
        const facts = JSON.parse(fs.readFileSync(factPath, "utf-8")) as ProfessionStateFacts;
        for (const key of TRACKED_FIELDS) {
          const field = facts[key] as any;
          if (isFieldComplete(field)) complete++;
          else if (isFieldPartial(field)) partial++;
        }
        hasConflict = (facts.conflicts ?? []).some((c) => c.resolution === "unresolved");
      }

      const total = TRACKED_FIELDS.length;
      cells.push({
        profession: profession.slug,
        state: state.slug,
        status: cellStatus(complete, partial, total, hasConflict),
        fieldsComplete: complete,
        fieldsTotal: total,
        completionPct: Math.round((complete / total) * 100),
        hasUnresolvedConflict: hasConflict,
      });
    }
  }

  const cellsComplete = cells.filter((c) => c.status === "complete").length;
  const cellsPartial = cells.filter((c) => c.status === "partial").length;
  const cellsMissing = cells.filter((c) => c.status === "missing").length;
  const cellsNeedingReview = cells.filter((c) => c.status === "needs_manual_review").length;
  const totalFieldsPossible = cells.length * TRACKED_FIELDS.length;
  const totalFieldsComplete = cells.reduce((sum, c) => sum + c.fieldsComplete, 0);

  return {
    generatedAt: new Date().toISOString(),
    professionsTracked: professions.length,
    statesTracked: states.length,
    totalCells: cells.length,
    cellsComplete,
    cellsPartial,
    cellsMissing,
    cellsNeedingReview,
    overallCompletionPct: totalFieldsPossible > 0 ? Math.round((totalFieldsComplete / totalFieldsPossible) * 1000) / 10 : 0,
    cells,
  };
}

export function writeCoverageReport(): { jsonPath: string; mdPath: string; report: CoverageReport } {
  const report = computeCoverageReport();
  const reportsDir = path.join(process.cwd(), "data", "_pipeline", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "coverage.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const byProfession = new Map<string, CoverageCell[]>();
  for (const cell of report.cells) {
    if (!byProfession.has(cell.profession)) byProfession.set(cell.profession, []);
    byProfession.get(cell.profession)!.push(cell);
  }

  const lines: string[] = [];
  lines.push("# PermitBridge Knowledge Base — Coverage Dashboard");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(
    `**Overall: ${report.overallCompletionPct}%** of all tracked fields (${report.totalCells} profession×state cells × 15 fields each = ${report.totalCells * 15} total fields)`
  );
  lines.push("");
  lines.push(
    `| Complete | Partial | Missing | Needs Review |\n|---|---|---|---|\n| ${report.cellsComplete} | ${report.cellsPartial} | ${report.cellsMissing} | ${report.cellsNeedingReview} |`
  );
  lines.push("");

  for (const [profession, cells] of byProfession) {
    const complete = cells.filter((c) => c.status === "complete").length;
    const avgPct = Math.round(cells.reduce((s, c) => s + c.completionPct, 0) / cells.length);
    lines.push(`## ${profession}`);
    lines.push(`${complete}/${cells.length} states complete · ${avgPct}% average field coverage`);
    lines.push("");
    lines.push("| State | Status | Fields Complete |");
    lines.push("|---|---|---|");
    for (const cell of cells.sort((a, b) => a.state.localeCompare(b.state))) {
      const icon =
        cell.status === "complete" ? "✅" : cell.status === "partial" ? "🟡" : cell.status === "needs_manual_review" ? "🔴" : "⚪";
      lines.push(`| ${cell.state} | ${icon} ${cell.status} | ${cell.fieldsComplete}/${cell.fieldsTotal} |`);
    }
    lines.push("");
  }

  const mdPath = path.join(reportsDir, "coverage.md");
  fs.writeFileSync(mdPath, lines.join("\n"));

  return { jsonPath, mdPath, report };
}
