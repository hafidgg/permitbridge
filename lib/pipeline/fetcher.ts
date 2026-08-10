/**
 * lib/pipeline/fetcher.ts
 *
 * Fetch layer for the data pipeline. Two modes:
 *  - "live": real HTTP requests to official sources, with ETag caching,
 *    retry/backoff, and a polite User-Agent + rate limit between requests.
 *  - "mock": reads from /fixtures/pipeline/html instead of the network.
 *    Used for local dry runs, CI smoke tests, and any environment without
 *    outbound internet access.
 *
 * Every fetch is content-hashed and cached to data/_pipeline/cache/ so a
 * re-run that hits an unchanged page short-circuits to "not_modified"
 * without re-parsing — this is what makes frequent pipeline runs cheap.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SourceConfig, FetchResult, FetchableSource } from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "_pipeline", "cache");
const FIXTURES_DIR = path.join(process.cwd(), "fixtures", "pipeline", "html");
const USER_AGENT = "PermitBridgeDataBot/1.0 (+https://www.permitbridge.com/about; licensing-data-research)";
const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exported (Phase 4.2) so lib/monitoring/fetch.ts can reuse the exact same
 * SHA-256 content-hashing this module already used for the live-site
 * pipeline, instead of reimplementing it. Behavior is completely
 * unchanged for existing callers within this file.
 */
export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function cacheFilePath(sourceId: string): string {
  return path.join(CACHE_DIR, `${sourceId}.json`);
}

function readCacheMeta(sourceId: string): { etag?: string; contentHash?: string } | null {
  const filePath = cacheFilePath(sourceId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { etag: parsed.etag, contentHash: parsed.contentHash };
  } catch {
    return null;
  }
}

function writeCache(sourceId: string, data: { etag?: string; contentHash: string; rawText: string; fetchedAt: string }) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFilePath(sourceId), JSON.stringify(data, null, 2));
}

/** Strip HTML tags/scripts down to whitespace-normalized text for regex extraction. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLive(source: FetchableSource): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const cached = readCacheMeta(source.id);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = { "User-Agent": USER_AGENT };
      if (cached?.etag) headers["If-None-Match"] = cached.etag;

      const response = await fetch(source.url, { headers });

      if (response.status === 304) {
        return { sourceId: source.id, url: source.url, fetchedAt, status: "not_modified", httpStatus: 304 };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const text = htmlToText(html);
      const contentHash = hashContent(text);
      const etag = response.headers.get("etag") ?? undefined;

      if (cached?.contentHash === contentHash) {
        return { sourceId: source.id, url: source.url, fetchedAt, status: "not_modified", httpStatus: response.status };
      }

      writeCache(source.id, { etag, contentHash, rawText: text, fetchedAt });

      return {
        sourceId: source.id,
        url: source.url,
        fetchedAt,
        status: "ok",
        httpStatus: response.status,
        etag,
        contentHash,
        rawText: text,
      };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return {
          sourceId: source.id,
          url: source.url,
          fetchedAt,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        };
      }
      await sleep(500 * attempt);
    }
  }

  // Unreachable, but keeps TypeScript satisfied.
  return { sourceId: source.id, url: source.url, fetchedAt, status: "error", error: "Unknown fetch failure" };
}

async function fetchMock(source: FetchableSource): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const fixturePath = path.join(FIXTURES_DIR, `${source.id}.html`);

  if (!fs.existsSync(fixturePath)) {
    return {
      sourceId: source.id,
      url: source.url,
      fetchedAt,
      status: "error",
      error: `No fixture found at fixtures/pipeline/html/${source.id}.html — add one to test this source in mock mode.`,
    };
  }

  const html = fs.readFileSync(fixturePath, "utf-8");
  const text = htmlToText(html);
  const contentHash = hashContent(text);

  return { sourceId: source.id, url: source.url, fetchedAt, status: "ok", httpStatus: 200, contentHash, rawText: text };
}

export async function fetchSource(source: FetchableSource, mode: "live" | "mock"): Promise<FetchResult> {
  const result = mode === "mock" ? await fetchMock(source) : await fetchLive(source);
  if (mode === "live") await sleep(REQUEST_DELAY_MS); // be a polite bot between live requests
  return result;
}

export async function fetchAllSources(sources: SourceConfig[], mode: "live" | "mock"): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  for (const source of sources.filter((s) => s.enabled)) {
    results.push(await fetchSource(source, mode));
  }
  return results;
}
