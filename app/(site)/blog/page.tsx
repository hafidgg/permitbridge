import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getAllBlogPosts } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Blog — Licensing Policy Updates",
  description: "Tracked changes to state licensing laws, Universal License Recognition adoption, and compact expansions as they happen.",
  path: "/blog",
});

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Blog", url: "/blog" }]} />
      <div className="container pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Blog</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Policy updates and licensing news, tracked as they happen.</p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-lg border border-border p-6 transition-shadow hover:shadow-md"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">{post.tag}</span>
              <h2 className="mt-2 text-lg font-semibold">{post.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                {formatDate(post.publishedAt)} · {post.readingMinutes} min read
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
