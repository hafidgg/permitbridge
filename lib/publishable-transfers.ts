import "server-only";
import type { TransferRule } from "@/types";
import { getAllTransferRules } from "@/lib/data";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { isTradeTransferPublishable } from "@/lib/knowledge-base/trade-transfer-gate";

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
