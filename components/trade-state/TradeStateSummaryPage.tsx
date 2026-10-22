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
import { getTradeStateNotes } from "@/lib/trade-state-notes";
import { SourceList } from "@/components/trade-state/SourceList";
import { getSourceByUrl } from "@/lib/knowledge-base/transfer-rule-data";
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
  const board = s.shared?.source ?? s.pairs[0]?.source;
  const notes = getTradeStateNotes(profession, state);
  // Folded pairs with an originRow render as table rows; kept pairs (own page) stay as cards.
  const rows = s.pairs.filter((p) => !p.hasPage && p.rule.originRow);
  const rowSources = (urls: string[]) => urls.map((u) => getSourceByUrl(u)).filter((x): x is NonNullable<typeof x> => !!x);

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
                Fees are the state fees recorded for this route
                {/* Only folded origins carry their steps here; a kept pair's breakdown is on its own page. */}
                {s.pairs.some((p) => p.steps.length > 0) ? "; each origin below gives the breakdown." : "."}
              </p>
              <p className="mt-2">
                <SourceList sources={notes?.routeSources ?? [s.shared.source]} />
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The route differs by origin state, so it is shown separately for each one below. Processing time: {PROCESSING_TIME_NOT_PUBLISHED.toLowerCase()}.
            </p>
          )}
          {board && (
            <p className="mt-3 text-sm text-muted-foreground">
              Independent reference, not legal advice. Confirm with the{" "}
              <a href={board.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                {board.agencyName}
              </a>{" "}
              before applying.
            </p>
          )}
        </section>

        {notes?.heading && (
          <section className="mt-10">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">{notes.heading}</h2>
            <ul className="space-y-3 text-sm">
              {notes.items.map((item, i) => (
                <li key={i}>
                  <span className="font-medium">{item.label}.</span> {item.text}
                  {item.quote && <> &ldquo;{item.quote}&rdquo;</>}
                  <span className="text-muted-foreground">
                    {" "}
                    ({item.cite ? `${item.cite}, ` : ""}
                    <a href={item.source.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                      {item.source.agencyName}
                    </a>
                    )
                  </span>
                </li>
              ))}
            </ul>
            {notes.openQuestions.length > 0 && (
              <div className="mt-4">
                <Badge variant="outline">Open question{notes.openQuestions.length > 1 ? "s" : ""}</Badge>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {notes.openQuestions.map((q) => (
                    <li key={q.text}>
                      {q.text} (Source:{" "}
                      <a href={q.source.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                        {q.source.agencyName}
                      </a>
                      )
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">By origin state</h2>
          {s.boardProcedure && (
            <p className="mb-4 text-sm text-muted-foreground">
              Steps the {s.boardProcedure.agencies.join(" and ")} applies to HVAC and plumbing applicants alike are on the{" "}
              <Link href={`/state/${state}#board-procedure`} className="text-primary underline underline-offset-4">
                {s.destination.name} page
              </Link>
              .
            </p>
          )}
          {rows.length > 0 && notes && notes.originShared.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium">For every origin state in the table below:</p>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {notes.originShared.map((x) => (
                  <li key={x.text}>
                    {x.text} <SourceList sources={x.sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rows.length > 0 && (
            <div className="mb-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">Origin</th>
                    <th scope="col" className="px-4 py-3">What applies</th>
                    <th scope="col" className="px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => (
                    <tr key={p.origin.slug} id={`from-${p.origin.slug}`} className="scroll-mt-20 align-top">
                      <td className="px-4 py-3 font-medium">{p.origin.name}</td>
                      <td className="px-4 py-3">
                        {p.rule.originRow!.applies}
                        {p.rule.originRow!.note && <p className="mt-1 text-muted-foreground">{p.rule.originRow!.note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <SourceList sources={rowSources(p.rule.originRow!.sourceUrls)} className="text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="space-y-4">
            {s.pairs.filter((p) => !rows.includes(p)).map((p) => (
              <div key={p.origin.slug} id={`from-${p.origin.slug}`} className="scroll-mt-20 rounded-lg border border-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    From {p.origin.name} <span className="text-muted-foreground">→</span> {s.destination.name}
                  </h3>
                  {p.hasPage && (
                    <Link href={`/transfer/${profession}/${p.origin.slug}/${state}`} className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
                      Full requirements <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <p className="mt-2 text-sm">{p.rule.pathwayLabel}</p>
                {!s.shared && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatUsd(p.rule.feeUsd)} in fees · {p.rule.examRequired ? "exam required" : "no exam"}
                  </p>
                )}
                {p.steps.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
                    {p.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
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
                {!p.hasPage && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Source:{" "}
                    <a href={p.source.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                      {p.source.agencyName}
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
          {s.sharedSteps.length > 0 && (
            <div className="mt-6 rounded-lg border border-border p-5">
              <h3 className="text-lg font-semibold">Steps that apply to more than one origin state</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {s.sharedSteps.map((step) => (
                  <li key={step.text}>
                    <p className="font-medium">
                      {step.openQuestion ? "Open question for licenses from " : "For licenses from "}
                      {step.origins.map((o) => o.name).join(", ")}:
                    </p>
                    <p className={step.openQuestion ? "mt-1 text-muted-foreground" : "mt-1"}>{step.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source:{" "}
                      {step.sources.map((src, i) => (
                        <span key={src.id}>
                          {i > 0 && ", "}
                          <a href={src.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                            {src.agencyName}
                          </a>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {s.pendingOrigins.length > 0 && (
          <section className="mt-10 rounded-lg border border-dashed border-border p-5">
            <h2 className="mb-2 text-lg font-bold">Researched, pending an official answer from the board</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              We researched these routes into {s.destination.name}, but each turns on a legal question the official documents don&apos;t settle. We
              won&apos;t publish an answer until the board gives one.
            </p>
            <ul className="space-y-2 text-sm">
              {s.pendingOrigins.map((p) => (
                <li key={p.origin.slug}>
                  <strong>From {p.origin.name}:</strong> <span className="text-muted-foreground">{p.question} (Question for the {p.board}.)</span>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
  );
}
