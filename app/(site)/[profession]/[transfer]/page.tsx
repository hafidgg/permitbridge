import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/badge";
import { EvidenceStatusBadge } from "@/components/transfer-knowledge-base/EvidenceStatusBadge";
import { QuickAnswer } from "@/components/transfer-knowledge-base/QuickAnswer";
import { RequirementRow } from "@/components/transfer-knowledge-base/RequirementRow";
import { TrustMethodologySection } from "@/components/transfer-knowledge-base/TrustMethodologySection";
import { ColoradoElectricianContent } from "@/components/electrician-state/ColoradoElectricianContent";
import { getAllPublicTransferRuleSlugs, getPublicTransferRule, getSourceByUrl, summarizeEvidence, CRITICAL_TRANSFER_RULE_FIELDS, ALL_TRANSFER_FIELD_KEYS } from "@/lib/knowledge-base/transfer-rule-data";
import { getColoradoElectricianPageData, getAllSingleStateProfessionSlugs } from "@/lib/knowledge-base/electrician-state-data";
import { getAllStates, getAllProfessions } from "@/lib/data";
import { FIELD_LABELS, MECHANISM_LABEL, stateDisplayName } from "@/lib/knowledge-base/transfer-rule-labels";
import { buildMetadata, articleJsonLd, faqJsonLd } from "@/lib/seo";
import { formatDate, formatUsd } from "@/lib/utils";
import type { TransferRule } from "@/types/transfer-rule";
import type { VerifiedField } from "@/types/knowledge-base";

// Per Step 17 ("No Mass Generation") and "no fabricated fallback pages":
// generateStaticParams returns ONLY the real records on disk, and
// dynamicParams=false makes Next.js 404 anything else automatically —
// there is no code path that can serve a 6th, non-existent transfer.
export const dynamicParams = false;

interface PageParams {
  profession: string;
  transfer: string;
}

/**
 * Phase 2D.4.2: this route now serves two genuinely different data
 * shapes at the same URL pattern — pairwise TransferRule pages (RN,
 * "texas-to-california") and single-state ProfessionStateFacts pages
 * (electrician, "colorado") — confirmed in Phase 2D.4/2D.4.1's
 * architecture review to be the only way to reach the required
 * /electrician/colorado URL through Next.js's existing route structure.
 * isSingleStateSlug() is the ONE guard everything below branches on;
 * every existing RN code path below it is completely untouched.
 */
function isSingleStateSlug(profession: string, transfer: string): boolean {
  return profession === "electrician" && transfer === "colorado";
}

export function generateStaticParams() {
  return [...getAllPublicTransferRuleSlugs().map((s) => ({ profession: s.profession, transfer: s.transfer })), ...getAllSingleStateProfessionSlugs().map((s) => ({ profession: s.profession, transfer: s.slug }))];
}

const stateName = stateDisplayName;

/**
 * The knowledge base tracks 50 states and a "registered-nurse" profession
 * slug; the LIVE site's simpler existing schema only has pages for 5
 * states and a "nurse" profession slug. Per Step 14 ("Only link to pages
 * that actually exist"), every internal link below is checked against
 * the live site's actual data before rendering — a state or profession
 * link is simply omitted, never guessed, if no live page exists for it.
 */
const LIVE_STATE_SLUGS = new Set(getAllStates().map((s) => s.slug));
const LIVE_PROFESSION_SLUG: Record<string, string> = Object.fromEntries(getAllProfessions().map((p) => [p.slug, p.slug]));
// "registered-nurse" (knowledge base) maps to the live site's "nurse" profession page, when it exists.
const LIVE_NURSE_PROFESSION_SLUG = LIVE_PROFESSION_SLUG["nurse"];

