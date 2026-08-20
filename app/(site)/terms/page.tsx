import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: `The terms that govern your use of ${SITE_NAME}.`,
  path: "/terms",
});

const LAST_UPDATED = "2026-06-01";

export default function TermsPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Terms of Service", url: "/terms" }]} />
      <article className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {formatDate(LAST_UPDATED)}</p>

        <div className="prose-permitbridge mt-8">
          <p>By accessing or using {SITE_NAME} ("the Site"), you agree to these Terms of Service.</p>

          <h2>Use of the Site</h2>
          <p>
            The Site is provided for informational purposes. You may browse, search, and reference content freely.
            You may not scrape, republish, or redistribute substantial portions of our content without written
            permission.
          </p>

          <h2>No Professional or Legal Advice</h2>
          <p>
            Content on the Site is general information about licensing pathways and does not constitute legal,
            professional, or regulatory advice. See our <Link href="/disclaimer">Disclaimer</Link> for details.
          </p>

          <h2>Accuracy of Information</h2>
          <p>
            We work to keep licensing information accurate and current, but licensing rules change and errors are
            possible. Always confirm requirements with the official licensing authority before relying on them.
          </p>

          <h2>Third-Party Links</h2>
          <p>
            The Site links to third-party websites, including government licensing boards and affiliate partners. We
            are not responsible for the content or practices of those sites.
          </p>

          <h2>Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, {SITE_NAME} is not liable for any loss or damage arising from
            reliance on information found on the Site.
          </p>

          <h2>Changes to These Terms</h2>
          <p>We may update these Terms from time to time. Continued use of the Site after changes constitutes acceptance of the updated Terms.</p>

          <h2>Contact</h2>
          <p>Questions about these Terms can be sent to legal@permitbridge.com.</p>
        </div>
      </article>
    </div>
  );
}
