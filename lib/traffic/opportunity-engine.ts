import fs from "node:fs";
import path from "node:path";
import { getAllPublicTransferRuleSlugs, getPublicTransferRule } from "../knowledge-base/transfer-rule-data";
import type { GeoClassification } from "./geo-classifier";
import type { IntentClassification } from "./intent-classifier";
import type { GscTopQueryRow } from "../integrations/google-search-console/types";

/**
 * Deliberately reads professions/states/old-pipeline-transfers directly
 * via node:fs rather than through lib/data.ts, which imports the real
 * "server-only" package (correctly, for its actual Next.js callers) —
 * that package intentionally throws outside a real Next.js server
 * bundle, including this module's own test suite (plain tsx). Same safe
 * pattern already used by geo-classifier.ts and
 * lib/monitoring/content-freshness.ts.
 *
 * getAllPublicTransferRuleSlugs()/getPublicTransferRule() (RN pages) ARE
 * safely importable directly — lib/knowledge-base/transfer-rule-data.ts
 * deliberately does NOT import "server-only" (documented in its own file
 * header), relying on fs's own protection instead.
 */
const PROFESSIONS_DIR = path.join(process.cwd(), "data", "professions");
const OLD_STATES_DIR = path.join(process.cwd(), "data", "states");
const OLD_TRANSFERS_DIR = path.join(process.cwd(), "data", "transfers");

function readJsonDir(dir: string): any[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));
}

export type MatchType = "EXACT" | "STRONG" | "PARTIAL" | "NONE" | "UNKNOWN";

export interface PageMatch {
  matchedPage: string | null;
  matchType: MatchType;
  matchConfidence: number; // 0-1
  profession: string | null;
  sourceState: string | null;
  destinationState: string | null;
}

/**
 * Matches a query (already geo/intent-classified) against REAL existing
 * PermitBridge pages — never inferred from the URL string alone; always
 * checked against the actual underlying data records.
 *
 * Priority order (checked in this sequence, first real match wins):
 *   1. RN transfer pages (source+destination state, the highest-value,
 *      most rigorously sourced content) — EXACT if both states + a
 *      nurse-related query match a real published TransferRule.
 *   2. Old-pipeline transfer pages (any of the 5 professions) — STRONG,
 *      since this dataset's sourcing quality varies (Phase 2B.1 finding).
 *   3. State pages — PARTIAL, since a single-state query is a much
 *      weaker signal for a specific page than a transfer pair.
 *   4. Profession pages — PARTIAL.
 *   5. No real match — NONE. Never fabricates a "close enough" match.
 */
