import type { MetadataRoute } from "next";
import { getAllProfessions, getAllStates, getAllTransferRules, getAllGuides, getAllBlogPosts } from "@/lib/data";
import { getAllPublicTransferRuleSlugs, getPublicTransferRule, summarizeEvidence } from "@/lib/knowledge-base/transfer-rule-data";
import { SITE_URL } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/professions`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/states`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/disclaimer`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const professionRoutes: MetadataRoute.Sitemap = getAllProfessions().map((p) => ({
    url: `${SITE_URL}/profession/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const stateRoutes: MetadataRoute.Sitemap = getAllStates().map((s) => ({
    url: `${SITE_URL}/state/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const transferRoutes: MetadataRoute.Sitemap = getAllTransferRules().map((r) => ({
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
      lastModified: summary.latestVerifiedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    };
  });

  return [...staticRoutes, ...professionRoutes, ...stateRoutes, ...transferRoutes, ...guideRoutes, ...blogRoutes, ...knowledgeBaseTransferRoutes];
}
