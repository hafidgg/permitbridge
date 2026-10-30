/**
 * lib/data.ts
 *
 * Single data-access layer for the whole app. Every page reads through
 * these functions instead of importing JSON directly, so the storage
 * backend (currently static JSON files) can be swapped for a real
 * database later without touching any page or component.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDirExists } from "@/lib/data-dir";
import type {
  Profession,
  ProfessionSummary,
  State,
  StateSummary,
  TransferRule,
} from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJsonDir<T>(dir: string): T[] {
  const full = path.join(DATA_DIR, dir);
  if (!dataDirExists(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(full, f), "utf-8")) as T);
}

// ---------- Professions ----------

export function getAllProfessions(): Profession[] {
  return readJsonDir<Profession>("professions").sort((a, b) => a.name.localeCompare(b.name));
}

export function getProfessionSummaries(): ProfessionSummary[] {
  return getAllProfessions().map(({ slug, name, shortName, category, icon, description }) => ({
    slug,
    name,
    shortName,
    category,
    icon,
    description,
  }));
}

export function getProfessionBySlug(slug: string): Profession | undefined {
  return getAllProfessions().find((p) => p.slug === slug);
}

// ---------- States ----------

export function getAllStates(): State[] {
  return readJsonDir<State>("states").sort((a, b) => a.name.localeCompare(b.name));
}

export function getStateSummaries(): StateSummary[] {
  return getAllStates().map(({ slug, name, abbreviation, region }) => ({ slug, name, abbreviation, region }));
}

export function getStateBySlug(slug: string): State | undefined {
  return getAllStates().find((s) => s.slug === slug);
}

// ---------- Transfer rules ----------

export function getTransferRule(profession: string, from: string, to: string): TransferRule | undefined {
  const filePath = path.join(DATA_DIR, "transfers", profession, `${from}--${to}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TransferRule;
}

export function getAllTransferRules(): TransferRule[] {
  const transfersDir = path.join(DATA_DIR, "transfers");
  if (!dataDirExists(transfersDir)) return [];
  const rules: TransferRule[] = [];
  for (const professionSlug of fs.readdirSync(transfersDir)) {
    const ruleDir = path.join(transfersDir, professionSlug);
    if (!fs.statSync(ruleDir).isDirectory()) continue;
    for (const file of fs.readdirSync(ruleDir)) {
      if (!file.endsWith(".json")) continue;
      rules.push(JSON.parse(fs.readFileSync(path.join(ruleDir, file), "utf-8")) as TransferRule);
    }
  }
  return rules;
}

export function getTransferRulesForProfession(profession: string): TransferRule[] {
  return getAllTransferRules().filter((r) => r.profession === profession);
}

// ---------- Guides & Blog (content/ markdown-backed summaries) ----------

export { getAllGuides, getGuideBySlug, getGuidesLinkedFrom, NURSE_TRANSFER_GUIDE_SLUG } from "@/lib/guides";

// ---------- Long-form content bodies (content/) ----------

export function getGuideBody(slug: string): string | undefined {
  const filePath = path.join(process.cwd(), "content", "guides", `${slug}.md`);
  if (!fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath, "utf-8");
}

