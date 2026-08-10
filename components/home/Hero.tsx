import { SearchBox } from "@/components/home/SearchBox";
import type { SearchDocument } from "@/types";

export function Hero({ searchIndex }: { searchIndex: SearchDocument[] }) {
  return (
    <section className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
      <div className="container flex flex-col items-center py-16 text-center md:py-24">
        <span className="mb-4 inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          Free · Independent · Updated Continuously
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Know exactly what it takes to move your license.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          PermitBridge is the free reference for transferring professional and trade licenses between US states —
          reciprocity, endorsement, exams, fees, and realistic timelines, in one place.
        </p>

        <div className="mt-8 w-full max-w-xl">
          <SearchBox searchIndex={searchIndex} placeholder="Try “electrician Texas to Florida”" />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Covering 5 professions across 5 states today — expanding every month.
        </p>
      </div>
    </section>
  );
}
