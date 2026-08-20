import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = buildMetadata({
  title: "About Us",
  description: `Learn why ${SITE_NAME} exists, how we research licensing rules, and how we keep the site free.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "About", url: "/about" }]} />
      <article className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">About {SITE_NAME}</h1>

        <div className="prose-permitbridge mt-8">
          <p>
            {SITE_NAME} exists because moving a professional or trade license between US states should not require
            reading fifty different government websites written in fifty different styles of bureaucratic language.
          </p>
          <h2>Why We Built This</h2>
          <p>
            Every existing guide we found online covered a single profession, written once, and rarely updated. Since
            2024, license-recognition laws have changed faster than at any point in decades, which means static
            guides go stale within months. We built {SITE_NAME} to be a living reference instead of a one-time blog
            post.
          </p>
          <h2>How We Research Each Page</h2>
          <p>
            Every profession and state page is built from official licensing board sources and cross-checked against
            each state's statutory language on reciprocity, endorsement, and Universal License Recognition. Each page
            displays a "last updated" date so you always know how current the information is.
          </p>
          <h2>How We Stay Free</h2>
          <p>
            {SITE_NAME} is supported by relevant advertising and by referral partnerships with continuing-education
            and exam-preparation providers. Editorial content and portability scoring are never influenced by these
            partnerships.
          </p>
          <h2>What We Are Not</h2>
          <p>
            {SITE_NAME} is not a law firm, a government agency, or a substitute for confirming requirements directly
            with the official licensing board before you apply, pay a fee, or make a moving decision.
          </p>
        </div>
      </article>
    </div>
  );
}
