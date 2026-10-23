import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

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
            {SITE_NAME} exists because moving a professional or trade license between US states should not require
            reading fifty different government websites written in fifty different styles of bureaucratic language.
          </p>
          <h2>Who Runs {SITE_NAME}</h2>
          <p>
            {SITE_NAME} is an independent project run by GOUGUA. It is not owned by, funded by, or affiliated with
            any licensing board, government agency, or professional association, and no board has reviewed or
            endorsed its pages. You can reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>Our Mission</h2>
          <p>
            To give nurses, electricians, plumbers, HVAC technicians, and other licensed professionals a clear,
            accurate answer to one question: what will it take to keep working if I move to another state? Licensing
            rules change, so {SITE_NAME} is maintained as a living reference. Transfer pages, registered nurse pages,
            electrician state pages and trade summary pages show the date their requirements were last researched.
          </p>

          <h2>How Pages Are Built</h2>
          <p>
            Each page is built from the licensing board or state agency responsible for that license: its website,
            application instructions, published forms, and the statutes or rules it cites. A requirement is published
            only when it is tied to a registered official source, and the page links to that source. When a board
            does not publish something, such as a processing time, the page says so instead of estimating.
          </p>

          <h2>Secondary Sources</h2>
          <p>
            A non-official source appears only where it is labeled &quot;Secondary Source&quot;, and it never supports a
            fee, an exam requirement, required years of experience or a processing time. If only a secondary source
            states one of those, the page says the board does not publish it. Read the full{" "}
            <Link href="/methodology">methodology</Link> for details.
          </p>

          <h2>Reporting an Error</h2>
          <p>
            If you spot something outdated or wrong, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with
            the page and what changed, and include the official source if you have it. We re-check the rule against
            the board and update the page.
          </p>

          <h2>How We Stay Free</h2>
          <p>
            {SITE_NAME} is free to use. We may show advertising to cover running costs. Advertising never influences
            our licensing information.
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