function loadRuleOr404(params: PageParams): TransferRule {
  const rule = getPublicTransferRule(params.profession, params.transfer);
  if (!rule) notFound();
  return rule;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const resolvedParams = await params;

  if (isSingleStateSlug(resolvedParams.profession, resolvedParams.transfer)) {
    const data = getColoradoElectricianPageData();
    if (!data) return {};
    return buildMetadata({
      title: "Colorado Electrician License Reciprocity — Journeyman vs. Master",
      description:
        "What it actually takes to reciprocate an out-of-state electrician license into Colorado — Journeyman and Master are genuinely different, sourced directly from the Colorado State Electrical Board.",
      path: `/${resolvedParams.profession}/${resolvedParams.transfer}`,
    });
  }

  const rule = getPublicTransferRule(resolvedParams.profession, resolvedParams.transfer);
  if (!rule) return {};
  const from = stateName(rule.sourceState);
  const to = stateName(rule.destinationState);
  const mechanism = rule.transferMechanism.value === "Unknown" ? "" : MECHANISM_LABEL[rule.transferMechanism.value as string];

  return buildMetadata({
    title: `Registered Nurse License Transfer: ${from} to ${to}`,
    description: `What it actually takes for a Registered Nurse licensed in ${from} to become licensed in ${to}${mechanism ? ` (${mechanism})` : ""} — sourced directly from official state licensing boards, with evidence and uncertainty shown clearly.`,
    path: `/${resolvedParams.profession}/${resolvedParams.transfer}`,
  });
}

