import type { MetadataRoute } from "next";
import { getAllProfessions, getAllStates, getAllTransferRules, getAllGuides, getAllBlogPosts } from "@/lib/data";
import { getAllPublicTransferRuleSlugs, getPublicTransferRule, summarizeEvidence, getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { isTradeTransferPublishable } from "@/lib/knowledge-base/trade-transfer-gate";
import { getIndexableTradeStateSummaries } from "@/lib/trade-state-summary";
import { getAllSingleStateProfessionSlugs, getElectricianStatePageData } from "@/lib/knowledge-base/electrician-state-data";
import { LINKING_STRUCTURE_UPDATED_AT, latestOf } from "@/lib/knowledge-base/structural-updates";
import { SITE_URL } from "@/lib/utils";

const KB_LINKED_PROFESSION_HUBS = new Set(["nurse", "electrician", "hvac-technician", "plumber"]);

/**
 * Build-time only. Every source below is read from data/ on disk, and data/
 * only changes through a commit + deploy, so the sitemap is generated once
 * during `next build` and served as-is until the next deploy.
 *
 * This used to be `revalidate = 3600` (ISR), on the theory that an hourly
 * re-run would let a stale sitemap self-correct. It did the opposite: the
 * re-run happens inside a Vercel function whose bundle did not include
 * data/, every data-backed group came back empty, and the live sitemap
 * silently shrank from 78 URLs to the 18 hardcoded ones (2026-10).
 * A stale sitemap is fixed by redeploying, not by revalidating.
 *
 * Guarded by scripts/sitemap-floor.ts: `npm test` (this function), `postbuild`
 * (the prerendered output) and .github/workflows/sitemap-live-check.yml (live).
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/professions`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/states`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/methodology`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/disclaimer`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const professionRoutes: MetadataRoute.Sitemap = getAllProfessions().map((p) => ({
    url: `${SITE_URL}/profession/${p.slug}`,
    // these hubs render knowledge-base / summary-page link sections, so linking-only changes must bump them too.
    lastModified: KB_LINKED_PROFESSION_HUBS.has(p.slug) ? latestOf(p.updatedAt, LINKING_STRUCTURE_UPDATED_AT) : p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const stateRoutes: MetadataRoute.Sitemap = getAllStates().map((s) => ({
    url: `${SITE_URL}/state/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  // Content-trust hardening: only submit transfer pages that pass
  // isTradeTransferPublishable() (registered, authoritative,
  // jurisdiction-matched source) — mirrors the noIndex logic in the page's
  // own generateMetadata(). Pages that fail remain reachable via direct
  // navigation but aren't actively pushed to Google.
  const transferRoutes: MetadataRoute.Sitemap = getAllTransferRules()
    .filter((r) => isTradeTransferPublishable(r, getSourceByUrl).publishable)
    .map((r) => ({
      url: `${SITE_URL}/transfer/${r.profession}/${r.fromState}/${r.toState}`,
      lastModified: r.updatedAt,
      changeFrequency: "monthly",
      priority: 0.85,
    }));

  const guideRoutes: MetadataRoute.Sitemap = getAllGuides().map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    lastModified: g.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const blogRoutes: MetadataRoute.Sitemap = getAllBlogPosts().map((b) => ({
    url: `${SITE_URL}/blog/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Phase 3.3: the 5 real, human-review-pending Registered Nurse transfer
  // pages, sourced from the knowledge base (NOT the simple data/transfers
  // dataset above — a deliberately separate, smaller, deeply-sourced set).
  // Reads only the files that actually exist on disk — exactly the same
  // whitelist the page's own generateStaticParams() uses, so the sitemap
  // can never list a page the site doesn't actually serve.
  const knowledgeBaseTransferRoutes: MetadataRoute.Sitemap = getAllPublicTransferRuleSlugs().map((s) => {
    const rule = getPublicTransferRule(s.profession, s.transfer)!;
    const summary = summarizeEvidence(rule);
    return {
      url: `${SITE_URL}/${s.profession}/${s.transfer}`,
      lastModified: latestOf(summary.latestVerifiedAt, LINKING_STRUCTURE_UPDATED_AT),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    };
  });

  // Phase 2D.4.2: the same automatic, whitelist-only pattern as
  // knowledgeBaseTransferRoutes above, for the new single-state
  // (ProfessionStateFacts) page type — reads only the real, currently-
  // publishable entry (electrician/colorado today), never a manually
  // written URL.
  const singleStateProfessionRoutes: MetadataRoute.Sitemap = getAllSingleStateProfessionSlugs().map((s) => {
    const data = getElectricianStatePageData(s.slug)!; // safe: getAllSingleStateProfessionSlugs() only returns entries that already passed this same lookup
    const latestVerifiedAt = data.tiers
      .flatMap((t) => Object.values(t.facts))
      .filter((v): v is { verifiedAt: string | null } => !!v && typeof v === "object" && "verifiedAt" in v)
      .map((f) => f.verifiedAt)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1);
    return {
      url: `${SITE_URL}/${s.profession}/${s.slug}`,
      lastModified: latestOf(latestVerifiedAt, LINKING_STRUCTURE_UPDATED_AT),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    };
  });

  // Trade per-destination summaries (/hvac-technician/{state}, /plumber/{state}): only pages with at least one
  // pair passing isTradeTransferPublishable(), dated by their newest pair.
  const tradeStateSummaryRoutes: MetadataRoute.Sitemap = getIndexableTradeStateSummaries().map((s) => ({
    url: `${SITE_URL}/${s.profession}/${s.destination.slug}`,
    lastModified: latestOf(s.lastUpdated, LINKING_STRUCTURE_UPDATED_AT),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...professionRoutes, ...stateRoutes, ...transferRoutes, ...guideRoutes, ...blogRoutes, ...knowledgeBaseTransferRoutes, ...singleStateProfessionRoutes, ...tradeStateSummaryRoutes];
}
