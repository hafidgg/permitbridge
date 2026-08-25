import fs from "node:fs";
import path from "node:path";
import type { ProfessionStateFacts } from "@/types/knowledge-base";
import { loadAllSources } from "./sources";
import { isProfessionStateFactsPublishable } from "./profession-state-facts-review";

/**
 * Phase 2D.4.2 — the single-state sibling of transfer-rule-data.ts.
 * Deliberately its own small module (not a modification of
 * transfer-rule-data.ts) since it reads a genuinely different data
 * shape (ProfessionStateFacts, tier-aware) through a genuinely
 * different quality gate (isProfessionStateFactsPublishable, not
 * isTransferRulePublishable) — confirmed necessary in Phase 2D.4/2D.4.1's
 * architecture review, not invented for convenience.
 *
 * Currently hardcoded to Colorado electrician specifically — this is
 * intentionally NOT a generic "scan every file in every profession
 * folder" discovery function. Phase 2D.4.2's explicit scope is exactly
 * one page; a generic discovery mechanism is future work if/when a
 * second single-state page is actually researched and approved.
 */

const FACTS_DIR = path.join(process.cwd(), "data", "knowledge-base", "facts");

export interface ElectricianStatePageData {
  state: string;
  profession: string;
  tiers: Array<{ tier: string; facts: ProfessionStateFacts }>;
}

/**
 * Returns the page data for /electrician/colorado ONLY if every tier's
 * facts pass the real quality gate. If any tier fails, the whole page is
 * withheld (returns null) rather than silently publishing a partial,
 * potentially misleading page — matching the same "don't build unless
 * genuinely ready" standard the RN TransferRule gate already enforces.
 */
export function getColoradoElectricianPageData(): ElectricianStatePageData | null {
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);

  const tierFiles = [
    { tier: "journeyman", file: "colorado-journeyman.json" },
    { tier: "master", file: "colorado-master.json" },
  ];

  const tiers: Array<{ tier: string; facts: ProfessionStateFacts }> = [];
  for (const { tier, file } of tierFiles) {
    const filePath = path.join(FACTS_DIR, "electrician", file);
    if (!fs.existsSync(filePath)) return null;
    const facts: ProfessionStateFacts = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const check = isProfessionStateFactsPublishable(facts, resolveSource);
    if (!check.publishable) return null; // whole page withheld if any tier fails — never publish a partial/misleading page
    tiers.push({ tier, facts });
  }

  return { state: "colorado", profession: "electrician", tiers };
}

/**
 * The whitelist for generateStaticParams — returns exactly one entry
 * today (Colorado), zero if the quality gate somehow fails. Mirrors the
 * same "no fabricated fallback pages" principle as
 * getAllPublicTransferRuleSlugs().
 */
export function getAllSingleStateProfessionSlugs(): Array<{ profession: string; slug: string }> {
  const data = getColoradoElectricianPageData();
  return data ? [{ profession: "electrician", slug: "colorado" }] : [];
}
