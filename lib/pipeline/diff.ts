/**
 * lib/pipeline/diff.ts
 *
 * Deep-diffs a "current" record against a "proposed" record and classifies
 * every changed field by risk. This classification is what decides whether
 * a change auto-applies or waits for human approval (see update.ts).
 *
 * Philosophy: anything that changes *what a person is legally told to do*
 * (exam required? which pathway? compact membership?) is high risk. Prose
 * and administrative metadata is low risk. Numbers in between (fees,
 * processing days) are medium risk unless the swing is large.
 */
import type { FieldChange, DiffResult, RiskLevel, EntityKind } from "./types";

const HIGH_RISK_FIELDS = new Set([
  "isUlrState",
  "hasNationalCompact",
  "compactStates",
  "pathway",
  "pathwayLabel",
  "examRequired",
  "commonExamAcceptedStates",
]);

const LOW_RISK_FIELDS = new Set([
  "updatedAt",
  "verifiedAt",
  "sourceUrl",
  "notes",
  "licensingAuthorityNote",
  "description",
  "longDescription",
]);

function classifyRisk(path: string, before: unknown, after: unknown): RiskLevel {
  const field = path.split(".")[0] ?? path;

  if (HIGH_RISK_FIELDS.has(field)) return "high";
  if (LOW_RISK_FIELDS.has(field)) return "low";

  // Numeric fields: large relative swings are medium risk, small ones are low.
  if (typeof before === "number" && typeof after === "number" && before !== 0) {
    const relativeChange = Math.abs(after - before) / Math.abs(before);
    return relativeChange > 0.25 ? "medium" : "low";
  }

  return "medium";
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffObjects(before: Record<string, unknown>, after: Record<string, unknown>, prefix = ""): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of keys) {
    if (key === "faqs") continue; // long-form editorial content — reviewed separately, never auto-diffed field-by-field
    const path = prefix ? `${prefix}.${key}` : key;
    const beforeVal = before?.[key];
    const afterVal = after?.[key];

    if (!isEqual(beforeVal, afterVal)) {
      changes.push({ path, before: beforeVal, after: afterVal, risk: classifyRisk(path, beforeVal, afterVal) });
    }
  }

  return changes;
}

export function diffRecords(
  entityKind: EntityKind,
  entitySlug: string,
  sourceId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): DiffResult {
  if (!before || !after) {
    return { entityKind, entitySlug, sourceId, hasChanges: false, changes: [], highestRisk: null };
  }

  const changes = diffObjects(before, after);
  const riskOrder: RiskLevel[] = ["low", "medium", "high"];
  const highestRisk =
    changes.length === 0 ? null : changes.reduce<RiskLevel>((acc, c) => (riskOrder.indexOf(c.risk) > riskOrder.indexOf(acc) ? c.risk : acc), "low");

  return { entityKind, entitySlug, sourceId, hasChanges: changes.length > 0, changes, highestRisk };
}
