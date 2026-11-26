/**
 * Prebuild: writes lib/generated/route-params.json, the params each dynamic route prebuilds (the same lists its
 * generateStaticParams returns). The routes check it before any data/ lookup, so an unknown param calls notFound()
 * without reading from disk and still renders the site's own not-found page (app/(site)/not-found.tsx), as on
 * production. Run with --conditions=react-server (lib/data is server-only).
 */
import fs from "node:fs";
import path from "node:path";
import { getAllGuides, getAllStates, getAllProfessions } from "../lib/data";
import { getTransferPageRules } from "../lib/publishable-transfers";

const params = {
  guides: getAllGuides().map((g) => g.slug),
  states: getAllStates().map((s) => s.slug),
  professions: getAllProfessions().map((p) => p.slug),
  transfers: getTransferPageRules().map((r) => `${r.profession}/${r.fromState}/${r.toState}`),
};
const out = path.join(process.cwd(), "lib", "generated", "route-params.json");
fs.writeFileSync(out, JSON.stringify(params, null, 2) + "\n");
console.log(`route params: ${Object.entries(params).map(([k, v]) => `${k}=${v.length}`).join(" ")} -> ${path.relative(process.cwd(), out)}`);
