import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "Disclaimer",
  description: `Important information about the limitations of licensing data on ${SITE_NAME}.`,
  path: "/disclaimer",
});

const LAST_UPDATED = "2026-06-01";

export default function DisclaimerPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Disclaimer", url: "/disclaimer" }]} />
      <article className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Disclaimer</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {formatDate(LAST_UPDATED)}</p>

        <div className="prose-permitbridge mt-8">
          <h2>Not Official Government Information</h2>
          <p>
            {SITE_NAME} is an independent, privately operated reference site. We are not a government agency, a
            state licensing board, or affiliated with any licensing authority mentioned on the Site.
          </p>

          <h2>Not Legal or Professional Advice</h2>
          <p>
            Nothing on this Site constitutes legal, regulatory, or professional licensing advice. Portability
            scores, difficulty ratings, and time/fee estimates are informational approximations based on our
            research and are not guarantees of any outcome, cost, or timeline.
          </p>

          <h2>Always Verify Directly</h2>
          <p>
            Licensing requirements change, sometimes with little public notice. Before making any decision — applying
            for a license, paying a fee, scheduling an exam, or relocating for work — verify current requirements
            directly with the official licensing board of the state in question.
          </p>

          <h2>No Guarantee of Accuracy</h2>
          <p>
            While we make a good-faith effort to keep every page accurate and current, and display a "last updated"
            date on each page, we make no warranty, express or implied, regarding the completeness or accuracy of
            any information on the Site.
          </p>

          <h2>Affiliate and Advertising Relationships</h2>
          <p>
            Some pages contain affiliate links or advertising. See our <Link href="/privacy">Privacy Policy</Link> for
            details. These relationships do not influence our licensing data or portability scoring methodology.
          </p>
        </div>
      </article>
    </div>
  );
}
