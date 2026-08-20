import Script from "next/script";

/**
 * Google Tag Manager, implemented via next/script rather than pasting
 * GTM's raw <script> snippet into a plain <head> tag — the raw snippet
 * is a synchronous, render-blocking script; next/script's
 * strategy="afterInteractive" (Next.js's own documented recommendation
 * for GTM specifically) loads it after the page becomes interactive
 * instead, so it never delays first paint.
 *
 * Reads the container ID from an env var rather than hardcoding it —
 * same reasoning as components/seo/GoogleAnalytics.tsx: local dev / PR
 * preview builds don't silently register real events in GTM unless
 * NEXT_PUBLIC_GTM_ID is explicitly set for that environment.
 *
 * Two separate pieces, per Google's own two-part installation
 * instructions:
 *   - GoogleTagManagerHead(): the <script> that must load as early as
 *     possible — rendered in the root layout's <head>.
 *   - GoogleTagManagerBody(): the <noscript><iframe> fallback that must
 *     be the first thing after the opening <body> tag, for users with
 *     JavaScript disabled.
 */
export function GoogleTagManagerHead() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtmId}');
      `}
    </Script>
  );
}

export function GoogleTagManagerBody() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
