/**
 * Guide summaries (content/guides/*.md holds the bodies). Plain data with no
 * "server-only" import, so scripts outside the react-server condition
 * (scripts/guide-links.ts, run by postbuild) can read it. lib/data.ts re-exports it.
 */
import type { GuideSummary } from "@/types";

export function getAllGuides(): GuideSummary[] {
  return [
    {
      slug: "reciprocity-vs-endorsement-vs-comity",
      title: "Reciprocity vs. Endorsement vs. Comity: What's the Real Difference?",
      description:
        "The three pathways regulators use to recognize an out-of-state license are not interchangeable. Here's what actually differs and why it matters for your application.",
      category: "Fundamentals",
      publishedAt: "2026-04-02",
      updatedAt: "2026-10-23",
      readingMinutes: 3,
    },
    {
      slug: "how-to-request-license-verification",
      title: "How to Request License Verification From Your Home State",
      description:
        "Nearly every interstate license transfer starts with a verification request. A step-by-step walkthrough of how to request one without delays.",
      category: "How-To",
      publishedAt: "2026-05-18",
      updatedAt: "2026-10-22",
      readingMinutes: 2,
    },
    {
      slug: NURSE_TRANSFER_GUIDE_SLUG,
      title: "How to Transfer a Nursing License to Another State",
      description:
        "Compact or endorsement? How RN license transfers actually work between US states — the NLC 60-day rule, Nursys verification, and where state rules genuinely differ.",
      category: "How-To",
      publishedAt: "2026-10-01",
      updatedAt: "2026-10-30",
      readingMinutes: 4,
      searchKeywords: ["nurse", "registered nurse", "RN", "Nurse Licensure Compact", "NLC", "Nursys", "endorsement"],
    },
    {
      slug: "california-plumbing-license-c36",
      title: "California Plumbing License (C-36): Experience, Exams, Fees and Reciprocity",
      description:
        "What CSLB's own pages say about the C-36 Plumbing Contractor license: the four-years-in-ten experience rule, exams, sole owner fees, and which states' licenses CSLB accepts by reciprocity.",
      category: "State Guide",
      publishedAt: "2026-10-30",
      updatedAt: "2026-10-30",
      readingMinutes: 5,
      searchKeywords: ["plumber", "plumbing", "California", "CSLB", "C-36", "contractor license", "reciprocity"],
      linkedFrom: ["/profession/plumber", "/plumber/california"],
    },
    {
      slug: "texas-plumbing-license-tsbpe",
      title: "Texas Plumbing Licenses (TSBPE): License Types and Applying From Another State",
      description:
        "Texas plumbing license types and their requirements, section by section from the TSBPE rules, plus the Out-of-State Examination and the Louisiana agreement.",
      category: "State Guide",
      publishedAt: "2026-10-30",
      updatedAt: "2026-10-30",
      readingMinutes: 5,
      searchKeywords: ["plumber", "plumbing", "Texas", "TSBPE", "journeyman", "master plumber", "out-of-state"],
      linkedFrom: ["/profession/plumber", "/plumber/texas"],
    },
    {
      slug: "journeyman-electrician-license-reciprocity",
      title: "Journeyman Electrician License Reciprocity: What Texas, Minnesota and Iowa Require",
      description:
        "What the Texas, Minnesota and Iowa reciprocity pages each say for journeyman electricians: the states listed, holding periods, exam conditions and fees.",
      category: "Fundamentals",
      publishedAt: "2026-10-30",
      updatedAt: "2026-10-30",
      readingMinutes: 5,
      searchKeywords: ["electrician", "journeyman", "journeyworker", "reciprocity", "TDLR", "Minnesota", "Iowa"],
      linkedFrom: ["/profession/electrician", "/electrician/texas", "/electrician/minnesota", "/electrician/iowa"],
    },
    {
      slug: "hvac-license-reciprocity-by-state",
      title: "HVAC License Reciprocity: What Four State Documents Say",
      description:
        "What official documents from Texas, California, Florida and Ohio say about reciprocity for HVAC and air-conditioning licenses: the states each one names and what applicants must submit.",
      category: "Fundamentals",
      publishedAt: "2026-10-30",
      updatedAt: "2026-10-30",
      readingMinutes: 5,
      searchKeywords: ["HVAC", "air conditioning", "ACR", "C-20", "reciprocity", "CILB", "endorsement"],
      linkedFrom: [
        "/profession/hvac-technician",
        "/hvac-technician/california",
        "/hvac-technician/florida",
        "/hvac-technician/ohio",
        "/hvac-technician/texas",
      ],
    },
  ];
}

export const NURSE_TRANSFER_GUIDE_SLUG = "how-to-transfer-a-nursing-license-to-another-state";

export function getGuideBySlug(slug: string): GuideSummary | undefined {
  return getAllGuides().find((g) => g.slug === slug);
}

/** Guides that list `pagePath` (e.g. "/plumber/texas") in their linkedFrom. */
export function getGuidesLinkedFrom(pagePath: string): GuideSummary[] {
  return getAllGuides().filter((g) => g.linkedFrom?.includes(pagePath));
}
