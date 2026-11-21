import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// Keeps the hourly ISR refresh (revalidate = 3600) working on Workers: prerendered pages live in R2 and
// stale ones are regenerated through the Durable Object queue. No tag cache (no on-demand revalidation).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
});
