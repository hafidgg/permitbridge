/**
 * lib/knowledge-base/transfer-rule-labels.ts
 *
 * Shared between the page and its components (and directly testable,
 * unlike constants defined inside a page.tsx, which Next.js App Router
 * restricts to a small set of recognized exports). Keeping these here is
 * also what Step 18 ("Data/Logic Separation") means in practice — even
 * display LABELS for the data model live outside the React tree.
 */
import type { TransferRule, TransferRuleFactFieldKey } from "@/types/transfer-rule";

/** Every key here must correspond to a real TransferRule field — checked directly by a test, not just by convention. */
export const FIELD_LABELS: Record<TransferRuleFactFieldKey, string> = {
  transferMechanism: "Transfer Mechanism",
  endorsementProcess: "Endorsement Process",
  reciprocityAgreementExists: "Bilateral Reciprocity Agreement",
  universalRecognitionApplies: "Universal License Recognition",
  examRequirement: "Exam Requirement",
  experienceRequirement: "Experience Requirement",
  applicationFeeUsd: "Application Fee",
  otherRequiredFees: "Other Fees",
  backgroundCheckRequirement: "Background Check",
  fingerprintingRequirement: "Fingerprinting",
  licenseVerificationRequirement: "License Verification",
  documentsRequired: "Documents Required",
  goodStandingRequirement: "Good Standing Requirement",
  disciplinaryDisclosureRequirement: "Disciplinary Disclosure",
  processingTime: "Processing Time",
  temporaryPermitAvailability: "Temporary Permit",
  compactStatus: "Compact Status",
  exceptions: "Exceptions",
};

export const MECHANISM_LABEL: Record<string, string> = {
  endorsement: "Licensure by Endorsement",
  reciprocity: "Reciprocity Agreement",
  universal_license_recognition: "Universal License Recognition",
  compact_privilege: "Nurse Licensure Compact Privilege",
  other: "Other",
  unknown: "Not yet determined",
};

export function stateDisplayName(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
