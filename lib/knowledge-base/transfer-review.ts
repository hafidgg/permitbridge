/**
 * lib/knowledge-base/transfer-review.ts
 *
 * Phase 3.2: the workflow separating Research → Pending Review →
 * Human Review → Verified → Publishable for TransferRule. This module
 * intentionally reuses everything from Phases 2.x/3.0 rather than
 * duplicating it:
 *
 *   - Field review status IS VerifiedField.status (the existing
 *     VerificationStatus enum already covers the requested lifecycle —
 *     see the mapping documented below, no new enum was created).
 *   - Actually applying a review decision reuses updateField() from
 *     lib/knowledge-base/fields.ts (Phase 2.2) — a review is just an
 *     update with verificationMethod: "manual-review" and a real reviewer.
 *   - Reviewer-name fraud prevention reuses isDisallowedReviewerName()
 *     from lib/knowledge-base/policy.ts (Phase 2.2).
 *   - Source authority/jurisdiction reuses SourceRecord and
 *     validateTransferRule() from Phase 3.0/3.1.
 *
 * Nothing here writes to data/knowledge-base/transfer-rules/ — every
 * function is pure (rule in, decision in, updated rule out), so this
 * phase can build and test the entire workflow without ever touching
 * the 5 real records populated in Phase 3.1.
 */
import type { TransferRule, TransferRuleFactFieldKey } from "@/types/transfer-rule";
import type { SourceRecord, VerifiedField, VerificationStatus } from "@/types/knowledge-base";
import { updateField } from "./fields";
import { isDisallowedReviewerName } from "./policy";
import { validateTransferRule } from "./transfer-rule-schema";

// ---------------------------------------------------------------------
// Status lifecycle mapping (Step 3): NO new enum was created.
// ---------------------------------------------------------------------
//
// Requested lifecycle -> existing VerificationStatus value (from Phase 2.1):
//   "Pending Verification" -> "pending_verification"
//   "Needs Review"          -> "needs_review"
//   "Verified"              -> "verified"
//   "Conflicting"           -> "conflicting_sources"
//   "Deprecated"            -> "deprecated"
//
// All 5 requested states already existed. Extending VerificationStatus
// was unnecessary and was NOT done, per the instruction to avoid
// duplicate statuses.

export const ALL_TRANSFER_RULE_FIELD_KEYS: TransferRuleFactFieldKey[] = [
  "transferMechanism",
  "endorsementProcess",
  "reciprocityAgreementExists",
  "universalRecognitionApplies",
  "examRequirement",
  "experienceRequirement",
  "applicationFeeUsd",
  "otherRequiredFees",
  "backgroundCheckRequirement",
  "fingerprintingRequirement",
  "licenseVerificationRequirement",
  "documentsRequired",
  "goodStandingRequirement",
  "disciplinaryDisclosureRequirement",
  "processingTime",
  "temporaryPermitAvailability",
  "compactStatus",
  "exceptions",
];

// ---------------------------------------------------------------------
// Critical fields (Step 7) — derived from actual user purpose, not
// assumed. PermitBridge exists to tell someone exactly what a license
// transfer requires; a field is CRITICAL if getting it wrong could cause
// a real person to (a) follow the wrong legal pathway entirely, (b) miss
// a legally-required step, or (c) be financially blindsided beyond a
// reasonable estimate. Fields that only affect convenience/timeline
// planning, not legal correctness, are SUPPORTING.
// ---------------------------------------------------------------------

export const CRITICAL_TRANSFER_RULE_FIELDS: TransferRuleFactFieldKey[] = [
  "transferMechanism", // wrong pathway = wrong process entirely
  "examRequirement", // missing a required exam blocks licensure outright
  "experienceRequirement", // e.g. Georgia's real 500-hour reentry rule — silently missing this can force an unplanned reentry program
  "applicationFeeUsd", // financial surprise beyond a reasonable estimate
  "backgroundCheckRequirement", // a legally required step if applicable
  "fingerprintingRequirement", // a legally required step if applicable
  "licenseVerificationRequirement", // universally required in some form; wrong info stalls every application
  "goodStandingRequirement", // a legal eligibility gate
  "disciplinaryDisclosureRequirement", // legal honesty/disclosure obligation with real consequences if wrong
];

