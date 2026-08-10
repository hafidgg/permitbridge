import { Badge } from "@/components/ui/badge";
import type { PageEvidenceSummary } from "@/lib/knowledge-base/transfer-rule-data";

const COVERAGE_LABEL: Record<PageEvidenceSummary["coverageClass"], { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  fully_verified: { label: "Fully Supported", variant: "success" },
  partially_verified: { label: "Partially Supported", variant: "warning" },
  insufficient_evidence: { label: "Limited Evidence", variant: "destructive" },
  blocked_by_conflict: { label: "Blocked — Conflicting Sources", variant: "destructive" },
};

/**
 * The single overall evidence indicator for a transfer page. Never says
 * "Verified" unless the underlying data model actually has every critical
 * field human-reviewed — which, as of Phase 3.3, is 0 of the 5 real pages,
 * so this badge can currently only ever read "Fully Supported" in the
 * sense of evidence completeness, never in the sense of human sign-off.
 * See the Trust & Methodology section on the page itself for that distinction.
 */
export function EvidenceStatusBadge({ summary }: { summary: PageEvidenceSummary }) {
  const { label, variant } = COVERAGE_LABEL[summary.coverageClass];
  return (
    <Badge variant={variant} className="text-sm px-3 py-1">
      {label}
    </Badge>
  );
}
