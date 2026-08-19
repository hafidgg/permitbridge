"use client";

import Script from "next/script";

/**
 * Loaded via next/script with strategy="afterInteractive" — Next.js's
 * recommended strategy for analytics: the script loads after the page
 * becomes interactive, so it never blocks or delays the initial render
 * (unlike a plain <script> tag pasted into <head>, which is what
 * Google's own raw snippet would do if used as-is).
 *
 * Reads the Measurement ID from an env var rather than hardcoding it, so:
 *   - local dev / PR preview builds don't silently send real traffic data
 *     unless NEXT_PUBLIC_GA_MEASUREMENT_ID is explicitly set for that
 *     environment,
 *   - rotating/changing the ID later never requires a code change.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
