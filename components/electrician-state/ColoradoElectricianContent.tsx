import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
import { formatDate } from "@/lib/utils";
import type { ProfessionStateFacts, VerifiedField } from "@/types/knowledge-base";

/**
 * Phase 2D.4.2 (Colorado) / Phase 2D.6.3 (generalized for Virginia) —
 * content for a single-state, tier-aware profession page. Deliberately
 * a standalone component (not a branch inside the main
 * [profession]/[transfer]/page.tsx JSX) so the RN pairwise page's own
 * markup is never touched by this addition.
 *
 * Journeyman and Master are rendered as two visually and structurally
 * SEPARATE sections — never a single merged "reciprocity" statement —
 * per the explicit Phase 2D.4.2 requirement that the two tiers must
 * stay clearly distinct on the page itself, not just in the underlying
 * data files.
 *
 * Phase 2D.6.3: the file/export name stays ColoradoElectricianContent
 * for backward compatibility (only one caller, the page component, and
 * changing it would be a needless extra diff), but the component itself
 * is now state-name-parameterized. The Colorado-specific hardcoded
 * "Qualifying States" badge list was removed rather than generalized:
 * Virginia's real, researched rule is rank-AND-state-specific (Kentucky
 * + West Virginia for both tiers, Maryland for Master only) and does not
 * fit a single flat badge list the way Colorado's uniform 14-state NERA
 * list did. The full, precise, tier-specific breakdown already lives in
 * each tier's reciprocityRules text (rendered via FieldRow below) —
 * removing the redundant, Colorado-only badge section keeps the
 * component honestly generic instead of silently wrong for Virginia.
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
  const reciprocityAllowed = facts.reciprocityRules.value !== "Unknown" && !String(facts.reciprocityRules.value).toLowerCase().includes("may not be granted by reciprocity");
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
        <FieldRow label="Universal License Recognition" field={facts.universalLicenseRecognitionStatus} />
      </div>
    </section>
  );
}

function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ColoradoElectricianContent({
  state,
  tiers,
  otherStates,
}: {
  state: string;
  tiers: Array<{ tier: string; facts: ProfessionStateFacts }>;
  otherStates: Array<{ profession: string; slug: string }>;
}) {
  const stateName = toTitleCase(state);
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
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{stateName} Electrician License Reciprocity</h1>
        <p className="mt-1 text-lg text-muted-foreground">By License Tier — Journeyman and Master are genuinely different</p>
        {latestVerifiedAt && <p className="mt-4 text-xs text-muted-foreground">Last researched {formatDate(latestVerifiedAt)}</p>}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">{stateName} treats these two license tiers differently — read each section below carefully.</p>
        <p className="mt-1 text-muted-foreground">
          The reciprocity rules for Journeyman and Master electricians are separately sourced and may cover different qualifying states. See each
          section below for the full, separately-sourced details.
        </p>
      </div>

      <TierSection tier="journeyman" facts={journeyman.facts} />
      <TierSection tier="master" facts={master.facts} />

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold">Explore Further</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/profession/electrician" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            All Electrician Info
          </Link>
        </div>
        {otherStates.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Other electrician reciprocity states:</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {otherStates.map((s) => (
                <Link key={s.slug} href={`/${s.profession}/${s.slug}`} className="text-primary hover:underline">
                  {toTitleCase(s.slug)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
