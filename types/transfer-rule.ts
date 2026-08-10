/**
 * types/transfer-rule.ts
 *
 * Phase 3.0: schema for a single DIRECTIONAL license transfer
 * ("move an existing RN license from State A to State B"). This is a
 * THIRD, parallel type module — deliberately separate from both:
 *
 *   - types/index.ts        (the live site's simple TransferRule, which
 *                             powers app/transfer/[profession]/[from]/[to]/
 *                             and must never be touched by this work)
 *   - types/knowledge-base.ts (the per-state FACT model built in Phases
 *                             1-2.7, e.g. "what is Texas's RN endorsement
 *                             fee" — a single-state fact, not a transfer)
 *
 * A TransferRule answers a different question than either of the above:
 * "what does it actually take for someone ALREADY LICENSED in state A to
 * become licensed in state B" — which depends on BOTH states, is
 * inherently directional, and needs field-by-field verification exactly
 * like ProfessionStateFacts already does. This file reuses VerifiedField,
 * SourceRecord, and ConflictRecord wholesale rather than reinventing them.
 *
 * NOTHING in this file is wired into the live site or the knowledge base's
 * existing reports. It exists so Phase 3.1+ has a real schema to populate
 * — no production data is created here (see the fixtures file for the
 * only concrurrent artifacts, which are explicitly synthetic test data).
 */
import type { VerifiedField, ConflictRecord } from "./knowledge-base";

// ---------------------------------------------------------------------
// Transfer mechanism — NOT legally interchangeable, see rationale below.
// ---------------------------------------------------------------------

/**
 * The actual legal mechanism a destination state uses to recognize an
 * out-of-state license. These are deliberately NOT synonyms:
 *
 *   - "endorsement": the destination state issues its OWN license after
 *     reviewing the applicant's existing license + credentials. The most
 *     common mechanism. A brand-new license is issued; the process can
 *     still be denied/delayed based on destination-state-specific review.
 *
 *   - "reciprocity": a bilateral or multilateral AGREEMENT between two or
 *     more specific states to directly honor each other's licenses,
 *     typically with a lighter process than endorsement. Rarer than
 *     endorsement in practice (see Phase 1 research: PermitBridge's own
 *     original market research found true reciprocity uncommon).
 *
 *   - "universal_license_recognition": a state-level STATUTE requiring
 *     recognition of ANY out-of-state license in the same profession
 *     (subject to conditions like minimum time licensed), independent of
 *     any agreement with the specific origin state. This is a unilateral
 *     policy choice by the destination state, not a negotiated agreement.
 *
 *   - "compact_privilege": the destination state is a member of the same
 *     interstate compact (e.g. NLC for nursing) as the origin state,
 *     granting practice privileges under a SINGLE multistate license with
 *     NO new destination-state license issued at all — categorically
 *     different from the other three, which all result in a new license.
 *
 *   - "other": a real mechanism exists but doesn't fit the above (e.g. a
 *     state-specific military-spouse-only pathway) — must be explained in
 *     the field's `notes`, never left unexplained.
 *
 *   - "unknown": not yet researched. Distinct from "other" — "other" means
 *     research found a real mechanism that doesn't fit the enum; "unknown"
 *     means no research has happened yet.
 */
export type TransferMechanism =
  | "endorsement"
  | "reciprocity"
  | "universal_license_recognition"
  | "compact_privilege"
  | "other"
  | "unknown";

// ---------------------------------------------------------------------
// Unknown vs. Not Applicable vs. Required vs. Not Required vs. Conditional
// ---------------------------------------------------------------------

/**
 * The 4 KNOWN states a requirement can be confirmed to be in. This is
 * deliberately NOT a boolean — "is fingerprinting required" has more than
 * two real answers (e.g. compact_privilege transfers typically make this
 * "not_applicable" — there's no new application at all — which is a
 * different, equally-confident fact from "not_required", where an
 * application exists but happens not to need fingerprints).
 *
 * The 5th state, "genuinely don't know yet," is NOT a member of this type
 * — it's represented by VerifiedField<T>'s own "Unknown" sentinel wrapping
 * this type (see VerifiedRequirement below). This mirrors exactly how
 * ProfessionStateFacts already separates "no value recorded" from "a real
 * value was recorded" — Phase 3.0 extends the same pattern, doesn't
 * invent a new one.
 */
export type RequirementStatus = "required" | "not_required" | "not_applicable" | "conditional";

/** One condition under which a "conditional" requirement actually applies. */
export interface RequirementCondition {
  description: string; // human-readable, e.g. "license has been inactive for more than 2 years"
  category: "license_status" | "disciplinary_history" | "practice_gap" | "education_location" | "other";
}

