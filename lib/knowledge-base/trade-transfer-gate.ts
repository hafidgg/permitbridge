/**
 * Publication gate for the trade transfer pages (/transfer/{profession}/{from}/{to},
 * backed by data/transfers/*). The RN gate, isTransferRulePublishable(), can't
 * run on these records: they're flat, with one sourceUrl for the whole rule and
 * no per-field evidence, so this is the adapted, record-level equivalent of the
 * RN schema's Rule 7 (sources must be registered, official, and from the right
 * jurisdiction).
 *
 * Before 2026-10-01, a trade page was indexed on `!!rule.sourceUrl` alone —
 * any URL, registered or not, counted as sourcing. Same gate-gap class as the
 * RN california-to-texas incident.
 */
import type { SourceRecord } from "@/types/knowledge-base";
import type { TransferRule } from "@/types";
import type { PublicationCheckResult } from "@/lib/knowledge-base/transfer-review";

export function isTradeTransferPublishable(
  rule: TransferRule,
  resolveSource: (url: string) => SourceRecord | undefined
): PublicationCheckResult {
  const reasons: string[] = [];
  if (rule.indexingHold) {
    reasons.push(`Indexing hold: ${rule.indexingHold}`);
  }
  if (!rule.sourceUrl) {
    reasons.push("No sourceUrl.");
    return { publishable: false, blockingReasons: reasons };
  }

  const source = resolveSource(rule.sourceUrl);
  if (!source) {
    reasons.push(`sourceUrl is not a registered SourceRecord: ${rule.sourceUrl}`);
    return { publishable: false, blockingReasons: reasons };
  }

  if (source.authorityLevel !== "authoritative") {
    reasons.push(`Source "${source.id}" is ${source.authorityLevel}, not authoritative.`);
  }
  if (source.jurisdiction !== rule.fromState && source.jurisdiction !== rule.toState) {
    reasons.push(`Source "${source.id}" jurisdiction (${source.jurisdiction}) matches neither ${rule.fromState} nor ${rule.toState}.`);
  }

  return { publishable: reasons.length === 0, blockingReasons: reasons };
}
