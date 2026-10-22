import { CheckCircle2, HelpCircle } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import { MECHANISM_LABEL } from "@/lib/knowledge-base/transfer-rule-labels";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import type { TransferRule } from "@/types/transfer-rule";
import type { SourceRecord, VerifiedField } from "@/types/knowledge-base";

const REQUIREMENT_STATUS_TEXT: Record<string, string> = {
  required: "Yes",
  not_required: "No",
  not_applicable: "Not applicable",
  conditional: "Depends — see conditions below",
};

const NOT_PUBLISHED = "Not published by the board";

/** The field's source when it is a registered board source; a non-board (supplementary) or unregistered one doesn't count. */
function boardSource(field: VerifiedField<unknown>): SourceRecord | undefined {
  if (field.value === "Unknown" || !field.sourceUrl) return undefined;
  const source = getSourceByUrl(field.sourceUrl);
  return source && source.authorityLevel !== "supplementary" ? source : undefined;
}

function fmt(value: unknown, formatter?: (v: unknown) => string): string {
  if (typeof value === "object" && value !== null && "status" in value) {
    const status = String((value as { status: unknown }).status);
    return REQUIREMENT_STATUS_TEXT[status] ?? status;
  }
  return formatter ? formatter(value) : String(value);
}

/**
 * Every statement here is read directly off the TransferRule object —
 * no prose is generated from imagination, per Step 3's explicit rule.
 * Each figure names the board source it comes from; one without a board
 * source reads "Not published by the board".
 */
export function QuickAnswer({ rule }: { rule: TransferRule }) {
  const mechanism = rule.transferMechanism.value === "Unknown" ? "unknown" : (rule.transferMechanism.value as string);
  const mechanismSource = boardSource(rule.transferMechanism);

  const item = (question: string, field: VerifiedField<unknown>, answer: (v: unknown) => string, source = boardSource(field)) => ({
    question,
    answer: source ? answer(field.value) : NOT_PUBLISHED,
    source,
  });

  const items: { question: string; answer: string; source: SourceRecord | undefined }[] = [
    item("What mechanism applies?", rule.transferMechanism, () => MECHANISM_LABEL[mechanism] ?? mechanism, mechanismSource),
    item("Is an exam required?", rule.examRequirement, (v) => fmt(v)),
    item(
      "Is a new application required?",
      rule.transferMechanism,
      () => (mechanism === "compact_privilege" ? "A simplified compact application, not a full endorsement application — see details below." : "Yes, a licensure application to the destination state's board."),
      mechanismSource
    ),
    item("What does it cost?", rule.applicationFeeUsd, (v) => fmt(v, (n) => formatUsd(n as number))),
  ];

  const experienceSource = boardSource(rule.experienceRequirement);
  const majorCondition =
    experienceSource &&
    typeof rule.experienceRequirement.value === "object" &&
    rule.experienceRequirement.value !== null &&
    (rule.experienceRequirement.value as any).status === "conditional"
      ? ((rule.experienceRequirement.value as any).conditions?.[0]?.description as string | undefined)
      : null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6">
      <h2 className="mb-4 text-lg font-bold">Quick Answer</h2>
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.question} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="font-medium">{i.question}</span> {i.answer}
              {i.source && <SourceTag source={i.source} />}
            </span>
          </li>
        ))}
        {majorCondition && experienceSource && (
          <li className="flex items-start gap-2 text-sm">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <span className="font-medium">Major condition to check:</span> {majorCondition}
              <SourceTag source={experienceSource} />
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

function SourceTag({ source }: { source: SourceRecord }) {
  return (
    <span className="text-muted-foreground">
      {" "}
      (Source:{" "}
      <a href={source.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
        {source.agencyName}
      </a>
      )
    </span>
  );
}
