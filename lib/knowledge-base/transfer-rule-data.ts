/**
 * lib/knowledge-base/transfer-rule-data.ts
 *
 * Phase 3.3: the ONLY module the new public pages are allowed to import
 * knowledge-base facts through — per "Data/Logic Separation" (Step 18),
 * no research facts live inside React components. This is a thin,
 * read-only projection over the exact same functions/types every prior
 * phase already built (loadAllSources, validateTransferRule,
 * classifyTransferRuleCoverage, buildTransferRuleSlug) — nothing new is
 * invented here, it only wires existing pieces together for page
 * consumption.
 *
 * "server-only" mirrors the convention already used by lib/data.ts, with
 * one deliberate difference: it is NOT imported here. The real
 * "server-only" package intentionally throws when loaded outside an
 * actual Next.js server-component bundle — which includes this
 * project's own test suite (plain Node/tsx execution). Since this module
 * uses Node built-ins (fs, path) that cannot be bundled into a client
 * component anyway, Next.js's own bundler already rejects an accidental
 * client-component import with a clear "Module not found: Can't resolve
 * 'fs'" error — the same protection "server-only" would add, without
 * blocking this file from being imported directly by scripts/tests.
 */
import fs from "node:fs";
import path from "node:path";
import type { TransferRule, TransferRuleFactFieldKey } from "@/types/transfer-rule";
import type { SourceRecord } from "@/types/knowledge-base";
import { loadAllSources } from "./sources";
import { buildTransferRuleSlug, parseTransferRuleSlug, validateTransferRule } from "./transfer-rule-schema";
import { classifyTransferRuleCoverage, isTransferRulePublishable, CRITICAL_TRANSFER_RULE_FIELDS, getSecondarySourcedFields } from "./transfer-review";

const TRANSFER_RULES_ROOT = path.join(process.cwd(), "data", "knowledge-base", "transfer-rules");
const KNOWN_PROFESSION_SLUGS = new Set(["registered-nurse"]); // matches data/knowledge-base/professions/*.json content

export interface PublicTransferRuleSlug {
  profession: string;
  transfer: string; // "sourceState-to-destinationState"
  sourceState: string;
  destinationState: string;
}

/**
 * The whitelist the page's generateStaticParams() uses. Reads ONLY the
 * files that actually exist on disk — there is no code path that can
 * fabricate a 6th entry. This is what "No Mass Generation" (Step 17) and
 * "no fabricated fallback pages" actually mean in code, not just intent.
 */
export function getAllPublicTransferRuleSlugs(): PublicTransferRuleSlug[] {
  if (!fs.existsSync(TRANSFER_RULES_ROOT)) return [];
  const slugs: PublicTransferRuleSlug[] = [];

  for (const profession of fs.readdirSync(TRANSFER_RULES_ROOT)) {
    const dir = path.join(TRANSFER_RULES_ROOT, profession);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const rule: TransferRule = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      slugs.push({
        profession,
        transfer: `${rule.sourceState}-to-${rule.destinationState}`,
        sourceState: rule.sourceState,
        destinationState: rule.destinationState,
      });
    }
  }
  return slugs;
}

export function getPublicTransferRule(profession: string, transferSlug: string): TransferRule | undefined {
  const parsed = parseTransferRuleSlug(`${profession}/${transferSlug}`);
  if (!parsed) return undefined;
  const filePath = path.join(TRANSFER_RULES_ROOT, profession, `${parsed.sourceState}-to-${parsed.destinationState}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TransferRule;
}

export function getSourceByUrl(url: string): SourceRecord | undefined {
  const sources = loadAllSources();
  return sources.find((s) => s.website === url);
}

export interface PageEvidenceSummary {
  coverageClass: ReturnType<typeof classifyTransferRuleCoverage>;
  publishable: boolean;
  blockingReasons: string[];
  populatedCount: number;
  unknownCount: number;
  secondaryCount: number;
  totalFields: number;
  earliestVerifiedAt: string | null;
  latestVerifiedAt: string | null;
}

const ALL_FIELD_KEYS: TransferRuleFactFieldKey[] = [
  "transferMechanism", "endorsementProcess", "reciprocityAgreementExists", "universalRecognitionApplies",
  "examRequirement", "experienceRequirement", "applicationFeeUsd", "otherRequiredFees",
  "backgroundCheckRequirement", "fingerprintingRequirement", "licenseVerificationRequirement",
  "documentsRequired", "goodStandingRequirement", "disciplinaryDisclosureRequirement", "processingTime",
  "temporaryPermitAvailability", "compactStatus", "exceptions",
];

export function summarizeEvidence(rule: TransferRule): PageEvidenceSummary {
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);

  const coverageClass = classifyTransferRuleCoverage(rule, resolveSource, KNOWN_PROFESSION_SLUGS);
  const { publishable, blockingReasons } = isTransferRulePublishable(rule, resolveSource, KNOWN_PROFESSION_SLUGS);
  const secondaryFields = getSecondarySourcedFields(rule, resolveSource);

  let populated = 0;
  let unknown = 0;
  const dates: string[] = [];
  for (const key of ALL_FIELD_KEYS) {
    const field = rule[key] as any;
    if (field.value === "Unknown") unknown++;
    else {
      populated++;
      if (field.verifiedAt) dates.push(field.verifiedAt);
    }
  }
  dates.sort();

  return {
    coverageClass,
    publishable,
    blockingReasons,
    populatedCount: populated,
    unknownCount: unknown,
    secondaryCount: secondaryFields.length,
    totalFields: ALL_FIELD_KEYS.length,
    earliestVerifiedAt: dates[0] ?? null,
    latestVerifiedAt: dates[dates.length - 1] ?? null,
  };
}

export { buildTransferRuleSlug, CRITICAL_TRANSFER_RULE_FIELDS, ALL_FIELD_KEYS as ALL_TRANSFER_FIELD_KEYS };
export type { TransferRule, SourceRecord };
