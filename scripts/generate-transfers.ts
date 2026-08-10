/**
 * scripts/generate-transfers.ts
 *
 * Regenerates every /data/transfers/{profession}/{from}--{to}.json file from
 * the source-of-truth profession and state JSON files. Run this after
 * editing/adding a profession or state so the transfer matrix stays in sync.
 *
 * Usage: npm run generate-transfers
 */
import fs from "node:fs";
import path from "node:path";
import type { Profession, State, TransferRule, PathwayType } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFESSIONS_DIR = path.join(DATA_DIR, "professions");
const STATES_DIR = path.join(DATA_DIR, "states");
const TRANSFERS_DIR = path.join(DATA_DIR, "transfers");

const BASE_FEE: Record<string, number> = {
  california: 465,
  texas: 235,
  florida: 285,
  "new-york": 400,
  ohio: 210,
};

function loadJsonDir<T>(dir: string): T[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as T);
}

function computeRule(
  profession: Profession,
  from: State,
  to: State
): TransferRule {
  const acceptedExamStates = new Set(profession.commonExamAcceptedStates ?? []);
  const toAcceptsCommonExam = acceptedExamStates.has(to.name);
  const fee = BASE_FEE[to.slug] ?? 250;

  let pathway: PathwayType;
  let pathwayLabel: string;
  let examRequired: boolean;
  let additionalHours = 0;
  let days: [number, number];
  let minYears: number;
  let difficulty: number;

  if (profession.slug === "nurse") {
    const compactStates = new Set(profession.compactStates ?? []);
    const bothCompact = compactStates.has(from.name) && compactStates.has(to.name);
    if (bothCompact) {
      pathway = "compact";
      pathwayLabel = "Nurse Licensure Compact (multistate privilege)";
      examRequired = false;
      days = [5, 15];
      minYears = 0;
      difficulty = 2;
    } else {
      pathway = "endorsement";
      pathwayLabel = "Licensure by Endorsement";
      examRequired = false;
      days = [14, 45];
      minYears = 0;
      difficulty = 4;
    }
  } else if (to.isUlrState) {
    pathway = "reciprocity";
    pathwayLabel = "Universal License Recognition (Endorsement)";
    examRequired = !toAcceptsCommonExam;
    days = [14, 45];
    minYears = 1;
    difficulty = examRequired ? 5 : 3;
  } else if (toAcceptsCommonExam) {
    pathway = "endorsement";
    pathwayLabel = "Licensure by Endorsement (common exam accepted)";
    examRequired = false;
    days = [21, 60];
    minYears = 2;
    difficulty = 5;
  } else {
    pathway = "none";
    pathwayLabel = "Full New Application Required";
    examRequired = true;
    additionalHours = ["electrician", "plumber", "hvac-technician"].includes(profession.slug) ? 32 : 0;
    days = [30, 90];
    minYears = 2;
    difficulty = 8;
  }

  let score = 100 - difficulty * 8;
  if (examRequired) score -= 10;
  if (additionalHours > 0) score -= 5;
  score = Math.max(5, Math.min(97, score));

  const examName = examRequired
    ? profession.slug === "nurse"
      ? "NCLEX (if no active license verification)"
      : profession.commonExam
    : undefined;

  const steps: string[] = [
    `Confirm your ${profession.shortName} license is active and in good standing in ${from.name}.`,
  ];

  if (pathway === "compact") {
    steps.push(
      `Verify ${to.name} is a compact member state and set it as your primary state of residence.`,
      "Update your address with your home-state nursing board so your multistate privilege applies to the new state."
    );
  } else {
    steps.push(
      `Submit a license verification request from ${from.name} through the appropriate national registry or the state board directly.`,
      `File an application for ${pathwayLabel.toLowerCase()} with ${to.name}'s licensing board.`
    );
    if (examRequired) steps.push(`Register for and pass the required exam: ${examName}.`);
    if (additionalHours > 0) steps.push(`Complete ${additionalHours} additional training/CE hours required by ${to.name}.`);
    steps.push(`Pay the ${to.name} application fee (approx. $${fee}) and submit supporting documents.`);
  }
  steps.push(`Await processing — typically ${days[0]}-${days[1]} days in ${to.name}.`);

  const notes =
    `${to.name}'s ${profession.shortName.toLowerCase()} licensing requirements are administered per the state's ` +
    `licensing authority. ${to.licensingAuthorityNote} Always confirm current rules directly with the official ` +
    `board before applying, since requirements change.`;

  return {
    profession: profession.slug,
    fromState: from.slug,
    toState: to.slug,
    pathway,
    pathwayLabel,
    examRequired,
    examName,
    additionalHoursRequired: additionalHours,
    feeUsd: fee,
    estimatedProcessingDays: days,
    minimumYearsLicensed: minYears,
    difficultyScore: difficulty,
    portabilityScore: score,
    steps,
    notes,
    officialSourceName: `${to.name} State Licensing Board`,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

const OVERRIDES_DIR = path.join(DATA_DIR, "_pipeline", "overrides", "transfers");

/**
 * If the data pipeline has verified specific fields for this exact
 * profession/from/to combination directly against an official source
 * (rather than the general rule engine above), those fields win. This is
 * how a real, source-confirmed fee or processing time can override the
 * computed default without touching the rule engine itself. Absent an
 * override file, behavior is 100% identical to before this file existed.
 */
function applyOverrideIfPresent(rule: TransferRule, professionSlug: string, fromSlug: string, toSlug: string): TransferRule {
  const overridePath = path.join(OVERRIDES_DIR, professionSlug, `${fromSlug}--${toSlug}.json`);
  if (!fs.existsSync(overridePath)) return rule;

  try {
    const override = JSON.parse(fs.readFileSync(overridePath, "utf-8")) as Partial<TransferRule>;
    return { ...rule, ...override };
  } catch {
    console.warn(`  ⚠ could not parse override at ${overridePath} — using computed default instead.`);
    return rule;
  }
}

function main() {
  const professions = loadJsonDir<Profession>(PROFESSIONS_DIR);
  const states = loadJsonDir<State>(STATES_DIR);
  let count = 0;
  let overriddenCount = 0;

  for (const profession of professions) {
    const outDir = path.join(TRANSFERS_DIR, profession.slug);
    fs.mkdirSync(outDir, { recursive: true });

    for (const from of states) {
      for (const to of states) {
        if (from.slug === to.slug) continue;
        const computed = computeRule(profession, from, to);
        const overridePath = path.join(OVERRIDES_DIR, profession.slug, `${from.slug}--${to.slug}.json`);
        const hadOverride = fs.existsSync(overridePath);
        const rule = applyOverrideIfPresent(computed, profession.slug, from.slug, to.slug);
        if (hadOverride) overriddenCount++;

        const outPath = path.join(outDir, `${from.slug}--${to.slug}.json`);
        fs.writeFileSync(outPath, JSON.stringify(rule, null, 2));
        count++;
      }
    }
  }

  console.log(
    `Generated ${count} transfer rule files across ${professions.length} professions and ${states.length} states ` +
      `(${overriddenCount} used a pipeline-verified override).`
  );
}

main();
