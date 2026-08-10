import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FAQSection } from "@/components/home/FAQ";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfessionIcon } from "@/components/profession/ProfessionIcon";
import { portabilityLabel, formatDate } from "@/lib/utils";
import { getAllProfessions, getProfessionBySlug, getAllStates, getTransferRulesForProfession } from "@/lib/data";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export function generateStaticParams() {
  return getAllProfessions().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profession = getProfessionBySlug(slug);
  if (!profession) return {};
  return buildMetadata({
    title: `${profession.name} Reciprocity & Transfer Requirements by State`,
    description: profession.description,
    path: `/profession/${profession.slug}`,
  });
}

export default async function ProfessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profession = getProfessionBySlug(slug);
  if (!profession) notFound();

  const states = getAllStates();
  const rules = getTransferRulesForProfession(profession.slug);
  const relatedProfessions = getAllProfessions().filter((p) => profession.relatedProfessions.includes(p.slug));

  return (
    <div>
      <Breadcrumbs items={[{ name: "Professions", url: "/professions" }, { name: profession.shortName, url: `/profession/${profession.slug}` }]} />
      <JsonLd
        data={articleJsonLd({
          title: `${profession.name} Reciprocity & Transfer Requirements by State`,
          description: profession.description,
          path: `/profession/${profession.slug}`,
          publishedAt: profession.updatedAt,
          updatedAt: profession.updatedAt,
        })}
      />

      <div className="container pb-16">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ProfessionIcon name={profession.icon} className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{profession.name}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{profession.longDescription}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">Category: {profession.category}</Badge>
          <Badge variant="outline">
            Typical transfer: {profession.averageTransferDays[0]}–{profession.averageTransferDays[1]} days
          </Badge>
          {profession.hasNationalCompact && <Badge variant="success">{profession.compactName}</Badge>}
          <Badge variant="outline">Updated {formatDate(profession.updatedAt)}</Badge>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">
            Pick Your Move: {profession.shortName} License Transfers
          </h2>
          <p className="mb-6 max-w-2xl text-muted-foreground">
            Select where you're licensed now and where you're headed to see the exact pathway, exam requirements, and
            processing time.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {states.map((fromState) => (
              <Card key={fromState.slug}>
                <CardContent className="pt-6">
                  <p className="mb-3 font-semibold">From {fromState.name}</p>
                  <ul className="space-y-2">
                    {states
                      .filter((s) => s.slug !== fromState.slug)
                      .map((toState) => {
                        const rule = rules.find((r) => r.fromState === fromState.slug && r.toState === toState.slug);
                        if (!rule) return null;
                        const { tone } = portabilityLabel(rule.portabilityScore);
                        return (
                          <li key={toState.slug}>
                            <Link
                              href={`/transfer/${profession.slug}/${fromState.slug}/${toState.slug}`}
                              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                            >
                              <span className="flex items-center gap-1.5">
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                {toState.name}
                              </span>
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
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {relatedProfessions.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold tracking-tight">Related Professions</h2>
            <div className="flex flex-wrap gap-3">
              {relatedProfessions.map((rp) => (
                <Link key={rp.slug} href={`/profession/${rp.slug}`}>
                  <Badge variant="outline" className="px-4 py-2 text-sm">
                    {rp.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <FAQSection faqs={profession.faqs} title={`${profession.shortName} License FAQs`} />
    </div>
  );
}
