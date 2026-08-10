/**
 * lib/monitoring/registry.ts
 *
 * Phase 4.1: load/save/CRUD for the MonitoredSource registry
 * (data/knowledge-base/monitoring/registry.json). This is pure
 * infrastructure — no sources are populated by this phase (that's
 * Phase 4.11's explicit job), and no fetching/detection happens here at
 * all. This module only knows how to read and write the registry file
 * safely.
 */
import fs from "node:fs";
import path from "node:path";
import type { MonitoredSource, MonitoredSourceRegistry } from "@/types/monitoring";

const REGISTRY_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring");
const REGISTRY_PATH = path.join(REGISTRY_DIR, "registry.json");
const CURRENT_VERSION = 1;

function emptyRegistry(): MonitoredSourceRegistry {
  return { version: CURRENT_VERSION, sources: [] };
}

export function loadMonitoringRegistry(registryPath: string = REGISTRY_PATH): MonitoredSourceRegistry {
  if (!fs.existsSync(registryPath)) return emptyRegistry();
  const raw = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  if (!raw || !Array.isArray(raw.sources)) return emptyRegistry();
  return raw as MonitoredSourceRegistry;
}

export function saveMonitoringRegistry(registry: MonitoredSourceRegistry, registryPath: string = REGISTRY_PATH): void {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
}

export class DuplicateMonitoredSourceIdError extends Error {
  constructor(id: string) {
    super(`A MonitoredSource with id "${id}" already exists — ids must be unique.`);
    this.name = "DuplicateMonitoredSourceIdError";
  }
}

/** Adds a new source to the registry. Throws on a duplicate id rather than silently overwriting — a real registry mutation is always explicit. */
export function addMonitoredSource(source: MonitoredSource, registry = loadMonitoringRegistry()): MonitoredSourceRegistry {
  if (registry.sources.some((s) => s.id === source.id)) {
    throw new DuplicateMonitoredSourceIdError(source.id);
  }
  return { ...registry, sources: [...registry.sources, source] };
}

export function getMonitoredSource(id: string, registry = loadMonitoringRegistry()): MonitoredSource | undefined {
  return registry.sources.find((s) => s.id === id);
}

export function listMonitoredSources(registry = loadMonitoringRegistry()): MonitoredSource[] {
  return registry.sources;
}

export function listActiveMonitoredSources(registry = loadMonitoringRegistry()): MonitoredSource[] {
  return registry.sources.filter((s) => s.status === "active");
}

/** Updates one source's mutable fetch-tracking fields, leaving its identity/config fields untouched unless explicitly included in `patch`. */
export function updateMonitoredSource(
  id: string,
  patch: Partial<Omit<MonitoredSource, "id">>,
  registry = loadMonitoringRegistry()
): MonitoredSourceRegistry {
  const index = registry.sources.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`No MonitoredSource found with id "${id}".`);
  const updatedSources = [...registry.sources];
  const existing = updatedSources[index]!;
  updatedSources[index] = { ...existing, ...patch };
  return { ...registry, sources: updatedSources };
}

export function removeMonitoredSource(id: string, registry = loadMonitoringRegistry()): MonitoredSourceRegistry {
  return { ...registry, sources: registry.sources.filter((s) => s.id !== id) };
}

/**
 * Section 24 / Phase 4.6 — a source is "due" for a check if it isn't
 * paused (disabled) and either has never been checked or is past its
 * configured interval. Pure function of `now`, so it's directly testable
 * without mocking the clock globally.
 *
 * Phase 4.6 fix: a "failed" source remains eligible for its next
 * scheduled check — a source that hit 3 consecutive failures and never
 * gets checked again could never recover automatically, which directly
 * contradicts Step 4/13's required "successful recovery after failures"
 * behavior. Only "paused" (a deliberate human choice to stop checking)
 * is excluded — "failed" is a status to recover FROM via a future check,
 * not a permanent exclusion.
 */
export function getSourcesDueForCheck(registry: MonitoredSourceRegistry, now: Date = new Date()): MonitoredSource[] {
  return registry.sources.filter((source) => {
    if (source.status === "paused") return false;
    if (!source.lastCheckedAt) return true;
    const lastChecked = new Date(source.lastCheckedAt);
    const daysSince = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= source.checkFrequencyDays;
  });
}

/** Section 24 — staleness is about the SOURCE (haven't successfully checked it in a while), never about the FACT it may support. See doc comment on isFactStale (deliberately not defined here) for the distinction. */
export function isSourceStale(source: MonitoredSource, now: Date = new Date(), staleThresholdMultiplier = 3): boolean {
  if (!source.lastSuccessfulFetchAt) return true;
  const lastSuccess = new Date(source.lastSuccessfulFetchAt);
  const daysSinceSuccess = (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceSuccess >= source.checkFrequencyDays * staleThresholdMultiplier;
}
