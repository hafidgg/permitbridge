/**
 * types/knowledge-base.ts
 *
 * Type contracts for the PermitBridge Official Knowledge Base — the
 * research layer built to satisfy the "every fact must be traceable"
 * mission. This is INTENTIONALLY a separate, parallel data model from
 * /types/index.ts (the simplified shape the live site's pages read).
 *
 * Why separate instead of extending the existing types:
 *   - The live UI (app/, components/) reads plain values like
 *     `state.isUlrState: boolean`. Changing that to a VerifiedField<T>
 *     wrapper would require touching every page and component that reads
 *     it — a redesign/refactor explicitly out of scope for this phase.
 *   - Research data has a fundamentally different shape than display
 *     data: every fact needs provenance (source, date, confidence), most
 *     facts start as "Unknown" rather than a plausible default, and two
 *     sources can disagree (a live UI field can't represent that).
 *   - This lets research proceed at full rigor with zero risk to the
 *     live site. Promoting a verified fact into the simple /data schema
 *     that powers the site is a separate, later, deliberate step —
 *     exactly like the pipeline's existing low/medium/high risk gate.
 */

export type ConfidenceLevel = "verified" | "likely" | "uncertain" | "unknown";

/**
 * Field-level trust status. This is deliberately distinct from the coverage
 * system's cell-level FieldStatus ("complete"/"partial"/"missing") defined
 * further down — a field can be "complete" (a value + source exist) while
 * still being "Pending Verification" (an AI or automated process found it,
 * but no human has signed off yet). Coverage measures presence; this
 * measures trust.
 */
export type VerificationStatus =
  | "verified" // confirmed against an official source AND signed off by a named reviewer
  | "needs_review" // populated but flagged uncertain, contradictory-adjacent, or low-confidence
  | "pending_verification" // populated from a real source, but no reviewer has signed off yet
  | "deprecated" // was once valid, superseded by a newer verified value (kept for history)
  | "conflicting_sources"; // two+ official-ish sources disagree and have not been reconciled

/**
 * How a field's value was actually obtained. This is what lets a reader
 * distinguish "an AI assistant read an official page and transcribed this"
 * from "a human licensing-policy reviewer confirmed this by phone" —
 * two very different trust levels that a single confidence number can't
 * fully capture on its own.
 */
export type VerificationMethod =
  | "ai_assisted_manual_research" // an AI research assistant read an official source directly and recorded the value
  | "automated_pipeline_extraction" // lib/pipeline/extract.ts regex extraction against a fetched official page
  | "manual-review" // a named human reviewer confirmed this directly (site visit, phone call, document read)
  | "official_document_review" // sourced from a downloaded official PDF/statute/regulation text, not a webpage
  | "cross_referenced_multiple_sources"; // no single authoritative page; value inferred from 2+ independent sources agreeing

/**
 * One entry in a field's audit trail. Every time a field's value changes,
 * a new entry is appended — nothing is ever silently overwritten.
 */
export interface FieldHistoryEntry {
  previousValue: unknown; // null if this is the field's first-ever value
  newValue: unknown;
  changedAt: string; // ISO date
  reason: string;
  sourceUrl: string | null;
  reviewer: string | null;
}

/**
 * Every single fact in the knowledge base is wrapped in this shape.
 * `value` is the literal string "Unknown" (not null/undefined) when a
 * fact could not be verified — this is a deliberate, explicit state per
 * the "mark as Unknown instead of guessing" rule, not an absence of data.
 */
export interface VerifiedField<T> {
  value: T | "Unknown";

  // --- Source identity ---
  sourceUrl: string | null;
  sourceTitle: string | null; // human-readable title of the specific page/document, e.g. "TDLR Out-of-State Applicants"
  sourceName: string | null; // the issuing organization, e.g. "Texas Department of Licensing and Regulation"

  // --- Verification metadata ---
  verifiedAt: string | null; // ISO date (YYYY-MM-DD) this value was last confirmed
  verificationMethod: VerificationMethod | null;
  reviewer: string | null; // named person or system; null means genuinely un-reviewed
  status: VerificationStatus;
  confidence: number; // 0.0 (unknown) - 1.0 (directly confirmed on an official .gov/board page, human-reviewed)
  confidenceLevel: ConfidenceLevel;

  // --- Audit trail ---
  history: FieldHistoryEntry[];

  notes?: string;
}

/** When two official-ish sources disagree on a fact, record both rather than picking one. */
/**
 * One side of a conflict — full provenance, not just a value+url. Phase
 * 2.6: enriched from the original {value,url,label} shape so a conflict
 * record alone (without cross-referencing a SourceRecord that might
 * later change) fully preserves what each side actually said.
 */
