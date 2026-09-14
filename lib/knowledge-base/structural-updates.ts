/**
 * Bump LINKING_STRUCTURE_UPDATED_AT whenever a shipped change alters how
 * knowledge-base pages are discovered/linked (hub links, search index,
 * llms.txt, sibling links) — even when the underlying facts didn't change.
 * Historically these audits have shipped as one change touching all four
 * surfaces for every knowledge-base page at once (see the 2026-09-05
 * linking audit), so a single shared date is enough; there's no need for
 * per-page or per-surface granularity until that pattern changes.
 *
 * Read by sitemap.ts, which takes the later of a page's own fact-verified
 * date and this constant, so Google gets a real "this URL changed" signal
 * for linking-only changes instead of a sitemap that only moves when facts
 * are re-verified.
 */
export const LINKING_STRUCTURE_UPDATED_AT = "2026-09-05";

/** Returns whichever of the two ISO date strings is later; ignores null/undefined inputs. */
export function latestOf(...dates: Array<string | null | undefined>): string | undefined {
  const valid = dates.filter((d): d is string => !!d);
  if (valid.length === 0) return undefined;
  return valid.reduce((latest, d) => (new Date(d) > new Date(latest) ? d : latest));
}
