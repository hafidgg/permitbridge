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
import { isConsolidatedTransfer } from "@/lib/publishable-transfers";
import { boardSources } from "@/lib/trade-state-notes";
import fs from "node:fs";
import path from "node:path";
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
  /** false when the pair's own /transfer page was folded into this summary (it 308s here). */
  hasPage: boolean;
  /** For a folded pair: its other steps, minus any written once under sharedSteps. Empty for pairs with a page. */
  steps: string[];
}

/** A step that several folded pairs carry word for word, written once with the origins it applies to. */
export interface SharedStep {
  text: string;
  openQuestion: boolean;
  origins: State[];
  sources: SourceRecord[];
}

export interface TradeStateSummary {
  profession: TradeSummaryProfession;
  destination: State;
  pairs: TradeSummaryPair[];
  /** The destination's route, only when every passing pair agrees on it; otherwise null and rows carry their own. */
  shared: { pathway: PathwayType; feeUsd: number; examRequired: boolean; minimumYearsLicensed: number; source: SourceRecord } | null;
  /** Origin states whose pair was researched but is blocked on an official answer from the board. */
  pendingOrigins: Array<{ origin: State; board: string; question: string }>;
  sharedSteps: SharedStep[];
  /** Board-wide steps moved to /state/{destination} (see getBoardProcedure); the page links there instead. */
  boardProcedure: BoardProcedure | null;
  lastUpdated: string;
}

/**
 * Steps the destination board applies to HVAC and plumbing applicants alike (data/board-procedures/{state}.json),
 * written once on /state/{destination}. Each item names the registered documents that contain it; replacesSteps
 * are the verbatim record steps it stands in for, kept off both summary pages.
 */
export interface BoardProcedure {
  destination: State;
  items: Array<{ text: string; sources: SourceRecord[] }>;
  /** Every agency cited by the items, for the heading. */
  agencies: string[];
  replacesSteps: string[];
}

const NEEDS_REVIEW = /^needs_review:\s*/;

export function isTradeSummaryProfession(slug: string): slug is TradeSummaryProfession {
  return (TRADE_SUMMARY_PROFESSIONS as readonly string[]).includes(slug);
}

export function getBoardProcedure(destinationSlug: string): BoardProcedure | null {
  const destination = getAllStates().find((s) => s.slug === destinationSlug);
  const file = path.join(process.cwd(), "data", "board-procedures", `${destinationSlug}.json`);
  if (!destination || !fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as { items: Array<{ text: string; sourceUrls: string[] }>; replacesSteps: string[] };
  const items = raw.items.map((i) => ({ text: i.text, sources: boardSources(i.sourceUrls, file) }));
  return { destination, items, agencies: [...new Set(items.flatMap((i) => i.sources.map((s) => s.agencyName)))], replacesSteps: raw.replacesSteps };
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
    const hasPage = !isConsolidatedTransfer(rule);
    pairs.push({ rule, origin, source, openQuestions: [], hasPage, steps: [] });
  }
  pairs.sort((a, b) => a.origin.name.localeCompare(b.origin.name));

  // Folded pairs: every step moves here from the old page, except board-wide steps, which live on /state/{destination}.
  // A step two or more of them share verbatim is written once.
  const boardProcedure = getBoardProcedure(destinationSlug);
  const onStatePage = new Set(boardProcedure?.replacesSteps ?? []);
  const folded = pairs.filter((p) => !p.hasPage);
  const byText = new Map<string, TradeSummaryPair[]>();
  for (const p of folded.filter((f) => !f.rule.originRow))
    for (const step of new Set(p.rule.steps)) if (!onStatePage.has(step)) byText.set(step, [...(byText.get(step) ?? []), p]);
  const sharedSteps: SharedStep[] = [...byText.entries()]
    .filter(([, ps]) => ps.length > 1)
    .map(([step, ps]) => ({
      text: step.replace(NEEDS_REVIEW, ""),
      openQuestion: NEEDS_REVIEW.test(step),
      origins: ps.map((p) => p.origin),
      sources: [...new Map(ps.map((p) => [p.source.id, p.source] as const)).values()],
    }));
  const isShared = (step: string) => (byText.get(step)?.length ?? 0) > 1;
  for (const p of pairs) {
    // A folded pair with an originRow is shown as its row plus the page's originShared text, which together carry
    // everything its steps said (board steps on /state/{destination} aside); its steps stay as the research record.
    const own = p.hasPage ? p.rule.steps : p.rule.originRow ? [] : p.rule.steps.filter((s) => !isShared(s) && !onStatePage.has(s));
    p.openQuestions = own.filter((s) => NEEDS_REVIEW.test(s)).map((s) => s.replace(NEEDS_REVIEW, ""));
    p.steps = p.hasPage ? [] : own.filter((s) => !NEEDS_REVIEW.test(s));
  }

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
  return {
    profession,
    destination,
    pairs,
    shared: agree ? { pathway: first.rule.pathway, feeUsd: first.rule.feeUsd, examRequired: first.rule.examRequired, minimumYearsLicensed: first.rule.minimumYearsLicensed, source: first.source } : null,
    pendingOrigins,
    sharedSteps,
    boardProcedure,
    lastUpdated: pairs.map((p) => p.rule.updatedAt).sort().at(-1) ?? "",
  };
}

/** Summary pages with at least one publishable pair — the only ones indexed, in the sitemap, search, llms.txt and hub. */
export function getIndexableTradeStateSummaries(): TradeStateSummary[] {
  return TRADE_SUMMARY_PROFESSIONS.flatMap((p) => TRADE_SUMMARY_STATES.map((s) => getTradeStateSummary(p, s))).filter(
    (s): s is TradeStateSummary => !!s && s.pairs.length > 0
  );
}
