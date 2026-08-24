/**
 * Phase 2C.3 — deterministic intent classification.
 *
 * Uses the REAL, already-documented Phase 2A search-intent taxonomy
 * (PHASE_2A_OPPORTUNITY_AUDIT.md, Section 4) verbatim — not a competing
 * taxonomy invented for this phase. Each category below corresponds
 * directly to that report's lettered categories (A-I), kept traceable.
 *
 * Pure keyword/pattern rules, deterministic, explainable — no LLM, no
 * embeddings, no external API. The same query always produces the same
 * classification.
 */

export type IntentCategory =
  | "TRANSFER" // Phase 2A intent A
  | "ENDORSEMENT" // B
  | "ELIGIBILITY" // C
  | "REQUIREMENTS" // D
  | "COMPACT" // E
  | "COMPARISON" // F
  | "PROCESS" // G
  | "FEES" // H (cost half of Phase 2A's "Cost/timeline")
  | "TIMELINE" // H (timeline half — split for cleaner matching, both trace to the same Phase 2A row)
  | "CHANGE_UPDATE" // I
  | "VERIFICATION" // not in Phase 2A's original 9 rows, but explicitly requested by Phase 2C.3 (Step 4 example: "nursys license verification"); a real, distinct intent PermitBridge already serves via source citations
  | "UNKNOWN";

export interface IntentClassification {
  intentCategory: IntentCategory;
  intentConfidence: number; // 0-1, deterministic — see matchedSignals for exactly why
  matchedSignals: string[]; // the literal keyword(s)/pattern(s) that triggered this classification
}

/**
 * Ordered rule list — first matching rule wins. Order matters: more
 * specific signals (e.g. "endorsement") are checked before generic ones
 * so a query like "florida rn endorsement fee" resolves to FEES only if
 * "fee" is a stronger, more specific signal than "endorsement" — see the
 * explicit precedence comment below for the one deliberate exception.
 */
const RULES: Array<{ category: IntentCategory; patterns: RegExp[]; confidence: number }> = [
  // FEES checked before ENDORSEMENT/TRANSFER: "florida rn application fee"
  // should resolve to FEES (Phase 2A example H), not the more generic
  // intent it's paired with — cost/timeline questions have a very
  // specific, high-value answer (a dollar figure) that a generic
  // transfer/endorsement classification would obscure.
  { category: "FEES", patterns: [/\bfee(s)?\b/, /\bcost(s)?\b/, /\bprice\b/, /how much/], confidence: 0.85 },
  { category: "TIMELINE", patterns: [/how long/, /processing time/, /\btimeline\b/, /\bturnaround\b/], confidence: 0.85 },
  { category: "VERIFICATION", patterns: [/\bnursys\b/, /verify.*license/, /license verification/, /verification.*license/], confidence: 0.85 },
  { category: "COMPARISON", patterns: [/\bvs\b/, /\bversus\b/, /compare/, /difference between/], confidence: 0.8 },
  { category: "COMPACT", patterns: [/\bcompact\b/, /multistate license/, /nurse licensure compact/, /\bnlc\b/], confidence: 0.8 },
  { category: "ENDORSEMENT", patterns: [/\bendorsement\b/, /\breciprocity\b/, /endorse/], confidence: 0.8 },
  { category: "TRANSFER", patterns: [/\btransfer\b/, /\bto\b.+\blicense\b|\blicense\b.+\bto\b/, /moving.*license/, /relocat/], confidence: 0.75 },
  { category: "ELIGIBILITY", patterns: [/can i (work|practice|apply)/, /\beligib/, /am i eligible/, /qualify/], confidence: 0.75 },
  { category: "REQUIREMENTS", patterns: [/\brequirement/, /\bneed(s)? to\b/, /\bmust\b/, /\bhours\b.*required|required.*\bhours\b/], confidence: 0.7 },
  { category: "PROCESS", patterns: [/how to/, /\bsteps\b/, /\bprocess\b/, /\bapply\b|\bapplication\b/], confidence: 0.65 },
  { category: "CHANGE_UPDATE", patterns: [/\bchanged\b/, /\bupdate(d)?\b/, /new (rule|law|requirement)/, /\b2025\b|\b2026\b/], confidence: 0.65 },
];

export function classifyIntent(normalizedQuery: string): IntentClassification {
  for (const rule of RULES) {
    const matched = rule.patterns.filter((p) => p.test(normalizedQuery));
    if (matched.length > 0) {
      return {
        intentCategory: rule.category,
        // Slightly higher confidence when multiple independent signals agree — still fully deterministic.
        intentConfidence: matched.length > 1 ? Math.min(1, rule.confidence + 0.1) : rule.confidence,
        matchedSignals: matched.map((p) => p.source),
      };
    }
  }
  // No rule matched — per Step 4's explicit instruction, do not force a
  // classification. A bare, generic query like "nursing license" is
  // real Phase 2C.3 example UNKNOWN/low-confidence, not guessed.
  return { intentCategory: "UNKNOWN", intentConfidence: 0, matchedSignals: [] };
}
