/**
 * lib/knowledge-base/transfer-rule-schema.ts
 *
 * Phase 3.0: deterministic slug generation + the 10 data-integrity
 * validation rules for TransferRule. No research, no production data —
 * this is pure schema logic, tested against synthetic fixtures only
 * (see data/knowledge-base/fixtures/transfer-rules/).
 */
import type { TransferRule, TransferRuleIdentity, TransferRuleFactFieldKey } from "@/types/transfer-rule";
import type { SourceRecord } from "@/types/knowledge-base";
import { isDisallowedReviewerName } from "./policy";

// ---------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------

/**
 * Deterministic slug convention: {profession}/{sourceState}-to-{destinationState}
 * e.g. "registered-nurse/california-to-texas"
 *
 * Deliberately does NOT include licenseType in the slug — today's only
 * license type (RN) doesn't need disambiguation in the URL, and adding it
 * unconditionally would break the exact URL shape given in the Phase 3.0
 * spec ("registered-nurse/california-to-texas"). If a second license type
 * is ever added for the same profession slug, the slug function will need
 * revisiting — documented here rather than silently guessed at.
 */
export function buildTransferRuleSlug(identity: Pick<TransferRuleIdentity, "profession" | "sourceState" | "destinationState">): string {
  return `${identity.profession}/${identity.sourceState}-to-${identity.destinationState}`;
}

export function parseTransferRuleSlug(slug: string): { profession: string; sourceState: string; destinationState: string } | null {
  const match = slug.match(/^([a-z0-9-]+)\/([a-z0-9-]+)-to-([a-z0-9-]+)$/);
  if (!match) return null;
  const [, profession, sourceState, destinationState] = match;
  if (!profession || !sourceState || !destinationState) return null;
  return { profession, sourceState, destinationState };
}

// ---------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------

export interface TransferRuleValidationIssue {
  rule: string; // which of the 10 numbered rules this violates
  message: string;
  severity: "error" | "warning";
}

const REQUIREMENT_FIELD_KEYS: TransferRuleFactFieldKey[] = [
  "reciprocityAgreementExists",
  "universalRecognitionApplies",
  "examRequirement",
  "experienceRequirement",
  "backgroundCheckRequirement",
  "fingerprintingRequirement",
  "licenseVerificationRequirement",
  "goodStandingRequirement",
  "disciplinaryDisclosureRequirement",
  "temporaryPermitAvailability",
];

const ALL_VERIFIED_FIELD_KEYS: TransferRuleFactFieldKey[] = [
  "transferMechanism",
  "endorsementProcess",
  ...REQUIREMENT_FIELD_KEYS,
  "applicationFeeUsd",
  "otherRequiredFees",
  "documentsRequired",
  "processingTime",
  "compactStatus",
  "exceptions",
];

/**
 * Validates a TransferRule against the 10 data-integrity rules from the
 * Phase 3.0 spec. `resolveSource` lets the caller plug in the real
 * SourceRecord catalog (or a synthetic one, for fixture tests) without
 * this module needing to know how sources are loaded.
 */
