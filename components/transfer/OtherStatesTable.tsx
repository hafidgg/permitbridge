import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { portabilityLabel } from "@/lib/utils";
import type { TransferRule, State } from "@/types";

interface Row {
  rule: TransferRule;
  state: State;
}

export function OtherStatesTable({
  rows,
  professionSlug,
  originSlug,
  direction,
}: {
  rows: Row[];
  professionSlug: string;
  originSlug: string;
  direction: "from" | "to";
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">State</th>
            <th scope="col" className="px-4 py-3">Pathway</th>
            <th scope="col" className="px-4 py-3">Exam?</th>
            <th scope="col" className="px-4 py-3">Score</th>
            <th scope="col" className="px-4 py-3 sr-only">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ rule, state }) => {
            const { tone } = portabilityLabel(rule.portabilityScore);
            const href =
              direction === "from"
                ? `/transfer/${professionSlug}/${originSlug}/${state.slug}`
                : `/transfer/${professionSlug}/${state.slug}/${originSlug}`;
            return (
              <tr key={state.slug} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{state.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{rule.pathwayLabel}</td>
                <td className="px-4 py-3">{rule.examRequired ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      tone === "success"
                        ? "font-semibold text-success"
                        : tone === "warning"
                        ? "font-semibold text-warning"
                        : "font-semibold text-destructive"
                    }
                  >
                    {rule.portabilityScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={href} className="inline-flex items-center gap-1 text-primary hover:underline">
                    View <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
