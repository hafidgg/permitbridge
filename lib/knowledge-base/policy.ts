/**
 * lib/knowledge-base/policy.ts
 *
 * Programmatic enforcement of the Verification Policy (see
 * data/knowledge-base/VERIFICATION_POLICY.md for the human-readable
 * version — this file is the executable version of the same 7 rules,
 * used by the test suite and available for any future promotion workflow
 * to call before ever setting status: "verified").
 */
import type { VerifiedField, SourceRecord, ConflictRecord, ConflictSourceSnapshot } from "@/types/knowledge-base";
import { isAuthoritativeForField } from "./authority-mapping";
import { buildConflictRecord } from "./conflict";

export interface PolicyCheckResult {
  canMarkVerified: boolean;
  failedConditions: string[];
}

/**
 * The 7 conditions from the Verification Policy. ALL must pass. This
 * function only ever returns whether the conditions are met — it never
 * mutates a field or sets status itself. That stays a deliberate, separate
 * step performed by whoever (human or process) is actually doing the
 * verifying.
 *
 * `fieldPath` (added Phase 2.2) makes condition 2 field-aware: a source
 * being "authoritative" in general is not enough — it must be
 * authoritative FOR THIS SPECIFIC FIELD per authority-mapping.ts. NCSBN
 * is authoritative for `requiredExams`; it is NOT authoritative for a
 * state's `rnEndorsementFeeUsd` just because it's an official national
 * organization. Passing no `fieldPath` falls back to the old
 * general-authority check for backward compatibility with Phase 2.1 code.
 */
export function checkCanMarkVerified<T>(
  field: VerifiedField<T>,
  source: SourceRecord | undefined,
  opts: { requireManualReview: boolean; fieldPath?: string; jurisdiction?: string }
): PolicyCheckResult {
  const failed: string[] = [];

  // 1. The value exists.
  if (field.value === "Unknown") failed.push("value_missing");

  // 2. The source is authoritative — FOR THIS SPECIFIC FIELD, when a
  //    fieldPath is provided (see authority-mapping.ts).
  if (!source) {
    failed.push("source_unresolved");
  } else if (opts.fieldPath) {
    if (!isAuthoritativeForField(opts.fieldPath, source.sourceType)) {
      failed.push("source_not_authoritative_for_this_field");
    }
  } else if (source.authorityLevel !== "authoritative") {
    failed.push("source_not_authoritative");
  }

  // 2b. Jurisdiction compatibility (Phase 2.5): a state-specific source is
  //     only authoritative for FACTS ABOUT THAT SAME STATE. A California
  //     source can never verify a Texas fee, even though both are
  //     "official-board" sources in good standing. National/federal
  //     sources (compacts, NCSBN) are jurisdiction-agnostic by design.
  if (source && opts.jurisdiction && source.jurisdiction !== "national" && source.jurisdiction !== "federal") {
    if (source.jurisdiction !== opts.jurisdiction) {
      failed.push("source_jurisdiction_mismatch");
    }
  }

  // 3. The source URL is valid (structurally — this policy check cannot
  //    confirm liveness/HTTP 200 on its own; that's the fetch layer's job).
  if (!field.sourceUrl) {
    failed.push("source_url_missing");
  } else {
    try {
      new URL(field.sourceUrl);
    } catch {
      failed.push("source_url_malformed");
    }
  }

  // 4. The source actually supports the specific value. This cannot be
  //    fully automated (it requires reading comprehension), so this
  //    function requires an explicit affirmation via notes/verification
  //    method rather than assuming it. A field with no verificationMethod
  //    recorded fails this condition.
  if (!field.verificationMethod) failed.push("source_support_unconfirmed");

  // 5. Verification date exists.
  if (!field.verifiedAt) failed.push("verified_at_missing");

  // 6. Verification method exists. (duplicate-safe with condition 4's check)
  if (!field.verificationMethod) failed.push("verification_method_missing");

  // 7. A real reviewer exists when manual review is required.
  if (opts.requireManualReview) {
    const hasRealReviewer = typeof field.reviewer === "string" && field.reviewer.trim().length > 0;
    const isFakeReviewer = hasRealReviewer && isDisallowedReviewerName(field.reviewer as string);
    if (!hasRealReviewer) failed.push("reviewer_missing");
    if (isFakeReviewer) failed.push("reviewer_is_fabricated_placeholder");
  }

  // De-duplicate condition 4/6 overlap for a clean report.
  const uniqueFailed = Array.from(new Set(failed));

  return { canMarkVerified: uniqueFailed.length === 0, failedConditions: uniqueFailed };
}

const DISALLOWED_REVIEWER_NAMES = new Set([
  "claude", "ai", "system", "automatic", "automated", "bot", "assistant", "chatgpt", "gpt",
  "n/a", "none", "unknown", "reviewer", "human", "llm", "model", "openai", "anthropic",
]);

/** Guards against exactly the failure mode this phase was created to prevent. */
export function isDisallowedReviewerName(reviewer: string): boolean {
  return DISALLOWED_REVIEWER_NAMES.has(reviewer.trim().toLowerCase());
}

/**
 * Compares two VerifiedField values for the same fact. If both are
 * populated, both cite an authoritative source, and they disagree, this
 * returns a ConflictRecord rather than silently preferring one — per the
 * Source Conflict Policy. Returns null when there is no conflict to record
 * (values agree, or one/both sides are Unknown/non-authoritative).
 *
 * Phase 2.6: now delegates actual winner selection to
 * resolveSourceConflict() in lib/knowledge-base/conflict.ts (specificity →
 * explicitness → recency) instead of leaving every conflict "unresolved."
 * A conflict is still never silently dropped — the losing side's full
 * evidence is preserved in the returned record either way.
 */
export function detectConflict<T>(
  fieldPath: string,
  a: { field: VerifiedField<T>; source: SourceRecord | undefined; label?: string },
  b: { field: VerifiedField<T>; source: SourceRecord | undefined; label?: string }
): ConflictRecord | null {
  if (a.field.value === "Unknown" || b.field.value === "Unknown") return null;
  if (a.source?.authorityLevel !== "authoritative" || b.source?.authorityLevel !== "authoritative") return null;
  if (JSON.stringify(a.field.value) === JSON.stringify(b.field.value)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const snapshotA: ConflictSourceSnapshot = {
    value: String(a.field.value),
    url: a.field.sourceUrl ?? a.source.website,
    agencyName: a.source.agencyName,
    title: a.label ?? a.source.agencyName,
    jurisdiction: a.source.jurisdiction,
    authorityLevel: a.source.authorityLevel,
    specificity: a.source.specificity,
    observedAt: a.field.verifiedAt ?? today,
  };
  const snapshotB: ConflictSourceSnapshot = {
    value: String(b.field.value),
    url: b.field.sourceUrl ?? b.source.website,
    agencyName: b.source.agencyName,
    title: b.label ?? b.source.agencyName,
    jurisdiction: b.source.jurisdiction,
    authorityLevel: b.source.authorityLevel,
    specificity: b.source.specificity,
    observedAt: b.field.verifiedAt ?? today,
  };

  return buildConflictRecord({
    field: fieldPath,
    a: snapshotA,
    b: snapshotB,
    reasonForConflict: `Two authoritative sources report different values for ${fieldPath}.`,
  });
}
