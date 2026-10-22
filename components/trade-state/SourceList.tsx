import type { SourceRecord } from "@/types/knowledge-base";

/** "Source: A, B" with each registered document linked, deduplicated by id. */
export function SourceList({ sources, className = "text-xs text-muted-foreground" }: { sources: SourceRecord[]; className?: string }) {
  const unique = [...new Map(sources.map((s) => [s.id, s] as const)).values()];
  return (
    <span className={className}>
      Source{unique.length > 1 ? "s" : ""}:{" "}
      {unique.map((src, i) => (
        <span key={src.id}>
          {i > 0 && "; "}
          <a href={src.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
            {sourceLabel(src)}
          </a>
        </span>
      ))}
    </span>
  );
}

const UPPER = /^(?:cilb|ocilb|cslb|dbpr|tdlr|tsbpe|acr|fac|al|ar|ky|la|ms|nc|sc|tn|tx|wv|c\d+|\d+[a-z]\d*)$/i;

/**
 * Agency name plus which of its documents, from the source id ("florida-dbpr-cilb-10-endorsement" ->
 * "... (CILB 10 Endorsement)"): an agency often has several registered documents behind one page.
 */
function sourceLabel(src: SourceRecord): string {
  const doc = src.id
    .split("-")
    .slice(2)
    .filter((t) => !/^(?:dbpr|ocilb|cslb|tdlr|tsbpe)$/i.test(t))
    .map((t) => (UPPER.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(" ");
  return doc ? `${src.agencyName} (${doc})` : src.agencyName;
}
