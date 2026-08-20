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
 * The whitelist the page's generateStaticParams() uses — and, since
 * sitemap.ts and everything else derives from this same function, the
 * single authoritative gate for the entire public-discovery surface
 * (page generation, sitemap, and by extension metadata, since a record
 * that never gets a generated page never gets metadata either).
 *
 * Phase 2B.1: this now ALSO filters through isTransferRulePublishable()
 * — the real, existing quality gate this whole file already imports and
 * already uses for on-page "pending human review" labeling
 * (summarizeEvidence(), below). Before this fix, a record only needed to
 * exist as a .json file on disk to become public; there was no code path
 * enforcing that it also pass the same publishability check the page
 * itself relies on to decide what to honestly tell a reader. This closes
 * that gap using the exact same function, not a second, duplicate one.
 *
 * Still reads ONLY the files that actually exist on disk — there is no
 * code path that can fabricate an entry; this only ever REMOVES entries
 * that fail the gate, never adds one.
 */
export function getAllPublicTransferRuleSlugs(): PublicTransferRuleSlug[] {
  if (!fs.existsSync(TRANSFER_RULES_ROOT)) return [];
  const slugs: PublicTransferRuleSlug[] = [];
  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const resolveSource = (url: string) => sourceByUrl.get(url);

  for (const profession of fs.readdirSync(TRANSFER_RULES_ROOT)) {
    const dir = path.join(TRANSFER_RULES_ROOT, profession);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const rule: TransferRule = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));

      const { publishable } = isTransferRulePublishable(rule, resolveSource, KNOWN_PROFESSION_SLUGS);
      if (!publishable) continue; // fails the real quality gate — never public, regardless of the file existing on disk

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

/**
 * Phase 2B.1: same gate as getAllPublicTransferRuleSlugs(), applied here
 * too — defense-in-depth. In practice, generateStaticParams()'s
 * dynamicParams=false already 404s any slug this function would refuse
 * anyway, but this ensures a direct call to this function (from a future
 * code path that doesn't go through the slug list first) can never
 * return a rule that fails the real quality gate.
 */
export function getPublicTransferRule(profession: string, transferSlug: string): TransferRule | undefined {
  const parsed = parseTransferRuleSlug(`${profession}/${transferSlug}`);
  if (!parsed) return undefined;
  const filePath = path.join(TRANSFER_RULES_ROOT, profession, `${parsed.sourceState}-to-${parsed.destinationState}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  const rule = JSON.parse(fs.readFileSync(filePath, "utf-8")) as TransferRule;

  const sources = loadAllSources();
  const sourceByUrl = new Map(sources.map((s) => [s.website, s]));
  const { publishable } = isTransferRulePublishable(rule, (url) => sourceByUrl.get(url), KNOWN_PROFESSION_SLUGS);
  if (!publishable) return undefined;

  return rule;
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
