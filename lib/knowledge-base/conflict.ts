/**
 * lib/knowledge-base/conflict.ts
 *
 * Phase 2.6: deterministic resolution policy for when two OFFICIAL
 * sources disagree on the same fact. This is deliberately separate from
 * lib/knowledge-base/policy.ts's checkCanMarkVerified — that function
 * decides whether a SINGLE field can be marked Verified; this module
 * decides, when two authoritative-looking sources conflict, which one
 * the system should prefer and WHY, without ever silently picking one
 * and discarding the other's evidence.
 *
 * Priority order (per Phase 2.6 spec, most to least important):
 *   1-3. Specificity tier: field-specific > profession-specific >
 *        jurisdiction-general > national-general (see SourceSpecificity)
 *   4. Explicitness of wording (does the source explicitly label the
 *      value with the exact fact being checked, e.g. "Endorsement Fee",
 *      vs. an ambiguous unlabeled figure)
 *   5. Recency (more recently observed/published wins ties)
 *
 * "Official source wins" is NOT a rule here — both sides of every
 * conflict this module resolves are already official/authoritative.
 * The question is never "official vs. not," it's "which official
 * document is actually ABOUT this specific fact."
 */
import type { ConflictSourceSnapshot, ConflictRecord, SourceSpecificity } from "@/types/knowledge-base";

const SPECIFICITY_RANK: Record<SourceSpecificity, number> = {
  "field-specific": 4,
  "profession-specific": 3,
  "jurisdiction-general": 2,
  "national-general": 1,
};

export interface ConflictResolution {
  winner: "a" | "b";
  reasonSteps: string[];
}

/**
 * Does the source's title/context explicitly name the fact type, rather
 * than presenting an unlabeled or ambiguously-labeled figure? This is a
 * simple heuristic, not NLP — it looks for the field's expected keyword
 * in the title. Good enough for the deterministic tiebreak this policy
 * needs; a human reviewer remains the real authority for anything subtler.
 */
function isExplicitlyLabeled(source: ConflictSourceSnapshot, expectedKeyword: string): boolean {
  return source.title.toLowerCase().includes(expectedKeyword.toLowerCase());
}

export function resolveSourceConflict(
  fieldPath: string,
  a: ConflictSourceSnapshot,
  b: ConflictSourceSnapshot,
  expectedLabelKeyword = "endorsement"
): ConflictResolution {
  const reasonSteps: string[] = [];

  // Steps 1-3: specificity tier comparison.
  const rankA = SPECIFICITY_RANK[a.specificity];
  const rankB = SPECIFICITY_RANK[b.specificity];
  if (rankA !== rankB) {
    const winner = rankA > rankB ? "a" : "b";
    reasonSteps.push(
      `Specificity tier: "${a.agencyName}" (${a.specificity}, rank ${rankA}) vs "${b.agencyName}" (${b.specificity}, rank ${rankB}) — ` +
        `${winner === "a" ? a.title : b.title} is more narrowly scoped to this exact fact, so it wins.`
    );
    return { winner, reasonSteps };
  }
  reasonSteps.push(`Specificity tier tied at ${a.specificity} (rank ${rankA}) — proceeding to explicitness check.`);

  // Step 4: explicitness of labeling.
  const aExplicit = isExplicitlyLabeled(a, expectedLabelKeyword);
  const bExplicit = isExplicitlyLabeled(b, expectedLabelKeyword);
  if (aExplicit !== bExplicit) {
    const winner = aExplicit ? "a" : "b";
    reasonSteps.push(
      `Explicitness: only "${winner === "a" ? a.title : b.title}" explicitly labels the value with "${expectedLabelKeyword}" ` +
        `in its title/context — the other source's figure is not unambiguously about the same fact type.`
    );
    return { winner, reasonSteps };
  }
  reasonSteps.push(`Explicitness tied (both${aExplicit ? "" : " neither"} explicitly labeled) — proceeding to recency.`);

  // Step 5: recency.
  const winner = a.observedAt >= b.observedAt ? "a" : "b";
  reasonSteps.push(
    `Recency: "${winner === "a" ? a.title : b.title}" was observed more recently (${winner === "a" ? a.observedAt : b.observedAt}).`
  );
  return { winner, reasonSteps };
}

/** Builds a full ConflictRecord from two source snapshots, applying the resolution policy immediately (never left silently unresolved when a deterministic answer exists). */
export function buildConflictRecord(args: {
  field: string;
  a: ConflictSourceSnapshot;
  b: ConflictSourceSnapshot;
  reasonForConflict: string;
  expectedLabelKeyword?: string;
}): ConflictRecord {
  const { winner, reasonSteps } = resolveSourceConflict(args.field, args.a, args.b, args.expectedLabelKeyword);

  return {
    field: args.field,
    sourceA: args.a,
    sourceB: args.b,
    detectedAt: new Date().toISOString().slice(0, 10),
    reasonForConflict: args.reasonForConflict,
    resolution: winner === "a" ? "resolved_a" : "resolved_b",
    resolutionReason: reasonSteps.join(" "),
    reviewer: null, // Phase 2.6: policy-resolved, NOT human-reviewed — never fabricate a reviewer here
    reviewedAt: null,
  };
}
