import type { ProfessionStateFacts, SourceRecord, VerifiedField } from "@/types/knowledge-base";

/**
 * Phase 2D.4.2 — a quality gate for ProfessionStateFacts (single-state
 * records with an optional licenseTier), the sibling of
 * isTransferRulePublishable() (lib/knowledge-base/transfer-review.ts),
 * which only accepts TransferRule (pairwise) records and cannot be
 * reused directly here — confirmed in Phase 2D.4/2D.4.1's architecture
 * review, not assumed.
 *
 * Deliberately small and scoped to exactly what a state-level page
 * needs: every critical field must be populated AND traceable to a real,
 * authoritative (not secondary) SourceRecord. Unknown fields never block
 * publication by themselves — same Partial Data Policy already
 * established for TransferRule — but a populated field backed only by a
 * secondary source does block, exactly like the TransferRule gate.
 */

export const CRITICAL_PROFESSION_STATE_FIELDS: (keyof ProfessionStateFacts)[] = ["licensingBoard", "reciprocityRules"];

export interface ProfessionStateFactsPublicationCheck {
  publishable: boolean;
  blockingReasons: string[];
}

export function isProfessionStateFactsPublishable(
  facts: ProfessionStateFacts,
  resolveSource: (url: string) => SourceRecord | undefined
): ProfessionStateFactsPublicationCheck {
  const reasons: string[] = [];

  for (const key of CRITICAL_PROFESSION_STATE_FIELDS) {
    const field = facts[key] as VerifiedField<unknown> | undefined;
    if (!field || field.value === "Unknown") {
      reasons.push(`Critical field "${key}" is Unknown — cannot publish without this fact confirmed.`);
      continue;
    }
    if (!field.sourceUrl) {
      reasons.push(`Critical field "${key}" has a value but no sourceUrl.`);
      continue;
    }
    const source = resolveSource(field.sourceUrl);
    if (!source) {
      reasons.push(`Critical field "${key}" cites a sourceUrl not registered in the sources index.`);
      continue;
    }
    if (source.authorityLevel !== "authoritative") {
      reasons.push(`Critical field "${key}" relies only on a secondary source (${source.agencyName}) — needs an authoritative source before publication.`);
    }
  }

  return { publishable: reasons.length === 0, blockingReasons: reasons };
}