export const SUPPORTING_TRANSFER_RULE_FIELDS: TransferRuleFactFieldKey[] = ALL_TRANSFER_RULE_FIELD_KEYS.filter(
  (k) => !CRITICAL_TRANSFER_RULE_FIELDS.includes(k as TransferRuleFactFieldKey)
);

export function isCriticalField(field: TransferRuleFactFieldKey): boolean {
  return CRITICAL_TRANSFER_RULE_FIELDS.includes(field);
}

// ---------------------------------------------------------------------
// Field-level review (Step 2 & 4): approving one field never touches another.
// ---------------------------------------------------------------------

export type ReviewDecision = "approve" | "reject" | "request_more_evidence";

export interface FieldReviewResult<T> {
  updatedField: VerifiedField<T>;
  applied: boolean;
  rejectionReason?: string;
}

/**
 * Applies ONE human review decision to ONE field. Never touches any other
 * field on the rule — the caller decides which field to pass in, and only
 * that field's VerifiedField object is returned updated.
 *
 * A fabricated reviewer name (including "AI", "Claude", "system",
 * "automated") is rejected outright — `applied: false`, the field is
 * returned completely unchanged.
 *
 * `newValue` (Phase 4.5): optional. Phase 3.2's original use case was
 * "confirm this already-researched value is correct" — the value itself
 * never changes, only its status/reviewer. Phase 4.5's monitoring
 * approval flow needs a genuinely different operation: "apply this
 * PROPOSED new value from a DetectedChange." Passing `newValue` covers
 * that case; omitting it (every existing caller, unchanged) preserves
 * the exact original behavior — `field.value` carries through untouched.
 */
export function applyFieldReview<T>(
  field: VerifiedField<T>,
  args: { decision: ReviewDecision; reviewer: string; reason: string; newValue?: T }
): FieldReviewResult<T> {
  const reviewerName = args.reviewer.trim();

  if (!reviewerName) {
    return { updatedField: field, applied: false, rejectionReason: "reviewer_missing" };
  }
  if (isDisallowedReviewerName(reviewerName)) {
    return { updatedField: field, applied: false, rejectionReason: "reviewer_is_fabricated_placeholder" };
  }
  if (field.value === "Unknown") {
    return { updatedField: field, applied: false, rejectionReason: "cannot_review_an_unknown_field" };
  }
  if (!field.sourceUrl) {
    return { updatedField: field, applied: false, rejectionReason: "field_has_no_evidence_to_review" };
  }

  let newStatus: VerificationStatus;
  if (args.decision === "approve") newStatus = "verified";
  else if (args.decision === "reject") newStatus = "needs_review";
  else newStatus = "pending_verification"; // request_more_evidence: stays pending, but the reason is recorded

  const updated = updateField(field, {
    value: args.newValue !== undefined ? args.newValue : (field.value as T),
    sourceUrl: field.sourceUrl,
    sourceTitle: field.sourceTitle ?? "",
    sourceName: field.sourceName ?? "",
    verifiedAt: new Date().toISOString().slice(0, 10),
    verificationMethod: "manual-review",
    confidence: args.decision === "approve" ? Math.max(field.confidence, 0.95) : field.confidence,
    status: newStatus,
    reviewer: reviewerName,
    reason: `Human review (${args.decision}) by ${reviewerName}: ${args.reason}`,
  });

  return { updatedField: updated, applied: true };
}

// ---------------------------------------------------------------------
// Secondary-source field detection (Step 8)
// ---------------------------------------------------------------------

export interface SecondarySourcedFieldInfo {
  field: TransferRuleFactFieldKey;
  isCritical: boolean;
  sourceId: string | null;
  sourceAgency: string | null;
}

export function getSecondarySourcedFields(
  rule: TransferRule,
  resolveSource: (url: string) => SourceRecord | undefined
): SecondarySourcedFieldInfo[] {
  const result: SecondarySourcedFieldInfo[] = [];
  for (const key of ALL_TRANSFER_RULE_FIELD_KEYS) {
    const field = rule[key] as VerifiedField<unknown>;
    if (field.value === "Unknown" || !field.sourceUrl) continue;
    const source = resolveSource(field.sourceUrl);
    if (source && source.authorityLevel === "supplementary") {
      result.push({ field: key, isCritical: isCriticalField(key), sourceId: source.id, sourceAgency: source.agencyName });
    }
  }
  return result;
}

