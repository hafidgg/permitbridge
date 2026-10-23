import { NextResponse, type NextRequest } from "next/server";
import { lacksStatewideTradeLicense } from "@/lib/knowledge-base/trade-transfer-gate";
import goneTransferPaths from "@/lib/generated/gone-transfer-paths.json";

/**
 * 410 Gone for /transfer pages removed for good, so search engines drop them
 * instead of retrying a 404. Currently: every New York trade pair (removed
 * 2026-10-09). New York has no statewide electrician, plumber, HVAC or
 * contractor license, and those pages carried generator figures. Driven by
 * NO_STATEWIDE_TRADE_LICENSE (the gate file has only type imports, so it's
 * safe on the edge runtime).
 *
 * Plus individually removed pairs: the legacy unsourced nurse pages into New
 * York (generator $400 fee and "no exam"; removed 2026-10-09). california->
 * new-york isn't listed: next.config.mjs redirects it to the sourced RN page,
 * and config redirects run before middleware.
 */
const REMOVED_PAIRS = new Set(["nurse/florida/new-york", "nurse/ohio/new-york", "nurse/texas/new-york"]);

// Every /transfer pair that fails isTradeTransferPublishable(), regenerated
// on each build by scripts/generate-gone-paths.ts (prebuild). Redirects in
// next.config.mjs still win for the pairs they cover.
const GONE_TRANSFER_PATHS = new Set<string>(goneTransferPaths);

// Removed 2026-10-09: two articles with unsourced Universal License
// Recognition claims, and the Portability Score widget (the score was an
// unsourced estimate and is no longer published anywhere).
// Removed 2026-10-21: the blog. Its one post had no specific, sourced facts,
// so /blog itself is gone too.
const GONE_CONTENT_PATHS = new Set([
  "/guides/universal-license-recognition-explained",
  "/blog/2026-ulr-state-tracker-update",
  "/embed/portability-score",
  "/blog",
  "/blog/nurse-licensure-compact-2026-changes",
  // Withdrawn 2026-10-22 (WITHDRAWN_TRANSFER_SLUGS in lib/knowledge-base/transfer-rule-data.ts): its Georgia sources
  // can't be re-read, so nothing verifiable was left on the page.
  "/registered-nurse/illinois-to-georgia",
]);

function isGone(rawPathname: string): boolean {
  const pathname = rawPathname.replace(/\/$/, "");
  if (GONE_CONTENT_PATHS.has(pathname) || GONE_TRANSFER_PATHS.has(pathname)) return true;
  const [, first, profession, from, to, extra] = pathname.split("/");
  if (first !== "transfer" || !profession || !from || !to || extra !== undefined) return false;
  if (REMOVED_PAIRS.has(`${profession}/${from}/${to}`)) return true;
  return lacksStatewideTradeLicense(profession, from) || lacksStatewideTradeLicense(profession, to);
}

export function middleware(request: NextRequest) {
  if (isGone(request.nextUrl.pathname)) {
    return new NextResponse("410 Gone: this page has been permanently removed.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
    });
  }
  return NextResponse.next();
}

export const config = {
  // /registered-nurse: WITHDRAWN_TRANSFER_SLUGS. A gone path outside the matcher never reaches isGone() and 404s.
  matcher: ["/transfer/:path*", "/guides/:path*", "/blog/:path*", "/embed/:path*", "/registered-nurse/:path*"],
};
