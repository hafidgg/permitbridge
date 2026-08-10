/**
 * lib/knowledge-base/authority-mapping.ts
 *
 * Phase 2.2, Step 2: a deterministic mapping between each fact FIELD TYPE
 * and the category of source that is actually authoritative for it.
 *
 * This exists because "an official source is not automatically the
 * correct source for every fact" (Phase 2.2 spec). NCSBN is authoritative
 * for the NCLEX exam requirement — NCSBN did NOT publish, and is not
 * authoritative for, a specific state's endorsement fee. This mapping is
 * what lets the verification workflow ask the right question per field
 * ("is THIS source authoritative for THIS specific fact") instead of a
 * blanket "is this source official."
 *
 * Referenced by policy/verification code — never hard-coded per script.
 */
import type { ProfessionStateFacts } from "@/types/knowledge-base";
import type { SourceType } from "@/types/knowledge-base";

export type SourceTier = 1 | 2 | 3 | 4;

/**
 * The 15 real fact fields on ProfessionStateFacts (excluding identity/
 * cross-cutting keys profession/state/conflicts/lastFullReviewAt). Using
 * this precise literal-key type — instead of a generic `Record<string,
 * SourceTier[]>` — is what lets `FIELD_AUTHORITY_MAP.licensingBoard`
 * (static property access) type as `SourceTier[]` with no `undefined`
 * possibility, while `FIELD_AUTHORITY_MAP[arbitraryString]` (dynamic
 * index access, used by isAuthoritativeForField below) correctly still
 * types as `SourceTier[] | undefined`, since an arbitrary string might
 * not be a real field. A real build (`next build` with noUncheckedIndexedAccess)
 * caught the previous generic-Record version failing exactly this distinction.
 */
export type ProfessionFactFieldKey = Exclude<keyof ProfessionStateFacts, "profession" | "state" | "conflicts" | "lastFullReviewAt">;

export const TIER_LABELS: Record<SourceTier, string> = {
  1: "State Licensing Authority",
  2: "Official Interstate Compact",
  3: "Official National Licensing Organization",
  4: "Secondary Source",
};

/** Which SourceType(s) count as satisfying a given tier's requirement. */
export const TIER_SOURCE_TYPES: Record<SourceTier, SourceType[]> = {
  1: ["official-board", "official-government"],
  2: ["official-compact"],
  3: ["official-national-organization"],
  4: ["secondary"],
};

/**
 * For each RN fact field, the tier(s) that are authoritative for it, in
 * priority order (first = preferred). A field may accept more than one
 * tier (e.g. requiredExams is nationally standardized, so Tier 3 (NCSBN)
 * is authoritative — but a state board's own site restating the same
 * federal requirement, Tier 1, is also acceptable).
 */
export const FIELD_AUTHORITY_MAP: Record<ProfessionFactFieldKey, SourceTier[]> = {
  licensingBoard: [1],
  officialWebsite: [1],
  licenseTransferPage: [1],
  reciprocityRules: [1],
  endorsementRules: [1],
  universalLicenseRecognitionStatus: [1],
  compactMembership: [2],
  requiredExams: [3, 1], // NCSBN governs the exam itself; a state board site is also acceptable
  requiredExperience: [1],
  requiredEducation: [1, 3], // state board sets the requirement, but NCSBN test-plan docs are also acceptable evidence
  requiredDocuments: [1],
  processingTime: [1],
  rnEndorsementFeeUsd: [1],
  renewalFeeUsd: [1],
  continuingEducationRequirements: [1],
};

/** True if `sourceType` is an acceptable authority for `fieldPath`, per the map above. */
export function isAuthoritativeForField(fieldPath: string, sourceType: SourceType): boolean {
  const tiers = FIELD_AUTHORITY_MAP[fieldPath as keyof typeof FIELD_AUTHORITY_MAP];
  if (!tiers) return false;
  return tiers.some((tier) => TIER_SOURCE_TYPES[tier].includes(sourceType));
}

/** Human-readable explanation, e.g. for the verification queue's `reason` field. */
export function explainAuthorityRequirement(fieldPath: string): string {
  const tiers = FIELD_AUTHORITY_MAP[fieldPath as keyof typeof FIELD_AUTHORITY_MAP];
  if (!tiers || tiers.length === 0) return "No authority mapping defined for this field.";
  return `Authoritative sources for '${fieldPath}': ${tiers.map((t) => `Tier ${t} (${TIER_LABELS[t]})`).join(" or ")}.`;
}
