import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { PopularProfessions } from "@/components/home/PopularProfessions";
import { PopularTransfers } from "@/components/home/PopularTransfers";
import { LatestUpdates } from "@/components/home/LatestUpdates";
import { FAQSection } from "@/components/home/FAQ";
import { buildSearchIndex } from "@/lib/search";
import { getPublishableTransferRules } from "@/lib/publishable-transfers";
import {
  getProfessionSummaries,
  getAllProfessions,
  getAllStates,
  getAllBlogPosts,
} from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} — Know Exactly What It Takes to Move Your License`,
  description:
    "Free, independent reference for transferring professional and trade licenses between US states. Reciprocity, endorsement, exams, fees, and timelines for electricians, nurses, plumbers, HVAC techs, and contractors.",
  path: "/",
});

const HOMEPAGE_FAQS = [
  {
    question: "Is PermitBridge affiliated with any state licensing board?",
    answer:
      "No. PermitBridge is an independent reference site. We link to and encourage you to confirm every requirement with the official state licensing board before applying or making decisions.",
  },
  {
    question: "How often is the data updated?",
    answer:
      "Every profession and state page shows a “last updated” date. Each fact is checked against the official source it cites, and pages without a registered official source are not published.",
  },
  {
    question: "Which professions does PermitBridge cover?",
    answer:
      "We currently cover electricians, registered nurses, plumbers, HVAC technicians, and general contractors across five states, and we are expanding coverage every month.",
  },
];

export default function HomePage() {
  const professions = getProfessionSummaries();
  const allProfessions = getAllProfessions();
  const allStates = getAllStates();
  const topTransfers = [...getPublishableTransferRules()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const posts = getAllBlogPosts().slice(0, 2);
  const searchIndex = buildSearchIndex();

  const enrichedTransfers = topTransfers
    .map((rule) => {
      const profession = allProfessions.find((p) => p.slug === rule.profession);
      const from = allStates.find((s) => s.slug === rule.fromState);
      const to = allStates.find((s) => s.slug === rule.toState);
      if (!profession || !from || !to) return null;
      return { rule, profession, from, to };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      <Hero searchIndex={searchIndex} />
      <PopularProfessions professions={professions} />
      <PopularTransfers transfers={enrichedTransfers} />
      <LatestUpdates posts={posts} />
      <FAQSection faqs={HOMEPAGE_FAQS} title="Frequently Asked Questions" />
    </>
  );
}
