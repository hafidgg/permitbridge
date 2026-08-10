/**
 * fixtures/knowledge-base/monitoring/synthetic-change-scenarios.ts
 *
 * ⚠️  SYNTHETIC TEST DATA — NOT PRODUCTION DATA. ⚠️
 * Phase 4.3: six scenarios covering unchanged, low-risk, medium-risk,
 * high-risk, ambiguous, and extraction-failure cases, per the explicit
 * test requirement. Never imported by production code — only by
 * scripts/knowledge-base/tests.ts.
 */
import type { ExtractRule } from "@/lib/pipeline/types";
import { hashContent } from "@/lib/pipeline/fetcher";

const TODAY = "2026-08-12";

// --- Scenario 1: UNCHANGED ---
export const UNCHANGED_TEXT = "Renewal continuing education requirement: 30 contact hours every 2 years.";
export const UNCHANGED_HASH = hashContent(UNCHANGED_TEXT);
export const UNCHANGED_EXTRACT_RULE: ExtractRule = {
  field: "continuingEducationRequirements",
  pattern: "continuing education requirement: (.+?)\\.",
  transform: "first_capture_group",
};
export const UNCHANGED_CURRENT_VALUE = "30 contact hours every 2 years";

// --- Scenario 2: LOW RISK (a supporting RN field, confidently extracted) ---
export const LOW_RISK_OLD_TEXT = "Renewal continuing education requirement: 20 contact hours every 2 years.";
export const LOW_RISK_NEW_TEXT = "Renewal continuing education requirement: 30 contact hours every 2 years.";
export const LOW_RISK_FIELD = "continuingEducationRequirements"; // RN_SUPPORTING_FIELDS -> risk "low"
export const LOW_RISK_EXTRACT_RULE: ExtractRule = {
  field: LOW_RISK_FIELD,
  pattern: "continuing education requirement: (.+?)\\.",
  transform: "first_capture_group",
};
export const LOW_RISK_CURRENT_VALUE = "20 contact hours every 2 years";

// --- Scenario 3: MEDIUM RISK (a non-critical TransferRule field, confidently extracted) ---
export const MEDIUM_RISK_OLD_TEXT = "Estimated processing time: 4-8 weeks.";
export const MEDIUM_RISK_NEW_TEXT = "Estimated processing time: 8-12 weeks.";
export const MEDIUM_RISK_FIELD = "processingTime"; // not in CRITICAL_TRANSFER_RULE_FIELDS -> risk "medium"
export const MEDIUM_RISK_EXTRACT_RULE: ExtractRule = {
  field: MEDIUM_RISK_FIELD,
  pattern: "Estimated processing time: (.+?)\\.",
  transform: "first_capture_group",
};
export const MEDIUM_RISK_CURRENT_VALUE = "4-8 weeks";

// --- Scenario 4: HIGH RISK (a critical/core fee field, confidently extracted) ---
export const HIGH_RISK_OLD_TEXT = "Endorsement application fee: $110.";
export const HIGH_RISK_NEW_TEXT = "Endorsement application fee: $125.";
export const HIGH_RISK_FIELD = "rnEndorsementFeeUsd"; // RN_CORE_FIELDS -> risk "high"
export const HIGH_RISK_EXTRACT_RULE: ExtractRule = {
  field: HIGH_RISK_FIELD,
  pattern: "Endorsement application fee: \\$(\\d+)",
  transform: "number",
};
export const HIGH_RISK_CURRENT_VALUE = 110;
export const HIGH_RISK_EXPECTED_PROPOSED_VALUE = 125;

// --- Scenario 5: AMBIGUOUS (page changed, field's category is known, but no confident value extractable — Section 13's exact "Fees have changed." example) ---
export const AMBIGUOUS_OLD_TEXT = "Endorsement application fee: $110.";
export const AMBIGUOUS_NEW_TEXT = "Fees have changed. Please see the fee schedule PDF for current amounts.";
export const AMBIGUOUS_FIELD = "rnEndorsementFeeUsd";
export const AMBIGUOUS_EXTRACT_RULE: ExtractRule = {
  field: AMBIGUOUS_FIELD,
  pattern: "Endorsement application fee: \\$(\\d+)", // will NOT match the new text
  transform: "number",
};
export const AMBIGUOUS_CURRENT_VALUE = 110;

// --- Scenario 6: EXTRACTION FAILURE (malformed regex pattern -> applyRule throws -> PARSER_ERROR) ---
export const EXTRACTION_FAILURE_TEXT = "Endorsement application fee: $110.";
export const EXTRACTION_FAILURE_OLD_HASH = hashContent("Endorsement application fee: $100.");
export const EXTRACTION_FAILURE_FIELD = "rnEndorsementFeeUsd";
export const EXTRACTION_FAILURE_EXTRACT_RULE: ExtractRule = {
  field: EXTRACTION_FAILURE_FIELD,
  pattern: "[invalid(regex", // deliberately malformed — new RegExp() throws
  transform: "number",
};
export const EXTRACTION_FAILURE_CURRENT_VALUE = 100;

// --- Scenario 7 (bonus, Section 22): SOURCE UNAVAILABLE (fetch itself failed) ---
export const SOURCE_UNAVAILABLE_PREVIOUS_HASH = hashContent("Endorsement application fee: $110.");
export const SOURCE_UNAVAILABLE_CURRENT_VALUE = 110;

export const SCENARIOS_DETECTED_AT = TODAY;
