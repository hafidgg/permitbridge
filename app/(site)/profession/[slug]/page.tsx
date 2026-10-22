import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FAQSection } from "@/components/home/FAQ";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfessionIcon } from "@/components/profession/ProfessionIcon";
import { formatDate, inSentence } from "@/lib/utils";
import { getAllProfessions, getProfessionBySlug, getAllStates, getGuideBySlug, NURSE_TRANSFER_GUIDE_SLUG } from "@/lib/data";
import { getTransferPageRules } from "@/lib/publishable-transfers";
import { getAllPublicTransferRuleSlugs } from "@/lib/knowledge-base/transfer-rule-data";
import { getAllSingleStateProfessionSlugs, getElectricianStatePageData } from "@/lib/knowledge-base/electrician-state-data";
import { getIndexableTradeStateSummaries } from "@/lib/trade-state-summary";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { SourcedRoutesTable } from "@/components/transfer/SourcedRoutesTable";
import { getAllSourcedRoutes } from "@/lib/state-coverage";

function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
  // Pairs with their own page; consolidated pairs are reached through the destination summary links.
  const rules = getTransferPageRules().filter((r) => r.profession === profession.slug);
  const relatedProfessions = getAllProfessions().filter((p) => profession.relatedProfessions.includes(p.slug));
  // Internal-linking fix: the old-pipeline "nurse" profession and the
  // knowledge-base's "registered-nurse" verified transfer pages use
  // different slugs and were never cross-linked anywhere in the site —
  // confirmed via a full link-graph audit, these 5 real, sourced pages had
  // zero incoming links from anywhere a real visitor could reach. They're
  // genuinely better-sourced content about the same real-world need this
  // page's own visitors have, so linking them here is honest, not filler.
  const verifiedNurseTransfers = profession.slug === "nurse" ? getAllPublicTransferRuleSlugs() : [];
  const nurseTransferGuide = profession.slug === "nurse" ? getGuideBySlug(NURSE_TRANSFER_GUIDE_SLUG) : undefined;
  // Same link-graph gap as the RN case above: the knowledge-base's real,
  // sourced electrician single-state pages (/electrician/{state}) were
  // never linked from this hub either — generateStaticParams/sitemap.ts
  // both discover them via getAllSingleStateProfessionSlugs(), but this
  // page still only rendered the old-pipeline state x state transfer grid,
  // so every one of these pages (Colorado through Utah) had zero incoming
  // links a real visitor could follow to reach them.
  const electricianStatePages = (profession.slug === "electrician" ? getAllSingleStateProfessionSlugs() : []).map((s) => {
    // licensingBoard and licenseTransferPage are shown only when the fact is confidenceLevel "verified".
    const facts = getElectricianStatePageData(s.slug)?.tiers.find((t) => t.tier === "journeyman")?.facts;
    const verified = (f: { value: unknown; confidenceLevel?: string } | undefined) =>
      f && f.value !== "Unknown" && f.confidenceLevel === "verified" ? String(f.value) : null;
    return { ...s, board: verified(facts?.licensingBoard), transferPage: verified(facts?.licenseTransferPage) };
  });
  const tradeStateSummaries = getIndexableTradeStateSummaries().filter((s) => s.profession === profession.slug);
  const sourcedRoutes = getAllSourcedRoutes().filter((r) => r.professionSlug === profession.slug);
  const citedBoards = [...new Map(sourcedRoutes.flatMap((r) => (r.board ? [[r.board.agencyName, r.board] as const] : []))).values()];

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
          {profession.hasNationalCompact && <Badge variant="success">{profession.compactName}</Badge>}
          <Badge variant="outline">Updated {formatDate(profession.updatedAt)}</Badge>
          {profession.sourceUrl && (
            <a href={profession.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
              <Badge variant="outline" className="hover:bg-muted">
                Official source ↗
              </Badge>
            </a>
          )}
        </div>

        {rules.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">
            Pick Your Move: {profession.shortName} License Transfers
          </h2>
          <p className="mb-6 max-w-2xl text-muted-foreground">
            Select where you're licensed now and where you're headed to see the pathway, exam requirement and fee, each
            read from the destination state's board.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {states.filter((fromState) => rules.some((r) => r.fromState === fromState.slug)).map((fromState) => (
              <Card key={fromState.slug}>
                <CardContent className="pt-6">
                  <p className="mb-3 font-semibold">From {fromState.name}</p>
                  <ul className="space-y-2">
                    {states
                      .filter((s) => s.slug !== fromState.slug)
                      .map((toState) => {
                        const rule = rules.find((r) => r.fromState === fromState.slug && r.toState === toState.slug);
                        if (!rule) return null;
                        return (
                          <li key={toState.slug}>
                            <Link
                              href={`/transfer/${profession.slug}/${fromState.slug}/${toState.slug}`}
                              className="flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                            >
                              <span className="flex items-center gap-1.5">
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                {toState.name}
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
        )}

        {verifiedNurseTransfers.length > 0 && (
          <section className="mt-12 rounded-xl border border-border bg-muted/20 p-6">
            <h2 className="mb-2 text-xl font-bold tracking-tight">RN State-to-State Transfer Pages</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              Each page reads its requirements from the destination state&apos;s board of nursing where the board publishes them, and shows the
              source and research date for every requirement.
            </p>
            {nurseTransferGuide && (
              <p className="mb-4 max-w-2xl text-sm">
                New to the process? Start with{" "}
                <Link href={`/guides/${nurseTransferGuide.slug}`} className="font-medium underline underline-offset-4">
                  {nurseTransferGuide.title}
                </Link>{" "}
                — compact vs. endorsement, the NLC 60-day rule, and Nursys verification.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {verifiedNurseTransfers.map((t) => {
                const fromName = states.find((s) => s.slug === t.sourceState)?.name ?? t.sourceState;
                const toName = states.find((s) => s.slug === t.destinationState)?.name ?? t.destinationState;
                return (
                  <Link key={t.transfer} href={`/${t.profession}/${t.transfer}`}>
                    <Badge variant="outline" className="px-4 py-2 text-sm hover:bg-muted">
                      {fromName} → {toName}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {electricianStatePages.length > 0 && (
          <section className="mt-12 rounded-xl border border-border bg-muted/20 p-6">
            <h2 className="mb-2 text-xl font-bold tracking-tight">Electrician License Reciprocity by State</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              Journeyman and Master requirements researched and sourced separately for each state below, since the two tiers often follow
              different rules.
            </p>
            <ul className="space-y-2 text-sm">
              {electricianStatePages.map((s) => (
                <li key={s.slug}>
                  <Link href={`/${s.profession}/${s.slug}`} className="font-medium text-primary hover:underline">
                    {toTitleCase(s.slug)} electrician reciprocity
                  </Link>
                  {s.board && <span className="text-muted-foreground"> — licensed by the {s.board}</span>}
                  {s.transferPage && (
                    <>
                      {" "}
                      (
                      <a href={s.transferPage} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                        board&apos;s transfer information
                      </a>
                      )
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tradeStateSummaries.length > 0 && (
          <section className="mt-12 rounded-xl border border-border bg-muted/20 p-6">
            <h2 className="mb-2 text-xl font-bold tracking-tight">{profession.shortName} License Transfer by Destination State</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              What it takes to move an existing license into each state, built only from state pairs sourced directly from the destination board.
            </p>
            <div className="flex flex-wrap gap-3">
              {tradeStateSummaries.map((s) => (
                <Link key={s.destination.slug} href={`/${s.profession}/${s.destination.slug}`}>
                  <Badge variant="outline" className="px-4 py-2 text-sm hover:bg-muted">
                    {s.destination.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        {sourcedRoutes.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-2 text-xl font-bold tracking-tight">{profession.shortName} Routes at a Glance</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              Every {inSentence(profession.shortName)} route we have sourced, with the destination board&apos;s pathway, state fee and exam
              requirement. The fee is the destination board&apos;s published application or licensing fee for that route; open a route for the full
              breakdown and steps.
            </p>
            <SourcedRoutesTable routes={sourcedRoutes} showProfession={false} />
            {citedBoards.length > 0 && (
              <>
                <p className="mb-2 mt-6 text-sm font-medium">Boards these routes are read from</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {citedBoards.map((b) => (
                    <li key={b.agencyName}>
                      <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                        {b.agencyName}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

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
