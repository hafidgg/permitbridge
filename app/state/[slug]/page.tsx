import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FAQSection } from "@/components/home/FAQ";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfessionIcon } from "@/components/profession/ProfessionIcon";
import { portabilityLabel, formatDate } from "@/lib/utils";
import { getAllStates, getStateBySlug, getAllProfessions, getAllTransferRules } from "@/lib/data";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export function generateStaticParams() {
  return getAllStates().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) return {};
  return buildMetadata({
    title: `${state.name} Professional License Reciprocity & Transfer Rules`,
    description: `Everything professionals need to know about transferring a license into or out of ${state.name}: licensing authority, Universal License Recognition status, and profession-by-profession rules.`,
    path: `/state/${state.slug}`,
  });
}

export default async function StatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) notFound();

  const professions = getAllProfessions();
  const allRules = getAllTransferRules();

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
        <p className="mt-4 text-xs text-muted-foreground">Updated {formatDate(state.updatedAt)}</p>

        <section className="mt-12">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">License Transfers Into {state.name}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {professions.map((profession) => {
              const rulesIntoState = allRules.filter((r) => r.profession === profession.slug && r.toState === state.slug);
              const avgScore = Math.round(
                rulesIntoState.reduce((sum, r) => sum + r.portabilityScore, 0) / (rulesIntoState.length || 1)
              );
              const { label, tone } = portabilityLabel(avgScore);
              return (
                <Link key={profession.slug} href={`/profession/${profession.slug}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-3 pt-6">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ProfessionIcon name={profession.icon} className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{profession.shortName}</p>
                        <Badge variant={tone} className="mt-1.5">
                          {label} (avg {avgScore}/100)
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <FAQSection faqs={state.faqs} title={`${state.name} Licensing FAQs`} />
    </div>
  );
}
