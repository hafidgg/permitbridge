import "server-only";
import type { TransferRule as TradeTransferRule } from "@/types";
import type { SourceRecord } from "@/types/knowledge-base";
import { getAllProfessions, getAllStates } from "@/lib/data";
import { getPublishableTransferRules, transferHref } from "@/lib/publishable-transfers";
import { getAllPublicTransferRuleSlugs, getPublicTransferRule, getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { MECHANISM_LABEL, stateDisplayName } from "@/lib/knowledge-base/transfer-rule-labels";
import { getIndexableTradeStateSummaries } from "@/lib/trade-state-summary";
import { getAllSingleStateProfessionSlugs } from "@/lib/knowledge-base/electrician-state-data";

/**
 * One row of a "sourced routes" table. Every value is read off a record that
 * already passed its publish gate (getPublishableTransferRules() for trades,
 * getAllPublicTransferRuleSlugs() for RN), and the board is the registered
 * source that record cites. Nothing here is computed or estimated.
 */
export interface SourcedRoute {
  href: string;
  professionSlug: string;
  profession: string;
  from: string;
  to: string;
  pathway: string;
  /** null when the fee is not published by a registered board source. */
  feeUsd: number | null;
  /** True when the fee is held for re-checking (displayHold), so null doesn't read as "not published". */
  feeHeld?: boolean;
  exam: "Required" | "Not required" | "Depends on the license" | "Not published by the board" | "Being re-checked";
  board: SourceRecord | undefined;
}

const RN_EXAM: Record<string, SourcedRoute["exam"]> = {
  required: "Required",
  not_required: "Not required",
  not_applicable: "Not required",
  conditional: "Depends on the license",
};

function tradeRoute(r: TradeTransferRule): SourcedRoute {
  const professionName = getAllProfessions().find((p) => p.slug === r.profession)?.shortName ?? r.profession;
  const stateName = (slug: string) => getAllStates().find((s) => s.slug === slug)?.name ?? stateDisplayName(slug);
  return {
    href: transferHref(r),
    professionSlug: r.profession,
    profession: professionName,
    from: stateName(r.fromState),
    to: stateName(r.toState),
    pathway: r.pathwayLabel,
    feeUsd: r.feeUsd,
    exam: r.examRequired ? "Required" : "Not required",
    board: r.sourceUrl ? getSourceByUrl(r.sourceUrl) : undefined,
  };
}

/** A field counts only when it cites a registered, non-supplementary source. */
function boardSourced(sourceUrl: string | null | undefined): boolean {
  const source = sourceUrl ? getSourceByUrl(sourceUrl) : undefined;
  return !!source && source.authorityLevel !== "supplementary";
}

function rnRoutes(): SourcedRoute[] {
  return getAllPublicTransferRuleSlugs().flatMap((s) => {
    const rule = getPublicTransferRule(s.profession, s.transfer);
    if (!rule) return [];
    const mechanism = rule.transferMechanism.value === "Unknown" ? "unknown" : (rule.transferMechanism.value as string);
    const fee = rule.applicationFeeUsd;
    const exam = rule.examRequirement;
    const examStatus = exam.value !== "Unknown" && boardSourced(exam.sourceUrl) ? (exam.value as { status: string }).status : null;
    const held = new Set(rule.heldFields ?? []);
    return [
      {
        href: `/${s.profession}/${s.transfer}`,
        // the knowledge base's "registered-nurse" is the live site's "nurse" profession
        professionSlug: "nurse",
        profession: "Registered Nurse",
        from: stateDisplayName(rule.sourceState),
        to: stateDisplayName(rule.destinationState),
        pathway: held.has("transferMechanism") ? "Being re-checked" : (MECHANISM_LABEL[mechanism] ?? mechanism),
        feeUsd: fee.value !== "Unknown" && boardSourced(fee.sourceUrl) ? (fee.value as number) : null,
        feeHeld: held.has("applicationFeeUsd"),
        exam: held.has("examRequirement") ? "Being re-checked" : (examStatus && RN_EXAM[examStatus]) || "Not published by the board",
        board: rule.transferMechanism.sourceUrl ? getSourceByUrl(rule.transferMechanism.sourceUrl) : undefined,
      },
    ];
  });
}

export function getAllSourcedRoutes(): SourcedRoute[] {
  return [...getPublishableTransferRules().map(tradeRoute), ...rnRoutes()];
}

export interface StateCoverage {
  into: SourcedRoute[];
  outOf: SourcedRoute[];
  /** Destination-state summary pages (trade summaries, single-state electrician pages) for this state. */
  statePages: Array<{ href: string; label: string }>;
  /** The registered sources cited by routes into this state, one per agency. */
  boards: SourceRecord[];
}

export function getStateCoverage(stateSlug: string, stateName: string): StateCoverage {
  const routes = getAllSourcedRoutes();
  const into = routes.filter((r) => r.to === stateName);
  const outOf = routes.filter((r) => r.from === stateName);
  const statePages = [
    ...getIndexableTradeStateSummaries()
      .filter((s) => s.destination.slug === stateSlug)
      .map((s) => ({
        href: `/${s.profession}/${stateSlug}`,
        label: `${stateName} ${s.profession === "plumber" ? "plumber" : "HVAC"} license transfer, by origin state`,
      })),
    ...getAllSingleStateProfessionSlugs()
      .filter((s) => s.slug === stateSlug)
      .map((s) => ({ href: `/${s.profession}/${s.slug}`, label: `${stateName} electrician reciprocity, Journeyman and Master` })),
  ];
  const boards = [...new Map(into.flatMap((r) => (r.board ? [[r.board.agencyName, r.board] as const] : []))).values()];
  return { into, outOf, statePages, boards };
}
