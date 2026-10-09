import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { formatDate, PROCESSING_TIME_NOT_PUBLISHED } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "Methodology: How We Verify Licensing Rules",
  description: `How ${SITE_NAME} researches and verifies license-transfer rules: official licensing board sources, a source link on every page, last-checked dates, and what we show when a board does not publish something.`,
  path: "/methodology",
});

const LAST_UPDATED = "2026-10-08";

export default function MethodologyPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Methodology", url: "/methodology" }]} />
      <article className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Methodology: How We Verify Licensing Rules</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {formatDate(LAST_UPDATED)}</p>

        <div className="prose-permitbridge mt-8">
          <p>
            Every licensing rule on {SITE_NAME} is meant to be traceable to the official body that sets it. This page
            explains where our information comes from, how it is checked, and what we do when an official source is
            silent.
          </p>

          <h2>1. Primary sources: the licensing board itself</h2>
          <p>
            Our primary source for each rule is the official licensing board or state agency responsible for that
            license: its website, application instructions, published forms, and the statutes or administrative rules
            it cites. When a board states a rule plainly on its own official page, we treat that as authoritative.
            Third-party summaries, forums, and other reference sites are not used as the basis for a published rule.
          </p>

          <h2>2. Checked by hand</h2>
          <p>
            Each rule is read and checked by a person against the board&apos;s own wording. It is not generated
            from unchecked automated scraping. Where a requirement is ambiguous, we record the ambiguity rather than
            guess.
          </p>

          <h2>3. A source link and a last-checked date on each page</h2>
          <p>
            Transfer and state pages link to the official board source each requirement was taken from, and show
            the date it was last checked. If you want to confirm a detail, follow that link: the board&apos;s current
            page always wins over ours.
          </p>

          <h2>4. When a board does not publish something</h2>
          <p>
            Boards often leave things out, especially processing times. We do not fill those gaps with estimates
            presented as fact. When a board does not publish a figure, the page says so, for example: &quot;
            {PROCESSING_TIME_NOT_PUBLISHED}.&quot;
          </p>
          <p>
            When a question can only be answered by the board itself (for example, how it would treat a specific
            out-of-state license), we mark the page as researched but pending an official answer from the board,
            instead of publishing a guess. Pages that have not yet been researched are labeled as such.
          </p>

          <h2>5. What gets published and indexed</h2>
          <p>
            A transfer page is only published once its key requirements are tied to a registered official
            source. Pages that are still incomplete or awaiting verification are not published.
          </p>

          <h2>6. No scores or ratings of our own</h2>
          <p>
            {SITE_NAME} doesn&apos;t publish its own scores or difficulty ratings. The figures on a published page
            come from the official source that page cites.
          </p>

          <h2>7. Corrections</h2>
          <p>
            Rules change, sometimes without much notice. If you spot something outdated or wrong, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Correction`}>{CONTACT_EMAIL}</a> with the page and what
            changed, and include the official source if you have it. We re-check the rule against the board and
            update the page and its last-checked date.
          </p>

          <p>
            {SITE_NAME} is an independent reference, not legal advice. See our <Link href="/disclaimer">Disclaimer</Link>{" "}
            and <Link href="/about">About</Link> pages.
          </p>
        </div>
      </article>
    </div>
  );
}
