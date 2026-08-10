import { CheckCircle2, HelpCircle } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import { MECHANISM_LABEL } from "@/lib/knowledge-base/transfer-rule-labels";
import type { TransferRule } from "@/types/transfer-rule";

const REQUIREMENT_STATUS_TEXT: Record<string, string> = {
  required: "Yes",
  not_required: "No",
  not_applicable: "Not applicable",
  conditional: "Depends — see conditions below",
};

function fmt(value: unknown, formatter?: (v: unknown) => string): string {
  if (value === "Unknown") return "Not yet confirmed";
  if (typeof value === "object" && value !== null && "status" in value) {
    const status = String((value as { status: unknown }).status);
    return REQUIREMENT_STATUS_TEXT[status] ?? status;
  }
  return formatter ? formatter(value) : String(value);
}

/**
 * Every statement here is read directly off the TransferRule object —
 * no prose is generated from imagination, per Step 3's explicit rule.
 */
export function QuickAnswer({ rule }: { rule: TransferRule }) {
  const mechanism = rule.transferMechanism.value === "Unknown" ? "unknown" : (rule.transferMechanism.value as string);

  const items: { question: string; answer: string }[] = [
    { question: "What mechanism applies?", answer: MECHANISM_LABEL[mechanism] ?? mechanism },
    { question: "Is an exam required?", answer: fmt(rule.examRequirement.value) },
    { question: "Is a new application required?", answer: mechanism === "compact_privilege" ? "A simplified compact application, not a full endorsement application — see details below." : "Yes, a licensure application to the destination state's board." },
    { question: "What does it cost?", answer: fmt(rule.applicationFeeUsd.value, (v) => formatUsd(v as number)) },
  ];

  const majorCondition =
    typeof rule.experienceRequirement.value === "object" &&
    rule.experienceRequirement.value !== null &&
    (rule.experienceRequirement.value as any).status === "conditional"
      ? (rule.experienceRequirement.value as any).conditions?.[0]?.description
      : null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6">
      <h2 className="mb-4 text-lg font-bold">Quick Answer</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.question} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="font-medium">{item.question}</span> {item.answer}
            </span>
          </li>
        ))}
        {majorCondition && (
          <li className="flex items-start gap-2 text-sm">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <span className="font-medium">Major condition to check:</span> {majorCondition}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
