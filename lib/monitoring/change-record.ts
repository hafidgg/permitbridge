/**
 * lib/monitoring/change-record.ts
 *
 * Phase 4.3: builds and stores DetectedChange records. Storage is
 * idempotent by construction — buildDetectedChangeId() derives the id
 * from sourceId + newHash (+ field, when applicable), per Section 21's
 * explicit suggestion, so a repeated run against unchanged content always
 * produces the SAME id and saveDetectedChange() refuses to create a
 * second file for an id that already exists.
 *
 * This module NEVER touches data/knowledge-base/facts/ or
 * data/knowledge-base/transfer-rules/ — it only ever reads/writes
 * data/knowledge-base/monitoring/changes/. Production facts are read
 * elsewhere (by the caller, to supply `currentValue`/`previousValue`)
 * and never written here at all.
 */
import fs from "node:fs";
import path from "node:path";
import type { DetectedChange, ChangeClassification, DetectedChangeEvidence } from "@/types/monitoring";
import type { DetectFieldChangeResult } from "./detect";

const CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes");

export function buildDetectedChangeId(sourceId: string, newHash: string, field?: string): string {
  return field ? `${sourceId}-${newHash}-${field}` : `${sourceId}-${newHash}`;
}

export interface BuildDetectedChangeArgs {
  sourceId: string;
  jurisdiction: string;
  destinationJurisdiction?: string; // Phase 4.5 — see the field's doc comment in types/monitoring.ts
  profession?: string;
  field?: string;
  previousValue?: unknown;
  previousHash?: string | null;
  newHash: string;
  detectionResult: DetectFieldChangeResult;
  evidence: DetectedChangeEvidence;
  detectedAt: string;
  /** The MonitoredSource's own declared jurisdiction — compared against `jurisdiction` (the fact's jurisdiction) to surface a mismatch. Omit if the source is national/federal-scoped (never mismatched). */
  sourceJurisdiction?: string;
}

export function buildDetectedChange(args: BuildDetectedChangeArgs): DetectedChange {
  const jurisdictionMismatch =
    !!args.sourceJurisdiction &&
    args.sourceJurisdiction !== "national" &&
    args.sourceJurisdiction !== "federal" &&
    args.sourceJurisdiction !== args.jurisdiction;

  return {
    id: buildDetectedChangeId(args.sourceId, args.newHash, args.field),
    sourceId: args.sourceId,
    jurisdiction: args.jurisdiction,
    destinationJurisdiction: args.destinationJurisdiction,
    profession: args.profession,
    field: args.field,
    previousValue: args.previousValue,
    proposedValue: args.detectionResult.proposedValue,
    previousHash: args.previousHash,
    newHash: args.newHash,
    detectedAt: args.detectedAt,
    classification: args.detectionResult.classification,
    evidence: { ...args.evidence, extractedText: args.detectionResult.extractedText ?? args.evidence.extractedText },
    confidence: args.detectionResult.confidence,
    jurisdictionMismatch,
    status: "pending_verification",
  };
}

function changeFilePath(id: string, dir: string): string {
  // Change ids can contain characters (e.g. from a URL-derived hash) that
  // are already filesystem-safe here since ids are built from source ids
  // and hex hashes only — no raw user/page content ever becomes part of
  // an id or filename.
  return path.join(dir, `${id}.json`);
}

export interface SaveDetectedChangeResult {
  created: boolean; // false when a change with this exact id already existed — the idempotent no-op case
  change: DetectedChange;
}

/**
 * Idempotent save: if a file for this exact id already exists, it is
 * NEVER overwritten — the existing record (which may already carry a
 * human's review decision) is authoritative. A repeated detection run
 * against genuinely unchanged content never reaches this function at all
 * (detectFieldChange returns NO_CHANGE first), but this function is
 * idempotent even if called directly with the same inputs twice.
 */
export function saveDetectedChange(change: DetectedChange, dir: string = CHANGES_DIR): SaveDetectedChangeResult {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = changeFilePath(change.id, dir);

  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf-8")) as DetectedChange;
    return { created: false, change: existing };
  }

  fs.writeFileSync(filePath, JSON.stringify(change, null, 2) + "\n");
  return { created: true, change };
}

export function loadDetectedChange(id: string, dir: string = CHANGES_DIR): DetectedChange | undefined {
  const filePath = changeFilePath(id, dir);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as DetectedChange;
}

export function listDetectedChanges(dir: string = CHANGES_DIR): DetectedChange[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as DetectedChange);
}

export function listDetectedChangesByClassification(classification: ChangeClassification, dir: string = CHANGES_DIR): DetectedChange[] {
  return listDetectedChanges(dir).filter((c) => c.classification === classification);
}

/**
 * Phase 4.5: the deliberate COUNTERPART to saveDetectedChange()'s
 * create-only idempotency. This function DOES overwrite — it exists
 * specifically for persisting the result of a review decision (status
 * changing from pending_verification to approved/rejected/etc, or a
 * reviewLog entry being appended), which by definition must write to an
 * ALREADY-EXISTING record. It throws if the record doesn't already
 * exist, on the theory that "updating" something that was never detected
 * is a caller bug, not a legitimate new-record scenario (use
 * saveDetectedChange for that).
 */
export function updateDetectedChange(change: DetectedChange, dir: string = CHANGES_DIR): void {
  const filePath = changeFilePath(change.id, dir);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cannot update DetectedChange "${change.id}" — no existing record found. Use saveDetectedChange() to create a new one.`);
  }
  fs.writeFileSync(filePath, JSON.stringify(change, null, 2) + "\n");
}
