import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";
import { formatDate, SITE_URL } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and protects information from visitors.`,
  path: "/privacy",
});

const LAST_UPDATED = "2026-06-01";

export default function PrivacyPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Privacy Policy", url: "/privacy" }]} />
      <article className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {formatDate(LAST_UPDATED)}</p>

        <div className="prose-permitbridge mt-8">
          <p>
            This Privacy Policy explains how {SITE_NAME} ("we," "us") handles information when you visit{" "}
            {SITE_URL.replace(/^https?:\/\//, "")} (the "Site"). {SITE_NAME} does not require account creation, and we collect the minimum
            information necessary to operate and improve the Site.
          </p>

          <h2>Information We Collect</h2>
          <p>
            We collect standard web analytics data (pages visited, approximate location derived from IP address,
            device and browser type, and referring site) and information you voluntarily provide when you contact us
            by email.
          </p>

          <h2>Cookies and Advertising</h2>
          <p>
            We and our advertising partners (such as Google AdSense) may use cookies or similar technologies to serve
            relevant ads and measure performance. You can control cookie behavior through your browser settings, and
            opt out of personalized advertising through your browser or ad-network preferences.
          </p>

          <h2>Affiliate Links</h2>
          <p>
            Some links on {SITE_NAME} are affiliate links to continuing-education or exam-preparation providers. If
            you make a purchase through one of these links, we may earn a commission at no additional cost to you.
            This never influences our editorial content or portability scoring.
          </p>

          <h2>How We Use Information</h2>
          <p>To operate, maintain, and improve the Site; to understand which pages are useful; and to respond to inquiries you send us directly.</p>

          <h2>Data Sharing</h2>
          <p>
            We do not sell personal information. We may share aggregated, non-identifying analytics with service
            providers who help us operate the Site (such as our hosting and analytics providers).
          </p>

          <h2>Your Choices</h2>
          <p>You can disable cookies in your browser at any time. Doing so may affect some Site functionality.</p>

          <h2>Contact</h2>
          <p>Questions about this policy can be sent to privacy@permitbridge.com.</p>
        </div>
      </article>
    </div>
  );
}
