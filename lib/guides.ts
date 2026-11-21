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
      updatedAt: "2026-11-20",
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
    {
      slug: "ohio-ocilb-reciprocity-agreements",
      title: "Ohio OCILB Reciprocity Agreements: What Each State's Form Says",
      description:
        "What OCILB's reciprocity applications for nine states say: who can apply, which trades each form lists, the $500,000 insurance rule and the $25 per-trade fee.",
      category: "State Guide",
      publishedAt: "2026-11-20",
      updatedAt: "2026-11-20",
      readingMinutes: 5,
      searchKeywords: ["Ohio", "OCILB", "reciprocity", "electrical", "HVAC", "plumbing", "hydronics", "refrigeration"],
      linkedFrom: ["/profession/hvac-technician", "/profession/plumber", "/profession/electrician", "/hvac-technician/ohio", "/plumber/ohio"],
    },
    {
      slug: "texas-rn-license-by-endorsement",
      title: "Texas RN License by Endorsement: What the Board of Nursing Requires",
      description:
        "Texas BON endorsement for U.S.-educated RNs: eligibility under Rule 217.5, the Nursys verification rule, the jurisprudence exam, fees and the 120-day temporary license.",
      category: "State Guide",
      publishedAt: "2026-11-20",
      updatedAt: "2026-11-20",
      readingMinutes: 4,
      searchKeywords: ["nurse", "registered nurse", "RN", "Texas", "BON", "endorsement", "NJE", "Nursys"],
      linkedFrom: ["/profession/nurse"],
    },
    {
      slug: "florida-rn-endorsement-vs-multistate-upgrade",
      title: "Florida RN License: MOBILE Endorsement vs. Multi-state Upgrade",
      description:
        "Florida Board of Nursing's two applications compared: MOBILE Endorsement for nurses licensed elsewhere and the Multi-state Upgrade for current Florida licensees.",
      category: "State Guide",
      publishedAt: "2026-11-20",
      updatedAt: "2026-11-20",
      readingMinutes: 4,
      searchKeywords: ["nurse", "registered nurse", "RN", "Florida", "endorsement", "MOBILE", "multistate", "compact"],
      linkedFrom: ["/profession/nurse", "/registered-nurse/california-to-florida"],
    },
    {
      slug: "iowa-electrical-license-out-of-state",
      title: "Iowa Electrical License for Out-of-State Electricians: Agreements, Rules and Fees",
      description:
        "Iowa Electrical Examining Board: the 13 reciprocal agreements, rule 481—401 conditions including 16,000 hours or apprenticeship, the testing route, fees and continuing education.",
      category: "State Guide",
      publishedAt: "2026-11-20",
      updatedAt: "2026-11-20",
      readingMinutes: 5,
      searchKeywords: ["electrician", "Iowa", "DIAL", "journeyman", "master", "reciprocity", "Electrical Examining Board"],
      linkedFrom: ["/profession/electrician", "/electrician/iowa"],
    },
    {
      slug: "illinois-rn-license-by-endorsement",
      title: "Illinois RN License by Endorsement: What IDFPR's Application Requires",
      description:
        "IDFPR endorsement for RNs licensed elsewhere: the $50 fee, the six-month temporary permit, Nursys verification, the 60-day fingerprint window and the three-year application limit.",
      category: "State Guide",
      publishedAt: "2026-11-20",
      updatedAt: "2026-11-20",
      readingMinutes: 4,
      searchKeywords: ["nurse", "registered nurse", "RN", "Illinois", "IDFPR", "endorsement", "temporary permit", "Nursys"],
      linkedFrom: ["/profession/nurse", "/registered-nurse/georgia-to-illinois"],
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
