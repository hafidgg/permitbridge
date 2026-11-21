/**
 * Pair-level facts for a transfer pair page (data/pair-notes/{profession}--{from}--{to}.json): origin- or
 * destination-specific text quoted verbatim from registered board sources, rendered as one section. Kept
 * apart from the transfer-rule records so adding text never changes a pinned record. Every item must cite a
 * registered, non-supplementary SourceRecord; anything else fails the build (same check as trade-state-notes).
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { boardSources } from "@/lib/trade-state-notes";
import type { SourceRecord } from "@/types/knowledge-base";

export interface PairNoteItem {
  label: string;
  text: string;
  /** Verbatim from the source's raw text. */
  quote: string;
  cite?: string;
  source: SourceRecord;
}

export interface PairNotes {
  heading: string;
  /** ISO date (YYYY-MM-DD) the section's cited sources were read; shown under the heading. */
  sourcesReadOn: string;
  items: PairNoteItem[];
}

interface RawPairNotes {
  heading: string;
  sourcesReadOn: string;
  items: Array<{ label: string; text: string; quote: string; cite?: string; sourceUrl: string }>;
}

export function getPairNotes(profession: string, from: string, to: string): PairNotes | null {
  const file = path.join(process.cwd(), "data", "pair-notes", `${profession}--${from}--${to}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as RawPairNotes;
  if (!raw.heading || !/^\d{4}-\d{2}-\d{2}$/.test(raw.sourcesReadOn ?? "") || !raw.items?.length) {
    throw new Error(`${file}: needs heading, sourcesReadOn (YYYY-MM-DD) and at least one item`);
  }
  return {
    heading: raw.heading,
    sourcesReadOn: raw.sourcesReadOn,
    items: raw.items.map(({ sourceUrl, ...i }) => {
      const [source] = boardSources([sourceUrl], file);
      if (!source) throw new Error(`${file}: ${sourceUrl} is not a registered board source`);
      return { ...i, source };
    }),
  };
}