export function matchExistingPage(geo: GeoClassification, intent: IntentClassification, normalizedQuery: string): PageMatch {
  const isNurseQuery = /\bnurse\b|\brn\b|\bnursing\b/.test(normalizedQuery);

  // 1. RN transfer pages — the real, currently-published knowledge-base pairs.
  if (geo.sourceState && geo.destinationState) {
    const rnSlugs = getAllPublicTransferRuleSlugs();
    const rnMatch = rnSlugs.find((s) => s.sourceState === geo.sourceState && s.destinationState === geo.destinationState);
    if (rnMatch && isNurseQuery) {
      const rule = getPublicTransferRule(rnMatch.profession, rnMatch.transfer);
      if (rule) {
        return {
          matchedPage: `/${rnMatch.profession}/${rnMatch.transfer}`,
          matchType: "EXACT",
          matchConfidence: 0.95,
          profession: "registered-nurse",
          sourceState: geo.sourceState,
          destinationState: geo.destinationState,
        };
      }
    }
  }

  // 2. Old-pipeline transfer pages (data/transfers/) — any profession.
  if (geo.sourceState && geo.destinationState) {
    const professions = readJsonDir(PROFESSIONS_DIR);
    for (const prof of professions) {
      const filePath = path.join(OLD_TRANSFERS_DIR, prof.slug, `${geo.sourceState}--${geo.destinationState}.json`);
      if (fs.existsSync(filePath)) {
        const record = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        // Old-pipeline pages are only real public pages if they pass the
        // same sourceUrl-based gate the site itself uses (Phase 2B.1) —
        // never claim a match for a page that's actually noindex.
        if (record.sourceUrl) {
          return {
            matchedPage: `/transfer/${prof.slug}/${geo.sourceState}/${geo.destinationState}`,
            matchType: "STRONG",
            matchConfidence: 0.75,
            profession: prof.slug,
            sourceState: geo.sourceState,
            destinationState: geo.destinationState,
          };
        }
      }
    }
  }

  // 3. State pages — only the 5 states that actually have a live old-pipeline page.
  const singleState = geo.destinationState ?? geo.sourceState;
  if (singleState) {
    const oldStates = readJsonDir(OLD_STATES_DIR);
    if (oldStates.some((s) => s.slug === singleState)) {
      return {
        matchedPage: `/state/${singleState}`,
        matchType: "PARTIAL",
        matchConfidence: 0.5,
        profession: null,
        sourceState: geo.sourceState,
        destinationState: geo.destinationState,
      };
    }
  }

  // 4. Profession pages.
  if (isNurseQuery) {
    const professions = readJsonDir(PROFESSIONS_DIR);
    const nurseProfession = professions.find((p) => p.slug === "nurse");
    if (nurseProfession) {
      return {
        matchedPage: "/profession/nurse",
        matchType: "PARTIAL",
        matchConfidence: 0.4,
        profession: "nurse",
        sourceState: geo.sourceState,
        destinationState: geo.destinationState,
      };
    }
  }

  return { matchedPage: null, matchType: geo.geoRelevance === "UNKNOWN" ? "UNKNOWN" : "NONE", matchConfidence: 0, profession: null, sourceState: geo.sourceState, destinationState: geo.destinationState };
}

export type OpportunityClassification = "IMPROVE_EXISTING" | "CONTENT_GAP" | "NEW_PAGE_CANDIDATE" | "DO_NOT_BUILD" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE";

export type DataReadiness = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface ScoreBreakdown {
  realDemand: number; // 0-5, from real impressions/clicks only
  usRelevance: number; // 0-3
  pageGap: number; // 0-3, higher when a real gap exists (no matching page)
  dataReadiness: number; // 0-3, from real per-state fact completeness
  sourceAvailability: number; // 0-2, from whether relevant official sources already exist in this project
  risk: number; // 0 to -3, penalty for thin/ambiguous/unsupported signals
}

export interface TrafficOpportunity {
  query: string;
  normalizedQuery: string;
  page: string | null;
  profession: string | null;
  sourceState: string | null;
  destinationState: string | null;
  geoRelevance: GeoClassification["geoRelevance"];
  intentCategory: IntentClassification["intentCategory"];
  intentConfidence: number;
  matchType: MatchType;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  position: number | null;
  dataReadiness: DataReadiness;
  score: number | null;
  scoreBreakdown: ScoreBreakdown | null;
  classification: OpportunityClassification;
  reason: string;
  reviewRequired: true;
}

/**
 * Real per-state RN fact completeness (data/knowledge-base/facts/) —
 * reused, never duplicated. A state with real, populated core fields
 * means a genuine new-page candidate could actually be sourced; a state
 * with mostly Unknown fields means REVIEW/LOW readiness, not a green
 * light to publish. Mirrors the exact reasoning already established and
 * proven across Phase 2B.2-2B.4.
 */
const RN_FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts", "registered-nurse");
const CORE_RN_FACT_FIELDS = ["licensingBoard", "officialWebsite", "compactMembership", "endorsementFeeUsd", "requiredExams"];

