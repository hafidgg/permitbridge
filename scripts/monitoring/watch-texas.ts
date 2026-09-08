import { watchOfficialSource } from "../../lib/monitoring/read-only-watch";
import { alertChangeDetected } from "../../lib/monitoring/alerting";
import type { ExtractRule } from "../../lib/pipeline/types";

const EXTRACT_RULE: ExtractRule = {
  field: "masterElectricianReciprocityLicenseFeeUsd",
  pattern: "License fee of \\$(\\d+\\.\\d{2})",
  transform: "number",
};

const KNOWN_BASELINE = 45.0;

async function main() {
  const mode = process.argv.includes("--mode=mock") ? "mock" : "live";
  const sourceId = process.argv.find((a) => a.startsWith("--source-id="))?.split("=")[1] ?? "tx-tdlr-electrician-reciprocity-fee";
  const result = await watchOfficialSource(sourceId, "https://www.tdlr.texas.gov/electricians/out-of-state.htm", EXTRACT_RULE, KNOWN_BASELINE, mode);

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
      sourceId: "tx-tdlr-electrician-reciprocity-fee",
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
