/**
 * lib/search.ts
 *
 * Builds a flat, serializable search index at build/request time from the
 * JSON data layer. No backend, no third-party search API — the index is
 * small enough (a few hundred documents) to ship to the client and filter
 * in-memory with a simple scored substring/keyword match.
 */
import "server-only";
import type { SearchDocument } from "@/types";
import {
  getAllProfessions,
  getAllStates,
  getAllTransferRules,
  getAllGuides,
  getAllBlogPosts,
} from "@/lib/data";
import { getAllPublicTransferRuleSlugs } from "@/lib/knowledge-base/transfer-rule-data";
import { getAllSingleStateProfessionSlugs } from "@/lib/knowledge-base/electrician-state-data";

function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildSearchIndex(): SearchDocument[] {
  const docs: SearchDocument[] = [];

  for (const p of getAllProfessions()) {
    docs.push({
      type: "profession",
      title: p.name,
      description: p.description,
      url: `/profession/${p.slug}`,
      keywords: [p.name, p.shortName, p.category, "license", "requirements"],
    });
  }

  for (const s of getAllStates()) {
    docs.push({
      type: "state",
      title: `${s.name} Professional Licensing`,
      description: `License transfer and reciprocity rules for professionals moving to or from ${s.name}.`,
      url: `/state/${s.slug}`,
      keywords: [s.name, s.abbreviation, s.region, "license", "reciprocity"],
    });
  }

  for (const r of getAllTransferRules()) {
    const professions = getAllProfessions();
    const states = getAllStates();
    const profession = professions.find((p) => p.slug === r.profession);
    const from = states.find((s) => s.slug === r.fromState);
    const to = states.find((s) => s.slug === r.toState);
    if (!profession || !from || !to) continue;
    docs.push({
      type: "transfer",
      title: `${profession.shortName}: ${from.name} → ${to.name}`,
      description: `${r.pathwayLabel}. ${r.examRequired ? "Exam required." : "No exam required."} Est. ${r.estimatedProcessingDays[0]}-${r.estimatedProcessingDays[1]} days.`,
      url: `/transfer/${profession.slug}/${from.slug}/${to.slug}`,
      keywords: [profession.name, profession.shortName, from.name, to.name, r.pathwayLabel, "transfer license"],
    });
  }

  // These two knowledge-base pipelines (RN transfer pairs, electrician
  // single-state pages) are the site's most rigorously sourced content
  // but live outside the old getAllTransferRules() pipeline above, so
  // they need their own entries here or the search box can't find them.
  const states = getAllStates();
  for (const t of getAllPublicTransferRuleSlugs()) {
    const fromName = states.find((s) => s.slug === t.sourceState)?.name ?? toTitleCase(t.sourceState);
    const toName = states.find((s) => s.slug === t.destinationState)?.name ?? toTitleCase(t.destinationState);
    docs.push({
      type: "transfer",
      title: `Registered Nurse: ${fromName} → ${toName}`,
      description: `Verified, field-sourced RN license transfer guide from ${fromName} to ${toName}.`,
      url: `/${t.profession}/${t.transfer}`,
      keywords: ["registered nurse", "RN", "nursing license", fromName, toName, "transfer license"],
    });
  }

  for (const s of getAllSingleStateProfessionSlugs()) {
    const stateName = toTitleCase(s.slug);
    docs.push({
      type: "transfer",
      title: `Electrician License Reciprocity: ${stateName}`,
      description: `Journeyman and Master electrician license reciprocity and endorsement requirements for ${stateName}.`,
      url: `/${s.profession}/${s.slug}`,
      keywords: ["electrician", "journeyman", "master electrician", stateName, "license reciprocity"],
    });
  }

  for (const g of getAllGuides()) {
    docs.push({
      type: "guide",
      title: g.title,
      description: g.description,
      url: `/guides/${g.slug}`,
      keywords: [g.title, g.category, "guide"],
    });
  }

  for (const b of getAllBlogPosts()) {
    docs.push({
      type: "blog",
      title: b.title,
      description: b.description,
      url: `/blog/${b.slug}`,
      keywords: [b.title, b.tag, "update"],
    });
  }

  return docs;
}
