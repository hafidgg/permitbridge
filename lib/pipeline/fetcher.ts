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

/**
 * Phase 4.13.5. Both defaults are evidence-based, not guesses:
 *
 * DEFAULT_FETCH_TIMEOUT_MS: the audit's own reproduction (Phase 4.13.4,
 * Scenarios A/B) confirmed fetchLive() has zero internal timeout and can
 * hang indefinitely against a truly stuck connection. 15s is generous
 * relative to how fast the 4 currently-real monitored .gov pages actually
 * respond in practice (well under a second each, per every real fetch
 * performed across this project), while still being short enough that a
 * genuinely hung request fails fast instead of consuming the entire
 * GitHub Actions job budget.
 *
 * DEFAULT_MAX_RESPONSE_BYTES: re-fetched the real, current Florida fees
 * page live during this phase's audit — its full rendered content
 * (including nav chrome, WordPress boilerplate, and every fee category on
 * the page, not just the one this system extracts from) is on the order
 * of tens of KB, not megabytes. 2 MiB gives roughly 40-100x headroom over
 * that real, observed size — enough that ordinary page growth over time
 * could never trip it, while still being dramatically tighter than an
 * arbitrary "a few MB" guess. (Exact raw HTML byte counts for the live
 * pages aren't directly measurable from this environment — no raw HTTP
 * client access, only markdown-converted fetches — so this is a
 * conservative estimate built on that real content, not a byte-exact
 * measurement; noted explicitly rather than overstated.)
 */
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MiB

export { DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_MAX_RESPONSE_BYTES };

export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response exceeded the ${maxBytes}-byte safety cap before it finished downloading.`);
    this.name = "ResponseTooLargeError";
  }
}

/**
 * Reads a Response's body incrementally via its stream, aborting as soon
 * as the cumulative byte count exceeds maxBytes — deliberately NOT a
 * Content-Length header check. Phase 4.13.4's own reproduction (Scenario
 * C) proved a header-only check is trivially bypassed by a response that
 * simply omits or lies about Content-Length while still streaming an
 * arbitrarily large body; only checking the bytes actually received is a
 * real guarantee.
 */
async function readTextWithSizeCap(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    // Some environments (or mocked responses in tests) may not expose a
    // readable stream — fall back to the plain read rather than crash;
    // still correct, just without the incremental guard for that case.
    return response.text();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new ResponseTooLargeError(maxBytes);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
}

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

async function fetchLive(source: FetchableSource, now?: Date, timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS, maxResponseBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<FetchResult> {
  const fetchedAt = (now ?? new Date()).toISOString();
  const cached = readCacheMeta(source.id);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { "User-Agent": USER_AGENT };
      if (cached?.etag) headers["If-None-Match"] = cached.etag;

      const response = await fetch(source.url, { headers, signal: controller.signal });

      if (response.status === 304) {
        return { sourceId: source.id, url: source.url, fetchedAt, status: "not_modified", httpStatus: 304 };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await readTextWithSizeCap(response, maxResponseBytes);
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
      const isAbort = err instanceof Error && err.name === "AbortError";
      const message = isAbort ? `Request timed out after ${timeoutMs}ms` : err instanceof Error ? err.message : String(err);
      if (attempt === MAX_RETRIES || err instanceof ResponseTooLargeError) {
        // A too-large response is never worth retrying — the page is
        // structurally wrong for this pipeline, not transiently flaky.
        return {
          sourceId: source.id,
          url: source.url,
          fetchedAt,
          status: "error",
          error: err instanceof ResponseTooLargeError ? err.message : message,
        };
      }
      await sleep(500 * attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Unreachable, but keeps TypeScript satisfied.
  return { sourceId: source.id, url: source.url, fetchedAt, status: "error", error: "Unknown fetch failure" };
}

async function fetchMock(source: FetchableSource, now?: Date): Promise<FetchResult> {
  const fetchedAt = (now ?? new Date()).toISOString();
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

/**
 * Phase 4.13.3: optional `now` lets a caller (currently only
 * lib/monitoring/*, via fetchMonitoredSource) inject a deterministic
 * clock for the `fetchedAt` timestamp — needed so runMonitoringCycle()'s
 * own injectable `now` (already used for due-checking and health
 * summaries) actually threads through to the value written into
 * lastCheckedAt, instead of that timestamp silently using real
 * wall-clock time regardless of what the caller injected. Omitted
 * entirely, this defaults to `new Date()` exactly as before — zero
 * behavior change for the live-site pipeline (lib/pipeline/run.ts),
 * which never passes a third argument here.
 */
export async function fetchSource(source: FetchableSource, mode: "live" | "mock", now?: Date, timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS, maxResponseBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<FetchResult> {
  const result = mode === "mock" ? await fetchMock(source, now) : await fetchLive(source, now, timeoutMs, maxResponseBytes);
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
