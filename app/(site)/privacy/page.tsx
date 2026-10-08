import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { formatDate, SITE_URL } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and protects information from visitors, including cookies, analytics, and advertising.`,
  path: "/privacy",
});

const LAST_UPDATED = "2026-10-08";

export default function PrivacyPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Privacy Policy", url: "/privacy" }]} />
      <article className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {formatDate(LAST_UPDATED)}</p>

        <div className="prose-permitbridge mt-8">
          <p>
            This Privacy Policy explains how {SITE_NAME} (&quot;we,&quot; &quot;us&quot;) handles information when you
            visit {SITE_URL.replace(/^https?:\/\//, "")} (the &quot;Site&quot;). {SITE_NAME} does not offer accounts or
            ask you to sign up, and we collect only the information needed to operate and improve the Site.
          </p>

          <h2>Information We Collect</h2>
          <p>
            <strong>Automatically collected data.</strong> Like most websites, the Site and the services it uses
            receive standard technical information when you visit: pages viewed, approximate location derived from
            your IP address, device and browser type, referring site, and the date and time of your visit.
          </p>
          <p>
            <strong>Information you send us.</strong> If you email us, we receive your email address and whatever
            you include in your message. We use it only to reply to you.
          </p>

          <h2>Cookies</h2>
          <p>
            Cookies are small text files stored by your browser. The Site and the third-party services described
            below may use cookies and similar technologies (such as local storage and pixel tags) to measure traffic
            and, where advertising is shown, to serve and measure ads. You can block or delete cookies in your browser
            settings at any time; some features may then work differently.
          </p>

          <h2>Analytics: Google Analytics and Google Tag Manager</h2>
          <p>
            We use Google Analytics, loaded through Google Tag Manager, to understand how visitors use the Site (for
            example, which pages are read and how people arrive). Google Analytics uses cookies and collects the
            automatically collected data described above. Google Tag Manager is the tool that loads these scripts;
            it does not itself build a profile of you. You can learn how Google uses this data at{" "}
            <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">
              How Google uses information from sites that use its services
            </a>
            , and you can opt out of Google Analytics with the{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer" target="_blank">
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>

          <h2>Advertising and the DoubleClick Cookie</h2>
          <p>
            We may display advertising on the Site through Google AdSense. In that case, Google, as a third-party
            vendor, uses cookies to serve ads on the Site. Google&apos;s use of advertising cookies, including the
            DoubleClick cookie, enables it and its partners to serve ads to you based on your visits to this Site
            and/or other sites on the Internet. Other third-party vendors and ad networks may also use cookies to
            serve ads.
          </p>
          <p>
            <strong>Personalized ads.</strong> Ads may be personalized based on your browsing activity, or
            non-personalized, depending on your settings and on the laws that apply where you live.
          </p>

          <h2>Your Right to Opt Out</h2>
          <ul>
            <li>
              You can opt out of personalized advertising from Google by visiting{" "}
              <a href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">
                Google Ads Settings
              </a>
              .
            </li>
            <li>
              You can opt out of some third-party vendors&apos; use of cookies for personalized advertising by
              visiting{" "}
              <a href="https://www.aboutads.info/choices" rel="noopener noreferrer" target="_blank">
                www.aboutads.info
              </a>
              .
            </li>
            <li>
              You can opt out of Google Analytics with the{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer" target="_blank">
                Google Analytics Opt-out Browser Add-on
              </a>
              .
            </li>
            <li>You can block or delete cookies at any time in your browser settings.</li>
          </ul>

          <h2>How We Use Information</h2>
          <p>
            To operate, maintain, and improve the Site; to understand which pages are useful; and to reply to
            messages you send us.
          </p>

          <h2>Data Sharing</h2>
          <p>
            We do not sell your personal information. Information is shared only with the service providers that
            run the Site (our hosting provider, and Google for analytics and, where shown, advertising), as described
            in this policy.
          </p>

          <h2>Children</h2>
          <p>
            The Site is intended for working professionals and is not directed at children under 13. We do not
            knowingly collect personal information from children.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            If we change this policy, we will post the updated version here and change the &quot;Last updated&quot;
            date above.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy, or requests about information you have sent us, can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </article>
    </div>
  );
}