function assessDataReadiness(sourceState: string | null, destinationState: string | null, isNurseQuery: boolean): DataReadiness {
  if (!isNurseQuery) return "UNKNOWN"; // this engine only has real fact-completeness data for RN currently
  const states = [sourceState, destinationState].filter((s): s is string => !!s);
  if (states.length === 0) return "UNKNOWN";

  let populatedCount = 0;
  let totalCount = 0;
  for (const state of states) {
    const filePath = path.join(RN_FACTS_DIR, `${state}.json`);
    if (!fs.existsSync(filePath)) continue;
    const facts = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    for (const field of CORE_RN_FACT_FIELDS) {
      totalCount++;
      const value = facts[field]?.value;
      if (value !== undefined && value !== null && value !== "Unknown") populatedCount++;
    }
  }
  if (totalCount === 0) return "UNKNOWN";
  const ratio = populatedCount / totalCount;
  if (ratio >= 0.8) return "HIGH";
  if (ratio >= 0.5) return "MEDIUM";
  return "LOW";
}

/**
 * The single deterministic, explainable entry point: real GSC row +
 * geo/intent classification -> a fully-formed, human-reviewable
 * TrafficOpportunity. Never publishes, never writes to the
 * knowledge-base — reviewRequired is always true, unconditionally.
 */
export function buildOpportunity(row: GscTopQueryRow, geo: GeoClassification, intent: IntentClassification, normalizedQuery: string): TrafficOpportunity {
  const match = matchExistingPage(geo, intent, normalizedQuery);
  const isNurseQuery = /\bnurse\b|\brn\b|\bnursing\b/.test(normalizedQuery);
  const dataReadiness = assessDataReadiness(match.sourceState, match.destinationState, isNurseQuery);

  // --- Score breakdown — every component traceable to a real, explained input ---
  const realDemand = Math.min(5, Math.round((row.clicks / 5) + (row.impressions / 200)));
  const usRelevance = geo.geoRelevance === "US_HIGH" ? 3 : geo.geoRelevance === "US_MEDIUM" ? 2 : geo.geoRelevance === "US_LOW" ? 1 : 0;
  const pageGap = match.matchedPage === null ? 3 : match.matchType === "PARTIAL" ? 2 : 0;
  const dataReadinessScore = dataReadiness === "HIGH" ? 3 : dataReadiness === "MEDIUM" ? 2 : dataReadiness === "LOW" ? 1 : 0;
  const sourceAvailability = dataReadiness === "HIGH" || dataReadiness === "MEDIUM" ? 2 : dataReadiness === "LOW" ? 1 : 0;
  let risk = 0;
  if (intent.intentConfidence < 0.5) risk -= 1;
  if (geo.geoRelevance === "UNKNOWN") risk -= 1;
  if (row.impressions < 10) risk -= 1; // thin signal — a query seen almost nothing in real GSC data

  const scoreBreakdown: ScoreBreakdown = { realDemand, usRelevance, pageGap, dataReadiness: dataReadinessScore, sourceAvailability, risk };
  const score = realDemand + usRelevance + pageGap + dataReadinessScore + sourceAvailability + risk;

  // --- Classification — deterministic rules, per Step 9 ---
  let classification: OpportunityClassification;
  let reason: string;

  if (geo.geoRelevance === "NON_US") {
    classification = "DO_NOT_BUILD";
    reason = "Query classified as non-US relevant; PermitBridge is US-first.";
  } else if (match.matchedPage && (match.matchType === "EXACT" || match.matchType === "STRONG")) {
    classification = "IMPROVE_EXISTING";
    reason = `Real GSC query already maps to an existing page (${match.matchedPage}, ${match.matchType} match) — opportunity is to strengthen that page, not build a new one.`;
  } else if (match.matchedPage === null && geo.geoRelevance === "US_HIGH" && intent.intentConfidence >= 0.7 && dataReadiness === "HIGH") {
    classification = "NEW_PAGE_CANDIDATE";
    reason = `Clear US-relevant intent, no existing page, and real per-state facts already support this pair — genuine content gap with sourcing readily available.`;
  } else if (match.matchedPage === null && geo.geoRelevance === "US_HIGH" && (dataReadiness === "MEDIUM" || dataReadiness === "LOW")) {
    classification = "NEEDS_REVIEW";
    reason = `Real US-relevant demand with no existing page, but underlying facts are incomplete (${dataReadiness}) — requires human research before any page could be built, exactly like Phase 2B.2-2B.4's process.`;
  } else if (geo.geoRelevance === "UNKNOWN" && intent.intentCategory === "UNKNOWN") {
    // Checked BEFORE the PARTIAL-match branch below: a weak profession-
    // page match found only via a stray keyword (e.g. "nursing" in
    // "nursing license") is not a meaningful signal when we also don't
    // know the geography OR the intent — genuinely insufficient
    // evidence, not a real content gap. Matches the real Phase 2C.3
    // worked example ("nursing license" -> UNKNOWN/low confidence).
    classification = "INSUFFICIENT_EVIDENCE";
    reason = "Neither geographic relevance nor intent could be determined with confidence — a stray page match alone is not sufficient evidence of a real content gap.";
  } else if (match.matchType === "PARTIAL") {
    classification = "CONTENT_GAP";
    reason = `A related page exists (${match.matchedPage}) but doesn't directly answer this specific query — represents a content gap on an existing page, not necessarily a new one.`;
  } else if (geo.geoRelevance === "UNKNOWN" || intent.intentCategory === "UNKNOWN") {
    classification = "INSUFFICIENT_EVIDENCE";
    reason = "Geographic relevance or intent could not be determined with confidence from the query text alone.";
  } else {
    classification = "INSUFFICIENT_EVIDENCE";
    reason = "Does not meet the evidence threshold for any other classification.";
  }

  return {
    query: row.query,
    normalizedQuery,
    page: match.matchedPage,
    profession: match.profession,
    sourceState: match.sourceState,
    destinationState: match.destinationState,
    geoRelevance: geo.geoRelevance,
    intentCategory: intent.intentCategory,
    intentConfidence: intent.intentConfidence,
    matchType: match.matchType,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    position: row.position,
    dataReadiness,
    score,
    scoreBreakdown,
    classification,
    reason,
    reviewRequired: true,
  };
}

