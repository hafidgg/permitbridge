import { watchOfficialSource } from "../../lib/monitoring/read-only-watch";
import { alertChangeDetected } from "../../lib/monitoring/alerting";
import type { ExtractRule } from "../../lib/pipeline/types";

const EXTRACT_RULE: ExtractRule = {
  field: "generalContractorLicenseFeeUsd",
  pattern: "Initial application or renewal made in person, by mail, or by fax\\s+\\$(\\d+(?:\\.\\d{2})?)",
  transform: "number",
};

const KNOWN_BASELINE = 353.9;

async function main() {
  const mode = process.argv.includes("--mode=mock") ? "mock" : "live";
  const sourceId = process.argv.find((a) => a.startsWith("--source-id="))?.split("=")[1] ?? "wa-electrical-contractor-license-fee";
  const result = await watchOfficialSource(
    sourceId,
    "https://lawfilesext.leg.wa.gov/Law/WAC/WAC%20296%20%20TITLE/WAC%20296%20-%2046B%20CHAPTER/WAC%20296%20-%2046B-909.htm",
    EXTRACT_RULE,
    KNOWN_BASELINE,
    mode
  );

  console.log(`RESULT: ${result.type}`);
  console.log(`Source: ${result.source}`);
  console.log(`Detected at: ${result.detectedAt}`);

  if (result.type === "NO_CHANGE") {
    console.log(`Value confirmed unchanged: ${result.newValue}`);
    process.exit(0);
  }

  if (result.type === "SOURCE_UNAVAILABLE") {
    console.log(`::warning::Source unavailable — ${result.reason}`);
    process.exit(0);
  }

  if (result.type === "CHANGE_DETECTED") {
    console.log("::warning::CHANGE_DETECTED — official value differs from the known baseline.");
    console.log(`  Previous value: ${result.oldValue}`);
    console.log(`  New value:      ${result.newValue}`);
    alertChangeDetected({
      sourceId: "wa-electrical-contractor-license-fee",
      sourceUrl: result.source,
      oldValue: result.oldValue!,
      newValue: result.newValue!,
      detectedAt: result.detectedAt,
      evidence: result.evidence,
    });
    process.exit(0);
  }
}

main();