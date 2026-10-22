import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { TransferRule, State } from "@/types";
import { transferHref } from "@/lib/publishable-transfers";

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
            <th scope="col" className="px-4 py-3 sr-only">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ rule, state }) => {
            // A consolidated pair is read on its destination summary page, not its old (redirected) URL.
            const href = transferHref(
              direction === "from"
                ? { profession: professionSlug, fromState: originSlug, toState: state.slug }
                : { profession: professionSlug, fromState: state.slug, toState: originSlug }
            );
            return (
              <tr key={state.slug} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{state.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{rule.pathwayLabel}</td>
                <td className="px-4 py-3">{rule.examRequired ? "Yes" : "No"}</td>
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
