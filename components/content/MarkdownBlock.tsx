/**
 * Minimal, dependency-free renderer for our own controlled markdown subset
 * (## headings, paragraphs, and inline [text](url) links only — see
 * /content). Avoids pulling in a full markdown/MDX pipeline for a handful
 * of static editorial files.
 *
 * Link support added specifically so editorial content can carry real,
 * visible, clickable citations to authoritative sources (Section 14.16) —
 * previously [text](url) syntax rendered as literal, unclickable text.
 */
import type { ReactNode } from "react";

function renderInlineLinks(text: string, keyPrefix: string) {
  const parts: Array<string | ReactNode> = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let linkIndex = 0;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, label, url] = match;
    parts.push(
      <a key={`${keyPrefix}-link-${linkIndex++}`} href={url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

export function MarkdownBlock({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\n+/);

  return (
    <div className="prose-permitbridge">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return <h2 key={index}>{block.replace(/^##\s+/, "")}</h2>;
        }
        return <p key={index}>{renderInlineLinks(block, `block-${index}`)}</p>;
      })}
    </div>
  );
}
