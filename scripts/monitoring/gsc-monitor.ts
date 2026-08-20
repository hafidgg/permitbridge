import fs from "node:fs";
import path from "node:path";
import { isGscMonitoringEnabled, loadCredentialsFromEnv } from "../../lib/integrations/google-search-console/client";
import { buildSnapshot } from "../../lib/integrations/google-search-console/queries";
import { compareSnapshots } from "../../lib/integrations/google-search-console/alerts";
import type { GscSnapshot } from "../../lib/integrations/google-search-console/types";
import { SITE_URL } from "../../lib/utils";

/**
 * Entry point for the optional weekly GSC monitoring workflow.
 *
 * Exits cleanly (code 0, no error) whenever GSC monitoring isn't
 * configured — this script must never break the rest of CI or imply
 * something is wrong just because the optional feature isn't set up.
 */
async function main() {
  if (!isGscMonitoringEnabled()) {
    console.log("[gsc-monitor] GSC_MONITORING_ENABLED is not 'true' — skipping (this is expected unless you've explicitly opted in).");
    return;
  }

  const credentials = loadCredentialsFromEnv();
  if (!credentials) {
    console.log("[gsc-monitor] GSC_MONITORING_ENABLED=true but GSC_SERVICE_ACCOUNT_JSON is missing/invalid — skipping.");
    return;
  }

  // GSC's Domain-property format expects "sc-domain:example.com", not a URL.
  const siteUrl = `sc-domain:${new URL(SITE_URL).hostname}`;
  const snapshotPath = path.join(process.cwd(), "data", "gsc-snapshots", "latest.json");

  console.log(`[gsc-monitor] querying Search Analytics for ${siteUrl}...`);
  const current = await buildSnapshot(credentials, siteUrl);

  let previous: GscSnapshot | null = null;
  if (fs.existsSync(snapshotPath)) {
    previous = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  }

  const alerts = compareSnapshots(previous, current);

  console.log(`[gsc-monitor] clicks=${current.totals.clicks} impressions=${current.totals.impressions} avgPosition=${current.totals.averagePosition.toFixed(1)}`);
  for (const alert of alerts) {
    console.log(`[gsc-monitor] [${alert.severity.toUpperCase()}] ${alert.message}`);
  }

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2) + "\n");
  console.log(`[gsc-monitor] snapshot saved to ${snapshotPath}`);
}

main().catch((err) => {
  // Deliberately non-fatal: a transient GSC API failure (rate limit,
  // brief outage) should not fail the whole CI run for an optional,
  // non-critical monitoring feature.
  console.error("[gsc-monitor] error (non-fatal):", err instanceof Error ? err.message : err);
});
