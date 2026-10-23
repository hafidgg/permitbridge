/**
 * Google Consent Mode v2 defaults: analytics and ad storage denied for
 * visitors in the EEA, the UK and Switzerland. There is no consent banner
 * yet, so nothing ever grants them and Google tags there run without
 * cookies. Elsewhere no default is set, so tags behave as before.
 *
 * A plain inline <script> in <head>, not next/script: it runs while the
 * HTML is parsed, so it is always on the dataLayer before the
 * afterInteractive GTM/gtag scripts (GoogleTagManager.tsx,
 * GoogleAnalytics.tsx) load. Rendered only when one of them is configured.
 */
const CONSENT_REGIONS = [
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // Rest of the EEA, then the UK and Switzerland
  "IS", "LI", "NO", "GB", "CH",
];

export function ConsentModeDefault() {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && !process.env.NEXT_PUBLIC_GTM_ID) return null;

  const script = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',${JSON.stringify({
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    region: CONSENT_REGIONS,
  })});`;

  return <script id="consent-mode-default" dangerouslySetInnerHTML={{ __html: script }} />;
}
