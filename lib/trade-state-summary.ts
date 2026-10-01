/**
 * Per-destination-state reciprocity summaries for trade professions
 * (/hvac-technician/{state}, /plumber/{state}), built ONLY from data/transfers
 * pairs that pass isTradeTransferPublishable(). Every discovery surface
 * (page, sitemap, search, llms.txt, profession hub) reads from here, so no
 * surface can list a page or pair the gate doesn't allow.
 */
import "server-only";
import { getAllStates, getAllTransferRules } from "@/lib/data";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { isTradeTransferPublishable } from "@/lib/knowledge-base/trade-transfer-gate";
import type { PathwayType, State, TransferRule } from "@/types";
import type { SourceRecord } from "@/types/knowledge-base";

export const TRADE_SUMMARY_PROFESSIONS = ["hvac-technician", "plumber"] as const;
export type TradeSummaryProfession = (typeof TRADE_SUMMARY_PROFESSIONS)[number];

export const TRADE_SUMMARY_STATES = ["california", "florida", "ohio", "texas"] as const;

export interface TradeSummaryPair {
  rule: TransferRule;
  origin: State;
  source: SourceRecord;
  /** Steps the record itself flags as needs_review — the origin-specific open questions. */
  openQuestions: string[];
}

export interface TradeStateSummary {
  profession: TradeSummaryProfession;
  destination: State;
  pairs: TradeSummaryPair[];
  /** The destination's route, only when every passing pair agrees on it; otherwise null and rows carry their own. */
  shared: { pathway: PathwayType; feeUsd: number; examRequired: boolean; minimumYearsLicensed: number; source: SourceRecord } | null;
  /** Origin states (among those the site covers) with no publishable pair and no research on record. */
  unverifiedOrigins: State[];
  /** Origin states whose pair was researched but is blocked on an official answer from the board. */
  pendingOrigins: Array<{ origin: State; board: string; question: string }>;
  lastUpdated: string;
}

export function isTradeSummaryProfession(slug: string): slug is TradeSummaryProfession {
  return (TRADE_SUMMARY_PROFESSIONS as readonly string[]).includes(slug);
}

export function getTradeStateSummary(profession: TradeSummaryProfession, destinationSlug: string): TradeStateSummary | null {
  if (!(TRADE_SUMMARY_STATES as readonly string[]).includes(destinationSlug)) return null;
  const states = getAllStates();
  const destination = states.find((s) => s.slug === destinationSlug);
  if (!destination) return null;

  const pairs: TradeSummaryPair[] = [];
  for (const rule of getAllTransferRules()) {
    if (rule.profession !== profession || rule.toState !== destinationSlug) continue;
    if (!isTradeTransferPublishable(rule, getSourceByUrl).publishable) continue;
    const origin = states.find((s) => s.slug === rule.fromState);
    const source = getSourceByUrl(rule.sourceUrl!);
    if (!origin || !source) continue;
    pairs.push({ rule, origin, source, openQuestions: rule.steps.filter((s) => s.startsWith("needs_review:")).map((s) => s.replace(/^needs_review:\s*/, "")) });
  }
  pairs.sort((a, b) => a.origin.name.localeCompare(b.origin.name));

  const first = pairs[0];
  const agree =
    first &&
    pairs.every(
      (p) => p.rule.pathway === first.rule.pathway && p.rule.feeUsd === first.rule.feeUsd && p.rule.examRequired === first.rule.examRequired && p.rule.minimumYearsLicensed === first.rule.minimumYearsLicensed && p.source.id === first.source.id
    );

  const covered = new Set(pairs.map((p) => p.origin.slug));
  const pendingOrigins = getAllTransferRules()
    .filter((r) => r.profession === profession && r.toState === destinationSlug && !covered.has(r.fromState) && r.pendingBoardAnswer)
    .map((r) => ({ origin: states.find((s) => s.slug === r.fromState)!, ...r.pendingBoardAnswer! }))
    .filter((p) => !!p.origin)
    .sort((a, b) => a.origin.name.localeCompare(b.origin.name));
  const pendingSlugs = new Set(pendingOrigins.map((p) => p.origin.slug));
  const unverifiedOrigins = states
    .filter((s) => s.slug !== destinationSlug && !covered.has(s.slug) && !pendingSlugs.has(s.slug))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    profession,
    destination,
    pairs,
    shared: agree ? { pathway: first.rule.pathway, feeUsd: first.rule.feeUsd, examRequired: first.rule.examRequired, minimumYearsLicensed: first.rule.minimumYearsLicensed, source: first.source } : null,
    unverifiedOrigins,
    pendingOrigins,
    lastUpdated: pairs.map((p) => p.rule.updatedAt).sort().at(-1) ?? "",
  };
}

/** Summary pages with at least one publishable pair — the only ones indexed, in the sitemap, search, llms.txt and hub. */
export function getIndexableTradeStateSummaries(): TradeStateSummary[] {
  return TRADE_SUMMARY_PROFESSIONS.flatMap((p) => TRADE_SUMMARY_STATES.map((s) => getTradeStateSummary(p, s))).filter(
    (s): s is TradeStateSummary => !!s && s.pairs.length > 0
  );
}
