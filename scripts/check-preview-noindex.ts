/**
 * Postbuild check: the "noindex, nofollow" X-Robots-Tag exists only in preview builds.
 *
 * - Default (production) build (PREVIEW_NOINDEX unset): fails if the built routes manifest or public/_headers
 *   carries any X-Robots-Tag with "nofollow". The 410 middleware's own "x-robots-tag: noindex" is set in code
 *   on 410 responses only and is not part of the routes manifest.
 * - Preview build (PREVIEW_NOINDEX=1): fails if the header is missing, so the preview can't be indexed.
 */
import fs from "node:fs";
import path from "node:path";

const preview = process.env.PREVIEW_NOINDEX === "1";
const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".next", "routes-manifest.json"), "utf-8")) as {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
};
const inManifest = (manifest.headers ?? []).some((rule) =>
  rule.headers.some((h) => h.key.toLowerCase() === "x-robots-tag" && /nofollow/i.test(h.value)),
);
const headersFile = path.join(process.cwd(), "public", "_headers");
const inHeadersFile = fs.existsSync(headersFile) && /x-robots-tag:.*nofollow/i.test(fs.readFileSync(headersFile, "utf-8"));

console.log(`Preview-noindex check (${preview ? "preview" : "production"} build)`);
if (!preview && (inManifest || inHeadersFile)) {
  console.error(`✖ Production build emits X-Robots-Tag nofollow (routes manifest: ${inManifest}, public/_headers: ${inHeadersFile}).`);
  process.exit(1);
}
if (preview && !(inManifest && inHeadersFile)) {
  console.error(`✖ Preview build is missing X-Robots-Tag noindex (routes manifest: ${inManifest}, public/_headers: ${inHeadersFile}).`);
  process.exit(1);
}
console.log(preview ? "✔ Preview build sends noindex, nofollow." : "✔ No preview noindex header in this build.");
