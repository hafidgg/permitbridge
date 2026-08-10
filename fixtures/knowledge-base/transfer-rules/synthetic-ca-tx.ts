/**
 * fixtures/knowledge-base/transfer-rules/synthetic-ca-tx.ts
 *
 * ⚠️  SYNTHETIC TEST DATA — NOT PRODUCTION DATA. ⚠️
 * Every number, fee, and requirement status in this file is invented for
 * schema-testing purposes per the Phase 3.0 spec ("Do NOT research real
 * transfer requirements... These are tests only, not production data").
 * Do not read any fact here as a real claim about California or Texas RN
 * licensing. Real facts live in data/knowledge-base/facts/, not here.
 *
 * Demonstrates, per the Phase 3.0 spec's fixture requirements:
 *   - directional independence (CA→TX and TX→CA have DIFFERENT values,
 *     not mirrored copies)
 *   - conditional requirements (experienceRequirement, with a real
 *     conditions[] array)
 *   - Unknown (temporaryPermitAvailability on the CA→TX record)
 *   - Not Applicable (reciprocityAgreementExists / universalRecognitionApplies)
 *   - multiple sources on one rule (transferMechanism and applicationFeeUsd
 *     cite two different synthetic SourceRecords)
 *   - field-level verification (every field independently sourced/dated)
 */
import type { TransferRule } from "@/types/transfer-rule";
import type { SourceRecord } from "@/types/knowledge-base";
import { verifiedField, unknownField } from "@/lib/knowledge-base/fields";

// Two synthetic SourceRecords, used only by these fixtures — never written
// to data/knowledge-base/sources/, never picked up by any real report.
export const SYNTHETIC_SOURCE_TDLR: SourceRecord = {
  id: "synthetic-test-tdlr",
  agencyName: "[SYNTHETIC TEST] Texas Board of Nursing",
  website: "https://example-test.invalid/tx-bon-endorsement",
  jurisdiction: "texas",
  professionsCovered: ["registered-nurse"],
  sourceType: "official-board",
  official: true,
  authorityLevel: "authoritative",
  authorityRationale: "SYNTHETIC TEST FIXTURE — not a real source.",
  specificity: "profession-specific",
  reliabilityScore: 0.95,
  reliabilityRationale: "SYNTHETIC TEST FIXTURE.",
  lastCrawl: null,
  lastManualVerification: "2026-08-10",
  fieldsUsingThisSource: 0,
};

export const SYNTHETIC_SOURCE_TDLR_FEES: SourceRecord = {
  id: "synthetic-test-tdlr-fees",
  agencyName: "[SYNTHETIC TEST] Texas Board of Nursing — Fee Schedule",
  website: "https://example-test.invalid/tx-bon-fees",
  jurisdiction: "texas",
  professionsCovered: ["registered-nurse"],
  sourceType: "official-board",
  official: true,
  authorityLevel: "authoritative",
  authorityRationale: "SYNTHETIC TEST FIXTURE — not a real source.",
  specificity: "field-specific",
  reliabilityScore: 0.95,
  reliabilityRationale: "SYNTHETIC TEST FIXTURE.",
  lastCrawl: null,
  lastManualVerification: "2026-08-10",
  fieldsUsingThisSource: 0,
};

export const SYNTHETIC_SOURCE_CA_BRN: SourceRecord = {
  id: "synthetic-test-ca-brn",
  agencyName: "[SYNTHETIC TEST] California Board of Registered Nursing",
  website: "https://example-test.invalid/ca-brn-endorsement",
  jurisdiction: "california",
  professionsCovered: ["registered-nurse"],
  sourceType: "official-board",
  official: true,
  authorityLevel: "authoritative",
  authorityRationale: "SYNTHETIC TEST FIXTURE — not a real source.",
  specificity: "profession-specific",
  reliabilityScore: 0.95,
  reliabilityRationale: "SYNTHETIC TEST FIXTURE.",
  lastCrawl: null,
  lastManualVerification: "2026-08-10",
  fieldsUsingThisSource: 0,
};

export const SYNTHETIC_SOURCES: SourceRecord[] = [SYNTHETIC_SOURCE_TDLR, SYNTHETIC_SOURCE_TDLR_FEES, SYNTHETIC_SOURCE_CA_BRN];

const TODAY = "2026-08-10";

