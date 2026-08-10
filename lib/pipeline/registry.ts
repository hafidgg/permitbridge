/**
 * lib/pipeline/registry.ts
 *
 * Loads and validates the source registry config
 * (data/_pipeline/sources/registry.json) into typed SourceConfig[].
 */
import fs from "node:fs";
import path from "node:path";
import type { SourceConfig } from "./types";

const REGISTRY_PATH = path.join(process.cwd(), "data", "_pipeline", "sources", "registry.json");

export function loadSourceRegistry(): SourceConfig[] {
  const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  return raw.sources as SourceConfig[];
}

export function getSourcesDueForCheck(sources: SourceConfig[]): SourceConfig[] {
  // v1: every enabled source is "due" on every run — checkIntervalDays is
  // read by CI scheduling (see .github/workflows/data-pipeline.yml) rather
  // than filtered here, so a manual run always checks everything.
  return sources.filter((s) => s.enabled);
}
