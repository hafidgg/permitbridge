/**
 * lib/monitoring/persistence.ts
 *
 * Phase 4.5: the ONLY module in the entire monitoring system authorized
 * to write to data/knowledge-base/facts/ or data/knowledge-base/
 * transfer-rules/ — and even here, only from inside applyAndPersistReview(),
 * and only for a successful "approve" action. Every other action
 * (reject/defer/request_research/mark_unavailable, and any failed/refused
 * approve) writes ONLY the DetectedChange record itself
 * (data/knowledge-base/monitoring/changes/), never a production file.
 *
 * This is where Phase 4.4's pure processReviewDecision() gets an actual
 * disk-backed lifecycle: load the change FRESH from disk (never trust a
 * caller's possibly-stale in-memory copy — this is what makes repeated
 * calls with the same changeId safely idempotent, inheriting Phase 4.4's
 * already-tested "already-decided change refuses a second decision"
 * guard for free), resolve which real file (if any) the change's field
 * lives in, run the pure decision function, then persist exactly what it
 * says to persist and nothing more.
 */
import fs from "node:fs";
import path from "node:path";
import type { DetectedChange } from "@/types/monitoring";
import type { VerifiedField } from "@/types/knowledge-base";
import { updateField } from "@/lib/knowledge-base/fields";
import { loadDetectedChange, updateDetectedChange, listDetectedChanges } from "./change-record";
import { processReviewDecision, type ReviewIntegrationAction, type ProcessReviewResult } from "./review-integration";

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts");
const TRANSFER_RULES_DIR = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules");

interface ResolvedEntityFile {
  kind: "profession-state-facts" | "transfer-rule";
  filePath: string;
}

/**
 * The minimal shape needed to locate a real fact/rule file — deliberately
 * NOT tied to DetectedChange specifically. DetectedChange already
 * structurally satisfies this (TypeScript structural typing), so this is
 * a pure widening, zero behavior change for every existing caller. Added
 * so the monitoring orchestrator can resolve a file directly from a
 * MonitoredSource's fieldMapping, without needing to fabricate a fake
 * DetectedChange just to call this function.
 */
export interface EntityLocator {
  profession?: string;
  jurisdiction: string;
  destinationJurisdiction?: string;
  field?: string;
}

/**
 * Maps an EntityLocator's identity fields to the real file that would
 * contain the field it refers to — without assuming the file (or the
 * field on it) actually exists. Returns null when there isn't enough
 * identity to resolve anywhere (e.g. a source-level CONTENT_CHANGED
 * signal with no specific field).
 */
export function resolveEntityFile(locator: EntityLocator): ResolvedEntityFile | null {
  if (!locator.profession || !locator.field) return null;

  if (locator.destinationJurisdiction) {
    return {
      kind: "transfer-rule",
      filePath: path.join(TRANSFER_RULES_DIR, locator.profession, `${locator.jurisdiction}-to-${locator.destinationJurisdiction}.json`),
    };
  }

  return { kind: "profession-state-facts", filePath: path.join(FACTS_DIR, locator.profession, `${locator.jurisdiction}.json`) };
}

export function loadFieldForChange(locator: EntityLocator): VerifiedField<unknown> | null {
  const resolved = resolveEntityFile(locator);
  if (!resolved || !locator.field) return null;
  if (!fs.existsSync(resolved.filePath)) return null;
  const data = JSON.parse(fs.readFileSync(resolved.filePath, "utf-8"));
  return data[locator.field] ?? null;
}

export interface ApplyAndPersistArgs {
  changeId: string;
  action: ReviewIntegrationAction;
  reviewer: string;
  reason: string;
  changesDir?: string;
}

export interface ApplyAndPersistResult extends ProcessReviewResult {
  productionFileWritten: boolean;
  productionFilePath?: string;
}

/** Best-effort staleness signal: has a NEWER, still-pending change been recorded for the same source+field+jurisdiction since this one was detected? Used only to feed processReviewDecision's staleness guard when no live MonitoredSource re-fetch is available (that wiring is Phase 4.6+ territory, once real sources exist). */
function findNewerPendingChangeForSameTarget(change: DetectedChange, changesDir?: string): DetectedChange | undefined {
  return listDetectedChanges(changesDir)
    .filter(
      (c) =>
        c.id !== change.id &&
        c.sourceId === change.sourceId &&
        c.field === change.field &&
        c.jurisdiction === change.jurisdiction &&
        c.status === "pending_verification" &&
        c.detectedAt > change.detectedAt
    )
    .sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1))[0];
}

/**
 * The single real entry point for acting on a persisted DetectedChange.
 * Always re-loads the change AND (when relevant) the real field from disk
 * fresh — never accepts a pre-loaded object from the caller — so that two
 * calls with the same changeId are safe regardless of ordering or
 * caller mistakes, and so the staleness guard (Phase 4.4, Step 6) always
 * compares against genuinely current data.
 */
