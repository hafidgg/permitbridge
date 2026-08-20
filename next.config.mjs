/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Pins the project root explicitly. Without this, Turbopack sometimes
  // infers the wrong workspace root when it finds another lockfile/
  // package.json anywhere above this folder on disk (common on Windows —
  // e.g. a OneDrive-synced parent folder, or a leftover package.json from
  // an earlier `create-next-app` attempt). A wrong root shows up as build
  // errors where every file path is prefixed with this project's own
  // folder name (e.g. "./permitbridge/app/..." instead of "./app/...")
  // and modules that ARE installed still report "Cannot find module".
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // System 4 — the embeddable widget deliberately needs to be
        // frameable by third-party sites, unlike every other route.
        // Modern browsers prioritize a Content-Security-Policy
        // frame-ancestors directive over the legacy X-Frame-Options
        // header when both are present (the general rule above still
        // sends X-Frame-Options: DENY for this path too, since Next.js
        // merges — rather than overrides — headers from multiple
        // matching rules; this CSP directive is what actually makes
        // embedding work in any current browser). Scoped to exactly
        // /embed/* — every other route keeps the strict DENY with no
        // exception.
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *;" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/professions/:slug", destination: "/profession/:slug", permanent: true },
      { source: "/states/:slug", destination: "/state/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
