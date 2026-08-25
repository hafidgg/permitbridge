import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { formatDate } from "@/lib/utils";
import type { ProfessionStateFacts, VerifiedField } from "@/types/knowledge-base";

/**
 * Phase 2D.4.2 — content for a single-state, tier-aware profession page.
 * Deliberately a standalone component (not a branch inside the main
 * [profession]/[transfer]/page.tsx JSX) so the RN pairwise page's own
 * markup is never touched by this addition.
 *
 * Journeyman and Master are rendered as two visually and structurally
 * SEPARATE sections — never a single merged "reciprocity" statement —
 * per the explicit Phase 2D.4.2 requirement that the two tiers must
 * stay clearly distinct on the page itself, not just in the underlying
 * data files.
 */

function FieldRow({ label, field }: { label: string; field: VerifiedField<unknown> }) {
  if (field.value === "Unknown") {
    return (
      <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-right text-sm text-muted-foreground">Not yet confirmed</span>
      </div>
    );
  }
  const source = field.sourceUrl ? getSourceByUrl(field.sourceUrl) : undefined;
  const displayValue = typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value);
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-right text-sm">{displayValue}</span>
      </div>
      {source && (
        <a href={field.sourceUrl!} target="_blank" rel="noopener noreferrer nofollow" className="self-end text-xs text-primary hover:underline">
          Source: {source.agencyName} ↗
        </a>
      )}
    </div>
  );
}

function TierSection({ tier, facts }: { tier: string; facts: ProfessionStateFacts }) {
  const tierLabel = tier === "journeyman" ? "Journeyman Electrician" : "Master Electrician";
  const reciprocityAllowed = tier === "journeyman"; // per the real, confirmed research — not inferred here, just labeling the known distinction for the badge
  const badgeVariant: "success" | "destructive" = reciprocityAllowed ? "success" : "destructive";

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{tierLabel}</h2>
        <Badge variant={badgeVariant}>{reciprocityAllowed ? "Reciprocity Available" : "Reciprocity NOT Available"}</Badge>
      </div>
      <div className="mt-4 rounded-xl border border-border px-6">
        <FieldRow label="Reciprocity Rules" field={facts.reciprocityRules} />
        <FieldRow label="Licensing Board" field={facts.licensingBoard} />
        <FieldRow label="Exam Requirement" field={facts.requiredExams} />
        <FieldRow label="Experience Requirement" field={facts.requiredExperience} />
        <FieldRow label="Application Fee" field={facts.endorsementFeeUsd} />
        <FieldRow label="Processing Time" field={facts.processingTime} />
      </div>
    </section>
  );
}

export function ColoradoElectricianContent({ tiers }: { tiers: Array<{ tier: string; facts: ProfessionStateFacts }> }) {
  const journeyman = tiers.find((t) => t.tier === "journeyman")!;
  const master = tiers.find((t) => t.tier === "master")!;
  const latestVerifiedAt = tiers
    .flatMap((t) => Object.values(t.facts).filter((v): v is VerifiedField<unknown> => !!v && typeof v === "object" && "verifiedAt" in v))
    .map((f) => f.verifiedAt)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <div className="container max-w-4xl pb-16">
      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Colorado Electrician License Reciprocity</h1>
        <p className="mt-1 text-lg text-muted-foreground">By License Tier — Journeyman and Master are genuinely different</p>
        {latestVerifiedAt && <p className="mt-4 text-xs text-muted-foreground">Last researched {formatDate(latestVerifiedAt)}</p>}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">Colorado treats these two license tiers very differently.</p>
        <p className="mt-1 text-muted-foreground">
          A Journeyman Electrician certificate from a qualifying state can be reciprocated into Colorado. A Master Electrician license{" "}
          <strong>cannot</strong> — Colorado&apos;s own regulation states this directly. See each section below for the full, separately-sourced
          details.
        </p>
      </div>

      <TierSection tier="journeyman" facts={journeyman.facts} />
      <TierSection tier="master" facts={master.facts} />

      <section className="mt-10">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Journeyman: Qualifying States</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Colorado follows National Electrical Reciprocal Alliance (NERA) bylaws. A journeyman or master certificate from one of these states may be
          reciprocated to a Colorado journeyman license without a written exam, subject to the eligibility conditions above.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Alaska", "Arkansas", "Idaho", "Iowa", "Minnesota", "Montana", "Nebraska", "New Hampshire", "New Mexico", "North Dakota", "Oklahoma", "South Dakota", "Utah", "Wyoming"].map(
            (state) => (
              <Badge key={state} variant="outline">
                {state}
              </Badge>
            )
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold">Explore Further</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/profession/electrician" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            All Electrician Info
          </Link>
        </div>
      </section>
    </div>
  );
}
