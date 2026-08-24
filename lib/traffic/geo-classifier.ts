import fs from "node:fs";
import path from "node:path";

/**
 * Phase 2C.3 — deterministic query normalization.
 *
 * Whitespace/casing/harmless-punctuation only — never stems words, never
 * removes meaningful terms, never touches an external model. The same
 * input always produces the same output.
 */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[?!.,;:"'()]/g, " ") // harmless punctuation only
    .replace(/\s+/g, " ")
    .trim();
}

export type GeoRelevance = "US_HIGH" | "US_MEDIUM" | "US_LOW" | "NON_US" | "UNKNOWN";

export interface GeoClassification {
  geoRelevance: GeoRelevance;
  sourceState: string | null; // real state slug, e.g. "texas"
  destinationState: string | null;
  matchedStateSlugs: string[]; // every distinct state actually found, in query order
}

interface StateLookupEntry {
  slug: string;
  name: string;
  abbreviation: string;
}

/**
 * Built from the REAL, existing 50-state knowledge-base records
 * (data/knowledge-base/states/*.json — confirmed to contain all 50
 * states) — never a separately hand-maintained list that could drift
 * out of sync. Abbreviations are real (State.abbreviation, e.g. "TX"
 * for Texas).
 *
 * Deliberately does NOT use the old-pipeline data/states/ directory
 * (only 5 states) — geographic RECOGNITION must cover all 50 states
 * regardless of which states currently have a live PermitBridge page;
 * that's a separate concern handled by page-matcher.ts.
 *
 * Reads the JSON files directly via node:fs rather than importing
 * lib/data.ts: that module imports the real "server-only" package
 * (correctly, for its actual Next.js callers), which intentionally
 * throws outside a real Next.js server bundle — including this
 * module's own test suite, run via plain tsx. Reading the same JSON
 * files directly is the same safe pattern already established in
 * lib/monitoring/content-freshness.ts.
 *
 * DC is added explicitly below (not present in the real state files,
 * since PermitBridge has no DC content/page — this is a geographic
 * recognition entry only, not a claim that DC regulatory data exists).
 */
const STATES_DIR = path.join(process.cwd(), "data", "knowledge-base", "states");

let cachedStateLookup: StateLookupEntry[] | null = null;
function getStateLookup(): StateLookupEntry[] {
  if (cachedStateLookup) return cachedStateLookup;
  const fromFiles: StateLookupEntry[] = fs.existsSync(STATES_DIR)
    ? fs
        .readdirSync(STATES_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(STATES_DIR, f), "utf-8")))
        .map((s) => ({ slug: s.slug, name: s.name.toLowerCase(), abbreviation: s.abbreviation.toLowerCase() }))
    : [];
  cachedStateLookup = [...fromFiles, { slug: "district-of-columbia", name: "district of columbia", abbreviation: "dc" }];
  return cachedStateLookup;
}

const US_SIGNAL_WORDS = ["us", "usa", "united states", "u.s.", "u.s.a."];

// Deliberately conservative: a bare 2-letter token is only treated as a
// state abbreviation when it's a whole word (word-boundary match) — "us"
// itself is handled separately as a country signal, never as the state
// of "US" (not a real state), avoiding a whole class of false positives
// (e.g. "in" as a preposition vs. Indiana's abbreviation "IN" is
// intentionally NOT matched — two-letter common English words that also
// happen to be state abbreviations are excluded from the abbreviation
// table to avoid exactly this false-positive class).
const AMBIGUOUS_ABBREVIATIONS = new Set(["in", "or", "me", "hi", "ok", "pa", "de", "la", "ma", "id"]);

/**
 * Detects real US states mentioned in a normalized query, and — where
 * the query has a clear "X to Y" / "X vs Y" transfer/comparison shape —
 * which one is the source vs. destination. Deliberately conservative:
 * only returns a source/destination distinction when the evidence is
 * genuinely there in the text, never guessed from a single mention.
 */
export function classifyGeo(normalizedQuery: string): GeoClassification {
  const lookup = getStateLookup();
  const words = normalizedQuery.split(" ");

  const found: Array<{ slug: string; index: number }> = [];
  for (const entry of lookup) {
    // Full state name match (may be multi-word, e.g. "new york")
    if (normalizedQuery.includes(entry.name)) {
      const idx = normalizedQuery.indexOf(entry.name);
      found.push({ slug: entry.slug, index: idx });
      continue;
    }
    // Abbreviation match, whole-word only, excluding ambiguous common-English-word abbreviations
    if (!AMBIGUOUS_ABBREVIATIONS.has(entry.abbreviation) && words.includes(entry.abbreviation)) {
      const idx = words.indexOf(entry.abbreviation);
      found.push({ slug: entry.slug, index: idx });
    }
  }

  // De-duplicate by slug, keep first occurrence order
  const seen = new Set<string>();
  const ordered = found
    .sort((a, b) => a.index - b.index)
    .filter((f) => {
      if (seen.has(f.slug)) return false;
      seen.add(f.slug);
      return true;
    });

  const matchedStateSlugs = ordered.map((f) => f.slug);
  const hasUsWord = US_SIGNAL_WORDS.some((w) => normalizedQuery.includes(w));

  let sourceState: string | null = null;
  let destinationState: string | null = null;
  const hasTransferShape = /\bto\b|\bvs\b|\bversus\b/.test(normalizedQuery);
  if (matchedStateSlugs.length >= 2 && hasTransferShape) {
    sourceState = matchedStateSlugs[0]!;
    destinationState = matchedStateSlugs[1]!;
  } else if (matchedStateSlugs.length === 1) {
    // A single state with no explicit transfer shape is treated as the
    // destination — matches the real Phase 2A example ("nursing license
    // requirements california" -> destinationState = California).
    destinationState = matchedStateSlugs[0]!;
  }

  let geoRelevance: GeoRelevance;
  if (matchedStateSlugs.length >= 2) {
    geoRelevance = "US_HIGH";
  } else if (matchedStateSlugs.length === 1) {
    geoRelevance = "US_HIGH";
  } else if (hasUsWord) {
    geoRelevance = "US_MEDIUM";
  } else {
    // No explicit US signal at all. Per Step 3's explicit instruction —
    // "do not guess geographic intent from weak signals" — a query with
    // zero state/country signal is UNKNOWN, not assumed NON_US and not
    // assumed US. PermitBridge's whole vocabulary (licensing,
    // endorsement, reciprocity) is itself US-centric, but that alone is
    // not treated as strong evidence here — it's exactly the kind of
    // weak signal Step 3 says not to guess from.
    geoRelevance = "UNKNOWN";
  }

  return { geoRelevance, sourceState, destinationState, matchedStateSlugs };
}
