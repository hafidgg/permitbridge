import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FAQSection } from "@/components/home/FAQ";
import { PortabilityScoreCard } from "@/components/transfer/PortabilityScoreCard";
import { StepsList } from "@/components/transfer/StepsList";
import { OtherStatesTable } from "@/components/transfer/OtherStatesTable";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  getAllProfessions,
  getAllStates,
  getProfessionBySlug,
  getStateBySlug,
  getTransferRule,
  getTransferRulesForProfession,
} from "@/lib/data";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

interface TransferParams {
  profession: string;
  from: string;
  to: string;
}

export function generateStaticParams() {
  const professions = getAllProfessions();
  const states = getAllStates();
  const params: TransferParams[] = [];

  for (const profession of professions) {
    for (const from of states) {
      for (const to of states) {
        if (from.slug === to.slug) continue;
        params.push({ profession: profession.slug, from: from.slug, to: to.slug });
      }
    }
  }
  return params;
}

function loadPageData(params: TransferParams) {
  const profession = getProfessionBySlug(params.profession);
  const from = getStateBySlug(params.from);
  const to = getStateBySlug(params.to);
  if (!profession || !from || !to) return null;
  const rule = getTransferRule(params.profession, params.from, params.to);
  if (!rule) return null;
  return { profession, from, to, rule };
}

export async function generateMetadata({ params }: { params: Promise<TransferParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = loadPageData(resolvedParams);
  if (!data) return {};
  const { profession, from, to, rule } = data;
  return buildMetadata({
    title: `${profession.shortName} License: Transfer From ${from.name} to ${to.name}`,
    description: `${rule.pathwayLabel} — ${rule.examRequired ? "exam required" : "no exam required"}, est. ${rule.estimatedProcessingDays[0]}-${rule.estimatedProcessingDays[1]} days, ${rule.feeUsd} USD fee. Full step-by-step guide for ${profession.shortName.toLowerCase()}s moving from ${from.name} to ${to.name}.`,
    path: `/transfer/${profession.slug}/${from.slug}/${to.slug}`,
    // Content-trust hardening: a page whose figures were never individually
    // confirmed against a live official source (no sourceUrl) shouldn't be
    // actively submitted to Google for indexing — it stays reachable via
    // direct link/navigation, but isn't presented to search as an
    // authoritative answer until it has real, checkable sourcing. Mirrors
    // the sitemap's own exclusion of these same records (app/sitemap.ts).
    noIndex: !rule.sourceUrl,
  });
}

export default async function TransferPage({ params }: { params: Promise<TransferParams> }) {
  const resolvedParams = await params;
  const data = loadPageData(resolvedParams);
  if (!data) notFound();
  const { profession, from, to, rule } = data;

  const professionRules = getTransferRulesForProfession(profession.slug);
  const otherDestinations = getAllStates()
    .filter((s) => s.slug !== from.slug && s.slug !== to.slug)
    .map((s) => ({ state: s, rule: professionRules.find((r) => r.fromState === from.slug && r.toState === s.slug)! }))
    .filter((row) => row.rule);

  const pageFaqs = [
    {
      question: `Can I transfer my ${profession.shortName.toLowerCase()} license from ${from.name} to ${to.name}?`,
      answer: `Yes, via ${rule.pathwayLabel.toLowerCase()}. ${rule.examRequired ? `You will need to pass ${rule.examName ?? "a state exam"}.` : "No additional trade exam is required in most cases."} Processing typically takes ${rule.estimatedProcessingDays[0]}-${rule.estimatedProcessingDays[1]} days.`,
    },
    {
      question: `How much does it cost to transfer a ${profession.shortName.toLowerCase()} license to ${to.name}?`,
      answer: `Budget approximately $${rule.feeUsd} for the ${to.name} application fee alone. Exam fees, if required, and any additional continuing-education hours are typically separate costs charged by third-party providers.`,
    },
    ...profession.faqs.slice(0, 1),
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Professions", url: "/professions" },
          { name: profession.shortName, url: `/profession/${profession.slug}` },
          { name: `${from.abbreviation} → ${to.abbreviation}`, url: `/transfer/${profession.slug}/${from.slug}/${to.slug}` },
        ]}
      />
      <JsonLd
        data={articleJsonLd({
          title: `${profession.shortName} License: Transfer From ${from.name} to ${to.name}`,
          description: rule.notes,
          path: `/transfer/${profession.slug}/${from.slug}/${to.slug}`,
          publishedAt: rule.updatedAt,
          updatedAt: rule.updatedAt,
        })}
      />

      <div className="container pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {profession.shortName} License: {from.name} → {to.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          A step-by-step breakdown of what it takes for a licensed {profession.shortName.toLowerCase()} in {from.name}{" "}
          to become licensed in {to.name}, based on {to.name}'s current {rule.pathwayLabel.toLowerCase()} rules.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{rule.pathwayLabel}</Badge>
          {rule.sourceUrl ? (
            <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
              <Badge variant="outline" className="hover:bg-muted">
                Source: {rule.officialSourceName} ↗
              </Badge>
            </a>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
              Estimated — pending official source verification
            </Badge>
          )}
          <Badge variant="outline">Updated {formatDate(rule.updatedAt)}</Badge>
        </div>
        {!rule.sourceUrl && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            The figures on this page are current best estimates and have not yet been individually confirmed against an
            official {to.name} licensing source. Always verify exact fees, exam requirements, and processing times directly
            with {to.name}&apos;s licensing authority before relying on them.
          </p>
        )}

        <div className="mt-8">
          <PortabilityScoreCard rule={rule} />
        </div>

        <section className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-6 text-2xl font-bold tracking-tight">Step-by-Step Process</h2>
            <StepsList steps={rule.steps} />

            <div className="mt-8 rounded-lg border border-border bg-muted/30 p-6 text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Note: </strong>
              {rule.notes}
            </div>
          </div>

          <aside className="rounded-lg border border-border p-6">
            <h3 className="mb-4 font-semibold">Quick Facts</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Minimum years licensed</dt>
                <dd className="font-medium">{rule.minimumYearsLicensed || "None"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Difficulty</dt>
                <dd className="font-medium">{rule.difficultyScore}/10</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pathway type</dt>
                <dd className="font-medium capitalize">{rule.pathway}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">
            {profession.shortName} Transfers From {from.name} to Other States
          </h2>
          <OtherStatesTable rows={otherDestinations} professionSlug={profession.slug} originSlug={from.slug} direction="from" />
        </section>
      </div>

      <FAQSection faqs={pageFaqs} title="Frequently Asked Questions About This Transfer" />
    </div>
  );
}
