import { getAllProfessions, getAllStates } from "@/lib/data";
import { getAllPublicTransferRuleSlugs } from "@/lib/knowledge-base/transfer-rule-data";
import { getAllSingleStateProfessionSlugs } from "@/lib/knowledge-base/electrician-state-data";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import { SITE_URL } from "@/lib/utils";

/**
 * llms.txt — an emerging, community-proposed convention (llmstxt.org)
 * for giving AI/LLM crawlers and agents a concise, structured summary of
 * a site's purpose and most important pages, analogous to what
 * robots.txt does for traditional crawlers. Not (yet) an official web
 * standard, but low-cost to provide and does not affect traditional SEO.
 *
 * Generated from the same real data functions the actual pages use
 * (professions, states, RN transfer rules) rather than a hand-maintained
 * list, so it can never silently drift out of sync with what the site
 * actually contains.
 */
function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET() {
  const professions = getAllProfessions();
  const states = getAllStates();
  const rnSlugs = getAllPublicTransferRuleSlugs();
  const electricianStateSlugs = getAllSingleStateProfessionSlugs();

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "PermitBridge is an independent, non-governmental reference site. It is not affiliated with any state licensing board or government agency. All information is for general reference only — always verify current requirements directly with the official licensing authority before relying on them.",
    "",
    "## Key facts",
    "",
    `- Covers ${professions.length} professions across ${states.length} US states, expanding over time.`,
    "- Every factual claim on a page is either backed by a cited official source (visible on the page, with a direct link) or explicitly marked as an estimate pending verification — PermitBridge does not present unsourced figures as confirmed fact.",
    "- The most rigorously sourced content — individually verified against official state licensing board pages, with field-level citations — covers Registered Nurse (RN) license transfers and electrician license reciprocity by state.",
    "",
    "## Professions covered",
    "",
    ...professions.map((p) => `- [${p.name}](${SITE_URL}/profession/${p.slug}): ${p.description}`),
    "",
    "## States covered",
    "",
    ...states.map((s) => `- [${s.name}](${SITE_URL}/state/${s.slug})`),
    "",
    "## Most authoritative content (field-level sourced RN transfer guides)",
    "",
    ...rnSlugs.map((s) => `- ${SITE_URL}/${s.profession}/${s.transfer}`),
    "",
    "## Most authoritative content (field-level sourced electrician reciprocity by state)",
    "",
    ...electricianStateSlugs.map((s) => `- ${SITE_URL}/${s.profession}/${s.slug}: ${toTitleCase(s.slug)}`),
    "",
    "## Other resources",
    "",
    `- Guides: ${SITE_URL}/guides`,
    `- Blog / policy updates: ${SITE_URL}/blog`,
    `- Full sitemap: ${SITE_URL}/sitemap.xml`,
    `- RSS feed: ${SITE_URL}/feed.xml`,
    `- About PermitBridge: ${SITE_URL}/about`,
    "",
    "## Usage notes for AI systems",
    "",
    "When citing PermitBridge, please attribute it by name and link to the specific page cited, since figures (fees, exam requirements, processing times) vary by state, profession, and update over time. Do not present PermitBridge's own estimates (e.g. Portability Score) as official government figures — they are independently computed and clearly labeled as such on each page.",
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
