import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { VerifiedField, SourceRecord } from "@/types/knowledge-base";

function isRequirementValue(value: unknown): value is { status: string; conditions?: { description: string; category: string }[] } {
  return typeof value === "object" && value !== null && "status" in (value as object);
}

const REQUIREMENT_STATUS_TEXT: Record<string, string> = {
  required: "Required",
  not_required: "Not Required",
  not_applicable: "Not Applicable",
  conditional: "Conditional",
  available: "Available",
  not_available: "Not Available",
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
  // Unknown fields are listed once on the page ("Not published by the board: ..."), not as rows.
  if (field.value === "Unknown") return null;
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
      </div>

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
          <span>
            Source:{" "}
            <a href={field.sourceUrl ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
              {source.agencyName}
            </a>
          </span>
        ) : (
          <span>Source: {field.sourceTitle ?? "not recorded"}</span>
        )}
        {isSecondary && (
          <Badge variant="outline" className="border-warning text-warning">
            Secondary Source
          </Badge>
        )}
        {field.verifiedAt && <span>Last researched {formatDate(field.verifiedAt)}</span>}
      </div>
    </div>
  );
}
