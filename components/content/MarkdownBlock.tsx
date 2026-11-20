/**
 * Minimal, dependency-free renderer for our own controlled markdown subset
 * (## and ### headings, paragraphs, "- " and "1. " lists, pipe tables with a
 * header row and a |---| separator, **bold**, and inline [text](url) links —
 * see /content). Any other syntax renders as literal
 * text, so scripts/check-built-output.ts fails the build on stray "**".
 * Avoids pulling in a full markdown/MDX pipeline for a handful of static
 * editorial files.
 *
 * Link support added specifically so editorial content can carry real,
 * visible, clickable citations to authoritative sources (Section 14.16) —
 * previously [text](url) syntax rendered as literal, unclickable text.
 */
import Link from "next/link";
import type { ReactNode } from "react";

function renderBold(text: string, keyPrefix: string): Array<string | ReactNode> {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) => (i % 2 ? <strong key={`${keyPrefix}-b-${i}`}>{part}</strong> : part));
}

function renderInline(text: string, keyPrefix: string) {
  const parts: Array<string | ReactNode> = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let linkIndex = 0;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderBold(text.slice(lastIndex, match.index), `${keyPrefix}-${linkIndex}`));
    }
    const [, label, url = ""] = match;
    // Same-site links are ordinary internal links: same tab, followed.
    if (url.startsWith("/")) {
      parts.push(
        <Link key={`${keyPrefix}-link-${linkIndex++}`} href={url} className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
          {label}
        </Link>
      );
      lastIndex = match.index + match[0].length;
      continue;
    }
    parts.push(
      <a key={`${keyPrefix}-link-${linkIndex++}`} href={url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(...renderBold(text.slice(lastIndex), `${keyPrefix}-end`));
  }
  return parts;
}

const BULLET = /^- /;
const TABLE_ROW = /^\|.*\|$/;
const TABLE_SEPARATOR = /^\|(?:\s*:?-{3,}:?\s*\|)+$/;

function tableCells(line: string): string[] {
  return line.slice(1, -1).split("|").map((c) => c.trim());
}
const NUMBERED = /^\d+\. /;

export function MarkdownBlock({ source }: { source: string }) {
  // A Windows checkout (core.autocrlf) gives CRLF files; blocks split on blank lines either way.
  const blocks = source.replace(/\r\n/g, "\n").trim().split(/\n\n+/);

  return (
    <div className="prose-permitbridge">
      {blocks.map((block, index) => {
        if (block.startsWith("### ")) {
          return <h3 key={index}>{renderInline(block.replace(/^###\s+/, ""), `block-${index}`)}</h3>;
        }
        if (block.startsWith("## ")) {
          return <h2 key={index}>{block.replace(/^##\s+/, "")}</h2>;
        }
        const lines = block.split("\n").map((l) => l.trim());
        // A table: header row, separator row, then body rows, every line wrapped in pipes.
        const [head = "", separator = "", ...rows] = lines;
        if (rows.length > 0 && lines.every((l) => TABLE_ROW.test(l)) && TABLE_SEPARATOR.test(separator)) {
          return (
            <div key={index} className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {tableCells(head).map((c, i) => (
                      <th key={i} scope="col">
                        {renderInline(c, `block-${index}-h-${i}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r}>
                      {tableCells(row).map((c, i) => (
                        <td key={i}>{renderInline(c, `block-${index}-${r}-${i}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        for (const [marker, Tag] of [[BULLET, "ul"], [NUMBERED, "ol"]] as const) {
          if (lines.every((l) => marker.test(l))) {
            return (
              <Tag key={index}>
                {lines.map((l, i) => (
                  <li key={i}>{renderInline(l.replace(marker, ""), `block-${index}-${i}`)}</li>
                ))}
              </Tag>
            );
          }
        }
        return <p key={index}>{renderInline(block, `block-${index}`)}</p>;
      })}
    </div>
  );
}