export interface ConflictSourceSnapshot {
  value: string;
  url: string;
  agencyName: string;
  title: string;
  jurisdiction: string;
  authorityLevel: AuthorityLevel;
  specificity: SourceSpecificity;
  observedAt: string; // ISO date this snapshot of the source was taken
}

export interface ConflictRecord {
  field: string;
  sourceA: ConflictSourceSnapshot;
  sourceB: ConflictSourceSnapshot;
  detectedAt: string;
  reasonForConflict: string; // why these two values differ (e.g. "general vs. profession-specific fee schedule")
  resolution: "unresolved" | "resolved_a" | "resolved_b" | "resolved_other";
  resolutionReason?: string; // the deterministic policy reasoning, not just "official source wins"
  reviewer: string | null; // null unless a real human confirmed the resolution
  reviewedAt: string | null;
}

/** The 18 required fact categories for every profession x state cell, per the research mission. */
export interface ProfessionStateFacts {
  profession: string; // profession slug
  state: string; // state slug

  /**
   * Phase 2D.3.1: optional license-rank/tier discriminator, added
   * specifically so a profession with genuinely distinct license levels
   * per state (e.g. electrician: Journeyman vs. Master — confirmed in
   * real Phase 2D.1/2D.2 research to have MATERIALLY DIFFERENT
   * reciprocity rules in at least one state, Colorado) can be
   * represented as separate ProfessionStateFacts records for the same
   * profession+state pair, one per tier, without conflating their facts
   * into a single misleading record.
   *
   * Deliberately a free-text string, not a union of fixed values (e.g.
   * NOT `"journeyman" | "master"`): real research already surfaced 4
   * distinct Colorado electrician tiers (Residential Wireman, Journeyman,
   * Master, Contractor), and other professions may have entirely
   * different tier names. Hardcoding a closed set here would just
   * relocate the same RN-shaped-assumption problem this phase exists to
   * fix, one level down.
   *
   * Optional and absent/undefined for every existing profession+state
   * record (RN has no tier distinction — one license level per state) —
   * fully backward compatible, no migration required for any existing
   * file.
   */
  licenseTier?: string;

  licensingBoard: VerifiedField<string>;
  officialWebsite: VerifiedField<string>;
  licenseTransferPage: VerifiedField<string>;
  reciprocityRules: VerifiedField<string>;
  endorsementRules: VerifiedField<string>;
  universalLicenseRecognitionStatus: VerifiedField<boolean>;
  compactMembership: VerifiedField<boolean>;
  requiredExams: VerifiedField<string>;
  requiredExperience: VerifiedField<string>;
  requiredEducation: VerifiedField<string>;
  requiredDocuments: VerifiedField<string>;
  processingTime: VerifiedField<string>;
  /**
   * Renamed from `initialFeeUsd` in Phase 2.7 (semantic-preserving rename —
   * see data/_pipeline/reports/phase-2.7-semantic-rename.md). The old name
   * was genuinely ambiguous ("initial" reads as "new nurse's first
   * license," i.e. the exam pathway — the opposite of what this field
   * tracks). Definition, unchanged since Phase 2.5/2.6: the fee an
   * already-licensed nurse pays to obtain licensure in this state BY
   * ENDORSEMENT. Not the exam fee, not the renewal fee.
   */
  endorsementFeeUsd: VerifiedField<number>;
  renewalFeeUsd: VerifiedField<number>;
  continuingEducationRequirements: VerifiedField<string>;

  conflicts: ConflictRecord[];
  /** null until every field above has been individually verified at least once. */
  lastFullReviewAt: string | null;
}

export type FieldStatus = "complete" | "partial" | "missing" | "needs_manual_review";

export interface CoverageCell {
  profession: string;
  state: string;
  status: FieldStatus;
  fieldsComplete: number;
  fieldsTotal: number;
  completionPct: number;
  hasUnresolvedConflict: boolean;
}

export interface CoverageReport {
  generatedAt: string;
  professionsTracked: number;
  statesTracked: number;
  totalCells: number;
  cellsComplete: number;
  cellsPartial: number;
  cellsMissing: number;
  cellsNeedingReview: number;
  overallCompletionPct: number;
  cells: CoverageCell[];
}

export interface KnowledgeBaseProfession {
  slug: string;
  name: string;
  demandRank: number; // 1 = highest priority
  demandRationale: string;
  category: string;
}

export interface KnowledgeBaseState {
  slug: string;
  name: string;
  abbreviation: string;
  region: "West" | "Midwest" | "South" | "Northeast";
}

/**
 * One record per official source (licensing board, compact registry,
 * federal agency, professional association) the knowledge base draws
 * facts from. This is a DATA record, not a UI page — per this phase's
 * "leave the existing UI unchanged" constraint, these are inspected as
 * files/reports, the same way the pipeline's changelog already is.
 */
