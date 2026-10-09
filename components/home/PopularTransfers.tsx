import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TransferRule, Profession, State } from "@/types";

interface EnrichedTransfer {
  rule: TransferRule;
  profession: Profession;
  from: State;
  to: State;
}

export function PopularTransfers({ transfers }: { transfers: EnrichedTransfer[] }) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Recently Verified License Transfers</h2>
          <p className="mt-2 text-muted-foreground">
            Transfer guides checked against the official licensing source each one cites, most recently updated first.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {transfers.map(({ rule, profession, from, to }) => {
            return (
              <Link key={`${rule.profession}-${rule.fromState}-${rule.toState}`} href={`/transfer/${profession.slug}/${from.slug}/${to.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <p className="font-semibold">{profession.shortName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      {from.abbreviation} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> {to.abbreviation}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
