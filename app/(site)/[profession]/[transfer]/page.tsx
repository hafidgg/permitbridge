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
import { getElectricianStatePageData, getAllSingleStateProfessionSlugs, SUPPORTED_ELECTRICIAN_STATES } from "@/lib/knowledge-base/electrician-state-data";
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

/**
 * Phase 2D.7.3 — cache/ISR protection, added after a real production
 * incident (Phase 2D.7.1): Vercel's Edge/CDN served stale HTML for
 * /electrician/colorado for roughly 15+ minutes after a successful
 * deploy, resolved only by a manual Redeploy. This mirrors the same
 * protection already applied to app/sitemap.ts (Phase 2D.5.2) for the
 * same reason.
 *
 * IMPORTANT — what this does NOT do:
 * The licensing data this route renders (data/knowledge-base/facts/...
 * and data/knowledge-base/sources/...) is BUILD-TIME data — it is
 * bundled into the deployment artifact at `next build`, not fetched
 * live at request time. Setting revalidate = 3600 does NOT mean these
 * JSON files "update themselves" after an hour, and it will NEVER show
 * a licensing-rule change that hasn't also gone through a real
 * deployment. A genuine fact change always requires, in order: editing
 * the data, running the test suite, `git commit`, `git push`, and a
 * new Vercel deployment — exactly as every prior phase (2D.1-2D.6) has
 * done. This setting exists ONLY to guard against a repeat of the
 * Phase 2D.7.1 stale-cache incident after a deployment has ALREADY
 * succeeded — it is cache protection, not a live data-refresh
 * mechanism. A future developer must not assume "wait an hour" is ever
 * a substitute for shipping a real deployment.
 */
export const revalidate = 3600;

interface PageParams {
  profession: string;
  transfer: string;
}

/**
 * Phase 2D.4.2: this route now serves two genuinely different data
 * shapes at the same URL pattern — pairwise TransferRule pages (RN,
 * "texas-to-california") and single-state ProfessionStateFacts pages
 * (electrician, "colorado", "virginia" — Phase 2D.6.3 generalized this
 * from Colorado-only) — confirmed in Phase 2D.4/2D.4.1's architecture
 * review to be the only way to reach the required /electrician/{state}
 * URLs through Next.js's existing route structure.
 * isSingleStateSlug() is the ONE guard everything below branches on;
 * every existing RN code path below it is completely untouched.
 *
 * Derived from the same SUPPORTED_ELECTRICIAN_STATES whitelist that
 * generateStaticParams()/sitemap.ts already use (electrician-state-data.ts)
 * instead of a hand-maintained OR chain: the prior hardcoded chain only
 * listed "colorado" and "virginia", silently missing "texas" even though
 * Texas was added to the whitelist and to the sitemap in Phase 2F.2 — a
 * real gap found while adding Arkansas, fixed here rather than repeated
 * a fourth time.
 */
function isSingleStateSlug(profession: string, transfer: string): boolean {
  return profession === "electrician" && (SUPPORTED_ELECTRICIAN_STATES as readonly string[]).includes(transfer);
}

export function generateStaticParams() {
  return [...getAllPublicTransferRuleSlugs().map((s) => ({ profession: s.profession, transfer: s.transfer })), ...getAllSingleStateProfessionSlugs().map((s) => ({ profession: s.profession, transfer: s.slug }))];
}

const stateName = stateDisplayName;

/**
 * Per-state meta descriptions for the single-state electrician pages.
 * Numbers are pulled directly from each state's sourced reciprocityRules
 * fact in the electrician knowledge-base facts directory (one JSON file
 * per state/tier) — every figure here traces to a confidenceLevel:
 * "verified" field, never a needs_review one. Colorado, Utah, and Iowa use bespoke phrasing instead
 * of the generic "Journeyman from X, Master from Y" template because a
 * flat number would misrepresent them: Colorado's Master tier has zero
 * reciprocity states (not merely fewer), Utah has exactly one shared
 * agreement (Oregon) covering both tiers, and Iowa's 13-state reciprocal
 * list maps asymmetrically to its Master tier (only 8 of 13 states'
 * Master/Contractor licenses reciprocate to Iowa Master — the other 5 land
 * at Iowa Journeyman Class A only), so no single "N states" figure for
 * Iowa Master would be accurate.
 */
const ELECTRICIAN_STATE_META_DESCRIPTIONS: Record<string, string> = {
  colorado:
    "Colorado electrician license reciprocity: Journeyman recognized from 14 states; Master not available by reciprocity. Sourced from Colorado's board.",
  virginia:
    "Virginia electrician license reciprocity: Journeyman recognized from 2 states, Master from 3. Sourced directly from Virginia's licensing board.",
  texas:
    "Texas electrician license reciprocity: Journeyman recognized from 11 states, Master from 7. Sourced directly from Texas's licensing board.",
  arkansas:
    "Arkansas electrician license reciprocity: Journeyman recognized from 17 states, Master from 4. Sourced directly from Arkansas's licensing board.",
  minnesota:
    "Minnesota electrician license reciprocity: Journeyman recognized from 9 states, Master from 4. Sourced directly from Minnesota's licensing board.",
  utah: "Utah has exactly one electrician reciprocity agreement — with Oregon — covering both Journeyman and Master tiers. Sourced from Utah DOPL.",
  wyoming:
    "Wyoming electrician license reciprocity: Journeyman recognized from 17 states, Master from 3. Sourced directly from Wyoming's licensing board.",
  iowa: "Iowa recognizes electrician licenses by reciprocity from 13 states; Master-tier eligibility varies by state. Sourced from Iowa's DIAL board.",
};

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
    const data = getElectricianStatePageData(resolvedParams.transfer);
    if (!data) return {};
    const stateName = resolvedParams.transfer.charAt(0).toUpperCase() + resolvedParams.transfer.slice(1);
    return buildMetadata({
      title: `${stateName} Electrician License Reciprocity`,
      description:
        ELECTRICIAN_STATE_META_DESCRIPTIONS[resolvedParams.transfer] ??
        `What it actually takes to reciprocate an out-of-state electrician license into ${stateName} — Journeyman and Master are genuinely different, sourced directly from the ${stateName} licensing board.`,
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
    const data = getElectricianStatePageData(resolvedParams.transfer);
    if (!data) notFound();
    const stateName = resolvedParams.transfer.charAt(0).toUpperCase() + resolvedParams.transfer.slice(1);
    const otherElectricianStates = getAllSingleStateProfessionSlugs().filter((s) => s.slug !== resolvedParams.transfer);
    return (
      <div>
        <Breadcrumbs
          items={[
            { name: "Professions", url: "/professions" },
            { name: "Electrician", url: "/profession/electrician" },
            { name: stateName, url: `/${resolvedParams.profession}/${resolvedParams.transfer}` },
          ]}
        />
        <JsonLd
          data={articleJsonLd({
            title: `${stateName} Electrician License Reciprocity — Journeyman vs. Master`,
            description: `What it actually takes to reciprocate an out-of-state electrician license into ${stateName}, by license tier.`,
            path: `/${resolvedParams.profession}/${resolvedParams.transfer}`,
            publishedAt: "2026-08-25",
            updatedAt: "2026-08-25",
          })}
        />
        <ColoradoElectricianContent state={resolvedParams.transfer} tiers={data.tiers} otherStates={otherElectricianStates} />
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