/** SYNTHETIC: California → Texas (endorsement pathway). */
export const SYNTHETIC_TRANSFER_CA_TO_TX: TransferRule = {
  profession: "registered-nurse",
  sourceState: "california",
  destinationState: "texas",
  licenseType: "RN",

  transferMechanism: verifiedField({
    value: "endorsement",
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC TEST VALUE.",
  }),

  endorsementProcess: verifiedField({
    value: "[SYNTHETIC] Submit application via the state licensing portal with Nursys verification.",
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),

  // Not Applicable example: this transfer uses endorsement, not a
  // bilateral reciprocity agreement or a ULR statute — both are
  // confirmed-inapplicable facts, not unresearched ones.
  reciprocityAgreementExists: verifiedField({
    value: { status: "not_applicable" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC: this destination state's pathway is endorsement, not a bilateral reciprocity agreement.",
  }),
  universalRecognitionApplies: verifiedField({
    value: { status: "not_applicable" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC placeholder value for schema testing.",
  }),

  examRequirement: verifiedField({
    value: { status: "not_required" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),

  // Conditional requirement example, with a real conditions[] array.
  experienceRequirement: verifiedField({
    value: {
      status: "conditional",
      conditions: [
        { description: "[SYNTHETIC] Required only if the applicant's license has been inactive for more than 2 years.", category: "practice_gap" },
        { description: "[SYNTHETIC] Required only if the applicant graduated from a nursing program outside the United States.", category: "education_location" },
      ],
    },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
  }),

  applicationFeeUsd: verifiedField({
    value: 999, // clearly synthetic, not a real fee
    sourceUrl: SYNTHETIC_SOURCE_TDLR_FEES.website, // second, DIFFERENT source — demonstrates multi-source-per-rule
    sourceTitle: "[TEST] TDLR Fee Schedule",
    sourceName: SYNTHETIC_SOURCE_TDLR_FEES.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC TEST VALUE — not a real fee.",
  }),
  otherRequiredFees: verifiedField({
    value: "[SYNTHETIC] Fingerprint vendor fee (varies); Nursys verification fee.",
    sourceUrl: SYNTHETIC_SOURCE_TDLR_FEES.website,
    sourceTitle: "[TEST] TDLR Fee Schedule",
    sourceName: SYNTHETIC_SOURCE_TDLR_FEES.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.8,
  }),

  backgroundCheckRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  fingerprintingRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  licenseVerificationRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  documentsRequired: verifiedField({
    value: "[SYNTHETIC] Nursys verification, government ID, application form.",
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
  }),
  goodStandingRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  disciplinaryDisclosureRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),

  processingTime: verifiedField({
    value: "[SYNTHETIC] 6-12 weeks",
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.75,
  }),

  // Genuine Unknown example — deliberately left unresearched, per the
  // Phase 3.0 fixture requirement to demonstrate Unknown distinctly from
  // Not Applicable (see reciprocityAgreementExists above for contrast).
  temporaryPermitAvailability: unknownField("SYNTHETIC: deliberately left Unknown to demonstrate the Unknown state in this fixture."),

  compactStatus: verifiedField({
    value: "[SYNTHETIC] Not applicable — this transfer uses endorsement, not compact privilege.",
    sourceUrl: SYNTHETIC_SOURCE_TDLR.website,
    sourceTitle: "[TEST] TDLR Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_TDLR.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
  }),

  exceptions: unknownField("SYNTHETIC: no exceptions researched for this fixture."),

  conflicts: [],
  lastFullReviewAt: null,
};

/**
 * SYNTHETIC: Texas → California — the REVERSE direction, with genuinely
 * DIFFERENT values throughout (not a mirror of the record above). This is
 * what proves rule(A,B) != rule(B,A) structurally, not just by having two
 * different IDs.
 */
export const SYNTHETIC_TRANSFER_TX_TO_CA: TransferRule = {
  profession: "registered-nurse",
  sourceState: "texas",
  destinationState: "california",
  licenseType: "RN",

  transferMechanism: verifiedField({
    value: "endorsement",
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC TEST VALUE.",
  }),

  endorsementProcess: verifiedField({
    value: "[SYNTHETIC] Submit application via BreEZe with live-scan or FD-258 fingerprinting.",
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),

  reciprocityAgreementExists: verifiedField({
    value: { status: "not_applicable" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  universalRecognitionApplies: verifiedField({
    value: { status: "not_applicable" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC placeholder — deliberately DIFFERENT reasoning path from the CA->TX record, not a mirror.",
  }),

  // DIFFERENT from CA->TX: this direction DOES require the exam (synthetic scenario).
  examRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
    notes: "SYNTHETIC: intentionally different from the CA->TX record to prove directional independence.",
  }),

  // DIFFERENT structure from CA->TX's conditional example — flatly required, no conditions.
  experienceRequirement: verifiedField({
    value: { status: "not_required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
  }),

  // DIFFERENT fee from CA->TX ($999) — proves values aren't shared/symmetric.
  applicationFeeUsd: verifiedField({
    value: 350,
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Fee Schedule",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
    notes: "SYNTHETIC TEST VALUE.",
  }),
  otherRequiredFees: verifiedField({
    value: "[SYNTHETIC] Live-scan or FD-258 fingerprint fee.",
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Fee Schedule",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.8,
  }),

  backgroundCheckRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  fingerprintingRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  licenseVerificationRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  documentsRequired: verifiedField({
    value: "[SYNTHETIC] Nursys or direct verification, transcripts, application form.",
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
  }),
  goodStandingRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),
  disciplinaryDisclosureRequirement: verifiedField({
    value: { status: "required" },
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.9,
  }),

  // DIFFERENT processing time from CA->TX.
  processingTime: verifiedField({
    value: "[SYNTHETIC] 8-16 weeks",
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.75,
  }),

  // DIFFERENT from CA->TX: this direction has a KNOWN (populated) answer,
  // not left Unknown — another deliberate asymmetry.
  temporaryPermitAvailability: verifiedField({
    value: { status: "required" }, // RequirementStatus reused loosely here as "available" for a yes/no-shaped fact — see field comment in types/transfer-rule.ts
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.8,
    notes: "SYNTHETIC: intentionally populated here vs. left Unknown on the CA->TX record, to prove directional independence extends to verification completeness itself, not just values.",
  }),

  compactStatus: verifiedField({
    value: "[SYNTHETIC] Not applicable — this transfer uses endorsement, not compact privilege.",
    sourceUrl: SYNTHETIC_SOURCE_CA_BRN.website,
    sourceTitle: "[TEST] CA BRN Endorsement Overview",
    sourceName: SYNTHETIC_SOURCE_CA_BRN.agencyName,
    verifiedAt: TODAY,
    verificationMethod: "official_document_review",
    confidence: 0.85,
  }),

  exceptions: unknownField("SYNTHETIC: no exceptions researched for this fixture."),

  conflicts: [],
  lastFullReviewAt: null,
};
