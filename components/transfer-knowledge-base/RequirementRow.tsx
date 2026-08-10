import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { VerifiedField, SourceRecord } from "@/types/knowledge-base";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  verified: { label: "Verified", variant: "success" },
  pending_verification: { label: "Pending Verification", variant: "warning" },
  needs_review: { label: "Needs Review", variant: "warning" },
  conflicting_sources: { label: "Conflicting", variant: "destructive" },
  deprecated: { label: "Deprecated", variant: "secondary" },
};

function isRequirementValue(value: unknown): value is { status: string; conditions?: { description: string; category: string }[] } {
  return typeof value === "object" && value !== null && "status" in (value as object);
}

const REQUIREMENT_STATUS_TEXT: Record<string, string> = {
  required: "Required",
  not_required: "Not Required",
  not_applicable: "Not Applicable",
  conditional: "Conditional",
};

export function RequirementRow({
  label,
  isCritical,
  field,
  source,
  valueFormatter,
}: {
  label: string;
  isCritical?: boolean;
  field: VerifiedField<unknown>;
  source: SourceRecord | undefined;
  valueFormatter?: (value: unknown) => string;
}) {
  const isUnknown = field.value === "Unknown";
  const statusInfo = STATUS_LABEL[field.status] ?? { label: field.status, variant: "outline" as const };
  const isSecondary = source?.authorityLevel === "supplementary";

  return (
    <div className="border-b border-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{label}</h3>
          {isCritical && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Critical
            </Badge>
          )}
        </div>
        {!isUnknown && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
      </div>

      {isUnknown ? (
        <p className="mt-2 text-sm italic text-muted-foreground">Not yet confirmed — no official evidence has been found for this field yet.</p>
      ) : (
        <>
          <p className="mt-2 text-base">
            {isRequirementValue(field.value) ? (
              <span className="font-medium">{REQUIREMENT_STATUS_TEXT[field.value.status] ?? field.value.status}</span>
            ) : (
              <span className="font-medium">{valueFormatter ? valueFormatter(field.value) : String(field.value)}</span>
            )}
          </p>

          {isRequirementValue(field.value) && field.value.status === "conditional" && field.value.conditions && field.value.conditions.length > 0 && (
            <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
              <p className="mb-1 font-medium text-muted-foreground">This requirement applies if:</p>
              <ul className="list-inside list-disc space-y-1">
                {field.value.conditions.map((c, i) => (
                  <li key={i}>
                    {i > 0 && <span className="mr-1 font-semibold uppercase text-xs text-muted-foreground">and</span>}
                    {c.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {source ? (
              <a href={field.sourceUrl ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                {field.sourceTitle ?? source.agencyName}
              </a>
            ) : (
              <span>{field.sourceTitle ?? "Source"}</span>
            )}
            {isSecondary && (
              <Badge variant="outline" className="border-warning text-warning">
                Secondary Source
              </Badge>
            )}
            {field.verifiedAt && <span>Checked {formatDate(field.verifiedAt)}</span>}
            <span>Confidence {Math.round(field.confidence * 100)}%</span>
          </div>
        </>
      )}
    </div>
  );
}
