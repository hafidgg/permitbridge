import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/home/SearchBox";
import { buildSearchIndex } from "@/lib/search";
import { MapPinned } from "lucide-react";

export default function NotFound() {
  const searchIndex = buildSearchIndex();

  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <MapPinned className="mb-6 h-14 w-14 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">This page took a wrong turn.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We couldn't find that page (404). It may have moved, or the profession/state combination doesn't exist yet.
        Try searching below.
      </p>

      <div className="mt-8 w-full max-w-lg">
        <SearchBox searchIndex={searchIndex} placeholder="Search professions, states, or transfers…" autoFocus />
      </div>

      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/">Back to Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/professions">Browse Professions</Link>
        </Button>
      </div>
    </div>
  );
}
