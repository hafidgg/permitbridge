import { Inter } from "next/font/google";
import "../globals.css";
import { GoogleAnalytics } from "@/components/seo/GoogleAnalytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Root layout for /embed/* only — a genuine, separate Next.js "root
 * layout" (this segment is a sibling of the (site) route group, not
 * nested under it), so it does NOT render Header/Footer/JsonLd: those
 * belong to the full site chrome, not to a small widget meant to be
 * embedded in an iframe on someone else's page.
 *
 * No dynamic APIs used here (no headers()/cookies()) — this segment
 * stays staticaly/SSR-as-needed on its own, and critically, does not
 * affect the rendering mode of any (site) page, since Next.js scopes
 * rendering-mode inference per root layout, not globally.
 */
export default function EmbedRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
