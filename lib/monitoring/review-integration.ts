/**
 * lib/monitoring/review-integration.ts
 *
 * Phase 4.4: the ONLY module that connects a Phase 4.3 DetectedChange to
 * the existing Human Review / approval machinery. Reuses, verbatim:
 *
 *   - applyFieldReview()   (lib/knowledge-base/transfer-review.ts) — already
 *     schema-agnostic (VerifiedField<T> in, VerifiedField<T> out), so the
 *     exact same function approves/rejects a field whether it belongs to
 *     a ProfessionStateFacts record or a TransferRule. Not duplicated.
 *   - isDisallowedReviewerName()  (lib/knowledge-base/policy.ts) —
 *     reused transitively through applyFieldReview(); never re-checked
 *     separately, so there is exactly one place fake reviewers are caught.
 *   - ReviewPriority ("High"|"Medium"|"Low")  (lib/knowledge-base/
 *     transfer-review-queue.ts) — reused for display priority instead of
 *     inventing a second priority vocabulary alongside Phase 4.3's
 *     RiskLevel ("low"|"medium"|"high").
 *
 * This module NEVER writes to data/knowledge-base/facts/ or
 * transfer-rules/ directly — every mutation goes through
 * applyFieldReview(), and the caller (a future CLI/UI, not built in this
 * phase) remains responsible for actually persisting the returned
 * updatedField back into the real fact/rule file. Nothing here does that
 * persistence itself, which is exactly why Phase 4.4's own tests can
 * prove zero production mutation: the functions in this file, called in
 * isolation, structurally cannot reach a real file.
 */
import type { DetectedChange, ReviewLogEntry, ChangeReviewStatus } from "@/types/monitoring";
import type { VerifiedField } from "@/types/knowledge-base";
import { applyFieldReview, type ReviewDecision } from "@/lib/knowledge-base/transfer-review";
import type { RiskLevel } from "@/lib/pipeline/types";
import type { ReviewPriority } from "@/lib/knowledge-base/transfer-review-queue";

// ---------------------------------------------------------------------
// Step 2 — the integration contract: DetectedChange -> review-item projection
// ---------------------------------------------------------------------

export interface MonitoringReviewItem {
  sourceId: string;
  sourceUrl: string;
  detectedChangeId: string;
  detectedAt: string;
  contentHash: string;
  jurisdiction: string;
  profession?: string;
  field?: string;
  previousValue?: unknown;
  proposedValue?: unknown;
  classification: DetectedChange["classification"];
  confidence: number;
  evidenceTitle: string;
  evidenceExtractedText?: string;
  jurisdictionMismatch: boolean;
  status: ChangeReviewStatus;
  priority: ReviewPriority;
}

const RISK_TO_PRIORITY: Record<RiskLevel, ReviewPriority> = { high: "High", medium: "Medium", low: "Low" };

export function toReviewItem(change: DetectedChange, risk: RiskLevel): MonitoringReviewItem {
  return {
    sourceId: change.sourceId,
    sourceUrl: change.evidence.url,
    detectedChangeId: change.id,
    detectedAt: change.detectedAt,
    contentHash: change.newHash,
    jurisdiction: change.jurisdiction,
    profession: change.profession,
    field: change.field,
    previousValue: change.previousValue,
    proposedValue: change.proposedValue,
    classification: change.classification,
    confidence: change.confidence,
    evidenceTitle: change.evidence.title,
    evidenceExtractedText: change.evidence.extractedText,
    jurisdictionMismatch: change.jurisdictionMismatch,
    status: change.status,
    priority: RISK_TO_PRIORITY[risk],
  };
}

// ---------------------------------------------------------------------
// Step 3 — review action vocabulary, mapped onto EXISTING vocabulary
// wherever one exists, per the explicit instruction not to create
// competing enums.
// ---------------------------------------------------------------------

export type ReviewIntegrationAction = "approve" | "reject" | "request_research" | "mark_unavailable" | "defer";

/**
 * approve/reject/request_research map directly onto the EXISTING
 * ReviewDecision vocabulary (Phase 3.2) — request_research is simply this
 * phase's name for what Phase 3.2 already called "request_more_evidence."
 * mark_unavailable and defer have no field-level equivalent (they don't
 * touch a VerifiedField at all) and are handled separately below.
 */
