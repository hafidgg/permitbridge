"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, FileText, MapPinned, ArrowLeftRight, BookOpen, Newspaper } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchDocument } from "@/types";

const TYPE_ICON: Record<SearchDocument["type"], React.ComponentType<{ className?: string }>> = {
  profession: FileText,
  state: MapPinned,
  transfer: ArrowLeftRight,
  guide: BookOpen,
  blog: Newspaper,
};

function scoreDocument(doc: SearchDocument, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  const haystacks = [doc.title, doc.description, ...doc.keywords].map((s) => s.toLowerCase());

  for (const term of q.split(/\s+/)) {
    if (doc.title.toLowerCase().includes(term)) score += 5;
    if (doc.keywords.some((k) => k.toLowerCase().includes(term))) score += 3;
    if (doc.description.toLowerCase().includes(term)) score += 1;
    if (!haystacks.some((h) => h.includes(term))) score -= 2;
  }
  return score;
}

export function SearchBox({
  searchIndex,
  placeholder = "Search professions, states, or transfers…",
  autoFocus = false,
}: {
  searchIndex: SearchDocument[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    return searchIndex
      .map((doc) => ({ doc, score: scoreDocument(doc, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => r.doc);
  }, [query, searchIndex]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const topResult = results[0];
    if (topResult) {
      router.push(topResult.url);
    } else if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="h-14 pl-11 pr-4 text-base shadow-sm"
            aria-label="Search PermitBridge"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="search-results-listbox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
          />
        </div>
      </form>

      {open && results.length > 0 && (
        <ul
          id="search-results-listbox"
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-card text-left shadow-lg"
        >
          {results.map((doc) => {
            const Icon = TYPE_ICON[doc.type];
            return (
              <li key={doc.url} role="option" aria-selected="false">
                <Link
                  href={doc.url}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium">{doc.title}</span>
                    <span className="block text-xs text-muted-foreground">{doc.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
