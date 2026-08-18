import { Badge } from "@/components/ui/badge";
import { portabilityLabel, formatDayRange, formatUsd } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, DollarSign, GraduationCap } from "lucide-react";
import type { TransferRule } from "@/types";

export function PortabilityScoreCard({ rule }: { rule: TransferRule }) {
  const { label, tone } = portabilityLabel(rule.portabilityScore);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Portability Score</p>
          <p className="text-5xl font-bold tracking-tight">
            {rule.portabilityScore}
            <span className="text-xl font-medium text-muted-foreground">/100</span>
          </p>
        </div>
        <Badge variant={tone} className="text-sm">
          {label}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        PermitBridge&apos;s own estimate, based on the exam, fee, and processing-time factors below — not an official
        government rating.
      </p>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            tone === "success" ? "h-full bg-success" : tone === "warning" ? "h-full bg-warning" : "h-full bg-destructive"
          }
          style={{ width: `${rule.portabilityScore}%` }}
        />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
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
          <dd className="text-sm font-semibold">{formatDayRange(rule.estimatedProcessingDays)}</dd>
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
