import { formatProcessingTime, formatUsd } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, DollarSign, GraduationCap } from "lucide-react";
import type { TransferRule } from "@/types";

export function TransferFactsCard({ rule }: { rule: TransferRule }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="flex flex-col items-start gap-1">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {rule.examRequired ? <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
            Exam
          </dt>
          <dd className="text-sm font-semibold">{rule.examRequired ? "Required" : "Not required"}</dd>
        </div>
        <div className="flex flex-col items-start gap-1">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Processing
          </dt>
          <dd className="text-sm font-semibold">{formatProcessingTime(rule)}</dd>
        </div>
        <div className="flex flex-col items-start gap-1">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" aria-hidden="true" /> Fee
          </dt>
          <dd className="text-sm font-semibold">{formatUsd(rule.feeUsd)}</dd>
        </div>
        <div className="flex flex-col items-start gap-1">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Extra Hours
          </dt>
          <dd className="text-sm font-semibold">{rule.additionalHoursRequired > 0 ? `${rule.additionalHoursRequired}h` : "None"}</dd>
        </div>
      </dl>
    </div>
  );
}
