import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { formatDate } from "@/lib/utils";
import { getAllBlogPosts, getBlogPostBySlug, getBlogBody } from "@/lib/data";
import { buildMetadata, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export function generateStaticParams() {
  return getAllBlogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return {};
  return buildMetadata({ title: post.title, description: post.description, path: `/blog/${post.slug}` });
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  const body = getBlogBody(slug);
  if (!post || !body) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Blog", url: "/blog" }, { name: post.title, url: `/blog/${post.slug}` }]} />
      <JsonLd
        data={articleJsonLd({
          title: post.title,
          description: post.description,
          path: `/blog/${post.slug}`,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
        })}
      />

      <article className="container max-w-3xl pb-16">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{post.tag}</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{post.title}</h1>
        <p className="mt-4 text-xs text-muted-foreground">
          Published {formatDate(post.publishedAt)} · Updated {formatDate(post.updatedAt)} · {post.readingMinutes} min read
        </p>

        <div className="mt-8">
          <MarkdownBlock source={body} />
        </div>
      </article>
    </div>
  );
}
