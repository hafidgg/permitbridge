import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts } from "@/types/knowledge-base";
import { loadAllSources } from "./sources";
import { isProfessionStateFactsPublishable } from "./profession-state-facts-review";

/**
 * Phase 2D.4.2 (Colorado) / Phase 2D.6.3 (generalized for Virginia) —
 * the single-state sibling of transfer-rule-data.ts. Deliberately its
 * own small module (not a modification of transfer-rule-data.ts) since
 * it reads a genuinely different data shape (ProfessionStateFacts,
 * tier-aware) through a genuinely different quality gate
 * (isProfessionStateFactsPublishable, not isTransferRulePublishable) —
 * confirmed necessary in Phase 2D.4/2D.4.1's architecture review, not
 * invented for convenience.
 *
 * Phase 2D.6.3: generalized from Colorado-only to a small, explicit
 * whitelist of supported states — deliberately NOT a "scan every file in
 * the electrician folder" generic discovery function. Adding a state
 * here still requires its facts files to already exist and pass the
 * real quality gate; this whitelist only says "these are the states
 * worth checking," it never fabricates a page for one that isn't ready.
 */

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts");

const TIER_ORDER = ["journeyman", "master"] as const;

/** States researched and approved through Phase 2D.1/2D.2/2D.6.1 for the electrician single-state page pattern. */
export const SUPPORTED_ELECTRICIAN_STATES = ["colorado", "virginia", "texas", "arkansas", "minnesota", "utah"] as const;

export interface ElectricianStatePageData {
  state: string;
  profession: string;
  tiers: Array<{ tier: string; facts: ProfessionStateFacts }>;
}

/**
 * Returns the page data for /electrician/{state} ONLY if every tier's
 * facts pass the real quality gate. If any tier fails, or a tier file
 * doesn't exist, the whole page is withheld (returns null) rather than
 * silently publishing a partial, potentially misleading page — matching
 * the same "don't build unless genuinely ready" standard the RN
 * TransferRule gate already enforces.
 */
export function getElectricianStatePageData(state: string): ElectricianStatePageData | null {
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);

  const tiers: Array<{ tier: string; facts: ProfessionStateFacts }> = [];
  for (const tier of TIER_ORDER) {
    const filePath = path.join(FACTS_DIR, "electrician", `${state}-${tier}.json`);
    if (!fs.existsSync(filePath)) return null;
    const facts: ProfessionStateFacts = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const check = isProfessionStateFactsPublishable(facts, resolveSource);
    if (!check.publishable) return null; // whole page withheld if any tier fails — never publish a partial/misleading page
    tiers.push({ tier, facts });
  }

  return { state, profession: "electrician", tiers };
}

/**
 * Backward-compatible alias — Phase 2D.4.2's original name, kept so no
 * existing caller needs to change. Behaves identically to
 * getElectricianStatePageData("colorado").
 */
export function getColoradoElectricianPageData(): ElectricianStatePageData | null {
  return getElectricianStatePageData("colorado");
}

/**
 * The whitelist for generateStaticParams — returns only the states from
 * SUPPORTED_ELECTRICIAN_STATES whose data genuinely exists and passes
 * the real quality gate today. Mirrors the same "no fabricated fallback
 * pages" principle as getAllPublicTransferRuleSlugs().
 */
export function getAllSingleStateProfessionSlugs(): Array<{ profession: string; slug: string }> {
  return SUPPORTED_ELECTRICIAN_STATES.filter((state) => getElectricianStatePageData(state) !== null).map((state) => ({ profession: "electrician", slug: state }));
}
