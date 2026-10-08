/**
 * scripts/check-sitemap.ts
 *
 * Fails (exit 1) when a sitemap is below the floor in scripts/sitemap-floor.ts.
 *
 *   --source        call app/sitemap.ts's sitemap() directly (needs --conditions=react-server)
 *   --build         read the prerendered output of `next build`
 *   --live [url]    fetch the deployed sitemap (default https://www.getpermitbridge.com/sitemap.xml)
 */
import fs from "node:fs";
import path from "node:path";
import { checkSitemapFloor, countByGroup, extractLocs } from "./sitemap-floor";

const BUILD_OUTPUT = path.join(process.cwd(), ".next", "server", "app", "sitemap.xml.body");
const DEFAULT_LIVE_URL = "https://www.getpermitbridge.com/sitemap.xml";

async function loadUrls(mode: string, arg: string | undefined): Promise<{ label: string; urls: string[] }> {
  if (mode === "--source") {
    const { default: sitemap } = await import("../app/sitemap");
    return { label: "sitemap() source", urls: sitemap().map((entry) => entry.url) };
  }
  if (mode === "--build") {
    if (!fs.existsSync(BUILD_OUTPUT)) {
      throw new Error(`${BUILD_OUTPUT} not found: the sitemap was not prerendered at build time (is app/sitemap.ts still force-static?)`);
    }
    return { label: "build output", urls: extractLocs(fs.readFileSync(BUILD_OUTPUT, "utf-8")) };
  }
  if (mode === "--live") {
    const url = arg ?? DEFAULT_LIVE_URL;
    const res = await fetch(url, { headers: { "User-Agent": "PermitBridgeSitemapCheck/1.0" } });
    if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
    const headers = ["x-vercel-cache", "age", "x-vercel-id"].map((h) => `${h}=${res.headers.get(h) ?? "-"}`).join(" ");
    return { label: `${url} (${headers})`, urls: extractLocs(await res.text()) };
  }
  throw new Error(`unknown mode ${mode || "(none)"}; use --source, --build or --live [url]`);
}

(async () => {
  const [mode = "", arg] = process.argv.slice(2);
  const { label, urls } = await loadUrls(mode, arg);
  const counts = countByGroup(urls);
  console.log(`Sitemap check — ${label}`);
  console.log(`  ${urls.length} URLs: ${Object.entries(counts).map(([g, n]) => `${g}=${n}`).join(", ")}`);
  const problems = checkSitemapFloor(urls);
  if (problems.length > 0) {
    console.error("✖ Sitemap below floor:");
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log("✔ Sitemap floor OK.");
})().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
