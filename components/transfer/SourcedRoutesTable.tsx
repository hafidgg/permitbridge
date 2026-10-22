import Link from "next/link";
import { formatUsd } from "@/lib/utils";
import type { SourcedRoute } from "@/lib/state-coverage";

/** Read-only summary of sourced routes; each row links to the full page and to the board the route cites. */
export function SourcedRoutesTable({ routes, showProfession = true }: { routes: SourcedRoute[]; showProfession?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Route</th>
            <th className="px-4 py-3 font-medium">Pathway</th>
            <th className="px-4 py-3 font-medium">State fee</th>
            <th className="px-4 py-3 font-medium">Exam</th>
            <th className="px-4 py-3 font-medium">Board cited</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.href} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <Link href={r.href} className="font-medium text-primary hover:underline">
                  {showProfession ? `${r.profession}: ` : ""}
                  {r.from} → {r.to}
                </Link>
              </td>
              <td className="px-4 py-3">{r.pathway}</td>
              <td className="px-4 py-3 whitespace-nowrap">{r.feeUsd !== null ? formatUsd(r.feeUsd) : r.feeHeld ? "Being re-checked" : "Not published by the board"}</td>
              <td className="px-4 py-3">{r.exam}</td>
              <td className="px-4 py-3">
                {r.board ? (
                  <a href={r.board.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                    {r.board.agencyName}
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