/**
 * What kind of entity issues this source, in decreasing order of default
 * trust. This is what a "secondary" source structurally cannot escape by
 * itself — see authorityLevel below and the Verification Policy doc.
 */
export type SourceType =
  | "official-board" // a state's own occupational/professional licensing board
  | "official-government" // a state or federal government page that is not a licensing board itself (e.g. a statute portal)
  | "official-compact" // the official organization operating a named interstate compact (e.g. nursecompact.com)
  | "official-national-organization" // a national body that governs specific facts it administers (e.g. NCSBN and the NCLEX exam)
  | "secondary"; // aggregators, commercial media, blogs, prep-course sites — useful as a starting point, never sufficient alone

export type AuthorityLevel = "authoritative" | "supplementary";

/**
 * Phase 2.6: how narrowly-scoped a source document actually is. This is
 * what lets the conflict-resolution policy prefer a nursing-specific page
 * over a generic, all-professions fee chart, even when both are hosted by
 * the same authoritative agency and both are otherwise "official".
 */
export type SourceSpecificity =
  | "field-specific" // the document is about this exact fact (e.g. a page titled "Endorsement Fees")
  | "profession-specific" // the document covers this profession specifically, but multiple facts (e.g. a full nursing licensure page)
  | "jurisdiction-general" // the document covers many professions in one jurisdiction (e.g. an all-professions fee chart)
  | "national-general"; // the document covers many jurisdictions/professions at a national level

export interface SourceRecord {
  id: string; // stable slug, e.g. "tx-tdlr"
  agencyName: string;
  website: string;
  jurisdiction: string; // state slug, or "federal", or "national"
  professionsCovered: string[]; // profession slugs

  sourceType: SourceType;
  /** True only for official-board / official-government / official-compact sources, or official-national-organization sources for facts they actually govern. */
  official: boolean;
  authorityLevel: AuthorityLevel;
  authorityRationale: string;
  /** Phase 2.6: required for conflict resolution — see resolveSourceConflict() in lib/knowledge-base/conflict.ts */
  specificity: SourceSpecificity;

  reliabilityScore: number; // 0-1, editorial judgment: .gov/official board = high, aggregator/blog = lower
  reliabilityRationale: string;
  lastCrawl: string | null; // last time the automated pipeline fetched this URL, if ever
  lastManualVerification: string | null; // last time a human or AI researcher directly read this source
  /** Computed by lib/knowledge-base/sources.ts by scanning fact files — not hand-maintained. */
  fieldsUsingThisSource: number;
}

export interface VerificationQueueItem {
  profession: string;
  state: string;
  fieldPath: string; // e.g. "licensingBoard"
  currentValue: unknown;
  currentStatus: VerificationStatus;
  sourceUrl: string | null;
  sourceId: string | null; // matched SourceRecord.id, if resolvable
  sourceIsAuthoritative: boolean | null; // null if source unresolved
  verificationRequired: boolean;
  reason: string;
}


export interface TrustReport {
  generatedAt: string;
  totalFields: number;
  fieldsByStatus: Record<VerificationStatus, number>;
  fieldsByStatusPct: Record<VerificationStatus, number>;
  conflictingFieldsCount: number;
  staleFieldsCount: number; // verifiedAt older than STALE_THRESHOLD_DAYS
  staleThresholdDays: number;
  averageConfidence: number; // across all non-Unknown fields
  verificationCoveragePct: number; // % of all possible fields that are anything other than "Unknown"
  fieldsMissingSource: number; // data-quality violations: a non-Unknown value with no sourceUrl (should always be 0)
  fieldsByMethod: Record<VerificationMethod | "none", number>;
  sourcesTracked: number;
  sourcesWithZeroFieldsUsingThem: string[]; // source ids that exist but nothing currently cites them

  // --- Phase 2.1 additions: authority + human-review breakdowns ---
  authoritativeSourcesCount: number;
  secondarySourcesCount: number;
  fieldsUsingAuthoritativeSources: number;
  fieldsUsingSecondarySources: number;
  fieldsUsingUnresolvedSources: number; // populated field whose sourceUrl doesn't match any known SourceRecord
  humanReviewedFieldsCount: number; // status === "verified" AND reviewer is a non-null real name
  fieldsWithoutHumanReview: number;

  // --- Phase 2.6 additions: conflicts must be visible, never folded into "authoritative" ---
  fieldsWithRecordedConflicts: number; // fields whose conflicts[] array has >=1 entry, resolved or not
  fieldsWithUnresolvedConflicts: number; // conflicts[] entries with resolution === "unresolved"
  officialSourcesInvolvedInConflicts: string[]; // distinct source agency names appearing in any conflict record
}