export interface RequirementValue {
  status: RequirementStatus;
  /** Populated ONLY when status === "conditional". Empty/omitted otherwise — never a fake single-item array for a flatly required/not-required fact. */
  conditions?: RequirementCondition[];
}

/** The standard wrapper for every requirement-shaped fact in a TransferRule. */
export type VerifiedRequirement = VerifiedField<RequirementValue>;

// ---------------------------------------------------------------------
// TransferRule
// ---------------------------------------------------------------------

export interface TransferRuleIdentity {
  profession: string; // profession slug
  sourceState: string; // state slug the nurse is CURRENTLY licensed in
  destinationState: string; // state slug the nurse wants to become licensed in
  licenseType: string; // e.g. "RN" — kept distinct from `profession` since one profession slug can cover multiple license types (RN vs LPN) in the future
}

/**
 * A single directional transfer rule: everything PermitBridge would need
 * to tell a nurse "here's what moving from sourceState to destinationState
 * actually takes." Every meaningful fact is a VerifiedField (or
 * VerifiedRequirement) — there is no single overall verificationStatus
 * field standing in for the whole rule; each fact tracks its own
 * provenance and trust independently, exactly like ProfessionStateFacts.
 */
export interface TransferRule extends TransferRuleIdentity {
  // --- How the transfer legally works ---
  transferMechanism: VerifiedField<TransferMechanism>;

  // --- Eligibility pathway details ---
  endorsementProcess: VerifiedField<string>; // free-text description of the endorsement procedure, when applicable
  reciprocityAgreementExists: VerifiedRequirement;
  universalRecognitionApplies: VerifiedRequirement;

  // --- Testing / experience ---
  examRequirement: VerifiedRequirement;
  experienceRequirement: VerifiedRequirement; // e.g. minimum active-practice hours/years for endorsement

  // --- Costs ---
  applicationFeeUsd: VerifiedField<number>;
  otherRequiredFees: VerifiedField<string>; // free-text: e.g. "fingerprint vendor fee (varies), Nursys verification fee"

  // --- Screening / documentation ---
  backgroundCheckRequirement: VerifiedRequirement;
  fingerprintingRequirement: VerifiedRequirement;
  licenseVerificationRequirement: VerifiedRequirement; // e.g. Nursys / direct board-to-board verification
  documentsRequired: VerifiedField<string>; // free-text list — see note below on why this isn't a structured array yet
  goodStandingRequirement: VerifiedRequirement;
  disciplinaryDisclosureRequirement: VerifiedRequirement;

  // --- Timing ---
  processingTime: VerifiedField<string>; // free-text range, e.g. "4-8 weeks" — mirrors ProfessionStateFacts.processingTime's shape
  temporaryPermitAvailability: VerifiedRequirement;

  // --- Compact-specific (only meaningful when transferMechanism is compact_privilege) ---
  compactStatus: VerifiedField<string>; // free-text, e.g. "both states are NLC members; no new application required"

  // --- Exceptions / edge cases that don't fit the structured fields above ---
  exceptions: VerifiedField<string>;

  // --- Cross-cutting ---
  conflicts: ConflictRecord[]; // reuses the exact Phase 2.6 conflict system — no new conflict model
  lastFullReviewAt: string | null;
}

// ---------------------------------------------------------------------
// Shared field-key type (Phase 3.3 fix): the 18 real "fact" fields,
// excluding identity (profession/sourceState/destinationState/licenseType)
// and cross-cutting (conflicts/lastFullReviewAt) fields. Every module that
// iterates "the fields of a TransferRule" (labels, review workflow,
// schema validation, page rendering) should use THIS type, not the wider
// `keyof TransferRule` — using the wider type let a genuine type error
// slip through undetected in Phase 3.3 (caught by Phase 3.3's own
// verification pass; see PIPELINE report for details) where a value typed
// `keyof TransferRule` was passed somewhere that only accepts the 18 real
// fact-field keys.
// ---------------------------------------------------------------------
export type TransferRuleFactFieldKey = Exclude<
  keyof TransferRule,
  "profession" | "sourceState" | "destinationState" | "licenseType" | "conflicts" | "lastFullReviewAt"
>;

// ---------------------------------------------------------------------
// Notes on deliberate simplifications (documented, not silently assumed)
// ---------------------------------------------------------------------
//
// `documentsRequired` is a free-text VerifiedField<string>, not a
// structured array of individually-verified documents. A fully
// itemized, independently-sourced document checklist is a reasonable
// FUTURE extension, but would require either (a) an array of
// VerifiedField<string> — awkward, since VerifiedField's history/source
// model is designed around ONE fact, not an editable list — or (b) a new
// nested type. Deferred; free text captures the fact today without
// inventing a structure this phase wasn't asked to design.
//
// Similarly, `otherRequiredFees` stays free-text rather than a structured
// fee breakdown, for the same reason.
