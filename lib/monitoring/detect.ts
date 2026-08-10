/**
 * lib/monitoring/detect.ts
 *
 * Phase 4.3: the CHANGE DETECTION + CLASSIFICATION stage. Pure functions
 * only — nothing here reads or writes any file. Given a fetch outcome
 * (Phase 4.2), an optional extraction rule (reusing lib/pipeline/extract.ts's
 * applyRule directly), and the current real value already on record, this
 * module decides what classification a DetectedChange should carry and
 * whether a proposedValue can be confidently included at all.
 *
 * The single rule everything here obeys: a value is only ever proposed
 * when extraction actually matched. Ambiguous content ("Fees have
 * changed.") produces a classification with NO proposedValue — never a
 * guess (Section 13).
 */
import type { ExtractRule } from "@/lib/pipeline/types";
import { applyRule } from "@/lib/pipeline/extract";
import type { ChangeClassification, DetectedChangeEvidence } from "@/types/monitoring";
import { compareHashes } from "./normalize";
import { classifyFieldChangeCategory } from "./field-classification";

export interface DetectFieldChangeArgs {
  field?: string; // omit for a source-level-only check (no specific fact field implicated)
  currentValue: unknown; // "Unknown" or a real value, from the actual VerifiedField already on record
  extractRule?: ExtractRule; // omit if no extraction is configured for this field yet
  previousHash: string | null | undefined;
  newHash: string;
  fetchStatus: "ok" | "not_modified" | "error";
  rawText?: string; // the fetched, normalized text — required for extraction, absent on fetch failure
  confidenceFromExtraction?: number; // 0-1, e.g. matchedCount/totalRules from a broader multi-rule extraction pass
}

export interface DetectFieldChangeResult {
  classification: ChangeClassification;
  proposedValue?: unknown;
  confidence: number;
  extractedText?: string;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Section 9 + 10 + 11 + 13, combined into one deterministic decision.
 * Never throws for a normal ambiguous-extraction case — extraction
 * failures that genuinely can't be classified any other way become
 * PARSER_ERROR, caught explicitly, not left to propagate as an exception.
 */
export function detectFieldChange(args: DetectFieldChangeArgs): DetectFieldChangeResult {
  if (args.fetchStatus === "error") {
    return { classification: "SOURCE_UNAVAILABLE", confidence: 0 };
  }

  const hashComparison = compareHashes(args.previousHash, args.newHash);
  if (hashComparison === "NO_CHANGE") {
    return { classification: "NO_CHANGE", confidence: 1 };
  }

  // Hash changed. If no field is implicated, this is a generic, source-level signal only.
  if (!args.field) {
    return { classification: "CONTENT_CHANGED", confidence: 1 };
  }

  const category = classifyFieldChangeCategory(args.field);

  if (!args.extractRule || args.rawText === undefined) {
    // No extraction configured/possible yet — we know the page changed and
    // which field it MIGHT concern (by category), but cannot propose a value.
    return { classification: category, confidence: 0 };
  }

  let extraction: { value: unknown; matched: boolean };
  try {
    extraction = applyRule(args.extractRule, args.rawText);
  } catch {
    return { classification: "PARSER_ERROR", confidence: 0 };
  }

  if (!extraction.matched) {
    // Ambiguous — Section 13's exact scenario. The page changed, we know
    // roughly what KIND of fact this field is, but couldn't confidently
    // read a new value out of it. No guessing.
    return { classification: category, confidence: 0, extractedText: args.rawText.slice(0, 500) };
  }

  if (valuesEqual(extraction.value, args.currentValue)) {
    // The page's hash changed, but this specific field's extracted value
    // didn't — Section 9's explicit warning against assuming every
    // content change means a licensing fact changed. No field-level
    // change to report; the caller may still want the generic
    // CONTENT_CHANGED signal, but that's a source-level concern, not this field's.
    return { classification: "NO_CHANGE", confidence: 1 };
  }

  return {
    classification: category,
    proposedValue: extraction.value,
    confidence: args.confidenceFromExtraction ?? 1,
    extractedText: args.rawText.slice(0, 500),
  };
}

export function buildEvidence(url: string, title: string, fetchedAt: string, extractedText?: string): DetectedChangeEvidence {
  return { url, title, fetchedAt, extractedText };
}
