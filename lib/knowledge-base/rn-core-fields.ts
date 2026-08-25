/**
 * lib/knowledge-base/rn-core-fields.ts
 *
 * Phase 2.3, Step 1: the minimum set of RN fields that materially affect
 * a nurse's actual license-portability decision — "can I move here, what
 * do I need to do, how long will it take, what will it cost." Every
 * field listed here already exists in ProfessionStateFacts (see
 * types/knowledge-base.ts) — nothing new was invented for this list.
 *
 * The remaining 4 tracked fields (requiredEducation, requiredDocuments,
 * renewalFeeUsd, continuingEducationRequirements) are real and useful,
 * but are about the BASELINE licensure standard or ONGOING maintenance
 * after a nurse has already relocated — not the portability decision
 * itself — so they are classified SUPPORTING, not CORE, per this phase's
 * explicit instruction to limit core fields to what "materially affects
 * licensing/portability."
 */
import type { ProfessionStateFacts } from "@/types/knowledge-base";
import { FIELD_AUTHORITY_MAP, TIER_LABELS, type SourceTier } from "./authority-mapping";

export type RnFieldKey = Exclude<keyof ProfessionStateFacts, "profession" | "state" | "conflicts" | "lastFullReviewAt" | "licenseTier">;

export interface RnCoreFieldDefinition {
  field: RnFieldKey;
  purpose: string;
  authorityTiers: SourceTier[];
}

export const RN_CORE_FIELDS: RnCoreFieldDefinition[] = [
  {
    field: "licensingBoard",
    purpose: "Identifies which government body actually issues/regulates the license — the starting point for every other step.",
    authorityTiers: FIELD_AUTHORITY_MAP.licensingBoard,
  },
  {
    field: "officialWebsite",
    purpose: "Where to actually go to apply, check status, or find current forms — without this, every other fact is unusable in practice.",
    authorityTiers: FIELD_AUTHORITY_MAP.officialWebsite,
  },
  {
    field: "licenseTransferPage",
    purpose: "The specific page describing how an out-of-state nurse actually transfers a license here — the direct answer to \"how do I do this.\"",
    authorityTiers: FIELD_AUTHORITY_MAP.licenseTransferPage,
  },
  {
    field: "reciprocityRules",
    purpose: "Whether/how this state recognizes a license already held elsewhere — directly determines the difficulty of the move.",
    authorityTiers: FIELD_AUTHORITY_MAP.reciprocityRules,
  },
  {
    field: "endorsementRules",
    purpose: "The specific procedure for licensure-by-endorsement — the most common real pathway nurses actually use to relocate.",
    authorityTiers: FIELD_AUTHORITY_MAP.endorsementRules,
  },
  {
    field: "universalLicenseRecognitionStatus",
    purpose: "Whether a broad state law guarantees recognition of an out-of-state license as a fallback, independent of the compact system.",
    authorityTiers: FIELD_AUTHORITY_MAP.universalLicenseRecognitionStatus,
  },
  {
    field: "compactMembership",
    purpose: "For nursing specifically, the single biggest portability factor — a compact member state requires no new application at all for a nurse moving from another compact state.",
    authorityTiers: FIELD_AUTHORITY_MAP.compactMembership,
  },
  {
    field: "requiredExams",
    purpose: "Whether the nurse must retake an exam to practice here — a major cost/time factor in the transfer decision.",
    authorityTiers: FIELD_AUTHORITY_MAP.requiredExams,
  },
  {
    field: "requiredExperience",
    purpose: "Minimum active-practice requirements some states impose for endorsement — can block an otherwise-eligible transfer.",
    authorityTiers: FIELD_AUTHORITY_MAP.requiredExperience,
  },
  {
    field: "processingTime",
    purpose: "How long the nurse must wait before being able to legally work — often the single most practically important number for someone planning a move.",
    authorityTiers: FIELD_AUTHORITY_MAP.processingTime,
  },
  {
    field: "endorsementFeeUsd",
    purpose:
      "The fee an already-licensed nurse pays to obtain RN licensure in this state BY ENDORSEMENT — i.e. the practical " +
      "cost of the transfer itself. Explicitly clarified in Phase 2.5 (see data/_pipeline/reports/phase-2.5-*.md for the " +
      "full ambiguity-resolution note): this is NOT the fee for initial licensure by examination (new nursing graduates, " +
      "not a portability scenario this dataset covers), and NOT the ongoing renewal fee (tracked separately as " +
      "renewalFeeUsd). If a state publishes only a single undifferentiated 'licensure fee' with no distinction between " +
      "exam and endorsement applicants, that figure may be used, but the field's source evidence must say so explicitly.",
    authorityTiers: FIELD_AUTHORITY_MAP.endorsementFeeUsd,
  },
];

export const RN_SUPPORTING_FIELDS: RnFieldKey[] = ["requiredEducation", "requiredDocuments", "renewalFeeUsd", "continuingEducationRequirements"];

export function describeAuthorityTiers(tiers: SourceTier[]): string {
  return tiers.map((t) => `Tier ${t} (${TIER_LABELS[t]})`).join(" or ");
}
