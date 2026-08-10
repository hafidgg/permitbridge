/**
 * Renders a <script type="application/ld+json"> tag from a plain object.
 * Server component — no client JS needed.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
