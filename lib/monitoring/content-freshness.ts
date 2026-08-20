import fs from "node:fs";
import path from "node:path";
import type { DetectedChange } from "@/types/monitoring";

/**
 * System 1 — Automated Content Freshness (read-only reporting layer).
 *
 * IMPORTANT — what this module deliberately does NOT do:
 * It never writes to facts/, transfer-rules/, or any `updatedAt`/
 * `verifiedAt` field. That write path already exists and is correctly
 * gated behind human review (lib/knowledge-base/fields.ts's
 * updateField(), reachable only through applyAndPersistReview()). This
 * module only READS the real, already-existing signals — the
 * DetectedChange archive and the review log each change carries — and
 * turns them into a human-readable audit trail.
 *
 * Why this is needed at all: `app/sitemap.ts` already uses real
 * `updatedAt`/`verifiedAt` values for `lastModified` on every route type
 * (profession, state, and RN transfer pages — confirmed by direct
 * inspection during this system's baseline audit). That part of the
 * "SOURCE CHANGE → ... → SITEMAP LASTMOD" pipeline was already complete
 * before this module existed. What was missing was a verifiable,
 * human-readable trail connecting a specific DetectedChange to the
 * specific sitemap freshness signal it eventually justified — useful for
 * audit, and for anyone who wants to confirm no `lastModified` value is
 * fabricated or stale-but-claimed-fresh.
 */

const CHANGES_DIR = path.join(process.cwd(), "data", "knowledge-base", "monitoring", "changes");

export interface FreshnessEvent {
  changeId: string;
  sourceId: string;
  jurisdiction: string;
  destinationJurisdiction?: string;
  profession?: string;
  field?: string;
  detectedAt: string;
  status: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** True only when review status indicates the change was actually approved and applied — never inferred, always read directly from the real review log. */
  resultedInContentUpdate: boolean;
}

function loadAllDetectedChanges(): DetectedChange[] {
  if (!fs.existsSync(CHANGES_DIR)) return [];
  return fs
    .readdirSync(CHANGES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(CHANGES_DIR, f), "utf-8")) as DetectedChange);
}

/**
 * Builds the real freshness/audit trail from the actual DetectedChange
 * archive on disk. Every event here traces back to a real file — nothing
 * is synthesized.
 */
export function buildFreshnessReport(): FreshnessEvent[] {
  const changes = loadAllDetectedChanges();

  return changes
    .map((c): FreshnessEvent => {
      const lastReviewEntry = c.reviewLog?.[c.reviewLog.length - 1];
      return {
        changeId: c.id,
        sourceId: c.sourceId,
        jurisdiction: c.jurisdiction,
        destinationJurisdiction: c.destinationJurisdiction,
        profession: c.profession,
        field: c.field,
        detectedAt: c.detectedAt,
        status: c.status,
        reviewedAt: lastReviewEntry?.timestamp,
        reviewedBy: lastReviewEntry?.reviewer,
        resultedInContentUpdate: c.status === "approved",
      };
    })
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}

/**
 * Human-readable summary for docs/CI output — never used to drive any
 * write path, purely informational.
 */
export function summarizeFreshness(events: FreshnessEvent[]): string {
  const applied = events.filter((e) => e.resultedInContentUpdate).length;
  const pending = events.filter((e) => e.status === "pending_verification").length;
  const rejected = events.filter((e) => e.status === "rejected").length;

  const lines = [
    `Content freshness audit trail — ${events.length} total detected change(s) on record.`,
    `  Applied (resulted in a real content update): ${applied}`,
    `  Pending human review: ${pending}`,
    `  Rejected (no content update): ${rejected}`,
    "",
  ];
  for (const e of events.slice(0, 20)) {
    const target = e.destinationJurisdiction ? `${e.jurisdiction}->${e.destinationJurisdiction}` : e.jurisdiction;
    lines.push(`  [${e.detectedAt}] ${e.sourceId} (${target}${e.field ? `, field=${e.field}` : ""}) -> ${e.status}`);
  }
  return lines.join("\n");
}
