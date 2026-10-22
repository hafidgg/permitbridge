import "server-only";
import type { TransferRule } from "@/types";
import { getAllTransferRules } from "@/lib/data";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { isTradeTransferPublishable } from "@/lib/knowledge-base/trade-transfer-gate";
import consolidated from "@/data/consolidated-transfers.json";

/**
 * The data/transfers pairs that pass isTradeTransferPublishable(). Every
 * listing, score or summary built from transfer rules (home page, profession
 * hubs, state pages, search) reads these, never getAllTransferRules(): an
 * unsourced pair's generator pathway, exam flag and score must not surface on
 * another page as fact.
 */
export function getPublishableTransferRules(): TransferRule[] {
  return getAllTransferRules().filter((r) => isTradeTransferPublishable(r, getSourceByUrl).publishable);
}

const CONSOLIDATED = new Set(consolidated.pairs.map((p) => `${p.profession}/${p.from}/${p.to}`));

/**
 * A publishable pair whose own /transfer page was folded into its destination
 * summary page (/{profession}/{toState}). The record still feeds that summary;
 * the old URL 308s to it (next.config.mjs, same JSON list).
 */
export function isConsolidatedTransfer(r: Pick<TransferRule, "profession" | "fromState" | "toState">): boolean {
  return CONSOLIDATED.has(`${r.profession}/${r.fromState}/${r.toState}`);
}

/** Publishable pairs that still have their own /transfer page — the only ones built, listed or linked as pages. */
export function getTransferPageRules(): TransferRule[] {
  return getPublishableTransferRules().filter((r) => !isConsolidatedTransfer(r));
}

/** Where a publishable pair is read: its own page, or its row on the destination summary page. */
export function transferHref(r: Pick<TransferRule, "profession" | "fromState" | "toState">): string {
  return isConsolidatedTransfer(r) ? `/${r.profession}/${r.toState}#from-${r.fromState}` : `/transfer/${r.profession}/${r.fromState}/${r.toState}`;
}