const ACTION_TO_REVIEW_DECISION: Partial<Record<ReviewIntegrationAction, ReviewDecision>> = {
  approve: "approve",
  reject: "reject",
  request_research: "request_more_evidence",
};

export interface ProcessReviewArgs {
  change: DetectedChange;
  action: ReviewIntegrationAction;
  reviewer: string;
  reason: string;
  /** Required only for "approve" — the actual field this change proposes to update, read from the real fact/rule file by the caller. Never written to here; only ever read from and returned updated. */
  currentField?: VerifiedField<unknown>;
  /** Required only for "approve" — the MOST RECENTLY KNOWN content hash for this change's source (e.g. MonitoredSource.lastContentHash). Used for Step 6's staleness guard. */
  currentSourceHash?: string | null;
}

export interface ProcessReviewResult {
  success: boolean;
  reason?: string;
  updatedChange: DetectedChange;
  updatedField?: VerifiedField<unknown>;
}

// ---------------------------------------------------------------------
// Step 6 — stale/conflict protection
// ---------------------------------------------------------------------

export function isChangeStale(change: DetectedChange, currentSourceHash: string | null | undefined): boolean {
  if (!currentSourceHash) return false;
  return currentSourceHash !== change.newHash;
}

function appendLog(change: DetectedChange, entry: ReviewLogEntry): DetectedChange {
  return { ...change, reviewLog: [...(change.reviewLog ?? []), entry] };
}

// ---------------------------------------------------------------------
// Step 4/5/6/7 — the single entry point every review action goes through
// ---------------------------------------------------------------------

export function processReviewDecision(args: ProcessReviewArgs): ProcessReviewResult {
  const { change, action, reviewer, reason } = args;
  const timestamp = new Date().toISOString();

  if (change.status !== "pending_verification" && action !== "defer") {
    return {
      success: false,
      reason: `This change is already "${change.status}" — a decided change cannot be re-decided.`,
      updatedChange: change,
    };
  }

  const reviewerName = reviewer.trim();
  if (!reviewerName) {
    return { success: false, reason: "reviewer_missing", updatedChange: change };
  }

  if (action === "defer") {
    const logged = appendLog(change, { action: "defer", reviewer: reviewerName, reason, timestamp });
    return { success: true, updatedChange: logged };
  }

  if (action === "mark_unavailable") {
    const updated: DetectedChange = {
      ...appendLog(change, { action: "mark_unavailable", reviewer: reviewerName, reason, timestamp }),
      status: "source_unavailable",
    };
    return { success: true, updatedChange: updated };
  }

  if (!args.currentField) {
    return { success: false, reason: "currentField is required for approve/reject/request_research", updatedChange: change };
  }

  if (action === "approve" && isChangeStale(change, args.currentSourceHash)) {
    const stale: DetectedChange = {
      ...appendLog(change, {
        action: "approve",
        reviewer: reviewerName,
        reason: `REFUSED — stale: detected against hash ${change.newHash}, but the source's current known hash is ${args.currentSourceHash}. Re-run detection before approving.`,
        timestamp,
      }),
      status: "superseded",
    };
    return { success: false, reason: "stale_change", updatedChange: stale };
  }

  const decision = ACTION_TO_REVIEW_DECISION[action]!;
  const fieldResult = applyFieldReview(args.currentField, {
    decision,
    reviewer: reviewerName,
    reason,
    // Only "approve" ever changes a value — reject/request_research must
    // never silently swap in the proposed value while leaving status
    // anything other than verified; applyFieldReview's own default
    // (keep field.value) is exactly right for those two.
    newValue: action === "approve" ? change.proposedValue : undefined,
  });

  if (!fieldResult.applied) {
    return { success: false, reason: fieldResult.rejectionReason, updatedChange: change };
  }

  const newChangeStatus: ChangeReviewStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending_verification";
  const updatedChange: DetectedChange = {
    ...appendLog(change, { action, reviewer: reviewerName, reason, timestamp }),
    status: newChangeStatus,
  };

  return { success: true, updatedChange, updatedField: fieldResult.updatedField };
}
