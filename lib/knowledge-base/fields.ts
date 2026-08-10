/**
 * lib/knowledge-base/fields.ts
 *
 * Small constructors so every VerifiedField in the knowledge base is built
 * the same way — no field gets a guessed value without a source, and no
 * field silently omits a confidence score, status, or reviewer.
 */
import type { VerifiedField, ConfidenceLevel, VerificationMethod, VerificationStatus } from "@/types/knowledge-base";

export function unknownField<T>(notes?: string): VerifiedField<T> {
  return {
    value: "Unknown",
    sourceUrl: null,
    sourceTitle: null,
    sourceName: null,
    verifiedAt: null,
    verificationMethod: null,
    reviewer: null,
    status: "pending_verification",
    confidence: 0,
    confidenceLevel: "unknown",
    history: [],
    notes,
  };
}

/**
 * Builds a populated field. Deliberately does NOT default `status` to
 * "verified" — a value found by research (human or AI) but not yet signed
 * off by a named reviewer is "pending_verification" by default. Pass
 * `reviewer` explicitly (and typically `status: "verified"`) only once a
 * named person or process has actually signed off on it.
 */
export function verifiedField<T>(args: {
  value: T;
  sourceUrl: string;
  sourceTitle: string;
  sourceName: string;
  verifiedAt: string;
  verificationMethod: VerificationMethod;
  confidence: number;
  status?: VerificationStatus;
  reviewer?: string | null;
  notes?: string;
}): VerifiedField<T> {
  const confidenceLevel: ConfidenceLevel =
    args.confidence >= 0.85 ? "verified" : args.confidence >= 0.6 ? "likely" : args.confidence > 0 ? "uncertain" : "unknown";

  return {
    value: args.value,
    sourceUrl: args.sourceUrl,
    sourceTitle: args.sourceTitle,
    sourceName: args.sourceName,
    verifiedAt: args.verifiedAt,
    verificationMethod: args.verificationMethod,
    reviewer: args.reviewer ?? null,
    status: args.status ?? "pending_verification",
    confidence: args.confidence,
    confidenceLevel,
    history: [
      {
        previousValue: null,
        newValue: args.value,
        changedAt: args.verifiedAt,
        reason: "Initial value recorded",
        sourceUrl: args.sourceUrl,
        reviewer: args.reviewer ?? null,
      },
    ],
    notes: args.notes,
  };
}

/**
 * Applies a new value to an existing field, appending a history entry
 * rather than silently overwriting. Use this for every update after a
 * field's first value — never mutate `.value` directly.
 */
export function updateField<T>(
  field: VerifiedField<T>,
  update: {
    value: T;
    sourceUrl: string;
    sourceTitle: string;
    sourceName: string;
    verifiedAt: string;
    verificationMethod: VerificationMethod;
    confidence: number;
    status?: VerificationStatus;
    reviewer?: string | null;
    reason: string;
    notes?: string;
  }
): VerifiedField<T> {
  const confidenceLevel: ConfidenceLevel =
    update.confidence >= 0.85 ? "verified" : update.confidence >= 0.6 ? "likely" : update.confidence > 0 ? "uncertain" : "unknown";

  return {
    value: update.value,
    sourceUrl: update.sourceUrl,
    sourceTitle: update.sourceTitle,
    sourceName: update.sourceName,
    verifiedAt: update.verifiedAt,
    verificationMethod: update.verificationMethod,
    reviewer: update.reviewer ?? null,
    status: update.status ?? "pending_verification",
    confidence: update.confidence,
    confidenceLevel,
    history: [
      ...field.history,
      {
        previousValue: field.value,
        newValue: update.value,
        changedAt: update.verifiedAt,
        reason: update.reason,
        sourceUrl: update.sourceUrl,
        reviewer: update.reviewer ?? null,
      },
    ],
    notes: update.notes ?? field.notes,
  };
}

export function isFieldComplete<T>(field: VerifiedField<T>): boolean {
  return field.value !== "Unknown" && field.confidence >= 0.6;
}

export function isFieldPartial<T>(field: VerifiedField<T>): boolean {
  return field.value !== "Unknown" && field.confidence > 0 && field.confidence < 0.6;
}

export function isFieldMissing<T>(field: VerifiedField<T>): boolean {
  return field.value === "Unknown";
}

/** Data-quality violation check: a real value must always carry a source. */
export function isFieldMissingSource<T>(field: VerifiedField<T>): boolean {
  return field.value !== "Unknown" && !field.sourceUrl;
}
