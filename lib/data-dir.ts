import fs from "node:fs";

/**
 * Directory-level guard for the data/ loaders.
 *
 * Returns whether `dir` exists. Outside production a missing directory is
 * treated as empty (scripts and tests often run against partial fixtures).
 * In production it throws: data/ missing at runtime means the function
 * bundle shipped without it, and returning [] there silently empties every
 * page and sitemap entry built from it — the 2026-10 sitemap regression
 * (78 URLs -> 18) was exactly that. A loud 500 is better than a quiet
 * half-empty site.
 */
export function dataDirExists(dir: string): boolean {
  if (fs.existsSync(dir)) return true;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Required data directory is missing at runtime: ${dir} (cwd: ${process.cwd()})`);
  }
  return false;
}
