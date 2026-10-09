/**
 * scripts/check-built-output.ts
 *
 * Fails (exit 1) if unsourced generator data reaches the built site (.next).
 * Runs in `postbuild`. Checks every prerendered page, RSC payload, sitemap and
 * llms.txt for:
 *   - each profession's averageTransferDays range ("14–60 days" etc.) and the
 *     old "Typical transfer" badge
 *   - the nurse compactStates list (any 10 consecutive names; shorter runs match
 *     ordinary alphabetical state lists, e.g. an electrician reciprocity list)
 *   - difficulty ratings and the Portability Score
 * These values are template defaults with no source (see types/index.ts).
 */
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), ".next", "server", "app");
const professions = fs
  .readdirSync(path.join(process.cwd(), "data", "professions"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "professions", f), "utf-8")));

const forbidden: { label: string; re: RegExp }[] = [
  { label: "Typical transfer badge", re: /Typical transfer/ },
  { label: "difficulty rating", re: /Difficulty|difficultyScore|\b\d{1,2}\/10\b/ },
  { label: "Portability Score", re: /[Pp]ortability/ },
];
for (const p of professions) {
  const [a, b] = p.averageTransferDays as [number, number];
  forbidden.push({ label: `${p.slug} averageTransferDays`, re: new RegExp(`\\b${a}\\s?[–-]\\s?${b}\\s+days`) });
  const states: string[] = p.compactStates ?? [];
  for (let i = 0; i + 9 < states.length; i++) {
    const run = states.slice(i, i + 10).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(",\\s*");
    forbidden.push({ label: `${p.slug} compactStates list`, re: new RegExp(run) });
  }
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(html|rsc|body|xml|txt)$/.test(e.name) ? [full] : [];
  });
}

if (!fs.existsSync(APP)) {
  console.error(`${APP} not found: run \`next build\` first.`);
  process.exit(1);
}
const failures: string[] = [];
for (const file of walk(APP)) {
  const text = fs.readFileSync(file, "utf-8");
  for (const { label, re } of forbidden) {
    const m = text.match(re);
    if (m) failures.push(`${path.relative(APP, file)}: ${label} ("${m[0]}")`);
  }
}
console.log("Built-output check — unsourced generator data");
if (failures.length) {
  for (const f of failures.slice(0, 50)) console.error(`  ✖ ${f}`);
  console.error(`✖ ${failures.length} hit(s). Remove the render, don't edit the data to dodge the match.`);
  process.exit(1);
}
console.log("✔ None found.");
