import type { PairNotes } from "@/lib/pair-notes";

/** One sourced section of pair-specific facts; every item shows its verbatim quote and the source it came from. */
export function PairNotesSection({ notes }: { notes: PairNotes }) {
  const readOn = new Date(`${notes.sourcesReadOn}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-2xl font-bold tracking-tight">{notes.heading}</h2>
      <p className="mb-4 text-sm text-muted-foreground">Sources for this section read {readOn}.</p>
      <ul className="space-y-3 text-sm">
        {notes.items.map((item) => (
          <li key={item.label}>
            <span className="font-medium">{item.label}.</span> {item.text} &ldquo;{item.quote}&rdquo;
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
    </section>
  );
}
