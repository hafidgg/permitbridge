/**
 * fixtures/knowledge-base/transfer-rules/synthetic-review-scenarios.ts
 *
 * ⚠️  SYNTHETIC TEST DATA — NOT PRODUCTION DATA. ⚠️
 * Phase 3.2, Step 12: demonstrates the human-review workflow using
 * synthetic test reviewers only. NONE of this ever touches
 * data/knowledge-base/transfer-rules/ — these fixtures exist purely to
 * exercise applyFieldReview() / isTransferRulePublishable() in tests.
 */
import { verifiedField } from "@/lib/knowledge-base/fields";
import type { SourceRecord, ConflictRecord } from "@/types/knowledge-base";

export const SYNTHETIC_REVIEW_SOURCE: SourceRecord = {
  id: "synthetic-review-test-source",
  agencyName: "[SYNTHETIC TEST] State Board",
  website: "https://example-test.invalid/synthetic-review-source",
  jurisdiction: "texas",
  professionsCovered: ["registered-nurse"],
  sourceType: "official-board",
  official: true,
  authorityLevel: "authoritative",
  authorityRationale: "SYNTHETIC TEST FIXTURE.",
  specificity: "field-specific",
  reliabilityScore: 0.9,
  reliabilityRationale: "SYNTHETIC TEST FIXTURE.",
  lastCrawl: null,
  lastManualVerification: "2026-08-11",
  fieldsUsingThisSource: 0,
};

export const SYNTHETIC_SECONDARY_SOURCE: SourceRecord = {
  ...SYNTHETIC_REVIEW_SOURCE,
  id: "synthetic-review-secondary-source",
  agencyName: "[SYNTHETIC TEST] Commercial Nursing Blog",
  website: "https://example-test.invalid/synthetic-secondary-source",
  sourceType: "secondary",
  official: false,
  authorityLevel: "supplementary",
};

/** Scenario 1: a field ready to be approved. */
export const SCENARIO_1_FIELD_TO_APPROVE = verifiedField({
  value: 150,
  sourceUrl: SYNTHETIC_REVIEW_SOURCE.website,
  sourceTitle: "[TEST] Fee Schedule",
  sourceName: SYNTHETIC_REVIEW_SOURCE.agencyName,
  verifiedAt: "2026-08-11",
  verificationMethod: "official_document_review",
  confidence: 0.9,
});

/** Scenario 2: a field a reviewer will reject (evidence looked wrong on inspection). */
export const SCENARIO_2_FIELD_TO_REJECT = verifiedField({
  value: { status: "required" },
  sourceUrl: SYNTHETIC_REVIEW_SOURCE.website,
  sourceTitle: "[TEST] Ambiguous Page",
  sourceName: SYNTHETIC_REVIEW_SOURCE.agencyName,
  verifiedAt: "2026-08-11",
  verificationMethod: "ai_assisted_manual_research",
  confidence: 0.6,
});

/** Scenario 3: a field a reviewer marks as needing more evidence (stays pending). */
export const SCENARIO_3_FIELD_NEEDS_MORE_EVIDENCE = verifiedField({
  value: "6-12 weeks",
  sourceUrl: SYNTHETIC_SECONDARY_SOURCE.website,
  sourceTitle: "[TEST] Commercial estimate",
  sourceName: SYNTHETIC_SECONDARY_SOURCE.agencyName,
  verifiedAt: "2026-08-11",
  verificationMethod: "ai_assisted_manual_research",
  confidence: 0.5,
});

/** Scenario 4: a conflict on a critical field, for testing that it blocks publication. */
export const SCENARIO_4_CRITICAL_CONFLICT: ConflictRecord = {
  field: "examRequirement",
  sourceA: {
    value: "required",
    url: SYNTHETIC_REVIEW_SOURCE.website,
    agencyName: "[TEST] Board A",
    title: "[TEST] Board A Page",
    jurisdiction: "texas",
    authorityLevel: "authoritative",
    specificity: "field-specific",
    observedAt: "2026-08-11",
  },
  sourceB: {
    value: "not_required",
    url: SYNTHETIC_REVIEW_SOURCE.website,
    agencyName: "[TEST] Board B",
    title: "[TEST] Board B Page",
    jurisdiction: "texas",
    authorityLevel: "authoritative",
    specificity: "field-specific",
    observedAt: "2026-08-11",
  },
  detectedAt: "2026-08-11",
  reasonForConflict: "SYNTHETIC TEST FIXTURE: two board pages disagree.",
  resolution: "unresolved",
  resolutionReason: undefined,
  reviewer: null,
  reviewedAt: null,
};

/** Scenario 6/7: names a real human reviewer must never be replaced by. */
export const FAKE_REVIEWER_NAMES = ["Claude", "AI", "System", "Automated", "GPT", "  claude  "];
export const REAL_TEST_REVIEWER_NAME = "[SYNTHETIC TEST] Jane Smith, Licensing Policy Analyst";
