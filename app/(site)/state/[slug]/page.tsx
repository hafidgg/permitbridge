import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FAQSection } from "@/components/home/FAQ";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfessionIcon } from "@/components/profession/ProfessionIcon";
import { formatDate } from "@/lib/utils";
import { getAllStates, getStateBySlug, getAllProfessions } from "@/lib/data";
import { getTransferPageRules } from "@/lib/publishable-transfers";
import { getIndexableTradeStateSummaries } from "@/lib/trade-state-summary";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { SourcedRoutesTable } from "@/components/transfer/SourcedRoutesTable";
import { getStateCoverage } from "@/lib/state-coverage";

export function generateStaticParams() {
  return getAllStates().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) return {};
  return buildMetadata({
    title: `${state.name} Professional License Reciprocity & Transfer Rules`,
    description: `Everything professionals need to know about transferring a license into or out of ${state.name}: licensing authority and profession-by-profession rules.`,
    path: `/state/${state.slug}`,
  });
}

export default async function StatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) notFound();

  const professions = getAllProfessions();
  // Only pairs that still have their own /transfer page are counted; consolidated ones live on the summary page.
  const allRules = getTransferPageRules();
  const summaries = getIndexableTradeStateSummaries().filter((s) => s.destination.slug === state.slug);
  const coverage = getStateCoverage(state.slug, state.name);

  return (
    <div>
      <Breadcrumbs items={[{ name: "States", url: "/states" }, { name: state.name, url: `/state/${state.slug}` }]} />
      <JsonLd
        data={articleJsonLd({
          title: `${state.name} Professional License Reciprocity & Transfer Rules`,
          description: state.licensingAuthorityNote,
          path: `/state/${state.slug}`,
          publishedAt: state.updatedAt,
          updatedAt: state.updatedAt,
        })}
      />

      <div className="container pb-16">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{state.name}</h1>
          {state.isUlrState && <Badge variant="success">Universal License Recognition ({state.ulrEnactedYear})</Badge>}
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground">{state.licensingAuthorityNote}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Updated {formatDate(state.updatedAt)}</span>
          {state.sourceUrl && (
            <a
              href={state.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-foreground hover:bg-muted"
            >
              Official source ↗
            </a>
          )}
        </div>

        <section className="mt-12">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">License Transfers Into {state.name}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {professions.map((profession) => {
              const rulesIntoState = allRules.filter((r) => r.profession === profession.slug && r.toState === state.slug);
              const summary = summaries.find((s) => s.profession === profession.slug);
              if (rulesIntoState.length === 0 && !summary) return null;
              const pages = rulesIntoState.length > 0 ? `${rulesIntoState.length} transfer ${rulesIntoState.length === 1 ? "page" : "pages"}` : null;
              return (
                <Link key={profession.slug} href={summary ? `/${profession.slug}/${state.slug}` : `/profession/${profession.slug}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-3 pt-6">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ProfessionIcon name={profession.icon} className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{profession.shortName}</p>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {summary
                            ? [`Summary for ${summary.pairs.length} origin ${summary.pairs.length === 1 ? "state" : "states"}`, pages].filter(Boolean).join(" · ")
                            : pages}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {coverage.into.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Sourced Routes Into {state.name}</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              Moving a license into {state.name} is decided by the {state.name} board, not by the state you are leaving. These{" "}
              {coverage.into.length} routes are each read from the {state.name} board document named in the last column; open a route for its
              full step-by-step requirements.
            </p>
            <SourcedRoutesTable routes={coverage.into} />
          </section>
        )}

        {coverage.outOf.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Sourced Routes From {state.name} to Other States</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              If you hold a {state.name} license and are moving away, the destination state&apos;s board sets the rules. These{" "}
              {coverage.outOf.length} routes start from a {state.name} license; the board cited is the destination state&apos;s.
            </p>
            <SourcedRoutesTable routes={coverage.outOf} />
          </section>
        )}

        {coverage.statePages.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold tracking-tight">{state.name} License Pages by Profession</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {coverage.statePages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="text-primary hover:underline">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {coverage.boards.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-2 text-xl font-bold tracking-tight">{state.name} Boards and Documents We Cite</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              Check fees and forms with these sources before you apply; they are the documents the routes above are read from.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {coverage.boards.map((b) => (
                <li key={b.website}>
                  <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                    {b.agencyName}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <FAQSection faqs={state.faqs} title={`${state.name} Licensing FAQs`} />
    </div>
  );
}
