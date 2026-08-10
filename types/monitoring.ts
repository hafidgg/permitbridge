/**
 * types/monitoring.ts
 *
 * Phase 4.1: the MonitoredSource model — "we periodically check this URL
 * for changes." This is deliberately a SEPARATE, logically distinct
 * concept from SourceRecord (types/knowledge-base.ts), which means
 * "this source is cited as evidence for a specific fact." A MonitoredSource
 * doesn't have to back any fact yet (e.g. we might watch a state's general
 * licensing-news page before any specific fact cites it); conversely a
 * SourceRecord doesn't need active monitoring to remain valid evidence for
 * a fact a human already verified by hand.
 *
 * Per Phase 4 Section 5's explicit instruction, this file does NOT
 * duplicate SourceRecord's authority/specificity vocabulary — it reuses
 * the exact same types from types/knowledge-base.ts, so a MonitoredSource
 * and the SourceRecord it may eventually support always speak the same
 * authority language.
 */
import type { AuthorityLevel, SourceSpecificity, SourceType } from "./knowledge-base";
import type { ExtractRule } from "@/lib/pipeline/types";

export type MonitoredSourceStatus = "active" | "paused" | "failed";

/**
 * NEXT STEP (post-4.7): the field-level mapping that connects a
 * MonitoredSource to a specific real fact. Reuses ExtractRule
 * (lib/pipeline/types.ts) directly — the exact same extraction primitive
 * the live-site pipeline and lib/monitoring/detect.ts already use, not a
 * new parallel extraction concept. Optional: a source with no
 * fieldMapping is monitored at the source/content level only (Phase
 * 4.6/4.7's existing, unchanged behavior).
 */
export interface MonitoredSourceFieldMapping {
  /** Must match a real field name on ProfessionStateFacts or TransferRule — never invented. */
  field: string;
  extractRule: ExtractRule;
  /** Set only when the target is a TransferRule field, mirroring DetectedChange.destinationJurisdiction (Phase 4.5) — omitted for a ProfessionStateFacts target. */
  destinationJurisdiction?: string;
}

export interface MonitoredSource {
  id: string; // stable slug, e.g. "tx-bon-endorsement-page" — distinct namespace from SourceRecord.id, though the two MAY share a value when they refer to the same URL
  url: string;
  title: string;
  jurisdiction: string; // state slug, "national", or "federal" — same vocabulary as SourceRecord.jurisdiction
  profession?: string; // profession slug; omitted for jurisdiction-general sources
  sourceType: SourceType; // reused from knowledge-base — no redefinition
  authority: AuthorityLevel; // reused from knowledge-base — no redefinition
  specificity: SourceSpecificity; // reused from knowledge-base — no redefinition

  checkFrequencyDays: number;
  lastCheckedAt?: string | null; // ISO date of the most recent fetch attempt, successful or not
  lastSuccessfulFetchAt?: string | null; // ISO date of the most recent fetch that returned usable content — this IS Phase 4.6's "lastSuccessfulCheckAt" concept; not renamed, reused as-is
  /** Phase 4.6: ISO date the content hash last ACTUALLY differed from its previous value — distinct from lastCheckedAt/lastSuccessfulFetchAt, which advance on every successful check regardless of whether anything changed. */
  lastChangedAt?: string | null;
  lastContentHash?: string | null;
  /** Phase 4.6: the HTTP status of the most recent fetch attempt, when known (reuses FetchResult.httpStatus's own type — lib/pipeline/types.ts). */
  lastHttpStatus?: number | null;
  /** Phase 4.6: the error message from the most recent FAILED fetch attempt, if any. Cleared (null) on the next successful fetch. */
  lastError?: string | null;
  /** Phase 4.6: cumulative counters, never reset — distinct from consecutiveFailures, which resets on any success. */
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  status: MonitoredSourceStatus;

  /**
   * Optional link to the SourceRecord this monitoring config is watching
   * on behalf of (if one already exists in data/knowledge-base/sources/).
   * Not required — a source can be monitored before any fact cites it.
   */
  relatedSourceRecordId?: string | null;

  /** Consecutive failed fetch attempts — resets to 0 on any successful fetch. Drives the "failed" status and alerting (Section 25). */
  consecutiveFailures: number;

  /** Optional field-level mapping — see MonitoredSourceFieldMapping's doc comment. */
  fieldMapping?: MonitoredSourceFieldMapping;

  notes?: string;
}

export interface MonitoredSourceRegistry {
  version: number;
  sources: MonitoredSource[];
}

/**
 * Section 23 / Phase 4.6 Step 5 — source health snapshot, computed from
 * the registry, never hand-maintained. "healthy"/"warning"/"stale"/
 * "disabled" are all DERIVED classifications (see
 * lib/monitoring/health.ts's classifySourceHealth()) computed from the
 * existing stored MonitoredSourceStatus + consecutiveFailures +
 * lastSuccessfulFetchAt — deliberately NOT a second, competing stored
 * status enum. Only "active"/"paused"/"failed" are ever actually stored.
 */