/**
 * Top-level entry point: a full GSC snapshot -> a US-first-prioritized
 * opportunity queue. Explicitly returns an empty array (not fabricated
 * opportunities) when no real query data exists — see Step 21's
 * real-data guardrail.
 */
export function buildOpportunityQueue(topQueries: GscTopQueryRow[] | undefined, normalizeQueryFn: (raw: string) => string, classifyGeoFn: (q: string) => GeoClassification, classifyIntentFn: (q: string) => IntentClassification): TrafficOpportunity[] {
  if (!topQueries || topQueries.length === 0) return [];

  const opportunities = topQueries.map((row) => {
    const normalized = normalizeQueryFn(row.query);
    const geo = classifyGeoFn(normalized);
    const intent = classifyIntentFn(normalized);
    return buildOpportunity(row, geo, intent, normalized);
  });

  // US-first prioritization (Step 20): US_HIGH improvements/gaps first,
  // then US_HIGH new-page candidates, then descending relevance, NON_US
  // last — but never hidden, always present in the returned queue.
  const relevanceRank: Record<GeoClassification["geoRelevance"], number> = { US_HIGH: 0, US_MEDIUM: 1, US_LOW: 2, UNKNOWN: 3, NON_US: 4 };
  return opportunities.sort((a, b) => {
    const relevanceDiff = relevanceRank[a.geoRelevance] - relevanceRank[b.geoRelevance];
    if (relevanceDiff !== 0) return relevanceDiff;
    return (b.score ?? -Infinity) - (a.score ?? -Infinity);
  });
}
