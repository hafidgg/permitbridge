/**
 * Destination-level facts for a trade summary page (data/trade-state-notes/{profession}--{state}.json):
 * how the destination board licenses the trade, read from its own registered documents. Each item cites a
 * registered, non-supplementary SourceRecord; an item whose source isn't one fails the build here rather
 * than render unsourced.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import type { SourceRecord } from "@/types/knowledge-base";

export interface TradeStateNoteItem {
  label: string;
  text: string;
  /** Verbatim from the source's raw text. */
  quote?: string;
  cite?: string;
  source: SourceRecord;
}

export interface TradeStateNotes {
  heading: string | null;
  items: TradeStateNoteItem[];
  openQuestions: Array<{ text: string; source: SourceRecord }>;
  /** What applies to every origin row on the summary page, written once; each item with the documents that contain it. */
  originShared: Array<{ text: string; sources: SourceRecord[] }>;
  /** The documents behind the route box (pathway, fees, exam, years). Null: the page falls back to the pairs' source. */
  routeSources: SourceRecord[] | null;
}

interface RawItem {
  label: string;
  text: string;
  quote?: string;
  cite?: string;
  sourceUrl: string;
}

function boardSource(url: string, file: string): SourceRecord {
  const source = getSourceByUrl(url);
  if (!source || source.authorityLevel === "supplementary") throw new Error(`${file}: ${url} is not a registered board source`);
  return source;
}

/** The registered board sources for a list of URLs; throws on any that isn't one, so nothing renders unsourced. */
export function boardSources(urls: string[], file: string): SourceRecord[] {
  if (urls.length === 0) throw new Error(`${file}: an item needs at least one source`);
  return urls.map((u) => boardSource(u, file));
}

export function getTradeStateNotes(profession: string, state: string): TradeStateNotes | null {
  const file = path.join(process.cwd(), "data", "trade-state-notes", `${profession}--${state}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    heading?: string;
    items?: RawItem[];
    openQuestions?: Array<{ text: string; sourceUrl: string }>;
    originShared?: Array<{ text: string; sourceUrls: string[] }>;
    routeSources?: string[];
  };
  return {
    heading: raw.heading ?? null,
    items: (raw.items ?? []).map(({ sourceUrl, ...i }) => ({ ...i, source: boardSource(sourceUrl, file) })),
    openQuestions: (raw.openQuestions ?? []).map((q) => ({ text: q.text, source: boardSource(q.sourceUrl, file) })),
    originShared: (raw.originShared ?? []).map((q) => ({ text: q.text, sources: boardSources(q.sourceUrls, file) })),
    routeSources: raw.routeSources ? boardSources(raw.routeSources, file) : null,
  };
}
