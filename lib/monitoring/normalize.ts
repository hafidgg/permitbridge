/**
 * lib/monitoring/normalize.ts
 *
 * Phase 4.2: the NORMALIZE and HASH/COMPARE stages of the Section 2
 * lifecycle. htmlToText() and hashContent() (the actual normalization and
 * hashing) are reused directly from lib/pipeline/fetcher.ts — not
 * reimplemented here (see lib/monitoring/fetch.ts's re-export). This file
 * adds only what's genuinely new for Phase 4: an explicit, extensible hook
 * for stripping known-volatile content before hashing, and the
 * hash-comparison decision itself.
 */
import { hashContent } from "./fetch";

/**
 * Deliberately conservative and minimal for Phase 4.2: no monitored
 * sources exist yet (Phase 4.11 populates the real pilot), so there is no
 * real page content yet to justify specific volatile-content regexes
 * (e.g. "this page copyright 2026" boilerplate). Inventing such patterns
 * now, untested against real government pages, risks silently stripping
 * meaningful content instead of noise — exactly the guessing this whole
 * phase exists to prevent. This function is the extension point Section 8
 * asks for; real patterns should be added here once Phase 4.11's actual
 * pilot sources reveal what's genuinely volatile on those specific pages.
 */
export interface NormalizeOptions {
  /** Additional regex patterns to strip before hashing, e.g. session IDs or "last updated" timestamps confirmed volatile on a specific real source. Empty by default — see doc comment above. */
  volatilePatterns?: RegExp[];
}

export function normalizeForHashing(text: string, options: NormalizeOptions = {}): string {
  let normalized = text.trim().replace(/\s+/g, " ");
  for (const pattern of options.volatilePatterns ?? []) {
    normalized = normalized.replace(pattern, " ").trim().replace(/\s+/g, " ");
  }
  return normalized;
}

export function computeStableHash(text: string, options: NormalizeOptions = {}): string {
  return hashContent(normalizeForHashing(text, options));
}

export type HashComparisonResult = "NO_CHANGE" | "CONTENT_CHANGED";

/**
 * Section 9's explicit contract: identical hash -> NO_CHANGE, anything
 * else -> CONTENT_CHANGED. A missing previous hash (first-ever successful
 * fetch of a source) is treated as CONTENT_CHANGED — there is genuinely
 * new content to record, even though there's nothing to diff it against
 * yet; the caller (Phase 4.3's change-detection layer) is responsible for
 * not treating a first-ever fetch as a "change" in the field-proposal
 * sense, only as "we now have a baseline."
 */
export function compareHashes(previousHash: string | null | undefined, newHash: string): HashComparisonResult {
  if (previousHash && previousHash === newHash) return "NO_CHANGE";
  return "CONTENT_CHANGED";
}
