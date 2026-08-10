/**
 * lib/pipeline/extract.ts
 *
 * Turns a FetchResult's raw text into an ExtractedRecord by running each
 * source's configured ExtractRule[] against it. This is intentionally
 * regex-based rather than a full DOM/CSS-selector system: government
 * licensing pages rarely expose stable class names or structured markup,
 * but they are consistent about the *language* they use ("universal
 * license recognition", "reciprocity", "endorsement"...). Regex-on-text
 * is more resilient to the frequent HTML redesigns these sites go through.
 *
 * If your source needs richer extraction (e.g. reading data out of an
 * embedded table), add a dedicated function in lib/pipeline/extractors/
 * and register it in the switch in extractRecord() below.
 */
import type { SourceConfig, ExtractRule, ExtractedRecord, FetchResult } from "./types";

/**
 * Exported (Phase 4.3) so lib/monitoring/detect.ts can reuse the exact
 * same regex-on-normalized-text extraction lib/pipeline/extract.ts
 * already uses for the live-site pipeline, rather than reimplementing a
 * parallel extraction mechanism. Already fully decoupled from
 * SourceConfig — this function only ever took an ExtractRule and text.
 */
export function applyRule(rule: ExtractRule, text: string): { value: unknown; matched: boolean } {
  const regex = new RegExp(rule.pattern, "i");
  const match = text.match(regex);

  if (!match) {
    return { value: rule.fallbackWhenAbsent, matched: false };
  }

  switch (rule.transform) {
    case "boolean_presence":
      return { value: true, matched: true };
    case "first_capture_group": {
      const captured = match[1];
      return { value: captured?.trim(), matched: Boolean(captured) };
    }
    case "number": {
      const captured = match[1];
      const num = captured ? Number(captured.replace(/[^0-9.]/g, "")) : NaN;
      return { value: Number.isFinite(num) ? num : rule.fallbackWhenAbsent, matched: Number.isFinite(num) };
    }
    case "year": {
      const captured = match[1];
      const year = captured ? parseInt(captured, 10) : NaN;
      return { value: Number.isFinite(year) ? year : rule.fallbackWhenAbsent, matched: Number.isFinite(year) };
    }
    default:
      return { value: rule.fallbackWhenAbsent, matched: false };
  }
}

export function extractRecord(source: SourceConfig, fetchResult: FetchResult): ExtractedRecord | null {
  if (fetchResult.status !== "ok" || !fetchResult.rawText) return null;

  const fields: Record<string, unknown> = {};
  let matchedCount = 0;

  for (const rule of source.extract) {
    const { value, matched } = applyRule(rule, fetchResult.rawText);
    fields[rule.field] = value;
    if (matched) matchedCount++;
  }

  const confidence = source.extract.length === 0 ? 1 : matchedCount / source.extract.length;

  return {
    sourceId: source.id,
    entityKind: source.entityKind,
    entitySlug: source.entitySlug,
    fields,
    extractedAt: fetchResult.fetchedAt,
    confidence,
  };
}