// ---------------------------------------------------------------------
// Publication gate (Step 5) — TWO distinct, deliberately separate concepts.
// ---------------------------------------------------------------------

export interface PublicationCheckResult {
  publishable: boolean;
  blockingReasons: string[];
}

/**
 * Can this rule appear on a live page AT ALL (with honest "pending human
 * review" labeling on every unreviewed fact)? This does NOT require any
 * field to be human-Verified — per the Partial Data Policy (Step 6), an
 * AI-researched, evidence-backed, honestly-labeled rule is allowed to
 * exist publicly. What it does NOT allow:
 *   - any populated field without real evidence (reuses schema Rule 4)
 *   - any CRITICAL field whose ONLY evidence is a secondary source
 *     (Step 8: "the field remains unverified until an authoritative
 *     source is found" — for critical facts specifically, that means
 *     blocked from publication, not just low-confidence)
 *   - any CRITICAL field with an unresolved conflict
 *   - a fabricated reviewer anywhere
 *   - invalid source jurisdiction anywhere
 */
export function isTransferRulePublishable(
  rule: TransferRule,
  resolveSource: (url: string) => SourceRecord | undefined,
  knownProfessionSlugs: Set<string>
): PublicationCheckResult {
  const reasons: string[] = [];

  const schemaIssues = validateTransferRule(rule, resolveSource, knownProfessionSlugs);
  const schemaErrors = schemaIssues.filter((i) => i.severity === "error");
  for (const issue of schemaErrors) reasons.push(`Schema Rule ${issue.rule}: ${issue.message}`);

  // Critical field secondary-only evidence blocks publication.
  const secondaryFields = getSecondarySourcedFields(rule, resolveSource);
  for (const info of secondaryFields.filter((f) => f.isCritical)) {
    reasons.push(`Critical field "${info.field}" relies only on a secondary source (${info.sourceAgency}) — needs an authoritative source before publication.`);
  }

  // Critical field with an unresolved conflict blocks publication.
  const conflictedCriticalFields = new Set(
    rule.conflicts.filter((c) => c.resolution === "unresolved" && CRITICAL_TRANSFER_RULE_FIELDS.includes(c.field as TransferRuleFactFieldKey)).map((c) => c.field)
  );
  for (const field of conflictedCriticalFields) {
    reasons.push(`Critical field "${field}" has an unresolved conflict — cannot publish until resolved.`);
  }

  return { publishable: reasons.length === 0, blockingReasons: reasons };
}

/**
 * The STRICTER, separate concept: true only when EVERY critical field is
 * human-Verified (status "verified" AND a real, non-fabricated reviewer).
 * This is what should gate removing "pending human review" UI labeling —
 * NOT the same thing as isTransferRulePublishable(), by design, per the
 * explicit instruction that AI research alone must never be presented as
 * human verification.
 */
export function isTransferRuleFullyHumanVerified(rule: TransferRule): boolean {
  return CRITICAL_TRANSFER_RULE_FIELDS.every((key) => {
    const field = rule[key] as VerifiedField<unknown>;
    const hasRealReviewer = typeof field.reviewer === "string" && field.reviewer.trim().length > 0 && !isDisallowedReviewerName(field.reviewer);
    return field.status === "verified" && hasRealReviewer;
  });
}

// ---------------------------------------------------------------------
// Partial Data Policy (Step 6) — coverage classification
// ---------------------------------------------------------------------

export type TransferRuleCoverageClass = "fully_verified" | "partially_verified" | "insufficient_evidence" | "blocked_by_conflict";

export function classifyTransferRuleCoverage(
  rule: TransferRule,
  resolveSource: (url: string) => SourceRecord | undefined,
  knownProfessionSlugs: Set<string>
): TransferRuleCoverageClass {
  const hasUnresolvedCriticalConflict = rule.conflicts.some(
    (c) => c.resolution === "unresolved" && CRITICAL_TRANSFER_RULE_FIELDS.includes(c.field as TransferRuleFactFieldKey)
  );
  if (hasUnresolvedCriticalConflict) return "blocked_by_conflict";

  const { publishable } = isTransferRulePublishable(rule, resolveSource, knownProfessionSlugs);
  if (!publishable) return "insufficient_evidence";

  if (isTransferRuleFullyHumanVerified(rule)) return "fully_verified";

  return "partially_verified";
}
