import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { GoogleAnalytics } from "@/components/seo/GoogleAnalytics";
import { GoogleTagManagerHead, GoogleTagManagerBody } from "@/components/seo/GoogleTagManager";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import { SITE_URL } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Professional License Transfer Reference`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "license reciprocity",
    "professional license transfer",
    "contractor license by state",
    "nurse licensure compact",
    "electrician license reciprocity",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { email: false, address: false, telephone: false },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — Professional License Transfer Reference`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    types: {
      "application/rss+xml": `${SITE_URL}/feed.xml`,
    },
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Professional License Transfer Reference`,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Root layout for every real content page (everything except /embed/*).
 *
 * This is a genuine Next.js "root layout" — (site) is a route group, so
 * this file defines <html>/<body> for this whole segment tree, exactly
 * like app/layout.tsx used to for the entire app. Splitting it out this
 * way (rather than the previous single shared layout with a runtime
 * headers()-based branch) restores every one of these pages to its
 * original static/SSG rendering — headers() is a dynamic API, and using
 * it anywhere in a shared root layout previously forced the ENTIRE site
 * to render dynamically per-request, a real regression caught in this
 * session's build output and fixed here.
 */
export default function SiteRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <GoogleTagManagerHead />
        <GoogleTagManagerBody />
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
