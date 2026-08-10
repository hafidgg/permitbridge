/**
 * Minimal, dependency-free renderer for our own controlled markdown subset
 * (## headings and paragraphs only — see /content). Avoids pulling in a
 * full markdown/MDX pipeline for a handful of static editorial files.
 */
export function MarkdownBlock({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\n+/);

  return (
    <div className="prose-permitbridge">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return <h2 key={index}>{block.replace(/^##\s+/, "")}</h2>;
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}
