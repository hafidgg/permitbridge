/**
 * scripts/validate-data.ts
 *
 * Sanity-checks every JSON file under /data:
 *  - valid JSON
 *  - required fields present
 *  - every transfer rule points to a profession/state that actually exists
 *  - every profession.relatedProfessions slug exists
 *
 * Run before every deploy: npm run validate-data
 */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function main() {
  const errors: string[] = [];

  const professionFiles = fs.readdirSync(path.join(DATA_DIR, "professions")).filter((f) => f.endsWith(".json"));
  const stateFiles = fs.readdirSync(path.join(DATA_DIR, "states")).filter((f) => f.endsWith(".json"));

  const professionSlugs = new Set<string>();
  for (const file of professionFiles) {
    const data = readJson(path.join(DATA_DIR, "professions", file));
    if (!data.slug || !data.name || !Array.isArray(data.faqs)) {
      errors.push(`Profession file ${file} is missing required fields.`);
    }
    professionSlugs.add(data.slug);
  }

  const stateSlugs = new Set<string>();
  for (const file of stateFiles) {
    const data = readJson(path.join(DATA_DIR, "states", file));
    if (!data.slug || !data.name || !data.abbreviation) {
      errors.push(`State file ${file} is missing required fields.`);
    }
    stateSlugs.add(data.slug);
  }

  // Validate related professions reference real slugs
  for (const file of professionFiles) {
    const data = readJson(path.join(DATA_DIR, "professions", file));
    for (const rel of data.relatedProfessions ?? []) {
      if (!professionSlugs.has(rel)) {
        errors.push(`Profession ${data.slug} references unknown related profession "${rel}".`);
      }
    }
  }

  // Validate transfer rules
  const transfersDir = path.join(DATA_DIR, "transfers");
  if (fs.existsSync(transfersDir)) {
    for (const professionSlug of fs.readdirSync(transfersDir)) {
      if (!professionSlugs.has(professionSlug)) {
        errors.push(`Transfer folder "${professionSlug}" has no matching profession JSON.`);
        continue;
      }
      const ruleDir = path.join(transfersDir, professionSlug);
      for (const file of fs.readdirSync(ruleDir)) {
        const rule = readJson(path.join(ruleDir, file));
        if (!stateSlugs.has(rule.fromState)) errors.push(`${file}: unknown fromState "${rule.fromState}"`);
        if (!stateSlugs.has(rule.toState)) errors.push(`${file}: unknown toState "${rule.toState}"`);
        if (rule.fromState === rule.toState) errors.push(`${file}: fromState equals toState`);
        if (typeof rule.portabilityScore !== "number") errors.push(`${file}: missing portabilityScore`);
      }
    }
  }

  // Validate the pipeline's source registry (data/_pipeline/sources/registry.json)
  // so a typo'd entitySlug can't silently point a source at nothing.
  const registryPath = path.join(DATA_DIR, "_pipeline", "sources", "registry.json");
  if (fs.existsSync(registryPath)) {
    const registry = readJson(registryPath);
    for (const source of registry.sources ?? []) {
      if (source.entityKind === "profession" && !professionSlugs.has(source.entitySlug)) {
        errors.push(`Pipeline source "${source.id}" targets unknown profession "${source.entitySlug}".`);
      }
      if (source.entityKind === "state" && !stateSlugs.has(source.entitySlug)) {
        errors.push(`Pipeline source "${source.id}" targets unknown state "${source.entitySlug}".`);
      }
    }
  }

  // Validate transfer-rule overrides (data/_pipeline/overrides/transfers/**)
  // the same way as generated transfer rules, so a bad override can't
  // silently produce an inconsistent page after the next generate step.
  const overridesDir = path.join(DATA_DIR, "_pipeline", "overrides", "transfers");
  if (fs.existsSync(overridesDir)) {
    for (const professionSlug of fs.readdirSync(overridesDir)) {
      if (!professionSlugs.has(professionSlug)) {
        errors.push(`Override folder "${professionSlug}" has no matching profession JSON.`);
        continue;
      }
      const overrideDir = path.join(overridesDir, professionSlug);
      for (const file of fs.readdirSync(overrideDir)) {
        if (!file.endsWith(".json")) continue;
        const [from, to] = file.replace(".json", "").split("--");
        if (!from || !stateSlugs.has(from)) errors.push(`Override ${professionSlug}/${file}: unknown fromState "${from}"`);
        if (!to || !stateSlugs.has(to)) errors.push(`Override ${professionSlug}/${file}: unknown toState "${to}"`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`❌ Data validation failed with ${errors.length} error(s):\n`);
    errors.forEach((e) => console.error(" - " + e));
    process.exit(1);
  }

  console.log(`✅ Data OK — ${professionSlugs.size} professions, ${stateSlugs.size} states validated.`);
}

main();