export default async function TransferRulePage({ params }: { params: Promise<PageParams> }) {
  const resolvedParams = await params;

  if (isSingleStateSlug(resolvedParams.profession, resolvedParams.transfer)) {
    const data = getColoradoElectricianPageData();
    if (!data) notFound();
    return (
      <div>
        <Breadcrumbs
          items={[
            { name: "Professions", url: "/professions" },
            { name: "Electrician", url: "/profession/electrician" },
            { name: "Colorado", url: `/${resolvedParams.profession}/${resolvedParams.transfer}` },
          ]}
        />
        <JsonLd
          data={articleJsonLd({
            title: "Colorado Electrician License Reciprocity — Journeyman vs. Master",
            description: "What it actually takes to reciprocate an out-of-state electrician license into Colorado, by license tier.",
            path: `/${resolvedParams.profession}/${resolvedParams.transfer}`,
            publishedAt: "2026-08-25",
            updatedAt: "2026-08-25",
          })}
        />
        <ColoradoElectricianContent tiers={data.tiers} />
      </div>
    );
  }

  const rule = loadRuleOr404(resolvedParams);
  const summary = summarizeEvidence(rule);
  const from = stateName(rule.sourceState);
  const to = stateName(rule.destinationState);
  const mechanismValue = rule.transferMechanism.value === "Unknown" ? "unknown" : (rule.transferMechanism.value as string);

  const criticalFields = ALL_TRANSFER_FIELD_KEYS.filter((k) => CRITICAL_TRANSFER_RULE_FIELDS.includes(k));
  const supportingFields = ALL_TRANSFER_FIELD_KEYS.filter((k) => !CRITICAL_TRANSFER_RULE_FIELDS.includes(k));

  const otherTransfers = getAllPublicTransferRuleSlugs().filter((s) => s.transfer !== resolvedParams.transfer);

  const faqs = [
    { question: `Can a Registered Nurse transfer a license from ${from} to ${to}?`, answer: `Yes, via ${MECHANISM_LABEL[mechanismValue] ?? "a state-specific process"}. See the full requirements below — some details are still pending official confirmation.` },
    { question: `Is an exam required to transfer an RN license from ${from} to ${to}?`, answer: rule.examRequirement.value === "Unknown" ? "This has not been officially confirmed yet." : (rule.examRequirement.value as any).status === "required" ? "Yes, an exam is required." : "No new exam is required." },
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Professions", url: "/professions" },
          { name: "Registered Nurse", url: LIVE_NURSE_PROFESSION_SLUG ? `/profession/${LIVE_NURSE_PROFESSION_SLUG}` : "/professions" },
          { name: `${from} → ${to}`, url: `/${resolvedParams.profession}/${resolvedParams.transfer}` },
        ]}
      />
      <JsonLd
        data={articleJsonLd({
          title: `Registered Nurse License Transfer: ${from} to ${to}`,
          description: `Requirements for transferring an RN license from ${from} to ${to}.`,
          path: `/${resolvedParams.profession}/${resolvedParams.transfer}`,
          publishedAt: summary.earliestVerifiedAt ?? "2026-08-01",
          updatedAt: summary.latestVerifiedAt ?? "2026-08-01",
        })}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      <div className="container max-w-4xl pb-16">
        {/* Header */}
        <div className="mt-4">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {from} <span className="text-muted-foreground">→</span> {to}
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">Registered Nurse License Transfer</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{MECHANISM_LABEL[mechanismValue] ?? mechanismValue}</Badge>
            <EvidenceStatusBadge summary={summary} />
            {summary.earliestVerifiedAt && summary.latestVerifiedAt && (
              <span className="text-xs text-muted-foreground">
                {summary.earliestVerifiedAt === summary.latestVerifiedAt
                  ? `Last researched ${formatDate(summary.latestVerifiedAt)}`
                  : `Fields researched between ${formatDate(summary.earliestVerifiedAt)} and ${formatDate(summary.latestVerifiedAt)}`}
              </span>
            )}
          </div>
        </div>

        {/* Blocked notice */}
        {!summary.publishable && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold text-destructive">Some critical requirements are still awaiting authoritative verification.</p>
            <p className="mt-1 text-muted-foreground">
              The information below is shown for transparency, but one or more important requirements on this page currently rely on a source that
              hasn&apos;t yet been confirmed against an official state licensing board. Please verify those specific items directly with the
              destination state&apos;s board before relying on them.
            </p>
          </div>
        )}

        {/* Quick Answer */}
        <div className="mt-8">
          <QuickAnswer rule={rule} />
        </div>

        {/* Critical requirements */}
        <section className="mt-10">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Critical Requirements</h2>
          <p className="mb-4 text-sm text-muted-foreground">These are the requirements most likely to affect whether — and how — this transfer works.</p>
          <div className="rounded-xl border border-border px-6">
            {criticalFields.map((key) => (
              <RequirementRow
                key={key}
                label={FIELD_LABELS[key]}
                isCritical
                field={rule[key] as VerifiedField<unknown>}
                source={(rule[key] as VerifiedField<unknown>).sourceUrl ? getSourceByUrl((rule[key] as VerifiedField<unknown>).sourceUrl!) : undefined}
                valueFormatter={key === "applicationFeeUsd" ? (v) => formatUsd(v as number) : undefined}
              />
            ))}
          </div>
        </section>

        {/* Supporting requirements */}
        <section className="mt-10">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Additional Details</h2>
          <p className="mb-4 text-sm text-muted-foreground">Useful for planning, but less likely to change whether the transfer is possible.</p>
          <div className="rounded-xl border border-border px-6">
            {supportingFields.map((key) => (
              <RequirementRow
                key={key}
                label={FIELD_LABELS[key]}
                field={rule[key] as VerifiedField<unknown>}
                source={(rule[key] as VerifiedField<unknown>).sourceUrl ? getSourceByUrl((rule[key] as VerifiedField<unknown>).sourceUrl!) : undefined}
              />
            ))}
          </div>
        </section>

        {/* Trust & Methodology */}
        <div className="mt-10">
          <TrustMethodologySection />
        </div>

        {/* Internal navigation */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold">Explore Further</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {LIVE_NURSE_PROFESSION_SLUG && (
              <Link href={`/profession/${LIVE_NURSE_PROFESSION_SLUG}`} className="rounded-full border border-border px-4 py-2 hover:bg-muted">
                All Registered Nurse Info
              </Link>
            )}
            {LIVE_STATE_SLUGS.has(rule.sourceState) && (
              <Link href={`/state/${rule.sourceState}`} className="rounded-full border border-border px-4 py-2 hover:bg-muted">
                {from} Licensing
              </Link>
            )}
            {LIVE_STATE_SLUGS.has(rule.destinationState) && (
              <Link href={`/state/${rule.destinationState}`} className="rounded-full border border-border px-4 py-2 hover:bg-muted">
                {to} Licensing
              </Link>
            )}
          </div>
          {otherTransfers.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Other researched transfers:</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {otherTransfers.map((t) => (
                  <Link key={t.transfer} href={`/${t.profession}/${t.transfer}`} className="text-primary hover:underline">
                    {stateName(t.sourceState)} → {stateName(t.destinationState)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
