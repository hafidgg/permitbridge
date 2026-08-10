import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { BlogPostSummary } from "@/types";

export function LatestUpdates({ posts }: { posts: BlogPostSummary[] }) {
  return (
    <section className="container py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest Policy Updates</h2>
          <p className="mt-2 text-muted-foreground">Licensing law changes, tracked as they happen.</p>
        </div>
        <Link href="/blog" className="text-sm font-medium text-primary hover:underline">
          View all updates →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block rounded-lg border border-border p-6 transition-shadow hover:shadow-md"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">{post.tag}</span>
            <h3 className="mt-2 text-lg font-semibold">{post.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              {formatDate(post.publishedAt)} · {post.readingMinutes} min read
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
