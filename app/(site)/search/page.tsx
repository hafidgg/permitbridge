import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SearchBox } from "@/components/home/SearchBox";
import { buildSearchIndex } from "@/lib/search";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Search",
  description: "Search PermitBridge for professions, states, and license transfer rules.",
  path: "/search",
  noIndex: true,
});

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const searchIndex = buildSearchIndex();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Search", url: "/search" }]} />

      <div className="container flex flex-col items-center py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Search PermitBridge</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Find a profession, a state, or a specific transfer — e.g. "nurse Ohio to Texas".
        </p>

        <div className="mt-8 w-full max-w-xl">
          <SearchBox searchIndex={searchIndex} placeholder="Search professions, states, or transfers…" autoFocus />
        </div>

        {resolvedSearchParams?.q && (
          <p className="mt-6 text-sm text-muted-foreground">
            Showing suggestions for <strong>&ldquo;{resolvedSearchParams.q}&rdquo;</strong> above.
          </p>
        )}
      </div>
    </div>
  );
}
