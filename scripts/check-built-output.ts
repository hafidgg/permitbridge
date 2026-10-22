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
 *
 * It also checks the visible text of every prerendered .html page (scripts
 * and styles stripped, so data keys in the RSC payload don't count) for
 * internal tokens that leaked into prose: "see endorsementRules"-style field
 * references, camelCase field names, snake_case enum values
 * ("compact_privilege"), raw true/false field values and unrendered markdown
 * ("**", "## ").
 *
 * The same visible text, plus <title> and meta descriptions, must not
 * lowercase a proper name mid-sentence (a state name, a CSLB code like
 * "c-36") or start a sentence in lowercase: both come from a title-case label
 * being lowercased into a template sentence.
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

const visibleForbidden: { label: string; re: RegExp }[] = [
  { label: "field reference", re: /\bsee [a-z]+[A-Z]\w+/ },
  { label: "camelCase field name", re: /\b[a-z]+(?:[A-Z][a-z]+)+\b/ },
  { label: "snake_case enum", re: /\b[a-z]+(?:_[a-z]+)+\b/ },
  { label: "unrendered markdown", re: /\*\*|(?:^|\s)## / },
  { label: "raw boolean value", re: /\b(?:Recognition|Membership|Status) (?:true|false)\b/ },
];

// All 50 states and DC, not just the ones in data/states: knowledge-base pages name others (2026-10-22: "georgia → illinois").
const stateNames: string[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida",
  "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];
visibleForbidden.push(
  // Leaked values from a broken template or cross-reference (2026-10-22: "((see undefined and the exam requirements))").
  { label: "leaked undefined/null value", re: /\bundefined\b|\[object Object\]|\bNaN\b/ },
  // A markdown table the guide renderer doesn't support shows as raw pipes.
  { label: "unrendered markdown table", re: /\|\s*-{3,}\s*\|/ },
  // Claims removed after a raw-text audit found them in no registered source (2026-10-22). They must not come back.
  {
    label: "claim removed as unsourced",
    re: /§\s?7065\.1|form 13A-1|\$25,000 (?:contractor'?s )?bond|some or all of the Texas requirements|unless TDLR waives|evaluated case by case|ORC 4740\.08|4796\.01 defines|Class A is unrestricted|about 10 business days|precondition to issuance of any class of individual electrical license/i,
  },
  // Research-process wording that belongs in notes, not on a page (file names, "this pass", "read here as", ...).
  {
    label: "research-process wording",
    re: /\b[a-z]+-(?:journeyman|master|to-[a-z-]+)\.json\b|\bread here as\b|could not be independently confirmed|\bthis (?:pass|session)\b|\bPhase \d[A-Z]?(?:\.\d+)*\b|flagged as an open question rather than/i,
  },
  // Not inside a slug, path or domain ("new-york", "/texas", "tsbpe.texas.gov").
  { label: "lowercase state name", re: new RegExp(String.raw`(?<![./\w-])(?:${stateNames.map((n) => n.toLowerCase()).join("|")})\b(?![-/\w]|\.\w)`) },
  { label: "lowercase license code", re: /\b[a-z]-\d{1,2}\b/ },
  // A sentence starting lowercase. Abbreviations that end in a period are not sentence ends; an email address is not a word.
  { label: "sentence starting lowercase", re: /(?<!\b(?:e\.g|i\.e|vs|etc|approx|No|Sec|Rev|Stat|Ann|Code|Admin|seq|U\.S|al|Inc|Co))[.!?] +(?!\S*@)[a-z]/ }
);

/** <title> and meta description text, which the tag-stripping below would drop. */
function headText(html: string): string {
  const parts = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>|<meta (?:name|property)="(?:description|og:description|og:title)" content="([^"]*)"/g)];
  return parts.map((m) => m[1] ?? m[2] ?? "").join(" . ");
}

function visibleText(html: string): string {
  return headText(html) + " " + html
    .replace(/<(script|style|template)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
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
  if (!file.endsWith(".html")) continue;
  const visible = visibleText(text);
  for (const { label, re } of visibleForbidden) {
    const m = visible.match(re);
    if (m) failures.push(`${path.relative(APP, file)}: ${label} in visible text ("${m[0]}")`);
  }
}
console.log("Built-output check — unsourced generator data and leaked internal tokens");
if (failures.length) {
  for (const f of failures.slice(0, 50)) console.error(`  ✖ ${f}`);
  console.error(`✖ ${failures.length} hit(s). Remove the render, don't edit the data to dodge the match.`);
  process.exit(1);
}
console.log("✔ None found.");
