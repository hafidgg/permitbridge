import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { formatDate } from "@/lib/utils";
import { getAllGuides } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Guides — Understanding License Reciprocity",
  description: "In-depth guides explaining how professional license reciprocity, endorsement, and recognition actually work in the United States.",
  path: "/guides",
});

export default function GuidesPage() {
  const guides = getAllGuides();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Guides", url: "/guides" }]} />
      <div className="container pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Guides</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Plain-language explanations of the concepts behind every transfer page on PermitBridge.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="block rounded-lg border border-border p-6 transition-shadow hover:shadow-md"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">{guide.category}</span>
              <h2 className="mt-2 text-lg font-semibold">{guide.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{guide.description}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                Updated {formatDate(guide.updatedAt)} · {guide.readingMinutes} min read
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