export function validateTransferRule(
  rule: TransferRule,
  resolveSource: (sourceUrl: string) => SourceRecord | undefined,
  knownProfessionSlugs: Set<string>
): TransferRuleValidationIssue[] {
  const issues: TransferRuleValidationIssue[] = [];

  // Rule 1: sourceState != destinationState
  if (rule.sourceState === rule.destinationState) {
    issues.push({ rule: "1", message: "sourceState and destinationState must not be the same state.", severity: "error" });
  }

  // Rule 2: profession must exist
  if (!knownProfessionSlugs.has(rule.profession)) {
    issues.push({ rule: "2", message: `Unknown profession slug "${rule.profession}".`, severity: "error" });
  }

  // Rule 3: direction is explicit (both fields present and non-empty — TypeScript already
  // enforces presence, but an empty string is a real runtime footgun worth catching)
  if (!rule.sourceState.trim() || !rule.destinationState.trim()) {
    issues.push({ rule: "3", message: "sourceState and destinationState must both be explicit, non-empty state slugs.", severity: "error" });
  }

  // Rule 4: every populated factual field must have evidence (a sourceUrl)
  for (const key of ALL_VERIFIED_FIELD_KEYS) {
    const field = rule[key] as any;
    if (field?.value !== "Unknown" && field?.value !== undefined && !field?.sourceUrl) {
      issues.push({ rule: "4", message: `${key}: has a populated value but no sourceUrl.`, severity: "error" });
    }
  }

  // Rule 5: Unknown must not be converted to false. Checked structurally:
  // a VerifiedRequirement's value must be the literal string "Unknown" OR
  // a proper RequirementValue object — never a bare boolean.
  for (const key of REQUIREMENT_FIELD_KEYS) {
    const field = rule[key] as any;
    if (typeof field?.value === "boolean") {
      issues.push({
        rule: "5",
        message: `${key}: value is a raw boolean (${field.value}) — requirement fields must use RequirementValue, never a boolean, to avoid collapsing Unknown/Not Applicable/Conditional into true/false.`,
        severity: "error",
      });
    }
  }

  // Rule 6: Not Applicable must not be treated as Unknown (structural check:
  // "not_applicable" is a valid populated value, distinct from the "Unknown" sentinel)
  for (const key of REQUIREMENT_FIELD_KEYS) {
    const field = rule[key] as any;
    if (field?.value === "not_applicable") {
      // This is CORRECT usage — not_applicable is a real, evidenced answer.
      // Flag it as an error only if it's missing the evidence a real answer requires.
      if (!field.sourceUrl) {
        issues.push({ rule: "6", message: `${key}: status is "not_applicable" but has no sourceUrl — a Not Applicable determination is a real finding and needs evidence like any other.`, severity: "error" });
      }
    }
  }

  // Rule 7: official sources must match jurisdiction. Per this schema's design,
  // a transfer rule's facts are almost all about what the DESTINATION state
  // requires — so the expected jurisdiction for source resolution is
  // destinationState (documented explicitly here, not assumed silently).
  for (const key of ALL_VERIFIED_FIELD_KEYS) {
    const field = rule[key] as any;
    if (field?.sourceUrl) {
      const source = resolveSource(field.sourceUrl);
      if (!source) {
        issues.push({ rule: "7", message: `${key}: sourceUrl does not resolve to any known SourceRecord.`, severity: "warning" });
      } else if (source.jurisdiction !== "national" && source.jurisdiction !== "federal" && source.jurisdiction !== rule.destinationState) {
        issues.push({
          rule: "7",
          message: `${key}: source jurisdiction "${source.jurisdiction}" does not match destinationState "${rule.destinationState}".`,
          severity: "error",
        });
      }
    }
  }

  // Rule 8: field-specific authority must be respected — delegated to the
  // existing authority-mapping.ts at the point of actually marking a field
  // Verified (see lib/knowledge-base/policy.ts checkCanMarkVerified). This
  // validator checks the weaker, structural precondition: every populated
  // field's source must at least be resolvable (already checked in Rule 7).
  // Full field-authority checking requires the FIELD_AUTHORITY_MAP to be
  // extended with TransferRule's field names — explicitly NOT done in this
  // schema-only phase (see report), so this rule is a documented no-op here.

  // Rule 9: conflicting evidence cannot become Verified automatically
  for (const conflict of rule.conflicts) {
    const relatedField = ALL_VERIFIED_FIELD_KEYS.find((k) => k === conflict.field);
    if (relatedField) {
      const field = rule[relatedField] as any;
      if (field?.status === "verified") {
        issues.push({
          rule: "9",
          message: `${relatedField}: has an unresolved-relevant conflict recorded but status is "verified" — a field with a conflict must never be auto-verified.`,
          severity: "error",
        });
      }
    }
  }

  // Rule 10: reviewer must not be fabricated
  for (const key of ALL_VERIFIED_FIELD_KEYS) {
    const field = rule[key] as any;
    if (typeof field?.reviewer === "string" && isDisallowedReviewerName(field.reviewer)) {
      issues.push({ rule: "10", message: `${key}: reviewer "${field.reviewer}" is a disallowed fabricated-reviewer placeholder.`, severity: "error" });
    }
  }

  return issues;
}

export function isTransferRuleValid(
  rule: TransferRule,
  resolveSource: (sourceUrl: string) => SourceRecord | undefined,
  knownProfessionSlugs: Set<string>
): boolean {
  return validateTransferRule(rule, resolveSource, knownProfessionSlugs).every((i) => i.severity !== "error");
}
