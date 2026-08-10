import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { formatDate } from "@/lib/utils";
import { getAllGuides, getGuideBySlug, getGuideBody } from "@/lib/data";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};
  return buildMetadata({ title: guide.title, description: guide.description, path: `/guides/${guide.slug}` });
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  const body = getGuideBody(slug);
  if (!guide || !body) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Guides", url: "/guides" }, { name: guide.title, url: `/guides/${guide.slug}` }]} />
      <JsonLd
        data={articleJsonLd({
          title: guide.title,
          description: guide.description,
          path: `/guides/${guide.slug}`,
          publishedAt: guide.publishedAt,
          updatedAt: guide.updatedAt,
        })}
      />

      <article className="container max-w-3xl pb-16">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{guide.category}</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{guide.title}</h1>
        <p className="mt-4 text-xs text-muted-foreground">
          Published {formatDate(guide.publishedAt)} · Updated {formatDate(guide.updatedAt)} · {guide.readingMinutes} min read
        </p>

        <div className="mt-8">
          <MarkdownBlock source={body} />
        </div>
      </article>
    </div>
  );
}
