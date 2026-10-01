import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/badge";
import { articleJsonLd, buildMetadata } from "@/lib/seo";
import { formatUsd, PROCESSING_TIME_NOT_PUBLISHED } from "@/lib/utils";
import { getTradeStateSummary, type TradeStateSummary, type TradeSummaryProfession } from "@/lib/trade-state-summary";
import type { PathwayType } from "@/types";

const PROFESSION_LABEL: Record<TradeSummaryProfession, { title: string; noun: string; article: string }> = {
  "hvac-technician": { title: "HVAC", noun: "HVAC contractor", article: "an" },
  plumber: { title: "Plumber", noun: "plumbing", article: "a" },
};

const PATHWAY_SUMMARY: Record<PathwayType, string> = {
  none: "No reciprocity — a full application is required",
  endorsement: "Endorsement of an out-of-state license",
  reciprocity: "Reciprocity",
  comity: "Comity",
  compact: "Interstate compact",
};

function titleFor(s: TradeStateSummary): string {
  return `${s.destination.name} ${PROFESSION_LABEL[s.profession].title} License Reciprocity & Transfer`;
}

function descriptionFor(s: TradeStateSummary): string {
  const origins = s.pairs.map((p) => p.origin.name).join(", ");
  const route = s.shared ? `${PATHWAY_SUMMARY[s.shared.pathway]}, ${formatUsd(s.shared.feeUsd)} in fees, ${s.shared.examRequired ? "exam required" : "no exam"}. ` : "";
  return `Transferring an existing ${PROFESSION_LABEL[s.profession].noun} license into ${s.destination.name}: ${route}Sourced from the ${s.destination.name} board, with details for licenses from ${origins}.`;
}

export function tradeStateMetadata(profession: TradeSummaryProfession, state: string): Metadata {
  const s = getTradeStateSummary(profession, state);
  if (!s) return {};
  return buildMetadata({
    title: titleFor(s),
    description: descriptionFor(s),
    path: `/${profession}/${state}`,
    noIndex: s.pairs.length === 0,
  });
}

export function TradeStateSummaryPage({ profession, state }: { profession: TradeSummaryProfession; state: string }) {
  const s = getTradeStateSummary(profession, state);
  if (!s) notFound();
  const label = PROFESSION_LABEL[profession];
  const path = `/${profession}/${state}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Professions", url: "/professions" },
          { name: label.title, url: `/profession/${profession}` },
          { name: s.destination.name, url: path },
        ]}
      />
      <JsonLd data={articleJsonLd({ title: titleFor(s), description: descriptionFor(s), path, publishedAt: "2026-10-01", updatedAt: s.lastUpdated || "2026-10-01" })} />

      <div className="container max-w-4xl pb-16">
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{titleFor(s)}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          What it takes to transfer {label.article} {label.noun} license you already hold in another state into {s.destination.name}. This page covers
          license transfer only — not how to get licensed from scratch.
        </p>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">Transferring an existing license into {s.destination.name}</h2>
          {s.shared ? (
            <div className="rounded-lg border border-border p-6">
              <p className="mb-4 text-sm text-muted-foreground">
                {s.destination.name}&apos;s board sets the route, so it is the same for every origin state we have verified below.
              </p>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Pathway</dt>
                  <dd className="font-semibold">{PATHWAY_SUMMARY[s.shared.pathway]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fees</dt>
                  <dd className="font-semibold">{formatUsd(s.shared.feeUsd)}</dd>
                </div>
                {s.shared.minimumYearsLicensed > 0 && (
                  <div>
                    <dt className="text-muted-foreground">Minimum years licensed</dt>
                    <dd className="font-semibold">{s.shared.minimumYearsLicensed}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Exam</dt>
                  <dd className="font-semibold">{s.shared.examRequired ? "Required" : "Not required"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Processing time</dt>
                  <dd className="font-semibold">{PROCESSING_TIME_NOT_PUBLISHED}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Fees are the state fees recorded for this route; see each origin&apos;s full requirements for the breakdown.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Source:{" "}
                <a href={s.shared.source.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                  {s.shared.source.agencyName}
                </a>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The route differs by origin state, so it is shown separately for each one below. Processing time: {PROCESSING_TIME_NOT_PUBLISHED.toLowerCase()}.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">By origin state</h2>
          <div className="space-y-4">
            {s.pairs.map((p) => (
              <div key={p.origin.slug} className="rounded-lg border border-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    From {p.origin.name} <span className="text-muted-foreground">→</span> {s.destination.name}
                  </h3>
                  <Link href={`/transfer/${profession}/${p.origin.slug}/${state}`} className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
                    Full requirements <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-2 text-sm">{p.rule.pathwayLabel}</p>
                {!s.shared && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatUsd(p.rule.feeUsd)} in fees · {p.rule.examRequired ? "exam required" : "no exam"}
                  </p>
                )}
                {p.openQuestions.length > 0 && (
                  <div className="mt-3">
                    <Badge variant="outline">Open question{p.openQuestions.length > 1 ? "s" : ""} for {p.origin.name} licenses</Badge>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {p.openQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {s.unverifiedOrigins.length > 0 && (
          <section className="mt-10 rounded-lg border border-dashed border-border p-5">
            <h2 className="mb-2 text-lg font-bold">Not yet researched</h2>
            <p className="text-sm text-muted-foreground">
              We haven&apos;t published sourced requirements for transferring {label.article} {label.noun} license into {s.destination.name} from:{" "}
              <strong className="text-foreground">{s.unverifiedOrigins.map((o) => o.name).join(", ")}</strong>. Rather than guess, we leave these
              out until we can cite the board directly — check with the {s.destination.name} board in the meantime.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