export function applyAndPersistReview(args: ApplyAndPersistArgs): ApplyAndPersistResult {
  const change = loadDetectedChange(args.changeId, args.changesDir);
  if (!change) {
    throw new Error(`No DetectedChange found with id "${args.changeId}".`);
  }

  const needsField = args.action === "approve" || args.action === "reject" || args.action === "request_research";
  const currentField = needsField ? (loadFieldForChange(change) ?? undefined) : undefined;

  let currentSourceHash: string | null | undefined;
  if (args.action === "approve") {
    const newer = findNewerPendingChangeForSameTarget(change, args.changesDir);
    currentSourceHash = newer ? newer.newHash : change.newHash;
  }

  const result = processReviewDecision({
    change,
    action: args.action,
    reviewer: args.reviewer,
    reason: args.reason,
    currentField: currentField as VerifiedField<unknown> | undefined,
    currentSourceHash,
  });

  // The DetectedChange record itself is always persisted — even a refused
  // attempt gets its reviewLog/status update written, so the refusal
  // itself is auditable (e.g. a "superseded" stale-approval attempt).
  updateDetectedChange(result.updatedChange, args.changesDir);

  let productionFileWritten = false;
  let productionFilePath: string | undefined;

  if (result.success && args.action === "approve" && result.updatedField) {
    const resolved = resolveEntityFile(change);
    if (resolved && fs.existsSync(resolved.filePath)) {
      const data = JSON.parse(fs.readFileSync(resolved.filePath, "utf-8"));
      data[change.field!] = result.updatedField;
      fs.writeFileSync(resolved.filePath, JSON.stringify(data, null, 2) + "\n");
      productionFileWritten = true;
      productionFilePath = resolved.filePath;
    }
  }

  return { ...result, productionFileWritten, productionFilePath };
}

// ---------------------------------------------------------------------
// Rollback (Section 17 of the original Phase 4 spec)
// ---------------------------------------------------------------------

export interface RollbackArgs {
  changeId: string;
  reviewer: string;
  reason: string;
  changesDir?: string;
}

export interface RollbackResult {
  success: boolean;
  reason?: string;
  updatedChange?: DetectedChange;
  updatedField?: VerifiedField<unknown>;
}

/**
 * Reverses a previously-APPROVED change: the field's value is restored to
 * `change.previousValue` via updateField() (Phase 2.2's own mutation
 * primitive — reused, not reimplemented), which APPENDS a new history
 * entry rather than deleting anything — the approved value and the
 * rollback both remain permanently visible in the field's history, per
 * the explicit "never delete historical evidence" requirement.
 *
 * Only an "approved" change can be rolled back — there is nothing to
 * undo for a change that was rejected/deferred/marked-unavailable, since
 * those never touched a production field in the first place.
 *
 * After rollback, the field's status returns to "pending_verification"
 * (it is, honestly, no longer human-verified — the verified value was
 * just undone) and `reviewer` is cleared to null (the rollback action
 * itself isn't a review sign-off on a new value, it's an undo).
 */
export function rollbackChange(args: RollbackArgs): RollbackResult {
  const change = loadDetectedChange(args.changeId, args.changesDir);
  if (!change) return { success: false, reason: "change_not_found" };

  if (change.status !== "approved") {
    return { success: false, reason: `only an approved change can be rolled back — this change is "${change.status}"`, updatedChange: change };
  }

  const resolved = resolveEntityFile(change);
  if (!resolved || !change.field || !fs.existsSync(resolved.filePath)) {
    return { success: false, reason: "could_not_resolve_production_field", updatedChange: change };
  }

  const data = JSON.parse(fs.readFileSync(resolved.filePath, "utf-8"));
  const currentField = data[change.field] as VerifiedField<unknown> | undefined;
  if (!currentField) {
    return { success: false, reason: "field_not_found_in_production_file", updatedChange: change };
  }

  const reverted = updateField(currentField, {
    value: change.previousValue,
    sourceUrl: currentField.sourceUrl ?? "",
    sourceTitle: currentField.sourceTitle ?? "",
    sourceName: currentField.sourceName ?? "",
    verifiedAt: new Date().toISOString().slice(0, 10),
    verificationMethod: currentField.verificationMethod ?? "manual-review",
    confidence: currentField.confidence,
    status: "pending_verification",
    reviewer: null,
    reason: `ROLLBACK by ${args.reviewer}: ${args.reason} (reverting change ${args.changeId})`,
  });

  data[change.field] = reverted;
  fs.writeFileSync(resolved.filePath, JSON.stringify(data, null, 2) + "\n");

  const timestamp = new Date().toISOString();
  const updatedChange: DetectedChange = {
    ...change,
    status: "pending_verification",
    reviewLog: [...(change.reviewLog ?? []), { action: "rollback", reviewer: args.reviewer, reason: args.reason, timestamp }],
  };
  updateDetectedChange(updatedChange, args.changesDir);

  return { success: true, updatedChange, updatedField: reverted };
}
