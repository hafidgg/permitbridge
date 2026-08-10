/**
 * lib/monitoring/field-classification.ts
 *
 * Phase 4.3: maps a known ProfessionStateFacts/TransferRule field name to
 * (a) the ChangeClassification category a detected change on it should
 * carry, and (b) the RiskLevel that change deserves. Neither mapping
 * invents a new "which fields matter" judgment — both are derived
 * directly from field lists that already exist for other reasons:
 *
 *   - Risk reuses RN_CORE_FIELDS/RN_SUPPORTING_FIELDS (lib/knowledge-base/
 *     rn-core-fields.ts, Phase 2.3) and CRITICAL_TRANSFER_RULE_FIELDS
 *     (lib/knowledge-base/transfer-review.ts, Phase 3.2) — the exact
 *     same "does getting this wrong matter" judgment already used for
 *     the Human Review Queue and Publication Gate.
 *   - Category is a small, explicit, field-name -> category table (fee /
 *     requirement / processing-time / compact / ULR / generic rule) —
 *     genuinely new for Phase 4.3, since nothing existing classifies
 *     fields by "what KIND of fact is this," only "how much does it
 *     matter."
 */
import type { ChangeClassification } from "@/types/monitoring";
import type { RiskLevel } from "@/lib/pipeline/types";
import { RN_CORE_FIELDS, RN_SUPPORTING_FIELDS } from "@/lib/knowledge-base/rn-core-fields";
import { CRITICAL_TRANSFER_RULE_FIELDS } from "@/lib/knowledge-base/transfer-review";

const RN_CORE_FIELD_NAMES = new Set(RN_CORE_FIELDS.map((f) => f.field as string));
const RN_SUPPORTING_FIELD_NAMES = new Set(RN_SUPPORTING_FIELDS as string[]);
const TRANSFER_CRITICAL_FIELD_NAMES = new Set(CRITICAL_TRANSFER_RULE_FIELDS as string[]);

export type FieldSchema = "profession-state-facts" | "transfer-rule";

/**
 * Reuses the exact same "does this matter" judgment the Human Review
 * Queue and Publication Gate already encode — a change-detection risk
 * level that disagreed with those would be a real inconsistency, not a
 * stylistic difference.
 *
 * `schema` is required, not optional: exactly one field name —
 * "processingTime" — exists in BOTH ProfessionStateFacts (where it's a
 * Phase 2.3 core field, risk "high") and TransferRule (where Phase 3.2
 * explicitly did NOT classify it critical, risk "medium"). A schema-blind
 * lookup silently picked the wrong answer for TransferRule's
 * processingTime — caught by this phase's own test suite, not left in.
 */
export function classifyFieldRisk(field: string, schema: FieldSchema): RiskLevel {
  if (schema === "transfer-rule") {
    if (TRANSFER_CRITICAL_FIELD_NAMES.has(field)) return "high";
    // A TransferRule field not in the critical set is "supporting" by the
    // same Phase 3.2 logic — medium, since TransferRule fields were never
    // split into a 3rd, lower tier the way RN facts were.
    return "medium";
  }

  if (RN_CORE_FIELD_NAMES.has(field)) return "high";
  if (RN_SUPPORTING_FIELD_NAMES.has(field)) return "low";
  // An RN fact field in neither list shouldn't occur for the 15 known
  // fields, but a genuinely unknown field name defaults to medium rather
  // than silently claiming "low" (understating risk) or "high"
  // (overstating it) for something this mapping was never taught about.
  return "medium";
}

const FEE_FIELDS = new Set(["rnEndorsementFeeUsd", "renewalFeeUsd", "applicationFeeUsd", "otherRequiredFees"]);
const PROCESSING_TIME_FIELDS = new Set(["processingTime"]);
const COMPACT_FIELDS = new Set(["compactMembership", "compactStatus"]);
const ULR_FIELDS = new Set(["universalLicenseRecognitionStatus", "universalRecognitionApplies"]);
const REQUIREMENT_FIELDS = new Set([
  "requiredExams",
  "requiredExperience",
  "requiredEducation",
  "requiredDocuments",
  "continuingEducationRequirements",
  "examRequirement",
  "experienceRequirement",
  "backgroundCheckRequirement",
  "fingerprintingRequirement",
  "licenseVerificationRequirement",
  "goodStandingRequirement",
  "disciplinaryDisclosureRequirement",
  "temporaryPermitAvailability",
  "reciprocityAgreementExists",
]);

/**
 * The category a CONFIRMED change on this field should be classified as.
 * Falls back to POSSIBLE_RULE_CHANGE for any field not in a more specific
 * category (e.g. licensingBoard, officialWebsite, endorsementProcess,
 * exceptions) — a generic, still-honest "something rule-like changed"
 * signal, never silently dropped just for lacking a dedicated category.
 */
export function classifyFieldChangeCategory(field: string): ChangeClassification {
  if (FEE_FIELDS.has(field)) return "POSSIBLE_FEE_CHANGE";
  if (PROCESSING_TIME_FIELDS.has(field)) return "POSSIBLE_PROCESSING_TIME_CHANGE";
  if (COMPACT_FIELDS.has(field)) return "POSSIBLE_COMPACT_CHANGE";
  if (ULR_FIELDS.has(field)) return "POSSIBLE_ULR_CHANGE";
  if (REQUIREMENT_FIELDS.has(field)) return "POSSIBLE_REQUIREMENT_CHANGE";
  return "POSSIBLE_RULE_CHANGE";
}
