import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, OPERATOR_NAME, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = buildMetadata({
  title: "About Us",
  description: `Learn why ${SITE_NAME} exists, how we research licensing rules, and who runs the site.`,
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
            {SITE_NAME} is an independent guide to transferring professional licenses between U.S. states (nursing,
            electrician, HVAC, plumbing and contractor licenses).
          </p>
          <p>
            It is written and maintained by {OPERATOR_NAME}, an independent researcher. {SITE_NAME} is not a law firm, a
            licensing board, or a government agency.
          </p>
          <h2>How I Work</h2>
          <ul>
            <li>
              I read the official sources published by each state board, link to them on every page, and quote the exact
              wording where it matters, so you can check each requirement yourself.
            </li>
            <li>
              Every fee, exam, experience or processing-time requirement comes from an official source linked on the page:
              a state licensing board or agency, its forms and rules, or for nursing the Nurse Licensure Compact and Nursys.
            </li>
            <li>
              If I can&apos;t confirm a detail in an official source, I leave it off the page. When a board does not publish
              something, such as a processing time, the page says so.
            </li>
            <li>
              Pages show the date their information was last researched or updated. The full process is on the{" "}
              <Link href="/methodology">Methodology</Link> page.
            </li>
          </ul>
          <h2>What This Site Is Not</h2>
          <p>
            {SITE_NAME} does not issue licenses, process applications, or give legal advice. Rules change, so always confirm
            with the licensing board before you apply. No licensing board has reviewed or endorsed these pages.
          </p>
          <p>
            The site may display advertising in the future. Advertising never influences the licensing information on any
            page.
          </p>
          <h2>Corrections</h2>
          <p>
            If you find an error or an outdated requirement, write to me at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> (also listed on the{" "}
            <Link href="/contact">Contact</Link> page) and I will check it against the official source.
          </p>
        </div>
      </article>
    </div>
  );
}
