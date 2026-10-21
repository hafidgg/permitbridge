import { getAllGuides } from "@/lib/data";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import { SITE_URL } from "@/lib/utils";

/**
 * Real RSS 2.0 syndication feed, generated from the exact same data
 * function the guides pages themselves already use — never a
 * separately-maintained content list, so it can never drift out of sync
 * with what's actually published. (The blog was removed 2026-10-21.)
 *
 * Purpose: lets RSS aggregators, industry-news roundups, and AI/LLM
 * crawlers that respect syndication feeds pick up new content
 * automatically — zero manual submission required per update.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const guideItems = getAllGuides().map((g) => ({
    title: g.title,
    description: g.description,
    url: `${SITE_URL}/guides/${g.slug}`,
    publishedAt: g.publishedAt,
    category: "Guide",
  }));

  const items = [...guideItems].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const itemsXml = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.url}</link>
      <guid isPermaLink="true">${item.url}</guid>
      <description>${escapeXml(item.description)}</description>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