export interface SourceHealthSummary {
  totalMonitoredSources: number;
  dueForCheck: number;
  healthy: number;
  warning: number;
  failed: number;
  stale: number;
  disabled: number;
  neverChecked: number;
  changed: number; // status active, lastContentHash differs from the previous recorded value at the moment this summary was computed
  averageConsecutiveFailures: number;
}

// ---------------------------------------------------------------------
// Phase 4.3 — Change Detection
// ---------------------------------------------------------------------

/**
 * The exhaustive classification vocabulary. A generic page edit must
 * never automatically become "license requirement changed" — the
 * POSSIBLE_* categories exist specifically so a human reviewer sees "this
 * MIGHT be a fee change" rather than a confident, possibly-wrong claim.
 */
export type ChangeClassification =
  | "NO_CHANGE"
  | "CONTENT_CHANGED"
  | "POSSIBLE_FEE_CHANGE"
  | "POSSIBLE_REQUIREMENT_CHANGE"
  | "POSSIBLE_PROCESSING_TIME_CHANGE"
  | "POSSIBLE_RULE_CHANGE"
  | "POSSIBLE_COMPACT_CHANGE"
  | "POSSIBLE_ULR_CHANGE"
  | "SOURCE_UNAVAILABLE"
  | "FETCH_ERROR"
  | "PARSER_ERROR";

/**
 * The lifecycle state of a DETECTED CHANGE PROPOSAL — deliberately a
 * separate, smaller vocabulary from VerificationStatus (types/knowledge-base.ts).
 * A DetectedChange isn't a fact and was never meant to describe one; it
 * describes whether a human has acted on a specific proposed diff yet.
 * Reusing VerificationStatus here would incorrectly conflate two
 * different lifecycles the same way MonitoredSource.status was
 * deliberately kept separate from it in Phase 4.1.
 *
 * "source_unavailable" added in Phase 4.4 for the MARK_UNAVAILABLE review
 * outcome specifically — genuinely distinct from "rejected" (which means
 * a human checked and found the proposal wrong) and from
 * "pending_verification" (not yet reviewed at all).
 */
export type ChangeReviewStatus = "pending_verification" | "approved" | "rejected" | "superseded" | "source_unavailable";

/**
 * Phase 4.4: an audit-trail entry for review actions that don't
 * necessarily change `.status` (e.g. "defer" — the whole point is status
 * stays pending) but still need a recorded, auditable trace that a human
 * looked at this and made a deliberate choice. Every transition Step 3
 * requires must be traceable here even when it isn't a status change.
 */
export interface ReviewLogEntry {
  action: "approve" | "reject" | "request_research" | "mark_unavailable" | "defer" | "rollback";
  reviewer: string;
  reason: string;
  timestamp: string;
}

export interface DetectedChangeEvidence {
  url: string;
  title: string;
  extractedText?: string;
  fetchedAt: string;
}

export interface DetectedChange {
  /** Deterministic idempotency key — see lib/monitoring/change-record.ts's buildDetectedChangeId(). A re-run producing identical content must resolve to the SAME id, never a duplicate. */
  id: string;
  sourceId: string; // MonitoredSource.id
  jurisdiction: string;
  /**
   * Phase 4.5: set ONLY when this change targets a TransferRule field,
   * where `jurisdiction` is the sourceState. TransferRule facts are keyed
   * by (profession, sourceState, destinationState) — a single
   * `jurisdiction` string (sufficient for ProfessionStateFacts, keyed by
   * profession+state alone) cannot address a transfer pair on its own.
   * Left undefined for a ProfessionStateFacts change, where `jurisdiction`
   * alone is already the complete, unambiguous address.
   */
  destinationJurisdiction?: string;
  profession?: string;
  field?: string; // omitted for a source-level CONTENT_CHANGED signal with no specific field implicated

  previousValue?: unknown;
  proposedValue?: unknown; // omitted whenever extraction couldn't confidently determine a value — see Section 13, never guessed

  previousHash?: string | null;
  newHash: string;

  detectedAt: string;

  classification: ChangeClassification;

  evidence: DetectedChangeEvidence;

  /** 0-1. How confidently the proposed value (if any) was extracted — never fabricated, always traceable to extraction match quality. */
  confidence: number;

  /** True if the MonitoredSource's own jurisdiction doesn't match the fact's jurisdiction — surfaced, never silently dropped. Real jurisdiction ENFORCEMENT (blocking) remains the approval flow's job (Phase 4.5, reusing checkCanMarkVerified), not detection's. */
  jurisdictionMismatch: boolean;

  status: ChangeReviewStatus;

  /** Phase 4.4: audit trail for review actions — see ReviewLogEntry doc comment. Empty until the first human action. */
  reviewLog?: ReviewLogEntry[];
}
