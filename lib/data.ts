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
import type {
  Profession,
  ProfessionSummary,
  State,
  StateSummary,
  TransferRule,
  GuideSummary,
  BlogPostSummary,
} from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJsonDir<T>(dir: string): T[] {
  const full = path.join(DATA_DIR, dir);
  if (!fs.existsSync(full)) return [];
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
  if (!fs.existsSync(transfersDir)) return [];
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

export function getTopTransfers(limit = 6): TransferRule[] {
  return [...getAllTransferRules()]
    .sort((a, b) => b.portabilityScore - a.portabilityScore)
    .slice(0, limit);
}

export function getHardestTransfers(limit = 6): TransferRule[] {
  return [...getAllTransferRules()]
    .sort((a, b) => a.portabilityScore - b.portabilityScore)
    .slice(0, limit);
}

// ---------- Guides & Blog (content/ markdown-backed summaries) ----------

export function getAllGuides(): GuideSummary[] {
  return [
    {
      slug: "reciprocity-vs-endorsement-vs-comity",
      title: "Reciprocity vs. Endorsement vs. Comity: What's the Real Difference?",
      description:
        "The three pathways regulators use to recognize an out-of-state license are not interchangeable. Here's what actually differs and why it matters for your application.",
      category: "Fundamentals",
      publishedAt: "2026-04-02",
      updatedAt: "2026-06-15",
      readingMinutes: 7,
    },
    {
      slug: "universal-license-recognition-explained",
      title: "Universal License Recognition (ULR) Laws, Explained",
      description:
        "Since 2019, over half of US states have passed some version of a Universal License Recognition law. Here's what it does — and does not — guarantee you.",
      category: "Policy",
      publishedAt: "2026-03-10",
      updatedAt: "2026-06-20",
      readingMinutes: 9,
    },
    {
      slug: "how-to-request-license-verification",
      title: "How to Request License Verification From Your Home State",
      description:
        "Nearly every interstate license transfer starts with a verification request. A step-by-step walkthrough of how to request one without delays.",
      category: "How-To",
      publishedAt: "2026-05-18",
      updatedAt: "2026-05-18",
      readingMinutes: 6,
    },
  ];
}

export function getGuideBySlug(slug: string): GuideSummary | undefined {
  return getAllGuides().find((g) => g.slug === slug);
}

export function getAllBlogPosts(): BlogPostSummary[] {
  return [
    {
      slug: "2026-ulr-state-tracker-update",
      title: "2026 Mid-Year Update: Which States Added Universal License Recognition Laws",
      description:
        "A running log of every state that has enacted, expanded, or proposed Universal License Recognition legislation so far in 2026.",
      publishedAt: "2026-07-01",
      updatedAt: "2026-07-01",
      tag: "Policy Update",
      readingMinutes: 5,
    },
    {
      slug: "nurse-licensure-compact-2026-changes",
      title: "What Changed in the Nurse Licensure Compact in 2026",
      description: "New member states, implementation delays, and what they mean for traveling and relocating nurses.",
      publishedAt: "2026-06-22",
      updatedAt: "2026-06-22",
      tag: "Healthcare",
      readingMinutes: 4,
    },
  ];
}

export function getBlogPostBySlug(slug: string): BlogPostSummary | undefined {
  return getAllBlogPosts().find((p) => p.slug === slug);
}

// ---------- Long-form content bodies (content/) ----------

export function getGuideBody(slug: string): string | undefined {
  const filePath = path.join(process.cwd(), "content", "guides", `${slug}.md`);
  if (!fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath, "utf-8");
}

export function getBlogBody(slug: string): string | undefined {
  const filePath = path.join(process.cwd(), "content", "blog", `${slug}.md`);
  if (!fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath, "utf-8");
}
