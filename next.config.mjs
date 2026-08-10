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
