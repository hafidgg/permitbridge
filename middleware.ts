import { NextResponse, type NextRequest } from "next/server";
import { lacksStatewideTradeLicense } from "@/lib/knowledge-base/trade-transfer-gate";

/**
 * 410 Gone for /transfer pages removed for good, so search engines drop them
 * instead of retrying a 404. Currently: every New York trade pair (removed
 * 2026-10-09). New York has no statewide electrician, plumber, HVAC or
 * contractor license, and those pages carried generator figures. Driven by
 * NO_STATEWIDE_TRADE_LICENSE (the gate file has only type imports, so it's
 * safe on the edge runtime).
 */
function isGone(pathname: string): boolean {
  const [, first, profession, from, to, extra] = pathname.replace(/\/$/, "").split("/");
  if (first !== "transfer" || !profession || !from || !to || extra !== undefined) return false;
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
  matcher: "/transfer/:path*",
};
