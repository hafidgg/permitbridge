/**
 * lib/pipeline/types.ts
 *
 * Type contracts for the PermitBridge Data Pipeline.
 * These are intentionally kept separate from /types (the UI-facing domain
 * types) so the pipeline can evolve freely without ever risking a change
 * to what the site's pages/components consume.
 */

export type EntityKind = "profession" | "state" | "transfer";

export type RiskLevel = "low" | "medium" | "high";

export type SourceCategory =
  | "state_licensing_board"
  | "national_compact_registry"
  | "federal_agency"
  | "professional_association";

/** One official source we know how to fetch and extract fields from. */
export interface SourceConfig {
  id: string;
  entityKind: EntityKind;
  /** slug of the profession or state this source is authoritative for */
  entitySlug: string;
  category: SourceCategory;
  name: string;
  url: string;
  /** Regex-based extraction hints — see lib/pipeline/extract.ts */
  extract: ExtractRule[];
  /** how often this source is worth checking, in days */
  checkIntervalDays: number;
  enabled: boolean;
  notes?: string;
}

/** A single field-extraction instruction applied to fetched page text. */
export interface ExtractRule {
  /** dot-path into the normalized record this rule populates, e.g. "isUlrState" */
  field: string;
  /** JS RegExp source (case-insensitive, applied to whitespace-normalized text) */
  pattern: string;
  /** how to turn the regex match into a value */
  transform: "boolean_presence" | "first_capture_group" | "number" | "year";
  /** if the pattern is absent, what to conclude (rather than leaving stale) */
  fallbackWhenAbsent?: unknown;
}

export interface FetchableSource {
  id: string;
  url: string;
}

export interface FetchResult {
  sourceId: string;
  url: string;
  fetchedAt: string;
  status: "ok" | "not_modified" | "error";
  httpStatus?: number;
  etag?: string;
  contentHash?: string;
  rawText?: string;
  error?: string;
}

export interface ExtractedRecord {
  sourceId: string;
  entityKind: EntityKind;
  entitySlug: string;
  fields: Record<string, unknown>;
  extractedAt: string;
  /** 0-1, lowered when required fields fell back to a default */
  confidence: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface FieldChange {
  path: string;
  before: unknown;
  after: unknown;
  risk: RiskLevel;
}

export interface DiffResult {
  entityKind: EntityKind;
  entitySlug: string;
  sourceId: string;
  hasChanges: boolean;
  changes: FieldChange[];
  highestRisk: RiskLevel | null;
}

export interface PendingChange {
  id: string;
  createdAt: string;
  diff: DiffResult;
  proposedRecord: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
}

export interface PipelineRunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  mode: "live" | "mock";
  sourcesChecked: number;
  fetchErrors: number;
  recordsExtracted: number;
  validationErrors: number;
  changesAutoApplied: number;
  changesPendingApproval: number;
  transfersRegenerated: number;
  searchIndexDocuments: number;
}
